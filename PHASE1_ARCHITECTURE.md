# ReactiveRecord v2 Phase 1 Architecture

## Executive Summary

This document outlines the architectural design for ReactiveRecord v2 Phase 1, focusing on eliminating loading flash issues during navigation through the introduction of the ReactiveCoordinator pattern. The design leverages Zero.js's built-in query reuse and data sharing capabilities while maintaining full backward compatibility with the existing ReactiveRecord system.

## Current System Analysis

### Existing Architecture

The current ReactiveRecord system consists of:

1. **ReactiveRecord Base Class** (`/lib/models/base/reactive-record.ts`)
   - Rails-compatible model base class with reactive queries
   - Returns ReactiveQuery objects for Svelte component integration
   - Uses Zero.js materialize() with TTL for query optimization

2. **ReactiveQuery Implementation** (`/lib/zero/reactive-query.svelte.ts`)
   - Wraps Zero.js queries with Svelte 5 $state reactivity
   - Provides ActiveRecord-style API for components
   - Handles loading states, error states, and data updates

3. **Current /logs/ View** (`/routes/(authenticated)/logs/+page.svelte`)
   - Simple ReactiveActivityLog query instantiation
   - Direct data binding to ActivityLogList component
   - Basic loading/error state management

4. **ActivityLogList Component** (`/lib/components/logs/ActivityLogList.svelte`)
   - Complex loading state management with skeletons
   - Sophisticated grouping and filtering logic
   - Mobile-responsive design with animations

### Identified Flash Issues

1. **Navigation Flash**: When navigating to /logs/, there's a brief flash where:
   - Loading skeleton appears immediately
   - Zero.js may have cached data that could be shown immediately
   - Component waits for ReactiveQuery initialization cycle

2. **Data Transition Flash**: When switching between related views:
   - Previous query data isn't reused even when relevant
   - Each view creates new reactive queries from scratch
   - No coordination between related data views

## Phase 1 Solution: ReactiveCoordinator Pattern

### Core Concept

Introduce a ReactiveCoordinator that acts as a centralized state manager for related reactive queries, leveraging Zero.js's built-in query reuse to eliminate loading flashes during navigation.

### 5-State Lifecycle Management

The ReactiveCoordinator manages a sophisticated 5-state lifecycle:

1. **INITIALIZING**: Query is being set up, no data available yet
2. **LOADING**: Query is active, but no data received (show loading UI)
3. **HYDRATING**: Data is available but may be stale (show data + subtle loading indicator)
4. **READY**: Fresh data is available and current (normal display)
5. **ERROR**: Query failed (show error UI with retry options)

## Architectural Design

### ReactiveCoordinator Class

