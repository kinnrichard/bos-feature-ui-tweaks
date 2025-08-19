<!--
  ReactiveView - Declarative component for handling reactive data with flash prevention
  
  Provides a clean API for components to consume reactive data without handling
  loading states, empty states, or flash prevention logic themselves.
  
  Integrates with ReactiveCoordinator for advanced state management and
  supports multiple loading strategies.
-->

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount, onDestroy } from 'svelte';
  import {
    createReactiveCoordinator,
    type VisualState,
    type CoordinatorConfig,
  } from './coordinator';
  import type { ReactiveQuery } from '$lib/models/base/types';
  import { debugReactive } from '$lib/utils/debug';

  interface Props<T> {
    /** The reactive query to manage */
    query: ReactiveQuery<T | T[]>;

    /** Display-level filters (separate from query filters) */
    displayFilters?: Record<string, any>;

    /** Loading strategy - progressive shows stale data during refresh */
    strategy?: 'progressive' | 'blocking';

    /** Configuration for coordinator behavior */
    coordinatorConfig?: CoordinatorConfig;

    /** Whether to show debug information */
    debug?: boolean;

    /** Snippet for loading state */
    loading?: Snippet<[any]>;

    /** Snippet for error state */
    error?: Snippet<[any]>;

    /** Snippet for empty state */
    empty?: Snippet<[any]>;

    /** Snippet for content state */
    content?: Snippet<[any]>;

    /** Snippet for loading overlay */
    loadingOverlay?: Snippet<[any]>;
  }

  type T = any; // Will be inferred from usage

  let {
    query,
    displayFilters = {},
    strategy = 'progressive',
    coordinatorConfig = {},
    debug = false,
    loading,
    error,
    empty,
    content,
    loadingOverlay,
  }: Props<T> = $props();

  // State management
  let coordinator = $state<ReturnType<typeof createReactiveCoordinator<T>> | null>(null);
  let visualState = $state<VisualState<T> | null>(null);
  let filteredData = $state<T | null>(null);
  let unsubscribe: (() => void) | null = null;

  // Initialize coordinator on mount
  onMount(() => {
    coordinator = createReactiveCoordinator(query, {
      ...coordinatorConfig,
      preserveStaleData: strategy === 'progressive',
      debug,
    });

    unsubscribe = coordinator.subscribe((state) => {
      visualState = state;
      updateFilteredData(state.displayData);
    });

    if (debug) {
      debugReactive('ReactiveView mounted', { strategy });
    }
  });

  // Clean up on destroy
  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    if (coordinator) {
      coordinator.destroy();
      coordinator = null;
    }

    if (debug) {
      debugReactive('ReactiveView destroyed');
    }
  });

  /**
   * Apply display-level filters to the data
   */
  function updateFilteredData(data: T | null): void {
    if (!data) {
      filteredData = null;
      return;
    }

    // If no filters, use data as-is
    if (Object.keys(displayFilters).length === 0) {
      filteredData = data;
      return;
    }

    // Apply filters to collection data
    if (Array.isArray(data)) {
      filteredData = applyFiltersToCollection(data, displayFilters) as T;
    } else {
      // For single records, check if they match filters
      filteredData = matchesFilters(data, displayFilters) ? data : null;
    }
  }

  /**
   * Apply filters to a collection
   */
  function applyFiltersToCollection<Item>(items: Item[], filters: Record<string, any>): Item[] {
    return items.filter((item) => matchesFilters(item, filters));
  }

  /**
   * Check if an item matches the display filters
   */
  function matchesFilters<Item>(item: Item, filters: Record<string, any>): boolean {
    return Object.entries(filters).every(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        return true; // Empty filter matches everything
      }

      const itemValue = (item as any)[key];

      // String contains matching (case-insensitive)
      if (typeof value === 'string' && typeof itemValue === 'string') {
        return itemValue.toLowerCase().includes(value.toLowerCase());
      }

      // Exact matching for other types
      return itemValue === value;
    });
  }

  /**
   * Refresh the query data
   */
  async function refresh(): Promise<void> {
    if (coordinator) {
      await coordinator.refresh();
    }
  }

  // Watch display filters and update filtered data
  $effect(() => {
    if (visualState) {
      updateFilteredData(visualState.displayData);
    }
  });

  // Computed properties for template using runes
  const hasData = $derived(
    filteredData !== null && (!Array.isArray(filteredData) || filteredData.length > 0)
  );

  const isEmpty = $derived(visualState?.shouldShowEmpty && !hasData);

  const showLoading = $derived(visualState?.shouldShowLoading ?? false);

  const showError = $derived(visualState?.shouldShowError ?? false);

  // During initial load, prefer loading over empty state
  const shouldShowLoadingInsteadOfEmpty = $derived(
    visualState?.isInitialLoad && visualState?.state === 'initializing'
  );

  const contextData = $derived({
    data: filteredData,
    state: visualState?.state ?? 'initializing',
    isLoading: showLoading,
    isEmpty,
    hasError: showError,
    error: visualState?.error ?? null,
    isFresh: visualState?.isFresh ?? false,
    isInitialLoad: visualState?.isInitialLoad ?? true,
    refresh,
  });

  // Debug effect to track state changes
  $effect(() => {
    if (debug) {
      console.log('🔍 ReactiveView State Debug:', {
        hasData,
        isEmpty,
        showLoading,
        showError,
        shouldShowLoadingInsteadOfEmpty,
        visualState: visualState
          ? {
              state: visualState.state,
              shouldShowLoading: visualState.shouldShowLoading,
              shouldShowEmpty: visualState.shouldShowEmpty,
              shouldShowError: visualState.shouldShowError,
              isInitialLoad: visualState.isInitialLoad,
              isFresh: visualState.isFresh,
              displayDataLength: Array.isArray(visualState.displayData)
                ? visualState.displayData.length
                : visualState.displayData
                  ? 'object'
                  : 'null',
            }
          : 'null',
        filteredDataLength: Array.isArray(filteredData)
          ? filteredData.length
          : filteredData
            ? 'object'
            : 'null',
      });
    }
  });
