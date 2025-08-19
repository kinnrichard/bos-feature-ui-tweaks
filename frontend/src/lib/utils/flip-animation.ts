/**
 * FLIP Animation Utility
 * 
 * Implements the FLIP (First, Last, Invert, Play) technique for smooth,
 * performant animations when DOM elements change position.
 */

export interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnimationOptions {
  duration?: number;
  easing?: string;
  stagger?: number;
  onComplete?: () => void;
}

export class FlipAnimator {
  private positions = new Map<string, Position>();
  private preDragPositions = new Map<string, Position>();
  private animationFrame: number | null = null;
  private isAnimating = false;
  private originalFirstSelectedTaskId: string | null = null;

  /**
   * Capture current positions of elements
   */
  capturePositions(elements: HTMLElement[], getKey: (el: HTMLElement) => string) {
    elements.forEach(element => {
      const rect = element.getBoundingClientRect();
      const key = getKey(element);
      
      // Basic validation for regular positions too
      const isValidPosition = rect.width > 0 && rect.height > 0;
      
      if (isValidPosition) {
        this.positions.set(key, {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        });
      }
    });
  }

  /**
   * Capture pre-drag positions from elements in selection order during multi-drag
   */
  capturePreDragPositions(elements: HTMLElement[], getKey: (el: HTMLElement) => string, selectionOrder?: string[]) {
    // Get container info for debugging container-relative positioning
    const container = elements[0]?.closest('.tasks-container') as HTMLElement;
    const containerRect = container?.getBoundingClientRect();
    
    // Track the original first selected task ID using selection order if provided
    if (selectionOrder && selectionOrder.length > 0) {
      this.originalFirstSelectedTaskId = selectionOrder[0];
    } else if (elements.length > 0) {
      // Fallback to first element in the array if no selection order provided
      this.originalFirstSelectedTaskId = getKey(elements[0]);
    }
    
    elements.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      const key = getKey(element);
      
      // Validate position - basic bounds checking
      const isValidPosition = rect.x >= -50 && rect.y >= -50 && rect.width > 0 && rect.height > 0;
      
      if (!isValidPosition) {
        console.warn(`[FLIP] Skipping invalid position for ${key}: bounds check failed`);
        return; // Skip completely invalid positions
      }
      
      // Check if position looks suspicious (e.g., at container top due to native drag interference)
      const containerTopDistance = containerRect ? Math.abs(rect.top - containerRect.top) : 0;
      const isPossiblyAtContainerTop = containerTopDistance < 10; // Within 10px of container top
      const isOriginalFirstSelected = key === this.originalFirstSelectedTaskId;
      
      let positionToCapture = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };
      
      // For the first selected task, if position looks suspicious, try to correct it
      if (isOriginalFirstSelected && isPossiblyAtContainerTop && containerRect) {
        // Try to use the regular position as a fallback
        const regularPosition = this.positions.get(key);
        if (regularPosition) {
          console.log(`[FLIP] CORRECTING suspicious first-selected position using regular position:`, {
            taskId: key.substring(0, 8),
            suspicious: { x: rect.left, y: rect.top },
            corrected: { x: regularPosition.x, y: regularPosition.y },
            reason: 'Position too close to container top, using previous known position'
          });
          positionToCapture = regularPosition;
        } else {
          console.warn(`[FLIP] First selected task at suspicious position but no regular position available`, {
            taskId: key.substring(0, 8),
            position: { x: rect.left, y: rect.top },
            containerTopDistance
          });
          // Use the suspicious position anyway - it's better than nothing
        }
      }
      
      // Always capture some position (either corrected or original)
      this.preDragPositions.set(key, positionToCapture);
      
      // Enhanced debug for position capture - using actual selection order
      const selectionOrderIndex = selectionOrder ? selectionOrder.indexOf(key) : -1;
      if (isOriginalFirstSelected) {
        console.log(`[FLIP] FIRST SELECTED TASK (BY SELECTION ORDER) PRE-DRAG CAPTURE:`, {
          taskId: key.substring(0, 8),
          capturedPosition: { x: positionToCapture.x, y: positionToCapture.y },
          rawPosition: { x: rect.left, y: rect.top },
          wasCorrected: positionToCapture.x !== rect.left || positionToCapture.y !== rect.top,
          size: { width: positionToCapture.width, height: positionToCapture.height },
          element: element.tagName,
          className: element.className,
          dataset: element.dataset,
          domQueryIndex: index, // Position in DOM query results
          selectionOrderIndex, // Position in actual selection order (should be 0)
          containerInfo: containerRect ? {
            containerTop: containerRect.top,
            containerLeft: containerRect.left,
            distanceFromContainerTop: containerTopDistance,
            isPossiblyAtContainerTop,
            containerRelativePos: {
              x: rect.left - containerRect.left,
              y: rect.top - containerRect.top
            }
          } : 'no container found',
          WARNING: isPossiblyAtContainerTop ? '⚠️ FIRST SELECTED TASK APPEARS TO BE AT CONTAINER TOP!' : null,
          STORED_IN_PREDRAG_MAP: true
        });
      }
      
