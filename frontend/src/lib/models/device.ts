/**
 * Device - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for devices table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveDevice instead:
 * ```typescript
 * import { ReactiveDevice as Device } from './reactive-device';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type { DeviceData, CreateDeviceData, UpdateDeviceData } from './types/device-data';
import { registerModelRelationships } from './base/scoped-query-base';

/**
 * ActiveRecord configuration for Device
 */
const DeviceConfig = {
  tableName: 'devices',
  className: 'Device',
  primaryKey: 'id',
  supportsDiscard: false,
};

/**
 * Device ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const device = await Device.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const device = await Device.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newDevice = await Device.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedDevice = await Device.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await Device.discard('123');
 *
 * // Restore discarded
 * await Device.undiscard('123');
 *
 * // Query with scopes
 * const allDevices = await Device.all().all();
 * const activeDevices = await Device.kept().all();
 * ```
 */
export const Device = createActiveRecord<DeviceData>(DeviceConfig);

// Epic-009: Register model relationships for includes() functionality
registerModelRelationships('devices', {
  client: { type: 'belongsTo', model: 'Client' },
  person: { type: 'belongsTo', model: 'Person' },
  activityLogs: { type: 'hasMany', model: 'ActivityLog' },
});

// Export types for convenience
export type { DeviceData, CreateDeviceData, UpdateDeviceData };

// Default export
export default Device;
