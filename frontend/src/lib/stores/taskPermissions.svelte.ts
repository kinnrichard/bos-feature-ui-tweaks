// Task permission types
export type TaskPermission = 
  | 'create'
  | 'edit'
  | 'delete'
  | 'rename'
  | 'move'
  | 'changeStatus'
  | 'assignUser'
  | 'addSubtask';

// Permission context for evaluating permissions
interface PermissionContext {
  task?: any;
  filterState?: {
    showDeleted: boolean;
  };
}

// Getter function for filter state to avoid circular dependency
let getFilterState: () => { showDeleted: boolean } = () => ({ showDeleted: false });

// Function to set the filter state getter (called during app initialization)
export function setFilterStateGetter(getter: () => { showDeleted: boolean }) {
  getFilterState = getter;
}

// Centralized permission system for task operations
class TaskPermissionSystem {
  // Check if a specific permission is allowed
  hasPermission(permission: TaskPermission, context: PermissionContext = {}): boolean {
    const filterState = context.filterState || getFilterState();
    const task = context.task;

    // Global rules based on filter state
    if (filterState.showDeleted) {
      // When viewing deleted tasks, most operations are disabled
      const allowedInDeletedView: TaskPermission[] = [];
      if (!allowedInDeletedView.includes(permission)) {
        return false;
      }
    }

    // Task-specific rules
    if (task) {
      // Prevent any modifications on deleted tasks
      if (task.discarded_at) {
        const allowedOnDeletedTasks: TaskPermission[] = [];
        if (!allowedOnDeletedTasks.includes(permission)) {
          return false;
        }
      }

      // Additional task state checks can go here
      // e.g., locked tasks, archived tasks, etc.
    }

    // Permission-specific rules
    switch (permission) {
      case 'create':
        // Can't create tasks when viewing deleted items
        return !filterState.showDeleted;
      
      case 'edit':
      case 'rename':
        // Can't edit when viewing deleted or if task is deleted
        if (filterState.showDeleted) return false;
        if (task?.discarded_at) return false;
        return true;
      
      case 'delete':
        // Can delete non-deleted tasks
        if (task?.discarded_at) return false;
        return !filterState.showDeleted;
      
      case 'move':
      case 'changeStatus':
      case 'assignUser':
      case 'addSubtask':
        // These operations are not allowed on deleted tasks or when viewing deleted
        if (filterState.showDeleted) return false;
        if (task?.discarded_at) return false;
        return true;
      
      default:
        // Default to denying unknown permissions
        return false;
    }
  }

  // Batch check multiple permissions
  hasPermissions(permissions: TaskPermission[], context: PermissionContext = {}): Record<TaskPermission, boolean> {
    const result: Partial<Record<TaskPermission, boolean>> = {};
    for (const permission of permissions) {
      result[permission] = this.hasPermission(permission, context);
    }
    return result as Record<TaskPermission, boolean>;
  }

  // Get all permissions for a context
  getAllPermissions(context: PermissionContext = {}): Record<TaskPermission, boolean> {
    const allPermissions: TaskPermission[] = [
      'create', 'edit', 'delete', 'rename', 'move', 
      'changeStatus', 'assignUser', 'addSubtask'
    ];
    return this.hasPermissions(allPermissions, context);
  }

  // Get a human-readable reason why a permission is denied
  getPermissionDenialReason(permission: TaskPermission, context: PermissionContext = {}): string | null {
    const filterState = context.filterState || getFilterState();
    const task = context.task;

    // Check if permission is allowed first
    if (this.hasPermission(permission, context)) {
      return null;
    }

    // Provide specific denial reasons
    if (filterState.showDeleted) {
      return "This action is not available when viewing deleted tasks";
    }

    if (task?.discarded_at) {
      return "This action cannot be performed on deleted tasks";
    }

    // Generic denial reason
    return "You don't have permission to perform this action";
  }
}

// Export singleton instance
export const taskPermissions = new TaskPermissionSystem();

// Reactive helpers for Svelte components
export const taskPermissionHelpers = {
  // Check if user can create tasks in current context
  get canCreateTasks(): boolean {
    return taskPermissions.hasPermission('create');
  },

  // Check if user can edit tasks in current context
  get canEditTasks(): boolean {
    return taskPermissions.hasPermission('edit');
  },

  // Check if user can delete tasks in current context
  get canDeleteTasks(): boolean {
    return taskPermissions.hasPermission('delete');
  },

  // Check if a specific task can be edited
  canEditTask(task: any): boolean {
    return taskPermissions.hasPermission('edit', { task });
  },

  // Check if a specific task can be deleted
  canDeleteTask(task: any): boolean {
    return taskPermissions.hasPermission('delete', { task });
  },

  // Check if a specific task's status can be changed
  canChangeStatus(task: any): boolean {
    return taskPermissions.hasPermission('changeStatus', { task });
  },

  // Get permissions for a specific task
  getTaskPermissions(task: any): Record<TaskPermission, boolean> {
    return taskPermissions.getAllPermissions({ task });
  }
};