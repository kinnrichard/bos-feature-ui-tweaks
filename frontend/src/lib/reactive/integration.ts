/**
 * Integration utilities for ReactiveRecord v2
 *
 * Provides utilities to integrate the new coordinator-based system
 * with existing ReactiveRecord implementations while maintaining
 * full backward compatibility.
 */

import { createReactiveCoordinator, type CoordinatorConfig, type VisualState } from './coordinator';

// Note: These imports will be resolved at runtime
// import type { ReactiveQuery } from '$lib/models/base/types';
// import { debugReactive } from '$lib/utils/debug';

// Temporary debug function for compilation
const debugReactive = (...args: any[]) => console.log('[ReactiveRecord v2]', ...args);

// Temporary ReactiveQuery interface for typing
interface ReactiveQuery<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
  resultType: 'loading' | 'complete' | 'error';
  isCollection: boolean;
  present: boolean;
  blank: boolean;
  refresh(): Promise<void>;
  destroy(): void;
  subscribe(callback: (data: T) => void): () => void;
}

/**
 * Enhanced reactive query that includes coordinator integration
 */
export interface EnhancedReactiveQuery<T> extends ReactiveQuery<T> {
  /** Access to the coordinator for advanced state management */
  coordinator?: ReturnType<typeof createReactiveCoordinator<T>>;

  /** Get visual state for flash prevention */
  getVisualState?(): VisualState<T>;

  /** Subscribe to visual state changes */
  subscribeToVisualState?(callback: (state: VisualState<T>) => void): () => void;
}

/**
 * Wraps an existing ReactiveQuery with coordinator functionality
 */
export function withCoordinator<T>(
  query: ReactiveQuery<T>,
  config?: CoordinatorConfig
): EnhancedReactiveQuery<T> {
  const coordinator = createReactiveCoordinator(query as any, config);

  // Create enhanced query object that preserves original API
  const enhancedQuery: EnhancedReactiveQuery<T> = {
    // Preserve original query interface
    get data() {
      return query.data;
    },
    get isLoading() {
      return query.isLoading;
    },
    get error() {
      return query.error;
    },
    get resultType() {
      return query.resultType;
    },
    get isCollection() {
      return query.isCollection;
    },
    get present() {
      return query.present;
    },
    get blank() {
      return query.blank;
    },

    async refresh() {
      await coordinator.refresh();
    },

    destroy() {
      coordinator.destroy();
      query.destroy();
    },

    subscribe(callback) {
      return query.subscribe(callback);
    },

    // Enhanced coordinator functionality
    coordinator,

    getVisualState() {
      return coordinator.visualState;
    },

    subscribeToVisualState(callback) {
      return coordinator.subscribe(callback);
    },
  };

  return enhancedQuery;
}

/**
 * Backward compatibility adapter for existing ReactiveRecord usage
 */
export class ReactiveQueryAdapter<T> implements ReactiveQuery<T> {
  private coordinator: ReturnType<typeof createReactiveCoordinator<T>>;

  constructor(
    private originalQuery: ReactiveQuery<T>,
    config?: CoordinatorConfig
  ) {
    this.coordinator = createReactiveCoordinator(originalQuery as any, config);
  }

  // Implement ReactiveQuery interface using coordinator
  get data(): T {
    const visualState = this.coordinator.visualState;
    return visualState.displayData as T;
  }

  get isLoading(): boolean {
    return this.coordinator.visualState.shouldShowLoading;
  }

  get error(): Error | null {
    return this.coordinator.visualState.error;
  }

  get resultType(): 'loading' | 'complete' | 'error' {
    const state = this.coordinator.visualState.state;
    switch (state) {
      case 'ready':
        return 'complete';
      case 'error':
        return 'error';
      default:
        return 'loading';
    }
  }

  get isCollection(): boolean {
    return this.originalQuery.isCollection;
  }

  get present(): boolean {
    const data = this.data;
    if (data === null || data === undefined) return false;
    if (Array.isArray(data)) return data.length > 0;
    return true;
  }

  get blank(): boolean {
    return !this.present;
  }

  async refresh(): Promise<void> {
    await this.coordinator.refresh();
  }

  destroy(): void {
    this.coordinator.destroy();
  }

  subscribe(callback: (data: T) => void): () => void {
    return this.coordinator.subscribe((visualState) => {
      callback(visualState.displayData as T);
    });
  }

  // Additional methods for enhanced functionality
  getVisualState(): VisualState<T> {
    return this.coordinator.visualState;
  }

  subscribeToVisualState(callback: (state: VisualState<T>) => void): () => void {
    return this.coordinator.subscribe(callback);
  }
}

