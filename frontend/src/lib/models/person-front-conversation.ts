/**
 * PersonFrontConversation - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for people_front_conversations table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactivePersonFrontConversation instead:
 * ```typescript
 * import { ReactivePersonFrontConversation as PersonFrontConversation } from './reactive-person-front-conversation';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  PersonFrontConversationData,
  CreatePersonFrontConversationData,
  UpdatePersonFrontConversationData,
} from './types/person-front-conversation-data';

/**
 * ActiveRecord configuration for PersonFrontConversation
 */
const PersonFrontConversationConfig = {
  tableName: 'people_front_conversations',
  className: 'PersonFrontConversation',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * PersonFrontConversation ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const people_front_conversation = await PersonFrontConversation.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const people_front_conversation = await PersonFrontConversation.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newPersonFrontConversation = await PersonFrontConversation.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedPersonFrontConversation = await PersonFrontConversation.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await PersonFrontConversation.discard('123');
 *
 * // Restore discarded
 * await PersonFrontConversation.undiscard('123');
 *
 * // Query with scopes
 * const allPersonFrontConversations = await PersonFrontConversation.all().all();
 * const activePersonFrontConversations = await PersonFrontConversation.kept().all();
 * ```
 */
export const PersonFrontConversation = createActiveRecord<PersonFrontConversationData>(
  PersonFrontConversationConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type {
  PersonFrontConversationData,
  CreatePersonFrontConversationData,
  UpdatePersonFrontConversationData,
};

// Default export
export default PersonFrontConversation;
