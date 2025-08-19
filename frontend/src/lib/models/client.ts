/**
 * Client - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for clients table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveClient instead:
 * ```typescript
 * import { ReactiveClient as Client } from './reactive-client';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type { ClientData, CreateClientData, UpdateClientData } from './types/client-data';
import { registerModelRelationships } from './base/scoped-query-base';

/**
 * ActiveRecord configuration for Client
 */
const ClientConfig = {
  tableName: 'clients',
  className: 'Client',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * Client ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const client = await Client.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const client = await Client.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newClient = await Client.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedClient = await Client.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await Client.discard('123');
 *
 * // Restore discarded
 * await Client.undiscard('123');
 *
 * // Query with scopes
 * const allClients = await Client.all().all();
 * const activeClients = await Client.kept().all();
 * ```
 */
export const Client = createActiveRecord<ClientData>(ClientConfig);

// Epic-009: Register model relationships for includes() functionality
registerModelRelationships('clients', {
  activityLogs: { type: 'hasMany', model: 'ActivityLog' },
  people: { type: 'hasMany', model: 'Person' },
  jobs: { type: 'hasMany', model: 'Job' },
  devices: { type: 'hasMany', model: 'Device' },
  peopleGroups: { type: 'hasMany', model: 'PeopleGroup' },
  clientsFrontConversations: { type: 'hasMany', model: 'ClientsFrontConversation' },
  frontConversations: { type: 'hasMany', model: 'FrontConversation' },
});

// Export types for convenience
export type { ClientData, CreateClientData, UpdateClientData };

// Default export
export default Client;
