// Unified ActiveRecord-Style Reactive API for Zero.js
// Matches Rails ActiveRecord patterns: https://guides.rubyonrails.org/active_record_querying.html
// Single class handles both single and collection results

import { getZero } from './zero-client';
import { debugDatabase, debugReactive, debugError } from '$lib/utils/debug';

// Centralized Zero.js configuration
export const ZERO_CONFIG = {
  DEFAULT_TTL: '1h',
  RETRY_DELAY: 100,
  MAX_RETRIES: 50,
  DEBUG_LOGGING: true
} as const;

/**
 * ActiveRecord-style reactive query for Zero.js
 * Unified class that handles both single records (.find) and collections (.where, .all)
 * 
 * @example
 * ```typescript
 * // Single record (like Rails User.find(1))
 * const user = new ReactiveQuery(() => zero.query.users.where('id', '123').one());
 * debugDatabase('User record:', user.record); // User | null
 * 
 * // Collection (like Rails User.where(active: true))  
 * const users = new ReactiveQuery(() => zero.query.users.where('active', true));
 * debugDatabase('User records:', users.records); // User[]
 * ```
 */
export class ReactiveQuery<T> {
  private _state = $state({
    data: null as T | T[] | null,
    isLoading: true,
    error: null as Error | null,
    isCollection: false // Track if this query returns collection or single record
  });
  
  private view: any = null;
  private removeListener: (() => void) | null = null;
  private retryTimeoutId: number | null = null;
  private retryCount = 0;
  private subscribers: Array<(data: T | T[] | null, meta: QueryMeta) => void> = [];
  private isDestroyed = false;

  constructor(
    private getQueryBuilder: () => any | null,
    private options: QueryOptions<T> = {}
  ) {
    const { defaultValue = null, ttl, expectsCollection = false } = this.options;
    
    this._state.data = defaultValue;
    this._state.isCollection = expectsCollection;
    this._state.isLoading = true;
    this._state.error = null;
    
    this.initializeQuery();
  }

  // ActiveRecord-style getters (match Rails API)
  
  /** Single record access (like Rails .find result) */
  get record(): T | null {
    if (this._state.isCollection) {
      throw new ActiveRecordError('Called .record on collection query. Use .records instead.');
    }
    return this._state.data as T | null;
  }
  
  /** Collection access (like Rails .where result) */
  get records(): T[] {
    if (!this._state.isCollection) {
      throw new ActiveRecordError('Called .records on single record query. Use .record instead.');
    }
    return (this._state.data as T[]) || [];
  }
  
  /** Universal data access - returns whatever the query type expects */
  get data(): T | T[] | null {
    return this._state.data;
  }
  
  /** Loading state (Rails doesn't have this, but useful for UI) */
  get isLoading(): boolean {
    return this._state.isLoading;
  }
  
  /** Error state with proper ActiveRecord-style error handling */
  get error(): Error | null {
    return this._state.error;
  }
  
  /** Check if record/collection is present (like Rails .present?) */
  get present(): boolean {
    if (this._state.isCollection) {
      return Array.isArray(this._state.data) && this._state.data.length > 0;
    }
    return this._state.data !== null && this._state.data !== undefined;
  }
  
  /** Check if record/collection is blank (like Rails .blank?) */
  get blank(): boolean {
    return !this.present;
  }

  // ActiveRecord-style methods
  
  /** 
   * Reload the query (like Rails .reload) 
   * Forces fresh data fetch from Zero
   */
  reload(): void {
    if (!this.isDestroyed) {
      this.cleanup();
      this.retryCount = 0;
      this.initializeQuery();
    }
  }
  
  /**
   * Subscribe to changes (for vanilla JS usage)
   * @param callback Function called when data changes
   * @returns Unsubscribe function
   */
  subscribe(callback: (data: T | T[] | null, meta: QueryMeta) => void): () => void {
    this.subscribers.push(callback);
    
    // Immediately call with current state
    callback(this._state.data, this.getMeta());
    
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }
  
  /**
   * Destroy the query and clean up resources (like Rails connection cleanup)
   */
  destroy(): void {
    this.isDestroyed = true;
    this.cleanup();
    this.subscribers = [];
  }

  // Private implementation
  
