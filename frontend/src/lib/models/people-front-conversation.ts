/**
 * PeopleFrontConversation - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for people_front_conversations table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactivePeopleFrontConversation instead:
 * ```typescript
 * import { ReactivePeopleFrontConversation as PeopleFrontConversation } from './reactive-people-front-conversation';
 * ```
 *
 * Generated: 2025-08-04 22:23:45 UTC
 */

import { createActiveRecord } from './base/active-record';
import type {
  PeopleFrontConversationData,
  CreatePeopleFrontConversationData,
  UpdatePeopleFrontConversationData,
} from './types/people-front-conversation-data';

/**
 * ActiveRecord configuration for PeopleFrontConversation
 */
const PeopleFrontConversationConfig = {
  tableName: 'people_front_conversations',
  className: 'PeopleFrontConversation',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * PeopleFrontConversation ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const people_front_conversation = await PeopleFrontConversation.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const people_front_conversation = await PeopleFrontConversation.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newPeopleFrontConversation = await PeopleFrontConversation.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedPeopleFrontConversation = await PeopleFrontConversation.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await PeopleFrontConversation.discard('123');
 *
 * // Restore discarded
 * await PeopleFrontConversation.undiscard('123');
 *
 * // Query with scopes
 * const allPeopleFrontConversations = await PeopleFrontConversation.all().all();
 * const activePeopleFrontConversations = await PeopleFrontConversation.kept().all();
 * ```
 */
export const PeopleFrontConversation = createActiveRecord<PeopleFrontConversationData>(
  PeopleFrontConversationConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type {
  PeopleFrontConversationData,
  CreatePeopleFrontConversationData,
  UpdatePeopleFrontConversationData,
};

// Default export
export default PeopleFrontConversation;
