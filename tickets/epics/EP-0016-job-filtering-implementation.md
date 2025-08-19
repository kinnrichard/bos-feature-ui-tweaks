# Epic: Job Filtering Implementation

**Epic ID**: EP-0016
**Created**: 2025-01-31
**Updated**: 2025-01-31 (Post EP-0018 DRY implementation)
**Status**: Planning
**Priority**: High
**Dependencies**: 
- Existing FilterPopover architecture
- EP-0018 DRY Jobs Pages (COMPLETED)

## Overview

Implement comprehensive filtering functionality for job listings across the application, specifically on the `/jobs` page and `/clients/[id]/jobs` page. The implementation will leverage the composable architecture from EP-0018 and the existing `FilterPopover.svelte` component to provide filtering by Job Status and Job Priority within a single, unified popover interface.

### Impact of EP-0018

The completion of EP-0018 (DRY Jobs Pages) has significantly simplified this implementation:
- **Filtering logic already exists** in `/lib/filters/jobs.svelte.ts`
- **URL parameter handling** is built into `createFilterFromSearchParams`
- **Display filtering infrastructure** is ready with `createJobsFilter`
- **Estimated effort reduced by ~70%** from original estimates

This epic now focuses primarily on UI integration rather than building filtering infrastructure from scratch.

## Business Value

- **Improved User Efficiency**: Users can quickly find relevant jobs without scrolling through extensive lists
- **Better Workflow Management**: Technicians can focus on high-priority or specific status jobs
- **Enhanced Client Service**: Support teams can quickly identify jobs needing attention
- **Reduced Cognitive Load**: Clear visual filtering reduces time spent searching

## Technical Architecture

### Current State (Post EP-0018)
- Jobs are displayed using composable `JobsListView` component
- Display filtering infrastructure exists in `/lib/filters/jobs.svelte.ts`
- `createJobsFilter` supports multiple filter criteria including status and priority
- `createFilterFromSearchParams` extracts filters from URL parameters
- `GenericFilterPopover.svelte` provides reusable filter UI component
- Task filtering already implemented as a reference pattern

### Proposed Solution
- Integrate `GenericFilterPopover` into `JobsLayout` for UI controls
- Extend `JobFilterOptions` interface to properly type status and priority
- Update `displayFilter` creation to include URL-based status/priority filters
- Single combined filter popover containing both Status and Priority sections
- Full URL parameter persistence using existing infrastructure

## User Stories

### US-001: As a technician, I want to filter jobs by status
**Acceptance Criteria:**
- Can select multiple job statuses simultaneously
- Can see which statuses are currently active
- Filter persists when navigating between pages
- Can clear all status filters with one action

### US-002: As a support manager, I want to filter jobs by priority
**Acceptance Criteria:**
- Can filter by one or more priority levels
- High-priority jobs are easily identifiable
- Can combine priority and status filters
- Visual indicator shows when priority filters are active

### US-003: As a user, I want my filters to persist in the URL
**Acceptance Criteria:**
- Filter state reflected in URL parameters
- Can bookmark filtered views
- Browser back/forward navigation maintains filter state
- Sharing URL preserves filter configuration

## Implementation Plan

**Total Estimated Effort**: 5-7 story points (reduced from 15-20)
**Timeline**: 3-5 days (reduced from 2 weeks)

### Phase 1: Core Infrastructure (1 day)

#### Ticket JOBS-001: Create Job Filter Store
**Priority**: P0 - Critical
**Effort**: 1 point (reduced from 3)
**Assignee**: TBD

**Description**: Create the filter store and options for job filtering, integrating with existing infrastructure.

