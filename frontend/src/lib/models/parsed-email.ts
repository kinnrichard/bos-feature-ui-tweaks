/**
 * ParsedEmail - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for parsed_emails table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveParsedEmail instead:
 * ```typescript
 * import { ReactiveParsedEmail as ParsedEmail } from './reactive-parsed-email';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  ParsedEmailData,
  CreateParsedEmailData,
  UpdateParsedEmailData,
} from './types/parsed-email-data';

/**
 * ActiveRecord configuration for ParsedEmail
 */
const ParsedEmailConfig = {
  tableName: 'parsed_emails',
  className: 'ParsedEmail',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ParsedEmail ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const parsed_email = await ParsedEmail.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const parsed_email = await ParsedEmail.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newParsedEmail = await ParsedEmail.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedParsedEmail = await ParsedEmail.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await ParsedEmail.discard('123');
 *
 * // Restore discarded
 * await ParsedEmail.undiscard('123');
 *
 * // Query with scopes
 * const allParsedEmails = await ParsedEmail.all().all();
 * const activeParsedEmails = await ParsedEmail.kept().all();
 * ```
 */
export const ParsedEmail = createActiveRecord<ParsedEmailData>(ParsedEmailConfig);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type { ParsedEmailData, CreateParsedEmailData, UpdateParsedEmailData };

// Default export
export default ParsedEmail;