  private initializeQuery(): void {
    const tryInitialize = () => {
      if (this.isDestroyed) return;
      
      try {
        const queryBuilder = this.getQueryBuilder();
        
        if (!queryBuilder) {
          this.retryQuery();
          return;
        }
        
        this.createZeroView(queryBuilder);
        
      } catch (err) {
        this.handleError(err);
      }
    };
    
    tryInitialize();
  }
  
  private createZeroView(queryBuilder: any): void {
    const ttlValue = this.options.ttl || ZERO_CONFIG.DEFAULT_TTL;
    
    // Validate TTL per Zero.js documentation
    if (typeof ttlValue !== 'string' && typeof ttlValue !== 'number') {
      throw new ActiveRecordError(`Invalid TTL: ${ttlValue}. Use string like '5m' or number in ms`);
    }
    
    if (ZERO_CONFIG.DEBUG_LOGGING) {
      debugDatabase('ReactiveQuery: Creating view with TTL', { ttlValue });
    }
    
    this.view = queryBuilder.materialize(ttlValue);
    
    // Set up Zero's native listener for real-time updates
    this.removeListener = this.view.addListener((newData: T | T[]) => {
      if (this.isDestroyed) return;
      
      if (ZERO_CONFIG.DEBUG_LOGGING) {
        const count = Array.isArray(newData) ? newData.length : (newData ? 1 : 0);
        debugReactive('ReactiveQuery: Data updated', { count });
      }
      
      this.updateState(newData, false, null);
    });
    
    // Get initial data synchronously
    const initialData = this.view.data;
    if (initialData !== undefined) {
      this.updateState(initialData, false, null);
    }
  }
  
  private retryQuery(): void {
    if (this.retryCount >= ZERO_CONFIG.MAX_RETRIES) {
      this.handleError(new ActiveRecordError('Max retries exceeded waiting for Zero client'));
      return;
    }
    
    this.retryCount++;
    this.updateState(this.options.defaultValue || null, true, null);
    this.retryTimeoutId = setTimeout(() => this.initializeQuery(), ZERO_CONFIG.RETRY_DELAY) as any;
  }
  
  private handleError(err: any): void {
    if (this.isDestroyed) return;
    
    const error = err instanceof Error ? err : new ActiveRecordError('Unknown query error');
    this.updateState(this.options.defaultValue || null, false, error);
    
    debugError('ReactiveQuery: Error during query', { error });
  }
  
  private updateState(data: T | T[] | null, isLoading: boolean, error: Error | null): void {
    this._state.data = data;
    this._state.isLoading = isLoading;
    this._state.error = error;
    
    // Notify subscribers
    const meta = this.getMeta();
    this.subscribers.forEach(callback => {
      try {
        callback(data, meta);
      } catch (err) {
        debugError('ReactiveQuery subscriber error', { error: err });
      }
    });
  }
  
  private getMeta(): QueryMeta {
    return {
      isLoading: this._state.isLoading,
      error: this._state.error,
      isCollection: this._state.isCollection,
      present: this.present,
      blank: this.blank
    };
  }
  
  private cleanup(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
    
    if (this.removeListener) {
      this.removeListener();
      this.removeListener = null;
    }
    
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
  }
}

// Supporting types and utilities

interface QueryOptions<T> {
  defaultValue?: T | T[] | null;
  ttl?: string | number;
  expectsCollection?: boolean;
}

interface QueryMeta {
  isLoading: boolean;
  error: Error | null;
  isCollection: boolean;
  present: boolean;
  blank: boolean;
}

/**
 * ActiveRecord-style error class
 * Matches Rails error patterns for consistency
 */
export class ActiveRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActiveRecordError';
  }
}

/**
 * Factory functions for creating queries (matches Rails patterns)
 */
export const QueryFactory = {
  /** Create query that expects single record (like Rails .find) */
  forRecord<T>(queryBuilder: () => any, options: Omit<QueryOptions<T>, 'expectsCollection'> = {}): ReactiveQuery<T> {
    return new ReactiveQuery<T>(queryBuilder, { ...options, expectsCollection: false });
  },
  
  /** Create query that expects collection (like Rails .where) */
  forCollection<T>(queryBuilder: () => any, options: Omit<QueryOptions<T>, 'expectsCollection'> = {}): ReactiveQuery<T> {
    return new ReactiveQuery<T>(queryBuilder, { 
      ...options, 
      expectsCollection: true, 
      defaultValue: options.defaultValue || [] 
    });
  }
};