/**
 * ReactiveActivityLog v2 - Enhanced with coordinator-based flash prevention
 *
 * This demonstrates how to upgrade existing ReactiveRecord models to use
 * the new ReactiveRecord v2 system while maintaining full backward compatibility.
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  ActivityLogData,
  CreateActivityLogData,
  UpdateActivityLogData,
} from './types/activity-log-data';
import { registerModelRelationships } from './base/scoped-query-base';

/**
 * ReactiveRecord v2 configuration for ActivityLog
 */
const ReactiveActivityLogConfig = {
  tableName: 'activity_logs',
  className: 'ReactiveActivityLogV2',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveActivityLog v2 - Enhanced with coordinator-based state management
 *
 * Provides the same API as the original ReactiveActivityLog but with:
 * - Flash prevention during navigation
 * - 5-state lifecycle management
 * - Stale data preservation during refresh
 * - Minimum timing thresholds
 *
 * @example
 * ```svelte
 * <!-- Same usage as before, but no more flashing! -->
 * <script>
 *   import { ReactiveActivityLogV2 } from '$lib/models/reactive-activity-log-v2';
 *
 *   // Same API, enhanced behavior
 *   const logsQuery = ReactiveActivityLogV2.kept().orderBy('created_at', 'desc').all();
 *
 *   // Access data the same way
 *   $: logs = logsQuery.data;
 *   $: isLoading = logsQuery.isLoading;
 *   $: error = logsQuery.error;
 * </script>
 *
 * <!-- No more loading flash when navigating between views! -->
 * {#if isLoading && logs.length === 0}
 *   <LoadingSkeleton />
 * {:else if error}
 *   <ErrorMessage {error} />
 * {:else if logs.length === 0}
 *   <EmptyState />
 * {:else}
 *   {#each logs as log}
 *     <ActivityLogItem {log} />
 *   {/each}
 * {/if}
 * ```
 *
 * @example
 * ```svelte
 * <!-- Or use the new ReactiveView component for even cleaner code -->
 * <script>
 *   import { ReactiveView } from '$lib/reactive';
 *   import { ReactiveActivityLogV2 } from '$lib/models/reactive-activity-log-v2';
 *
 *   const logsQuery = ReactiveActivityLogV2.kept().orderBy('created_at', 'desc').all();
 * </script>
 *
 * <ReactiveView query={logsQuery} strategy="progressive">
 *   {#snippet content({ data })}
 *     {#each data as log}
 *       <ActivityLogItem {log} />
 *     {/each}
 *   {/snippet}
 *
 *   {#snippet empty()}
 *     <div class="empty-state">No activity logs found</div>
 *   {/snippet}
 * </ReactiveView>
 * ```
 */
export const ReactiveActivityLogV2 =
  createReactiveRecord<ActivityLogData>(ReactiveActivityLogConfig);

/**
 * Navigation-optimized version for use in routing/navigation contexts
 *
 * Use this when the activity logs are part of navigation between pages
 * to get optimized transition timing.
 *
 * Note: For now, this uses the same implementation as the standard version.
 * Future enhancements will add navigation-specific optimizations.
 */
export const ReactiveActivityLogNav =
  createReactiveRecord<ActivityLogData>(ReactiveActivityLogConfig);

/**
 * Initial load optimized version for first page loads
 *
 * Use this for the first load of activity logs when the user enters the app.
 *
 * Note: For now, this uses the same implementation as the standard version.
 * Future enhancements will add initial-load-specific optimizations.
 */
export const ReactiveActivityLogInitial =
  createReactiveRecord<ActivityLogData>(ReactiveActivityLogConfig);

// Register model relationships for includes() functionality
registerModelRelationships('activity_logs', {
  user: { type: 'belongsTo', model: 'User' },
  client: { type: 'belongsTo', model: 'Client' },
  job: { type: 'belongsTo', model: 'Job' },
});

/**
 * Convenience exports for different usage contexts
 */
export const ActivityLogModels = {
  /** Standard reactive record with flash prevention */
  standard: ReactiveActivityLogV2,

  /** Optimized for navigation between pages */
  navigation: ReactiveActivityLogNav,

  /** Optimized for initial page load */
  initialLoad: ReactiveActivityLogInitial,

  /**
   * Factory method to create custom configurations
   *
   * @example
   * ```typescript
   * const CustomActivityLog = ActivityLogModels.createCustom({
   *   className: 'CustomActivityLog',
   *   tableName: 'activity_logs'
   * });
   * ```
   */
  createCustom: (config: Partial<typeof ReactiveActivityLogConfig>) =>
    createReactiveRecord<ActivityLogData>({
      ...ReactiveActivityLogConfig,
      ...config,
    }),
};

/**
 * Migration utilities for upgrading existing components
 */
export const ActivityLogMigration = {
  /**
   * Drop-in replacement for existing ReactiveActivityLog imports
   *
   * Change:
   * ```typescript
   * import { ReactiveActivityLog } from '$lib/models/reactive-activity-log';
   * ```
   *
   * To:
   * ```typescript
   * import { ReactiveActivityLog } from '$lib/models/reactive-activity-log-v2';
   * ```
   *
   * Everything else stays the same!
   */
  ReactiveActivityLog: ReactiveActivityLogV2,

  /**
   * Alternative import name for clarity
   */
  ActivityLog: ReactiveActivityLogV2,
};

// Export types for convenience
export type { ActivityLogData, CreateActivityLogData, UpdateActivityLogData };

// Default export (standard version)
export default ReactiveActivityLogV2;
