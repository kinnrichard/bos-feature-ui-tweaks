/**
 * FrontMessage - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for front_messages table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveFrontMessage instead:
 * ```typescript
 * import { ReactiveFrontMessage as FrontMessage } from './reactive-front-message';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  FrontMessageData,
  CreateFrontMessageData,
  UpdateFrontMessageData,
} from './types/front-message-data';
import { declarePolymorphicRelationships } from '../zero/polymorphic';

/**
 * Default values for FrontMessage creation
 * These defaults match the database schema defaults
 */
const FrontMessageDefaults: Partial<CreateFrontMessageData> = {
  api_links: {},
  is_draft: false,
  is_inbound: true,
  metadata: {},
};

/**
 * ActiveRecord configuration for FrontMessage
 */
const FrontMessageConfig = {
  tableName: 'front_messages',
  className: 'FrontMessage',
  primaryKey: 'id',
  supportsDiscard: false,
  defaults: FrontMessageDefaults,
};

/**
 * FrontMessage ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const front_message = await FrontMessage.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const front_message = await FrontMessage.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newFrontMessage = await FrontMessage.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedFrontMessage = await FrontMessage.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await FrontMessage.discard('123');
 *
 * // Restore discarded
 * await FrontMessage.undiscard('123');
 *
 * // Query with scopes
 * const allFrontMessages = await FrontMessage.all().all();
 * const activeFrontMessages = await FrontMessage.kept().all();
 * ```
 */
export const FrontMessage = createActiveRecord<FrontMessageData>(FrontMessageConfig);

// EP-0036: Polymorphic relationship declarations
declarePolymorphicRelationships({
  tableName: 'front_messages',
  belongsTo: {
    author: {
      typeField: 'author_type',
      idField: 'author_id',
      allowedTypes: ['frontcontact', 'frontteammate'],
    },
  },
});

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type { FrontMessageData, CreateFrontMessageData, UpdateFrontMessageData };

// Default export
export default FrontMessage;
