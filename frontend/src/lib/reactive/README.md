# ReactiveRecord v2 - Phase 1 Core Implementation

This directory contains the Phase 1 implementation of ReactiveRecord v2, providing core functionality for flash prevention and intelligent state management in reactive data queries.

## 🚀 Key Features

### 5-State Lifecycle Management
- **initializing**: Query setup phase
- **loading**: Initial data fetch in progress
- **hydrating**: Refreshing existing data (preserves stale data)
- **ready**: Data is current and display-ready
- **error**: Unrecoverable error state

### Flash Prevention
- Intelligent timing thresholds prevent quick loading flashes
- Stale data preservation during refresh operations
- Context-aware empty state handling
- Progressive loading strategies

### Zero.js Integration
- Leverages Zero.js automatic query reuse and data sharing
- Maintains full compatibility with existing ReactiveRecord API
- Optimized for Rails-style query patterns

## 📁 File Structure

```
src/lib/reactive/
├── coordinator.ts          # Core ReactiveCoordinator class
├── integration.ts          # Integration utilities and adapters
├── factory.ts             # Factory functions for enhanced records
├── ReactiveView.svelte    # Declarative component for reactive data
├── index.ts               # Main exports and quick start guide
└── README.md              # This documentation
```

## 🛠 Core Components

### ReactiveCoordinator

The heart of the v2 system, managing the complete lifecycle of reactive queries:

```typescript
import { createReactiveCoordinator } from '$lib/reactive';

const coordinator = createReactiveCoordinator(query, {
  minimumLoadingTime: 300,    // Prevent flash
  preserveStaleData: true,    // Keep data during refresh
  debug: false               // Enable logging
});

// Access visual state
const visualState = coordinator.visualState;
console.log(visualState.state);        // Current lifecycle state
console.log(visualState.displayData);  // Data to show (may be stale)
console.log(visualState.shouldShowLoading); // Loading indicator state
```

### ReactiveView Component

Declarative component that handles all state management complexity:

```svelte
<script>
  import { ReactiveView } from '$lib/reactive';
  
  const query = ReactiveJob.kept().all();
</script>

<ReactiveView {query} strategy="progressive">
  {#snippet content({ data, isLoading, refresh })}
    {#each data as job}
      <JobCard {job} />
    {/each}
  {/snippet}
  
  {#snippet loading()}
    <LoadingSkeleton />
  {/snippet}
  
  {#snippet empty()}
    <div>No jobs found</div>
  {/snippet}
</ReactiveView>
```

### Enhanced ReactiveRecord

Drop-in replacement for existing ReactiveRecord with coordinator integration:

```typescript
import { ReactiveRecordFactory } from '$lib/reactive';

// Create enhanced reactive record
const ReactiveJob = ReactiveRecordFactory.create({
  tableName: 'jobs',
  className: 'Job'
});

// Same API, enhanced behavior
const jobs = ReactiveJob.kept().orderBy('created_at', 'desc').all();

// Access enhanced functionality
const visualState = jobs.getVisualState();
const unsubscribe = jobs.subscribeToVisualState((state) => {
  console.log('State changed:', state.state);
});
```

## 🔄 Migration Guide

### Step 1: Update Model Creation

**Before:**
```typescript
import { createReactiveRecord } from '$lib/models/base/reactive-record';
const ReactiveJob = createReactiveRecord({ tableName: 'jobs', className: 'Job' });
```

**After:**
```typescript
import { ReactiveRecordFactory } from '$lib/reactive';
const ReactiveJob = ReactiveRecordFactory.create({ tableName: 'jobs', className: 'Job' });
```

### Step 2: Use Context-Appropriate Factories

For navigation between pages:
```typescript
const ReactiveJob = ReactiveRecordFactory.createForNavigation({
  tableName: 'jobs',
  className: 'Job'
});
```

For initial page loads:
```typescript
const ReactiveJob = ReactiveRecordFactory.createForInitialLoad({
  tableName: 'jobs',
  className: 'Job'
});
```

### Step 3: Upgrade Components with ReactiveView

Replace complex loading/error/empty logic with ReactiveView:

**Before:**
```svelte
{#if jobs.isLoading}
  <LoadingSkeleton />
{:else if jobs.error}
  <ErrorMessage error={jobs.error} />
{:else if jobs.blank}
  <EmptyState />
{:else}
  {#each jobs.data as job}
    <JobCard {job} />
  {/each}
{/if}
```