/**
 * Factory functions for creating enhanced reactive queries
 */
export const ReactiveQueryFactory = {
  /**
   * Create an enhanced reactive query with coordinator
   */
  create<T>(query: ReactiveQuery<T>, config?: CoordinatorConfig): EnhancedReactiveQuery<T> {
    return withCoordinator(query, config);
  },

  /**
   * Create a backward-compatible adapter
   */
  createAdapter<T>(query: ReactiveQuery<T>, config?: CoordinatorConfig): ReactiveQueryAdapter<T> {
    return new ReactiveQueryAdapter(query, config);
  },

  /**
   * Create with flash prevention optimized for navigation
   */
  createForNavigation<T>(query: ReactiveQuery<T>): EnhancedReactiveQuery<T> {
    return withCoordinator(query, {
      minimumLoadingTime: 100, // Shorter for navigation
      preserveStaleData: true, // Always preserve during nav
      debug: false,
    });
  },

  /**
   * Create with optimized settings for initial page loads
   */
  createForInitialLoad<T>(query: ReactiveQuery<T>): EnhancedReactiveQuery<T> {
    return withCoordinator(query, {
      minimumLoadingTime: 500, // Longer for initial load
      initialLoadTimeout: 15000, // Extended timeout
      preserveStaleData: false, // No stale data on initial load
      debug: false,
    });
  },
};

/**
 * Migration utilities for upgrading existing code
 */
export const MigrationUtils = {
  /**
   * Wrap existing ReactiveRecord methods to use coordinator
   */
  upgradeReactiveRecord<T extends Record<string, any>>(
    recordClass: T,
    defaultConfig?: CoordinatorConfig
  ): T {
    const upgradedClass = { ...recordClass };

    // Wrap methods that return ReactiveQuery objects
    const methodsToWrap = ['find', 'findBy', 'all', 'where', 'kept', 'discarded', 'withDiscarded'];

    methodsToWrap.forEach((methodName) => {
      const originalMethod = upgradedClass[methodName];
      if (typeof originalMethod === 'function') {
        upgradedClass[methodName] = function (...args: any[]) {
          const result = originalMethod.apply(this, args);

          // If result is a ReactiveQuery, enhance it with coordinator
          if (result && typeof result === 'object' && 'data' in result) {
            return withCoordinator(result, defaultConfig);
          }

          return result;
        };
      }
    });

    return upgradedClass;
  },

  /**
   * Upgrade a specific query instance
   */
  upgradeQuery<T>(
    query: ReactiveQuery<T>,
    context?: 'navigation' | 'initial' | 'standard'
  ): EnhancedReactiveQuery<T> {
    switch (context) {
      case 'navigation':
        return ReactiveQueryFactory.createForNavigation(query);
      case 'initial':
        return ReactiveQueryFactory.createForInitialLoad(query);
      default:
        return ReactiveQueryFactory.create(query);
    }
  },
};

/**
 * Development utilities for debugging and monitoring
 */
export const DevUtils = {
  /**
   * Create a debug-enabled coordinator with verbose logging
   */
  createDebugCoordinator<T>(query: ReactiveQuery<T>, label?: string): EnhancedReactiveQuery<T> {
    return withCoordinator(query, {
      debug: true,
      minimumLoadingTime: 300,
      preserveStaleData: true,
    });
  },

  /**
   * Monitor state transitions for debugging
   */
  monitorStateTransitions<T>(enhancedQuery: EnhancedReactiveQuery<T>, label?: string): () => void {
    if (!enhancedQuery.subscribeToVisualState) {
      debugReactive('Cannot monitor query without coordinator', { label });
      return () => {};
    }

    let previousState: string | null = null;

    return enhancedQuery.subscribeToVisualState((visualState) => {
      if (previousState !== visualState.state) {
        debugReactive(`State transition${label ? ` [${label}]` : ''}`, {
          from: previousState,
          to: visualState.state,
          hasData: visualState.displayData !== null,
          isFresh: visualState.isFresh,
        });
        previousState = visualState.state;
      }
    });
  },
};

/**
 * Type guards for enhanced queries
 */
export const TypeGuards = {
  /**
   * Check if a query is enhanced with coordinator
   */
  isEnhancedQuery<T>(query: any): query is EnhancedReactiveQuery<T> {
    return query && typeof query === 'object' && 'coordinator' in query;
  },

  /**
   * Check if a query has visual state capabilities
   */
  hasVisualState<T>(query: any): query is EnhancedReactiveQuery<T> {
    return TypeGuards.isEnhancedQuery(query) && typeof query.getVisualState === 'function';
  },
};
