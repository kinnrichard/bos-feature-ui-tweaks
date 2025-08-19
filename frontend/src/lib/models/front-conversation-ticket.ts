/**
 * FrontConversationTicket - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for front_conversation_tickets table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveFrontConversationTicket instead:
 * ```typescript
 * import { ReactiveFrontConversationTicket as FrontConversationTicket } from './reactive-front-conversation-ticket';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  FrontConversationTicketData,
  CreateFrontConversationTicketData,
  UpdateFrontConversationTicketData,
} from './types/front-conversation-ticket-data';

/**
 * ActiveRecord configuration for FrontConversationTicket
 */
const FrontConversationTicketConfig = {
  tableName: 'front_conversation_tickets',
  className: 'FrontConversationTicket',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * FrontConversationTicket ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const front_conversation_ticket = await FrontConversationTicket.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const front_conversation_ticket = await FrontConversationTicket.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newFrontConversationTicket = await FrontConversationTicket.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedFrontConversationTicket = await FrontConversationTicket.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await FrontConversationTicket.discard('123');
 *
 * // Restore discarded
 * await FrontConversationTicket.undiscard('123');
 *
 * // Query with scopes
 * const allFrontConversationTickets = await FrontConversationTicket.all().all();
 * const activeFrontConversationTickets = await FrontConversationTicket.kept().all();
 * ```
 */
export const FrontConversationTicket = createActiveRecord<FrontConversationTicketData>(
  FrontConversationTicketConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type {
  FrontConversationTicketData,
  CreateFrontConversationTicketData,
  UpdateFrontConversationTicketData,
};

// Default export
export default FrontConversationTicket;
