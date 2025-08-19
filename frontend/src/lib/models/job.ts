/**
 * Job - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for jobs table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveJob instead:
 * ```typescript
 * import { ReactiveJob as Job } from './reactive-job';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type { JobData, CreateJobData, UpdateJobData } from './types/job-data';
import { registerModelRelationships } from './base/scoped-query-base';

/**
 * Default values for Job creation
 * These defaults match the database schema defaults
 */
const JobDefaults: Partial<CreateJobData> = {
  due_time_set: false,
  lock_version: 0,
  priority: 'normal',
  start_time_set: false,
  status: 'open',
};

/**
 * ActiveRecord configuration for Job
 */
const JobConfig = {
  tableName: 'jobs',
  className: 'Job',
  primaryKey: 'id',
  supportsDiscard: false,
  defaults: JobDefaults,
};

/**
 * Job ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const job = await Job.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const job = await Job.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newJob = await Job.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedJob = await Job.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await Job.discard('123');
 *
 * // Restore discarded
 * await Job.undiscard('123');
 *
 * // Query with scopes
 * const allJobs = await Job.all().all();
 * const activeJobs = await Job.kept().all();
 * ```
 */
export const Job = createActiveRecord<JobData>(JobConfig);

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

// Export types for convenience
export type { JobData, CreateJobData, UpdateJobData };

// Default export
export default Job;
