/**
 * Model-Specific Mutator Configurations
 * 
 * This file combines all mutators for each model type, providing complete
 * mutation pipelines that include normalization, validation, positioning,
 * user attribution, and activity logging.
 */

import type { MutatorFunction, MutatorContext } from './base-mutator';
import { taskPositioningMutator } from './positioning';
import { 
  taskActivityLoggingMutator,
  jobActivityLoggingMutator, 
  clientActivityLoggingMutator,
  userActivityLoggingMutator,
  createActivityLoggingMutator
} from './activity-logging';
import { LOGGABLE_MODELS } from '../../models/generated-loggable-config';

/**
 * Mutator pipeline executor
 * Runs multiple mutators in sequence, passing the result of each to the next
 */
async function executeMutatorPipeline<T>(
  data: T,
  context: MutatorContext,
  mutators: MutatorFunction<T>[]
): Promise<T> {
  let result = data;
  
  for (const mutator of mutators) {
    result = await mutator(result, context);
  }
  
  return result;
}

/**
 * Task mutator pipeline
 * 1. Positioning (automatic position assignment)
 * 2. Activity logging (audit trail)
 */
export const taskMutatorPipeline: MutatorFunction<any> = async (data, context) => {
  return executeMutatorPipeline(data, context, [
    taskPositioningMutator,
    taskActivityLoggingMutator
  ]);
};

/**
 * Job mutator pipeline  
 * 1. Activity logging (audit trail)
 */
export const jobMutatorPipeline: MutatorFunction<any> = async (data, context) => {
  return executeMutatorPipeline(data, context, [
    jobActivityLoggingMutator
  ]);
};

/**
 * Client mutator pipeline
 * 1. Activity logging (audit trail)
 */
export const clientMutatorPipeline: MutatorFunction<any> = async (data, context) => {
  return executeMutatorPipeline(data, context, [
    clientActivityLoggingMutator
  ]);
};

/**
 * User mutator pipeline
 * 1. Activity logging (audit trail - limited for privacy)
 */
export const userMutatorPipeline: MutatorFunction<any> = async (data, context) => {
  return executeMutatorPipeline(data, context, [
    userActivityLoggingMutator
  ]);
};

/**
 * Generic mutator pipeline for models that only need basic tracking
 * Currently empty but can be extended
 */
export const genericMutatorPipeline: MutatorFunction<any> = async (data, _context) => {
  // No mutators currently - just pass through
  return data;
};

/**
 * Create generic loggable pipeline for models that include the Loggable concern
 * but don't have custom mutator logic
 */
function createGenericLoggablePipeline(modelName: string): MutatorFunction<any> {
  const activityLoggingMutator = createActivityLoggingMutator({
    loggableType: modelName,
    // Default associations - models can override as needed
    getAssociatedClientId: (data) => data.client_id || null,
    getAssociatedJobId: (data) => data.job_id || null
  });
  
  return async (data, context) => {
    return executeMutatorPipeline(data, context, [activityLoggingMutator]);
  };
}

/**
 * Model mutator registry
 * Dynamically built based on Rails Loggable models
 */
export const MODEL_MUTATORS: Record<string, MutatorFunction<any>> = {};

// Add activity logging mutators for Loggable models
Object.entries(LOGGABLE_MODELS).forEach(([tableName, config]) => {
  if (config.includesLoggable) {
    // Special handling for specific models
    switch (tableName) {
      case 'tasks':
        MODEL_MUTATORS[tableName] = taskMutatorPipeline;
        break;
      case 'jobs':
        MODEL_MUTATORS[tableName] = jobMutatorPipeline;
        break;
      case 'clients':
        MODEL_MUTATORS[tableName] = clientMutatorPipeline;
        break;
      case 'users':
        MODEL_MUTATORS[tableName] = userMutatorPipeline;
        break;
      default:
        // Generic activity logging for other Loggable models
        MODEL_MUTATORS[tableName] = createGenericLoggablePipeline(config.modelName);
    }
  }
});

// Add non-loggable models
['notes'].forEach(tableName => {
  if (!MODEL_MUTATORS[tableName]) {
    MODEL_MUTATORS[tableName] = genericMutatorPipeline;
  }
});

// Activity logs themselves don't need mutation (would create infinite loop)
MODEL_MUTATORS['activity_logs'] = async (data, _context) => data;

/**
 * Get mutator pipeline for a specific model
 */
export function getMutatorForModel(tableName: string): MutatorFunction<any> | null {
  return MODEL_MUTATORS[tableName] || null;
}

/**
 * Register a custom mutator pipeline for a model
 */
export function registerModelMutator(tableName: string, mutator: MutatorFunction<any>): void {
  MODEL_MUTATORS[tableName] = mutator;
}

/**
 * Mutator configuration for enhanced context building
 */
export interface MutatorConfig {
  /** Enable change tracking for activity logging */
  trackChanges?: boolean;
  /** Custom metadata to include in logs */
  metadata?: Record<string, any>;
  /** Skip specific mutators by name */
  skipMutators?: string[];
}

/**
 * Enhanced mutator execution with change tracking and configuration
 */
export async function executeMutatorWithTracking<T>(
  tableName: string,
  data: T,
  originalData: T | null,
  context: MutatorContext,
  config: MutatorConfig = {}
): Promise<T> {
  console.log('[Model Mutators] executeMutatorWithTracking called for', tableName);
  
  const mutator = getMutatorForModel(tableName);
  if (!mutator) {
    console.log('[Model Mutators] No mutator found for', tableName);
    return data;
  }

  console.log('[Model Mutators] Found mutator for', tableName);

  // Build enhanced context with change tracking
  const enhancedContext: MutatorContext = {
    ...context,
    changes: config.trackChanges ? buildChangeTracking(originalData, data) : undefined,
    metadata: { ...context.metadata, ...config.metadata }
  };

  console.log('[Model Mutators] Calling mutator with enhanced context');
  const result = await mutator(data, enhancedContext);
  
  // Copy any properties added to enhanced context back to the original context
  // This ensures pendingActivityLog is preserved
  if (enhancedContext.pendingActivityLog && !context.pendingActivityLog) {
    context.pendingActivityLog = enhancedContext.pendingActivityLog;
    console.log('[Model Mutators] Preserved pendingActivityLog in original context');
  }
  
  return result;
}

/**
 * Build change tracking object for activity logging
 */
function buildChangeTracking<T>(original: T | null, updated: T): Record<string, [any, any]> | undefined {
  if (!original || typeof original !== 'object' || typeof updated !== 'object') {
    return undefined;
  }

  const changes: Record<string, [any, any]> = {};
  
  // Compare all fields in the updated object
  for (const [key, newValue] of Object.entries(updated as Record<string, any>)) {
    const oldValue = (original as Record<string, any>)[key];
    
    // Skip if values are the same
    if (oldValue === newValue) {
      continue;
    }
    
    // Handle null/undefined comparisons
    if (oldValue == null && newValue == null) {
      continue;
    }
    
    changes[key] = [oldValue, newValue];
  }
  
  return Object.keys(changes).length > 0 ? changes : undefined;
}

/**
 * Export individual mutators for direct use
 */
export {
  taskPositioningMutator,
  taskActivityLoggingMutator,
  jobActivityLoggingMutator,
  clientActivityLoggingMutator,
  userActivityLoggingMutator
};