// Enhanced ActiveRecord-Style Reactive API for Zero.js
// Combines Zero's native addListener with clean ActiveRecord syntax
// Works seamlessly in both Svelte components and vanilla JavaScript

// import { getZero } from './zero-client';
import { debugDatabase, debugReactive, debugError } from '$lib/utils/debug';

// Default TTL for queries when none specified
const DEFAULT_TTL = '1h';

/**
 * Reactive query wrapper for Zero.js that provides ActiveRecord-style API
 * Uses Zero's native addListener for real-time updates without polling
 *
 * @example
 * ```typescript
 * // In Svelte component - reactive array
 * const activeJobs = Job.where({ status: 'active' });
 * // activeJobs.data automatically updates in template
 *
 * // In vanilla JS - imperative access
 * const activeJobs = Job.where({ status: 'active' });
 * const currentData = activeJobs.current;
 * activeJobs.subscribe((newData) => debugDatabase('Updated:', newData));
 * ```
 */
export class ReactiveQuery<T> {
  // Use Svelte 5's $state rune for proper reactivity tracking
  // eslint-disable-next-line no-undef
  private _state = $state({
    data: [] as T[],
    isLoading: true,
    error: null as Error | null,
    hasReceivedData: false,
    resultType: 'loading' as 'loading' | 'complete' | 'error',
  });

  private view: any = null;
  private removeListener: (() => void) | null = null;
  private retryTimeoutId: number | null = null;
  private subscribers: Array<
    (data: T[], meta: { isLoading: boolean; error: Error | null }) => void
  > = [];
  private isDestroyed = false;

  constructor(
    private getQueryBuilder: () => any | null,
    private defaultValue: T[] = [],
    private ttl: string | undefined = undefined
  ) {
    // Initialize with Svelte 5 $state rune for proper reactivity
    this._state.data = defaultValue;
    this._state.isLoading = true;
    this._state.error = null;
    this._state.hasReceivedData = false;
    this._state.resultType = 'loading';

    // Development warning for missing TTL (now properly handled)
    if (this.ttl === undefined) {
      debugDatabase('ReactiveQuery created without TTL - using default', {
        defaultTTL: DEFAULT_TTL,
        queryBuilder: this.getQueryBuilder.toString(),
        defaultValue: this.defaultValue,
        message: 'Consider adding explicit TTL like "5m" or "2h" for background persistence.',
      });
    }

    // Set up Zero listener
    this.initializeQuery();
  }

  // Reactive getters for Svelte components - now properly tracked by Svelte
  get data(): T[] {
    return this._state.data;
  }
  get isLoading(): boolean {
    return !this._state.hasReceivedData;
  }
  get error(): Error | null {
    return this._state.error;
  }
  get resultType(): 'loading' | 'complete' | 'error' {
    return this._state.resultType;
  }

  // Imperative access for vanilla JavaScript
  get current(): T[] {
    return this._state.data;
  }
  get loading(): boolean {
    return !this._state.hasReceivedData;
  }

  /**
   * Subscribe to data changes (for vanilla JS usage)
   * @param callback Function called when data changes
   * @returns Unsubscribe function
   */
  subscribe(
    callback: (data: T[], meta: { isLoading: boolean; error: Error | null }) => void
  ): () => void {
    this.subscribers.push(callback);

    // Immediately call with current state
    callback(this._state.data, {
      isLoading: !this._state.hasReceivedData,
      error: this._state.error,
    });

    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Refresh the query manually (usually not needed with Zero's reactivity)
   */
  refresh(): void {
    if (!this.isDestroyed) {
      this.cleanup();
      this.initializeQuery();
    }
  }

  /**
   * Clean up resources and stop listening
   */
  destroy(): void {
    this.isDestroyed = true;
    this.cleanup();
    this.subscribers = [];
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
          this.updateState(this.defaultValue, false, null, 'loading');
          this.retryTimeoutId = setTimeout(tryInitialize, 100) as any;
          return;
        }

        debugDatabase('ReactiveQuery: Creating materialized view with TTL', {
          ttl: this.ttl,
          ttlType: typeof this.ttl,
        });

        // Proper TTL handling per Zero.js documentation
        const ttlValue = this.ttl || DEFAULT_TTL; // Use provided TTL or safe default
        debugDatabase('ReactiveQuery: Using TTL', { ttlValue });

        // Validate TTL before passing to Zero
        if (typeof ttlValue !== 'string' && typeof ttlValue !== 'number') {
          throw new Error(`Invalid TTL: ${ttlValue}. Use string like '5m' or number in ms`);
        }

        this.view = queryBuilder.materialize(ttlValue);

        // Check if materialize() returned a valid view
        if (!this.view) {
          debugDatabase(
            'ReactiveQuery: materialize() returned null, Zero client not ready. Retrying'
          );
          this.updateState(this.defaultValue, false, null, 'loading');
          this.retryTimeoutId = setTimeout(tryInitialize, 200) as any;
          return;
        }

        // Set up Zero's native listener for real-time updates
        this.removeListener = this.view.addListener((newData: T[], result?: any) => {
          if (this.isDestroyed) return;

          debugReactive('ZERO DATA CHANGED! New count', { count: newData?.length || 0, result });

          // Determine result type based on Zero's completion state
          // Default to 'loading' and only set 'complete' when Zero explicitly confirms
          let resultType: 'loading' | 'complete' | 'error' = 'loading';
          if (result === 'complete' || result?.type === 'complete') {
            resultType = 'complete';
          } else if (result === 'error' || result?.type === 'error') {
            resultType = 'error';
          }
          // Treat 'unknown' or any other state as still loading

          // CONSERVATIVE: First listener callback means data is ready
          this.updateState(newData || this.defaultValue, true, null, resultType);
        });

        // CONSERVATIVE APPROACH: Don't mark as complete until listener fires
        // This prevents flash of "no data" while Zero is actually loading
        debugReactive('ReactiveQuery: Waiting for first listener callback');

        // Check if we already have synchronous data (rare case)
        const initialData = this.view.data;
        if (initialData !== undefined && initialData !== null && initialData.length > 0) {
          // Only if we have actual data (not empty array), mark as received
          debugDatabase('ReactiveQuery: Found immediate data', { length: initialData.length });
          this.updateState(initialData, true, null, 'complete');
        }

        debugDatabase('ReactiveQuery: Setup complete with initial data', {
          length: initialData?.length || 'null',
        });
      } catch (err) {
        if (this.isDestroyed) return;

        debugError('ReactiveQuery: Error during setup', { error: err });
        const error = err instanceof Error ? err : new Error('Unknown error');
        this.updateState(this.defaultValue, true, error, 'error');
      }
    };

