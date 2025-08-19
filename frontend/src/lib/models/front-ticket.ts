/**
 * FrontTicket - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for front_tickets table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveFrontTicket instead:
 * ```typescript
 * import { ReactiveFrontTicket as FrontTicket } from './reactive-front-ticket';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  FrontTicketData,
  CreateFrontTicketData,
  UpdateFrontTicketData,
} from './types/front-ticket-data';

/**
 * ActiveRecord configuration for FrontTicket
 */
const FrontTicketConfig = {
  tableName: 'front_tickets',
  className: 'FrontTicket',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * FrontTicket ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const front_ticket = await FrontTicket.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const front_ticket = await FrontTicket.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newFrontTicket = await FrontTicket.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedFrontTicket = await FrontTicket.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await FrontTicket.discard('123');
 *
 * // Restore discarded
 * await FrontTicket.undiscard('123');
 *
 * // Query with scopes
 * const allFrontTickets = await FrontTicket.all().all();
 * const activeFrontTickets = await FrontTicket.kept().all();
 * ```
 */
export const FrontTicket = createActiveRecord<FrontTicketData>(FrontTicketConfig);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type { FrontTicketData, CreateFrontTicketData, UpdateFrontTicketData };

// Default export
export default FrontTicket;
