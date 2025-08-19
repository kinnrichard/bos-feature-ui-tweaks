/**
 * JobPerson - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for job_people table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveJobPerson instead:
 * ```typescript
 * import { ReactiveJobPerson as JobPerson } from './reactive-job-person';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  JobPersonData,
  CreateJobPersonData,
  UpdateJobPersonData,
} from './types/job-person-data';
import { registerModelRelationships } from './base/scoped-query-base';

/**
 * ActiveRecord configuration for JobPerson
 */
const JobPersonConfig = {
  tableName: 'job_people',
  className: 'JobPerson',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * JobPerson ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const job_person = await JobPerson.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const job_person = await JobPerson.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newJobPerson = await JobPerson.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedJobPerson = await JobPerson.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await JobPerson.discard('123');
 *
 * // Restore discarded
 * await JobPerson.undiscard('123');
 *
 * // Query with scopes
 * const allJobPersons = await JobPerson.all().all();
 * const activeJobPersons = await JobPerson.kept().all();
 * ```
 */
export const JobPerson = createActiveRecord<JobPersonData>(JobPersonConfig);

// Epic-009: Register model relationships for includes() functionality
registerModelRelationships('job_people', {
  job: { type: 'belongsTo', model: 'Job' },
  person: { type: 'belongsTo', model: 'Person' },
});

// Export types for convenience
export type { JobPersonData, CreateJobPersonData, UpdateJobPersonData };

// Default export
export default JobPerson;
