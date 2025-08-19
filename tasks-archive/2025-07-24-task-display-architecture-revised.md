# Task Display Architecture: Dual Query Pattern (Revised)

## Problem Statement

The current task management system faces a critical architectural challenge:

1. **Positioning Integrity**: When users drag-and-drop tasks, position calculations must consider ALL non-discarded tasks, regardless of current filters
2. **Display Flexibility**: Users need to filter tasks by status, search terms, or deletion state without breaking positioning logic
3. **Data Consistency**: Filtered tasks must maintain their correct positions relative to hidden tasks

Currently, mixing display filtering with positioning logic creates bugs where:
- Dragging a task in a filtered view can cause incorrect positioning
- Position calculations become inconsistent when tasks are hidden by filters
- The system cannot distinguish between "hidden by filter" and "deleted"

## Architecture Overview

### Core Concept: Separation of Concerns

We implement a **dual query pattern** that cleanly separates:
- **`keptTasks`**: All non-discarded tasks (for positioning calculations)
- **`displayedTasks`**: Subset of keptTasks that match current filters (for UI rendering)

### Data Flow

```
Job.tasks (from API)
    ↓
keptTasks = tasks.filter(t => !t.discarded_at)
    ↓
displayedTasks = keptTasks.filter(shouldShowTask)
    ↓
TaskList Component
    ├── Uses keptTasks for position calculations
    └── Uses displayedTasks for rendering
```

## Implementation Details

### 1. Job Detail Page Updates

```typescript
// src/routes/(authenticated)/jobs/[id]/+page.svelte

import { shouldShowTask } from '$lib/stores/taskFilter.svelte';

// All non-discarded tasks (for positioning)
const keptTasks = $derived(job?.tasks?.filter(t => !t.discarded_at) || []);

// Filtered tasks (for display)
const displayedTasks = $derived(keptTasks.filter(shouldShowTask));

// Task statistics based on displayed tasks
const taskBatchDetails = $derived(displayedTasks.length > 0 ? {
  total: displayedTasks.length,
  completed: displayedTasks.filter(task => task.status === 'completed').length,
  pending: displayedTasks.filter(task => task.status === 'pending').length,
  in_progress: displayedTasks.filter(task => task.status === 'in_progress').length
} : undefined);
```

### 2. TaskList Component Interface

```typescript
// src/lib/components/jobs/TaskList.svelte

interface Props {
  tasks: TaskData[];        // displayedTasks - what to render
  allTasks: TaskData[];     // keptTasks - for position calculations
  jobId: string;
  batchTaskDetails?: TaskBatchDetails;
}

// Usage in job detail page
<JobDetailView 
  job={{...job, tasks: displayedTasks}} 
  allTasks={keptTasks}
  batchTaskDetails={taskBatchDetails} 
  {notes} 
  notesLoading={notesLoading} 
/>
```

### 3. Position Calculation Updates

```typescript
// In TaskList component
import { calculatePosition, type PositionConfig } from '$lib/services/positioning';

// Configuration for integer-based positioning with randomization
const positionConfig: PositionConfig = {
  defaultSpacing: 10000,
  initialPosition: 10000,
  enableRandomization: true,
  randomRangePercent: 0.5
};

// Use allTasks (keptTasks) for position calculations
function calculateDropPosition(draggedTask: Task, targetTask: Task): {
  position: number;
  repositionedAfterId: string | null;
} {
  // Build hierarchy using ALL kept tasks, not just displayed ones
  const taskHierarchy = buildHierarchy(allTasks);
  
  // Find the actual previous and next tasks in the full hierarchy
  const { prevTask, nextTask } = findSurroundingTasks(
    targetTask, 
    taskHierarchy,
    allTasks
  );
  
  // Calculate position with randomization for collision avoidance
  const position = calculatePosition(
    prevTask?.position ?? null,
    nextTask?.position ?? null,
    positionConfig
  );
  
  // Set repositioned_after_id for server-side validation
  const repositionedAfterId = prevTask?.id ?? null;
  
  return { position, repositionedAfterId };
}

// Visual order map uses allTasks for consistency
const visualOrderMap = $derived(
  createVisualOrderMap(allTasks)
);
```

### 4. Drag-Drop Handler Modifications

