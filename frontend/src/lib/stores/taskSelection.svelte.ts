export interface TaskSelectionState {
  selectedTaskIds: Set<string>;
  selectionOrder: string[]; // Track the order in which tasks were selected
  lastSelectedTaskId: string | null;
  isMultiSelectActive: boolean;
}

// Task selection state - proper Svelte 5 pattern
export const taskSelection = $state<TaskSelectionState>({
  selectedTaskIds: new Set(),
  selectionOrder: [],
  lastSelectedTaskId: null,
  isMultiSelectActive: false
});

// Derived values for common use cases - functions to get current values
export function getSelectedTaskIds(): string[] {
  return Array.from(taskSelection.selectedTaskIds);
}

export function getSelectedTaskCount(): number {
  return taskSelection.selectedTaskIds.size;
}

export function getIsMultiSelectActive(): boolean {
  return taskSelection.isMultiSelectActive;
}

export function getHasSelection(): boolean {
  return taskSelection.selectedTaskIds.size > 0;
}

export function getFirstSelectedTaskId(): string | null {
  return taskSelection.selectionOrder.length > 0 ? taskSelection.selectionOrder[0] : null;
}

export function getSelectionOrder(): string[] {
  return [...taskSelection.selectionOrder];
}

// Task selection actions
export const taskSelectionActions = {
  /**
   * Select a single task (clears other selections)
   */
  selectTask: (taskId: string) => {
    taskSelection.selectedTaskIds = new Set([taskId]);
    taskSelection.selectionOrder = [taskId];
    taskSelection.lastSelectedTaskId = taskId;
    taskSelection.isMultiSelectActive = false;
  },

  /**
   * Toggle task selection (for multi-select)
   */
  toggleTask: (taskId: string) => {
    const newSelection = new Set(taskSelection.selectedTaskIds);
    const newOrder = [...taskSelection.selectionOrder];
    
    if (newSelection.has(taskId)) {
      // Remove from selection
      newSelection.delete(taskId);
      const orderIndex = newOrder.indexOf(taskId);
      if (orderIndex !== -1) {
        newOrder.splice(orderIndex, 1);
      }
    } else {
      // Add to selection (append to end of order)
      newSelection.add(taskId);
      newOrder.push(taskId);
    }
    
    taskSelection.selectedTaskIds = newSelection;
    taskSelection.selectionOrder = newOrder;
    taskSelection.lastSelectedTaskId = taskId;
    taskSelection.isMultiSelectActive = newSelection.size > 1;
  },

  /**
   * Handle shift+click for range selection
   */
  handleRangeSelect: (taskId: string, allTaskIds: string[]) => {
    if (!taskSelection.lastSelectedTaskId) {
      // No previous selection, treat as normal select
      taskSelectionActions.selectTask(taskId);
      return;
    }

    const currentIndex = allTaskIds.indexOf(taskId);
    const lastIndex = allTaskIds.indexOf(taskSelection.lastSelectedTaskId);

    if (currentIndex === -1 || lastIndex === -1) {
      // Fallback to single selection
      taskSelectionActions.selectTask(taskId);
      return;
    }

    // Select range between last and current
    const startIndex = Math.min(currentIndex, lastIndex);
    const endIndex = Math.max(currentIndex, lastIndex);
    const rangeIds = allTaskIds.slice(startIndex, endIndex + 1);

    taskSelection.selectedTaskIds = new Set(rangeIds);
    taskSelection.selectionOrder = rangeIds; // Range selection maintains DOM order
    taskSelection.lastSelectedTaskId = taskId;
    taskSelection.isMultiSelectActive = rangeIds.length > 1;
  },

  /**
   * Handle ctrl/cmd+click for multi-select
   */
  handleMultiSelect: (taskId: string) => {
    taskSelectionActions.toggleTask(taskId);
  },

  /**
   * Select all tasks
   */
  selectAll: (allTaskIds: string[]) => {
    taskSelection.selectedTaskIds = new Set(allTaskIds);
    taskSelection.selectionOrder = [...allTaskIds]; // Maintain DOM order for select all
    taskSelection.lastSelectedTaskId = allTaskIds[allTaskIds.length - 1] || null;
    taskSelection.isMultiSelectActive = allTaskIds.length > 1;
  },

  /**
   * Clear all selections
   */
  clearSelection: () => {
    taskSelection.selectedTaskIds = new Set();
    taskSelection.selectionOrder = [];
    taskSelection.lastSelectedTaskId = null;
    taskSelection.isMultiSelectActive = false;
  },

  /**
   * Check if a task is selected
   */
  isTaskSelected: (taskId: string): boolean => {
    return taskSelection.selectedTaskIds.has(taskId);
  }
};