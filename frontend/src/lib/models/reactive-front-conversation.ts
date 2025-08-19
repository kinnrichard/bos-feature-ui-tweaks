/**
 * ReactiveFrontConversation - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for front_conversations table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use FrontConversation instead:
 * ```typescript
 * import { FrontConversation } from './front-conversation';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  FrontConversationData,
  CreateFrontConversationData,
  UpdateFrontConversationData,
} from './types/front-conversation-data';

/**
 * ReactiveRecord configuration for FrontConversation
 */
const ReactiveFrontConversationConfig = {
  tableName: 'front_conversations',
  className: 'ReactiveFrontConversation',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveFrontConversation ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveFrontConversation } from '$lib/models/reactive-front-conversation';
 *
 *   // Reactive query - automatically updates when data changes
 *   const front_conversationQuery = ReactiveFrontConversation.find('123');
 *
 *   // Access reactive data
 *   $: front_conversation = front_conversationQuery.data;
 *   $: isLoading = front_conversationQuery.isLoading;
 *   $: error = front_conversationQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if front_conversation}
 *   <p>{front_conversation.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allFrontConversationsQuery = ReactiveFrontConversation.all().all();
 * const activeFrontConversationsQuery = ReactiveFrontConversation.kept().all();
 * const singleFrontConversationQuery = ReactiveFrontConversation.find('123');
 *
 * // With relationships
 * const front_conversationWithRelationsQuery = ReactiveFrontConversation
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredFrontConversationsQuery = ReactiveFrontConversation
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveFrontConversation = createReactiveRecord<FrontConversationData>(
  ReactiveFrontConversationConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveFrontConversation as FrontConversation } from './reactive-front-conversation';
 *
 * // Use like ActiveRecord but with reactive queries
 * const front_conversationQuery = FrontConversation.find('123');
 * ```
 */
export { ReactiveFrontConversation as FrontConversation };

// Export types for convenience
export type { FrontConversationData, CreateFrontConversationData, UpdateFrontConversationData };

// Default export
export default ReactiveFrontConversation;
