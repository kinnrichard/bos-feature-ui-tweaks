# STORY-EP17-001: Migrate /jobs Page to ReactiveView

**Epic**: EP-0017 - ZeroDataView to ReactiveView Migration  
**Status**: 📋 Ready  
**Priority**: High  
**Estimate**: 3 points  
**Created**: 2025-08-01  

## Description

As a developer, I want to migrate the /jobs page from using ZeroDataView to ReactiveView so that we can standardize on a single data container component and benefit from progressive loading features.

## Current Implementation

The `/jobs` page currently uses:
- `ZeroDataView` component for data container
- Manual filtering with `$derived` runes
- Separate `query` and `displayData` props

## Acceptance Criteria

- [ ] Replace ZeroDataView with ReactiveView in `/jobs/+page.svelte`
- [ ] Maintain all current filtering functionality (scope, technician, search)
- [ ] Implement progressive loading strategy for better UX
- [ ] Preserve empty state messages (filtered vs unfiltered)
- [ ] No visual regression - UI looks identical
- [ ] All existing tests pass
- [ ] Add tests for progressive loading behavior

## Technical Details

### Files to Modify

1. `/frontend/src/routes/(authenticated)/jobs/+page.svelte`

### Implementation Steps

1. **Update imports**:
   ```typescript
   import ReactiveView from '$lib/reactive/ReactiveView.svelte';
   ```

2. **Refactor filtering logic**:
   - Keep complex filtering in `$derived` for now
   - Pass filtered data through content snippet context

3. **Update component structure**:
   ```svelte
   <ReactiveView 
     query={jobsQuery}
     strategy="progressive"
   >
     {#snippet loading()}
       <LoadingSkeleton type="job" count={6} />
     {/snippet}
     
     {#snippet error({ error, refresh })}
       <div class="error-state">
         <h2>Unable to load jobs</h2>
         <p>{error.message}</p>
         <button onclick={refresh}>Retry</button>
       </div>
     {/snippet}
     
     {#snippet empty()}
       <div class="empty-state">
         <div class="empty-state-icon">💼</div>
         <h2>No jobs found</h2>
       </div>
     {/snippet}
     
     {#snippet content({ data })}
       {@const filteredJobs = applyFilters(data)}
       {#if filteredJobs.length === 0}
         <div class="empty-state">
           <div class="empty-state-icon">🔍</div>
           <h2>No jobs match your filters</h2>
           <p>Try adjusting your filters or search criteria.</p>
         </div>
       {:else}
         <div class="jobs-list">
           {#each filteredJobs as job (job.id)}
             <JobCard {job} showClient={true} />
           {/each}
         </div>
       {/if}
     {/snippet}
   </ReactiveView>
   ```

4. **Move filter logic to function**:
   ```typescript
   function applyFilters(jobs: JobData[]): JobData[] {
     return jobs.filter((job) => {
       if (!shouldShowJob(job)) return false;
       if (technicianId && !hasMatchingTechnician(job, technicianId)) return false;
       // ... other filters
       return true;
     });
   }
   ```

## Testing

1. **Manual Testing**:
   - Verify all filters work correctly
   - Test progressive loading (data updates without full page reload)
   - Check empty states (no data vs filtered empty)
   - Test error states and retry functionality

2. **Automated Tests**:
   - Update existing tests to work with ReactiveView
   - Add test for progressive loading behavior
   - Verify filter integration

## Definition of Done

- [ ] Code implemented and working
- [ ] All tests passing
- [ ] Progressive loading verified
- [ ] Code reviewed
- [ ] No visual regressions
- [ ] Performance verified (no degradation)

## Notes

- This is the pilot implementation for the migration
- Document any gotchas for future migrations
- Consider if filter logic should move to displayFilters prop in future iteration