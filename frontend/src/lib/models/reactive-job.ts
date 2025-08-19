/**
 * ReactiveJob - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for jobs table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use Job instead:
 * ```typescript
 * import { Job } from './job';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type { JobData, CreateJobData, UpdateJobData } from './types/job-data';
import { registerModelRelationships } from './base/scoped-query-base';

/**
 * ReactiveRecord configuration for Job
 */
const ReactiveJobConfig = {
  tableName: 'jobs',
  className: 'ReactiveJob',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveJob ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveJob } from '$lib/models/reactive-job';
 *
 *   // Reactive query - automatically updates when data changes
 *   const jobQuery = ReactiveJob.find('123');
 *
 *   // Access reactive data
 *   $: job = jobQuery.data;
 *   $: isLoading = jobQuery.isLoading;
 *   $: error = jobQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if job}
 *   <p>{job.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allJobsQuery = ReactiveJob.all().all();
 * const activeJobsQuery = ReactiveJob.kept().all();
 * const singleJobQuery = ReactiveJob.find('123');
 *
 * // With relationships
 * const jobWithRelationsQuery = ReactiveJob
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredJobsQuery = ReactiveJob
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveJob = createReactiveRecord<JobData>(ReactiveJobConfig);

// Epic-009: Register model relationships for includes() functionality
registerModelRelationships('jobs', {
  client: { type: 'belongsTo', model: 'Client' },
  activityLogs: { type: 'hasMany', model: 'ActivityLog' },
  jobAssignments: { type: 'hasMany', model: 'JobAssignment' },
  technicians: { type: 'hasMany', model: 'User' },
  jobPeople: { type: 'hasMany', model: 'JobPerson' },
  people: { type: 'hasMany', model: 'Person' },
  jobTargets: { type: 'hasMany', model: 'JobTarget' },
  tasks: { type: 'hasMany', model: 'Task' },
  allTasks: { type: 'hasMany', model: 'Task' },
  notes: { type: 'hasMany', model: 'Note' },
  scheduledDateTimes: { type: 'hasMany', model: 'ScheduledDateTime' },
});

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveJob as Job } from './reactive-job';
 *
 * // Use like ActiveRecord but with reactive queries
 * const jobQuery = Job.find('123');
 * ```
 */
export { ReactiveJob as Job };

// Export types for convenience
export type { JobData, CreateJobData, UpdateJobData };

// Default export
export default ReactiveJob;
