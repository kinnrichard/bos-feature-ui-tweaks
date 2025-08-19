import { createFilterStore, type FilterOption } from '$lib/utils/createFilterStore.svelte';

// Task status filter options
export const taskStatusOptions: FilterOption[] = [
  { id: 'new_task', value: 'new_task', label: 'New' },
  { id: 'in_progress', value: 'in_progress', label: 'In Progress' },
  { id: 'paused', value: 'paused', label: 'Paused' },
  { id: 'successfully_completed', value: 'successfully_completed', label: 'Completed' },
  { id: 'cancelled', value: 'cancelled', label: 'Cancelled' },
];

// Create task status filter store with deleted support
export const taskStatusFilter = createFilterStore({
  filterKey: 'statuses',
  options: taskStatusOptions,
  defaultSelected: [], // No filters selected by default (shows all)
  supportDeleted: true,
  deletedKey: 'showDeleted',
});

// Task search store (kept separate as it's not a filter)
export const taskSearch = $state({
  searchQuery: '' as string,
  searchFields: ['title', 'description'] as ('title' | 'description')[],
});

// Combined filter function for tasks
export function shouldShowTask(task: {
  title?: string;
  description?: string;
  status?: string;
  discarded_at?: string | null;
}): boolean {
  // Apply search filter
  if (taskSearch.searchQuery.trim().length > 0) {
    const query = taskSearch.searchQuery.toLowerCase();
    let matchesSearch = false;

    for (const field of taskSearch.searchFields) {
      const fieldValue = task[field];
      if (fieldValue && typeof fieldValue === 'string') {
        if (fieldValue.toLowerCase().includes(query)) {
          matchesSearch = true;
          break;
        }
      }
    }

    if (!matchesSearch) return false;
  }

  // Apply status and deleted filters using the filter store
  const filteredTasks = taskStatusFilter.getFilteredItems(
    [task],
    (item) => item.status,
    (item) => item.discarded_at
  );

  return filteredTasks.length > 0;
}

// Actions for managing task filters
export const taskFilterActions = {
  setStatuses: (statuses: string[]) => {
    taskStatusFilter.setSelected(statuses);
  },

  setShowDeleted: (showDeleted: boolean) => {
    taskStatusFilter.setShowDeleted(showDeleted);
  },

  clearFilters: () => {
    taskStatusFilter.clearFilters();
  },

  toggleStatus: (status: string) => {
    const currentStatuses = taskStatusFilter.selected;
    const index = currentStatuses.indexOf(status);
    if (index === -1) {
      taskStatusFilter.setSelected([...currentStatuses, status]);
    } else {
      taskStatusFilter.setSelected(currentStatuses.filter((s) => s !== status));
    }
  },

  toggleDeleted: () => {
    taskStatusFilter.setShowDeleted(!taskStatusFilter.showDeleted);
  },

  setSearchQuery: (query: string) => {
    taskSearch.searchQuery = query;
  },

  clearSearch: () => {
    taskSearch.searchQuery = '';
  },
};

// Helper functions for accessing reactive filter state
export function getFilterSummary(): string[] {
  const summary: string[] = [];

  // Deleted filter summary - show first since it overrides status
  if (taskStatusFilter.showDeleted) {
    summary.push('Showing deleted tasks');
  } else {
    // Status filter summary - only show when not viewing deleted
    if (taskStatusFilter.hasActiveFilters && taskStatusFilter.selected.length > 0) {
      const statusCount = taskStatusFilter.selected.length;
      summary.push(`Status: ${statusCount} selected`);
    }
  }

  // Search filter summary
  if (taskSearch.searchQuery.trim().length > 0) {
    summary.push(`Search: "${taskSearch.searchQuery}"`);
  }

  return summary;
}

// Compatibility layer for existing code
export const taskFilter = {
  get selectedStatuses() {
    return taskStatusFilter.selected;
  },
  get showDeleted() {
    return taskStatusFilter.showDeleted;
  },
  get searchQuery() {
    return taskSearch.searchQuery;
  },
  get searchFields() {
    return taskSearch.searchFields;
  },
  set selectedStatuses(value: string[]) {
    taskStatusFilter.setSelected(value);
  },
  set showDeleted(value: boolean) {
    taskStatusFilter.setShowDeleted(value);
  },
  set searchQuery(value: string) {
    taskSearch.searchQuery = value;
  },
  set searchFields(value: ('title' | 'description')[]) {
    taskSearch.searchFields = value;
  },
};

// Legacy compatibility function (to be removed after migration)
export function shouldShowTaskLegacy(
  task: { discarded_at?: string | null; status?: string },
  statuses: string[],
  showDeleted: boolean = false
): boolean {
  // Check if task is discarded (soft deleted) - use discarded_at field
  const isDiscarded = !!task.discarded_at;

  // If showDeleted is false, exclude discarded tasks
  if (!showDeleted && isDiscarded) return false;

  // If showDeleted is true, only show discarded tasks (ignore status filter)
  if (showDeleted && !isDiscarded) return false;

  // Status filter - only apply when NOT showing deleted tasks
  if (!showDeleted) {
    // If no status filters selected, show all tasks (that match deletion filter)
    if (statuses.length === 0) return true;

    // Task status is now stored as string, compare directly
    return statuses.includes(task.status);
  }

  // If showing deleted, ignore status filter
  return true;
}

// Filter function - returns a function that checks if a task should be visible
export function getTaskFilterFunction() {
  return (task: {
    title?: string;
    description?: string;
    status?: string;
    discarded_at?: string | null;
  }) => shouldShowTask(task);
}

// DEPRECATED: Use taskPermissions store instead
// Kept for backward compatibility during migration
export const taskFilterCapabilities = {
  get canCreateTasks(): boolean {
    console.warn(
      'taskFilterCapabilities.canCreateTasks is deprecated. Use taskPermissionHelpers.canCreateTasks instead.'
    );
    return !taskStatusFilter.showDeleted;
  },

  get canEditTasks(): boolean {
    console.warn(
      'taskFilterCapabilities.canEditTasks is deprecated. Use taskPermissionHelpers.canEditTasks instead.'
    );
    return !taskStatusFilter.showDeleted;
  },
};
