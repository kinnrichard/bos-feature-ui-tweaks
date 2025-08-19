/**
 * ReactiveCoordinator - Core state lifecycle management for ReactiveRecord v2
 *
 * Implements the 5-state lifecycle management system:
 * - initializing: Query setup phase
 * - loading: Initial data fetch in progress
 * - hydrating: Refreshing existing data
 * - ready: Data is current and display-ready
 * - error: Unrecoverable error state
 *
 * Prevents UI flash by maintaining stale data during transitions
 * and provides minimum timing thresholds for state changes.
 */

// Note: Debug imports will be resolved at runtime
// import { debugReactive, debugError } from '$lib/utils/debug';
// import type { ReactiveQuery } from '$lib/zero/reactive-query.svelte';

// Temporary debug functions for compilation
const debugReactive = (...args: any[]) => console.log('[ReactiveRecord v2]', ...args);
const debugError = (...args: any[]) => console.error('[ReactiveRecord v2]', ...args);

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
  subscribe(
    callback: (data: T, meta: { isLoading: boolean; error: Error | null }) => void
  ): () => void;
}

/**
 * Core lifecycle states for data coordination
 */
export type CoordinatorState =
  | 'initializing' // Query setup phase
  | 'loading' // Initial data fetch in progress
  | 'hydrating' // Refreshing existing data
  | 'ready' // Data is current and display-ready
  | 'error'; // Unrecoverable error state

/**
 * Visual display context for flash prevention
 */
export interface VisualState<T> {
  /** Current data to display (may be stale during transitions) */
  displayData: T | null;

  /** Whether loading indicators should be shown */
  shouldShowLoading: boolean;

  /** Whether empty state should be shown */
  shouldShowEmpty: boolean;

  /** Whether error state should be shown */
  shouldShowError: boolean;

  /** Current lifecycle state */
  state: CoordinatorState;

  /** Error details if in error state */
  error: Error | null;

  /** Whether data is considered fresh */
  isFresh: boolean;

  /** Whether this is the first load */
  isInitialLoad: boolean;
}

/**
 * Configuration for coordinator behavior
 */
export interface CoordinatorConfig {
  /** Minimum time to show loading state (prevents flash) */
  minimumLoadingTime?: number;

  /** Timeout for considering initial load failed */
  initialLoadTimeout?: number;

  /** Whether to preserve stale data during refresh */
  preserveStaleData?: boolean;

  /** Debug mode for verbose logging */
  debug?: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<CoordinatorConfig> = {
  minimumLoadingTime: 300, // 300ms minimum loading time
  initialLoadTimeout: 10000, // 10s timeout for initial load
  preserveStaleData: true, // Keep stale data during refresh
  debug: false,
};

/**
 * ReactiveCoordinator manages the complete lifecycle of reactive queries
 * with flash prevention and intelligent state transitions
 */
export class ReactiveCoordinator<T> {
  private config: Required<CoordinatorConfig>;
  private subscribers: Array<(state: VisualState<T>) => void> = [];

  // Internal state tracking
  private currentState: CoordinatorState = 'initializing';
  private lastData: T | null = null;
  private currentError: Error | null = null;
  private loadStartTime: number | null = null;
  private initialLoadComplete = false;
  private isDestroyed = false;

  // Timers for flash prevention
  private minimumLoadingTimer: number | null = null;
  private initialLoadTimer: number | null = null;

  constructor(
    private query: ReactiveQuery<T | T[]>,
    config: CoordinatorConfig = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupQuerySubscription();

    if (this.config.debug) {
      debugReactive('ReactiveCoordinator initialized', {
        config: this.config,
        queryType: this.query.isCollection ? 'collection' : 'single',
      });
    }
  }

  /**
   * Get current visual state for UI consumption
   */
  get visualState(): VisualState<T> {
    const displayData = this.getDisplayData();

    return {
      displayData,
      shouldShowLoading: this.shouldShowLoading(),
      shouldShowEmpty: this.shouldShowEmpty(displayData),
      shouldShowError: this.shouldShowError(),
      state: this.currentState,
      error: this.currentError,
      isFresh: this.isDataFresh(),
      isInitialLoad: !this.initialLoadComplete,
    };
  }

