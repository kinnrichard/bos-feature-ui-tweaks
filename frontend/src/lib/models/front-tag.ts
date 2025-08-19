/**
 * FrontTag - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for front_tags table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveFrontTag instead:
 * ```typescript
 * import { ReactiveFrontTag as FrontTag } from './reactive-front-tag';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type { FrontTagData, CreateFrontTagData, UpdateFrontTagData } from './types/front-tag-data';

/**
 * Default values for FrontTag creation
 * These defaults match the database schema defaults
 */
const FrontTagDefaults: Partial<CreateFrontTagData> = {
  is_private: false,
  is_visible_in_conversation_lists: false,
};

/**
 * ActiveRecord configuration for FrontTag
 */
const FrontTagConfig = {
  tableName: 'front_tags',
  className: 'FrontTag',
  primaryKey: 'id',
  supportsDiscard: false,
  defaults: FrontTagDefaults,
};

/**
 * FrontTag ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const front_tag = await FrontTag.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const front_tag = await FrontTag.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newFrontTag = await FrontTag.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedFrontTag = await FrontTag.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await FrontTag.discard('123');
 *
 * // Restore discarded
 * await FrontTag.undiscard('123');
 *
 * // Query with scopes
 * const allFrontTags = await FrontTag.all().all();
 * const activeFrontTags = await FrontTag.kept().all();
 * ```
 */
export const FrontTag = createActiveRecord<FrontTagData>(FrontTagConfig);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type { FrontTagData, CreateFrontTagData, UpdateFrontTagData };

// Default export
export default FrontTag;
