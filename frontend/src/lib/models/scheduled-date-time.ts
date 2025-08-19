/**
 * ScheduledDateTime - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for scheduled_date_times table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveScheduledDateTime instead:
 * ```typescript
 * import { ReactiveScheduledDateTime as ScheduledDateTime } from './reactive-scheduled-date-time';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  ScheduledDateTimeData,
  CreateScheduledDateTimeData,
  UpdateScheduledDateTimeData,
} from './types/scheduled-date-time-data';
import { registerModelRelationships } from './base/scoped-query-base';
import { declarePolymorphicRelationships } from '../zero/polymorphic';

/**
 * Default values for ScheduledDateTime creation
 * These defaults match the database schema defaults
 */
const ScheduledDateTimeDefaults: Partial<CreateScheduledDateTimeData> = {
  scheduled_time_set: false,
};

/**
 * ActiveRecord configuration for ScheduledDateTime
 */
const ScheduledDateTimeConfig = {
  tableName: 'scheduled_date_times',
  className: 'ScheduledDateTime',
  primaryKey: 'id',
  supportsDiscard: false,
  defaults: ScheduledDateTimeDefaults,
};

/**
 * ScheduledDateTime ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const scheduled_date_time = await ScheduledDateTime.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const scheduled_date_time = await ScheduledDateTime.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newScheduledDateTime = await ScheduledDateTime.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedScheduledDateTime = await ScheduledDateTime.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await ScheduledDateTime.discard('123');
 *
 * // Restore discarded
 * await ScheduledDateTime.undiscard('123');
 *
 * // Query with scopes
 * const allScheduledDateTimes = await ScheduledDateTime.all().all();
 * const activeScheduledDateTimes = await ScheduledDateTime.kept().all();
 * ```
 */
export const ScheduledDateTime = createActiveRecord<ScheduledDateTimeData>(ScheduledDateTimeConfig);

// EP-0036: Polymorphic relationship declarations
declarePolymorphicRelationships({
  tableName: 'scheduled_date_times',
  belongsTo: {
    schedulable: {
      typeField: 'schedulable_type',
      idField: 'schedulable_id',
      allowedTypes: ['job'],
    },
  },
});

// Epic-009: Register model relationships for includes() functionality
registerModelRelationships('scheduled_date_times', {
  activityLogs: { type: 'hasMany', model: 'ActivityLog' },
  scheduledDateTimeUsers: { type: 'hasMany', model: 'ScheduledDateTimeUser' },
  users: { type: 'hasMany', model: 'User' },
});

// Export types for convenience
export type { ScheduledDateTimeData, CreateScheduledDateTimeData, UpdateScheduledDateTimeData };

// Default export
export default ScheduledDateTime;