**Technical Requirements**:
```typescript
// File: /frontend/src/lib/stores/jobFilter.svelte.ts

import { createFilterStore } from '$lib/utils/createFilterStore.svelte';
import type { FilterOption } from '$lib/utils/createFilterStore.svelte';
import type { JobStatus, JobPriority } from '$lib/types/job';

// Define filter options with proper typing
export const jobStatusOptions: FilterOption[] = [
  { id: 'open', value: 'open', label: 'Open' },
  { id: 'in_progress', value: 'in_progress', label: 'In Progress' },
  { id: 'waiting_for_customer', value: 'waiting_for_customer', label: 'Waiting for Customer' },
  { id: 'waiting_for_scheduled_appointment', value: 'waiting_for_scheduled_appointment', label: 'Waiting for Appointment' },
  { id: 'paused', value: 'paused', label: 'Paused' },
  { id: 'successfully_completed', value: 'successfully_completed', label: 'Completed' },
  { id: 'cancelled', value: 'cancelled', label: 'Cancelled' }
];

export const jobPriorityOptions: FilterOption[] = [
  { id: 'critical', value: 'critical', label: 'Critical' },
  { id: 'very_high', value: 'very_high', label: 'Very High' },
  { id: 'high', value: 'high', label: 'High' },
  { id: 'normal', value: 'normal', label: 'Normal' },
  { id: 'low', value: 'low', label: 'Low' },
  { id: 'proactive_followup', value: 'proactive_followup', label: 'Proactive Follow-up' }
];

// Combined options for single popover
export const jobFilterOptions: FilterOption[] = [
  { id: 'status-header', value: 'status-header', label: 'Status', header: true },
  ...jobStatusOptions.map(opt => ({
    ...opt,
    id: `status:${opt.id}`,
    value: `status:${opt.value}`
  })),
  { id: 'divider', value: 'divider', label: '', divider: true },
  { id: 'priority-header', value: 'priority-header', label: 'Priority', header: true },
  ...jobPriorityOptions.map(opt => ({
    ...opt,
    id: `priority:${opt.id}`,
    value: `priority:${opt.value}`
  }))
];

// Create the filter store
export const jobFilter = createFilterStore('jobFilter', jobFilterOptions);

// Helper to extract selected statuses and priorities
export const selectedJobStatuses = $derived(
  jobFilter.selected
    .filter(id => id.startsWith('status:'))
    .map(id => id.replace('status:', '') as JobStatus)
);

export const selectedJobPriorities = $derived(
  jobFilter.selected
    .filter(id => id.startsWith('priority:'))
    .map(id => id.replace('priority:', '') as JobPriority)
);
```

**Acceptance Criteria**:
- [ ] Filter store created using existing `createFilterStore` utility
- [ ] Status and priority options properly defined
- [ ] Combined filter options support headers and dividers
- [ ] Helper derivations for extracting selected values
- [ ] Integration with existing `JobFilterOptions` type

#### Ticket JOBS-002: Create JobFilterPopover Component
**Priority**: P0 - Critical
**Effort**: 2 points
**Assignee**: TBD

**Description**: Implement the JobFilterPopover component using GenericFilterPopover.

**Technical Requirements**:
```typescript
// File: /frontend/src/lib/components/layout/JobFilterPopover.svelte

<script lang="ts">
  import GenericFilterPopover from '$lib/components/ui/GenericFilterPopover.svelte';
  import { jobFilter, jobFilterOptions } from '$lib/stores/jobFilter.svelte';

  interface Props {
    disabled?: boolean;
  }

  let { disabled = false }: Props = $props();

  function handleFilterChange(newSelection: string[]) {
    jobFilter.setSelected(newSelection);
  }
</script>

<GenericFilterPopover
  title="Filter Jobs"
  options={jobFilterOptions}
  selected={jobFilter.selected}
  onFilterChange={handleFilterChange}
  {disabled}
  showAllSelectedByDefault={false}
  preventAllUnchecked={false}
/>
```

**Acceptance Criteria**:
- [ ] Component properly integrates with GenericFilterPopover
- [ ] Supports both status and priority filtering in one popover
- [ ] Visual sections clearly separated with headers
- [ ] Alt-click for exclusive selection works
- [ ] Active filter indicator displays correctly

### Phase 2: UI Integration (1-2 days)

#### Ticket JOBS-003: Update JobsLayout Component
**Priority**: P1 - High
**Effort**: 1 point (reduced from 2)
**Assignee**: TBD

**Description**: Integrate filtering controls into the jobs layout header.

**Technical Updates**:
- Add filter button to header area (right side)
- Import JobFilterPopover component
- Existing jobsSearch integration already works with unified search/filter
- Ensure responsive design for mobile views

**Acceptance Criteria**:
- [ ] Filter button positioned appropriately in header
- [ ] Search and filter controls work together seamlessly
- [ ] Mobile responsive design implemented
- [ ] Consistent with TasksLayout patterns

#### Ticket JOBS-004: Implement Filtering in Jobs Page
**Priority**: P1 - High
**Effort**: 1 point (reduced from 3)
**Assignee**: TBD

**Description**: Update the jobs page to include status and priority filtering using existing infrastructure.

**Implementation Details**:
```typescript
// Update /frontend/src/routes/(authenticated)/jobs/+page.svelte

import { createJobsQuery } from '$lib/queries/jobs.svelte';
import { createJobsFilter, createFilterFromSearchParams } from '$lib/filters/jobs.svelte';
import { jobsSearch } from '$lib/stores/jobsSearch.svelte';
import { selectedJobStatuses, selectedJobPriorities } from '$lib/stores/jobFilter.svelte';

// Create the display filter with status and priority from filter store
const displayFilter = $derived(
  createJobsFilter({
    ...createFilterFromSearchParams(url.searchParams),
    search: jobsSearch.searchQuery,
    technicianId,
    status: selectedJobStatuses[0], // or support multiple
    priority: selectedJobPriorities[0], // or support multiple
  })
);
```

