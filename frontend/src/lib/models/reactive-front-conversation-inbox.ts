/**
 * ReactiveFrontConversationInbox - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for front_conversation_inboxes table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use FrontConversationInbox instead:
 * ```typescript
 * import { FrontConversationInbox } from './front-conversation-inbox';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  FrontConversationInboxData,
  CreateFrontConversationInboxData,
  UpdateFrontConversationInboxData,
} from './types/front-conversation-inbox-data';

/**
 * ReactiveRecord configuration for FrontConversationInbox
 */
const ReactiveFrontConversationInboxConfig = {
  tableName: 'front_conversation_inboxes',
  className: 'ReactiveFrontConversationInbox',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveFrontConversationInbox ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveFrontConversationInbox } from '$lib/models/reactive-front-conversation-inbox';
 *
 *   // Reactive query - automatically updates when data changes
 *   const front_conversation_inboxQuery = ReactiveFrontConversationInbox.find('123');
 *
 *   // Access reactive data
 *   $: front_conversation_inbox = front_conversation_inboxQuery.data;
 *   $: isLoading = front_conversation_inboxQuery.isLoading;
 *   $: error = front_conversation_inboxQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if front_conversation_inbox}
 *   <p>{front_conversation_inbox.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allFrontConversationInboxsQuery = ReactiveFrontConversationInbox.all().all();
 * const activeFrontConversationInboxsQuery = ReactiveFrontConversationInbox.kept().all();
 * const singleFrontConversationInboxQuery = ReactiveFrontConversationInbox.find('123');
 *
 * // With relationships
 * const front_conversation_inboxWithRelationsQuery = ReactiveFrontConversationInbox
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredFrontConversationInboxsQuery = ReactiveFrontConversationInbox
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveFrontConversationInbox = createReactiveRecord<FrontConversationInboxData>(
  ReactiveFrontConversationInboxConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveFrontConversationInbox as FrontConversationInbox } from './reactive-front-conversation-inbox';
 *
 * // Use like ActiveRecord but with reactive queries
 * const front_conversation_inboxQuery = FrontConversationInbox.find('123');
 * ```
 */
export { ReactiveFrontConversationInbox as FrontConversationInbox };

// Export types for convenience
export type {
  FrontConversationInboxData,
  CreateFrontConversationInboxData,
  UpdateFrontConversationInboxData,
};

// Default export
export default ReactiveFrontConversationInbox;
