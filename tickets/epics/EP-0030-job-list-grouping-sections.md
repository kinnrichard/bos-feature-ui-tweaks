# Epic: Job List Automatic Grouping and Sorting

**Epic ID**: EP-0030
**Created**: 2025-08-04
**Status**: Open
**Priority**: High
**Component**: Frontend/Jobs

## Overview

Implement automatic grouping of jobs in the job list view ([http://localhost:5173/clients/506b7ac4-31ec-4931-a5f9-80691496527d/jobs](http://localhost:5173/clients/506b7ac4-31ec-4931-a5f9-80691496527d/jobs)) into logical sections based on their status and due dates. Sections should only display when they contain items, and jobs within each section should follow a specific sorting order.

## Business Value

- **Improved User Experience**: Users can quickly identify and prioritize urgent tasks (overdue, due today)
- **Better Task Management**: Clear visual separation of jobs by timeline helps technicians manage their workload
- **Reduced Cognitive Load**: Automatic grouping eliminates manual scanning through unsorted job lists
- **Increased Efficiency**: Technicians can focus on the right jobs at the right time

## Requirements

### Section Structure

Jobs should be automatically grouped into the following sections (in display order):

1. **Today**
   - Contains: Jobs that are "In Progress", "Paused", AND due today
   - Business Logic: Highest priority items that need immediate attention

2. **Overdue**
   - Contains: Jobs past their due date
   - Business Logic: Critical items requiring immediate action

3. **Due Tomorrow**
   - Contains: Jobs due the next day
   - Business Logic: Near-term planning visibility

4. **Due Next Week**
   - Contains: Jobs due within the next 7 days (excluding today and tomorrow)
   - Business Logic: Short-term planning horizon

5. **No Due Date Set**
   - Contains: Jobs without a due date
   - Business Logic: Backlog items or flexible timeline work

6. **Scheduled**
   - Contains: Jobs whose start date/time hasn't arrived yet
   - Business Logic: Future work that's been planned but not yet actionable

7. **Completed or Cancelled**
   - Contains: Jobs with status "Completed" or "Cancelled"
   - Display Order: Cancelled jobs first, then completed jobs
   - Business Logic: Historical record and reference

### Section Display Rules

- **Conditional Display**: Sections should only render if they contain at least one job
- **Dynamic Updates**: Sections should update in real-time as job statuses or dates change
- **Empty State**: No empty sections should be visible

### Sorting Within Sections

Jobs within each section should be sorted by:

1. **Primary Sort: Status** (in this specific order)
   - In Progress
   - Paused
   - Open
   - Waiting for Customer
   - Scheduled
   - Cancelled
   - Completed

2. **Secondary Sort: Date/Time**
   - If start date is set and hasn't arrived yet: Sort by start date, then start time
   - Otherwise: Sort by due date, then due time

3. **Tertiary Sort: Status**
   - Final tiebreaker using the status order above

## Technical Considerations

### Data Requirements
- Jobs must have accessible fields: status, due_date, due_time, start_date, start_time
- Date comparisons must account for timezone considerations
- Real-time updates when job data changes

### Performance
- Grouping and sorting should be efficient for large job lists (100+ items)
- Consider memoization for complex date calculations
- Virtual scrolling may be needed for very large lists

### UI/UX
- Clear visual separation between sections (headers, spacing, or dividers)
- Section headers should be visually distinct but not overwhelming
- Consider collapsible sections for better space management
- Mobile-responsive design

## Success Criteria

1. All jobs are correctly categorized into their appropriate sections
2. Sections only display when they contain jobs
3. Sorting within sections follows the specified order exactly
4. Performance remains smooth with 200+ jobs
5. Real-time updates when job statuses or dates change
6. Mobile and desktop views work correctly

## Dependencies

- Current job list component structure
- Job data model and available fields
- Existing sorting/filtering mechanisms that may need adjustment
- Date/time utility functions

## Implementation Tasks

### Phase 1: Data Layer
- [ ] Create grouping logic functions
- [ ] Implement date comparison utilities (today, tomorrow, next week)
- [ ] Build sorting comparator functions

### Phase 2: Component Updates
- [ ] Update job list component to use grouped data
- [ ] Implement conditional section rendering
- [ ] Add section headers and styling

### Phase 3: Real-time Updates
- [ ] Ensure reactive updates when job data changes
- [ ] Handle edge cases (jobs moving between sections)
- [ ] Optimize re-rendering performance

### Phase 4: Polish & Testing
- [ ] Add unit tests for grouping logic
- [ ] Add integration tests for section display
- [ ] Performance testing with large datasets
- [ ] Mobile responsiveness testing
- [ ] Edge case handling (timezone changes, daylight saving)

## Notes

- Consider adding user preferences for section ordering or hiding specific sections
- Future enhancement: Allow manual reordering within sections via drag-and-drop
- Consider adding job counts in section headers
- May want to add filtering options to show/hide specific sections

## Related Epics

- EP-0016: Job Filtering Implementation (existing filtering may need coordination)
- EP-0018: DRY Jobs Pages Architecture (ensure consistency with architectural patterns)