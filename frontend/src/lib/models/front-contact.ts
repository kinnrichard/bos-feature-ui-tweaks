/**
 * FrontContact - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for front_contacts table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveFrontContact instead:
 * ```typescript
 * import { ReactiveFrontContact as FrontContact } from './reactive-front-contact';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  FrontContactData,
  CreateFrontContactData,
  UpdateFrontContactData,
} from './types/front-contact-data';

/**
 * Default values for FrontContact creation
 * These defaults match the database schema defaults
 */
const FrontContactDefaults: Partial<CreateFrontContactData> = {
  api_links: {},
  handles: [],
};

/**
 * ActiveRecord configuration for FrontContact
 */
const FrontContactConfig = {
  tableName: 'front_contacts',
  className: 'FrontContact',
  primaryKey: 'id',
  supportsDiscard: false,
  defaults: FrontContactDefaults,
};

/**
 * FrontContact ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const front_contact = await FrontContact.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const front_contact = await FrontContact.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newFrontContact = await FrontContact.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedFrontContact = await FrontContact.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await FrontContact.discard('123');
 *
 * // Restore discarded
 * await FrontContact.undiscard('123');
 *
 * // Query with scopes
 * const allFrontContacts = await FrontContact.all().all();
 * const activeFrontContacts = await FrontContact.kept().all();
 * ```
 */
export const FrontContact = createActiveRecord<FrontContactData>(FrontContactConfig);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type { FrontContactData, CreateFrontContactData, UpdateFrontContactData };

// Default export
export default FrontContact;