  /**
   * Subscribe to visual state changes
   */
  subscribe(callback: (state: VisualState<T>) => void): () => void {
    this.subscribers.push(callback);

    // Immediately notify with current state
    callback(this.visualState);

    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Manually refresh the query data
   */
  async refresh(): Promise<void> {
    if (this.isDestroyed) return;

    // Only transition to hydrating if we have existing data
    if (this.lastData !== null && this.currentState === 'ready') {
      this.transitionToState('hydrating');
    } else {
      this.transitionToState('loading');
    }

    await this.query.refresh();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.isDestroyed = true;
    this.clearTimers();
    this.subscribers = [];
    this.query.destroy();

    if (this.config.debug) {
      debugReactive('ReactiveCoordinator destroyed');
    }
  }

  /**
   * Set up subscription to underlying query
   */
  private setupQuerySubscription(): void {
    this.query.subscribe((data, meta) => {
      if (this.isDestroyed) return;

      if (this.config.debug) {
        debugReactive('Query data changed', {
          hasData: data !== null,
          isLoading: meta.isLoading,
          hasError: meta.error !== null,
          currentState: this.currentState,
        });
      }

      this.handleQueryUpdate(data as T, meta);
    });
  }

  /**
   * Handle updates from the underlying query
   */
  private handleQueryUpdate(data: T, meta: { isLoading: boolean; error: Error | null }): void {
    // Update error state
    this.currentError = meta.error;

    // Handle error state
    if (meta.error) {
      this.transitionToState('error');
      return;
    }

    // Check if query has actually completed (not just isLoading=false)
    const queryCompleted = this.query.resultType === 'complete';

    if (this.config.debug) {
      debugReactive('handleQueryUpdate', {
        hasData: data !== null && data !== undefined,
        isLoading: meta.isLoading,
        resultType: this.query.resultType,
        queryCompleted,
        initialLoadComplete: this.initialLoadComplete,
        currentState: this.currentState,
        dataType: Array.isArray(data) ? `Array(${data.length})` : typeof data,
      });
    }

    // Only process as "completed load" if the query has actually finished
    if (queryCompleted) {
      // Handle successful data updates
      if (data !== null && data !== undefined) {
        this.lastData = data;

        if (!this.initialLoadComplete) {
          this.initialLoadComplete = true;
          this.clearTimer('initialLoadTimer');
        }

        // Only transition to ready after minimum loading time
        if (this.currentState === 'loading' || this.currentState === 'hydrating') {
          this.scheduleReadyTransition();
        } else {
          this.transitionToState('ready');
        }
      } else {
        // Query completed but returned no data (null/undefined)
        if (!this.initialLoadComplete) {
          this.initialLoadComplete = true;
          this.clearTimer('initialLoadTimer');
        }

        this.transitionToState('ready');
      }
    }
    // If query hasn't completed yet (resultType !== 'complete'), stay in current loading state
  }

  /**
   * Transition to a new state with proper notifications
   */
  private transitionToState(newState: CoordinatorState): void {
    if (this.currentState === newState) return;

    const oldState = this.currentState;
    this.currentState = newState;

    if (this.config.debug) {
      debugReactive('State transition', { from: oldState, to: newState });
    }

    // Handle state-specific setup
    this.handleStateTransition(newState);

    // Notify subscribers
    this.notifySubscribers();
  }

  /**
   * Handle setup for specific state transitions
   */
  private handleStateTransition(state: CoordinatorState): void {
    switch (state) {
      case 'loading':
      case 'hydrating':
        this.loadStartTime = Date.now();
        this.setupMinimumLoadingTimer();
        break;

      case 'initializing':
        this.setupInitialLoadTimeout();
        break;

      case 'ready':
      case 'error':
        this.clearTimers();
        break;
    }
  }

  /**
   * Schedule transition to ready state after minimum loading time
   */
  private scheduleReadyTransition(): void {
    if (!this.loadStartTime) {
      this.transitionToState('ready');
      return;
    }

    const elapsed = Date.now() - this.loadStartTime;
    const remaining = Math.max(0, this.config.minimumLoadingTime - elapsed);

    if (remaining === 0) {
      this.transitionToState('ready');
    } else {
      this.minimumLoadingTimer = setTimeout(() => {
        this.transitionToState('ready');
      }, remaining) as any;
    }
  }

  /**
   * Set up minimum loading timer to prevent flash
   */
  private setupMinimumLoadingTimer(): void {
    this.clearTimer('minimumLoadingTimer');
    // Timer is set up in scheduleReadyTransition when data arrives
  }

  /**
   * Set up timeout for initial load
   */
  private setupInitialLoadTimeout(): void {
    this.clearTimer('initialLoadTimer');

    this.initialLoadTimer = setTimeout(() => {
      if (!this.initialLoadComplete && !this.isDestroyed) {
        debugError('Initial load timeout exceeded', {
          timeout: this.config.initialLoadTimeout,
        });
        this.currentError = new Error('Initial load timeout');
        this.transitionToState('error');
      }
    }, this.config.initialLoadTimeout) as any;
  }

  /**
   * Clear specific timer
   */
  private clearTimer(timerName: 'minimumLoadingTimer' | 'initialLoadTimer'): void {
    const timer = this[timerName];
    if (timer) {
      clearTimeout(timer);
      this[timerName] = null;
    }
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    this.clearTimer('minimumLoadingTimer');
    this.clearTimer('initialLoadTimer');
  }

  /**
   * Get data to display (may be stale during transitions)
   */
  private getDisplayData(): T | null {
    if (this.currentState === 'error') {
      return this.config.preserveStaleData ? this.lastData : null;
    }

    return this.lastData;
  }

  /**
   * Determine if loading indicators should be shown
   */
  private shouldShowLoading(): boolean {
    switch (this.currentState) {
      case 'initializing':
      case 'loading':
        return true;
      case 'hydrating':
        return this.lastData === null; // Only show loading if no stale data
      default:
        return false;
    }
  }

  /**
   * Determine if empty state should be shown
   */
  private shouldShowEmpty(displayData: T | null): boolean {
    if (this.currentState !== 'ready') return false;
    if (displayData === null) return true;

    // Handle collection empty state
    if (this.query.isCollection && Array.isArray(displayData)) {
      return displayData.length === 0;
    }

    return false;
  }

  /**
   * Determine if error state should be shown
   */
  private shouldShowError(): boolean {
    return this.currentState === 'error' && !this.config.preserveStaleData;
  }

  /**
   * Check if current data is considered fresh
   */
  private isDataFresh(): boolean {
    return this.currentState === 'ready' && this.lastData !== null;
  }

  /**
   * Notify all subscribers of state changes
   */
  private notifySubscribers(): void {
    const state = this.visualState;
    this.subscribers.forEach((callback) => {
      try {
        callback(state);
      } catch (error) {
        debugError('Subscriber callback error', { error });
      }
    });
  }
}

/**
 * Factory function to create ReactiveCoordinator instances
 */
export function createReactiveCoordinator<T>(
  query: ReactiveQuery<T | T[]>,
  config?: CoordinatorConfig
): ReactiveCoordinator<T> {
  return new ReactiveCoordinator<T>(query, config);
}
