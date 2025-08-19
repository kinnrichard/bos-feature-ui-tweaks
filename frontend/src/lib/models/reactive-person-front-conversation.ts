/**
 * ReactivePersonFrontConversation - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for people_front_conversations table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use PersonFrontConversation instead:
 * ```typescript
 * import { PersonFrontConversation } from './person-front-conversation';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  PersonFrontConversationData,
  CreatePersonFrontConversationData,
  UpdatePersonFrontConversationData,
} from './types/person-front-conversation-data';

/**
 * ReactiveRecord configuration for PersonFrontConversation
 */
const ReactivePersonFrontConversationConfig = {
  tableName: 'people_front_conversations',
  className: 'ReactivePersonFrontConversation',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactivePersonFrontConversation ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactivePersonFrontConversation } from '$lib/models/reactive-person-front-conversation';
 *
 *   // Reactive query - automatically updates when data changes
 *   const people_front_conversationQuery = ReactivePersonFrontConversation.find('123');
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
 * const allPersonFrontConversationsQuery = ReactivePersonFrontConversation.all().all();
 * const activePersonFrontConversationsQuery = ReactivePersonFrontConversation.kept().all();
 * const singlePersonFrontConversationQuery = ReactivePersonFrontConversation.find('123');
 *
 * // With relationships
 * const people_front_conversationWithRelationsQuery = ReactivePersonFrontConversation
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredPersonFrontConversationsQuery = ReactivePersonFrontConversation
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactivePersonFrontConversation = createReactiveRecord<PersonFrontConversationData>(
  ReactivePersonFrontConversationConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactivePersonFrontConversation as PersonFrontConversation } from './reactive-person-front-conversation';
 *
 * // Use like ActiveRecord but with reactive queries
 * const people_front_conversationQuery = PersonFrontConversation.find('123');
 * ```
 */
export { ReactivePersonFrontConversation as PersonFrontConversation };

// Export types for convenience
export type {
  PersonFrontConversationData,
  CreatePersonFrontConversationData,
  UpdatePersonFrontConversationData,
};

// Default export
export default ReactivePersonFrontConversation;
