/**
 * ScheduledDateTimeUser - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for scheduled_date_time_users table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveScheduledDateTimeUser instead:
 * ```typescript
 * import { ReactiveScheduledDateTimeUser as ScheduledDateTimeUser } from './reactive-scheduled-date-time-user';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  ScheduledDateTimeUserData,
  CreateScheduledDateTimeUserData,
  UpdateScheduledDateTimeUserData,
} from './types/scheduled-date-time-user-data';

/**
 * ActiveRecord configuration for ScheduledDateTimeUser
 */
const ScheduledDateTimeUserConfig = {
  tableName: 'scheduled_date_time_users',
  className: 'ScheduledDateTimeUser',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ScheduledDateTimeUser ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const scheduled_date_time_user = await ScheduledDateTimeUser.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const scheduled_date_time_user = await ScheduledDateTimeUser.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newScheduledDateTimeUser = await ScheduledDateTimeUser.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedScheduledDateTimeUser = await ScheduledDateTimeUser.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await ScheduledDateTimeUser.discard('123');
 *
 * // Restore discarded
 * await ScheduledDateTimeUser.undiscard('123');
 *
 * // Query with scopes
 * const allScheduledDateTimeUsers = await ScheduledDateTimeUser.all().all();
 * const activeScheduledDateTimeUsers = await ScheduledDateTimeUser.kept().all();
 * ```
 */
export const ScheduledDateTimeUser = createActiveRecord<ScheduledDateTimeUserData>(
  ScheduledDateTimeUserConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type {
  ScheduledDateTimeUserData,
  CreateScheduledDateTimeUserData,
  UpdateScheduledDateTimeUserData,
};

// Default export
export default ScheduledDateTimeUser;
