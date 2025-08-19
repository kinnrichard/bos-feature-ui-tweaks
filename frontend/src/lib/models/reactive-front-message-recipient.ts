/**
 * ReactiveFrontMessageRecipient - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for front_message_recipients table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use FrontMessageRecipient instead:
 * ```typescript
 * import { FrontMessageRecipient } from './front-message-recipient';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  FrontMessageRecipientData,
  CreateFrontMessageRecipientData,
  UpdateFrontMessageRecipientData,
} from './types/front-message-recipient-data';

/**
 * ReactiveRecord configuration for FrontMessageRecipient
 */
const ReactiveFrontMessageRecipientConfig = {
  tableName: 'front_message_recipients',
  className: 'ReactiveFrontMessageRecipient',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveFrontMessageRecipient ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveFrontMessageRecipient } from '$lib/models/reactive-front-message-recipient';
 *
 *   // Reactive query - automatically updates when data changes
 *   const front_message_recipientQuery = ReactiveFrontMessageRecipient.find('123');
 *
 *   // Access reactive data
 *   $: front_message_recipient = front_message_recipientQuery.data;
 *   $: isLoading = front_message_recipientQuery.isLoading;
 *   $: error = front_message_recipientQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if front_message_recipient}
 *   <p>{front_message_recipient.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allFrontMessageRecipientsQuery = ReactiveFrontMessageRecipient.all().all();
 * const activeFrontMessageRecipientsQuery = ReactiveFrontMessageRecipient.kept().all();
 * const singleFrontMessageRecipientQuery = ReactiveFrontMessageRecipient.find('123');
 *
 * // With relationships
 * const front_message_recipientWithRelationsQuery = ReactiveFrontMessageRecipient
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredFrontMessageRecipientsQuery = ReactiveFrontMessageRecipient
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveFrontMessageRecipient = createReactiveRecord<FrontMessageRecipientData>(
  ReactiveFrontMessageRecipientConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveFrontMessageRecipient as FrontMessageRecipient } from './reactive-front-message-recipient';
 *
 * // Use like ActiveRecord but with reactive queries
 * const front_message_recipientQuery = FrontMessageRecipient.find('123');
 * ```
 */
export { ReactiveFrontMessageRecipient as FrontMessageRecipient };

// Export types for convenience
export type {
  FrontMessageRecipientData,
  CreateFrontMessageRecipientData,
  UpdateFrontMessageRecipientData,
};

// Default export
export default ReactiveFrontMessageRecipient;
