/**
 * FrontSyncLog - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for front_sync_logs table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveFrontSyncLog instead:
 * ```typescript
 * import { ReactiveFrontSyncLog as FrontSyncLog } from './reactive-front-sync-log';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  FrontSyncLogData,
  CreateFrontSyncLogData,
  UpdateFrontSyncLogData,
} from './types/front-sync-log-data';

/**
 * Default values for FrontSyncLog creation
 * These defaults match the database schema defaults
 */
const FrontSyncLogDefaults: Partial<CreateFrontSyncLogData> = {
  error_messages: '{}',
  metadata: {},
  records_created: 0,
  records_failed: 0,
  records_synced: 0,
  records_updated: 0,
  status: 'running',
  sync_type: 'full',
};

/**
 * ActiveRecord configuration for FrontSyncLog
 */
const FrontSyncLogConfig = {
  tableName: 'front_sync_logs',
  className: 'FrontSyncLog',
  primaryKey: 'id',
  supportsDiscard: false,
  defaults: FrontSyncLogDefaults,
};

/**
 * FrontSyncLog ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const front_sync_log = await FrontSyncLog.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const front_sync_log = await FrontSyncLog.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newFrontSyncLog = await FrontSyncLog.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedFrontSyncLog = await FrontSyncLog.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await FrontSyncLog.discard('123');
 *
 * // Restore discarded
 * await FrontSyncLog.undiscard('123');
 *
 * // Query with scopes
 * const allFrontSyncLogs = await FrontSyncLog.all().all();
 * const activeFrontSyncLogs = await FrontSyncLog.kept().all();
 * ```
 */
export const FrontSyncLog = createActiveRecord<FrontSyncLogData>(FrontSyncLogConfig);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type { FrontSyncLogData, CreateFrontSyncLogData, UpdateFrontSyncLogData };

// Default export
export default FrontSyncLog;
