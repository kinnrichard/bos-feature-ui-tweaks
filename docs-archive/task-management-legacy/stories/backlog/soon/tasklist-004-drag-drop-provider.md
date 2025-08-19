# TASKLIST-004: Drag & Drop Provider

## Story Details

### TASKLIST-004: Drag & Drop Provider
**Points**: 5  
**Type**: Technical Refactoring  
**Priority**: Critical  
**Epic**: TaskList Component Refactoring  
**Depends on**: TASKLIST-001, TASKLIST-002, TASKLIST-003  

**As a** developer  
**I want** to extract complex drag & drop logic into a reusable provider pattern  
**So that** drag operations are modular, testable, and can be reused across components

**Acceptance Criteria:**
- [ ] Create `DragDropProvider.svelte` for drag state management
- [ ] Extract position calculation logic into utilities
- [ ] Create `TaskDropZone.svelte` for drop target detection
- [ ] Implement `DragPreview.svelte` for visual feedback during drag
- [ ] Support both task reordering and nesting operations
- [ ] Handle multi-select drag operations
- [ ] Preserve all existing drag & drop functionality
- [ ] Use Svelte 5 runes for state management
- [ ] Implement optimistic updates with rollback capability
- [ ] Support touch devices (tablets)
- [ ] Visual indicators for valid/invalid drop zones
- [ ] Integration with existing native-drag-action utility
- [ ] Error handling and user feedback
- [ ] Performance optimization for large task lists

**Technical Implementation:**

