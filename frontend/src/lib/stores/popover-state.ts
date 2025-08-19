import { writable, derived } from 'svelte/store';

/**
 * Global popover state manager
 * Tracks which popovers are currently open to prevent keyboard conflicts
 */

// Track open popovers by ID
const openPopovers = writable<Set<string>>(new Set());

// Simple counter to generate unique IDs
let popoverIdCounter = 0;

/**
 * Register a popover as open
 * @returns cleanup function to unregister the popover
 */
export function registerPopover(): () => void {
  const id = `popover-${++popoverIdCounter}`;
  
  openPopovers.update(popovers => {
    const newSet = new Set(popovers);
    newSet.add(id);
    return newSet;
  });
  
  // Return cleanup function
  return () => {
    openPopovers.update(popovers => {
      const newSet = new Set(popovers);
      newSet.delete(id);
      return newSet;
    });
  };
}

/**
 * Check if any popover is currently open
 */
export const isAnyPopoverOpen = derived(
  openPopovers,
  $openPopovers => $openPopovers.size > 0
);

/**
 * Get the count of open popovers
 */
export const openPopoverCount = derived(
  openPopovers,
  $openPopovers => $openPopovers.size
);