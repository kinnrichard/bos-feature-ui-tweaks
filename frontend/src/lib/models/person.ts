/**
 * Person - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for people table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactivePerson instead:
 * ```typescript
 * import { ReactivePerson as Person } from './reactive-person';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type { PersonData, CreatePersonData, UpdatePersonData } from './types/person-data';
import { registerModelRelationships } from './base/scoped-query-base';

/**
 * Default values for Person creation
 * These defaults match the database schema defaults
 */
const PersonDefaults: Partial<CreatePersonData> = {
  is_active: true,
};

/**
 * ActiveRecord configuration for Person
 */
const PersonConfig = {
  tableName: 'people',
  className: 'Person',
  primaryKey: 'id',
  supportsDiscard: false,
  defaults: PersonDefaults,
};

/**
 * Person ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const person = await Person.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const person = await Person.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newPerson = await Person.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedPerson = await Person.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await Person.discard('123');
 *
 * // Restore discarded
 * await Person.undiscard('123');
 *
 * // Query with scopes
 * const allPersons = await Person.all().all();
 * const activePersons = await Person.kept().all();
 * ```
 */
export const Person = createActiveRecord<PersonData>(PersonConfig);

// Epic-009: Register model relationships for includes() functionality
registerModelRelationships('people', {
  client: { type: 'belongsTo', model: 'Client' },
  activityLogs: { type: 'hasMany', model: 'ActivityLog' },
  contactMethods: { type: 'hasMany', model: 'ContactMethod' },
  devices: { type: 'hasMany', model: 'Device' },
  notes: { type: 'hasMany', model: 'Note' },
  peopleGroupMemberships: { type: 'hasMany', model: 'PeopleGroupMembership' },
  peopleGroups: { type: 'hasMany', model: 'PeopleGroup' },
  peopleFrontConversations: { type: 'hasMany', model: 'PeopleFrontConversation' },
  frontConversations: { type: 'hasMany', model: 'FrontConversation' },
});

// Export types for convenience
export type { PersonData, CreatePersonData, UpdatePersonData };

// Default export
export default Person;
