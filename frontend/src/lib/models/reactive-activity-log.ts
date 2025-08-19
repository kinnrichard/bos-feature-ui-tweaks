/**
 * ReactiveActivityLog - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for activity_logs table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use ActivityLog instead:
 * ```typescript
 * import { ActivityLog } from './activity-log';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  ActivityLogData,
  CreateActivityLogData,
  UpdateActivityLogData,
} from './types/activity-log-data';
import { registerModelRelationships } from './base/scoped-query-base';
import { declarePolymorphicRelationships } from '../zero/polymorphic';

/**
 * ReactiveRecord configuration for ActivityLog
 */
const ReactiveActivityLogConfig = {
  tableName: 'activity_logs',
  className: 'ReactiveActivityLog',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveActivityLog ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveActivityLog } from '$lib/models/reactive-activity-log';
 *
 *   // Reactive query - automatically updates when data changes
 *   const activity_logQuery = ReactiveActivityLog.find('123');
 *
 *   // Access reactive data
 *   $: activity_log = activity_logQuery.data;
 *   $: isLoading = activity_logQuery.isLoading;
 *   $: error = activity_logQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if activity_log}
 *   <p>{activity_log.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allActivityLogsQuery = ReactiveActivityLog.all().all();
 * const activeActivityLogsQuery = ReactiveActivityLog.kept().all();
 * const singleActivityLogQuery = ReactiveActivityLog.find('123');
 *
 * // With relationships
 * const activity_logWithRelationsQuery = ReactiveActivityLog
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredActivityLogsQuery = ReactiveActivityLog
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveActivityLog = createReactiveRecord<ActivityLogData>(ReactiveActivityLogConfig);

// EP-0036: Polymorphic relationship declarations
declarePolymorphicRelationships({
  tableName: 'activity_logs',
  belongsTo: {
    loggable: {
      typeField: 'loggable_type',
      idField: 'loggable_id',
      allowedTypes: [
        'client',
        'device',
        'job',
        'peoplegroup',
        'peoplegroupmembership',
        'person',
        'scheduleddatetime',
        'task',
        'user',
      ],
    },
  },
});

// Epic-009: Register model relationships for includes() functionality
registerModelRelationships('activity_logs', {
  user: { type: 'belongsTo', model: 'User' },
  client: { type: 'belongsTo', model: 'Client' },
  job: { type: 'belongsTo', model: 'Job' },
});

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveActivityLog as ActivityLog } from './reactive-activity-log';
 *
 * // Use like ActiveRecord but with reactive queries
 * const activity_logQuery = ActivityLog.find('123');
 * ```
 */
export { ReactiveActivityLog as ActivityLog };

// Export types for convenience
export type { ActivityLogData, CreateActivityLogData, UpdateActivityLogData };

// Default export
export default ReactiveActivityLog;
