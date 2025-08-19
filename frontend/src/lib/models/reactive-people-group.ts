/**
 * ReactivePeopleGroup - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for people_groups table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use PeopleGroup instead:
 * ```typescript
 * import { PeopleGroup } from './people-group';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  PeopleGroupData,
  CreatePeopleGroupData,
  UpdatePeopleGroupData,
} from './types/people-group-data';

/**
 * ReactiveRecord configuration for PeopleGroup
 */
const ReactivePeopleGroupConfig = {
  tableName: 'people_groups',
  className: 'ReactivePeopleGroup',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactivePeopleGroup ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactivePeopleGroup } from '$lib/models/reactive-people-group';
 *
 *   // Reactive query - automatically updates when data changes
 *   const people_groupQuery = ReactivePeopleGroup.find('123');
 *
 *   // Access reactive data
 *   $: people_group = people_groupQuery.data;
 *   $: isLoading = people_groupQuery.isLoading;
 *   $: error = people_groupQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if people_group}
 *   <p>{people_group.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allPeopleGroupsQuery = ReactivePeopleGroup.all().all();
 * const activePeopleGroupsQuery = ReactivePeopleGroup.kept().all();
 * const singlePeopleGroupQuery = ReactivePeopleGroup.find('123');
 *
 * // With relationships
 * const people_groupWithRelationsQuery = ReactivePeopleGroup
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredPeopleGroupsQuery = ReactivePeopleGroup
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactivePeopleGroup = createReactiveRecord<PeopleGroupData>(ReactivePeopleGroupConfig);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactivePeopleGroup as PeopleGroup } from './reactive-people-group';
 *
 * // Use like ActiveRecord but with reactive queries
 * const people_groupQuery = PeopleGroup.find('123');
 * ```
 */
export { ReactivePeopleGroup as PeopleGroup };

// Export types for convenience
export type { PeopleGroupData, CreatePeopleGroupData, UpdatePeopleGroupData };

// Default export
export default ReactivePeopleGroup;