```typescript
async function handleDrop(event: DragEvent, targetTask: Task) {
  const draggedTaskId = event.dataTransfer?.getData('taskId');
  const draggedTask = allTasks.find(t => t.id === draggedTaskId);
  
  if (!draggedTask) return;
  
  // Calculate new position using allTasks for complete context
  const { position, repositionedAfterId } = calculateDropPosition(
    draggedTask, 
    targetTask
  );
  
  // Update task with integer position and tracking fields
  await updateTaskPosition(draggedTask.id, {
    position: Math.floor(position), // Ensure integer
    repositioned_after_id: repositionedAfterId,
    reordered_at: new Date().toISOString() // UTC timestamp
  });
  
  // The update will trigger a re-query, maintaining consistency
}
```

### 5. Position Service Integration

```typescript
// Leverage existing position calculation service
import { calculatePosition } from '$lib/services/positioning';

// The service handles:
// - Integer-based positioning
// - Randomization within middle 50% of gap
// - Negative positions for top-of-list (when prevPosition is null)
// - Default spacing for end-of-list
// - Collision avoidance through randomization
```

## Benefits

1. **Position Integrity**: Drag-drop operations always calculate against the complete set of kept tasks
2. **Filter Independence**: Display filters don't affect positioning logic
3. **Predictable Behavior**: Tasks maintain consistent positions regardless of view filters
4. **Performance**: Both queries are derived/reactive, ensuring efficient updates
5. **Clear Mental Model**: Developers can easily understand the separation between positioning and display
6. **Collision Avoidance**: Integer randomization reduces conflicts in offline/concurrent scenarios

## Trade-offs

1. **Memory Usage**: Maintaining two task arrays (though displayedTasks is a subset)
2. **Complexity**: Components need to be aware of both contexts
3. **Props Drilling**: Need to pass both task arrays through component hierarchy

## Migration Strategy

### Phase 1: Implement Dual Queries
1. Update job detail page to create both `keptTasks` and `displayedTasks`
2. Pass both to JobDetailView component
3. Ensure existing functionality continues to work

### Phase 2: Update TaskList Component
1. Add `allTasks` prop to TaskList
2. Update position calculations to use `allTasks`
3. Continue using `tasks` prop for rendering
4. Ensure integer positions are maintained

### Phase 3: Update Drag-Drop Logic
1. Modify drag-drop handlers to use `allTasks` for calculations
2. Update visual order mapping to handle negative positions
3. Integrate with existing position service
4. Test with various filter combinations

### Phase 4: Optimize and Refine
1. Add visual indicators for filtered tasks in hierarchy
2. Implement performance optimizations if needed
3. Add comprehensive test coverage
4. Monitor for position collision patterns

## Testing Strategy

1. **Unit Tests**
   - Test `keptTasks` filtering logic
   - Test `displayedTasks` with various filter combinations
   - Test position calculations with hidden tasks
   - Verify integer positions and randomization

2. **Integration Tests**
   - Drag-drop with filters applied
   - Filter changes during drag operation
   - Position persistence across filter toggles
   - Concurrent positioning with randomization

3. **E2E Tests**
   - User workflow: filter tasks, drag-drop, remove filter
   - Verify positions remain consistent
   - Test offline positioning scenarios
   - Validate server-side position reconciliation

## Key Implementation Notes

1. **Integer Positions**: All positions are integers, no decimal/fractional values
2. **Randomization**: Positions are randomized within middle 50% of available gap
3. **Negative Positions**: Tasks can have negative positions when placed at top
4. **No Special UUIDs**: System uses standard task IDs, no NIL_UUID or magic values
5. **Server Reconciliation**: `repositioned_after_id` helps server validate positioning intent

## Future Considerations

1. **Virtual Scrolling**: If task lists grow large, consider virtual scrolling that works with both queries
2. **Position Indicators**: Show visual hints where filtered tasks exist in hierarchy
3. **Bulk Operations**: Ensure bulk operations respect the dual query pattern
4. **Performance Monitoring**: Track query performance as task counts scale
5. **Offline Indicators**: Show which positions were calculated offline and may be reconciled

## Conclusion

The dual query pattern provides a clean, maintainable solution to the positioning vs. display challenge. By clearly separating `keptTasks` (positioning context) from `displayedTasks` (rendering context), we achieve both data integrity and user interface flexibility.

This architecture ensures that drag-drop operations remain predictable and correct, regardless of what filters users apply to their task view, while leveraging the production system's integer-based positioning with randomization for improved offline and concurrent operation support.