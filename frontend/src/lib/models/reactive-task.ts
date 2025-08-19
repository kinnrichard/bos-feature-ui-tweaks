/**
 * ReactiveTask - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for tasks table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use Task instead:
 * ```typescript
 * import { Task } from './task';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type { TaskData, CreateTaskData, UpdateTaskData } from './types/task-data';
import { registerModelRelationships } from './base/scoped-query-base';

/**
 * ReactiveRecord configuration for Task
 */
const ReactiveTaskConfig = {
  tableName: 'tasks',
  className: 'ReactiveTask',
  primaryKey: 'id',
  supportsDiscard: true,
};

/**
 * ReactiveTask ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveTask } from '$lib/models/reactive-task';
 *
 *   // Reactive query - automatically updates when data changes
 *   const taskQuery = ReactiveTask.find('123');
 *
 *   // Access reactive data
 *   $: task = taskQuery.data;
 *   $: isLoading = taskQuery.isLoading;
 *   $: error = taskQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if task}
 *   <p>{task.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allTasksQuery = ReactiveTask.all().all();
 * const activeTasksQuery = ReactiveTask.kept().all();
 * const singleTaskQuery = ReactiveTask.find('123');
 *
 * // With relationships
 * const taskWithRelationsQuery = ReactiveTask
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredTasksQuery = ReactiveTask
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * const discardedTasks = await Task.discarded().all();
 * ```
 */
export const ReactiveTask = createReactiveRecord<TaskData>(ReactiveTaskConfig);

// Epic-009: Register model relationships for includes() functionality
registerModelRelationships('tasks', {
  job: { type: 'belongsTo', model: 'Job' },
  assignedTo: { type: 'belongsTo', model: 'User' },
  parent: { type: 'belongsTo', model: 'Task' },
  repositionedAfter: { type: 'belongsTo', model: 'Task' },
  client: { type: 'hasOne', model: 'Client' },
  nextRepositionedTask: { type: 'hasOne', model: 'Task' },
  notes: { type: 'hasMany', model: 'Note' },
  activityLogs: { type: 'hasMany', model: 'ActivityLog' },
  subtasks: { type: 'hasMany', model: 'Task' },
});

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveTask as Task } from './reactive-task';
 *
 * // Use like ActiveRecord but with reactive queries
 * const taskQuery = Task.find('123');
 * ```
 */
export { ReactiveTask as Task };

// Export types for convenience
export type { TaskData, CreateTaskData, UpdateTaskData };

// Default export
export default ReactiveTask;
