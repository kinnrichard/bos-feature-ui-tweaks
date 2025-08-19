/**
 * ReactiveFrontConversationTicket - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for front_conversation_tickets table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use FrontConversationTicket instead:
 * ```typescript
 * import { FrontConversationTicket } from './front-conversation-ticket';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  FrontConversationTicketData,
  CreateFrontConversationTicketData,
  UpdateFrontConversationTicketData,
} from './types/front-conversation-ticket-data';

/**
 * ReactiveRecord configuration for FrontConversationTicket
 */
const ReactiveFrontConversationTicketConfig = {
  tableName: 'front_conversation_tickets',
  className: 'ReactiveFrontConversationTicket',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveFrontConversationTicket ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveFrontConversationTicket } from '$lib/models/reactive-front-conversation-ticket';
 *
 *   // Reactive query - automatically updates when data changes
 *   const front_conversation_ticketQuery = ReactiveFrontConversationTicket.find('123');
 *
 *   // Access reactive data
 *   $: front_conversation_ticket = front_conversation_ticketQuery.data;
 *   $: isLoading = front_conversation_ticketQuery.isLoading;
 *   $: error = front_conversation_ticketQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if front_conversation_ticket}
 *   <p>{front_conversation_ticket.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allFrontConversationTicketsQuery = ReactiveFrontConversationTicket.all().all();
 * const activeFrontConversationTicketsQuery = ReactiveFrontConversationTicket.kept().all();
 * const singleFrontConversationTicketQuery = ReactiveFrontConversationTicket.find('123');
 *
 * // With relationships
 * const front_conversation_ticketWithRelationsQuery = ReactiveFrontConversationTicket
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredFrontConversationTicketsQuery = ReactiveFrontConversationTicket
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveFrontConversationTicket = createReactiveRecord<FrontConversationTicketData>(
  ReactiveFrontConversationTicketConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveFrontConversationTicket as FrontConversationTicket } from './reactive-front-conversation-ticket';
 *
 * // Use like ActiveRecord but with reactive queries
 * const front_conversation_ticketQuery = FrontConversationTicket.find('123');
 * ```
 */
export { ReactiveFrontConversationTicket as FrontConversationTicket };

// Export types for convenience
export type {
  FrontConversationTicketData,
  CreateFrontConversationTicketData,
  UpdateFrontConversationTicketData,
};

// Default export
export default ReactiveFrontConversationTicket;
