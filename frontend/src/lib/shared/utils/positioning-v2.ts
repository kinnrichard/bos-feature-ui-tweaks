/**
 * Randomized integer-based positioning system for task ordering
 * 
 * This module provides utilities for calculating positions between existing items
 * using randomized integer values within specified ranges to reduce position
 * conflicts during offline operations. When conflicts do occur (same position),
 * the client handles them by secondary sorting on created_at.
 * 
 * Randomization is used to prevent multiple offline clients from choosing the
 * same position when inserting at the same location.
 * 
 * Top-of-list positioning uses negative integers to allow infinite insertions
 * before the first item in the list.
 */

export interface PositionConfig {
  defaultSpacing?: number;
  initialPosition?: number;
  randomRangePercent?: number;
  disableRandomization?: boolean; // For testing purposes
}

export interface Positionable {
  id: string;
  position: number;
}

export interface RelativePositionUpdate {
  id: string;
  parent_id: string | null;
  before_task_id?: string;
  after_task_id?: string;
  position?: 'first' | 'last';
}

export interface PositionUpdate {
  id: string;
  position: number;
  parent_id: string | null;
  repositioned_after_id: string | null;
}

/**
 * Calculate a position value between two existing positions
 * 
 * @param prevPosition - Position of the item before the insertion point (null if inserting at start)
 * @param nextPosition - Position of the item after the insertion point (null if inserting at end)
 * @param config - Optional configuration for spacing and initial position
 * @returns An integer position value that will sort between the two given positions
 */
export function calculatePosition(
  prevPosition: number | null,
  nextPosition: number | null,
  config: PositionConfig = {}
): number {
  const { 
    defaultSpacing = 10000, 
    initialPosition = 10000,
    randomRangePercent = 0.5,
    disableRandomization = false
  } = config;

  // Between two positions
  if (prevPosition !== null && nextPosition !== null) {
    const gap = nextPosition - prevPosition;

    // Use randomization only if gap is large enough
    if (gap >= 4 && !disableRandomization) {
      const rangeSize = gap * randomRangePercent;
      const rangeStart = prevPosition + (gap - rangeSize) / 2;
      const rangeEnd = rangeStart + rangeSize;

      return Math.floor(rangeStart + Math.random() * (rangeEnd - rangeStart));
    }

    // Fallback to midpoint for small gaps
    return Math.floor((prevPosition + nextPosition) / 2);
  }

  // At start: use negative positioning with randomization to allow infinite insertions before
  if (prevPosition === null && nextPosition !== null) {
    if (disableRandomization) {
      // For testing: use deterministic position before the first task
      return nextPosition - 1;
    }
    // Generate position before the first task
    return nextPosition - Math.floor(Math.random() * defaultSpacing + 1);
  }

  // At end: randomize around default spacing
  if (prevPosition !== null && nextPosition === null) {
    if (disableRandomization) {
      // For testing: use deterministic spacing
      return prevPosition + defaultSpacing;
    }
    if (defaultSpacing >= 4) {
      const minSpacing = defaultSpacing * (1 - randomRangePercent / 2);
      const maxSpacing = defaultSpacing * (1 + randomRangePercent / 2);
      return prevPosition + Math.floor(minSpacing + Math.random() * (maxSpacing - minSpacing));
    }
    return prevPosition + defaultSpacing;
  }

  // Empty list
  return initialPosition;
}

/**
 * Get the adjacent items for a given index in a list
 * 
 * @param items - Array of items with positions
 * @param targetIndex - Index to find adjacent items for
 * @returns Object with prev and next items (or null if at boundaries)
 */
export function getAdjacentPositions<T extends Positionable>(
  items: T[],
  targetIndex: number
): { prev: T | null; next: T | null } {
  // Handle invalid indices
  if (targetIndex < 0 || targetIndex >= items.length || items.length === 0) {
    return { prev: null, next: null };
  }

  // Get previous item (if not at start)
  const prev = targetIndex > 0 ? items[targetIndex - 1] : null;

  // Get next item (if not at end)
  const next = targetIndex < items.length - 1 ? items[targetIndex + 1] : null;

  return { prev, next };
}

