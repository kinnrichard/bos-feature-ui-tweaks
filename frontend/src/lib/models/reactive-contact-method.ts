/**
 * ReactiveContactMethod - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for contact_methods table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use ContactMethod instead:
 * ```typescript
 * import { ContactMethod } from './contact-method';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  ContactMethodData,
  CreateContactMethodData,
  UpdateContactMethodData,
} from './types/contact-method-data';
import { registerModelRelationships } from './base/scoped-query-base';

/**
 * ReactiveRecord configuration for ContactMethod
 */
const ReactiveContactMethodConfig = {
  tableName: 'contact_methods',
  className: 'ReactiveContactMethod',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveContactMethod ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveContactMethod } from '$lib/models/reactive-contact-method';
 *
 *   // Reactive query - automatically updates when data changes
 *   const contact_methodQuery = ReactiveContactMethod.find('123');
 *
 *   // Access reactive data
 *   $: contact_method = contact_methodQuery.data;
 *   $: isLoading = contact_methodQuery.isLoading;
 *   $: error = contact_methodQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if contact_method}
 *   <p>{contact_method.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allContactMethodsQuery = ReactiveContactMethod.all().all();
 * const activeContactMethodsQuery = ReactiveContactMethod.kept().all();
 * const singleContactMethodQuery = ReactiveContactMethod.find('123');
 *
 * // With relationships
 * const contact_methodWithRelationsQuery = ReactiveContactMethod
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredContactMethodsQuery = ReactiveContactMethod
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveContactMethod = createReactiveRecord<ContactMethodData>(
  ReactiveContactMethodConfig
);

// Epic-009: Register model relationships for includes() functionality
registerModelRelationships('contact_methods', {
  person: { type: 'belongsTo', model: 'Person' },
  frontConversations: { type: 'hasMany', model: 'FrontConversation' },
  frontMessageRecipients: { type: 'hasMany', model: 'FrontMessageRecipient' },
});

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveContactMethod as ContactMethod } from './reactive-contact-method';
 *
 * // Use like ActiveRecord but with reactive queries
 * const contact_methodQuery = ContactMethod.find('123');
 * ```
 */
export { ReactiveContactMethod as ContactMethod };

// Export types for convenience
export type { ContactMethodData, CreateContactMethodData, UpdateContactMethodData };

// Default export
export default ReactiveContactMethod;
