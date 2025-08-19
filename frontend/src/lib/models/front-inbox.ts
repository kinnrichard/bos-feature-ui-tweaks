/**
 * FrontInbox - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for front_inboxes table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveFrontInbox instead:
 * ```typescript
 * import { ReactiveFrontInbox as FrontInbox } from './reactive-front-inbox';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  FrontInboxData,
  CreateFrontInboxData,
  UpdateFrontInboxData,
} from './types/front-inbox-data';

/**
 * Default values for FrontInbox creation
 * These defaults match the database schema defaults
 */
const FrontInboxDefaults: Partial<CreateFrontInboxData> = {
  api_links: {},
  settings: {},
};

/**
 * ActiveRecord configuration for FrontInbox
 */
const FrontInboxConfig = {
  tableName: 'front_inboxes',
  className: 'FrontInbox',
  primaryKey: 'id',
  supportsDiscard: false,
  defaults: FrontInboxDefaults,
};

/**
 * FrontInbox ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const front_inbox = await FrontInbox.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const front_inbox = await FrontInbox.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newFrontInbox = await FrontInbox.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedFrontInbox = await FrontInbox.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await FrontInbox.discard('123');
 *
 * // Restore discarded
 * await FrontInbox.undiscard('123');
 *
 * // Query with scopes
 * const allFrontInboxs = await FrontInbox.all().all();
 * const activeFrontInboxs = await FrontInbox.kept().all();
 * ```
 */
export const FrontInbox = createActiveRecord<FrontInboxData>(FrontInboxConfig);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type { FrontInboxData, CreateFrontInboxData, UpdateFrontInboxData };

// Default export
export default FrontInbox;
