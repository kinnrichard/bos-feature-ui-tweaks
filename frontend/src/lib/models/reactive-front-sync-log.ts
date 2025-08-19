/**
 * ReactiveFrontSyncLog - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for front_sync_logs table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use FrontSyncLog instead:
 * ```typescript
 * import { FrontSyncLog } from './front-sync-log';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  FrontSyncLogData,
  CreateFrontSyncLogData,
  UpdateFrontSyncLogData,
} from './types/front-sync-log-data';

/**
 * ReactiveRecord configuration for FrontSyncLog
 */
const ReactiveFrontSyncLogConfig = {
  tableName: 'front_sync_logs',
  className: 'ReactiveFrontSyncLog',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveFrontSyncLog ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveFrontSyncLog } from '$lib/models/reactive-front-sync-log';
 *
 *   // Reactive query - automatically updates when data changes
 *   const front_sync_logQuery = ReactiveFrontSyncLog.find('123');
 *
 *   // Access reactive data
 *   $: front_sync_log = front_sync_logQuery.data;
 *   $: isLoading = front_sync_logQuery.isLoading;
 *   $: error = front_sync_logQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if front_sync_log}
 *   <p>{front_sync_log.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allFrontSyncLogsQuery = ReactiveFrontSyncLog.all().all();
 * const activeFrontSyncLogsQuery = ReactiveFrontSyncLog.kept().all();
 * const singleFrontSyncLogQuery = ReactiveFrontSyncLog.find('123');
 *
 * // With relationships
 * const front_sync_logWithRelationsQuery = ReactiveFrontSyncLog
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredFrontSyncLogsQuery = ReactiveFrontSyncLog
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveFrontSyncLog = createReactiveRecord<FrontSyncLogData>(
  ReactiveFrontSyncLogConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveFrontSyncLog as FrontSyncLog } from './reactive-front-sync-log';
 *
 * // Use like ActiveRecord but with reactive queries
 * const front_sync_logQuery = FrontSyncLog.find('123');
 * ```
 */
export { ReactiveFrontSyncLog as FrontSyncLog };

// Export types for convenience
export type { FrontSyncLogData, CreateFrontSyncLogData, UpdateFrontSyncLogData };

// Default export
export default ReactiveFrontSyncLog;
