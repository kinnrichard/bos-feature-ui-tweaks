# Epic: Technician Filter for Jobs Page

**Epic ID**: EPIC-TECH-FILTER-001  
**Created**: 2025-08-03  
**Priority**: High  
**Status**: Planning  

## Overview

Add a technician filter popover to the jobs page that allows users to filter jobs by assigned technicians, including an option to show only unassigned jobs.

### User Story
As a manager, I want to filter the jobs list by assigned technicians so that I can quickly see which jobs are assigned to specific team members or identify unassigned jobs that need attention.

### Business Value
- Improves job visibility and team workload management
- Enables quick identification of unassigned jobs
- Provides consistent filtering experience across the application
- Enhances supervisor ability to balance technician workloads

## Technical Approach

### Principles
1. **DRY (Don't Repeat Yourself)**: Maximize reuse of existing components and patterns
2. **Svelte 5 Best Practices**: Use modern runes (`$state`, `$derived`, `$props`)
3. **Consistency**: Match existing filter UI/UX patterns
4. **Performance**: Efficient filtering with reactive updates

### Architecture Decisions
- Extend existing `jobFilter` store instead of creating a new store
- Reuse `GenericFilterPopover` and `PopoverMenu` components
- Extract shared avatar display logic into reusable component
- Maintain URL parameter persistence for filter state

## Success Criteria
- [ ] Technician filter button appears to the left of the existing filter button on /jobs page
- [ ] Filter shows "Not Assigned" option with questionmark.circle.fill.svg icon
- [ ] Filter shows all available technicians with their avatars
- [ ] Empty state shows person.fill.svg icon
- [ ] Selected state shows technician avatars or appropriate icon
- [ ] Filter state persists in URL parameters
- [ ] Jobs list updates immediately when filter selection changes
- [ ] Filter works correctly with existing status/priority filters

---

## Tickets

### Ticket 1: Extend Job Filter Store for Technician Filtering

**File**: `/src/lib/stores/jobFilter.svelte.ts`

**Requirements**:
1. Add technician filtering to existing jobFilter store
2. Handle special "not_assigned" option
3. Manage `technician_ids` URL parameter (comma-separated values)
4. Provide helper functions:
   - `getSelectedTechnicianIds()`: Returns array of selected user IDs
   - `isNotAssignedSelected()`: Returns boolean for "not assigned" selection

**Implementation Details**:
```typescript
// Add to jobFilterOptions array:
{ id: 'divider2', value: 'divider2', label: '', divider: true },
{ id: 'technician-header', value: 'technician-header', label: 'Filter by Technician', header: true },
{ id: 'technician:not_assigned', value: 'technician:not_assigned', label: 'Not Assigned', icon: 'questionmark.circle.fill' },
// ... dynamically add technician options

// URL parameter handling:
// technician_ids=not_assigned,user1,user2
```

**Acceptance Criteria**:
- [ ] Store handles technician selections alongside status/priority
- [ ] URL parameters update when technician selection changes
- [ ] Special "not_assigned" value is handled correctly
- [ ] Helper functions return correct values

---

### Ticket 2: Create Shared TechnicianAvatarGroup Component

**File**: `/src/lib/components/ui/TechnicianAvatarGroup.svelte`

**Requirements**:
1. Extract avatar display logic from TechnicianAssignmentButton
2. Support different display modes (avatars, icons)
3. Handle overflow with "+N" count
4. Use Svelte 5 patterns

**Component Interface**:
```svelte
<script lang="ts">
  import type { UserData } from '$lib/models/types/user-data';
  import UserAvatar from './UserAvatar.svelte';
  
  let {
    technicians = [],
    maxDisplay = 2,
    size = 'xs',
    showNotAssigned = false,
    emptyIcon = '/icons/person.fill.svg'
  }: {
    technicians?: UserData[];
    maxDisplay?: number;
    size?: 'xs' | 'sm' | 'md';
    showNotAssigned?: boolean;
    emptyIcon?: string;
  } = $props();
  
  const displayTechnicians = $derived(technicians.slice(0, maxDisplay));
  const extraCount = $derived(Math.max(0, technicians.length - maxDisplay));
  const isEmpty = $derived(technicians.length === 0 && !showNotAssigned);
</script>
```

**Visual States**:
- Empty: Show `person.fill.svg`
- Not Assigned only: Show `questionmark.circle.fill.svg`
- Technicians: Show avatars with overlap
- Mixed: Show question mark + count

**Acceptance Criteria**:
- [ ] Component displays avatars correctly
- [ ] Overflow count shows when > maxDisplay
- [ ] Empty state shows appropriate icon
- [ ] Component is reusable and well-typed

---

### Ticket 3: Create TechnicianFilterPopover Component

**File**: `/src/lib/components/layout/TechnicianFilterPopover.svelte`

**Requirements**:
1. Use GenericFilterPopover or BasePopover with PopoverMenu
2. Show "Not Assigned" option at top with questionmark icon
3. List all technicians with UserAvatar icons
4. Use TechnicianAvatarGroup for button display
5. Connect to jobFilter store for technician management

**Component Structure**:
```svelte
<script lang="ts">
  import BasePopover from '$lib/components/ui/BasePopover.svelte';
  import PopoverMenu from '$lib/components/ui/PopoverMenu.svelte';
  import TechnicianAvatarGroup from '$lib/components/ui/TechnicianAvatarGroup.svelte';
  import UserAvatar from '$lib/components/ui/UserAvatar.svelte';
  import { ReactiveUser } from '$lib/models/reactive-user';
  import { jobFilter, getSelectedTechnicianIds, isNotAssignedSelected } from '$lib/stores/jobFilter.svelte';
  
  let { disabled = false }: { disabled?: boolean } = $props();
  
  // Load all users
  const usersQuery = ReactiveUser.all().orderBy('name', 'asc').all();
  const users = $derived(usersQuery.data || []);
  
  // Get current selections
  const selectedIds = $derived(getSelectedTechnicianIds());
  const notAssignedSelected = $derived(isNotAssignedSelected());
  
  // Build menu options
  const menuOptions = $derived([
    { id: 'title', value: 'title', label: 'Filter by Technician', header: true },
    { 
      id: 'not_assigned', 
      value: 'not_assigned', 
      label: 'Not Assigned',
      icon: '/icons/questionmark.circle.fill.svg',
      selected: notAssignedSelected
    },
    { id: 'divider', value: 'divider', divider: true },
    ...users.map(user => ({
      id: user.id,
      value: user.id,
      label: user.name,
      user: user,
      selected: selectedIds.includes(user.id)
    }))
  ]);
</script>
```

**Button States**:
- No selection: `person.fill.svg` (muted)
- Not Assigned: `questionmark.circle.fill.svg`
- Technicians: Avatar group
- Mixed: Question mark + count

**Acceptance Criteria**:
- [ ] Popover shows all technicians with avatars
- [ ] "Not Assigned" option appears at top with correct icon
- [ ] Button shows appropriate visual state
- [ ] Selection changes update filter immediately
- [ ] Component follows existing popover patterns

---

### Ticket 4: Integrate Filter into Toolbar and Jobs Page

**Files**:
- `/src/lib/components/layout/Toolbar.svelte`
- `/src/routes/(authenticated)/jobs/+page.svelte`

**Toolbar Updates**:
1. Import TechnicianFilterPopover
2. Add show logic for jobs pages
3. Position before (left of) JobFilterPopover

```svelte
// In Toolbar.svelte
const showTechnicianFilter = $derived(
  currentPageType === 'jobs' &&
  ($page.route.id === '/(authenticated)/jobs' || $page.route.id === ROUTE_PATTERNS.clientJobs)
);

// In template, right section:
{#if showTechnicianFilter}
  <TechnicianFilterPopover {disabled} />
{/if}
{#if showJobFilter}
  <JobFilterPopover {disabled} />
{/if}
```

**Jobs Page Updates**:
```svelte
// In +page.svelte
import { getSelectedTechnicianIds, isNotAssignedSelected } from '$lib/stores/jobFilter.svelte';

const selectedTechnicianIds = $derived(getSelectedTechnicianIds());
const showNotAssigned = $derived(isNotAssignedSelected());

const displayFilter = $derived(
  createJobsFilter({
    search: jobsSearch.searchQuery,
    technicianIds: selectedTechnicianIds,
    showNotAssigned,
    statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
    priorities: selectedPriorities.length > 0 ? selectedPriorities : undefined,
  })
);
```

**Acceptance Criteria**:
- [ ] Filter appears on main jobs page
- [ ] Filter appears on client-specific jobs pages
- [ ] Filter is positioned left of status/priority filter
- [ ] Filter state affects job list display

---

### Ticket 5: Update Filter Utilities for Multi-Technician Support

**File**: `/src/lib/filters/jobs.svelte.ts`

**Requirements**:
1. Update JobFilterOptions interface
2. Modify filtering logic for multiple technicians
3. Add "not assigned" filtering logic

**Implementation**:
```typescript
export interface JobFilterOptions {
  // ... existing fields
  technicianIds?: string[];  // Changed from technicianId
  showNotAssigned?: boolean; // New field
}

export function isAssignedToAnyTechnician(job: JobData, technicianIds: string[]): boolean {
  if (!technicianIds || technicianIds.length === 0) return true;
  
  return job.jobAssignments?.some(
    assignment => technicianIds.includes(assignment.user?.id || assignment.user_id)
  ) ?? false;
}

export function hasNoAssignments(job: JobData): boolean {
  return !job.jobAssignments || job.jobAssignments.length === 0;
}

// In createJobsFilter:
// Show job if:
// - No technician filter active (show all)
// - showNotAssigned is true AND job has no assignments
// - Job is assigned to ANY selected technician
if (options.technicianIds || options.showNotAssigned) {
  const matchesTechnician = options.technicianIds?.length > 0 && 
    isAssignedToAnyTechnician(job, options.technicianIds);
  const matchesNotAssigned = options.showNotAssigned && hasNoAssignments(job);
  
  if (!matchesTechnician && !matchesNotAssigned) {
    return false;
  }
}
```

**Acceptance Criteria**:
- [ ] Filter correctly identifies unassigned jobs
- [ ] Filter shows jobs assigned to ANY selected technician
- [ ] Mixed selection (not assigned + technicians) works with OR logic
- [ ] Backwards compatible with existing single technicianId parameter

---

### Ticket 6: Update TechnicianAssignmentButton to Use Shared Component

**File**: `/src/lib/components/layout/TechnicianAssignmentButton.svelte`

**Requirements**:
1. Replace inline avatar display with TechnicianAvatarGroup
2. Maintain existing functionality
3. Reduce code duplication

**Acceptance Criteria**:
- [ ] Component uses TechnicianAvatarGroup
- [ ] Existing functionality unchanged
- [ ] Code is cleaner and more maintainable

---

## Testing Requirements

### Manual Testing Scenarios

1. **Empty State**
   - No technicians selected → Shows person.fill.svg
   - Jobs list shows all jobs

2. **Not Assigned Only**
   - Select only "Not Assigned" → Shows questionmark icon
   - Jobs list shows only unassigned jobs

3. **Specific Technicians**
   - Select 1-2 technicians → Shows their avatars
   - Jobs list shows only jobs assigned to those technicians

4. **Mixed Selection**
   - Select "Not Assigned" + technicians → Shows mixed indicator
   - Jobs list shows unassigned jobs AND jobs assigned to selected technicians

5. **URL Persistence**
   - Make selection → Refresh page → Selection persists
   - Share URL → Other user sees same filter

6. **Combined Filters**
   - Use technician + status filters → Both apply (AND logic)
   - Clear all filters → All jobs show

### Edge Cases to Test

1. **No Users in System**
   - Filter still shows "Not Assigned" option
   - Appropriate empty state message

2. **Many Users (20+)**
   - Popover scrolls appropriately
   - Performance remains good

3. **Deleted User Assignment**
   - Job assigned to deleted user still appears when appropriate
   - Deleted user not in selection list

4. **Browser Back/Forward**
   - Filter state updates correctly with navigation

---

## Implementation Notes

### Icons Required
- `/icons/person.fill.svg` - Empty state icon
- `/icons/questionmark.circle.fill.svg` - Not assigned icon
- Existing user avatars for technician display

### UI Specifications
- Filter button uses same styling as JobFilterPopover
- Position: Left of existing filter button, 12px gap
- Popover width: min 240px, max-content
- Avatar size in button: xs
- Max avatars shown: 2 before "+N"

### Performance Considerations
- Users query is cached and shared
- Filter operations are client-side only
- URL updates are debounced (300ms)
- Reactive updates use Svelte 5 fine-grained reactivity

### Accessibility
- Proper ARIA labels for filter button
- Keyboard navigation in popover
- Screen reader announces filter state changes
- Focus management on popover open/close

---

## Dependencies
- Existing filter infrastructure (GenericFilterPopover, PopoverMenu)
- ReactiveUser model for user data
- Existing jobFilter store patterns
- UserAvatar component

## Risks & Mitigations
- **Risk**: Performance with many users
  - **Mitigation**: Consider virtual scrolling if > 50 users
- **Risk**: Complex filter state confusion
  - **Mitigation**: Clear visual indicators, consider filter summary text
- **Risk**: Breaking existing filter functionality
  - **Mitigation**: Extend rather than modify existing code

## Future Enhancements
- Search within technician list for large teams
- Bulk technician selection options
- Saved filter presets
- Technician workload indicators in filter