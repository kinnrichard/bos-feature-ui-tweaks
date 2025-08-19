import { SvelteSet } from 'svelte/reactivity';
import { shouldShowTask, shouldShowTaskLegacy } from '$lib/stores/taskFilter.svelte';
import { sortTasksInPlace } from '$lib/shared/utils/task-sorting';

// Generic task interface that works with both generated types and position calculator types
export interface BaseTask {
  id: string;
  position?: number;
  repositioned_after_id?: string | null;
  parent_id?: string;
  title?: string;
  status?: string;
  created_at?: string | number;
  updated_at?: string | number;
  discarded_at?: string | null;
  lock_version?: number;
  applies_to_all_targets?: boolean;
  job_id?: string;
  assigned_to_id?: string;
  subtasks_count?: number;
  reordered_at?: string;
}

// Task with subtasks for hierarchical display
export interface HierarchicalTask extends BaseTask {
  subtasks: HierarchicalTask[];
}

// Rendered task item for flattened display
export interface RenderedTaskItem {
  task: HierarchicalTask;
  depth: number;
  hasSubtasks: boolean;
  isExpanded: boolean;
}

// Expansion state management
export class TaskExpansionManager {
  private expandedTasks: SvelteSet<string>;
  private hasAutoExpanded: boolean = false;

  constructor() {
    this.expandedTasks = new SvelteSet<string>();
  }

  isExpanded(taskId: string): boolean {
    return this.expandedTasks.has(taskId);
  }

  toggle(taskId: string): void {
    if (this.expandedTasks.has(taskId)) {
      this.expandedTasks.delete(taskId);
    } else {
      this.expandedTasks.add(taskId);
    }
  }

  expand(taskId: string): void {
    this.expandedTasks.add(taskId);
  }

  collapse(taskId: string): void {
    this.expandedTasks.delete(taskId);
  }

  // Auto-expand all tasks with subtasks (only once on initial load)
  autoExpandAll(hierarchicalTasks: HierarchicalTask[]): void {
    if (hierarchicalTasks.length > 0 && !this.hasAutoExpanded) {
      this.expandAllTasksWithSubtasks(hierarchicalTasks);
      this.hasAutoExpanded = true;
    }
  }

  private expandAllTasksWithSubtasks(taskList: HierarchicalTask[]): void {
    taskList.forEach(task => {
      if (task.subtasks && task.subtasks.length > 0) {
        this.expandedTasks.add(task.id);
        // Recursively expand subtasks that also have children
        this.expandAllTasksWithSubtasks(task.subtasks);
      }
    });
  }

  reset(): void {
    this.expandedTasks.clear();
    this.hasAutoExpanded = false;
  }
}

/**
 * TaskHierarchyManager - Handles task organization and hierarchical rendering
 * 
 * Responsibilities:
 * - Organize flat task list into hierarchical structure
 * - Apply filtering to hierarchical tasks
 * - Flatten hierarchical structure for UI rendering
 * - Manage expansion/collapse state
 */
export class TaskHierarchyManager {
  private expansionManager: TaskExpansionManager;

  constructor() {
    this.expansionManager = new TaskExpansionManager();
  }

  /**
   * Get the expansion manager for direct access to expansion state
   */
  getExpansionManager(): TaskExpansionManager {
    return this.expansionManager;
  }

  /**
   * Organize tasks into hierarchical structure with filtering (using TaskFilterManager)
   * 
   * @param taskList - Flat list of tasks
   * @param filterManager - TaskFilterManager instance to handle filtering
   * @returns Hierarchical task structure
   */
  organizeTasksHierarchicallyWithFilter(
    taskList: BaseTask[], 
    shouldShowTaskFn: (task: BaseTask) => boolean
  ): HierarchicalTask[] {
    // Use the filter function to determine which tasks to include
    const tasksToInclude = new Set<string>();
    
    // Find all tasks that pass the filter
    taskList.forEach(task => {
      if (shouldShowTaskFn(task)) {
        this.includeTaskAndAncestorsFromList(task.id, taskList, tasksToInclude);
      }
    });
    
    // Build hierarchy from included tasks
    return this.buildHierarchyFromIncludedList(taskList, tasksToInclude);
  }

