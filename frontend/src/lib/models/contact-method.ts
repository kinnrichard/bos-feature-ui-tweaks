/**
 * ContactMethod - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for contact_methods table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveContactMethod instead:
 * ```typescript
 * import { ReactiveContactMethod as ContactMethod } from './reactive-contact-method';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  ContactMethodData,
  CreateContactMethodData,
  UpdateContactMethodData,
} from './types/contact-method-data';
import { registerModelRelationships } from './base/scoped-query-base';

/**
 * ActiveRecord configuration for ContactMethod
 */
const ContactMethodConfig = {
  tableName: 'contact_methods',
  className: 'ContactMethod',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ContactMethod ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const contact_method = await ContactMethod.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const contact_method = await ContactMethod.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newContactMethod = await ContactMethod.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedContactMethod = await ContactMethod.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await ContactMethod.discard('123');
 *
 * // Restore discarded
 * await ContactMethod.undiscard('123');
 *
 * // Query with scopes
 * const allContactMethods = await ContactMethod.all().all();
 * const activeContactMethods = await ContactMethod.kept().all();
 * ```
 */
export const ContactMethod = createActiveRecord<ContactMethodData>(ContactMethodConfig);

// Epic-009: Register model relationships for includes() functionality
registerModelRelationships('contact_methods', {
  person: { type: 'belongsTo', model: 'Person' },
  frontConversations: { type: 'hasMany', model: 'FrontConversation' },
  frontMessageRecipients: { type: 'hasMany', model: 'FrontMessageRecipient' },
});

// Export types for convenience
export type { ContactMethodData, CreateContactMethodData, UpdateContactMethodData };

// Default export
export default ContactMethod;