**1. DragDropProvider Component (Context Provider):**
```svelte
<!-- lib/components/dragdrop/DragDropProvider.svelte -->
<script lang="ts">
  import { setContext } from 'svelte';
  import { nativeDrag, addDropIndicator, addNestHighlight, clearAllVisualFeedback } from '$lib/utils/native-drag-action';
  import type { DragSortEvent, DragMoveEvent } from '$lib/utils/native-drag-action';
  import { dragAndDrop } from '$lib/stores/dragAndDrop.svelte';
  import { taskSelection } from '$lib/stores/taskSelection.svelte';
  import { taskOperations } from '$lib/stores/taskOperations.svelte';
  import type { Task, DropZoneInfo } from '$lib/types/task';

  interface Props {
    tasks: Task[];
    onTaskReorder: (event: DragSortEvent) => Promise<void>;
    onTaskNesting: (draggedTaskId: string, targetTaskId: string) => Promise<void>;
    children: any;
  }

  let { tasks, onTaskReorder, onTaskNesting, children }: Props = $props();

  let dragActionInstance: any;
  let tasksContainer: HTMLElement;

  // Drag & Drop Context API
  const dragContext = {
    isDragging: () => dragAndDrop.isDragging,
    draggedTaskId: () => dragAndDrop.draggedTaskId,
    startDrag: (taskId: string) => handleDragStart(taskId),
    endDrag: () => handleDragEnd(),
    setFeedback: (message: string) => dragAndDrop.setFeedback(message)
  };

  setContext('dragdrop', dragContext);

  // Initialize drag action when container is available
  $effect(() => {
    if (tasksContainer) {
      dragActionInstance = nativeDrag(tasksContainer, {
        onStart: handleSortStart,
        onEnd: handleSortEnd,
        onSort: onTaskReorder,
        onMove: handleMoveDetection
      });
    }

    return () => {
      if (dragActionInstance) {
        dragActionInstance.destroy?.();
      }
    };
  });

  // Update drag action when tasks change
  $effect(() => {
    if (dragActionInstance && tasks.length > 0) {
      dragActionInstance.update({
        onStart: handleSortStart,
        onEnd: handleSortEnd,
        onSort: onTaskReorder,
        onMove: handleMoveDetection
      });
    }
  });

  function handleDragStart(taskId: string) {
    dragAndDrop.startDrag(taskId);
    
    // If dragging a non-selected task, select it
    if (!taskSelection.isSelected(taskId)) {
      taskSelection.selectTask(taskId);
    }
  }

  function handleDragEnd() {
    dragAndDrop.endDrag();
    clearAllVisualFeedback();
  }

  function handleSortStart(event: any) {
    const taskId = event.item.dataset.taskId;
    if (taskId) {
      handleDragStart(taskId);
    }
  }

  function handleSortEnd(event: any) {
    handleDragEnd();
  }

  function handleMoveDetection(event: DragMoveEvent) {
    // Clear previous feedback
    clearAllVisualFeedback();

    const draggedTaskId = dragAndDrop.draggedTaskId;
    if (!draggedTaskId) return;

    const dropZone = detectDropZone(event);
    
    if (dropZone) {
      if (dropZone.mode === 'nest') {
        addNestHighlight(dropZone.targetElement);
        dragAndDrop.setFeedback(`Nest under "${dropZone.targetTask?.title}"`);
      } else if (dropZone.mode === 'reorder') {
        addDropIndicator(dropZone.targetElement, dropZone.position);
        dragAndDrop.setFeedback('Reorder task');
      }
    } else {
      dragAndDrop.setFeedback('Invalid drop zone');
    }
  }

  function detectDropZone(event: DragMoveEvent): DropZoneInfo | null {
    const targetElement = event.target;
    const taskElement = targetElement.closest('.task-item');
    
    if (!taskElement) return null;

    const targetTaskId = taskElement.dataset.taskId;
    const targetTask = tasks.find(t => t.id === targetTaskId);
    
    if (!targetTask || !dragAndDrop.draggedTaskId) return null;

    // Validate drop operation
    const validation = validateDropOperation(dragAndDrop.draggedTaskId, targetTaskId);
    if (!validation.valid) return null;

    // Determine drop mode based on cursor position
    const rect = taskElement.getBoundingClientRect();
    const mouseY = event.clientY;
    const elementCenter = rect.top + rect.height / 2;
    const nestThreshold = rect.height * 0.3; // 30% of task height

    if (Math.abs(mouseY - elementCenter) < nestThreshold) {
      // Close to center - nesting operation
      return {
        mode: 'nest',
        targetTaskId,
        targetTask,
        targetElement: taskElement as HTMLElement,
        position: 'center'
      };
    } else {
      // Near edges - reordering operation
      return {
        mode: 'reorder',
        targetTaskId,
        targetTask,
        targetElement: taskElement as HTMLElement,
        position: mouseY < elementCenter ? 'before' : 'after'
      };
    }
  }

  function validateDropOperation(draggedTaskId: string, targetTaskId: string): { valid: boolean; reason?: string } {
    if (draggedTaskId === targetTaskId) {
      return { valid: false, reason: 'Cannot drop task on itself' };
    }

    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    const targetTask = tasks.find(t => t.id === targetTaskId);

    if (!draggedTask || !targetTask) {
      return { valid: false, reason: 'Invalid task reference' };
    }

    // Check for circular dependency
    if (wouldCreateCircularDependency(draggedTaskId, targetTaskId)) {
      return { valid: false, reason: 'Would create circular dependency' };
    }

    // Check nesting depth limit
    const targetDepth = getTaskDepth(targetTaskId);
    if (targetDepth >= 3) { // Max 3 levels deep
      return { valid: false, reason: 'Maximum nesting depth reached' };
    }

    return { valid: true };
  }

  function wouldCreateCircularDependency(draggedTaskId: string, targetTaskId: string): boolean {
    // Check if target task is a descendant of dragged task
    function isDescendant(parentId: string, childId: string): boolean {
      const children = tasks.filter(t => t.parent_id === parentId);
      
      for (const child of children) {
        if (child.id === childId) return true;
        if (isDescendant(child.id, childId)) return true;
      }
      
      return false;
    }

    return isDescendant(draggedTaskId, targetTaskId);
  }

  function getTaskDepth(taskId: string): number {
    let depth = 0;
    let currentTask = tasks.find(t => t.id === taskId);
    
    while (currentTask?.parent_id) {
      depth++;
      currentTask = tasks.find(t => t.id === currentTask?.parent_id);
    }
    
    return depth;
  }
</script>

<div bind:this={tasksContainer} class="drag-drop-container">
  {@render children()}
</div>

{#if dragAndDrop.feedback}
  <div class="drag-feedback">
    {dragAndDrop.feedback}
  </div>
{/if}

<style>
  .drag-drop-container {
    position: relative;
  }

  .drag-feedback {
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--border-primary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    font-size: 12px;
    max-width: 250px;
    pointer-events: none;
  }
</style>
```

