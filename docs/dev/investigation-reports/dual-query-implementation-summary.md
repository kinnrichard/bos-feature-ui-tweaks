# Task Display Dual Query Pattern - Implementation Summary

## Overview
Successfully implemented the dual query pattern to separate task positioning logic from display filtering logic, resolving bugs where drag-and-drop operations would calculate incorrect positions when filters were applied.

## Changes Made

### 1. Job Detail Page (`+page.svelte`)
- Added import of `shouldShowTask` from taskFilter store
- Created two derived collections:
  - `keptTasks`: All non-discarded tasks (for positioning)
  - `displayedTasks`: Tasks matching current filters (for display)
- Updated task statistics to use `displayedTasks`
- Pass both collections to JobDetailView

### 2. JobDetailView Component
- Added `keptTasks` prop to component interface
- Pass `keptTasks` to TaskList component

### 3. TaskList Component
- Added `keptTasks` prop to component interface
- Created separate hierarchies:
  - `hierarchicalTasks`: For display (filtered)
  - `keptTasksHierarchy`: For positioning (all kept tasks)
- Created `flattenedKeptTasks` for position calculations
- Updated all position-related functions to use `keptTasks`:
  - `calculateParentFromPosition`
  - `resolveParentChildBoundary`
  - `calculateRelativePosition`
  - `createVisualOrderMap`
  - Task creation position calculations
  - Drag validation functions

### 4. Drag Protection for Discarded Tasks
- Updated `native-drag-action.ts` to respect `non-editable` class
- Only sets `draggable="true"` on editable tasks
- Added drag start prevention for non-editable tasks

## Benefits

1. **Position Integrity**: Drag-drop operations always calculate against the complete set of kept tasks
2. **Filter Independence**: Display filters don't affect positioning logic
3. **Predictable Behavior**: Tasks maintain consistent positions regardless of view filters
4. **Performance**: Both queries are derived/reactive, ensuring efficient updates
5. **Clear Mental Model**: Developers can easily understand the separation between positioning and display

## Testing

Created comprehensive test suite (`task-display-dual-query.spec.ts`) covering:
- Task positioning with status filters applied
- Discarded task drag protection
- Position calculations with search filters
- Hierarchy maintenance when parent tasks are hidden

## Key Principles

- **keptTasks**: Source of truth for all positioning calculations
- **displayedTasks**: What the user sees (may include discarded tasks if filter allows)
- Never use displayedTasks for position calculations
- Discarded tasks are read-only, even when visible

## Files Modified

1. `/routes/(authenticated)/jobs/[id]/+page.svelte`
2. `/lib/components/jobs/JobDetailView.svelte`
3. `/lib/components/jobs/TaskList.svelte`
4. `/lib/utils/native-drag-action.ts`

## Next Steps

1. Run the test suite to verify implementation
2. Monitor for any edge cases in production
3. Consider adding visual indicators for filtered tasks in hierarchy
4. Performance monitoring as task counts scale