/**
 * ReactivePeopleFrontConversation - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for people_front_conversations table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use PeopleFrontConversation instead:
 * ```typescript
 * import { PeopleFrontConversation } from './people-front-conversation';
 * ```
 *
 * Generated: 2025-08-04 22:23:45 UTC
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  PeopleFrontConversationData,
  CreatePeopleFrontConversationData,
  UpdatePeopleFrontConversationData,
} from './types/people-front-conversation-data';

/**
 * ReactiveRecord configuration for PeopleFrontConversation
 */
const ReactivePeopleFrontConversationConfig = {
  tableName: 'people_front_conversations',
  className: 'ReactivePeopleFrontConversation',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactivePeopleFrontConversation ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactivePeopleFrontConversation } from '$lib/models/reactive-people-front-conversation';
 *
 *   // Reactive query - automatically updates when data changes
 *   const people_front_conversationQuery = ReactivePeopleFrontConversation.find('123');
 *
 *   // Access reactive data
 *   $: people_front_conversation = people_front_conversationQuery.data;
 *   $: isLoading = people_front_conversationQuery.isLoading;
 *   $: error = people_front_conversationQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if people_front_conversation}
 *   <p>{people_front_conversation.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allPeopleFrontConversationsQuery = ReactivePeopleFrontConversation.all().all();
 * const activePeopleFrontConversationsQuery = ReactivePeopleFrontConversation.kept().all();
 * const singlePeopleFrontConversationQuery = ReactivePeopleFrontConversation.find('123');
 *
 * // With relationships
 * const people_front_conversationWithRelationsQuery = ReactivePeopleFrontConversation
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredPeopleFrontConversationsQuery = ReactivePeopleFrontConversation
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactivePeopleFrontConversation = createReactiveRecord<PeopleFrontConversationData>(
  ReactivePeopleFrontConversationConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactivePeopleFrontConversation as PeopleFrontConversation } from './reactive-people-front-conversation';
 *
 * // Use like ActiveRecord but with reactive queries
 * const people_front_conversationQuery = PeopleFrontConversation.find('123');
 * ```
 */
export { ReactivePeopleFrontConversation as PeopleFrontConversation };

// Export types for convenience
export type {
  PeopleFrontConversationData,
  CreatePeopleFrontConversationData,
  UpdatePeopleFrontConversationData,
};

// Default export
export default ReactivePeopleFrontConversation;
