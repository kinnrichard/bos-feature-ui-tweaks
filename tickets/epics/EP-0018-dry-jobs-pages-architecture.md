# EP-0018: DRY Jobs Pages with Composable Architecture

## Overview

This epic addresses significant code duplication between `/jobs` and `/clients/[id]/jobs` pages by introducing a composable, layered architecture that follows Svelte 5 best practices and SOLID principles.

## Problem Statement

### Current Issues
1. **~150 lines of duplicate code** between the two job listing pages
2. **Violation of DRY principle** - identical ReactiveView setup, filtering logic, and styles
3. **Tight coupling** - display logic intertwined with data querying
4. **Limited extensibility** - adding new filtered job views requires duplicating patterns
5. **Mixed concerns** - pages handle data fetching, filtering, display logic, and error states

### Impact
- Maintenance burden when updating job listing functionality
- Risk of inconsistent behavior between views
- Difficult to add new job views (e.g., by technician, by status)
- Testing requires duplicating test cases

## Proposed Solution

### Architectural Approach

Implement a **layered, composable architecture** that separates concerns:

```
┌─────────────────────────────────────────────┐
│             Page Components                  │
│  (Client Jobs Page)  (All Jobs Page)        │
└─────────────┬───────────────┬───────────────┘
              │               │
┌─────────────▼───────────────▼───────────────┐
│         JobsListView (Presentation)          │
│  - Handles ReactiveView integration          │
│  - Manages loading/error/empty states        │
│  - Applies display filters                   │
└─────────────┬───────────────────────────────┘
              │
┌─────────────▼───────────────────────────────┐
│      Query Builders (Composable)             │
│  - createJobsQuery()                         │
│  - withClientFilter()                        │
│  - withStatusFilter()                        │
│  - withSearchFilter()                        │
└─────────────────────────────────────────────┘
```

### Key Components

#### 1. Composable Query Builders (`/src/lib/queries/jobs.svelte.ts`)
```typescript
// Base query builder
export function createJobsQuery() {
  return ReactiveJob.includes('client').orderBy('created_at', 'desc');
}

// Composable filter functions
export function withClientFilter(query, clientId: string) {
  return clientId ? query.where({ client_id: clientId }) : query;
}

export function withTechnicianFilter(query, technicianId: string) {
  // Filter by job assignments
}

export function withStatusFilter(query, status: JobStatus) {
  return status ? query.where({ status }) : query;
}
```

#### 2. Display Filter Utilities (`/src/lib/filters/jobs.svelte.ts`)
```typescript
interface FilterOptions {
  search?: string;
  status?: JobStatus;
  priority?: JobPriority;
  technicianId?: string;
}

export function createJobsFilter(options: FilterOptions) {
  return (jobs: JobData[]) => {
    return jobs.filter(job => {
      // Apply search filter
      if (options.search && !shouldShowJob(job, options.search)) {
        return false;
      }
      
      // Apply other filters...
      return true;
    });
  };
}
```

#### 3. Presentation Component (`/src/lib/components/jobs/JobsListView.svelte`)
```svelte
<script lang="ts">
  import type { ReactiveQuery } from '$lib/models/base/types';
  import type { JobData } from '$lib/models/types/job-data';
  import ReactiveView from '$lib/reactive/ReactiveView.svelte';
  
  interface Props {
    query: ReactiveQuery<JobData[]>;
    displayFilter?: (jobs: JobData[]) => JobData[];
    showClient?: boolean;
    title?: string;
    headerContent?: Snippet;
  }
  
  let { query, displayFilter = (jobs) => jobs, showClient = true, title, headerContent }: Props = $props();
</script>

<JobsLayout>
  {#snippet header()}
    {#if title}<h1>{title}</h1>{/if}
    {#if headerContent}{@render headerContent()}{/if}
  {/snippet}
  
  <ReactiveView {query} strategy="progressive">
    <!-- All the standard snippets -->
  </ReactiveView>
</JobsLayout>
```

#### 4. Simplified Page Components

**All Jobs Page:**
```svelte
<script>
  const query = $derived(createJobsQuery().all());
  
  const displayFilter = $derived(
    createJobsFilter({
      search: jobsSearch.searchQuery,
      status: $page.url.searchParams.get('status'),
      technicianId: $page.url.searchParams.get('technician_id')
    })
  );
</script>

<JobsListView {query} {displayFilter} title="Jobs" />
```

**Client Jobs Page:**
```svelte
<script>
  const clientId = $derived($page.params.id);
  const clientQuery = $derived(ReactiveClient.find(clientId));
  
  const jobsQuery = $derived(
    clientId ? withClientFilter(createJobsQuery(), clientId).all() : null
  );
  
  const displayFilter = $derived(
    createJobsFilter({ search: jobsSearch.searchQuery })
  );
</script>

{#if clientQuery?.error}
  <ErrorState error={clientQuery.error} />
{:else if jobsQuery}
  <JobsListView 
    query={jobsQuery} 
    {displayFilter}
    showClient={false}
    title={`Jobs for ${clientQuery?.data?.name}`}
  />
{/if}
```

## Benefits

### Technical Benefits
1. **80% reduction in code duplication** (vs 50% with simpler approach)
2. **Single Responsibility** - each layer has one clear purpose
3. **Open/Closed Principle** - add new filters without modifying existing code
4. **Composability** - mix and match query builders and filters
5. **Type Safety** - full TypeScript support throughout
6. **Performance** - filters can be memoized with `$derived`
7. **Testability** - test query builders and filters in isolation

### Business Benefits
1. **Faster feature development** - new job views in minutes, not hours
2. **Reduced maintenance cost** - single source of truth for job listings
3. **Consistent user experience** - all job views behave identically
4. **Lower bug risk** - fixes apply everywhere automatically

## Implementation Plan

### Phase 1: Core Infrastructure (2 days)
1. Create query builder utilities
2. Create filter composition system
3. Create JobsListView component
4. Write comprehensive tests

### Phase 2: Migration (1 day)
1. Migrate `/jobs` page
2. Migrate `/clients/[id]/jobs` page
3. Remove duplicate code
4. Update tests

### Phase 3: Documentation & Extension (1 day)
1. Document the pattern for other resource types
2. Create example for adding new job view
3. Consider extending pattern to other entities (clients, technicians)

## Success Metrics
- [ ] Zero code duplication between job pages
- [ ] All existing functionality preserved
- [ ] Tests pass without modification
- [ ] New filtered job view can be added in <30 minutes
- [ ] Performance metrics unchanged or improved

## Future Considerations

This pattern can be extended to:
- **Other resource types** (clients, technicians, invoices)
- **Advanced features** (pagination, infinite scroll, virtual scrolling)
- **Offline support** (with proper query caching)
- **Real-time updates** (WebSocket integration)

## Technical Decisions

1. **Why composable functions over class inheritance?**
   - More flexible and testable
   - Better tree-shaking
   - Aligns with functional programming trends

2. **Why separate query builders from display filters?**
   - Query builders work at database level (efficient)
   - Display filters work on loaded data (flexible)
   - Allows for computed/derived filtering

3. **Why not use SvelteKit load functions for filtering?**
   - Client-side filtering provides instant feedback
   - Reduces server load
   - Better UX for search-as-you-type

## Related Work
- EP-0017: ZeroDataView to ReactiveView migration
- EP-0016: Job filtering implementation
- ReactiveRecord v2 architecture

## Notes
- This pattern establishes a standard for all resource list views
- Consider creating a generator/template for new resource types
- Monitor performance with large datasets (>1000 jobs)