**2. Enhanced Drag & Drop Store:**
```typescript
// lib/stores/dragAndDrop.svelte.ts (Enhanced from TASKLIST-001)
import type { Task } from '$lib/types/task';

export class DragAndDropStore {
  isDragging = $state(false);
  draggedTaskId = $state<string | null>(null);
  feedback = $state<string>('');
  draggedTasks = $state<Task[]>([]);
  dropPreviewPosition = $state<{ x: number; y: number } | null>(null);

  // Derived state
  isDraggingMultiple = $derived(this.draggedTasks.length > 1);
  draggedTaskCount = $derived(this.draggedTasks.length);

  startDrag(taskId: string, selectedTasks: Task[] = []) {
    this.isDragging = true;
    this.draggedTaskId = taskId;
    this.draggedTasks = selectedTasks.length > 0 ? selectedTasks : [];
  }

  endDrag() {
    this.isDragging = false;
    this.draggedTaskId = null;
    this.draggedTasks = [];
    this.dropPreviewPosition = null;
    this.clearFeedback();
  }

  setFeedback(message: string) {
    this.feedback = message;
  }

  clearFeedback() {
    this.feedback = '';
  }

  updatePreviewPosition(x: number, y: number) {
    this.dropPreviewPosition = { x, y };
  }

  // Multi-select drag helpers
  addTaskToDrag(task: Task) {
    if (!this.draggedTasks.some(t => t.id === task.id)) {
      this.draggedTasks.push(task);
    }
  }

  removeTaskFromDrag(taskId: string) {
    this.draggedTasks = this.draggedTasks.filter(t => t.id !== taskId);
  }

  isTaskBeingDragged(taskId: string): boolean {
    return this.draggedTaskId === taskId || 
           this.draggedTasks.some(t => t.id === taskId);
  }
}

export const dragAndDrop = new DragAndDropStore();
```

**3. TaskDropZone Component:**
```svelte
<!-- lib/components/dragdrop/TaskDropZone.svelte -->
<script lang="ts">
  import { getContext } from 'svelte';
  import type { Task } from '$lib/types/task';

  interface Props {
    task: Task;
    position: 'before' | 'after' | 'center';
    onDrop: (draggedTaskId: string, targetTaskId: string, position: string) => void;
    children: any;
  }

  let { task, position, onDrop, children }: Props = $props();

  const dragContext = getContext('dragdrop');
  
  let isHovered = $state(false);
  let dropElement: HTMLElement;

  let canAcceptDrop = $derived(() => {
    if (!dragContext?.isDragging() || !dragContext?.draggedTaskId()) return false;
    
    const draggedTaskId = dragContext.draggedTaskId();
    return draggedTaskId !== task.id && validateDrop(draggedTaskId, task.id);
  });

  function validateDrop(draggedTaskId: string, targetTaskId: string): boolean {
    // Add validation logic here
    return draggedTaskId !== targetTaskId;
  }

  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    if (canAcceptDrop) {
      isHovered = true;
    }
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    // Only set to false if we're truly leaving the drop zone
    if (!dropElement?.contains(event.relatedTarget as Node)) {
      isHovered = false;
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (canAcceptDrop) {
      event.dataTransfer!.dropEffect = 'move';
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isHovered = false;
    
    if (canAcceptDrop) {
      const draggedTaskId = dragContext?.draggedTaskId();
      if (draggedTaskId) {
        onDrop(draggedTaskId, task.id, position);
      }
    }
  }
</script>

<div
  bind:this={dropElement}
  class="drop-zone"
  class:can-drop={canAcceptDrop}
  class:hover={isHovered}
  class:position-before={position === 'before'}
  class:position-after={position === 'after'}
  class:position-center={position === 'center'}
  ondragenter={handleDragEnter}
  ondragleave={handleDragLeave}
  ondragover={handleDragOver}
  ondrop={handleDrop}
>
  {@render children()}
</div>

<style>
  .drop-zone {
    position: relative;
    transition: all 0.15s ease;
  }

  .drop-zone.can-drop.hover {
    background-color: var(--accent-blue);
    opacity: 0.1;
  }

  .drop-zone.position-before.hover::before {
    content: '';
    position: absolute;
    top: -2px;
    left: 0;
    right: 0;
    height: 2px;
    background-color: var(--accent-blue);
    z-index: 10;
  }

  .drop-zone.position-after.hover::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    right: 0;
    height: 2px;
    background-color: var(--accent-blue);
    z-index: 10;
  }

  .drop-zone.position-center.hover {
    outline: 2px dashed var(--accent-blue);
    outline-offset: 2px;
  }
</style>
```

