/**
 * ReactiveFrontTag - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for front_tags table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use FrontTag instead:
 * ```typescript
 * import { FrontTag } from './front-tag';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type { FrontTagData, CreateFrontTagData, UpdateFrontTagData } from './types/front-tag-data';

/**
 * ReactiveRecord configuration for FrontTag
 */
const ReactiveFrontTagConfig = {
  tableName: 'front_tags',
  className: 'ReactiveFrontTag',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveFrontTag ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveFrontTag } from '$lib/models/reactive-front-tag';
 *
 *   // Reactive query - automatically updates when data changes
 *   const front_tagQuery = ReactiveFrontTag.find('123');
 *
 *   // Access reactive data
 *   $: front_tag = front_tagQuery.data;
 *   $: isLoading = front_tagQuery.isLoading;
 *   $: error = front_tagQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if front_tag}
 *   <p>{front_tag.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allFrontTagsQuery = ReactiveFrontTag.all().all();
 * const activeFrontTagsQuery = ReactiveFrontTag.kept().all();
 * const singleFrontTagQuery = ReactiveFrontTag.find('123');
 *
 * // With relationships
 * const front_tagWithRelationsQuery = ReactiveFrontTag
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredFrontTagsQuery = ReactiveFrontTag
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveFrontTag = createReactiveRecord<FrontTagData>(ReactiveFrontTagConfig);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveFrontTag as FrontTag } from './reactive-front-tag';
 *
 * // Use like ActiveRecord but with reactive queries
 * const front_tagQuery = FrontTag.find('123');
 * ```
 */
export { ReactiveFrontTag as FrontTag };

// Export types for convenience
export type { FrontTagData, CreateFrontTagData, UpdateFrontTagData };

// Default export
export default ReactiveFrontTag;