  /**
   * Organize tasks into hierarchical structure with filtering (legacy method)
   * 
   * @param taskList - Flat list of tasks
   * @param filterStatuses - Array of statuses to show
   * @param showDeleted - Whether to show deleted tasks
   * @returns Hierarchical task structure
   */
  organizeTasksHierarchically(
    taskList: BaseTask[], 
    filterStatuses: string[], 
    showDeleted: boolean
  ): HierarchicalTask[] {
    // Pass 1: Build task relationships
    const taskMap = new Map<string, HierarchicalTask>();
    const childrenMap = new Map<string, Set<string>>(); // parent_id -> Set of child ids
    
    taskList.forEach((task) => {
      taskMap.set(task.id, {
        ...task,
        subtasks: []
      });
      
      // Build reverse lookup for children
      if (task.parent_id) {
        if (!childrenMap.has(task.parent_id)) {
          childrenMap.set(task.parent_id, new Set());
        }
        childrenMap.get(task.parent_id)!.add(task.id);
      }
    });

    // Pass 2: Identify all tasks to include (with hierarchical context)
    const tasksToInclude = this.findTasksToInclude(
      taskList, 
      taskMap, 
      childrenMap, 
      filterStatuses, 
      showDeleted
    );

    // Pass 3: Build hierarchical structure from included tasks
    return this.buildHierarchyFromIncluded(taskList, taskMap, tasksToInclude);
  }

  /**
   * Find all tasks that should be included in the hierarchy based on filtering rules
   * Implements hierarchical filtering: if a child matches, include all ancestors
   */
  private findTasksToInclude(
    taskList: BaseTask[],
    taskMap: Map<string, HierarchicalTask>,
    childrenMap: Map<string, Set<string>>,
    filterStatuses: string[],
    showDeleted: boolean
  ): Set<string> {
    const tasksToInclude = new Set<string>();
    
    // Find direct matches first
    const directMatches = taskList.filter(task => 
      shouldShowTaskLegacy(task, filterStatuses, showDeleted)
    );
    
    // For each direct match, include the task and all its ancestors
    directMatches.forEach(task => {
      this.includeTaskAndAncestors(task.id, taskMap, tasksToInclude);
    });
    
    return tasksToInclude;
  }
  
  /**
   * Include a task and all its ancestors in the hierarchy
   */
  private includeTaskAndAncestors(
    taskId: string, 
    taskMap: Map<string, HierarchicalTask>, 
    tasksToInclude: Set<string>
  ): void {
    const task = taskMap.get(taskId);
    if (!task) return;
    
    // Include this task
    tasksToInclude.add(taskId);
    
    // Recursively include parent if it exists
    if (task.parent_id) {
      this.includeTaskAndAncestors(task.parent_id, taskMap, tasksToInclude);
    }
  }

  /**
   * Include a task and all its ancestors in the hierarchy (for TaskFilterManager integration)
   */
  private includeTaskAndAncestorsFromList(
    taskId: string, 
    taskList: BaseTask[], 
    tasksToInclude: Set<string>
  ): void {
    const task = taskList.find(t => t.id === taskId);
    if (!task) return;
    
    // Include this task
    tasksToInclude.add(taskId);
    
    // Recursively include parent if it exists
    if (task.parent_id) {
      this.includeTaskAndAncestorsFromList(task.parent_id, taskList, tasksToInclude);
    }
  }
  
  /**
   * Build the final hierarchical structure from the set of included tasks
   */
  private buildHierarchyFromIncluded(
    taskList: BaseTask[],
    taskMap: Map<string, HierarchicalTask>,
    tasksToInclude: Set<string>
  ): HierarchicalTask[] {
    const rootTasks: HierarchicalTask[] = [];
    
    // Reset subtasks for all included tasks
    tasksToInclude.forEach(taskId => {
      const task = taskMap.get(taskId);
      if (task) {
        task.subtasks = [];
      }
    });
    
    // Build hierarchy from included tasks only
    taskList.forEach(task => {
      if (!tasksToInclude.has(task.id)) {
        return; // Skip tasks not in our include set
      }
      
      const taskWithSubtasks = taskMap.get(task.id)!;
      
      // Defensive check: Skip self-referencing tasks
      if (task.parent_id === task.id) {
        console.error(`[TaskHierarchy] Task ${task.id} has self-reference, treating as root task`);
        rootTasks.push(taskWithSubtasks);
        return;
      }
      
      if (task.parent_id && tasksToInclude.has(task.parent_id)) {
        // Add to parent if parent is also included
        const parent = taskMap.get(task.parent_id)!;
        parent.subtasks.push(taskWithSubtasks);
      } else {
        // This is a root task (no parent or parent not included)
        rootTasks.push(taskWithSubtasks);
      }
    });
    
    // Sort root tasks by position
    sortTasksInPlace(rootTasks);
    
    // Sort subtasks by position for each parent
    this.sortSubtasks(rootTasks);
    
    return rootTasks;
  }

