/**
 * FrontConversation - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for front_conversations table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveFrontConversation instead:
 * ```typescript
 * import { ReactiveFrontConversation as FrontConversation } from './reactive-front-conversation';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  FrontConversationData,
  CreateFrontConversationData,
  UpdateFrontConversationData,
} from './types/front-conversation-data';

/**
 * Default values for FrontConversation creation
 * These defaults match the database schema defaults
 */
const FrontConversationDefaults: Partial<CreateFrontConversationData> = {
  api_links: {},
  custom_fields: {},
  is_private: false,
  links: [],
  metadata: {},
  scheduled_reminders: [],
};

/**
 * ActiveRecord configuration for FrontConversation
 */
const FrontConversationConfig = {
  tableName: 'front_conversations',
  className: 'FrontConversation',
  primaryKey: 'id',
  supportsDiscard: false,
  defaults: FrontConversationDefaults,
};

/**
 * FrontConversation ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const front_conversation = await FrontConversation.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const front_conversation = await FrontConversation.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newFrontConversation = await FrontConversation.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedFrontConversation = await FrontConversation.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await FrontConversation.discard('123');
 *
 * // Restore discarded
 * await FrontConversation.undiscard('123');
 *
 * // Query with scopes
 * const allFrontConversations = await FrontConversation.all().all();
 * const activeFrontConversations = await FrontConversation.kept().all();
 * ```
 */
export const FrontConversation = createActiveRecord<FrontConversationData>(FrontConversationConfig);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type { FrontConversationData, CreateFrontConversationData, UpdateFrontConversationData };

// Default export
export default FrontConversation;
