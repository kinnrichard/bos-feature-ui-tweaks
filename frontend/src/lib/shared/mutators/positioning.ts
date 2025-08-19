/**
 * Positioning Mutator
 * Provides offline-capable positioning that matches Rails positioning gem API
 *
 * Handles automatic position assignment with offline conflict resolution:
 * - New records get positioned at end of list (max position + 1)
 * - Position updates are cached offline and resolved server-side
 * - Supports scoped positioning (e.g., tasks within a job)
 */

import type { MutatorContext, MutatorFunction } from './base-mutator';

/**
 * Interface for records that support positioning
 */
export interface Positionable {
  position?: number;
  [key: string]: any; // Allow for scope fields like job_id, parent_id etc
}

/**
 * Configuration for positioning behavior
 */
export interface PositioningConfig {
  /** Position field name (defaults to 'position') */
  positionField?: string;
  /** Scope fields that group positioning (e.g., ['job_id'] means position is scoped within job) */
  scopeFields?: string[];
  /** Whether to allow manual position assignment (defaults to true) */
  allowManualPositioning?: boolean;
}

/**
 * Default positioning configuration
 */
const DEFAULT_POSITIONING_CONFIG: Required<PositioningConfig> = {
  positionField: 'position',
  scopeFields: [],
  allowManualPositioning: true,
};

/**
 * Cache for tracking next positions in offline scenarios
 * Key format: "tableName:scopeValue1:scopeValue2:..."
 */
const offlinePositionCache = new Map<string, number>();

/**
 * Generate cache key for position tracking
 */
function generatePositionCacheKey(tableName: string, data: any, scopeFields: string[]): string {
  const scopeValues = scopeFields.map((field) => data[field] || 'null').join(':');
  return scopeFields.length > 0 ? `${tableName}:${scopeValues}` : tableName;
}

/**
 * Get next available position for offline scenarios
 * Uses cached values to prevent conflicts when multiple records are created offline
 */
function getNextOfflinePosition(tableName: string, data: any, scopeFields: string[]): number {
  const cacheKey = generatePositionCacheKey(tableName, data, scopeFields);
  const currentMax = offlinePositionCache.get(cacheKey) || 0;
  const nextPosition = currentMax + 1;
  offlinePositionCache.set(cacheKey, nextPosition);
  return nextPosition;
}

/**
 * Clear position cache for a specific scope (useful when coming back online)
 */
export function clearPositionCache(
  tableName?: string,
  scopeData: any = {},
  scopeFields: string[] = []
): void {
  if (tableName === undefined) {
    // Clear all cache entries
    offlinePositionCache.clear();
  } else {
    const cacheKey = generatePositionCacheKey(tableName, scopeData, scopeFields);
    offlinePositionCache.delete(cacheKey);
  }
}

/**
 * Create positioning mutator for a specific table and configuration
 */
export function createPositioningMutator(
  tableName: string,
  config: PositioningConfig = {}
): MutatorFunction<Positionable> {
  const finalConfig = { ...DEFAULT_POSITIONING_CONFIG, ...config };

  return (data: Positionable, context?: MutatorContext): Positionable => {
    const { positionField, scopeFields, allowManualPositioning } = finalConfig;

    // Skip positioning if:
    // 1. This is an update and position isn't being changed
    // 2. Manual positioning is disabled and a position was provided
    if (context?.action === 'update' && !(positionField in data)) {
      return data;
    }

    if (!allowManualPositioning && data[positionField] !== undefined) {
      // Remove manually set position if not allowed and assign new position
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [positionField]: _position, ...dataWithoutPosition } = data;
      const nextPosition = context?.offline
        ? getNextOfflinePosition(tableName, data, scopeFields)
        : Date.now(); // Use timestamp for online scenarios to avoid conflicts

      return {
        ...dataWithoutPosition,
        [positionField]: nextPosition,
      };
    }

    // If position is already set and manual positioning is allowed, keep it
    if (allowManualPositioning && data[positionField] !== undefined) {
      return data;
    }

    // For new records or updates without position, assign next position
    if (
      context?.action === 'create' ||
      (context?.action === 'update' && data[positionField] === undefined)
    ) {
      const nextPosition = context?.offline
        ? getNextOfflinePosition(tableName, data, scopeFields)
        : Date.now(); // Use timestamp for online scenarios to avoid conflicts

      return {
        ...data,
        [positionField]: nextPosition,
      };
    }

    return data;
  };
}

/**
 * Rails positioning gem compatible methods
 * These can be used in components for repositioning operations
 */
export class PositionManager {
  constructor(
    private tableName: string,
    private config: PositioningConfig = {}
  ) {}

  /**
   * Move record to specific position (Rails: move_to!)
   * This creates update data that will be handled by the positioning mutator
   */
  moveTo(newPosition: number): Partial<Positionable> {
    const positionField = this.config.positionField || 'position';
    return {
      [positionField]: newPosition,
    };
  }

  /**
   * Move record to top (Rails: move_to_top!)
   */
  moveToTop(): Partial<Positionable> {
    return this.moveTo(1);
  }

  /**
   * Move record to bottom (Rails: move_to_bottom!)
   * In offline scenarios, this uses a high timestamp
   */
  moveToBottom(): Partial<Positionable> {
    const positionField = this.config.positionField || 'position';
    return {
      [positionField]: Date.now() + 1000000, // Ensure it's higher than auto-assigned positions
    };
  }

  /**
   * Move record higher by one position (Rails: move_higher!)
   * Note: This requires knowing current position, typically used in UI with current data
   */
  moveHigher(currentPosition: number): Partial<Positionable> {
    return this.moveTo(Math.max(1, currentPosition - 1));
  }

  /**
   * Move record lower by one position (Rails: move_lower!)
   */
  moveLower(currentPosition: number): Partial<Positionable> {
    return this.moveTo(currentPosition + 1);
  }
}

/**
 * Common positioning mutators for typical use cases
 */

/**
 * Task positioning (scoped by job_id)
 */
export const taskPositioningMutator = createPositioningMutator('tasks', {
  scopeFields: ['job_id'],
  allowManualPositioning: true,
});

/**
 * Task positioning manager for UI operations
 */
export const TaskPositionManager = new PositionManager('tasks', {
  scopeFields: ['job_id'],
});

/**
 * Generic positioning (no scope)
 */
export const genericPositioningMutator = createPositioningMutator('generic');

/**
 * Generic positioning manager
 */
export const GenericPositionManager = new PositionManager('generic');

/**
 * Type helpers for positioning
 */
export type PositionUpdateData<T> = T & Partial<Positionable>;