**4. DragPreview Component:**
```svelte
<!-- lib/components/dragdrop/DragPreview.svelte -->
<script lang="ts">
  import { dragAndDrop } from '$lib/stores/dragAndDrop.svelte';
  import type { Task } from '$lib/types/task';

  interface Props {
    tasks: Task[];
  }

  let { tasks }: Props = $props();

  let draggedTasks = $derived(() => {
    if (!dragAndDrop.isDragging || !dragAndDrop.draggedTaskId) return [];
    
    if (dragAndDrop.isDraggingMultiple) {
      return dragAndDrop.draggedTasks;
    } else {
      const task = tasks.find(t => t.id === dragAndDrop.draggedTaskId);
      return task ? [task] : [];
    }
  });

  let previewPosition = $derived(dragAndDrop.dropPreviewPosition);
</script>

{#if dragAndDrop.isDragging && previewPosition && draggedTasks.length > 0}
  <div 
    class="drag-preview"
    style:left="{previewPosition.x + 10}px"
    style:top="{previewPosition.y + 10}px"
  >
    {#if draggedTasks.length === 1}
      <div class="preview-item">
        <span class="task-emoji">📋</span>
        <span class="task-title">{draggedTasks[0].title}</span>
      </div>
    {:else}
      <div class="preview-item multi-select">
        <span class="task-emoji">📋</span>
        <span class="task-count">{draggedTasks.length} tasks</span>
      </div>
      <div class="preview-stack">
        {#each draggedTasks.slice(0, 3) as task, index}
          <div 
            class="stack-item" 
            style:transform="translateY({index * 2}px) translateX({index * 2}px)"
          >
            {task.title.slice(0, 20)}...
          </div>
        {/each}
        {#if draggedTasks.length > 3}
          <div class="stack-more">+{draggedTasks.length - 3} more</div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .drag-preview {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 8px 12px;
    max-width: 250px;
  }

  .preview-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--text-primary);
  }

  .task-emoji {
    font-size: 16px;
  }

  .task-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .task-count {
    font-weight: 500;
  }

  .preview-stack {
    margin-top: 4px;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .stack-item {
    padding: 2px 4px;
    background-color: var(--bg-tertiary);
    border-radius: 3px;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .stack-more {
    font-size: 11px;
    color: var(--text-tertiary);
    font-style: italic;
  }
</style>
```

