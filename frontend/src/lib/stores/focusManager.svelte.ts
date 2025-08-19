/**
 * Focus Management Store
 * 
 * Single source of truth for managing contenteditable focus state
 * across task components. Eliminates race conditions and provides
 * coordinated focus lifecycle management.
 */

export interface FocusState {
  currentEditingElement: HTMLElement | null;
  currentEditingTaskId: string | null;
  isTransitioning: boolean;
}

// Centralized focus state
export const focusManager = $state<FocusState>({
  currentEditingElement: null,
  currentEditingTaskId: null,
  isTransitioning: false
});

export const focusActions = {
  /**
   * Set the currently editing element and task ID
   */
  setEditingElement: (element: HTMLElement | null, taskId: string | null) => {
    // Clear previous focus if setting new element
    if (focusManager.currentEditingElement && focusManager.currentEditingElement !== element) {
      focusManager.currentEditingElement.blur();
    }
    
    focusManager.currentEditingElement = element;
    focusManager.currentEditingTaskId = taskId;
    
    // Focus the new element if provided
    if (element && taskId) {
      element.focus();
    }
  },
  
  /**
   * Clear focus and reset state
   */
  clearFocus: () => {
    if (focusManager.currentEditingElement) {
      focusManager.currentEditingElement.blur();
      
      // Clear selection to remove the insertion point before blurring.
      // This is needed because of an apparent WebKit and Chrome bug.
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
    }
    focusManager.currentEditingElement = null;
    focusManager.currentEditingTaskId = null;
  },
  
  /**
   * Set transition state to prevent race conditions
   */
  setTransitioning: (transitioning: boolean) => {
    focusManager.isTransitioning = transitioning;
  },
  
  /**
   * Check if a specific task is currently being edited
   */
  isTaskBeingEdited: (taskId: string): boolean => {
    return focusManager.currentEditingTaskId === taskId;
  },
  
  /**
   * Get the current editing task ID
   */
  getCurrentEditingTaskId: (): string | null => {
    return focusManager.currentEditingTaskId;
  },
  
  /**
   * Get the current editing element
   */
  getCurrentEditingElement: (): HTMLElement | null => {
    return focusManager.currentEditingElement;
  },
  
  /**
   * Check if focus is currently transitioning
   */
  isTransitioning: (): boolean => {
    return focusManager.isTransitioning;
  }
};