```typescript
// File: /lib/models/base/reactive-coordinator.ts

export interface VisualState {
  readonly current: 'initializing' | 'loading' | 'hydrating' | 'ready' | 'error';
  readonly shouldShowSkeleton: boolean;
  readonly shouldShowData: boolean;
  readonly shouldShowSubtleLoader: boolean;
  readonly shouldShowError: boolean;
  readonly canInteract: boolean;
}

export interface CoordinatorOptions {
  /** Minimum time to show hydrating state to prevent flash */
  minimumHydratingTime?: number;
  /** Maximum time to show stale data before forcing loading state */
  maxStaleTime?: number;
  /** Default TTL for materialized views */
  defaultTtl?: string;
  /** Enable debug logging */
  debug?: boolean;
}

export interface ReactiveCoordinatorState<T> {
  data: T | null;
  error: Error | null;
  lastUpdated: number;
  queryCount: number;
  visualState: VisualState;
}

export class ReactiveCoordinator<T> {
  private _state: ReactiveCoordinatorState<T> = $state({
    data: null,
    error: null,
    lastUpdated: 0,
    queryCount: 0,
    visualState: this.computeVisualState('initializing', false, null)
  });

  private reactiveQuery: ReactiveQuery<T> | null = null;
  private hydratingTimer: number | null = null;
  private staleTimer: number | null = null;
  private subscribers: Set<(state: ReactiveCoordinatorState<T>) => void> = new Set();

  constructor(
    private getQueryBuilder: () => any | null,
    private options: CoordinatorOptions = {}
  ) {
    this.initializeQuery();
  }

  // Public reactive getters
  get data(): T | null { return this._state.data; }
  get error(): Error | null { return this._state.error; }
  get visualState(): VisualState { return this._state.visualState; }
  get isReady(): boolean { return this._state.visualState.current === 'ready'; }

  // Flash prevention methods
  private computeVisualState(
    queryState: 'initializing' | 'loading' | 'ready' | 'error',
    hasStaleData: boolean,
    error: Error | null
  ): VisualState {
    const current = this.determineCurrentState(queryState, hasStaleData, error);
    
    return {
      current,
      shouldShowSkeleton: current === 'loading' && !hasStaleData,
      shouldShowData: hasStaleData || current === 'ready',
      shouldShowSubtleLoader: current === 'hydrating',
      shouldShowError: current === 'error',
      canInteract: current === 'ready' || current === 'hydrating'
    };
  }

  private determineCurrentState(
    queryState: 'initializing' | 'loading' | 'ready' | 'error',
    hasStaleData: boolean,
    error: Error | null
  ): VisualState['current'] {
    if (error) return 'error';
    if (queryState === 'initializing') return 'initializing';
    if (queryState === 'ready') return 'ready';
    
    // Key flash prevention logic: if we have stale data while loading, show hydrating
    if (queryState === 'loading' && hasStaleData) {
      return 'hydrating';
    }
    
    return 'loading';
  }

  private updateVisualState(
    queryState: 'initializing' | 'loading' | 'ready' | 'error',
    newData: T | null,
    error: Error | null
  ): void {
    const hasStaleData = this._state.data !== null && error === null;
    const newVisualState = this.computeVisualState(queryState, hasStaleData, error);
    
    // Flash prevention: minimum hydrating time
    if (newVisualState.current === 'hydrating' && this.hydratingTimer === null) {
      const minTime = this.options.minimumHydratingTime ?? 300;
      this.hydratingTimer = setTimeout(() => {
        this.hydratingTimer = null;
        // Re-evaluate state after minimum time
        this.updateState({ 
          ...this._state, 
          visualState: this.computeVisualState('ready', false, null) 
        });
      }, minTime) as any;
    }

    this.updateState({
      data: newData ?? this._state.data, // Keep stale data during hydrating
      error,
      lastUpdated: newData ? Date.now() : this._state.lastUpdated,
      queryCount: this._state.queryCount + 1,
      visualState: newVisualState
    });
  }

  // Integration with existing ReactiveQuery
  private initializeQuery(): void {
    this.reactiveQuery = new ReactiveQuery<T>(
      this.getQueryBuilder,
      [],
      this.options.defaultTtl
    );

    // Subscribe to ReactiveQuery changes
    this.reactiveQuery.subscribe((data, meta) => {
      if (meta.error) {
        this.updateVisualState('error', null, meta.error);
      } else if (meta.isLoading) {
        this.updateVisualState('loading', data, null);
      } else {
        this.updateVisualState('ready', data, null);
      }
    });
  }

  // Public API methods
  refresh(): void {
    this.reactiveQuery?.refresh();
  }

  destroy(): void {
    if (this.hydratingTimer) {
      clearTimeout(this.hydratingTimer);
    }
    if (this.staleTimer) {
      clearTimeout(this.staleTimer);
    }
    this.reactiveQuery?.destroy();
    this.subscribers.clear();
  }

  subscribe(callback: (state: ReactiveCoordinatorState<T>) => void): () => void {
    this.subscribers.add(callback);
    callback(this._state); // Immediate callback with current state
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private updateState(newState: ReactiveCoordinatorState<T>): void {
    this._state = newState;
    this.subscribers.forEach(callback => callback(this._state));
  }
}
```

### VisualState Interface

The VisualState interface provides clear guidance to components about what UI elements to show:

