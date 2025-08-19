/**
 * ReactiveDevice - ReactiveRecord model (Svelte 5 reactive)
 *
 * Read-only reactive Rails-compatible model for devices table.
 * Automatically updates Svelte components when data changes.
 *
 * For mutations (create/update/delete) or non-reactive contexts, use Device instead:
 * ```typescript
 * import { Device } from './device';
 * ```
 */

import { createReactiveRecord } from './base/reactive-record';
import type { DeviceData, CreateDeviceData, UpdateDeviceData } from './types/device-data';
import { registerModelRelationships } from './base/scoped-query-base';

/**
 * ReactiveRecord configuration for Device
 */
const ReactiveDeviceConfig = {
  tableName: 'devices',
  className: 'ReactiveDevice',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * ReactiveDevice ReactiveRecord instance
 *
 * @example
 * ```svelte
 * <!-- In Svelte component -->
 * <script>
 *   import { ReactiveDevice } from '$lib/models/reactive-device';
 *
 *   // Reactive query - automatically updates when data changes
 *   const deviceQuery = ReactiveDevice.find('123');
 *
 *   // Access reactive data
 *   $: device = deviceQuery.data;
 *   $: isLoading = deviceQuery.isLoading;
 *   $: error = deviceQuery.error;
 * </script>
 *
 * {#if isLoading}
 *   Loading...
 * {:else if error}
 *   Error: {error.message}
 * {:else if device}
 *   <p>{device.title}</p>
 * {/if}
 * ```
 *
 * @example
 * ```typescript
 * // Reactive queries that automatically update
 * const allDevicesQuery = ReactiveDevice.all().all();
 * const activeDevicesQuery = ReactiveDevice.kept().all();
 * const singleDeviceQuery = ReactiveDevice.find('123');
 *
 * // With relationships
 * const deviceWithRelationsQuery = ReactiveDevice
 *   .includes('client', 'tasks')
 *   .find('123');
 *
 * // Complex queries
 * const filteredDevicesQuery = ReactiveDevice
 *   .where({ status: 'active' })
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .all();
 * ```
 */
export const ReactiveDevice = createReactiveRecord<DeviceData>(ReactiveDeviceConfig);

// Epic-009: Register model relationships for includes() functionality
registerModelRelationships('devices', {
  client: { type: 'belongsTo', model: 'Client' },
  person: { type: 'belongsTo', model: 'Person' },
  activityLogs: { type: 'hasMany', model: 'ActivityLog' },
});

/**
 * Import alias for easy switching between reactive/non-reactive
 *
 * @example
 * ```typescript
 * // Use reactive model in Svelte components
 * import { ReactiveDevice as Device } from './reactive-device';
 *
 * // Use like ActiveRecord but with reactive queries
 * const deviceQuery = Device.find('123');
 * ```
 */
export { ReactiveDevice as Device };

// Export types for convenience
export type { DeviceData, CreateDeviceData, UpdateDeviceData };

// Default export
export default ReactiveDevice;
