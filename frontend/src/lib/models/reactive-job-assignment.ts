/**
 * ReactiveJobAssignment - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for job_assignments table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use JobAssignment instead:
 * ```typescript
 * import { JobAssignment } from './job-assignment';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  JobAssignmentData,
  CreateJobAssignmentData,
  UpdateJobAssignmentData,
} from './types/job-assignment-data';
import { registerModelRelationships } from './base/scoped-query-base';

/**
 * ReactiveRecord configuration for JobAssignment
 */
const ReactiveJobAssignmentConfig = {
  tableName: 'job_assignments',
  className: 'ReactiveJobAssignment',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveJobAssignment ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveJobAssignment } from '$lib/models/reactive-job-assignment';
 *
 *   // Reactive query - automatically updates when data changes
 *   const job_assignmentQuery = ReactiveJobAssignment.find('123');
 *
 *   // Access reactive data
 *   $: job_assignment = job_assignmentQuery.data;
 *   $: isLoading = job_assignmentQuery.isLoading;
 *   $: error = job_assignmentQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if job_assignment}
 *   <p>{job_assignment.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allJobAssignmentsQuery = ReactiveJobAssignment.all().all();
 * const activeJobAssignmentsQuery = ReactiveJobAssignment.kept().all();
 * const singleJobAssignmentQuery = ReactiveJobAssignment.find('123');
 *
 * // With relationships
 * const job_assignmentWithRelationsQuery = ReactiveJobAssignment
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredJobAssignmentsQuery = ReactiveJobAssignment
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveJobAssignment = createReactiveRecord<JobAssignmentData>(
  ReactiveJobAssignmentConfig
);

// Epic-009: Register model relationships for includes() functionality
registerModelRelationships('job_assignments', {
  job: { type: 'belongsTo', model: 'Job' },
  user: { type: 'belongsTo', model: 'User' },
});

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveJobAssignment as JobAssignment } from './reactive-job-assignment';
 *
 * // Use like ActiveRecord but with reactive queries
 * const job_assignmentQuery = JobAssignment.find('123');
 * ```
 */
export { ReactiveJobAssignment as JobAssignment };

// Export types for convenience
export type { JobAssignmentData, CreateJobAssignmentData, UpdateJobAssignmentData };

// Default export
export default ReactiveJobAssignment;