```typescript
export interface VisualState {
  // Current state in the 5-state lifecycle
  readonly current: 'initializing' | 'loading' | 'hydrating' | 'ready' | 'error';
  
  // UI visibility flags
  readonly shouldShowSkeleton: boolean;      // Show loading skeleton
  readonly shouldShowData: boolean;          // Show actual data
  readonly shouldShowSubtleLoader: boolean;  // Show subtle loading indicator
  readonly shouldShowError: boolean;         // Show error state
  readonly canInteract: boolean;             // Allow user interaction
}
```

### State Transition Mapping

```typescript
// State transitions for flash prevention
const STATE_TRANSITIONS = {
  // Initial page load
  'initializing' -> 'loading': 'No existing data, show skeleton',
  'initializing' -> 'ready': 'Immediate data available (cached)',
  
  // Data refresh scenarios
  'ready' -> 'hydrating': 'New query started, keep showing existing data',
  'hydrating' -> 'ready': 'Fresh data received, update display',
  'hydrating' -> 'error': 'Query failed, show error with data context',
  
  // Error recovery
  'error' -> 'loading': 'Retry initiated, no stale data to show',
  'error' -> 'hydrating': 'Retry with previous successful data available',
  
  // Loading states
  'loading' -> 'ready': 'Data received successfully',
  'loading' -> 'error': 'Query failed with no fallback data'
};
```

## ReactiveView Component Integration

### Enhanced Component Pattern

```typescript
// File: /lib/components/base/ReactiveView.svelte

<script lang="ts" generics="T">
  import type { ReactiveCoordinator } from '$lib/models/base/reactive-coordinator';
  import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
  import SubtleLoader from '$lib/components/ui/SubtleLoader.svelte';
  import ErrorDisplay from '$lib/components/ui/ErrorDisplay.svelte';

  interface Props {
    coordinator: ReactiveCoordinator<T>;
    skeletonType?: 'generic' | 'table' | 'cards';
    skeletonCount?: number;
  }

  let { 
    coordinator, 
    skeletonType = 'generic', 
    skeletonCount = 5 
  }: Props = $props();

  // Reactive state from coordinator
  $: ({ data, error, visualState } = coordinator);
  $: ({ 
    shouldShowSkeleton, 
    shouldShowData, 
    shouldShowSubtleLoader, 
    shouldShowError,
    canInteract 
  } = visualState);
</script>

<div class="reactive-view" class:interactive={canInteract}>
  {#if shouldShowError}
    <ErrorDisplay 
      {error} 
      onRetry={() => coordinator.refresh()}
      showWithData={shouldShowData}
    />
  {/if}

  {#if shouldShowSkeleton}
    <LoadingSkeleton type={skeletonType} count={skeletonCount} />
  {:else if shouldShowData}
    <div class="data-container" class:hydrating={shouldShowSubtleLoader}>
      {#if shouldShowSubtleLoader}
        <SubtleLoader />
      {/if}
      
      <!-- Content slot for actual data display -->
      <slot {data} {visualState} />
    </div>
  {/if}
</div>

<style>
  .reactive-view {
    position: relative;
    min-height: 200px;
  }

  .data-container.hydrating {
    opacity: 0.95;
    transition: opacity 0.2s ease;
  }

  .reactive-view:not(.interactive) {
    pointer-events: none;
  }
</style>
```

## Integration with Existing /logs/ View

### Updated Page Component