  /**
   * Build the final hierarchical structure from the set of included tasks (for TaskFilterManager integration)
   */
  private buildHierarchyFromIncludedList(
    taskList: BaseTask[],
    tasksToInclude: Set<string>
  ): HierarchicalTask[] {
    const taskMap = new Map<string, HierarchicalTask>();
    const rootTasks: HierarchicalTask[] = [];
    
    // Create task map for included tasks only
    taskList.forEach(task => {
      if (tasksToInclude.has(task.id)) {
        taskMap.set(task.id, {
          ...task,
          subtasks: []
        });
      }
    });
    
    // Build hierarchy from included tasks only
    taskList.forEach(task => {
      if (!tasksToInclude.has(task.id)) {
        return; // Skip tasks not in our include set
      }
      
      const taskWithSubtasks = taskMap.get(task.id)!;
      
      // Defensive check: Skip self-referencing tasks
      if (task.parent_id === task.id) {
        console.error(`[TaskHierarchy] Task ${task.id} has self-reference, treating as root task`);
        rootTasks.push(taskWithSubtasks);
        return;
      }
      
      if (task.parent_id && tasksToInclude.has(task.parent_id)) {
        // Add to parent if parent is also included
        const parent = taskMap.get(task.parent_id)!;
        parent.subtasks.push(taskWithSubtasks);
      } else {
        // This is a root task (no parent or parent not included)
        rootTasks.push(taskWithSubtasks);
      }
    });
    
    // Sort root tasks by position
    sortTasksInPlace(rootTasks);
    
    // Sort subtasks by position for each parent
    this.sortSubtasks(rootTasks);
    
    return rootTasks;
  }
  
  /**
   * Recursively sort subtasks by position
   */
  private sortSubtasks(tasks: HierarchicalTask[]): void {
    tasks.forEach(task => {
      if (task.subtasks && task.subtasks.length > 0) {
        sortTasksInPlace(task.subtasks);
        this.sortSubtasks(task.subtasks);
      }
    });
  }

  /**
   * Flatten hierarchical tasks for rendering
   * 
   * @param hierarchicalTasks - Hierarchical task structure
   * @returns Flattened array of rendered task items
   */
  flattenTasks(hierarchicalTasks: HierarchicalTask[]): RenderedTaskItem[] {
    return hierarchicalTasks.flatMap(task => this.renderTaskTree(task, 0));
  }

  /**
   * Recursive function to render task tree
   * 
   * @param task - Task to render
   * @param depth - Current depth in hierarchy
   * @returns Array of rendered task items
   */
  private renderTaskTree(task: HierarchicalTask, depth: number): RenderedTaskItem[] {
    const result: RenderedTaskItem[] = [];
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const isExpanded = this.expansionManager.isExpanded(task.id);

    result.push({
      task,
      depth,
      hasSubtasks,
      isExpanded
    });

    if (hasSubtasks && isExpanded) {
      for (const subtask of task.subtasks) {
        result.push(...this.renderTaskTree(subtask, depth + 1));
      }
    }

    return result;
  }

  /**
   * Auto-expand all tasks with subtasks on initial load
   */
  autoExpandAll(hierarchicalTasks: HierarchicalTask[]): void {
    this.expansionManager.autoExpandAll(hierarchicalTasks);
  }

  /**
   * Toggle expansion state of a task
   */
  toggleExpansion(taskId: string): void {
    this.expansionManager.toggle(taskId);
  }

  /**
   * Check if a task is expanded
   */
  isTaskExpanded(taskId: string): boolean {
    return this.expansionManager.isExpanded(taskId);
  }

  /**
   * Force expand a task (used for drag-and-drop nesting)
   */
  expandTask(taskId: string): void {
    this.expansionManager.expand(taskId);
  }

  /**
   * Get flat list of task IDs in visual order
   */
  getFlatTaskIds(renderedTasks: RenderedTaskItem[]): string[] {
    return renderedTasks.map(item => item.task.id);
  }

  /**
   * Reset all expansion state
   */
  resetExpansion(): void {
    this.expansionManager.reset();
  }

  /**
   * Simple method to organize tasks hierarchically without any filtering
   * Used for position calculations where we need all tasks regardless of filters
   * 
   * @param taskList - Flat list of tasks
   * @returns Hierarchical task structure with all tasks included
   */
  organizeTasksSimple(taskList: BaseTask[]): HierarchicalTask[] {
    // Build task map
    const taskMap = new Map<string, HierarchicalTask>();
    
    taskList.forEach((task) => {
      taskMap.set(task.id, {
        ...task,
        subtasks: []
      });
    });

    // Build hierarchy
    const rootTasks: HierarchicalTask[] = [];
    
    taskList.forEach((task) => {
      const hierarchicalTask = taskMap.get(task.id)!;
      
      // Defensive check: Skip self-referencing tasks
      if (task.parent_id === task.id) {
        console.error(`[TaskHierarchy] Task ${task.id} has self-reference, treating as root task`);
        rootTasks.push(hierarchicalTask);
        return;
      }
      
      if (task.parent_id && taskMap.has(task.parent_id)) {
        // Add as child to parent
        const parent = taskMap.get(task.parent_id)!;
        parent.subtasks.push(hierarchicalTask);
      } else {
        // No parent or parent not in list - treat as root
        rootTasks.push(hierarchicalTask);
      }
    });

    // Sort tasks at each level
    sortTasksInPlace(rootTasks);
    this.sortSubtasks(rootTasks);
    
    return rootTasks;
  }
}