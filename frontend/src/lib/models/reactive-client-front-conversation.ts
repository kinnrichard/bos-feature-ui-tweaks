/**
 * ReactiveClientFrontConversation - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for clients_front_conversations table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use ClientFrontConversation instead:
 * ```typescript
 * import { ClientFrontConversation } from './client-front-conversation';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  ClientFrontConversationData,
  CreateClientFrontConversationData,
  UpdateClientFrontConversationData,
} from './types/client-front-conversation-data';

/**
 * ReactiveRecord configuration for ClientFrontConversation
 */
const ReactiveClientFrontConversationConfig = {
  tableName: 'clients_front_conversations',
  className: 'ReactiveClientFrontConversation',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveClientFrontConversation ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveClientFrontConversation } from '$lib/models/reactive-client-front-conversation';
 *
 *   // Reactive query - automatically updates when data changes
 *   const clients_front_conversationQuery = ReactiveClientFrontConversation.find('123');
 *
 *   // Access reactive data
 *   $: clients_front_conversation = clients_front_conversationQuery.data;
 *   $: isLoading = clients_front_conversationQuery.isLoading;
 *   $: error = clients_front_conversationQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if clients_front_conversation}
 *   <p>{clients_front_conversation.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allClientFrontConversationsQuery = ReactiveClientFrontConversation.all().all();
 * const activeClientFrontConversationsQuery = ReactiveClientFrontConversation.kept().all();
 * const singleClientFrontConversationQuery = ReactiveClientFrontConversation.find('123');
 *
 * // With relationships
 * const clients_front_conversationWithRelationsQuery = ReactiveClientFrontConversation
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredClientFrontConversationsQuery = ReactiveClientFrontConversation
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveClientFrontConversation = createReactiveRecord<ClientFrontConversationData>(
  ReactiveClientFrontConversationConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveClientFrontConversation as ClientFrontConversation } from './reactive-client-front-conversation';
 *
 * // Use like ActiveRecord but with reactive queries
 * const clients_front_conversationQuery = ClientFrontConversation.find('123');
 * ```
 */
export { ReactiveClientFrontConversation as ClientFrontConversation };

// Export types for convenience
export type {
  ClientFrontConversationData,
  CreateClientFrontConversationData,
  UpdateClientFrontConversationData,
};

// Default export
export default ReactiveClientFrontConversation;
