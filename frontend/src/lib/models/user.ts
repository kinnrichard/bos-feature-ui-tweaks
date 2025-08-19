/**
 * User - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for users table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveUser instead:
 * ```typescript
 * import { ReactiveUser as User } from './reactive-user';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type { UserData, CreateUserData, UpdateUserData } from './types/user-data';
import { registerModelRelationships } from './base/scoped-query-base';

/**
 * Default values for User creation
 * These defaults match the database schema defaults
 */
const UserDefaults: Partial<CreateUserData> = {
  resort_tasks_on_status_change: true,
};

/**
 * ActiveRecord configuration for User
 */
const UserConfig = {
  tableName: 'users',
  className: 'User',
  primaryKey: 'id',
  supportsDiscard: false,
  defaults: UserDefaults,
};

/**
 * User ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const user = await User.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const user = await User.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newUser = await User.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedUser = await User.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await User.discard('123');
 *
 * // Restore discarded
 * await User.undiscard('123');
 *
 * // Query with scopes
 * const allUsers = await User.all().all();
 * const activeUsers = await User.kept().all();
 * ```
 */
export const User = createActiveRecord<UserData>(UserConfig);

// Epic-009: Register model relationships for includes() functionality
registerModelRelationships('users', {
  activityLogs: { type: 'hasMany', model: 'ActivityLog' },
  assignedJobs: { type: 'hasMany', model: 'Job' },
  assignedTasks: { type: 'hasMany', model: 'Task' },
  jobAssignments: { type: 'hasMany', model: 'JobAssignment' },
  technicianJobs: { type: 'hasMany', model: 'Job' },
  scheduledDateTimeUsers: { type: 'hasMany', model: 'ScheduledDateTimeUser' },
  scheduledDateTimes: { type: 'hasMany', model: 'ScheduledDateTime' },
  notes: { type: 'hasMany', model: 'Note' },
});

// Export types for convenience
export type { UserData, CreateUserData, UpdateUserData };

// Default export
export default User;
