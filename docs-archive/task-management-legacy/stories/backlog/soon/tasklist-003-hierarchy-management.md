# TASKLIST-003: Hierarchy Management

## Story Details

### TASKLIST-003: Hierarchy Management
**Points**: 2  
**Type**: Technical Refactoring  
**Priority**: High  
**Epic**: TaskList Component Refactoring  
**Depends on**: TASKLIST-001, TASKLIST-002  

**As a** developer  
**I want** to extract task hierarchy and tree management from the TaskList component  
**So that** task nesting, expansion, and filtering logic is modular and reusable

**Acceptance Criteria:**
- [ ] Create `TaskHierarchy.svelte` component for tree organization
- [ ] Extract tree rendering logic using Svelte 5 snippets
- [ ] Implement task filtering integration with hierarchy
- [ ] Create `TaskTreeRenderer.svelte` for recursive tree display
- [ ] Use `$derived` for hierarchical task organization
- [ ] Maintain auto-expansion functionality for tasks with subtasks
- [ ] Preserve visual indentation and nesting indicators
- [ ] Support dynamic filtering without breaking hierarchy
- [ ] Use stores from TASKLIST-001 for state management
- [ ] Integrate with TaskItem components from TASKLIST-002
- [ ] TypeScript interfaces for tree structures
- [ ] Performance optimization for large task trees

**Technical Implementation:**

**1. TaskHierarchy Component (Main Orchestrator):**
```svelte
<!-- lib/components/tasks/TaskHierarchy.svelte -->
<script lang="ts">
  import type { Task } from '$lib/types/task';
  import { taskHierarchy } from '$lib/stores/taskHierarchy.svelte';
  import { selectedTaskStatuses } from '$lib/stores/taskFilter';
  import TaskTreeRenderer from './TaskTreeRenderer.svelte';

  interface Props {
    tasks: Task[];
    onTaskClick: (event: MouseEvent, taskId: string) => void;
    onTaskKeydown: (event: KeyboardEvent, taskId: string) => void;
    onStatusChange: (taskId: string, newStatus: string) => void;
    onTitleUpdate: (taskId: string, newTitle: string) => void;
  }

  let {
    tasks,
    onTaskClick,
    onTaskKeydown,
    onStatusChange,
    onTitleUpdate
  }: Props = $props();

  // Organize tasks hierarchically with current filter
  let hierarchicalTasks = $derived(
    taskHierarchy.organizeHierarchically(tasks, $selectedTaskStatuses)
  );

  // Auto-expand tasks with subtasks on first load
  $effect(() => {
    taskHierarchy.autoExpandAll(hierarchicalTasks);
  });

  // Flatten tasks for selection and keyboard navigation
  let flattenedTasks = $derived(
    flattenTaskTree(hierarchicalTasks)
  );

  function flattenTaskTree(taskTree: any[], depth = 0): Array<{task: any, depth: number}> {
    const result: Array<{task: any, depth: number}> = [];
    
    for (const task of taskTree) {
      result.push({ task, depth });
      
      if (task.subtasks && task.subtasks.length > 0 && taskHierarchy.isExpanded(task.id)) {
        result.push(...flattenTaskTree(task.subtasks, depth + 1));
      }
    }
    
    return result;
  }

  function handleDisclosureClick(taskId: string) {
    taskHierarchy.toggleExpansion(taskId);
  }
</script>

{#if hierarchicalTasks.length === 0}
  <div class="empty-state">
    <div class="empty-icon">📋</div>
    <h4>No tasks found</h4>
    <p>Tasks will appear here when they match your current filter.</p>
  </div>
{:else}
  <TaskTreeRenderer 
    taskTree={hierarchicalTasks}
    depth={0}
    {onTaskClick}
    {onTaskKeydown}
    {onStatusChange}
    {onTitleUpdate}
    onDisclosureClick={handleDisclosureClick}
  />
{/if}

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
    color: var(--text-tertiary);
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .empty-state h4 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px 0;
  }

  .empty-state p {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0;
  }
</style>
```