      // Always log when a position is captured (for all tasks, including first)
      console.log(`[FLIP] Captured valid pre-drag position for ${key}: (${positionToCapture.x}, ${positionToCapture.y})`);
    });
  }

  /**
   * Animate elements from their previous positions to current DOM positions
   * This is used for multi-drag scenarios where we need precise timing control
   */
  animateWithCapturedPositions(
    elements: HTMLElement[],
    capturedCurrentPositions: Map<string, Position>,
    getKey: (el: HTMLElement) => string,
    options: AnimationOptions = {}
  ) {
    if (this.isAnimating) return;

    const {
      duration = 300,
      easing = 'cubic-bezier(0.4, 0, 0.2, 1)',
      stagger = 0,
      onComplete
    } = options;

    // CRITICAL FIX: Use actual current DOM positions, not the pre-captured positions
    // The pre-captured positions might be from an intermediate state during drag
    const currentPositions = new Map<string, { position: Position; element: HTMLElement }>();
    elements.forEach(element => {
      const key = getKey(element);
      const rect = element.getBoundingClientRect();
      const actualCurrentPosition = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };
      
      currentPositions.set(key, { position: actualCurrentPosition, element });
      
      // Debug logging to compare captured vs actual positions
      if (key === this.originalFirstSelectedTaskId) {
        const capturedPos = capturedCurrentPositions.get(key);
        console.log(`[FLIP] Position comparison for first selected task ${key.substring(0, 8)}:`, {
          captured: capturedPos ? { x: capturedPos.x, y: capturedPos.y } : 'none',
          actualCurrent: { x: actualCurrentPosition.x, y: actualCurrentPosition.y },
          usingActual: true,
          note: 'Using actual current DOM position instead of captured position'
        });
      }
    });

    // Continue with the same animation logic as the regular animate method
    this.performAnimation(currentPositions, elements, getKey, { duration, easing, stagger, onComplete });
  }

  /**
   * Animate elements from their previous positions to current positions
   */
  animate(
    elements: HTMLElement[], 
    getKey: (el: HTMLElement) => string,
    options: AnimationOptions = {}
  ) {
    if (this.isAnimating) return;

    const {
      duration = 300,
      easing = 'cubic-bezier(0.4, 0, 0.2, 1)',
      stagger = 0,
      onComplete
    } = options;

    // First: Capture current positions (final DOM positions after drag)
    const currentPositions = new Map<string, { position: Position; element: HTMLElement }>();
    elements.forEach(element => {
      const rect = element.getBoundingClientRect();
      const key = getKey(element);
      const position = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };
      
      currentPositions.set(key, { position, element });
      
      // Debug logging to understand final positions
      if (key === this.originalFirstSelectedTaskId) {
        console.log(`[FLIP] FINAL DOM POSITION for original first selected task ${key.substring(0, 8)}:`, {
          x: position.x,
          y: position.y,
          note: 'This is where the element is now in the DOM after drag completed'
        });
      }
    });

    // Last: Get previous positions
    const animations: Array<{
      element: HTMLElement;
      deltaX: number;
      deltaY: number;
      index: number;
    }> = [];

    currentPositions.forEach((current, key) => {
      // Use pre-drag position if available (for multi-drag), otherwise use regular previous position
      const preDragPos = this.preDragPositions.get(key);
      const regularPos = this.positions.get(key);
      
      // Validate pre-drag position before using it
      let previous = regularPos; // Default to regular position
      
      if (preDragPos) {
        // Check if pre-drag position would create a reasonable animation
        const preDragDeltaX = preDragPos.x - current.position.x;
        const preDragDeltaY = preDragPos.y - current.position.y;
        const preDragDistance = Math.sqrt(preDragDeltaX * preDragDeltaX + preDragDeltaY * preDragDeltaY);
        
        // Use pre-drag position only if it's reasonable (not too far away)
        if (preDragDistance < 1000) { // Max 1000px animation distance
          previous = preDragPos;
          
          // Enhanced debug for the original first selected task animation
          const isOriginalFirstSelected = key === this.originalFirstSelectedTaskId;
          if (isOriginalFirstSelected) {
            console.log(`[FLIP] ORIGINAL FIRST SELECTED TASK ANIMATION DEBUG:`, {
              taskId: key.substring(0, 8),
              fromPreDrag: { x: previous.x, y: previous.y },
              toCurrent: { x: current.position.x, y: current.position.y },
              delta: { x: preDragDeltaX, y: preDragDeltaY },
              distance: preDragDistance.toFixed(1) + 'px',
              element: current.element.tagName,
              hasRegularPos: !!regularPos,
              regularPos: regularPos ? { x: regularPos.x, y: regularPos.y } : null,
              note: 'This is the task that was originally selected first, regardless of current DOM position'
            });
          } else {
            console.log(`[FLIP] Task ${key} using validated pre-drag position: from (${previous.x}, ${previous.y}) to (${current.position.x}, ${current.position.y}), distance: ${preDragDistance.toFixed(1)}px`);
          }
        } else {
          console.warn(`[FLIP] Task ${key} pre-drag position too far (${preDragDistance.toFixed(1)}px), using regular position instead`);
        }
      }
      
      if (previous) {
        const deltaX = previous.x - current.position.x;
        const deltaY = previous.y - current.position.y;
        
        // Only animate if there's a significant change
        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
          animations.push({
            element: current.element,
            deltaX,
            deltaY,
            index: animations.length
          });
        }
      }
    });

    if (animations.length === 0) {
      this.capturePositions(elements, getKey);
      onComplete?.();
      return;
    }

    this.isAnimating = true;
    
    // Mark container as animating if available
    const container = elements[0]?.parentElement;
    if (container) {
      container.dataset.flipActive = 'true';
    }

    // Invert: Apply transforms to move elements to their old positions
    animations.forEach(({ element, deltaX, deltaY, index }) => {
      const taskId = element.dataset.taskId;
      
      // Enhanced debug for the original first selected task transform
      const isOriginalFirstSelected = taskId === this.originalFirstSelectedTaskId;
      if (isOriginalFirstSelected) {
        console.log(`[FLIP] ORIGINAL FIRST SELECTED TASK TRANSFORM DEBUG:`, {
          taskId: taskId?.substring(0, 8),
          transform: `translate(${deltaX}px, ${deltaY}px)`,
          delta: { x: deltaX, y: deltaY },
          elementRect: element.getBoundingClientRect(),
          animationIndex: index, // This shows where it is in the animation array (may not be 0)
          computedStyle: {
            position: getComputedStyle(element).position,
            transform: getComputedStyle(element).transform,
            zIndex: getComputedStyle(element).zIndex
          },
          note: 'This is the task that was originally selected first, regardless of animation array position'
        });
      }
      
      element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      element.style.transition = 'none';
    });

    // Force browser to apply the transforms
    void document.body.offsetHeight;

    // Play: Animate back to final positions
    this.animationFrame = requestAnimationFrame(() => {
      animations.forEach(({ element, index }) => {
        // Mark element as animating
        element.dataset.flipAnimating = 'true';
        
        setTimeout(() => {
          element.style.transform = '';
          element.style.transition = `transform ${duration}ms ${easing}`;
        }, index * stagger);
      });

      // Cleanup after animation
      setTimeout(() => {
        animations.forEach(({ element }) => {
          element.style.transform = '';
          element.style.transition = '';
          element.dataset.flipAnimating = 'false';
        });
        // Clear container animation state
        if (container) {
          container.dataset.flipActive = 'false';
        }
        // Clear pre-drag positions and original first task tracking after animation completes
        this.preDragPositions.clear();
        this.originalFirstSelectedTaskId = null;
        this.isAnimating = false;
        this.capturePositions(elements, getKey);
        onComplete?.();
      }, duration + (animations.length * stagger));
    });
  }

  /**
   * Shared animation logic used by both animate() and animateWithCapturedPositions()
   */
  private performAnimation(
    currentPositions: Map<string, { position: Position; element: HTMLElement }>,
    elements: HTMLElement[],
    getKey: (el: HTMLElement) => string,
    options: { duration: number; easing: string; stagger: number; onComplete?: () => void }
  ) {
    const { duration, easing, stagger, onComplete } = options;

    // Get previous positions and calculate animations
    const animations: Array<{
      element: HTMLElement;
      deltaX: number;
      deltaY: number;
      index: number;
    }> = [];

    currentPositions.forEach((current, key) => {
      // Use pre-drag position if available (for multi-drag), otherwise use regular previous position
      const preDragPos = this.preDragPositions.get(key);
      const regularPos = this.positions.get(key);
      
      // Validate pre-drag position before using it
      let previous = regularPos; // Default to regular position
      
      if (preDragPos) {
        // Check if pre-drag position would create a reasonable animation
        const preDragDeltaX = preDragPos.x - current.position.x;
        const preDragDeltaY = preDragPos.y - current.position.y;
        const preDragDistance = Math.sqrt(preDragDeltaX * preDragDeltaX + preDragDeltaY * preDragDeltaY);
        
        // Use pre-drag position only if it's reasonable (not too far away)
        if (preDragDistance < 1000) { // Max 1000px animation distance
          previous = preDragPos;
          
          // Enhanced debug for the original first selected task animation
          const isOriginalFirstSelected = key === this.originalFirstSelectedTaskId;
          if (isOriginalFirstSelected) {
            console.log(`[FLIP] ORIGINAL FIRST SELECTED TASK ANIMATION DEBUG:`, {
              taskId: key.substring(0, 8),
              fromPreDrag: { x: previous.x, y: previous.y },
              toCaptured: { x: current.position.x, y: current.position.y },
              delta: { x: preDragDeltaX, y: preDragDeltaY },
              distance: preDragDistance.toFixed(1) + 'px',
              element: current.element.tagName,
              hasRegularPos: !!regularPos,
              regularPos: regularPos ? { x: regularPos.x, y: regularPos.y } : null,
              note: 'Animation from pre-drag to captured position'
            });
          } else {
            console.log(`[FLIP] Task ${key} using validated pre-drag position: from (${previous.x}, ${previous.y}) to (${current.position.x}, ${current.position.y}), distance: ${preDragDistance.toFixed(1)}px`);
          }
        } else {
          console.warn(`[FLIP] Task ${key} pre-drag position too far (${preDragDistance.toFixed(1)}px), using regular position instead`);
        }
      }
      
      if (previous) {
        const deltaX = previous.x - current.position.x;
        const deltaY = previous.y - current.position.y;
        
        // Only animate if there's a significant change
        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
          animations.push({
            element: current.element,
            deltaX,
            deltaY,
            index: animations.length
          });
        }
      }
    });

    if (animations.length === 0) {
      this.capturePositions(elements, getKey);
      onComplete?.();
      return;
    }

    this.isAnimating = true;
    
    // Mark container as animating if available
    const container = elements[0]?.parentElement;
    if (container) {
      container.dataset.flipActive = 'true';
    }

    // Invert: Apply transforms to move elements to their old positions
    animations.forEach(({ element, deltaX, deltaY, index }) => {
      const taskId = element.dataset.taskId;
      
      // Enhanced debug for the original first selected task transform
      const isOriginalFirstSelected = taskId === this.originalFirstSelectedTaskId;
      if (isOriginalFirstSelected) {
        console.log(`[FLIP] ORIGINAL FIRST SELECTED TASK TRANSFORM DEBUG:`, {
          taskId: taskId?.substring(0, 8),
          transform: `translate(${deltaX}px, ${deltaY}px)`,
          delta: { x: deltaX, y: deltaY },
          elementRect: element.getBoundingClientRect(),
          animationIndex: index,
          computedStyle: {
            position: getComputedStyle(element).position,
            transform: getComputedStyle(element).transform,
            zIndex: getComputedStyle(element).zIndex
          },
          note: 'This is the task that was originally selected first, with captured positions'
        });
      }
      
      element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      element.style.transition = 'none';
    });

    // Force browser to apply the transforms
    void document.body.offsetHeight;

    // Play: Animate back to final positions
    this.animationFrame = requestAnimationFrame(() => {
      animations.forEach(({ element, index }) => {
        // Mark element as animating
        element.dataset.flipAnimating = 'true';
        
        setTimeout(() => {
          element.style.transform = '';
          element.style.transition = `transform ${duration}ms ${easing}`;
        }, index * stagger);
      });

      // Cleanup after animation
      setTimeout(() => {
        animations.forEach(({ element }) => {
          element.style.transform = '';
          element.style.transition = '';
          element.dataset.flipAnimating = 'false';
        });
        // Clear container animation state
        if (container) {
          container.dataset.flipActive = 'false';
        }
        // Clear pre-drag positions and original first task tracking after animation completes
        this.preDragPositions.clear();
        this.originalFirstSelectedTaskId = null;
        this.isAnimating = false;
        this.capturePositions(elements, getKey);
        onComplete?.();
      }, duration + (animations.length * stagger));
    });
  }

  /**
   * Check if user prefers reduced motion
   */
  static prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Cancel any ongoing animation
   */
  cancel() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.isAnimating = false;
  }

  /**
   * Clear stored positions
   */
  clear() {
    this.positions.clear();
    this.preDragPositions.clear();
    this.originalFirstSelectedTaskId = null;
    this.cancel();
  }

  /**
   * Clear pre-drag positions only
   */
  clearPreDragPositions() {
    this.preDragPositions.clear();
    this.originalFirstSelectedTaskId = null;
  }
}

/**
 * Helper to create a debounced animator
 */
export function createDebouncedAnimator(delay: number = 50) {
  const animator = new FlipAnimator();
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return {
    animator,
    animateDebounced(
      elements: HTMLElement[],
      getKey: (el: HTMLElement) => string,
      options?: AnimationOptions
    ) {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(() => {
        animator.animate(elements, getKey, options);
        timeout = null;
      }, delay);
    },
    cancel() {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      animator.cancel();
    }
  };
}