/**
 * Activity Logging Mutator
 * Integrates with Rails Loggable concern to provide audit trails for frontend operations
 *
 * This mutator automatically creates activity log entries for:
 * - Record creation, updates, and deletions
 * - Status changes with specific handling
 * - Assignment changes with user context
 * - Custom actions with metadata
 */

import { getCurrentUser } from '../../auth/current-user';
import type { MutatorContext, MutatorFunction } from '../base-mutator';
import type { CreateActivityLogData } from '../../models/types/activity-log-data';

/**
 * Interface for records that can be logged (matches Rails Loggable concern)
 */
export interface Loggable {
  id?: string;
  [key: string]: any;
}

/**
 * Activity logging configuration per model
 */
export interface ActivityLoggingConfig {
  /** Model name for loggable_type (e.g., 'Task', 'Job', 'Client') */
  loggableType: string;
  /** Fields to exclude from change tracking (sensitive or unimportant fields) */
  excludeFields?: string[];
  /** Whether to track field-level changes (defaults to true) */
  trackChanges?: boolean;
  /** Custom action mapping for specific operations */
  actionMapping?: Record<string, string>;
  /** Function to determine associated client_id */
  getAssociatedClientId?: (data: any) => string | null | Promise<string | null>;
  /** Function to determine associated job_id */
  getAssociatedJobId?: (data: any) => string | null | Promise<string | null>;
}

/**
 * Default configuration
 */
const DEFAULT_ACTIVITY_LOGGING_CONFIG: Required<
  Omit<ActivityLoggingConfig, 'loggableType' | 'getAssociatedClientId' | 'getAssociatedJobId'>
> = {
  excludeFields: ['updated_at', 'created_at', 'position', 'lock_version', 'reordered_at'],
  trackChanges: true,
  actionMapping: {},
};

// Activity logging mutator data structure - removed as it's not currently used

/**
 * Create activity logging mutator for a specific model
 */
export function createActivityLoggingMutator(
  config: ActivityLoggingConfig
): MutatorFunction<Loggable> {
  const finalConfig = { ...DEFAULT_ACTIVITY_LOGGING_CONFIG, ...config };

  return async (data: Loggable, context: MutatorContext): Promise<Loggable> => {
    console.log(
      `[Activity Logging] Mutator called for ${config.loggableType} with action: ${context.action}`
    );

    // Skip if no authenticated user (can't attribute the action)
    const currentUser = context.user || getCurrentUser();
    if (!currentUser) {
      console.log(`[Activity Logging] Skipping - no current user`);
      return data;
    }

    // Skip during test scenarios if activity logging is disabled
    if (context.environment === 'test' && context.skipActivityLogging) {
      console.log(`[Activity Logging] Skipping - test environment with skipActivityLogging`);
      return data;
    }

    try {
      await logActivity(data, context, finalConfig, currentUser);
    } catch (error) {
      // Don't fail the main operation if logging fails
      // Only log warning in non-test environments to avoid noise
      if (context.environment !== 'test') {
        console.warn('Activity logging failed:', error);
      }
    }

    return data;
  };
}

/**
 * Core activity logging logic
 *
 * Store activity log data in context for batch creation with parent record.
 * This prevents foreign key constraint violations by ensuring the parent
 * exists before the activity log is created.
 */
async function logActivity(
  data: Loggable,
  context: MutatorContext,
  config: ActivityLoggingConfig & typeof DEFAULT_ACTIVITY_LOGGING_CONFIG,
  currentUser: any
): Promise<void> {
  const action = determineAction(data, context, config);
  if (!action) {
    return;
  }

  const metadata = buildMetadata(data, context, config, action);

  const clientId = (await Promise.resolve(config.getAssociatedClientId?.(data))) || null;
  const jobId = (await Promise.resolve(config.getAssociatedJobId?.(data))) || null;

  // Store activity log data in context for batch creation
  // ActiveRecord will use this to create the log atomically with the parent
  context.pendingActivityLog = {
    user_id: currentUser.id,
    action,
    loggable_type: config.loggableType,
    loggable_id: data.id || '',
    metadata,
    client_id: clientId,
    job_id: jobId,
  };

  console.log(
    `[Activity Logging] Stored pending activity log in context for ${config.loggableType}:`,
    {
      action,
      loggable_type: config.loggableType,
      user_id: currentUser.id,
    }
  );

  // DO NOT create activity log here - let ActiveRecord handle it atomically
  // This prevents foreign key constraint violations during offline/online sync
}

