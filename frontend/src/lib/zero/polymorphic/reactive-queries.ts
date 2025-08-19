/**
 * Reactive Polymorphic Queries - Svelte 5 reactive query support
 * 
 * Provides reactive polymorphic queries that automatically update when
 * underlying data changes, integrated with Svelte 5 runes system.
 * 
 * Key Features:
 * - Svelte 5 runes integration ($state, $derived, $effect)
 * - Auto-updating polymorphic relationships
 * - Reactive query invalidation on data changes
 * - Integration with ReactiveRecord pattern
 * - Real-time query result updates
 * - Optimistic updates and rollback
 * - Smart re-query optimization
 * 
 * Generated: 2025-08-06 Epic-008 Reactive Polymorphic Queries
 */

import { ChainableQuery, createPolymorphicQuery } from './query-system';
import { polymorphicQueryCache, executeCachedQuery } from './query-cache';
import type { BaseModelConfig } from '../../models/base/types';
import type { 
  PolymorphicType, 
  PolymorphicConditions 
} from './types';
import { debugDatabase } from '../../utils/debug';

/**
 * Reactive query state
 */
export interface ReactiveQueryState<T> {
  /** Current query results */
  data: T[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Whether data has been loaded at least once */
  loaded: boolean;
  /** Last refresh timestamp */
  lastRefresh: number;
  /** Query execution count */
  executionCount: number;
}

/**
 * Reactive query options
 */
export interface ReactiveQueryOptions {
  /** Auto-refresh interval in milliseconds */
  refreshInterval?: number;
  /** Enable automatic refresh on window focus */
  refreshOnFocus?: boolean;
  /** Enable automatic refresh on reconnect */
  refreshOnReconnect?: boolean;
  /** Stale time - how long data is considered fresh */
  staleTime?: number;
  /** Enable optimistic updates */
  enableOptimistic?: boolean;
  /** Custom invalidation triggers */
  invalidateOn?: Array<{
    table: string;
    operation: 'insert' | 'update' | 'delete';
  }>;
  /** Debounce query execution (ms) */
  debounceMs?: number;
}

/**
 * Reactive polymorphic query subscription
 */
export interface ReactiveQuerySubscription {
  /** Unsubscribe from updates */
  unsubscribe: () => void;
  /** Force refresh the query */
  refresh: () => Promise<void>;
  /** Get current query state */
  getState: () => ReactiveQueryState<any>;
  /** Update query conditions */
  updateConditions: (conditions: PolymorphicConditions) => void;
}

/**
 * Svelte 5 reactive polymorphic query class
 */
export class ReactivePolymorphicQuery<T extends Record<string, any>> {
  private query: ChainableQuery<T>;
  private options: ReactiveQueryOptions;
  private subscriptions = new Set<(state: ReactiveQueryState<T>) => void>();
  private refreshTimer?: number;
  private debounceTimer?: number;
  private isDestroyed = false;

  // Svelte 5 reactive state
  private _state = $state<ReactiveQueryState<T>>({
    data: [],
    loading: false,
    error: null,
    loaded: false,
    lastRefresh: 0,
    executionCount: 0
  });

  // Derived reactive values
  public readonly isEmpty = $derived(() => !this._state.loading && this._state.data.length === 0);
  public readonly hasError = $derived(() => this._state.error !== null);
  public readonly isStale = $derived(() => {
    if (!this.options.staleTime) return false;
    return Date.now() - this._state.lastRefresh > this.options.staleTime;
  });
  public readonly shouldRefresh = $derived(() => this.isStale && !this._state.loading);

  constructor(
    query: ChainableQuery<T>,
    options: ReactiveQueryOptions = {}
  ) {
    this.query = query;
    this.options = {
      refreshInterval: 5 * 60 * 1000, // 5 minutes default
      refreshOnFocus: true,
      refreshOnReconnect: true,
      staleTime: 2 * 60 * 1000, // 2 minutes default
      enableOptimistic: true,
      debounceMs: 100,
      ...options
    };

    this.setupReactivity();
    this.setupEventListeners();
    this.initialLoad();
  }

  /**
   * Get current reactive state
   */
  get state(): ReactiveQueryState<T> {
    return this._state;
  }

  /**
   * Get current data
   */
  get data(): T[] {
    return this._state.data;
  }

