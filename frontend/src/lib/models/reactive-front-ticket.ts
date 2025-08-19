/**
 * ReactiveFrontTicket - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for front_tickets table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use FrontTicket instead:
 * ```typescript
 * import { FrontTicket } from './front-ticket';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type {
  FrontTicketData,
  CreateFrontTicketData,
  UpdateFrontTicketData,
} from './types/front-ticket-data';

/**
 * ReactiveRecord configuration for FrontTicket
 */
const ReactiveFrontTicketConfig = {
  tableName: 'front_tickets',
  className: 'ReactiveFrontTicket',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveFrontTicket ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveFrontTicket } from '$lib/models/reactive-front-ticket';
 *
 *   // Reactive query - automatically updates when data changes
 *   const front_ticketQuery = ReactiveFrontTicket.find('123');
 *
 *   // Access reactive data
 *   $: front_ticket = front_ticketQuery.data;
 *   $: isLoading = front_ticketQuery.isLoading;
 *   $: error = front_ticketQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if front_ticket}
 *   <p>{front_ticket.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allFrontTicketsQuery = ReactiveFrontTicket.all().all();
 * const activeFrontTicketsQuery = ReactiveFrontTicket.kept().all();
 * const singleFrontTicketQuery = ReactiveFrontTicket.find('123');
 *
 * // With relationships
 * const front_ticketWithRelationsQuery = ReactiveFrontTicket
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredFrontTicketsQuery = ReactiveFrontTicket
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveFrontTicket = createReactiveRecord<FrontTicketData>(ReactiveFrontTicketConfig);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveFrontTicket as FrontTicket } from './reactive-front-ticket';
 *
 * // Use like ActiveRecord but with reactive queries
 * const front_ticketQuery = FrontTicket.find('123');
 * ```
 */
export { ReactiveFrontTicket as FrontTicket };

// Export types for convenience
export type { FrontTicketData, CreateFrontTicketData, UpdateFrontTicketData };

// Default export
export default ReactiveFrontTicket;
