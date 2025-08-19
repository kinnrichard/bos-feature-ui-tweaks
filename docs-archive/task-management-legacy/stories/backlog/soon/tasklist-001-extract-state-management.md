# TASKLIST-001: Extract Task State Management

## Story Details

### TASKLIST-001: Extract Task State Management
**Points**: 3  
**Type**: Technical Refactoring  
**Priority**: Critical  
**Epic**: TaskList Component Refactoring  

**As a** developer  
**I want** to extract task state management from the monolithic TaskList component  
**So that** state logic is reusable, testable, and follows Svelte 5 patterns

**Acceptance Criteria:**
- [ ] Create `taskOperations.svelte.ts` store with Svelte 5 runes
- [ ] Extract CRUD operations with optimistic updates
- [ ] Move task hierarchy organization logic to separate store
- [ ] Create `taskSelection.svelte.ts` for multi-select state
- [ ] Extract `dragAndDrop.svelte.ts` for drag state management
- [ ] Create `taskKeyboardNav.svelte.ts` for keyboard navigation
- [ ] All stores use `$state()`, `$derived()`, and `$effect()` appropriately
- [ ] TypeScript interfaces for all state and operations
- [ ] Error handling and rollback logic preserved
- [ ] Optimistic updates work identically to current implementation
- [ ] Integration tests pass for all CRUD operations

**Technical Implementation:**

**1. Task Operations Store:**
```typescript
// lib/stores/taskOperations.svelte.ts
import { tasksService } from '$lib/api/tasks';
import type { Task } from '$lib/types/task';

class TaskOperationsStore {
  tasks = $state<Task[]>([]);
  isLoading = $state(false);
  error = $state<string | null>(null);
  optimisticUpdates = $state(new Map<string, { originalPosition: number; originalParentId?: string }>());

  // Derived state
  tasksById = $derived(new Map(this.tasks.map(task => [task.id, task])));
  rootTasks = $derived(this.tasks.filter(task => !task.parent_id));
  
  constructor(private jobId: string) {}

  async updateTaskStatus(taskId: string, newStatus: string) {
    const task = this.tasksById.get(taskId);
    if (!task) return;
    
    const originalStatus = task.status;
    
    // Optimistic update
    task.status = newStatus;
    
    try {
      await tasksService.updateTaskStatus(this.jobId, taskId, newStatus);
    } catch (error: any) {
      // Rollback on error
      task.status = originalStatus;
      this.error = 'Failed to update task status - please try again';
      
      // Clear error after delay
      setTimeout(() => this.error = null, 3000);
      throw error;
    }
  }

  async createTask(taskData: Partial<Task>) {
    this.isLoading = true;
    
    try {
      const response = await tasksService.createTask(this.jobId, taskData);
      this.tasks.push(response.task);
      return response.task;
    } catch (error: any) {
      this.error = 'Failed to create task - please try again';
      setTimeout(() => this.error = null, 3000);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  async deleteTask(taskId: string) {
    const taskIndex = this.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;
    
    // Store for potential rollback
    const deletedTask = this.tasks[taskIndex];
    
    // Optimistic removal
    this.tasks.splice(taskIndex, 1);
    
    try {
      await tasksService.deleteTask(this.jobId, taskId);
    } catch (error: any) {
      // Rollback on error
      this.tasks.splice(taskIndex, 0, deletedTask);
      this.error = 'Failed to delete task - please try again';
      setTimeout(() => this.error = null, 3000);
      throw error;
    }
  }

  setTasks(tasks: Task[]) {
    this.tasks = tasks;
  }

  clearError() {
    this.error = null;
  }
}

export function createTaskOperations(jobId: string) {
  return new TaskOperationsStore(jobId);
}
```

