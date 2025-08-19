/**
 * PeopleGroupMembership - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for people_group_memberships table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactivePeopleGroupMembership instead:
 * ```typescript
 * import { ReactivePeopleGroupMembership as PeopleGroupMembership } from './reactive-people-group-membership';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  PeopleGroupMembershipData,
  CreatePeopleGroupMembershipData,
  UpdatePeopleGroupMembershipData,
} from './types/people-group-membership-data';

/**
 * ActiveRecord configuration for PeopleGroupMembership
 */
const PeopleGroupMembershipConfig = {
  tableName: 'people_group_memberships',
  className: 'PeopleGroupMembership',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * PeopleGroupMembership ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const people_group_membership = await PeopleGroupMembership.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const people_group_membership = await PeopleGroupMembership.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newPeopleGroupMembership = await PeopleGroupMembership.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedPeopleGroupMembership = await PeopleGroupMembership.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await PeopleGroupMembership.discard('123');
 *
 * // Restore discarded
 * await PeopleGroupMembership.undiscard('123');
 *
 * // Query with scopes
 * const allPeopleGroupMemberships = await PeopleGroupMembership.all().all();
 * const activePeopleGroupMemberships = await PeopleGroupMembership.kept().all();
 * ```
 */
export const PeopleGroupMembership = createActiveRecord<PeopleGroupMembershipData>(
  PeopleGroupMembershipConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type {
  PeopleGroupMembershipData,
  CreatePeopleGroupMembershipData,
  UpdatePeopleGroupMembershipData,
};

// Default export
export default PeopleGroupMembership;
