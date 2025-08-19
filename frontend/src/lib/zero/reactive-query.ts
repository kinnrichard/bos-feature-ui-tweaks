/**
 * Reactive Query Wrapper for Zero.js with Svelte 5 Integration
 * 
 * Provides enhanced reactive query capabilities that integrate seamlessly with
 * Svelte 5's reactivity system while maintaining compatibility with vanilla JavaScript.
 * 
 * Features:
 * - Svelte 5 $state rune integration for automatic reactivity
 * - Lifecycle management (destroy, refresh)
 * - Enhanced loading/error state management
 * - Support for both collection and single record queries
 * - Automatic retry and connection recovery
 * - Type-safe query building with Rails-style API
 */

// Note: $state rune is available in .svelte files
// For .ts files, we'll use a reactive object pattern
import { zeroClient, ZeroNotAvailableError } from './client';
import { ZeroQueryBuilder } from './query-builder';
import type { ZeroClient } from './zero-client';
import { debugDatabase, debugPerformance, debugError, debugReactive } from '$lib/utils/debug';

// Default TTL for queries when none specified
const DEFAULT_TTL = '1h';

// Query state interface
export interface QueryState<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
  isInitialized: boolean;
  lastUpdated: number | null;
}

// Query options
export interface QueryOptions {
  ttl?: string;
  retryAttempts?: number;
  retryDelay?: number;
  enabled?: boolean;
}

// Subscription callback type
export type SubscriptionCallback<T> = (state: QueryState<T>) => void;

/**
 * Enhanced reactive query wrapper for Zero.js collections
 * Provides Rails-style ActiveRecord API with Svelte 5 reactivity
 */
export class ReactiveQuery<T> {
  // Reactive state object - will be made reactive in Svelte components
  private _state: QueryState<T[]> = {
    data: [],
    isLoading: true,
    error: null,
    isInitialized: false,
    lastUpdated: null
  };
  
  private view: any = null;
  private removeListener: (() => void) | null = null;
  private retryTimeoutId: number | null = null;
  private subscribers: Array<SubscriptionCallback<T[]>> = [];
  private isDestroyed = false;
  private retryCount = 0;
  
  constructor(
    private getQueryBuilder: () => ZeroQueryBuilder<T> | any | null,
    private options: QueryOptions = {}
  ) {
    const { retryAttempts = 3, enabled = true } = this.options;
    
    // Initialize state
    this._state.data = [];
    this._state.isLoading = enabled;
    this._state.error = null;
    this._state.isInitialized = false;
    this._state.lastUpdated = null;
    
    // Development warning for missing TTL
    if (this.options.ttl === undefined) {
      debugDatabase('ReactiveQuery created without TTL - using default', {
        defaultTTL: DEFAULT_TTL,
        queryBuilder: this.getQueryBuilder.toString(),
        message: 'Consider adding explicit TTL like "5m" or "2h" for background persistence.'
      });
    }
    
    // Start query if enabled
    if (enabled) {
      this.initializeQuery();
    }
  }
  
  // Reactive getters for Svelte components
  get data(): T[] { return this._state.data; }
  get isLoading(): boolean { return this._state.isLoading; }
  get error(): Error | null { return this._state.error; }
  get isInitialized(): boolean { return this._state.isInitialized; }
  get lastUpdated(): number | null { return this._state.lastUpdated; }
  
  // Imperative access for vanilla JavaScript
  get current(): T[] { return this._state.data; }
  get loading(): boolean { return this._state.isLoading; }
  get state(): QueryState<T[]> { 
    return {
      data: this._state.data,
      isLoading: this._state.isLoading,
      error: this._state.error,
      isInitialized: this._state.isInitialized,
      lastUpdated: this._state.lastUpdated
    };
  }
  
  /**
   * Subscribe to data changes (for vanilla JS usage)
   */
  subscribe(callback: SubscriptionCallback<T[]>): () => void {
    this.subscribers.push(callback);
    
    // Immediately call with current state
    callback(this.state);
    
    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }
  
  /**
   * Refresh the query manually
   */
  refresh(): void {
    if (!this.isDestroyed) {
      this.retryCount = 0;
      this.cleanup();
      this.initializeQuery();
    }
  }
  
  /**
   * Enable the query (starts listening if disabled)
   */
  enable(): void {
    if (!this.isDestroyed && !this.view) {
      this.initializeQuery();
    }
  }
  
  /**
   * Disable the query (stops listening but keeps data)
   */
  disable(): void {
    this.cleanup();
    this.updateState({
      data: this._state.data,
      isLoading: false,
      error: null,
      isInitialized: this._state.isInitialized,
      lastUpdated: this._state.lastUpdated
    });
  }
  
  /**
   * Clean up resources and stop listening
   */
  destroy(): void {
    this.isDestroyed = true;
    this.cleanup();
    this.subscribers = [];
  }
  
