/**
 * FrontTeammate - ActiveRecord model (non-reactive)
 *
 * Promise-based Rails-compatible model for front_teammates table.
 * Use this for server-side code, Node.js scripts, or non-reactive contexts.
 *
 * For reactive Svelte components, use ReactiveFrontTeammate instead:
 * ```typescript
 * import { ReactiveFrontTeammate as FrontTeammate } from './reactive-front-teammate';
 * ```
 */

import { createActiveRecord } from './base/active-record';
import type {
  FrontTeammateData,
  CreateFrontTeammateData,
  UpdateFrontTeammateData,
} from './types/front-teammate-data';

/**
 * Default values for FrontTeammate creation
 * These defaults match the database schema defaults
 */
const FrontTeammateDefaults: Partial<CreateFrontTeammateData> = {
  api_links: {},
  custom_fields: {},
  is_admin: false,
  is_available: true,
  is_blocked: false,
};

/**
 * ActiveRecord configuration for FrontTeammate
 */
const FrontTeammateConfig = {
  tableName: 'front_teammates',
  className: 'FrontTeammate',
  primaryKey: 'id',
  supportsDiscard: false,
  defaults: FrontTeammateDefaults,
};

/**
 * FrontTeammate ActiveRecord instance
 *
 * @example
 * ```typescript
 * // Find by ID (throws if not found)
 * const front_teammate = await FrontTeammate.find('123');
 *
 * // Find by conditions (returns null if not found)
 * const front_teammate = await FrontTeammate.findBy({ title: 'Test' });
 *
 * // Create new record
 * const newFrontTeammate = await FrontTeammate.create({ title: 'New Task' });
 *
 * // Update existing record
 * const updatedFrontTeammate = await FrontTeammate.update('123', { title: 'Updated' });
 *
 * // Soft delete (discard gem)
 * await FrontTeammate.discard('123');
 *
 * // Restore discarded
 * await FrontTeammate.undiscard('123');
 *
 * // Query with scopes
 * const allFrontTeammates = await FrontTeammate.all().all();
 * const activeFrontTeammates = await FrontTeammate.kept().all();
 * ```
 */
export const FrontTeammate = createActiveRecord<FrontTeammateData>(FrontTeammateConfig);

// Epic-009: Register model relationships for includes() functionality
// No relationships defined for this model

// Export types for convenience
export type { FrontTeammateData, CreateFrontTeammateData, UpdateFrontTeammateData };

// Default export
export default FrontTeammate;
