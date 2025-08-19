// Zero Native Reactivity Runes for Svelte 5
// Implements Zero's native addListener for true real-time updates

import { getZero } from './zero-client';
import { debugDatabase, debugReactive, debugError } from '$lib/utils/debug';

/**
 * Custom Svelte 5 rune for Zero reactive queries
 * Uses Zero's native addListener API instead of polling
 * 
 * @param getQueryBuilder - Function that returns Zero query builder (e.g., () => Job.queryBuilder())
 * @param defaultValue - Default value to return while loading
 * @returns Reactive state with data, isLoading, and error
 * 
 * @example
 * ```typescript
 * import { fZero } from '$lib/zero/runes';
 * import { Job } from '$lib/zero/models/job.generated';
 * 
 * const jobsQuery = fZero(() => Job.queryBuilder(), []);
 * 
 * // Access reactive state
 * jobsQuery.data      // Current data
 * jobsQuery.isLoading // Loading state
 * jobsQuery.error     // Error state
 * ```
 */
export function fZero<T>(getQueryBuilder: () => any, defaultValue: T[] = [] as T[]) {
  let data = $state(defaultValue);
  let isLoading = $state(true);
  let error = $state<Error | null>(null);
  
  // ✨ USE $effect FOR EXTERNAL SUBSCRIPTIONS (NOT onMount)
  $effect(() => {
    let view: any = null;
    let removeListener: (() => void) | null = null;
    let retryTimeoutId: number | null = null;
    
    const tryInitialize = () => {
      try {
        // Get queryBuilder from function
        const queryBuilder = getQueryBuilder();
        
        // Check if queryBuilder is available
        if (!queryBuilder) {
          debugDatabase('fZero: Query builder not ready, retrying in 100ms');
          isLoading = true;
          error = null;
          // Retry after a short delay
          retryTimeoutId = setTimeout(tryInitialize, 100) as any;
          return;
        }
        
        debugDatabase('fZero: Creating materialized view');
        view = queryBuilder.materialize();
        
        // Set up Zero's native listener for real-time updates
        removeListener = view.addListener((newData: T[]) => {
          debugReactive('ZERO DATA CHANGED! New count', { count: newData?.length || 0 });
          data = newData || defaultValue;
          isLoading = false;
          error = null;
        });
        
        // Get initial data synchronously
        const initialData = view.data;
        if (initialData !== undefined && initialData !== null) {
          data = initialData;
          isLoading = false;
          error = null;
        }
        
        debugDatabase('fZero: Setup complete with initial data', { length: initialData?.length || 'null' });
        
      } catch (err) {
        debugError('fZero: Error during setup', { error: err });
        error = err instanceof Error ? err : new Error('Unknown error');
        isLoading = false;
      }
    };
    
    // Start initialization
    tryInitialize();
    
    // ✨ CLEANUP RETURNED FROM $effect - SVELTE 5 IDIOMATIC
    return () => {
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
      if (removeListener) {
        debugReactive('fZero: Removing listener');
        removeListener();
      }
      if (view) {
        debugReactive('fZero: Destroying view');
        view.destroy();
      }
    };
  });
  
  return {
    get data() { return data; },
    get isLoading() { return isLoading; },
    get error() { return error; }
  };
}

/**
 * Custom Svelte 5 rune for single Zero record queries
 * Uses Zero's native addListener API for real-time updates
 * 
 * @param getQueryBuilder - Function that returns Zero query builder (e.g., () => Job.find(id))
 * @param defaultValue - Default value to return while loading
 * @returns Reactive state with data, isLoading, and error
 * 
 * @example
 * ```typescript
 * import { fZeroOne } from '$lib/zero/runes';
 * import { Job } from '$lib/zero/models/job.generated';
 * 
 * const jobQuery = fZeroOne(() => Job.find('job-id'), null);
 * 
 * // Access reactive state
 * jobQuery.data      // Current data (single record or null)
 * jobQuery.isLoading // Loading state
 * jobQuery.error     // Error state
 * ```
 */
export function fZeroOne<T>(getQueryBuilder: () => any, defaultValue: T | null = null) {
  let data = $state(defaultValue);
  let isLoading = $state(true);
  let error = $state<Error | null>(null);
  
  // ✨ USE $effect FOR EXTERNAL SUBSCRIPTIONS (NOT onMount)
  $effect(() => {
    let view: any = null;
    let removeListener: (() => void) | null = null;
    let retryTimeoutId: number | null = null;
    
    const tryInitialize = () => {
      try {
        // Get queryBuilder from function
        const queryBuilder = getQueryBuilder();
        
        // Check if queryBuilder is available
        if (!queryBuilder) {
          debugDatabase('fZeroOne: Query builder not ready, retrying in 100ms');
          isLoading = true;
          error = null;
          // Retry after a short delay
          retryTimeoutId = setTimeout(tryInitialize, 100) as any;
          return;
        }
        
        debugDatabase('fZeroOne: Creating materialized view');
        view = queryBuilder.materialize();
        
        // Set up Zero's native listener for real-time updates
        removeListener = view.addListener((newData: T | null) => {
          debugReactive('ZERO DATA CHANGED! New data', { data: newData ? 'present' : 'null' });
          data = newData || defaultValue;
          isLoading = false;
          error = null;
        });
        
        // Get initial data synchronously
        const initialData = view.data;
        if (initialData !== undefined) {
          data = initialData;
          isLoading = false;
          error = null;
        }
        
        debugDatabase('fZeroOne: Setup complete with initial data', { data: initialData ? 'present' : 'null' });
        
      } catch (err) {
        debugError('fZeroOne: Error during setup', { error: err });
        error = err instanceof Error ? err : new Error('Unknown error');
        isLoading = false;
      }
    };
    
    // Start initialization
    tryInitialize();
    
    // ✨ CLEANUP RETURNED FROM $effect - SVELTE 5 IDIOMATIC
    return () => {
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
      if (removeListener) {
        debugReactive('fZeroOne: Removing listener');
        removeListener();
      }
      if (view) {
        debugReactive('fZeroOne: Destroying view');
        view.destroy();
      }
    };
  });
  
  return {
    get data() { return data; },
    get isLoading() { return isLoading; },
    get error() { return error; }
  };
}