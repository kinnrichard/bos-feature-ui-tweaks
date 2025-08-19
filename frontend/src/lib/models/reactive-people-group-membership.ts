/**
 * ReactivePeopleGroupMembership - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for people_group_memberships table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use PeopleGroupMembership instead:
 * ```typescript
 * import { PeopleGroupMembership } from './people-group-membership';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  PeopleGroupMembershipData,
  CreatePeopleGroupMembershipData,
  UpdatePeopleGroupMembershipData,
} from './types/people-group-membership-data';

/**
 * ReactiveRecord configuration for PeopleGroupMembership
 */
const ReactivePeopleGroupMembershipConfig = {
  tableName: 'people_group_memberships',
  className: 'ReactivePeopleGroupMembership',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactivePeopleGroupMembership ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactivePeopleGroupMembership } from '$lib/models/reactive-people-group-membership';
 *
 *   // Reactive query - automatically updates when data changes
 *   const people_group_membershipQuery = ReactivePeopleGroupMembership.find('123');
 *
 *   // Access reactive data
 *   $: people_group_membership = people_group_membershipQuery.data;
 *   $: isLoading = people_group_membershipQuery.isLoading;
 *   $: error = people_group_membershipQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if people_group_membership}
 *   <p>{people_group_membership.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allPeopleGroupMembershipsQuery = ReactivePeopleGroupMembership.all().all();
 * const activePeopleGroupMembershipsQuery = ReactivePeopleGroupMembership.kept().all();
 * const singlePeopleGroupMembershipQuery = ReactivePeopleGroupMembership.find('123');
 *
 * // With relationships
 * const people_group_membershipWithRelationsQuery = ReactivePeopleGroupMembership
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredPeopleGroupMembershipsQuery = ReactivePeopleGroupMembership
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactivePeopleGroupMembership = createReactiveRecord<PeopleGroupMembershipData>(
  ReactivePeopleGroupMembershipConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactivePeopleGroupMembership as PeopleGroupMembership } from './reactive-people-group-membership';
 *
 * // Use like ActiveRecord but with reactive queries
 * const people_group_membershipQuery = PeopleGroupMembership.find('123');
 * ```
 */
export { ReactivePeopleGroupMembership as PeopleGroupMembership };

// Export types for convenience
export type {
  PeopleGroupMembershipData,
  CreatePeopleGroupMembershipData,
  UpdatePeopleGroupMembershipData,
};

// Default export
export default ReactivePeopleGroupMembership;
