/**
 * Task - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for tasks table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveTask instead:
 * ```typescript
 * import { ReactiveTask as Task } from './reactive-task';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type { TaskData, CreateTaskData, UpdateTaskData } from './types/task-data';
import { registerModelRelationships } from './base/scoped-query-base';

/**
 * Default values for Task creation
 * These defaults match the database schema defaults
 */
const TaskDefaults: Partial<CreateTaskData> = {
  applies_to_all_targets: true,
  lock_version: 0,
  position_finalized: false,
  repositioned_to_top: false,
  subtasks_count: 0,
};

/**
 * ActiveRecord configuration for Task
 */
const TaskConfig = {
  tableName: 'tasks',
  className: 'Task',
  primaryKey: 'id',
  supportsDiscard: true,
  defaults: TaskDefaults,
};

/**
 * Task ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const task = await Task.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const task = await Task.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newTask = await Task.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedTask = await Task.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await Task.discard('123');
 *
 * // Restore discarded
 * await Task.undiscard('123');
 *
 * // Query with scopes
 * const allTasks = await Task.all().all();
 * const activeTasks = await Task.kept().all();
 * const discardedTasks = await Task.discarded().all();
 * ```
 */
export const Task = createActiveRecord<TaskData>(TaskConfig);

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

// Export types for convenience
export type { TaskData, CreateTaskData, UpdateTaskData };

// Default export
export default Task;
