/**
 * ReactiveFrontContact - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for front_contacts table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use FrontContact instead:
 * ```typescript
 * import { FrontContact } from './front-contact';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  FrontContactData,
  CreateFrontContactData,
  UpdateFrontContactData,
} from './types/front-contact-data';

/**
 * ReactiveRecord configuration for FrontContact
 */
const ReactiveFrontContactConfig = {
  tableName: 'front_contacts',
  className: 'ReactiveFrontContact',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveFrontContact ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveFrontContact } from '$lib/models/reactive-front-contact';
 *
 *   // Reactive query - automatically updates when data changes
 *   const front_contactQuery = ReactiveFrontContact.find('123');
 *
 *   // Access reactive data
 *   $: front_contact = front_contactQuery.data;
 *   $: isLoading = front_contactQuery.isLoading;
 *   $: error = front_contactQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if front_contact}
 *   <p>{front_contact.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allFrontContactsQuery = ReactiveFrontContact.all().all();
 * const activeFrontContactsQuery = ReactiveFrontContact.kept().all();
 * const singleFrontContactQuery = ReactiveFrontContact.find('123');
 *
 * // With relationships
 * const front_contactWithRelationsQuery = ReactiveFrontContact
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredFrontContactsQuery = ReactiveFrontContact
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveFrontContact = createReactiveRecord<FrontContactData>(
  ReactiveFrontContactConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveFrontContact as FrontContact } from './reactive-front-contact';
 *
 * // Use like ActiveRecord but with reactive queries
 * const front_contactQuery = FrontContact.find('123');
 * ```
 */
export { ReactiveFrontContact as FrontContact };

// Export types for convenience
export type { FrontContactData, CreateFrontContactData, UpdateFrontContactData };

// Default export
export default ReactiveFrontContact;
