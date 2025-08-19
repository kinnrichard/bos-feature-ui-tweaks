export interface PopoverInstance {
  id: string;
  isOpen: boolean;
  close: () => void;
}

interface PopoverState {
  instances: Map<string, PopoverInstance>;
  activeCount: number;
}

// Popover state - proper Svelte 5 pattern
export const popover = $state<PopoverState>({
  instances: new Map(),
  activeCount: 0
});

// Popover actions
export const popoverActions = {
  // Register a new popover instance
  register: (id: string, instance: PopoverInstance) => {
    popover.instances.set(id, instance);
  },
  
  // Unregister a popover instance
  unregister: (id: string) => {
    popover.instances.delete(id);
  },
  
  // Update the open state of a specific popover
  setOpen: (id: string, isOpen: boolean) => {
    const instance = popover.instances.get(id);
    if (instance) {
      instance.isOpen = isOpen;
      
      // If opening this popover, close all others
      if (isOpen) {
        popover.instances.forEach((otherInstance, otherId) => {
          if (otherId !== id && otherInstance.isOpen) {
            otherInstance.close();
            otherInstance.isOpen = false;
          }
        });
      }
      
      // Update active count
      popover.activeCount = Array.from(popover.instances.values())
        .filter(inst => inst.isOpen).length;
    }
  },
  
  // Close all open popovers
  closeAll: () => {
    popover.instances.forEach(instance => {
      if (instance.isOpen) {
        instance.close();
        instance.isOpen = false;
      }
    });
    popover.activeCount = 0;
  },
  
  // Get count of currently open popovers
  getActiveCount: () => {
    return popover.activeCount;
  }
};

// Global keyboard handler for Escape key
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      popoverActions.closeAll();
    }
  });
}