```typescript
// File: /routes/(authenticated)/logs/+page.svelte

<script lang="ts">
  import { ActivityLogList, LogsLayout } from '$lib/components/logs';
  import { ReactiveActivityLog } from '$lib/models/reactive-activity-log';
  import { ReactiveCoordinator } from '$lib/models/base/reactive-coordinator';
  import ReactiveView from '$lib/components/base/ReactiveView.svelte';
  import AppLayout from '$lib/components/layout/AppLayout.svelte';

  // Create coordinator for activity logs with flash prevention
  const logsCoordinator = new ReactiveCoordinator(
    () => ReactiveActivityLog.includes(['user', 'client', 'job'])
      .orderBy('created_at', 'asc')
      .limit(500)
      .buildZeroQuery(), // Need to expose this method
    {
      minimumHydratingTime: 200,
      maxStaleTime: 30000, // 30 seconds
      defaultTtl: '5m',
      debug: true
    }
  );
</script>

<AppLayout>
  <LogsLayout title="System Activity Logs">
    <ReactiveView 
      coordinator={logsCoordinator} 
      skeletonType="table" 
      skeletonCount={8}
      let:data
      let:visualState
    >
      <ActivityLogList
        logs={data || []}
        context="system"
        isLoading={visualState.current === 'loading'}
        error={logsCoordinator.error}
        isHydrating={visualState.current === 'hydrating'}
      />
    </ReactiveView>
  </LogsLayout>
</AppLayout>
```

### Enhanced ActivityLogList Integration

```typescript
// Additions to ActivityLogList.svelte props
interface Props {
  logs: ActivityLogData[];
  context?: 'system' | 'client';
  isLoading?: boolean;
  isHydrating?: boolean; // New prop for subtle loading state
  error?: Error | null;
}

// In the template, add hydrating state support:
{#if isHydrating}
  <div class="hydrating-indicator">
    <span class="pulse-dot"></span>
    Updating...
  </div>
{/if}
```

## Backward Compatibility Strategy

### API Compatibility Layer

```typescript
// File: /lib/models/base/reactive-record-v2.ts

// Maintain existing ReactiveRecord API while internally using coordinator
export class ReactiveRecordV2<T extends BaseRecord> extends ReactiveRecord<T> {
  private coordinators = new Map<string, ReactiveCoordinator<T>>();

  // Override methods to use coordinator when beneficial
  all(): ReactiveScopedQuery<T> {
    const baseQuery = super.all();
    
    // Enhance with coordinator for flash prevention
    return new CoordinatedScopedQuery(baseQuery, this.getCoordinator('all'));
  }

  find(id: string, options: QueryOptions = {}): IReactiveQuery<T | null> {
    const coordinatorKey = `find-${id}`;
    const coordinator = this.getCoordinator(coordinatorKey);
    
    // Return wrapper that maintains existing API
    return new CoordinatedQueryOne(coordinator);
  }

  private getCoordinator(key: string): ReactiveCoordinator<T> {
    if (!this.coordinators.has(key)) {
      this.coordinators.set(key, new ReactiveCoordinator(
        () => this.buildQueryForKey(key),
        { defaultTtl: this.config.defaultTtl }
      ));
    }
    return this.coordinators.get(key)!;
  }
}
```

### Migration Path

1. **Phase 1a**: Introduce ReactiveCoordinator alongside existing system
2. **Phase 1b**: Update critical views (/logs/) to use new pattern
3. **Phase 1c**: Provide opt-in enhancement for other views
4. **Phase 2**: Gradually migrate all views to coordinator pattern
5. **Phase 3**: Deprecate direct ReactiveQuery usage in favor of coordinator

## Test Validation Approach

### Flash Prevention Tests

```typescript
// File: /tests/reactive-coordinator.test.ts

describe('ReactiveCoordinator Flash Prevention', () => {
  test('should not show skeleton when stale data is available', async () => {
    const coordinator = new ReactiveCoordinator(mockQueryBuilder, {
      minimumHydratingTime: 100
    });

    // Simulate initial data load
    await coordinator.mockReceiveData(mockData);
    expect(coordinator.visualState.current).toBe('ready');

    // Simulate refresh with existing data
    coordinator.refresh();
    expect(coordinator.visualState.current).toBe('hydrating');
    expect(coordinator.visualState.shouldShowData).toBe(true);
    expect(coordinator.visualState.shouldShowSkeleton).toBe(false);
  });

  test('should respect minimum hydrating time', async () => {
    const coordinator = new ReactiveCoordinator(mockQueryBuilder, {
      minimumHydratingTime: 300
    });

    // Simulate hydrating state
    await coordinator.mockStartHydrating();
    expect(coordinator.visualState.current).toBe('hydrating');

    // Should still be hydrating before minimum time
    await sleep(200);
    expect(coordinator.visualState.current).toBe('hydrating');

    // Should transition to ready after minimum time
    await sleep(200);
    expect(coordinator.visualState.current).toBe('ready');
  });

  test('should handle error states gracefully with stale data', async () => {
    const coordinator = new ReactiveCoordinator(mockQueryBuilder);

    // Establish good data first
    await coordinator.mockReceiveData(mockData);
    expect(coordinator.visualState.current).toBe('ready');

    // Simulate error during refresh
    coordinator.mockReceiveError(new Error('Network failed'));
    expect(coordinator.visualState.current).toBe('error');
    expect(coordinator.visualState.shouldShowData).toBe(true); // Keep showing stale data
    expect(coordinator.data).toEqual(mockData); // Data preserved
  });
});
```

