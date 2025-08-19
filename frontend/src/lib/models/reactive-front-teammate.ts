/**
 * ReactiveFrontTeammate - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for front_teammates table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use FrontTeammate instead:
 * ```typescript
 * import { FrontTeammate } from './front-teammate';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  FrontTeammateData,
  CreateFrontTeammateData,
  UpdateFrontTeammateData,
} from './types/front-teammate-data';

/**
 * ReactiveRecord configuration for FrontTeammate
 */
const ReactiveFrontTeammateConfig = {
  tableName: 'front_teammates',
  className: 'ReactiveFrontTeammate',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveFrontTeammate ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveFrontTeammate } from '$lib/models/reactive-front-teammate';
 *
 *   // Reactive query - automatically updates when data changes
 *   const front_teammateQuery = ReactiveFrontTeammate.find('123');
 *
 *   // Access reactive data
 *   $: front_teammate = front_teammateQuery.data;
 *   $: isLoading = front_teammateQuery.isLoading;
 *   $: error = front_teammateQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if front_teammate}
 *   <p>{front_teammate.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allFrontTeammatesQuery = ReactiveFrontTeammate.all().all();
 * const activeFrontTeammatesQuery = ReactiveFrontTeammate.kept().all();
 * const singleFrontTeammateQuery = ReactiveFrontTeammate.find('123');
 *
 * // With relationships
 * const front_teammateWithRelationsQuery = ReactiveFrontTeammate
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredFrontTeammatesQuery = ReactiveFrontTeammate
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveFrontTeammate = createReactiveRecord<FrontTeammateData>(
  ReactiveFrontTeammateConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveFrontTeammate as FrontTeammate } from './reactive-front-teammate';
 *
 * // Use like ActiveRecord but with reactive queries
 * const front_teammateQuery = FrontTeammate.find('123');
 * ```
 */
export { ReactiveFrontTeammate as FrontTeammate };

// Export types for convenience
export type { FrontTeammateData, CreateFrontTeammateData, UpdateFrontTeammateData };

// Default export
export default ReactiveFrontTeammate;