**Note**: The filtering logic already exists in `createJobsFilter`. We just need to pass the selected values from the filter store.

**Acceptance Criteria**:
- [ ] Status filtering works through UI popover
- [ ] Priority filtering works through UI popover
- [ ] Filters combine properly with search
- [ ] Filter state persists in URL
- [ ] Performance remains smooth

#### Ticket JOBS-005: Implement Filtering in Client Jobs Page
**Priority**: P1 - High
**Effort**: 0.5 points (reduced from 2)
**Assignee**: TBD

**Description**: Apply same filtering logic to client-specific jobs page.

**Implementation**: Nearly identical to JOBS-004, just update the `displayFilter` creation in `/clients/[id]/jobs/+page.svelte` to include status and priority from the filter store.

**Acceptance Criteria**:
- [ ] Filtering works within client context
- [ ] URL parameters shared across navigation
- [ ] Client filter remains active with job filters
- [ ] Consistent behavior with main jobs page

### Phase 3: Testing & Polish (1 day)

#### Ticket JOBS-006: Comprehensive Testing
**Priority**: P1 - High
**Effort**: 2 points (reduced from 3)
**Assignee**: TBD

**Test Cases**:
1. **Filter Combinations**
   - Single status filter
   - Multiple status filters
   - Single priority filter
   - Multiple priority filters
   - Combined status + priority filters
   - Clear all filters

2. **URL Parameter Testing**
   - Filters persist in URL
   - Browser back/forward navigation
   - Bookmarked URLs restore filters
   - Invalid URL parameters handled gracefully

3. **UI/UX Testing**
   - Filter popover opens/closes properly
   - Active filter indicators display
   - Alt-click exclusive selection
   - Keyboard navigation
   - Screen reader compatibility

4. **Performance Testing**
   - Filter 1000+ jobs smoothly
   - No UI lag when toggling filters
   - Memory usage remains stable

#### Ticket JOBS-007: Documentation
**Priority**: P2 - Medium
**Effort**: 1 point
**Assignee**: TBD

**Deliverables**:
- [ ] Update user documentation with filter instructions
- [ ] Add inline help tooltips if needed
- [ ] Document keyboard shortcuts (Alt-click)
- [ ] Update developer documentation

## Technical Considerations

### Performance Optimizations
- Leverage existing `$derived` based filtering from EP-0018
- Display filtering happens client-side for instant feedback
- No additional performance overhead since infrastructure exists

### Accessibility
- ARIA labels for filter controls
- Keyboard navigation support
- Screen reader announcements for filter changes

### Integration with EP-0018
- All filtering logic exists in `createJobsFilter`
- `JobFilterOptions` interface supports status and priority
- URL parameter extraction via `createFilterFromSearchParams`
- Minimal code changes required - mostly UI integration

### Future Enhancements
1. **Advanced Filters** (Future Epic)
   - Date range filtering
   - Assigned technician filter (requires a different popover component)
   - Customer type filter
   - Location-based filtering

2. **Filter Presets** (Future Epic)
   - Save custom filter combinations
   - Quick filter buttons
   - Default filters per user role

3. **Analytics Integration** (Future Epic)
   - Track most-used filter combinations
   - Analyze filter patterns for insights
   - Optimize default filter suggestions

## Success Metrics
- **Filter Usage Rate**: >60% of users apply filters within first week
- **Time to Find Jobs**: 50% reduction in average time to locate specific jobs
- **User Satisfaction**: Positive feedback in user surveys
- **Performance**: Filter operations complete in <100ms

## Rollout Plan
1. **Internal Testing**: Deploy to staging for team testing
2. **Beta Release**: Roll out to 10% of users for feedback
3. **Full Release**: Deploy to all users with feature announcement
4. **Monitor & Iterate**: Track usage metrics and gather feedback

## Dependencies
- Existing FilterPopover architecture must remain stable
- Job type definitions must be finalized
- URL routing system must support query parameters

## Risks & Mitigation
- **Risk**: Performance degradation with large datasets
  - **Mitigation**: Implement virtual scrolling and pagination
- **Risk**: Complex filter combinations confuse users
  - **Mitigation**: Clear UI design with helpful tooltips
- **Risk**: Breaking changes to FilterPopover affect other features
  - **Mitigation**: Comprehensive regression testing

## Notes
- Consider implementing this pattern for other list views (clients, users, etc.)
- Keep filter logic reusable for potential API-side filtering in future
- Monitor for edge cases with specific job status/priority combinations
