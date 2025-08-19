/**
 * FrontConversationInbox - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for front_conversation_inboxes table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveFrontConversationInbox instead:
 * ```typescript
 * import { ReactiveFrontConversationInbox as FrontConversationInbox } from './reactive-front-conversation-inbox';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  FrontConversationInboxData,
  CreateFrontConversationInboxData,
  UpdateFrontConversationInboxData,
} from './types/front-conversation-inbox-data';

/**
 * ActiveRecord configuration for FrontConversationInbox
 */
const FrontConversationInboxConfig = {
  tableName: 'front_conversation_inboxes',
  className: 'FrontConversationInbox',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * FrontConversationInbox ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const front_conversation_inbox = await FrontConversationInbox.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const front_conversation_inbox = await FrontConversationInbox.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newFrontConversationInbox = await FrontConversationInbox.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedFrontConversationInbox = await FrontConversationInbox.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await FrontConversationInbox.discard('123');
 *
 * // Restore discarded
 * await FrontConversationInbox.undiscard('123');
 *
 * // Query with scopes
 * const allFrontConversationInboxs = await FrontConversationInbox.all().all();
 * const activeFrontConversationInboxs = await FrontConversationInbox.kept().all();
 * ```
 */
export const FrontConversationInbox = createActiveRecord<FrontConversationInboxData>(
  FrontConversationInboxConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type {
  FrontConversationInboxData,
  CreateFrontConversationInboxData,
  UpdateFrontConversationInboxData,
};

// Default export
export default FrontConversationInbox;
