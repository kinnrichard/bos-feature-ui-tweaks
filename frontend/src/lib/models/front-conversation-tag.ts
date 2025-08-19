/**
 * FrontConversationTag - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for front_conversation_tags table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveFrontConversationTag instead:
 * ```typescript
 * import { ReactiveFrontConversationTag as FrontConversationTag } from './reactive-front-conversation-tag';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  FrontConversationTagData,
  CreateFrontConversationTagData,
  UpdateFrontConversationTagData,
} from './types/front-conversation-tag-data';

/**
 * ActiveRecord configuration for FrontConversationTag
 */
const FrontConversationTagConfig = {
  tableName: 'front_conversation_tags',
  className: 'FrontConversationTag',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * FrontConversationTag ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const front_conversation_tag = await FrontConversationTag.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const front_conversation_tag = await FrontConversationTag.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newFrontConversationTag = await FrontConversationTag.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedFrontConversationTag = await FrontConversationTag.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await FrontConversationTag.discard('123');
 *
 * // Restore discarded
 * await FrontConversationTag.undiscard('123');
 *
 * // Query with scopes
 * const allFrontConversationTags = await FrontConversationTag.all().all();
 * const activeFrontConversationTags = await FrontConversationTag.kept().all();
 * ```
 */
export const FrontConversationTag = createActiveRecord<FrontConversationTagData>(
  FrontConversationTagConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type {
  FrontConversationTagData,
  CreateFrontConversationTagData,
  UpdateFrontConversationTagData,
};

// Default export
export default FrontConversationTag;