/**
 * Determine the action to log based on context and data changes
 */
function determineAction(
  data: Loggable,
  context: MutatorContext,
  config: ActivityLoggingConfig & typeof DEFAULT_ACTIVITY_LOGGING_CONFIG
): string | null {
  // Check for custom action mapping first
  if (context.customAction && config.actionMapping[context.customAction]) {
    return config.actionMapping[context.customAction];
  }

  // Standard CRUD actions
  switch (context.action) {
    case 'create':
      return 'created';
    case 'delete':
      return data.discarded_at ? 'discarded' : 'deleted';
    case 'update':
      return determineUpdateAction(data, context, config);
    default:
      return context.customAction || null;
  }
}

/**
 * Determine specific update action based on what fields changed
 */
function determineUpdateAction(
  data: Loggable,
  context: MutatorContext,
  config: ActivityLoggingConfig & typeof DEFAULT_ACTIVITY_LOGGING_CONFIG
): string | null {
  const changes = context.changes || {};
  const filteredChanges = filterChanges(changes, config.excludeFields);

  // Skip if only excluded fields changed
  if (Object.keys(filteredChanges).length === 0) {
    return null;
  }

  // Special case handling (matching Rails Loggable concern)
  if (changes.status) {
    return 'status_changed';
  }

  if (changes.assigned_to_id) {
    return changes.assigned_to_id[1] ? 'assigned' : 'unassigned';
  }

  if (changes.discarded_at) {
    return changes.discarded_at[1] ? 'discarded' : 'undiscarded';
  }

  // Check for name/title changes (renamed action)
  if (changes.name || changes.title) {
    return 'renamed';
  }

  // Return 'updated' for other changes
  return 'updated';
}

/**
 * Build metadata object for activity log
 */
function buildMetadata(
  data: Loggable,
  context: MutatorContext,
  config: ActivityLoggingConfig & typeof DEFAULT_ACTIVITY_LOGGING_CONFIG,
  _action: string
): any {
  const metadata: any = {};
  const changes = context.changes || {};

  // Add change tracking if enabled
  if (config.trackChanges && context.action === 'update') {
    const filteredChanges = filterChanges(changes, config.excludeFields);

    if (Object.keys(filteredChanges).length > 0) {
      metadata.changes = filteredChanges;
    }

    // Special metadata for specific change types (matching Rails logic)
    if (changes.status) {
      metadata.old_status = changes.status[0];
      metadata.new_status = changes.status[1];
      metadata.new_status_label = getStatusLabel(changes.status[1], config.loggableType);
    }

    // For renamed action, use simple metadata structure
    if (context.action === 'update' && determineUpdateAction(data, context, config) === 'renamed') {
      // Clear the changes from metadata for renamed action
      delete metadata.changes;

      if (changes.name || changes.title) {
        metadata.old_name = changes.name ? changes.name[0] : changes.title[0];
      }
    }

    if (changes.assigned_to_id) {
      metadata.assigned_to_id = changes.assigned_to_id[1];
      metadata.old_assigned_to_id = changes.assigned_to_id[0];
    }
  }

  // Add custom metadata from context
  if (context.metadata) {
    Object.assign(metadata, context.metadata);
  }

  // Add record name for display purposes
  metadata.name = getRecordDisplayName(data, config.loggableType);

  return metadata;
}

/**
 * Filter out excluded fields from changes
 */
