/**
 * ReactiveFrontMessage - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for front_messages table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use FrontMessage instead:
 * ```typescript
 * import { FrontMessage } from './front-message';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  FrontMessageData,
  CreateFrontMessageData,
  UpdateFrontMessageData,
} from './types/front-message-data';
import { declarePolymorphicRelationships } from '../zero/polymorphic';

/**
 * ReactiveRecord configuration for FrontMessage
 */
const ReactiveFrontMessageConfig = {
  tableName: 'front_messages',
  className: 'ReactiveFrontMessage',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveFrontMessage ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveFrontMessage } from '$lib/models/reactive-front-message';
 *
 *   // Reactive query - automatically updates when data changes
 *   const front_messageQuery = ReactiveFrontMessage.find('123');
 *
 *   // Access reactive data
 *   $: front_message = front_messageQuery.data;
 *   $: isLoading = front_messageQuery.isLoading;
 *   $: error = front_messageQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if front_message}
 *   <p>{front_message.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allFrontMessagesQuery = ReactiveFrontMessage.all().all();
 * const activeFrontMessagesQuery = ReactiveFrontMessage.kept().all();
 * const singleFrontMessageQuery = ReactiveFrontMessage.find('123');
 *
 * // With relationships
 * const front_messageWithRelationsQuery = ReactiveFrontMessage
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredFrontMessagesQuery = ReactiveFrontMessage
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveFrontMessage = createReactiveRecord<FrontMessageData>(
  ReactiveFrontMessageConfig
);

// EP-0036: Polymorphic relationship declarations
declarePolymorphicRelationships({
  tableName: 'front_messages',
  belongsTo: {
    author: {
      typeField: 'author_type',
      idField: 'author_id',
      allowedTypes: ['frontcontact', 'frontteammate'],
    },
  },
});

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveFrontMessage as FrontMessage } from './reactive-front-message';
 *
 * // Use like ActiveRecord but with reactive queries
 * const front_messageQuery = FrontMessage.find('123');
 * ```
 */
export { ReactiveFrontMessage as FrontMessage };

// Export types for convenience
export type { FrontMessageData, CreateFrontMessageData, UpdateFrontMessageData };

// Default export
export default ReactiveFrontMessage;