### Integration Tests

```typescript
// File: /tests/logs-page-integration.test.ts

describe('/logs/ Page Flash Prevention', () => {
  test('should not flash skeleton on navigation with cached data', async () => {
    // Navigate to logs page first time
    await page.goto('/logs');
    await expect(page.locator('[data-testid="loading-skeleton"]')).toBeVisible();
    await expect(page.locator('[data-testid="activity-log-list"]')).toBeVisible();

    // Navigate away and back
    await page.goto('/dashboard');
    await page.goto('/logs');

    // Should immediately show data, no skeleton flash
    await expect(page.locator('[data-testid="loading-skeleton"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="activity-log-list"]')).toBeVisible();
  });

  test('should show subtle loading indicator during refresh', async () => {
    await page.goto('/logs');
    await page.waitForSelector('[data-testid="activity-log-list"]');

    // Trigger refresh
    await page.click('[data-testid="refresh-button"]');

    // Should show subtle loader, not skeleton
    await expect(page.locator('[data-testid="subtle-loader"]')).toBeVisible();
    await expect(page.locator('[data-testid="loading-skeleton"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="activity-log-list"]')).toBeVisible();
  });
});
```

## Performance Considerations

### Zero.js Integration Optimization

1. **Query Reuse**: Leverage Zero.js's automatic query deduplication
2. **TTL Management**: Coordinate TTL values across related queries
3. **Memory Management**: Proper cleanup of coordinators and timers
4. **Bundle Size**: Tree-shakeable coordinator features

### Rendering Performance

1. **Minimal Re-renders**: Use derived state to prevent unnecessary updates
2. **Animation Performance**: CSS-based transitions for state changes
3. **Large Dataset Handling**: Virtual scrolling integration with coordinator states

## Implementation Timeline

### Week 1: Foundation
- [ ] Implement ReactiveCoordinator class
- [ ] Create VisualState interface and state machine
- [ ] Write unit tests for flash prevention logic

### Week 2: Integration
- [ ] Create ReactiveView component
- [ ] Integrate with /logs/ page
- [ ] Update ActivityLogList for hydrating state

### Week 3: Testing & Polish
- [ ] Comprehensive integration tests
- [ ] Performance testing and optimization
- [ ] Documentation and migration guide

### Week 4: Rollout
- [ ] Deploy to staging environment
- [ ] User acceptance testing
- [ ] Production deployment with feature flag

## Success Metrics

### Flash Prevention Metrics
- [ ] Zero skeleton flashes on navigation with cached data
- [ ] <200ms transition time from hydrating to ready state
- [ ] Maintain data visibility during error states

### Performance Metrics
- [ ] No regression in Time to Interactive (TTI)
- [ ] <50ms overhead for coordinator initialization
- [ ] Memory usage remains stable with multiple coordinators

### User Experience Metrics
- [ ] Reduced perceived loading time
- [ ] Smoother navigation experience
- [ ] Maintained functionality during state transitions

---

This architecture provides a robust foundation for eliminating loading flashes while maintaining full backward compatibility with the existing ReactiveRecord system. The design leverages Zero.js's strengths while adding a sophisticated state management layer that prevents jarring UI transitions.