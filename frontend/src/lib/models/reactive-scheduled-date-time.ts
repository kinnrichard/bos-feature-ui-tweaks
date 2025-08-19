/**
 * ReactiveScheduledDateTime - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for scheduled_date_times table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use ScheduledDateTime instead:
 * ```typescript
 * import { ScheduledDateTime } from './scheduled-date-time';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  ScheduledDateTimeData,
  CreateScheduledDateTimeData,
  UpdateScheduledDateTimeData,
} from './types/scheduled-date-time-data';
import { registerModelRelationships } from './base/scoped-query-base';
import { declarePolymorphicRelationships } from '../zero/polymorphic';

/**
 * ReactiveRecord configuration for ScheduledDateTime
 */
const ReactiveScheduledDateTimeConfig = {
  tableName: 'scheduled_date_times',
  className: 'ReactiveScheduledDateTime',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveScheduledDateTime ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveScheduledDateTime } from '$lib/models/reactive-scheduled-date-time';
 *
 *   // Reactive query - automatically updates when data changes
 *   const scheduled_date_timeQuery = ReactiveScheduledDateTime.find('123');
 *
 *   // Access reactive data
 *   $: scheduled_date_time = scheduled_date_timeQuery.data;
 *   $: isLoading = scheduled_date_timeQuery.isLoading;
 *   $: error = scheduled_date_timeQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if scheduled_date_time}
 *   <p>{scheduled_date_time.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allScheduledDateTimesQuery = ReactiveScheduledDateTime.all().all();
 * const activeScheduledDateTimesQuery = ReactiveScheduledDateTime.kept().all();
 * const singleScheduledDateTimeQuery = ReactiveScheduledDateTime.find('123');
 *
 * // With relationships
 * const scheduled_date_timeWithRelationsQuery = ReactiveScheduledDateTime
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredScheduledDateTimesQuery = ReactiveScheduledDateTime
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveScheduledDateTime = createReactiveRecord<ScheduledDateTimeData>(
  ReactiveScheduledDateTimeConfig
);

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

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveScheduledDateTime as ScheduledDateTime } from './reactive-scheduled-date-time';
 *
 * // Use like ActiveRecord but with reactive queries
 * const scheduled_date_timeQuery = ScheduledDateTime.find('123');
 * ```
 */
export { ReactiveScheduledDateTime as ScheduledDateTime };

// Export types for convenience
export type { ScheduledDateTimeData, CreateScheduledDateTimeData, UpdateScheduledDateTimeData };

// Default export
export default ReactiveScheduledDateTime;