  /**
   * Check if query is currently active (has listeners)
   */
  isActive(): boolean {
    return this.view !== null && this.removeListener !== null;
  }
  
  private initializeQuery(): void {
    const tryInitialize = () => {
      if (this.isDestroyed) return;
      
      try {
        // Get queryBuilder from function
        const queryBuilder = this.getQueryBuilder();
        
        // Check if queryBuilder is available
        if (!queryBuilder) {
          debugDatabase('ReactiveQuery: Query builder not ready, retrying in 100ms');
          const { retryDelay = 100 } = this.options;
          this.retryTimeoutId = setTimeout(tryInitialize, retryDelay) as any;
          return;
        }
        
        // Handle both new query builder and legacy patterns
        let query: any;
        if (queryBuilder instanceof ZeroQueryBuilder) {
          // New query builder - use materialize method
          const ttlValue = this.options.ttl || DEFAULT_TTL;
          debugDatabase('ReactiveQuery: Creating materialized view with TTL', { ttlValue });
          query = queryBuilder.materialize(ttlValue);
        } else {
          // Legacy pattern - queryBuilder is already a Zero query
          const ttlValue = this.options.ttl || DEFAULT_TTL;
          debugDatabase('ReactiveQuery: Creating materialized view (legacy) with TTL', { ttlValue });
          query = queryBuilder.materialize(ttlValue);
        }
        
        this.view = query;
        
        // Set up Zero's native listener for real-time updates
        this.removeListener = this.view.addListener((newData: T[]) => {
          if (this.isDestroyed) return;
          
          debugDatabase('ZERO DATA CHANGED! New count', { count: newData?.length || 0 });
          this.updateState({
            data: newData || [],
            isLoading: false,
            error: null,
            isInitialized: true,
            lastUpdated: Date.now()
          });
          this.retryCount = 0; // Reset retry count on successful update
        });
        
        // Get initial data synchronously
        const initialData = this.view.data;
        if (initialData !== undefined && initialData !== null) {
          this.updateState({
            data: initialData || [],
            isLoading: false,
            error: null,
            isInitialized: true,
            lastUpdated: Date.now()
          });
        } else {
          this.updateState({
            data: [],
            isLoading: false,
            error: null,
            isInitialized: true,
            lastUpdated: Date.now()
          });
        }
        
        debugDatabase('ReactiveQuery: Setup complete with initial data', { length: initialData?.length || 'empty' });
        
      } catch (err) {
        if (this.isDestroyed) return;
        
        debugError('ReactiveQuery: Error during setup', { error: err });
        const error = err instanceof Error ? err : new Error('Unknown error');
        
        // Retry logic
        const { retryAttempts = 3, retryDelay = 1000 } = this.options;
        if (this.retryCount < retryAttempts) {
          this.retryCount++;
          debugDatabase('ReactiveQuery: Retrying', { retryCount: this.retryCount, retryAttempts, retryDelay });
          this.retryTimeoutId = setTimeout(tryInitialize, retryDelay * this.retryCount) as any;
          return;
        }
        
        // Max retries exceeded
        this.updateState({
          data: [],
          isLoading: false,
          error,
          isInitialized: true,
          lastUpdated: Date.now()
        });
      }
    };
    
    // Start initialization
    tryInitialize();
  }
  
  private updateState(newState: QueryState<T[]>): void {
    // Update state object - will be reactive in Svelte components
    this._state.data = newState.data;
    this._state.isLoading = newState.isLoading;
    this._state.error = newState.error;
    this._state.isInitialized = newState.isInitialized;
    this._state.lastUpdated = newState.lastUpdated;
    
    // Notify subscribers for vanilla JS usage
    this.subscribers.forEach(callback => {
      try {
        callback(newState);
      } catch (err) {
        debugError('ReactiveQuery subscriber error', { error: err });
      }
    });
  }
  
  private cleanup(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
    
    if (this.removeListener) {
      debugDatabase('ReactiveQuery: Removing listener');
      this.removeListener();
      this.removeListener = null;
    }
    
    if (this.view) {
      debugDatabase('ReactiveQuery: Destroying view');
      this.view.destroy();
      this.view = null;
    }
  }
}

/**
 * Enhanced reactive query wrapper for single Zero.js records
 * Provides Rails-style ActiveRecord API for individual record queries
 */
export class ReactiveQueryOne<T> {
  // Reactive state object - will be made reactive in Svelte components
  private _state: QueryState<T | null> = {
    data: null,
    isLoading: true,
    error: null,
    isInitialized: false,
    lastUpdated: null
  };
  
  private view: any = null;
  private removeListener: (() => void) | null = null;
  private retryTimeoutId: number | null = null;
  private subscribers: Array<SubscriptionCallback<T | null>> = [];
  private isDestroyed = false;
  private retryCount = 0;
  
