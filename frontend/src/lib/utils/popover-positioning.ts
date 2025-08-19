export interface PopoverPosition {
  top: number;
  left: number;
  placement: 'top' | 'bottom' | 'left' | 'right';
  arrowPosition: {
    top: number;
    left: number;
  };
  maxHeight?: number;
  maxWidth?: number;
}

export interface PopoverDimensions {
  width: number;
  height: number;
}

export interface TriggerElement {
  element: HTMLElement;
  preferredPlacement?: 'top' | 'bottom' | 'left' | 'right';
}

const POPOVER_OFFSET = 8; // Distance between trigger and popover
const VIEWPORT_PADDING = 20; // Minimum distance from viewport edge

/**
 * Calculate the optimal position for a popover relative to a trigger element
 */
export function calculatePopoverPosition(
  trigger: TriggerElement,
  popoverDimensions: PopoverDimensions
): PopoverPosition {
  const triggerRect = trigger.element.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  const { width: popoverWidth, height: popoverHeight } = popoverDimensions;
  
  // Calculate available space in each direction
  const spaceTop = triggerRect.top;
  const spaceBottom = viewportHeight - triggerRect.bottom;
  const spaceLeft = triggerRect.left;
  const spaceRight = viewportWidth - triggerRect.right;
  
  // Try preferred placement first, then fallback to best fit
  const preferredPlacement = trigger.preferredPlacement || 'left';
  let placement = preferredPlacement;
  
  // Check if preferred placement fits, otherwise find best alternative
  if (preferredPlacement === 'left' && spaceLeft < popoverWidth + POPOVER_OFFSET + VIEWPORT_PADDING) {
    if (spaceRight >= popoverWidth + POPOVER_OFFSET + VIEWPORT_PADDING) {
      placement = 'right';
    } else if (spaceBottom >= popoverHeight + POPOVER_OFFSET + VIEWPORT_PADDING) {
      placement = 'bottom';
    } else if (spaceTop >= popoverHeight + POPOVER_OFFSET + VIEWPORT_PADDING) {
      placement = 'top';
    }
  } else if (preferredPlacement === 'right' && spaceRight < popoverWidth + POPOVER_OFFSET + VIEWPORT_PADDING) {
    if (spaceLeft >= popoverWidth + POPOVER_OFFSET + VIEWPORT_PADDING) {
      placement = 'left';
    } else if (spaceBottom >= popoverHeight + POPOVER_OFFSET + VIEWPORT_PADDING) {
      placement = 'bottom';
    } else if (spaceTop >= popoverHeight + POPOVER_OFFSET + VIEWPORT_PADDING) {
      placement = 'top';
    }
  } else if (preferredPlacement === 'top' && spaceTop < popoverHeight + POPOVER_OFFSET + VIEWPORT_PADDING) {
    if (spaceBottom >= popoverHeight + POPOVER_OFFSET + VIEWPORT_PADDING) {
      placement = 'bottom';
    } else if (spaceLeft >= popoverWidth + POPOVER_OFFSET + VIEWPORT_PADDING) {
      placement = 'left';
    } else if (spaceRight >= popoverWidth + POPOVER_OFFSET + VIEWPORT_PADDING) {
      placement = 'right';
    }
  } else if (preferredPlacement === 'bottom' && spaceBottom < popoverHeight + POPOVER_OFFSET + VIEWPORT_PADDING) {
    if (spaceTop >= popoverHeight + POPOVER_OFFSET + VIEWPORT_PADDING) {
      placement = 'top';
    } else if (spaceLeft >= popoverWidth + POPOVER_OFFSET + VIEWPORT_PADDING) {
      placement = 'left';
    } else if (spaceRight >= popoverWidth + POPOVER_OFFSET + VIEWPORT_PADDING) {
      placement = 'right';
    }
  }
  
  return calculatePositionForPlacement(triggerRect, popoverDimensions, placement);
}

/**
 * Calculate position and arrow placement for a specific placement direction
 */
