/**
 * ClientFrontConversation - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for clients_front_conversations table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveClientFrontConversation instead:
 * ```typescript
 * import { ReactiveClientFrontConversation as ClientFrontConversation } from './reactive-client-front-conversation';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  ClientFrontConversationData,
  CreateClientFrontConversationData,
  UpdateClientFrontConversationData,
} from './types/client-front-conversation-data';

/**
 * ActiveRecord configuration for ClientFrontConversation
 */
const ClientFrontConversationConfig = {
  tableName: 'clients_front_conversations',
  className: 'ClientFrontConversation',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ClientFrontConversation ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const clients_front_conversation = await ClientFrontConversation.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const clients_front_conversation = await ClientFrontConversation.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newClientFrontConversation = await ClientFrontConversation.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedClientFrontConversation = await ClientFrontConversation.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await ClientFrontConversation.discard('123');
 *
 * // Restore discarded
 * await ClientFrontConversation.undiscard('123');
 *
 * // Query with scopes
 * const allClientFrontConversations = await ClientFrontConversation.all().all();
 * const activeClientFrontConversations = await ClientFrontConversation.kept().all();
 * ```
 */
export const ClientFrontConversation = createActiveRecord<ClientFrontConversationData>(
  ClientFrontConversationConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type {
  ClientFrontConversationData,
  CreateClientFrontConversationData,
  UpdateClientFrontConversationData,
};

// Default export
export default ClientFrontConversation;