  constructor(
    private getQueryBuilder: () => ZeroQueryBuilder<T> | any | null,
    private options: QueryOptions = {}
  ) {
    const { enabled = true } = this.options;
    
    // Initialize state
    this._state.data = null;
    this._state.isLoading = enabled;
    this._state.error = null;
    this._state.isInitialized = false;
    this._state.lastUpdated = null;
    
    // Development warning for missing TTL
    if (this.options.ttl === undefined) {
      debugDatabase('ReactiveQueryOne created without TTL - using default', {
        defaultTTL: DEFAULT_TTL,
        queryBuilder: this.getQueryBuilder.toString(),
        message: 'Consider adding explicit TTL like "5m" or "2h" for background persistence.'
      });
    }
    
    // Start query if enabled
    if (enabled) {
      this.initializeQuery();
    }
  }
  
  // Reactive getters for Svelte components
  get data(): T | null { return this._state.data; }
  get isLoading(): boolean { return this._state.isLoading; }
  get error(): Error | null { return this._state.error; }
  get isInitialized(): boolean { return this._state.isInitialized; }
  get lastUpdated(): number | null { return this._state.lastUpdated; }
  
  // Imperative access for vanilla JavaScript
  get current(): T | null { return this._state.data; }
  get loading(): boolean { return this._state.isLoading; }
  get state(): QueryState<T | null> { 
    return {
      data: this._state.data,
      isLoading: this._state.isLoading,
      error: this._state.error,
      isInitialized: this._state.isInitialized,
      lastUpdated: this._state.lastUpdated
    };
  }
  
  /**
   * Subscribe to data changes (for vanilla JS usage)
   */
  subscribe(callback: SubscriptionCallback<T | null>): () => void {
    this.subscribers.push(callback);
    
    // Immediately call with current state
    callback(this.state);
    
    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }
  
  /**
   * Refresh the query manually
   */
  refresh(): void {
    if (!this.isDestroyed) {
      this.retryCount = 0;
      this.cleanup();
      this.initializeQuery();
    }
  }
  
  /**
   * Enable the query (starts listening if disabled)
   */
  enable(): void {
    if (!this.isDestroyed && !this.view) {
      this.initializeQuery();
    }
  }
  
  /**
   * Disable the query (stops listening but keeps data)
   */
  disable(): void {
    this.cleanup();
    this.updateState({
      data: this._state.data,
      isLoading: false,
      error: null,
      isInitialized: this._state.isInitialized,
      lastUpdated: this._state.lastUpdated
    });
  }
  
  /**
   * Clean up resources and stop listening
   */
  destroy(): void {
    this.isDestroyed = true;
    this.cleanup();
    this.subscribers = [];
  }
  
  /**
   * Check if query is currently active (has listeners)
   */
  isActive(): boolean {
    return this.view !== null && this.removeListener !== null;
  }
  
  private initializeQuery(): void {
    const tryInitialize = () => {
      if (this.isDestroyed) return;
      
      try {
        // Get queryBuilder from function
        const queryBuilder = this.getQueryBuilder();
        
        // Check if queryBuilder is available
        if (!queryBuilder) {
          debugDatabase('ReactiveQueryOne: Query builder not ready, retrying in 100ms');
          const { retryDelay = 100 } = this.options;
          this.retryTimeoutId = setTimeout(tryInitialize, retryDelay) as any;
          return;
        }
        
        // Handle both new query builder and legacy patterns
        let query: any;
        if (queryBuilder instanceof ZeroQueryBuilder) {
          // New query builder - get one() query and materialize
          const ttlValue = this.options.ttl || DEFAULT_TTL;
          debugDatabase('ReactiveQueryOne: Creating materialized view with TTL', { ttlValue });
          const oneQuery = queryBuilder.clone().limit(1).materialize(ttlValue);
          query = oneQuery;
        } else {
          // Legacy pattern - queryBuilder is already a Zero query
          const ttlValue = this.options.ttl || DEFAULT_TTL;
          debugDatabase('ReactiveQueryOne: Creating materialized view (legacy) with TTL', { ttlValue });
          query = queryBuilder.materialize(ttlValue);
        }
        
        this.view = query;
        
        // Set up Zero's native listener for real-time updates
        this.removeListener = this.view.addListener((newData: T | T[] | null) => {
          if (this.isDestroyed) return;
          
          // Handle both single record and array responses
          let data: T | null = null;
          if (Array.isArray(newData)) {
            data = newData.length > 0 ? newData[0] : null;
          } else {
            data = newData || null;
          }
          
          debugReactive('ZERO DATA CHANGED! New data', { data: data ? 'present' : 'null' });
          this.updateState({
            data,
            isLoading: false,
            error: null,
            isInitialized: true,
            lastUpdated: Date.now()
          });
          this.retryCount = 0; // Reset retry count on successful update
        });
        
        // Get initial data synchronously
        const initialData = this.view.data;
        let data: T | null = null;
        if (Array.isArray(initialData)) {
          data = initialData.length > 0 ? initialData[0] : null;
        } else {
          data = initialData || null;
        }
        
        this.updateState({
          data,
          isLoading: false,
          error: null,
          isInitialized: true,
          lastUpdated: Date.now()
        });
        
        debugDatabase('ReactiveQueryOne: Setup complete with initial data', { data: data ? 'present' : 'null' });
        
      } catch (err) {
        if (this.isDestroyed) return;
        
        debugError('ReactiveQueryOne: Error during setup', { error: err });
        const error = err instanceof Error ? err : new Error('Unknown error');
        
        // Retry logic
        const { retryAttempts = 3, retryDelay = 1000 } = this.options;
        if (this.retryCount < retryAttempts) {
          this.retryCount++;
          debugDatabase('ReactiveQueryOne: Retrying', { retryCount: this.retryCount, retryAttempts, retryDelay });
          this.retryTimeoutId = setTimeout(tryInitialize, retryDelay * this.retryCount) as any;
          return;
        }
        
        // Max retries exceeded
        this.updateState({
          data: null,
          isLoading: false,
          error,
          isInitialized: true,
          lastUpdated: Date.now()
        });
      }
    };
    
    // Start initialization
    tryInitialize();
  }
  