/**
 * Convert relative positioning updates to integer position updates
 * 
 * @param items - Array of items with current positions
 * @param relativeUpdates - Array of relative positioning instructions
 * @param config - Position calculation configuration
 * @returns Array of position updates with integer positions
 */
export function convertRelativeToPositionUpdates<T extends Positionable>(
  items: T[],
  relativeUpdates: RelativePositionUpdate[],
  config: PositionConfig = {}
): PositionUpdate[] {
  // Create a mutable working copy to track position changes as we process updates
  const workingItems = items.map(item => ({...item}));
  const positionUpdates: PositionUpdate[] = [];
  
  relativeUpdates.forEach(update => {
    const item = workingItems.find(i => i.id === update.id);
    if (!item) return;
    
    let targetPosition = config.initialPosition || 10000;
    let repositionedAfterId: string | null = null;
    const targetParent = update.parent_id || null;
    
    // Get items in the target scope, INCLUDING the moving item for positioning calculations
    const allScopeItems = workingItems.filter(i => {
      const itemParent = ('parent_id' in i ? (i as any).parent_id : null) || null;
      return itemParent === targetParent;
    }).sort((a, b) => a.position - b.position);
    
    // Get items excluding the moving item (for target identification)
    const scopeItemsExcludingMoved = allScopeItems.filter(i => i.id !== update.id);
    
    if (update.before_task_id) {
      // Position before specific item  
      const beforeItem = allScopeItems.find(i => i.id === update.before_task_id);
      if (beforeItem) {
        const beforeItemIndex = allScopeItems.findIndex(i => i.id === beforeItem.id);
        const prevItem = beforeItemIndex > 0 ? allScopeItems[beforeItemIndex - 1] : null;
        
        if (prevItem) {
          repositionedAfterId = prevItem.id;
        }
        
        targetPosition = calculatePosition(prevItem?.position || null, beforeItem.position, config);
      } else {
        targetPosition = calculatePosition(null, null, config);
      }
    } else if (update.after_task_id) {
      // Position after specific item
      const afterItem = allScopeItems.find(i => i.id === update.after_task_id);
      if (afterItem) {
        repositionedAfterId = afterItem.id;
        
        const afterItemIndex = allScopeItems.findIndex(i => i.id === afterItem.id);
        const nextItem = afterItemIndex < allScopeItems.length - 1 ? allScopeItems[afterItemIndex + 1] : null;
        
        targetPosition = calculatePosition(afterItem.position, nextItem?.position || null, config);
      } else {
        const lastItem = scopeItemsExcludingMoved[scopeItemsExcludingMoved.length - 1];
        targetPosition = calculatePosition(lastItem?.position || null, null, config);
        if (lastItem) {
          repositionedAfterId = lastItem.id;
        }
      }
    } else if (update.position === 'first') {
      // Position at start of list
      const firstItem = scopeItemsExcludingMoved[0];
      targetPosition = calculatePosition(null, firstItem?.position || null, config);
      repositionedAfterId = null;
    } else if (update.position === 'last') {
      // Position at end of list
      const lastItem = scopeItemsExcludingMoved[scopeItemsExcludingMoved.length - 1];
      targetPosition = calculatePosition(lastItem?.position || null, null, config);
      if (lastItem) {
        repositionedAfterId = lastItem.id;
      }
    }
    
    // Update the working item state for subsequent calculations
    const itemToUpdate = workingItems.find(i => i.id === update.id);
    if (itemToUpdate) {
      itemToUpdate.position = targetPosition;
      if ('parent_id' in itemToUpdate && targetParent !== undefined) {
        (itemToUpdate as any).parent_id = targetParent;
      }
      workingItems.sort((a, b) => a.position - b.position);
    }
    
    positionUpdates.push({
      id: update.id,
      position: targetPosition,
      parent_id: targetParent,
      repositioned_after_id: repositionedAfterId
    });
  });
  
  return positionUpdates;
}