**After:**
```svelte
<ReactiveView query={jobs} strategy="progressive">
  {#snippet content({ data })}
    {#each data as job}
      <JobCard {job} />
    {/each}
  {/snippet}
</ReactiveView>
```

## 🎯 Usage Patterns

### Basic Usage
```typescript
// Standard reactive record with flash prevention
const ReactiveJob = ReactiveRecordFactory.create({
  tableName: 'jobs',
  className: 'Job'
});

const job = ReactiveJob.find('job-id');
$: data = job.data; // No more flashing!
```

### Navigation Optimization
```typescript
// Optimized for page transitions
const ReactiveJob = ReactiveRecordFactory.createForNavigation({
  tableName: 'jobs',
  className: 'Job'
});

// Fast transitions between job views
const jobs = ReactiveJob.kept().all();
```

### Advanced State Management
```typescript
import { withCoordinator } from '$lib/reactive';

// Wrap existing query with coordinator
const enhancedQuery = withCoordinator(existingQuery, {
  minimumLoadingTime: 500,
  preserveStaleData: true
});

// Monitor state transitions
enhancedQuery.subscribeToVisualState((state) => {
  console.log(`State: ${state.state}, Fresh: ${state.isFresh}`);
});
```

### Display-Level Filtering
```svelte
<ReactiveView 
  query={jobs} 
  displayFilters={{ search: searchTerm, status: selectedStatus }}
  strategy="progressive"
>
  {#snippet content({ data })}
    <!-- data is already filtered -->
    {#each data as job}
      <JobCard {job} />
    {/each}
  {/snippet}
</ReactiveView>
```

## 🧪 Testing

The implementation includes comprehensive tests covering:

- State lifecycle transitions
- Flash prevention timing
- Error handling and recovery
- Subscription management
- Configuration options

Run tests with:
```bash
npm test test/reactive/
```

## 🔧 Configuration Options

### CoordinatorConfig
```typescript
interface CoordinatorConfig {
  /** Minimum time to show loading state (prevents flash) */
  minimumLoadingTime?: number;    // Default: 300ms
  
  /** Timeout for considering initial load failed */
  initialLoadTimeout?: number;    // Default: 10000ms
  
  /** Whether to preserve stale data during refresh */
  preserveStaleData?: boolean;    // Default: true
  
  /** Debug mode for verbose logging */
  debug?: boolean;               // Default: false
}
```

### Factory Presets
- **Standard**: Balanced settings for general use
- **Navigation**: Fast transitions (100ms minimum loading)
- **Initial Load**: Patient loading (500ms minimum, 15s timeout)

## 🚀 Performance Considerations

### Memory Management
- Coordinators automatically clean up subscriptions
- Use `destroy()` method when components unmount
- ReactiveView handles cleanup automatically

### Network Efficiency
- Leverages Zero.js query deduplication
- Stale data reduces unnecessary requests
- TTL settings control cache behavior

### UI Responsiveness
- Minimum loading times prevent flash
- Progressive strategy shows stale data during refresh
- Smart empty state detection prevents flicker

## 🐛 Debugging

### Enable Debug Mode
```typescript
const ReactiveJob = ReactiveRecordFactory.create({
  tableName: 'jobs',
  className: 'Job'
});

// Debug individual queries
const debugQuery = withCoordinator(query, { debug: true });

// Monitor state transitions
import { DevUtils } from '$lib/reactive';
const unsubscribe = DevUtils.monitorStateTransitions(enhancedQuery, 'MyQuery');
```

### Common Issues

1. **Flash still occurring**: Check `minimumLoadingTime` setting
2. **Stale data showing**: Verify `preserveStaleData` configuration
3. **Slow transitions**: Use navigation-optimized factory
4. **Memory leaks**: Ensure proper cleanup in components

## 🔮 Future Phases

This Phase 1 implementation provides the foundation for:

- **Phase 2**: Rails-style scoped queries (.kept(), .discarded())
- **Phase 3**: Advanced ReactiveView features
- **Phase 4**: Developer experience improvements
- **Phase 5**: Advanced features (multi-query coordination, smart caching)

## 📚 Examples

See `/examples/` directory for:
- ActivityLogListV2Example.svelte - Complete integration example
- Various usage patterns and migration examples

## 🤝 Backward Compatibility

The implementation maintains 100% backward compatibility with existing ReactiveRecord usage. Existing code continues to work without changes while gaining flash prevention benefits when upgraded to use the new factories.

---

**Version**: Phase 1 Core Implementation  
**Last Updated**: 2025-07-28  
**Compatibility**: ReactiveRecord v1.x, Zero.js, Svelte 5