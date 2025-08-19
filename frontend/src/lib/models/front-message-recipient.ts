/**
 * FrontMessageRecipient - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for front_message_recipients table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveFrontMessageRecipient instead:
 * ```typescript
 * import { ReactiveFrontMessageRecipient as FrontMessageRecipient } from './reactive-front-message-recipient';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  FrontMessageRecipientData,
  CreateFrontMessageRecipientData,
  UpdateFrontMessageRecipientData,
} from './types/front-message-recipient-data';

/**
 * Default values for FrontMessageRecipient creation
 * These defaults match the database schema defaults
 */
const FrontMessageRecipientDefaults: Partial<CreateFrontMessageRecipientData> = {
  api_links: {},
};

/**
 * ActiveRecord configuration for FrontMessageRecipient
 */
const FrontMessageRecipientConfig = {
  tableName: 'front_message_recipients',
  className: 'FrontMessageRecipient',
  primaryKey: 'id',
  supportsDiscard: false,
  defaults: FrontMessageRecipientDefaults,
};

/**
 * FrontMessageRecipient ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const front_message_recipient = await FrontMessageRecipient.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const front_message_recipient = await FrontMessageRecipient.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newFrontMessageRecipient = await FrontMessageRecipient.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedFrontMessageRecipient = await FrontMessageRecipient.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await FrontMessageRecipient.discard('123');
 *
 * // Restore discarded
 * await FrontMessageRecipient.undiscard('123');
 *
 * // Query with scopes
 * const allFrontMessageRecipients = await FrontMessageRecipient.all().all();
 * const activeFrontMessageRecipients = await FrontMessageRecipient.kept().all();
 * ```
 */
export const FrontMessageRecipient = createActiveRecord<FrontMessageRecipientData>(
  FrontMessageRecipientConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type {
  FrontMessageRecipientData,
  CreateFrontMessageRecipientData,
  UpdateFrontMessageRecipientData,
};

// Default export
export default FrontMessageRecipient;
