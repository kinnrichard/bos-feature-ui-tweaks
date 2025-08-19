/**
 * ReactiveFrontAttachment - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for front_attachments table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use FrontAttachment instead:
 * ```typescript
 * import { FrontAttachment } from './front-attachment';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  FrontAttachmentData,
  CreateFrontAttachmentData,
  UpdateFrontAttachmentData,
} from './types/front-attachment-data';

/**
 * ReactiveRecord configuration for FrontAttachment
 */
const ReactiveFrontAttachmentConfig = {
  tableName: 'front_attachments',
  className: 'ReactiveFrontAttachment',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveFrontAttachment ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveFrontAttachment } from '$lib/models/reactive-front-attachment';
 *
 *   // Reactive query - automatically updates when data changes
 *   const front_attachmentQuery = ReactiveFrontAttachment.find('123');
 *
 *   // Access reactive data
 *   $: front_attachment = front_attachmentQuery.data;
 *   $: isLoading = front_attachmentQuery.isLoading;
 *   $: error = front_attachmentQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if front_attachment}
 *   <p>{front_attachment.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allFrontAttachmentsQuery = ReactiveFrontAttachment.all().all();
 * const activeFrontAttachmentsQuery = ReactiveFrontAttachment.kept().all();
 * const singleFrontAttachmentQuery = ReactiveFrontAttachment.find('123');
 *
 * // With relationships
 * const front_attachmentWithRelationsQuery = ReactiveFrontAttachment
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredFrontAttachmentsQuery = ReactiveFrontAttachment
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveFrontAttachment = createReactiveRecord<FrontAttachmentData>(
  ReactiveFrontAttachmentConfig
);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveFrontAttachment as FrontAttachment } from './reactive-front-attachment';
 *
 * // Use like ActiveRecord but with reactive queries
 * const front_attachmentQuery = FrontAttachment.find('123');
 * ```
 */
export { ReactiveFrontAttachment as FrontAttachment };

// Export types for convenience
export type { FrontAttachmentData, CreateFrontAttachmentData, UpdateFrontAttachmentData };

// Default export
export default ReactiveFrontAttachment;
