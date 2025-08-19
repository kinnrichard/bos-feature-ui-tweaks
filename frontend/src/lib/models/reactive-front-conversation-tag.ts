/**
 * ReactiveFrontConversationTag - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for front_conversation_tags table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use FrontConversationTag instead:
 * ```typescript
 * import { FrontConversationTag } from './front-conversation-tag';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  FrontConversationTagData,
  CreateFrontConversationTagData,
  UpdateFrontConversationTagData,
} from './types/front-conversation-tag-data';

/**
 * ReactiveRecord configuration for FrontConversationTag
 */
const ReactiveFrontConversationTagConfig = {
  tableName: 'front_conversation_tags',
  className: 'ReactiveFrontConversationTag',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveFrontConversationTag ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveFrontConversationTag } from '$lib/models/reactive-front-conversation-tag';
 *
 *   // Reactive query - automatically updates when data changes
 *   const front_conversation_tagQuery = ReactiveFrontConversationTag.find('123');
 *
 *   // Access reactive data
 *   $: front_conversation_tag = front_conversation_tagQuery.data;
 *   $: isLoading = front_conversation_tagQuery.isLoading;
 *   $: error = front_conversation_tagQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if front_conversation_tag}
 *   <p>{front_conversation_tag.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allFrontConversationTagsQuery = ReactiveFrontConversationTag.all().all();
 * const activeFrontConversationTagsQuery = ReactiveFrontConversationTag.kept().all();
 * const singleFrontConversationTagQuery = ReactiveFrontConversationTag.find('123');
 *
 * // With relationships
 * const front_conversation_tagWithRelationsQuery = ReactiveFrontConversationTag
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredFrontConversationTagsQuery = ReactiveFrontConversationTag
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveFrontConversationTag = createReactiveRecord<FrontConversationTagData>(
  ReactiveFrontConversationTagConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveFrontConversationTag as FrontConversationTag } from './reactive-front-conversation-tag';
 *
 * // Use like ActiveRecord but with reactive queries
 * const front_conversation_tagQuery = FrontConversationTag.find('123');
 * ```
 */
export { ReactiveFrontConversationTag as FrontConversationTag };

// Export types for convenience
export type {
  FrontConversationTagData,
  CreateFrontConversationTagData,
  UpdateFrontConversationTagData,
};

// Default export
export default ReactiveFrontConversationTag;