  /**
   * Check if query is loading
   */
  get loading(): boolean {
    return this._state.loading;
  }

  /**
   * Get current error
   */
  get error(): Error | null {
    return this._state.error;
  }

  /**
   * Execute the query and update state
   */
  async execute(force = false): Promise<T[]> {
    if (this.isDestroyed) {
      return [];
    }

    // Skip if already loading and not forced
    if (this._state.loading && !force) {
      return this._state.data;
    }

    this._state.loading = true;
    this._state.error = null;

    try {
      debugDatabase.debug('Executing reactive polymorphic query', {
        force,
        executionCount: this._state.executionCount
      });

      const results = await executeCachedQuery(this.query);
      
      this._state.data = results;
      this._state.loaded = true;
      this._state.lastRefresh = Date.now();
      this._state.executionCount++;
      
      this.notifySubscribers();

      return results;
    } catch (error) {
      this._state.error = error as Error;
      this.notifySubscribers();
      
      debugDatabase.error('Reactive polymorphic query failed', {
        error,
        executionCount: this._state.executionCount
      });
      
      throw error;
    } finally {
      this._state.loading = false;
    }
  }

  /**
   * Refresh query data
   */
  async refresh(): Promise<T[]> {
    return await this.execute(true);
  }

  /**
   * Update query conditions and re-execute
   */
  updateConditions(conditions: PolymorphicConditions): void {
    // Create new query with updated conditions
    const newQuery = this.query.clone() as ChainableQuery<T>;
    
    // Apply new conditions
    if (conditions.polymorphicType) {
      (newQuery as any).forPolymorphicType(conditions.polymorphicType);
    }
    if (conditions.targetType) {
      (newQuery as any).forTargetType(conditions.targetType);
    }
    if (conditions.targetId) {
      (newQuery as any).forTargetId(conditions.targetId);
    }

    this.query = newQuery;
    
    // Debounce re-execution
    this.debouncedExecute();
  }

  /**
   * Add optimistic update
   */
  addOptimistic(item: T): void {
    if (!this.options.enableOptimistic) {
      return;
    }

    this._state.data = [...this._state.data, item];
    this.notifySubscribers();
  }

  /**
   * Remove optimistic update
   */
  removeOptimistic(predicate: (item: T) => boolean): void {
    if (!this.options.enableOptimistic) {
      return;
    }

    this._state.data = this._state.data.filter(item => !predicate(item));
    this.notifySubscribers();
  }

  /**
   * Update optimistic item
   */
  updateOptimistic(predicate: (item: T) => boolean, updates: Partial<T>): void {
    if (!this.options.enableOptimistic) {
      return;
    }

    this._state.data = this._state.data.map(item =>
      predicate(item) ? { ...item, ...updates } : item
    );
    this.notifySubscribers();
  }

  /**
   * Subscribe to query state changes
   */
  subscribe(callback: (state: ReactiveQueryState<T>) => void): ReactiveQuerySubscription {
    this.subscriptions.add(callback);

    // Call immediately with current state
    callback(this._state);

    return {
      unsubscribe: () => {
        this.subscriptions.delete(callback);
      },
      refresh: () => this.refresh(),
      getState: () => this._state,
      updateConditions: (conditions) => this.updateConditions(conditions)
    };
  }

  /**
   * Destroy the reactive query and clean up resources
   */
  destroy(): void {
    this.isDestroyed = true;
    
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.subscriptions.clear();
    this.cleanupEventListeners();

    debugDatabase.debug('Reactive polymorphic query destroyed');
  }

  /**
   * Setup Svelte 5 reactivity effects
   */
  private setupReactivity(): void {
    // Auto-refresh effect when data becomes stale
    $effect(() => {
      if (this.shouldRefresh) {
        this.debouncedExecute();
      }
    });

    // Log state changes in development
    $effect(() => {
      debugDatabase.debug('Reactive query state changed', {
        dataCount: this._state.data.length,
        loading: this._state.loading,
        error: this._state.error?.message,
        lastRefresh: this._state.lastRefresh
      });
    });
  }