  private updateState(newState: QueryState<T | null>): void {
    // Update state object - will be reactive in Svelte components
    this._state.data = newState.data;
    this._state.isLoading = newState.isLoading;
    this._state.error = newState.error;
    this._state.isInitialized = newState.isInitialized;
    this._state.lastUpdated = newState.lastUpdated;
    
    // Notify subscribers for vanilla JS usage
    this.subscribers.forEach(callback => {
      try {
        callback(newState);
      } catch (err) {
        debugError('ReactiveQueryOne subscriber error', { error: err });
      }
    });
  }
  
  private cleanup(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
    
    if (this.removeListener) {
      debugReactive('ReactiveQueryOne: Removing listener');
      this.removeListener();
      this.removeListener = null;
    }
    
    if (this.view) {
      debugReactive('ReactiveQueryOne: Destroying view');
      this.view.destroy();
      this.view = null;
    }
  }
}

/**
 * Factory functions for creating reactive queries
 */

/**
 * Create a reactive query for collections
 */
export function createReactiveQuery<T>(
  getQueryBuilder: () => ZeroQueryBuilder<T> | any | null,
  options?: QueryOptions
): ReactiveQuery<T> {
  return new ReactiveQuery(getQueryBuilder, options);
}

/**
 * Create a reactive query for single records
 */
export function createReactiveQueryOne<T>(
  getQueryBuilder: () => ZeroQueryBuilder<T> | any | null,
  options?: QueryOptions
): ReactiveQueryOne<T> {
  return new ReactiveQueryOne(getQueryBuilder, options);
}

/**
 * Create a reactive query using a simple query function
 */
export function useQuery<T>(
  queryFn: () => Promise<T[]> | T[],
  options: QueryOptions & { key: string } = { key: 'default' }
): ReactiveQuery<T> {
  return new ReactiveQuery(() => {
    // Convert query function to Zero query builder pattern
    // This is a simplified adapter for custom queries
    const client = zeroClient.getClient();
    if (!client) return null;
    
    return {
      materialize: (ttl?: string) => {
        return {
          addListener: (callback: (data: T[]) => void) => {
            // Execute query and call callback
            Promise.resolve(queryFn()).then(callback).catch(err => debugError('useQuery callback error', { error: err }));
            // Return cleanup function
            return () => {};
          },
          get data() {
            return [];
          },
          destroy: () => {}
        };
      }
    };
  }, options);
}

/**
 * Create a reactive query for a single record using a simple query function
 */
export function useQueryOne<T>(
  queryFn: () => Promise<T | null> | T | null,
  options: QueryOptions & { key: string } = { key: 'default' }
): ReactiveQueryOne<T> {
  return new ReactiveQueryOne(() => {
    // Convert query function to Zero query builder pattern
    const client = zeroClient.getClient();
    if (!client) return null;
    
    return {
      materialize: (ttl?: string) => {
        return {
          addListener: (callback: (data: T | null) => void) => {
            // Execute query and call callback
            Promise.resolve(queryFn()).then(callback).catch(err => debugError('useQueryOne callback error', { error: err }));
            // Return cleanup function
            return () => {};
          },
          get data() {
            return null;
          },
          destroy: () => {}
        };
      }
    };
  }, options);
}