</script>

{#if debug}
  <!-- Debug panel -->
  <div
    class="reactive-view-debug"
    style="background: #000; color: #00ff00; padding: 8px; margin-bottom: 16px; font-family: monospace; font-size: 11px; border: 1px solid #333;"
  >
    <strong>🔍 ReactiveView Debug Panel</strong><br />
    hasData: {hasData} | isEmpty: {isEmpty} | showLoading: {showLoading} | showError: {showError}<br
    />
    shouldShowLoadingInsteadOfEmpty: {shouldShowLoadingInsteadOfEmpty}<br />
    {#if visualState}
      VS.state: {visualState.state} | VS.shouldShowLoading: {visualState.shouldShowLoading} | VS.shouldShowEmpty:
      {visualState.shouldShowEmpty}<br />
      VS.isInitialLoad: {visualState.isInitialLoad} | VS.isFresh: {visualState.isFresh}<br />
      VS.displayData: {Array.isArray(visualState.displayData)
        ? `Array(${visualState.displayData.length})`
        : visualState.displayData
          ? 'Object'
          : 'null'}<br />
    {:else}
      visualState: null<br />
    {/if}
    filteredData: {Array.isArray(filteredData)
      ? `Array(${filteredData.length})`
      : filteredData
        ? 'Object'
        : 'null'}<br />
  </div>
{/if}

<!-- Main content rendering -->
{#if showError}
  <div class="reactive-view__error">
    {#if error}
      {@render error(contextData)}
    {:else}
      <div class="error-message">
        <p>Error loading data: {visualState?.error?.message ?? 'Unknown error'}</p>
        <button onclick={() => refresh()}>Retry</button>
      </div>
    {/if}
  </div>
{:else if showLoading && !hasData}
  <div class="reactive-view__loading">
    {#if loading}
      {@render loading(contextData)}
    {:else}
      <div class="loading-skeleton">Loading...</div>
    {/if}
  </div>
{:else if shouldShowLoadingInsteadOfEmpty}
  <div class="reactive-view__loading">
    {#if loading}
      {@render loading(contextData)}
    {:else}
      <div class="loading-skeleton">Loading...</div>
    {/if}
  </div>
{:else if isEmpty}
  <div class="reactive-view__empty">
    {#if empty}
      {@render empty(contextData)}
    {:else}
      <div class="empty-message">No data available</div>
    {/if}
  </div>
{:else if hasData}
  <div class="reactive-view__content">
    {#if debug}
      <!-- Debug: Check snippet structure -->
      <div
        class="snippet-debug"
        style="background: #ff0000; color: white; padding: 4px; font-size: 10px;"
      >
        Has loading: {!!loading}
        <br />Has error: {!!error}
        <br />Has empty: {!!empty}
        <br />Has content: {!!content}
        <br />Has loadingOverlay: {!!loadingOverlay}
      </div>
    {/if}

    {#if content}
      {@render content(contextData)}
    {:else}
      <div class="default-content">Data loaded successfully</div>
    {/if}
  </div>
{/if}

<!-- Optional loading overlay for progressive strategy -->
{#if strategy === 'progressive' && showLoading && hasData}
  <div class="reactive-view__loading-overlay">
    {#if loadingOverlay}
      {@render loadingOverlay(contextData)}
    {:else}
      <div class="loading-indicator">Refreshing...</div>
    {/if}
  </div>
{/if}

<style>
  .reactive-view__error {
    padding: 1rem;
    border: 1px solid #ef4444;
    border-radius: 0.5rem;
    background-color: #fef2f2;
    color: #dc2626;
  }

  .reactive-view__loading {
    padding: 1rem;
  }

  .reactive-view__empty {
    padding: 2rem;
    text-align: center;
    color: #6b7280;
  }

  .reactive-view__content {
    position: relative;
  }

  .reactive-view__loading-overlay {
    position: absolute;
    top: 0;
    right: 0;
    padding: 0.5rem;
    background-color: rgba(255, 255, 255, 0.9);
    border-radius: 0.25rem;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .error-message {
    text-align: center;
  }

  .error-message button {
    margin-top: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: #dc2626;
    color: white;
    border: none;
    border-radius: 0.25rem;
    cursor: default;
  }

  .error-message button:hover {
    background-color: #b91c1c;
  }

  .loading-skeleton {
    padding: 2rem;
    text-align: center;
    color: #6b7280;
  }

  .loading-indicator {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .default-content {
    padding: 1rem;
  }

  .empty-message {
    font-style: italic;
  }
</style>
