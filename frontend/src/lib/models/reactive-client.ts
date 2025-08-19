/**
 * ReactiveClient - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for clients table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use Client instead:
 * ```typescript
 * import { Client } from './client';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type { ClientData, CreateClientData, UpdateClientData } from './types/client-data';
import { registerModelRelationships } from './base/scoped-query-base';

/**
 * ReactiveRecord configuration for Client
 */
const ReactiveClientConfig = {
  tableName: 'clients',
  className: 'ReactiveClient',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveClient ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveClient } from '$lib/models/reactive-client';
 *
 *   // Reactive query - automatically updates when data changes
 *   const clientQuery = ReactiveClient.find('123');
 *
 *   // Access reactive data
 *   $: client = clientQuery.data;
 *   $: isLoading = clientQuery.isLoading;
 *   $: error = clientQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if client}
 *   <p>{client.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allClientsQuery = ReactiveClient.all().all();
 * const activeClientsQuery = ReactiveClient.kept().all();
 * const singleClientQuery = ReactiveClient.find('123');
 *
 * // With relationships
 * const clientWithRelationsQuery = ReactiveClient
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredClientsQuery = ReactiveClient
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveClient = createReactiveRecord<ClientData>(ReactiveClientConfig);

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

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveClient as Client } from './reactive-client';
 *
 * // Use like ActiveRecord but with reactive queries
 * const clientQuery = Client.find('123');
 * ```
 */
export { ReactiveClient as Client };

// Export types for convenience
export type { ClientData, CreateClientData, UpdateClientData };

// Default export
export default ReactiveClient;
