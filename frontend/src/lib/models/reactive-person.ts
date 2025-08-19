/**
 * ReactivePerson - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for people table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use Person instead:
 * ```typescript
 * import { Person } from './person';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type { PersonData, CreatePersonData, UpdatePersonData } from './types/person-data';
import { registerModelRelationships } from './base/scoped-query-base';

/**
 * ReactiveRecord configuration for Person
 */
const ReactivePersonConfig = {
  tableName: 'people',
  className: 'ReactivePerson',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactivePerson ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactivePerson } from '$lib/models/reactive-person';
 *
 *   // Reactive query - automatically updates when data changes
 *   const personQuery = ReactivePerson.find('123');
 *
 *   // Access reactive data
 *   $: person = personQuery.data;
 *   $: isLoading = personQuery.isLoading;
 *   $: error = personQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if person}
 *   <p>{person.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allPersonsQuery = ReactivePerson.all().all();
 * const activePersonsQuery = ReactivePerson.kept().all();
 * const singlePersonQuery = ReactivePerson.find('123');
 *
 * // With relationships
 * const personWithRelationsQuery = ReactivePerson
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredPersonsQuery = ReactivePerson
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactivePerson = createReactiveRecord<PersonData>(ReactivePersonConfig);

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

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactivePerson as Person } from './reactive-person';
 *
 * // Use like ActiveRecord but with reactive queries
 * const personQuery = Person.find('123');
 * ```
 */
export { ReactivePerson as Person };

// Export types for convenience
export type { PersonData, CreatePersonData, UpdatePersonData };

// Default export
export default ReactivePerson;
