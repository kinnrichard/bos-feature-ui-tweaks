/**
 * JobTarget - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for job_targets table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveJobTarget instead:
 * ```typescript
 * import { ReactiveJobTarget as JobTarget } from './reactive-job-target';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  JobTargetData,
  CreateJobTargetData,
  UpdateJobTargetData,
} from './types/job-target-data';
import { declarePolymorphicRelationships } from '../zero/polymorphic';

/**
 * Default values for JobTarget creation
 * These defaults match the database schema defaults
 */
const JobTargetDefaults: Partial<CreateJobTargetData> = {
  instance_number: 1,
  status: 'active',
};

/**
 * ActiveRecord configuration for JobTarget
 */
const JobTargetConfig = {
  tableName: 'job_targets',
  className: 'JobTarget',
  primaryKey: 'id',
  supportsDiscard: false,
  defaults: JobTargetDefaults,
};

/**
 * JobTarget ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const job_target = await JobTarget.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const job_target = await JobTarget.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newJobTarget = await JobTarget.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedJobTarget = await JobTarget.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await JobTarget.discard('123');
 *
 * // Restore discarded
 * await JobTarget.undiscard('123');
 *
 * // Query with scopes
 * const allJobTargets = await JobTarget.all().all();
 * const activeJobTargets = await JobTarget.kept().all();
 * ```
 */
export const JobTarget = createActiveRecord<JobTargetData>(JobTargetConfig);

// EP-0036: Polymorphic relationship declarations
declarePolymorphicRelationships({
  tableName: 'job_targets',
  belongsTo: {
    target: {
      typeField: 'target_type',
      idField: 'target_id',
      allowedTypes: ['client', 'person', 'peoplegroup'],
    },
  },
});

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type { JobTargetData, CreateJobTargetData, UpdateJobTargetData };

// Default export
export default JobTarget;
