/**
 * ReactiveFrontInbox - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for front_inboxes table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use FrontInbox instead:
 * ```typescript
 * import { FrontInbox } from './front-inbox';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  FrontInboxData,
  CreateFrontInboxData,
  UpdateFrontInboxData,
} from './types/front-inbox-data';

/**
 * ReactiveRecord configuration for FrontInbox
 */
const ReactiveFrontInboxConfig = {
  tableName: 'front_inboxes',
  className: 'ReactiveFrontInbox',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveFrontInbox ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveFrontInbox } from '$lib/models/reactive-front-inbox';
 *
 *   // Reactive query - automatically updates when data changes
 *   const front_inboxQuery = ReactiveFrontInbox.find('123');
 *
 *   // Access reactive data
 *   $: front_inbox = front_inboxQuery.data;
 *   $: isLoading = front_inboxQuery.isLoading;
 *   $: error = front_inboxQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if front_inbox}
 *   <p>{front_inbox.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allFrontInboxsQuery = ReactiveFrontInbox.all().all();
 * const activeFrontInboxsQuery = ReactiveFrontInbox.kept().all();
 * const singleFrontInboxQuery = ReactiveFrontInbox.find('123');
 *
 * // With relationships
 * const front_inboxWithRelationsQuery = ReactiveFrontInbox
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredFrontInboxsQuery = ReactiveFrontInbox
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveFrontInbox = createReactiveRecord<FrontInboxData>(ReactiveFrontInboxConfig);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveFrontInbox as FrontInbox } from './reactive-front-inbox';
 *
 * // Use like ActiveRecord but with reactive queries
 * const front_inboxQuery = FrontInbox.find('123');
 * ```
 */
export { ReactiveFrontInbox as FrontInbox };

// Export types for convenience
export type { FrontInboxData, CreateFrontInboxData, UpdateFrontInboxData };

// Default export
export default ReactiveFrontInbox;
