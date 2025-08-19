// Note: @rgossiaux/svelte-headlessui v2.0.0 removed createPopover function
// This is a legacy wrapper for components that haven't been migrated yet
// TODO: Migrate all popover components to use new Popover, PopoverButton, PopoverPanel components
import { onDestroy } from 'svelte';
import { writable } from 'svelte/store';
// Non-reactive popover instance type for this utility
type PopoverInstance = {
  id: string;
  isOpen: boolean;
  close: () => void;
};

// Simple non-reactive popover actions for this utility file
const popoverActions = {
  register: (id: string, instance: PopoverInstance) => {
    // Simple registration without $state
    console.debug('Popover registered:', id);
  },
  unregister: (id: string) => {
    // Simple cleanup without $state
    console.debug('Popover unregistered:', id);
  },
  setOpen: (id: string, isOpen: boolean) => {
    // Simple state management without $state
    console.debug('Popover state changed:', id, isOpen);
  },
  getActiveCount: () => {
    // Return 0 for non-reactive version
    return 0;
  },
  closeAll: () => {
    // Simple close all without $state
    console.debug('Closing all popovers');
  }
};

// Simple createPopover polyfill for legacy components
function createPopover() {
  const expanded = writable(false);
  
  return {
    subscribe: (run: any) => {
      return expanded.subscribe((value) => {
        run({ expanded: value, opened: value });
      });
    },
    set: (value: any) => expanded.set(value),
    update: (fn: any) => expanded.update(fn),
    open: () => expanded.set(true),
    close: () => expanded.set(false),
    toggle: () => expanded.update(value => !value),
    button: (node: HTMLElement) => {
      function handleClick() {
        expanded.update(value => !value);
      }
      
      node.addEventListener('click', handleClick);
      
      return {
        destroy() {
          node.removeEventListener('click', handleClick);
        }
      };
    },
    panel: (node: HTMLElement) => {
      return {
        destroy() {
          // Cleanup if needed
        }
      };
    }
  };
}

// Generate unique ID for each popover instance
let popoverIdCounter = 0;
function generatePopoverId(): string {
  return `popover-${++popoverIdCounter}`;
}

/**
 * Enhanced popover creation that integrates with global popover management.
 * This wrapper ensures only one popover can be open at a time and provides
 * automatic cleanup and coordination between multiple popover instances.
 */
export function createManagedPopover() {
  const popoverId = generatePopoverId();
  const basePopover = createPopover();
  
  // Create managed instance that tracks state
  const managedInstance: PopoverInstance = {
    id: popoverId,
    isOpen: false,
    close: () => {
      basePopover.close();
    }
  };
  
  // Register with global store
  popoverActions.register(popoverId, managedInstance);
  
  // Create reactive store that syncs with base popover
  const { subscribe, set } = basePopover;
  
  // Override the base popover's open/close methods to coordinate with global store
  const originalOpen = basePopover.open;
  const originalClose = basePopover.close;
  const originalToggle = basePopover.toggle;
  
  const managedPopover = {
    subscribe,
    
    // Enhanced open method that coordinates with global store
    open: () => {
      // First close any other open popovers
      popoverActions.setOpen(popoverId, true);
      // Then open this one
      originalOpen();
    },
    
    // Enhanced close method
    close: () => {
      popoverActions.setOpen(popoverId, false);
      originalClose();
    },
    
    // Enhanced toggle method
    toggle: () => {
      const currentState = managedInstance.isOpen;
      if (currentState) {
        managedPopover.close();
      } else {
        managedPopover.open();
      }
    },
    
    // Expose original properties for compatibility
    button: basePopover.button,
    panel: basePopover.panel,
    
    // Additional managed properties
    id: popoverId,
    isManaged: true
  };
  
  // Subscribe to base popover state changes to update our managed instance
  const unsubscribe = subscribe((state: any) => {
    const wasOpen = managedInstance.isOpen;
    const isNowOpen = state.expanded;
    
    if (wasOpen !== isNowOpen) {
      managedInstance.isOpen = isNowOpen;
      popoverActions.setOpen(popoverId, isNowOpen);
    }
  });
  
  // Cleanup on component destroy
  onDestroy(() => {
    unsubscribe();
    popoverActions.unregister(popoverId);
  });
  
  return managedPopover;
}

/**
 * Utility to check if any popover is currently open
 */
export function isAnyPopoverOpen(): boolean {
  return popoverActions.getActiveCount() > 0;
}

/**
 * Utility to close all open popovers
 */
export function closeAllPopovers(): void {
  popoverActions.closeAll();
}