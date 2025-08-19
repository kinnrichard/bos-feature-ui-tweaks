/**
 * Composable query builders for jobs
 * EP-0018: DRY Jobs Pages with Composable Architecture
 *
 * These functions follow a composable pattern allowing flexible query construction
 * while maintaining type safety and reusability.
 */

import { ReactiveJob } from '$lib/models/reactive-job';
import type { ReactiveQuery } from '$lib/models/base/types';
import type { JobData } from '$lib/models/types/job-data';
import type { JobStatus, JobPriority } from '$lib/types/job';

/**
 * Creates the base job query with standard includes and ordering
 * This is the foundation that all job queries should start from
 */
export function createJobsQuery(): ReactiveQuery<JobData[]> {
  return ReactiveJob.includes('client', 'jobAssignments.user').orderBy('created_at', 'desc');
}

/**
 * Adds a client filter to the query
 * @param query - The base query to enhance
 * @param clientId - The client ID to filter by
 */
export function withClientFilter(
  query: ReactiveQuery<JobData[]>,
  clientId: string | null | undefined
): ReactiveQuery<JobData[]> {
  return clientId ? query.where({ client_id: clientId }) : query;
}

/**
 * Adds a technician filter to the query
 * @param query - The base query to enhance
 * @param technicianId - The technician ID to filter by
 */
export function withTechnicianFilter(
  query: ReactiveQuery<JobData[]>,
  technicianId: string | null | undefined
): ReactiveQuery<JobData[]> {
  if (!technicianId) return query;

  // Note: This would require a more complex query once job assignments
  // are properly queryable through Zero.js
  // For now, we'll handle this in the display filter layer
  return query;
}

/**
 * Adds a status filter to the query
 * @param query - The base query to enhance
 * @param status - The job status to filter by
 */
export function withStatusFilter(
  query: ReactiveQuery<JobData[]>,
  status: JobStatus | null | undefined
): ReactiveQuery<JobData[]> {
  return status ? query.where({ status }) : query;
}

/**
 * Adds a priority filter to the query
 * @param query - The base query to enhance
 * @param priority - The job priority to filter by
 */
export function withPriorityFilter(
  query: ReactiveQuery<JobData[]>,
  priority: JobPriority | null | undefined
): ReactiveQuery<JobData[]> {
  return priority ? query.where({ priority }) : query;
}

/**
 * Adds a date range filter to the query
 * @param query - The base query to enhance
 * @param startDate - The start date for the range
 * @param endDate - The end date for the range
 */
export function withDateRangeFilter(
  query: ReactiveQuery<JobData[]>,
  startDate: string | null | undefined,
  endDate: string | null | undefined
): ReactiveQuery<JobData[]> {
  if (!startDate && !endDate) return query;

  // Note: Date range filtering would need to be implemented
  // once Zero.js supports more complex where clauses
  return query;
}

/**
 * Creates a query for jobs assigned to the current user
 * @param query - The base query to enhance
 * @param userId - The current user's ID
 */
export function withUserAssignmentFilter(
  query: ReactiveQuery<JobData[]>,
  userId: string | null | undefined
): ReactiveQuery<JobData[]> {
  if (!userId) return query;

  // Note: This would require joining through job_assignments
  // Currently handled in display filter layer
  return query;
}

/**
 * Utility to compose multiple filters in a fluent interface
 * Example usage:
 * const query = composeJobQuery()
 *   .withClient(clientId)
 *   .withStatus('in_progress')
 *   .build();
 */
export function composeJobQuery() {
  let query = createJobsQuery();

  return {
    withClient(clientId: string | null | undefined) {
      query = withClientFilter(query, clientId);
      return this;
    },

    withTechnician(technicianId: string | null | undefined) {
      query = withTechnicianFilter(query, technicianId);
      return this;
    },

    withStatus(status: JobStatus | null | undefined) {
      query = withStatusFilter(query, status);
      return this;
    },

    withPriority(priority: JobPriority | null | undefined) {
      query = withPriorityFilter(query, priority);
      return this;
    },

    withDateRange(startDate: string | null | undefined, endDate: string | null | undefined) {
      query = withDateRangeFilter(query, startDate, endDate);
      return this;
    },

    withUserAssignment(userId: string | null | undefined) {
      query = withUserAssignmentFilter(query, userId);
      return this;
    },

    build() {
      return query.all();
    },
  };
}
