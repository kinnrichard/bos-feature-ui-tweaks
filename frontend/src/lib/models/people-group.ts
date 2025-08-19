/**
 * PeopleGroup - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for people_groups table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactivePeopleGroup instead:
 * ```typescript
 * import { ReactivePeopleGroup as PeopleGroup } from './reactive-people-group';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  PeopleGroupData,
  CreatePeopleGroupData,
  UpdatePeopleGroupData,
} from './types/people-group-data';

/**
 * Default values for PeopleGroup creation
 * These defaults match the database schema defaults
 */
const PeopleGroupDefaults: Partial<CreatePeopleGroupData> = {
  is_department: false,
};

/**
 * ActiveRecord configuration for PeopleGroup
 */
const PeopleGroupConfig = {
  tableName: 'people_groups',
  className: 'PeopleGroup',
  primaryKey: 'id',
  supportsDiscard: false,
  defaults: PeopleGroupDefaults,
};

/**
 * PeopleGroup ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const people_group = await PeopleGroup.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const people_group = await PeopleGroup.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newPeopleGroup = await PeopleGroup.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedPeopleGroup = await PeopleGroup.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await PeopleGroup.discard('123');
 *
 * // Restore discarded
 * await PeopleGroup.undiscard('123');
 *
 * // Query with scopes
 * const allPeopleGroups = await PeopleGroup.all().all();
 * const activePeopleGroups = await PeopleGroup.kept().all();
 * ```
 */
export const PeopleGroup = createActiveRecord<PeopleGroupData>(PeopleGroupConfig);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type { PeopleGroupData, CreatePeopleGroupData, UpdatePeopleGroupData };

// Default export
export default PeopleGroup;