**2. TaskTreeRenderer Component (Recursive Tree Display):**
```svelte
<!-- lib/components/tasks/TaskTreeRenderer.svelte -->
<script lang="ts">
  import type { Task } from '$lib/types/task';
  import { taskHierarchy } from '$lib/stores/taskHierarchy.svelte';
  import { taskSelection } from '$lib/stores/taskSelection.svelte';
  import TaskItem from './TaskItem.svelte';

  interface TreeNode {
    id: string;
    title: string;
    status: string;
    subtasks: TreeNode[];
    [key: string]: any;
  }

  interface Props {
    taskTree: TreeNode[];
    depth: number;
    onTaskClick: (event: MouseEvent, taskId: string) => void;
    onTaskKeydown: (event: KeyboardEvent, taskId: string) => void;
    onStatusChange: (taskId: string, newStatus: string) => void;
    onTitleUpdate: (taskId: string, newTitle: string) => void;
    onDisclosureClick: (taskId: string) => void;
  }

  let {
    taskTree,
    depth,
    onTaskClick,
    onTaskKeydown,
    onStatusChange,
    onTitleUpdate,
    onDisclosureClick
  }: Props = $props();
</script>

{#each taskTree as taskNode (taskNode.id)}
  {@const isExpanded = taskHierarchy.isExpanded(taskNode.id)}
  {@const hasSubtasks = taskNode.subtasks && taskNode.subtasks.length > 0}
  {@const isSelected = taskSelection.isSelected(taskNode.id)}
  
  <TaskItem
    task={taskNode}
    {depth}
    {isSelected}
    selectionPosition=""
    showDisclosure={hasSubtasks}
    {isExpanded}
    {onTaskClick}
    {onTaskKeydown}
    onDisclosureClick={() => onDisclosureClick(taskNode.id)}
    {onStatusChange}
    {onTitleUpdate}
  />

  {#if hasSubtasks && isExpanded}
    <svelte:self
      taskTree={taskNode.subtasks}
      depth={depth + 1}
      {onTaskClick}
      {onTaskKeydown}
      {onStatusChange}
      {onTitleUpdate}
      {onDisclosureClick}
    />
  {/if}
{/each}
```

**3. Enhanced TaskHierarchy Store:**
```typescript
// lib/stores/taskHierarchy.svelte.ts (Enhanced from TASKLIST-001)
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
    // If no filters active, show all tasks
    if (filterStatuses.length === 0) return true;
    
    // Show task if its status matches filter
    if (filterStatuses.includes(task.status)) return true;
    
    // Show parent tasks if any children match filter (recursive check)
    if (task.subtasks) {
      return task.subtasks.some((subtask: any) => 
        this.shouldShowTask(subtask, filterStatuses)
      );
    }
    
    return false;
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

  // Get flattened list for keyboard navigation
  getFlattenedTasks(hierarchicalTasks: any[]): string[] {
    const result: string[] = [];
    
    function traverse(tasks: any[]) {
      for (const task of tasks) {
        result.push(task.id);
        
        if (task.subtasks && task.subtasks.length > 0 && this.isExpanded(task.id)) {
          traverse(task.subtasks);
        }
      }
    }
    
    traverse.call(this, hierarchicalTasks);
    return result;
  }

  // Find task path for breadcrumb navigation
  getTaskPath(taskId: string, hierarchicalTasks: any[]): any[] {
    function findPath(tasks: any[], path: any[] = []): any[] | null {
      for (const task of tasks) {
        const currentPath = [...path, task];
        
        if (task.id === taskId) {
          return currentPath;
        }
        
        if (task.subtasks && task.subtasks.length > 0) {
          const found = findPath(task.subtasks, currentPath);
          if (found) return found;
        }
      }
      return null;
    }
    
    return findPath(hierarchicalTasks) || [];
  }

  // Expand path to a specific task
  expandToTask(taskId: string, hierarchicalTasks: any[]) {
    const path = this.getTaskPath(taskId, hierarchicalTasks);
    
    // Expand all parents in the path
    path.slice(0, -1).forEach(task => {
      this.expandedTasks.add(task.id);
    });
  }

  // Collapse all expanded tasks
  collapseAll() {
    this.expandedTasks.clear();
  }

  // Expand all tasks with subtasks
  expandAll(hierarchicalTasks: any[]) {
    this.expandAllTasksWithSubtasks(hierarchicalTasks);
  }
}

export const taskHierarchy = new TaskHierarchyStore();
```