**2. Task Selection Store:**
```typescript
// lib/stores/taskSelection.svelte.ts
export class TaskSelectionStore {
  selectedTaskIds = $state(new Set<string>());
  lastSelectedTaskId = $state<string | null>(null);

  // Derived state
  selectedCount = $derived(this.selectedTaskIds.size);
  hasSelection = $derived(this.selectedCount > 0);
  isMultiSelect = $derived(this.selectedCount > 1);

  selectTask(taskId: string) {
    this.selectedTaskIds.clear();
    this.selectedTaskIds.add(taskId);
    this.lastSelectedTaskId = taskId;
  }

  toggleTask(taskId: string) {
    if (this.selectedTaskIds.has(taskId)) {
      this.selectedTaskIds.delete(taskId);
      if (this.lastSelectedTaskId === taskId) {
        this.lastSelectedTaskId = Array.from(this.selectedTaskIds)[0] || null;
      }
    } else {
      this.selectedTaskIds.add(taskId);
      this.lastSelectedTaskId = taskId;
    }
  }

  selectRange(targetTaskId: string, flatTaskIds: string[]) {
    if (!this.lastSelectedTaskId) {
      this.selectTask(targetTaskId);
      return;
    }

    const startIndex = flatTaskIds.indexOf(this.lastSelectedTaskId);
    const endIndex = flatTaskIds.indexOf(targetTaskId);
    
    if (startIndex === -1 || endIndex === -1) return;

    const rangeStart = Math.min(startIndex, endIndex);
    const rangeEnd = Math.max(startIndex, endIndex);
    
    // Clear current selection
    this.selectedTaskIds.clear();
    
    // Select range
    for (let i = rangeStart; i <= rangeEnd; i++) {
      this.selectedTaskIds.add(flatTaskIds[i]);
    }
    
    this.lastSelectedTaskId = targetTaskId;
  }

  clearSelection() {
    this.selectedTaskIds.clear();
    this.lastSelectedTaskId = null;
  }

  isSelected(taskId: string): boolean {
    return this.selectedTaskIds.has(taskId);
  }
}

export const taskSelection = new TaskSelectionStore();
```

**3. Task Hierarchy Store:**
```typescript
// lib/stores/taskHierarchy.svelte.ts
import type { Task } from '$lib/types/task';

export class TaskHierarchyStore {
  expandedTasks = $state(new Set<string>());
  hasAutoExpanded = $state(false);

  // Organize tasks into hierarchical structure with filtering
  organizeHierarchically(tasks: Task[], filterStatuses: string[]) {
    const taskMap = new Map();
    const rootTasks: any[] = [];
    
    // First pass: create map of all tasks
    tasks.forEach(task => {
      taskMap.set(task.id, {
        ...task,
        subtasks: []
      });
    });
    
    // Second pass: organize into hierarchy and apply filtering
    tasks.forEach(task => {
      const taskWithSubtasks = taskMap.get(task.id);
      
      // Apply filter - only include tasks that should be shown
      if (!this.shouldShowTask(task, filterStatuses)) {
        return;
      }
      
      if (task.parent_id && taskMap.has(task.parent_id)) {
        // Only add to parent if parent is also visible
        const parent = taskMap.get(task.parent_id);
        if (this.shouldShowTask(parent, filterStatuses)) {
          parent.subtasks.push(taskWithSubtasks);
        }
      } else {
        rootTasks.push(taskWithSubtasks);
      }
    });
    
    // Sort root tasks by position
    rootTasks.sort((a, b) => (a.position || 0) - (b.position || 0));
    
    // Sort subtasks by position for each parent
    this.sortSubtasks(rootTasks);
    
    return rootTasks;
  }

  private shouldShowTask(task: any, filterStatuses: string[]): boolean {
    // Implement filter logic here
    return filterStatuses.length === 0 || filterStatuses.includes(task.status);
  }

  private sortSubtasks(tasks: any[]) {
    tasks.forEach(task => {
      if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
        this.sortSubtasks(task.subtasks);
      }
    });
  }

  toggleExpansion(taskId: string) {
    if (this.expandedTasks.has(taskId)) {
      this.expandedTasks.delete(taskId);
    } else {
      this.expandedTasks.add(taskId);
    }
  }

  isExpanded(taskId: string): boolean {
    return this.expandedTasks.has(taskId);
  }

  autoExpandAll(hierarchicalTasks: any[]) {
    if (hierarchicalTasks.length > 0 && !this.hasAutoExpanded) {
      this.expandAllTasksWithSubtasks(hierarchicalTasks);
      this.hasAutoExpanded = true;
    }
  }

  private expandAllTasksWithSubtasks(taskList: any[]) {
    taskList.forEach(task => {
      if (task.subtasks && task.subtasks.length > 0) {
        this.expandedTasks.add(task.id);
        this.expandAllTasksWithSubtasks(task.subtasks);
      }
    });
  }
}

export const taskHierarchy = new TaskHierarchyStore();
```