  /**
   * Setup event listeners for automatic refresh triggers
   */
  private setupEventListeners(): void {
    if (this.options.refreshOnFocus) {
      window.addEventListener('focus', this.handleWindowFocus);
    }

    if (this.options.refreshOnReconnect) {
      window.addEventListener('online', this.handleReconnect);
    }

    // Listen for cache invalidation events
    polymorphicQueryCache.onInvalidation(this.handleCacheInvalidation);

    // Setup refresh interval
    if (this.options.refreshInterval && this.options.refreshInterval > 0) {
      this.refreshTimer = window.setInterval(() => {
        if (!this.isStale) {
          this.refresh();
        }
      }, this.options.refreshInterval);
    }
  }

  /**
   * Clean up event listeners
   */
  private cleanupEventListeners(): void {
    window.removeEventListener('focus', this.handleWindowFocus);
    window.removeEventListener('online', this.handleReconnect);
    // Note: Would need to remove cache invalidation listener if supported
  }

  /**
   * Handle window focus event
   */
  private handleWindowFocus = (): void => {
    if (this.isStale) {
      this.refresh();
    }
  };

  /**
   * Handle reconnect event
   */
  private handleReconnect = (): void => {
    this.refresh();
  };

  /**
   * Handle cache invalidation events
   */
  private handleCacheInvalidation = (event: any): void => {
    // Check if this query should be invalidated
    const queryMetadata = (this.query as any).getPolymorphicMetadata?.() || {};
    
    // Check if any of the invalidated tables/types affect this query
    const shouldInvalidate = 
      event.tables.includes(queryMetadata.tableName) ||
      (queryMetadata.type && event.polymorphicTypes.includes(queryMetadata.type));

    if (shouldInvalidate) {
      this.refresh();
    }
  };

  /**
   * Initial data load
   */
  private async initialLoad(): Promise<void> {
    try {
      await this.execute();
    } catch (error) {
      debugDatabase.warn('Initial reactive query load failed', { error });
    }
  }

  /**
   * Debounced query execution
   */
  private debouncedExecute(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.execute();
    }, this.options.debounceMs);
  }

  /**
   * Notify all subscribers of state changes
   */
  private notifySubscribers(): void {
    for (const callback of this.subscriptions) {
      try {
        callback(this._state);
      } catch (error) {
        debugDatabase.warn('Reactive query subscriber error', { error });
      }
    }
  }
}

/**
 * Factory function to create reactive polymorphic queries
 * 
 * @example
 * ```typescript
 * const reactiveNotes = createReactivePolymorphicQuery(noteConfig, 'notable', {
 *   refreshInterval: 30000, // 30 seconds
 *   staleTime: 60000 // 1 minute
 * });
 * 
 * // Use in Svelte component
 * $: notes = reactiveNotes.data;
 * $: loading = reactiveNotes.loading;
 * ```
 */
export function createReactivePolymorphicQuery<T extends Record<string, any>>(
  config: BaseModelConfig,
  polymorphicType?: PolymorphicType,
  conditions?: PolymorphicConditions,
  options?: ReactiveQueryOptions
): ReactivePolymorphicQuery<T> {
  let query = createPolymorphicQuery<T>(config, polymorphicType);

  // Apply initial conditions
  if (conditions) {
    if (conditions.polymorphicType) {
      query = query.forPolymorphicType(conditions.polymorphicType);
    }
    if (conditions.targetType) {
      query = query.forTargetType(conditions.targetType);
    }
    if (conditions.targetId) {
      query = query.forTargetId(conditions.targetId);
    }
  }

  return new ReactivePolymorphicQuery(query, options);
}

/**
 * Factory function for reactive notable queries
 */
export function createReactiveNotableQuery<T extends Record<string, any>>(
  config: BaseModelConfig,
  conditions?: PolymorphicConditions,
  options?: ReactiveQueryOptions
): ReactivePolymorphicQuery<T> {
  return createReactivePolymorphicQuery<T>(config, 'notable', conditions, options);
}

/**
 * Factory function for reactive loggable queries
 */
export function createReactiveLoggableQuery<T extends Record<string, any>>(
  config: BaseModelConfig,
  conditions?: PolymorphicConditions,
  options?: ReactiveQueryOptions
): ReactivePolymorphicQuery<T> {
  return createReactivePolymorphicQuery<T>(config, 'loggable', conditions, options);
}

/**
 * Factory function for reactive schedulable queries
 */
