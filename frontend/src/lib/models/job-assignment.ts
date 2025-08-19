/**
 * JobAssignment - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for job_assignments table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveJobAssignment instead:
 * ```typescript
 * import { ReactiveJobAssignment as JobAssignment } from './reactive-job-assignment';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  JobAssignmentData,
  CreateJobAssignmentData,
  UpdateJobAssignmentData,
} from './types/job-assignment-data';
import { registerModelRelationships } from './base/scoped-query-base';

/**
 * ActiveRecord configuration for JobAssignment
 */
const JobAssignmentConfig = {
  tableName: 'job_assignments',
  className: 'JobAssignment',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * JobAssignment ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const job_assignment = await JobAssignment.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const job_assignment = await JobAssignment.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newJobAssignment = await JobAssignment.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedJobAssignment = await JobAssignment.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await JobAssignment.discard('123');
 *
 * // Restore discarded
 * await JobAssignment.undiscard('123');
 *
 * // Query with scopes
 * const allJobAssignments = await JobAssignment.all().all();
 * const activeJobAssignments = await JobAssignment.kept().all();
 * ```
 */
export const JobAssignment = createActiveRecord<JobAssignmentData>(JobAssignmentConfig);

// Epic-009: Register model relationships for includes() functionality
registerModelRelationships('job_assignments', {
  job: { type: 'belongsTo', model: 'Job' },
  user: { type: 'belongsTo', model: 'User' },
});

// Export types for convenience
export type { JobAssignmentData, CreateJobAssignmentData, UpdateJobAssignmentData };

// Default export
export default JobAssignment;