**4. Drag and Drop Store:**
```typescript
// lib/stores/dragAndDrop.svelte.ts
export class DragAndDropStore {
  isDragging = $state(false);
  draggedTaskId = $state<string | null>(null);
  feedback = $state<string>('');

  startDrag(taskId: string) {
    this.isDragging = true;
    this.draggedTaskId = taskId;
  }

  endDrag() {
    this.isDragging = false;
    this.draggedTaskId = null;
    this.clearFeedback();
  }

  setFeedback(message: string) {
    this.feedback = message;
  }

  clearFeedback() {
    this.feedback = '';
    // Clear after delay
    setTimeout(() => this.feedback = '', 2000);
  }
}

export const dragAndDrop = new DragAndDropStore();
```

**5. Keyboard Navigation Store:**
```typescript
// lib/stores/taskKeyboardNav.svelte.ts
import { taskSelection } from './taskSelection.svelte.ts';

export class TaskKeyboardNavStore {
  private flatTaskIds = $state<string[]>([]);

  setTaskIds(taskIds: string[]) {
    this.flatTaskIds = taskIds;
  }

  navigateUp() {
    if (taskSelection.selectedCount !== 1) return;
    
    const currentTaskId = Array.from(taskSelection.selectedTaskIds)[0];
    const currentIndex = this.flatTaskIds.indexOf(currentTaskId);
    
    if (currentIndex === -1) return;
    
    const nextIndex = currentIndex > 0 ? currentIndex - 1 : this.flatTaskIds.length - 1;
    const nextTaskId = this.flatTaskIds[nextIndex];
    
    taskSelection.selectTask(nextTaskId);
    this.scrollTaskIntoView(nextTaskId);
  }

  navigateDown() {
    if (taskSelection.selectedCount !== 1) return;
    
    const currentTaskId = Array.from(taskSelection.selectedTaskIds)[0];
    const currentIndex = this.flatTaskIds.indexOf(currentTaskId);
    
    if (currentIndex === -1) return;
    
    const nextIndex = currentIndex < this.flatTaskIds.length - 1 ? currentIndex + 1 : 0;
    const nextTaskId = this.flatTaskIds[nextIndex];
    
    taskSelection.selectTask(nextTaskId);
    this.scrollTaskIntoView(nextTaskId);
  }

  private scrollTaskIntoView(taskId: string) {
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
    if (taskElement) {
      taskElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

export const taskKeyboardNav = new TaskKeyboardNavStore();
```

**Migration Strategy:**
1. Create stores alongside existing TaskList component
2. Gradually replace direct state access with store usage
3. Test each store individually before integration
4. Maintain backward compatibility during transition
5. Remove old state management code once stores are proven

**Testing Strategy:**
- Unit tests for each store's methods
- Integration tests for store interactions
- E2E tests to verify no behavioral changes
- Performance tests to ensure no regressions

**Rollback Plan:**
- Keep original state management code commented out
- Feature flag to switch between old/new state management
- Comprehensive testing before removing old code

**Dependencies:**
- Requires TypeScript types for Task and related interfaces
- Needs existing tasksService API client
- Uses existing task filtering utilities

**Risk Mitigation:**
- Incremental migration reduces risk of breaking changes
- Comprehensive testing at each step
- Clear interfaces between stores prevent coupling
- Rollback capability if issues arise