export function createReactiveSchedulableQuery<T extends Record<string, any>>(
  config: BaseModelConfig,
  conditions?: PolymorphicConditions,
  options?: ReactiveQueryOptions
): ReactivePolymorphicQuery<T> {
  return createReactivePolymorphicQuery<T>(config, 'schedulable', conditions, options);
}

/**
 * Factory function for reactive target queries
 */
export function createReactiveTargetQuery<T extends Record<string, any>>(
  config: BaseModelConfig,
  conditions?: PolymorphicConditions,
  options?: ReactiveQueryOptions
): ReactivePolymorphicQuery<T> {
  return createReactivePolymorphicQuery<T>(config, 'target', conditions, options);
}

/**
 * Factory function for reactive parseable queries
 */
export function createReactiveParseableQuery<T extends Record<string, any>>(
  config: BaseModelConfig,
  conditions?: PolymorphicConditions,
  options?: ReactiveQueryOptions
): ReactivePolymorphicQuery<T> {
  return createReactivePolymorphicQuery<T>(config, 'parseable', conditions, options);
}

/**
 * Reactive query store for managing multiple queries
 */
export class ReactivePolymorphicQueryStore {
  private queries = new Map<string, ReactivePolymorphicQuery<any>>();

  /**
   * Get or create a reactive query
   */
  getQuery<T extends Record<string, any>>(
    key: string,
    config: BaseModelConfig,
    polymorphicType?: PolymorphicType,
    conditions?: PolymorphicConditions,
    options?: ReactiveQueryOptions
  ): ReactivePolymorphicQuery<T> {
    if (!this.queries.has(key)) {
      const query = createReactivePolymorphicQuery<T>(
        config,
        polymorphicType,
        conditions,
        options
      );
      this.queries.set(key, query);
    }

    return this.queries.get(key)!;
  }

  /**
   * Remove and destroy a query
   */
  removeQuery(key: string): void {
    const query = this.queries.get(key);
    if (query) {
      query.destroy();
      this.queries.delete(key);
    }
  }

  /**
   * Refresh all queries
   */
  async refreshAll(): Promise<void> {
    const promises = Array.from(this.queries.values()).map(q => q.refresh());
    await Promise.all(promises);
  }

  /**
   * Destroy all queries
   */
  destroyAll(): void {
    for (const query of this.queries.values()) {
      query.destroy();
    }
    this.queries.clear();
  }

  /**
   * Get query keys
   */
  getKeys(): string[] {
    return Array.from(this.queries.keys());
  }

  /**
   * Get query count
   */
  getCount(): number {
    return this.queries.size;
  }
}

/**
 * Global reactive query store instance
 */
export const reactivePolymorphicQueryStore = new ReactivePolymorphicQueryStore();

/**
 * Svelte 5 reactive query hook
 * 
 * @example
 * ```typescript
 * // In Svelte component
 * const { query, data, loading, error, refresh } = useReactivePolymorphicQuery(
 *   'job-notes',
 *   noteConfig,
 *   'notable',
 *   { targetType: 'Job', targetId: jobId }
 * );
 * 
 * // Access reactive values
 * $: notes = data;
 * $: isLoading = loading;
 * ```
 */
export function useReactivePolymorphicQuery<T extends Record<string, any>>(
  key: string,
  config: BaseModelConfig,
  polymorphicType?: PolymorphicType,
  conditions?: PolymorphicConditions,
  options?: ReactiveQueryOptions
) {
  const query = reactivePolymorphicQueryStore.getQuery<T>(
    key,
    config,
    polymorphicType,
    conditions,
    options
  );

  return {
    query,
    data: $derived(() => query.data),
    loading: $derived(() => query.loading),
    error: $derived(() => query.error),
    isEmpty: query.isEmpty,
    hasError: query.hasError,
    isStale: query.isStale,
    refresh: () => query.refresh(),
    updateConditions: (newConditions: PolymorphicConditions) => query.updateConditions(newConditions)
  };
}

/**
 * Cleanup function for reactive queries (for component unmount)
 */
export function cleanupReactiveQuery(key: string): void {
  reactivePolymorphicQueryStore.removeQuery(key);
}

export {
  type ReactiveQueryState,
  type ReactiveQueryOptions,
  type ReactiveQuerySubscription
};