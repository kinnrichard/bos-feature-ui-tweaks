/**
 * Positioning Mutator V2 - Fractional Positioning
 * 
 * Implements fractional positioning for conflict-free insertions between tasks.
 * This solves the bug where inserting tasks between existing ones causes collisions.
 * 
 * Key improvements:
 * - Uses fractional positions (1.5 between 1 and 2)
 * - Prevents position collisions when inserting between tasks
 * - Works seamlessly with offline/online scenarios
 * - Compatible with Rails positioning gem on server side
 */

import type { MutatorContext, MutatorFunction } from './base-mutator';
import { getZero } from '../../zero/zero-client';

export interface PositionableV2 {
  id?: string;
  position?: number;
  [key: string]: any;
}

export interface PositioningConfigV2 {
  positionField?: string;
  scopeFields?: string[];
  allowManualPositioning?: boolean;
  defaultGap?: number; // Gap between positions for new items
}

const DEFAULT_CONFIG: Required<PositioningConfigV2> = {
  positionField: 'position',
  scopeFields: [],
  allowManualPositioning: true,
  defaultGap: 1000 // Large gap to allow many insertions
};

/**
 * Calculate position for inserting between two items
 */
function calculateInsertPosition(
  beforePos: number | undefined,
  afterPos: number | undefined,
  defaultGap: number
): number {
  // If no before position (inserting at start)
  if (beforePos === undefined && afterPos !== undefined) {
    return afterPos / 2;
  }
  
  // If no after position (inserting at end)
  if (beforePos !== undefined && afterPos === undefined) {
    return beforePos + defaultGap;
  }
  
  // If both positions exist (inserting between)
  if (beforePos !== undefined && afterPos !== undefined) {
    return (beforePos + afterPos) / 2;
  }
  
  // If no positions at all (first item)
  return defaultGap;
}

/**
 * Get adjacent positions for a given insert position
 */
async function getAdjacentPositions(
  tableName: string,
  scopeConditions: Record<string, any>,
  insertAfterPosition?: number,
  positionField: string = 'position'
): Promise<{ before?: number; after?: number }> {
  const zero = getZero();
  if (!zero) return {};
  
  try {
    // Build query for items in the same scope
    let query = (zero.query as any)[tableName];
    
    // Apply scope conditions
    for (const [field, value] of Object.entries(scopeConditions)) {
      query = query.where(field, value);
    }
    
    // Get all items ordered by position
    const items = await query.orderBy(positionField, 'asc').run();
    
    if (!items || items.length === 0) {
      return {};
    }
    
    // If no insert position specified, we're appending
    if (insertAfterPosition === undefined) {
      const lastItem = items[items.length - 1];
      return { before: lastItem[positionField] };
    }
    
    // Find the item we're inserting after and the next item
    let afterIndex = -1;
    for (let i = 0; i < items.length; i++) {
      if (items[i][positionField] >= insertAfterPosition) {
        afterIndex = i;
        break;
      }
    }
    
    if (afterIndex === -1) {
      // Inserting after all items
      return { before: items[items.length - 1][positionField] };
    } else if (afterIndex === 0) {
      // Inserting before all items
      return { after: items[0][positionField] };
    } else {
      // Inserting between two items
      return {
        before: items[afterIndex - 1][positionField],
        after: items[afterIndex][positionField]
      };
    }
  } catch (error) {
    console.warn('Failed to get adjacent positions:', error);
    return {};
  }
}

/**
 * Create enhanced positioning mutator with fractional positioning
 */
export function createPositioningMutatorV2(
  tableName: string,
  config: PositioningConfigV2 = {}
): MutatorFunction<PositionableV2> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  return async (data: PositionableV2, context: MutatorContext): Promise<PositionableV2> => {
    const { positionField, scopeFields, allowManualPositioning, defaultGap } = finalConfig;
    
    // Skip if updating and position not changing
    if (context.action === 'update' && !(positionField in data)) {
      return data;
    }
    
    // For manual positioning, check if we need to calculate fractional position
    if (allowManualPositioning && data[positionField] !== undefined) {
      // If the position is already fractional, keep it
      if (data[positionField] % 1 !== 0) {
        return data;
      }
      
      // If it's an integer and we're in online mode, calculate fractional position
      if (!context.offline && context.action === 'create') {
        // Build scope conditions
        const scopeConditions: Record<string, any> = {};
        for (const field of scopeFields) {
          if (data[field] !== undefined) {
            scopeConditions[field] = data[field];
          }
        }
        
        // Get adjacent positions
        const { before, after } = await getAdjacentPositions(
          tableName,
          scopeConditions,
          data[positionField] - 0.5, // Look for position just before the target
          positionField
        );
        
        // Calculate fractional position if inserting between items
        if (before !== undefined && after !== undefined && before < after) {
          return {
            ...data,
            [positionField]: calculateInsertPosition(before, after, defaultGap)
          };
        }
      }
      
      return data;
    }
    
    // For automatic positioning (no position specified)
    if (context.action === 'create' || (context.action === 'update' && data[positionField] === undefined)) {
      // Build scope conditions
      const scopeConditions: Record<string, any> = {};
      for (const field of scopeFields) {
        if (data[field] !== undefined) {
          scopeConditions[field] = data[field];
        }
      }
      
      // In offline mode, use timestamp to avoid conflicts
      if (context.offline) {
        return {
          ...data,
          [positionField]: Date.now() / 1000 // Convert to seconds for reasonable numbers
        };
      }
      
      // In online mode, get the last position and add gap
      const { before } = await getAdjacentPositions(
        tableName,
        scopeConditions,
        undefined, // Get last position
        positionField
      );
      
      return {
        ...data,
        [positionField]: calculateInsertPosition(before, undefined, defaultGap)
      };
    }
    
    return data;
  };
}

/**
 * Task positioning with fractional support
 */
export const taskPositioningMutatorV2 = createPositioningMutatorV2('tasks', {
  scopeFields: ['job_id'],
  allowManualPositioning: true,
  defaultGap: 1000
});

/**
 * Helper to calculate position when inserting between specific tasks
 */
export function calculatePositionBetweenTasks(
  beforeTask: { position?: number } | undefined,
  afterTask: { position?: number } | undefined,
  defaultGap: number = 1000
): number {
  return calculateInsertPosition(
    beforeTask?.position,
    afterTask?.position,
    defaultGap
  );
}