function calculatePositionForPlacement(
  triggerRect: DOMRect,
  popoverDimensions: PopoverDimensions,
  placement: 'top' | 'bottom' | 'left' | 'right'
): PopoverPosition {
  const { width: popoverWidth, height: popoverHeight } = popoverDimensions;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  let top: number;
  let left: number;
  let arrowPosition: { top: number; left: number };
  let maxHeight: number | undefined;
  let maxWidth: number | undefined;
  
  switch (placement) {
    case 'left':
      left = triggerRect.left - popoverWidth - POPOVER_OFFSET;
      top = triggerRect.top + (triggerRect.height / 2) - (popoverHeight / 2);
      
      // Constrain to viewport
      if (left < VIEWPORT_PADDING) {
        left = VIEWPORT_PADDING;
        maxWidth = triggerRect.left - POPOVER_OFFSET - VIEWPORT_PADDING;
      }
      
      if (top < VIEWPORT_PADDING) {
        top = VIEWPORT_PADDING;
      } else if (top + popoverHeight > viewportHeight - VIEWPORT_PADDING) {
        top = viewportHeight - popoverHeight - VIEWPORT_PADDING;
      }
      
      // Calculate arrow position (pointing right to button)
      const triggerCenterY = triggerRect.top + (triggerRect.height / 2);
      arrowPosition = {
        top: triggerCenterY - 10, // Center arrow on trigger button (arrow height 20px / 2)
        left: left + popoverWidth - 9 // Position arrow 9px from panel edge (1px to the left)
      };
      
      break;
      
    case 'right':
      left = triggerRect.right + POPOVER_OFFSET;
      top = triggerRect.top + (triggerRect.height / 2) - (popoverHeight / 2);
      
      // Constrain to viewport
      if (left + popoverWidth > viewportWidth - VIEWPORT_PADDING) {
        maxWidth = viewportWidth - left - VIEWPORT_PADDING;
      }
      
      if (top < VIEWPORT_PADDING) {
        top = VIEWPORT_PADDING;
      } else if (top + popoverHeight > viewportHeight - VIEWPORT_PADDING) {
        top = viewportHeight - popoverHeight - VIEWPORT_PADDING;
      }
      
      // Calculate arrow position (pointing left to button)
      const triggerCenterYRight = triggerRect.top + (triggerRect.height / 2);
      arrowPosition = {
        top: triggerCenterYRight - 10, // Center arrow on trigger button
        left: left - 12 // Position arrow just outside left edge of panel
      };
      
      break;
      
    case 'top':
      top = triggerRect.top - popoverHeight - POPOVER_OFFSET;
      left = triggerRect.left + (triggerRect.width / 2) - (popoverWidth / 2);
      
      // Constrain to viewport
      if (top < VIEWPORT_PADDING) {
        top = VIEWPORT_PADDING;
        maxHeight = triggerRect.top - POPOVER_OFFSET - VIEWPORT_PADDING;
      }
      
      if (left < VIEWPORT_PADDING) {
        left = VIEWPORT_PADDING;
      } else if (left + popoverWidth > viewportWidth - VIEWPORT_PADDING) {
        left = viewportWidth - popoverWidth - VIEWPORT_PADDING;
      }
      
      // Calculate arrow position (pointing down to button)
      const triggerCenterX = triggerRect.left + (triggerRect.width / 2);
      arrowPosition = {
        top: top + popoverHeight, // Position arrow just outside bottom edge of panel
        left: triggerCenterX - 10 // Center arrow on trigger button (arrow width 20px / 2)
      };
      
      break;
      
    case 'bottom':
      top = triggerRect.bottom + POPOVER_OFFSET;
      left = triggerRect.left + (triggerRect.width / 2) - (popoverWidth / 2);
      
      // Constrain to viewport
      if (top + popoverHeight > viewportHeight - VIEWPORT_PADDING) {
        maxHeight = viewportHeight - top - VIEWPORT_PADDING;
      }
      
      if (left < VIEWPORT_PADDING) {
        left = VIEWPORT_PADDING;
      } else if (left + popoverWidth > viewportWidth - VIEWPORT_PADDING) {
        left = viewportWidth - popoverWidth - VIEWPORT_PADDING;
      }
      
      // Calculate arrow position (pointing up to button)
      const triggerCenterXBottom = triggerRect.left + (triggerRect.width / 2);
      arrowPosition = {
        top: top - 10, // Position arrow 2px closer to panel (1px more)
        left: triggerCenterXBottom - 10 // Center arrow on trigger button (arrow width 20px / 2)
      };
      
      break;
  }
  
  return {
    top,
    left,
    placement,
    arrowPosition,
    maxHeight,
    maxWidth
  };
}


/**
 * Debounced position update for scroll/resize events
 */
export function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}