**4. Task Filter Integration:**
```typescript
// lib/stores/taskFilter.svelte.ts (if not already exists)
export const selectedTaskStatuses = $state<string[]>([]);

export function shouldShowTask(task: any, filterStatuses: string[]): boolean {
  if (filterStatuses.length === 0) return true;
  return filterStatuses.includes(task.status);
}

export function addStatusFilter(status: string) {
  if (!selectedTaskStatuses.includes(status)) {
    selectedTaskStatuses.push(status);
  }
}

export function removeStatusFilter(status: string) {
  const index = selectedTaskStatuses.indexOf(status);
  if (index > -1) {
    selectedTaskStatuses.splice(index, 1);
  }
}

export function clearAllFilters() {
  selectedTaskStatuses.length = 0;
}
```

**5. Tree Performance Optimization:**
```svelte
<!-- lib/components/tasks/VirtualizedTaskTree.svelte -->
<script lang="ts">
  // For future enhancement with large task lists
  import { createVirtualizer } from '@tanstack/svelte-virtual';
  
  interface Props {
    tasks: any[];
    height: number;
    itemHeight: number;
  }

  let { tasks, height, itemHeight }: Props = $props();

  const virtualizer = createVirtualizer({
    count: tasks.length,
    getScrollElement: () => container,
    estimateSize: () => itemHeight,
    overscan: 5
  });

  let container: HTMLElement;
</script>

<div bind:this={container} style:height="{height}px" style:overflow="auto">
  <div style:height="{virtualizer.getTotalSize()}px" style:position="relative">
    {#each virtualizer.getVirtualItems() as virtualItem (virtualItem.index)}
      {@const task = tasks[virtualItem.index]}
      <div
        style:position="absolute"
        style:top="0"
        style:left="0"
        style:width="100%"
        style:height="{virtualItem.size}px"
        style:transform="translateY({virtualItem.start}px)"
      >
        <TaskItem {task} depth={task.depth} />
      </div>
    {/each}
  </div>
</div>
```

**Migration Strategy:**
1. Create hierarchy components alongside existing TaskList
2. Use feature flag to switch between old/new hierarchy rendering
3. Test hierarchy organization with various task structures
4. Verify filtering works correctly with nested tasks
5. Ensure performance is maintained with large task trees

**Testing Strategy:**
- Unit tests for hierarchy organization logic
- Test filtering with nested task structures
- Performance tests with large task trees (100+ tasks)
- Visual tests for expansion/collapse animations
- Accessibility tests for tree navigation

**Acceptance Testing:**
- All task nesting relationships preserved
- Filtering works correctly with hierarchical tasks
- Auto-expansion behavior matches current implementation
- Performance is equivalent or better
- Tree navigation is accessible via keyboard

**Performance Considerations:**
- Use `$derived` for reactive hierarchy calculations
- Implement virtual scrolling for large trees (future enhancement)
- Optimize tree traversal algorithms
- Cache flattened task lists for keyboard navigation
- Lazy load subtasks if tree becomes very large

**Dependencies:**
- Requires taskHierarchy store from TASKLIST-001
- Uses TaskItem component from TASKLIST-002
- Needs task filtering functionality
- Uses existing Task type definitions