    // Start initialization
    tryInitialize();
  }

  private updateState(
    data: T[],
    hasReceivedData: boolean,
    error: Error | null,
    resultType: 'loading' | 'complete' | 'error' = 'loading'
  ): void {
    // Update Svelte 5 $state - this will automatically trigger reactivity
    this._state.data = data;
    this._state.hasReceivedData = hasReceivedData;
    this._state.error = error;
    this._state.resultType = resultType;

    // Notify subscribers for vanilla JS usage
    const isLoading = !hasReceivedData;
    this.subscribers.forEach((callback) => {
      try {
        callback(data, { isLoading, error });
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
      debugReactive('ReactiveQuery: Removing listener');
      this.removeListener();
      this.removeListener = null;
    }

    if (this.view) {
      debugReactive('ReactiveQuery: Destroying view');
      this.view.destroy();
      this.view = null;
    }
  }
}

/**
 * Reactive query wrapper for single Zero.js records
 * Provides ActiveRecord-style API for individual record queries
 *
 * @example
 * ```typescript
 * // In Svelte component
 * const job = Job.find('job-id');
 * // job.data automatically updates
 *
 * // In vanilla JS
 * const job = Job.find('job-id');
 * const current = job.current;
 * job.subscribe((data) => debugDatabase('Job updated:', data));
 * ```
 */
export class ReactiveQueryOne<T> {
  // Use Svelte 5's $state rune for proper reactivity tracking
  // eslint-disable-next-line no-undef
  private _state = $state({
    data: null as T | null,
    isLoading: true,
    error: null as Error | null,
    hasReceivedData: false,
    resultType: 'loading' as 'loading' | 'complete' | 'error',
  });

  private view: any = null;
  private removeListener: (() => void) | null = null;
  private retryTimeoutId: number | null = null;
  private subscribers: Array<
    (data: T | null, meta: { isLoading: boolean; error: Error | null }) => void
  > = [];
  private isDestroyed = false;

  constructor(
    private getQueryBuilder: () => any | null,
    private defaultValue: T | null = null,
    private ttl: string | undefined = undefined
  ) {
    // Initialize with Svelte 5 $state rune for proper reactivity
    this._state.data = defaultValue;
    this._state.isLoading = true;
    this._state.error = null;
    this._state.hasReceivedData = false;
    this._state.resultType = 'loading';

    // Development warning for missing TTL (now properly handled)
    if (this.ttl === undefined) {
      debugDatabase('ReactiveQueryOne created without TTL - using default', {
        defaultTTL: DEFAULT_TTL,
        queryBuilder: this.getQueryBuilder.toString(),
        defaultValue: this.defaultValue,
        message: 'Consider adding explicit TTL like "5m" or "2h" for background persistence.',
      });
    }

    // Set up Zero listener
    this.initializeQuery();
  }

  // Reactive getters for Svelte components - now properly tracked by Svelte
  get data(): T | null {
    return this._state.data;
  }
  get isLoading(): boolean {
    return !this._state.hasReceivedData;
  }
  get error(): Error | null {
    return this._state.error;
  }
  get resultType(): 'loading' | 'complete' | 'error' {
    return this._state.resultType;
  }

  // Imperative access for vanilla JavaScript
  get current(): T | null {
    return this._state.data;
  }
  get loading(): boolean {
    return !this._state.hasReceivedData;
  }

  /**
   * Subscribe to data changes (for vanilla JS usage)
   * @param callback Function called when data changes
   * @returns Unsubscribe function
   */
  subscribe(
    callback: (data: T | null, meta: { isLoading: boolean; error: Error | null }) => void
  ): () => void {
    this.subscribers.push(callback);

    // Immediately call with current state
    callback(this._state.data, {
      isLoading: !this._state.hasReceivedData,
      error: this._state.error,
    });

    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Refresh the query manually (usually not needed with Zero's reactivity)
   */
  refresh(): void {
    if (!this.isDestroyed) {
      this.cleanup();
      this.initializeQuery();
    }
  }

  /**
   * Clean up resources and stop listening
   */
  destroy(): void {
    this.isDestroyed = true;
    this.cleanup();
    this.subscribers = [];
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
          this.updateState(this.defaultValue, false, null, 'loading');
          this.retryTimeoutId = setTimeout(tryInitialize, 100) as any;
          return;
        }

        debugDatabase('ReactiveQueryOne: Creating materialized view with TTL', {
          ttl: this.ttl,
          ttlType: typeof this.ttl,
        });

        // Proper TTL handling per Zero.js documentation
        const ttlValue = this.ttl || DEFAULT_TTL; // Use provided TTL or safe default
        debugDatabase('ReactiveQueryOne: Using TTL', { ttlValue });

        // Validate TTL before passing to Zero
        if (typeof ttlValue !== 'string' && typeof ttlValue !== 'number') {
          throw new Error(`Invalid TTL: ${ttlValue}. Use string like '5m' or number in ms`);
        }

        this.view = queryBuilder.materialize(ttlValue);

        // Check if materialize() returned a valid view
        if (!this.view) {
          debugDatabase(
            'ReactiveQueryOne: materialize() returned null, Zero client not ready. Retrying'
          );
          this.updateState(this.defaultValue, false, null, 'loading');
          this.retryTimeoutId = setTimeout(tryInitialize, 200) as any;
          return;
        }

        // Set up Zero's native listener for real-time updates
        this.removeListener = this.view.addListener((newData: T | null, result?: any) => {
          if (this.isDestroyed) return;

          debugReactive('ZERO DATA CHANGED! New data', {
            data: newData ? 'present' : 'null',
            result,
          });

          // Determine result type based on Zero's completion state
          // Default to 'loading' and only set 'complete' when Zero explicitly confirms
          let resultType: 'loading' | 'complete' | 'error' = 'loading';
          if (result === 'complete' || result?.type === 'complete') {
            resultType = 'complete';
          } else if (result === 'error' || result?.type === 'error') {
            resultType = 'error';
          }
          // Treat 'unknown' or any other state as still loading

          // CONSERVATIVE: First listener callback means data is ready
          this.updateState(
            newData !== undefined ? newData : this.defaultValue,
            true,
            null,
            resultType
          );
        });

        // CONSERVATIVE APPROACH: Don't mark as complete until listener fires
        // This prevents flash of "no data" while Zero is actually loading
        debugReactive('ReactiveQueryOne: Waiting for first listener callback');

        // Check if we already have synchronous data (rare case)
        const initialData = this.view.data;
        if (initialData !== undefined && initialData !== null) {
          // Only if we have actual data (not null), mark as received
          debugDatabase('ReactiveQueryOne: Found immediate data', {
            data: initialData ? 'present' : 'null',
          });
          this.updateState(initialData, true, null, 'complete');
        }

        debugDatabase('ReactiveQueryOne: Setup complete with initial data', {
          data: initialData ? 'present' : 'null',
        });
      } catch (err) {
        if (this.isDestroyed) return;

        debugError('ReactiveQueryOne: Error during setup', { error: err });
        const error = err instanceof Error ? err : new Error('Unknown error');
        this.updateState(this.defaultValue, true, error, 'error');
      }
    };

    // Start initialization
    tryInitialize();
  }

  private updateState(
    data: T | null,
    hasReceivedData: boolean,
    error: Error | null,
    resultType: 'loading' | 'complete' | 'error' = 'loading'
  ): void {
    // Update Svelte 5 $state - this will automatically trigger reactivity
    this._state.data = data;
    this._state.hasReceivedData = hasReceivedData;
    this._state.error = error;
    this._state.resultType = resultType;

    // Notify subscribers for vanilla JS usage
    const isLoading = !hasReceivedData;
    this.subscribers.forEach((callback) => {
      try {
        callback(data, { isLoading, error });
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