function filterChanges(
  changes: Record<string, [any, any]>,
  excludeFields: string[]
): Record<string, [any, any]> {
  const filtered: Record<string, [any, any]> = {};

  for (const [field, values] of Object.entries(changes)) {
    if (!excludeFields.includes(field)) {
      filtered[field] = values;
    }
  }

  return filtered;
}

/**
 * Get display name for a record
 */
function getRecordDisplayName(data: Loggable, loggableType: string): string {
  switch (loggableType) {
    case 'Task':
    case 'Job':
      return data.title || `${loggableType} #${data.id}`;
    case 'Client':
      return data.name || `${loggableType} #${data.id}`;
    case 'User':
      return data.name || data.email || `${loggableType} #${data.id}`;
    default:
      return data.name || data.title || `${loggableType} #${data.id}`;
  }
}

/**
 * Get status label for display (simplified version of Rails logic)
 */
function getStatusLabel(status: string, _loggableType: string): string {
  // This would ideally integrate with status configuration
  // For now, just humanize the status
  return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Enhanced mutator context with activity logging support
 */
export interface ActivityLoggingContext extends MutatorContext {
  /** Whether to skip activity logging (for tests) */
  skipActivityLogging?: boolean;
  /** Environment context */
  environment?: string;
  /** Custom action name for logging */
  customAction?: string;
  /** Additional metadata for the activity log */
  metadata?: Record<string, any>;
  /** Changes being made (for update operations) */
  changes?: Record<string, [any, any]>;
}

/**
 * Common activity logging mutators for models
 */

/**
 * Task activity logging mutator
 */
export const taskActivityLoggingMutator = createActivityLoggingMutator({
  loggableType: 'Task',
  excludeFields: [
    'updated_at',
    'created_at',
    'position',
    'lock_version',
    'reordered_at',
    'parent_id',
  ],
  getAssociatedJobId: (data) => data.job_id,
  getAssociatedClientId: async (data) => {
    // Tasks don't have client_id directly, need to get from job using ActiveRecord
    if (!data.job_id) return null;

    try {
      // Use ActiveRecord Job model for direct database lookup
      const { Job } = await import('../../models/job');
      const job = await Job.find(data.job_id);
      return job?.client_id || null;
    } catch {
      // If job not found or other error, return null
      return null;
    }
  },
});

/**
 * Job activity logging mutator
 */
export const jobActivityLoggingMutator = createActivityLoggingMutator({
  loggableType: 'Job',
  getAssociatedJobId: (data) => data.id,
  getAssociatedClientId: (data) => data.client_id,
});

/**
 * Client activity logging mutator
 */
export const clientActivityLoggingMutator = createActivityLoggingMutator({
  loggableType: 'Client',
  getAssociatedClientId: (data) => data.id,
});

/**
 * User activity logging mutator
 */
export const userActivityLoggingMutator = createActivityLoggingMutator({
  loggableType: 'User',
  trackChanges: false, // Don't track detailed changes for users for privacy
});

/**
 * Utility function to log custom activities
 */
export async function logCustomActivity(
  loggableType: string,
  loggableId: string,
  action: string,
  metadata: any = {},
  options: {
    userId?: string;
    clientId?: string;
    jobId?: string;
  } = {}
): Promise<void> {
  const currentUser = getCurrentUser();
  if (!currentUser && !options.userId) {
    return;
  }

  const { ActivityLog } = await import('../../models/activity-log');

  const activityLogData: CreateActivityLogData = {
    user_id: options.userId || currentUser?.id || '',
    action,
    loggable_type: loggableType,
    loggable_id: loggableId,
    metadata,
    client_id: options.clientId || null,
    job_id: options.jobId || null,
  };

  await ActivityLog.create(activityLogData);
}

/**
 * Type helpers for activity logging
 */
export type ActivityLoggingMutatorFunction<T> = MutatorFunction<T & Loggable>;
export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'discarded'
  | 'undiscarded'
  | 'status_changed'
  | 'renamed'
  | 'assigned'
  | 'unassigned';
