/**
 * ReactiveParsedEmail - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for parsed_emails table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use ParsedEmail instead:
 * ```typescript
 * import { ParsedEmail } from './parsed-email';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  ParsedEmailData,
  CreateParsedEmailData,
  UpdateParsedEmailData,
} from './types/parsed-email-data';

/**
 * ReactiveRecord configuration for ParsedEmail
 */
const ReactiveParsedEmailConfig = {
  tableName: 'parsed_emails',
  className: 'ReactiveParsedEmail',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveParsedEmail ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveParsedEmail } from '$lib/models/reactive-parsed-email';
 *
 *   // Reactive query - automatically updates when data changes
 *   const parsed_emailQuery = ReactiveParsedEmail.find('123');
 *
 *   // Access reactive data
 *   $: parsed_email = parsed_emailQuery.data;
 *   $: isLoading = parsed_emailQuery.isLoading;
 *   $: error = parsed_emailQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if parsed_email}
 *   <p>{parsed_email.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allParsedEmailsQuery = ReactiveParsedEmail.all().all();
 * const activeParsedEmailsQuery = ReactiveParsedEmail.kept().all();
 * const singleParsedEmailQuery = ReactiveParsedEmail.find('123');
 *
 * // With relationships
 * const parsed_emailWithRelationsQuery = ReactiveParsedEmail
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredParsedEmailsQuery = ReactiveParsedEmail
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveParsedEmail = createReactiveRecord<ParsedEmailData>(ReactiveParsedEmailConfig);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveParsedEmail as ParsedEmail } from './reactive-parsed-email';
 *
 * // Use like ActiveRecord but with reactive queries
 * const parsed_emailQuery = ParsedEmail.find('123');
 * ```
 */
export { ReactiveParsedEmail as ParsedEmail };

// Export types for convenience
export type { ParsedEmailData, CreateParsedEmailData, UpdateParsedEmailData };

// Default export
export default ReactiveParsedEmail;