**5. Position Calculator Utilities:**
```typescript
// lib/utils/dragPosition.ts
import type { Task, DropZoneInfo, PositionUpdate } from '$lib/types/task';

export class PositionCalculator {
  static calculateNewPosition(
    draggedTaskId: string,
    targetTaskId: string,
    dropMode: 'before' | 'after' | 'nest',
    tasks: Task[]
  ): PositionUpdate | null {
    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    const targetTask = tasks.find(t => t.id === targetTaskId);

    if (!draggedTask || !targetTask) return null;

    switch (dropMode) {
      case 'nest':
        return this.calculateNestPosition(draggedTask, targetTask, tasks);
      case 'before':
        return this.calculateBeforePosition(draggedTask, targetTask, tasks);
      case 'after':
        return this.calculateAfterPosition(draggedTask, targetTask, tasks);
      default:
        return null;
    }
  }

  private static calculateNestPosition(
    draggedTask: Task,
    targetTask: Task,
    tasks: Task[]
  ): PositionUpdate {
    // Find existing children of target
    const siblings = tasks.filter(t => 
      t.parent_id === targetTask.id && 
      t.id !== draggedTask.id
    );

    const newPosition = siblings.length > 0 
      ? Math.max(...siblings.map(t => t.position || 0)) + 1 
      : 1;

    return {
      id: draggedTask.id,
      position: newPosition,
      parent_id: targetTask.id
    };
  }

  private static calculateBeforePosition(
    draggedTask: Task,
    targetTask: Task,
    tasks: Task[]
  ): PositionUpdate {
    // Find siblings in same parent
    const siblings = tasks.filter(t => 
      t.parent_id === targetTask.parent_id && 
      t.id !== draggedTask.id
    );

    const targetPosition = targetTask.position || 0;
    const newPosition = targetPosition;

    // Shift other tasks as needed
    return {
      id: draggedTask.id,
      position: newPosition,
      parent_id: targetTask.parent_id
    };
  }

  private static calculateAfterPosition(
    draggedTask: Task,
    targetTask: Task,
    tasks: Task[]
  ): PositionUpdate {
    const targetPosition = targetTask.position || 0;
    const newPosition = targetPosition + 1;

    return {
      id: draggedTask.id,
      position: newPosition,
      parent_id: targetTask.parent_id
    };
  }

  // Calculate all position updates needed for a multi-select drag
  static calculateMultiTaskPositions(
    draggedTaskIds: string[],
    targetTaskId: string,
    dropMode: 'before' | 'after' | 'nest',
    tasks: Task[]
  ): PositionUpdate[] {
    const updates: PositionUpdate[] = [];
    
    // Sort dragged tasks by their current visual order
    const sortedTaskIds = this.sortTasksByVisualOrder(draggedTaskIds, tasks);
    
    for (let i = 0; i < sortedTaskIds.length; i++) {
      const taskId = sortedTaskIds[i];
      const update = this.calculateNewPosition(taskId, targetTaskId, dropMode, tasks);
      
      if (update) {
        // Adjust position for subsequent tasks
        if (i > 0) {
          update.position += i;
        }
        updates.push(update);
      }
    }
    
    return updates;
  }

  private static sortTasksByVisualOrder(taskIds: string[], tasks: Task[]): string[] {
    // Create a visual order map based on hierarchy and position
    const visualOrderMap = new Map<string, number>();
    let orderIndex = 0;

    function traverse(parentId: string | null, depth: number = 0) {
      const children = tasks
        .filter(t => t.parent_id === parentId)
        .sort((a, b) => (a.position || 0) - (b.position || 0));

      for (const task of children) {
        visualOrderMap.set(task.id, orderIndex++);
        traverse(task.id, depth + 1);
      }
    }

    traverse(null);

    return taskIds.sort((a, b) => {
      const orderA = visualOrderMap.get(a) || 0;
      const orderB = visualOrderMap.get(b) || 0;
      return orderA - orderB;
    });
  }
}
```

**Migration Strategy:**
1. Create drag & drop components alongside existing implementation
2. Use feature flag to switch between old/new drag logic
3. Test drag operations incrementally (reorder first, then nesting)
4. Verify multi-select drag works correctly
5. Test on touch devices for tablet compatibility

**Testing Strategy:**
- Unit tests for position calculation logic
- Integration tests for drag & drop operations
- Touch device testing on tablets
- Performance tests with large task lists
- Visual tests for drag feedback and indicators

**Acceptance Testing:**
- All existing drag & drop functionality preserved
- Multi-select drag operations work correctly
- Visual feedback matches current implementation
- Touch support works on tablets
- Error handling provides clear user feedback

**Performance Considerations:**
- Debounce drag move events for better performance
- Use virtual scrolling for large task lists
- Optimize position calculations
- Cache drag validation results
- Efficient DOM updates during drag operations

**Dependencies:**
- Requires stores from TASKLIST-001
- Uses TaskItem components from TASKLIST-002
- Integrates with TaskHierarchy from TASKLIST-003
- Needs existing native-drag-action utility
- Uses Task type definitions and API services