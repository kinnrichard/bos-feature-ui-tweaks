/**
 * FrontAttachment - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for front_attachments table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveFrontAttachment instead:
 * ```typescript
 * import { ReactiveFrontAttachment as FrontAttachment } from './reactive-front-attachment';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  FrontAttachmentData,
  CreateFrontAttachmentData,
  UpdateFrontAttachmentData,
} from './types/front-attachment-data';

/**
 * ActiveRecord configuration for FrontAttachment
 */
const FrontAttachmentConfig = {
  tableName: 'front_attachments',
  className: 'FrontAttachment',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * FrontAttachment ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const front_attachment = await FrontAttachment.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const front_attachment = await FrontAttachment.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newFrontAttachment = await FrontAttachment.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedFrontAttachment = await FrontAttachment.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await FrontAttachment.discard('123');
 *
 * // Restore discarded
 * await FrontAttachment.undiscard('123');
 *
 * // Query with scopes
 * const allFrontAttachments = await FrontAttachment.all().all();
 * const activeFrontAttachments = await FrontAttachment.kept().all();
 * ```
 */
export const FrontAttachment = createActiveRecord<FrontAttachmentData>(FrontAttachmentConfig);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type { FrontAttachmentData, CreateFrontAttachmentData, UpdateFrontAttachmentData };

// Default export
export default FrontAttachment;
