/**
 * ReactiveJobPerson - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for job_people table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use JobPerson instead:
 * ```typescript
 * import { JobPerson } from './job-person';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  JobPersonData,
  CreateJobPersonData,
  UpdateJobPersonData,
} from './types/job-person-data';
import { registerModelRelationships } from './base/scoped-query-base';

/**
 * ReactiveRecord configuration for JobPerson
 */
const ReactiveJobPersonConfig = {
  tableName: 'job_people',
  className: 'ReactiveJobPerson',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveJobPerson ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveJobPerson } from '$lib/models/reactive-job-person';
 *
 *   // Reactive query - automatically updates when data changes
 *   const job_personQuery = ReactiveJobPerson.find('123');
 *
 *   // Access reactive data
 *   $: job_person = job_personQuery.data;
 *   $: isLoading = job_personQuery.isLoading;
 *   $: error = job_personQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if job_person}
 *   <p>{job_person.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allJobPersonsQuery = ReactiveJobPerson.all().all();
 * const activeJobPersonsQuery = ReactiveJobPerson.kept().all();
 * const singleJobPersonQuery = ReactiveJobPerson.find('123');
 *
 * // With relationships
 * const job_personWithRelationsQuery = ReactiveJobPerson
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredJobPersonsQuery = ReactiveJobPerson
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveJobPerson = createReactiveRecord<JobPersonData>(ReactiveJobPersonConfig);

// Epic-009: Register model relationships for includes() functionality
registerModelRelationships('job_people', {
  job: { type: 'belongsTo', model: 'Job' },
  person: { type: 'belongsTo', model: 'Person' },
});

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveJobPerson as JobPerson } from './reactive-job-person';
 *
 * // Use like ActiveRecord but with reactive queries
 * const job_personQuery = JobPerson.find('123');
 * ```
 */
export { ReactiveJobPerson as JobPerson };

// Export types for convenience
export type { JobPersonData, CreateJobPersonData, UpdateJobPersonData };

// Default export
export default ReactiveJobPerson;
