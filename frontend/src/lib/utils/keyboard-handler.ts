/**
 * KeyboardHandler - Reusable keyboard navigation utility for list-like components
 * 
 * Provides arrow key navigation, multi-select, and customizable actions
 * Uses stateless approach - queries current state on each keydown
 */

import { get } from 'svelte/store';
import { isAnyPopoverOpen } from '$lib/stores/popover-state';

export interface KeyboardActions {
  navigate: (direction: 'up' | 'down') => void;
  select: (id: string) => void;
  clearSelection: () => void;
  createInline: (afterId?: string) => void;
  createBottom: () => void;
  deleteSelected: () => void;
  cancelEditing: () => void;
  scrollToItem?: (id: string) => void;
  onItemActivate?: (itemId: string, event: KeyboardEvent) => void;
}

export interface KeyboardBehavior {
  wrapNavigation?: boolean;
  preventDefault?: string[];
}

export interface KeyboardConfig {
  items: () => string[];
  selection: () => Set<string>;
  isEditing: () => boolean;
  actions: KeyboardActions;
  behavior?: KeyboardBehavior;
}

/**
 * Create a keyboard handler for list navigation
 */
export function KeyboardHandler(config: KeyboardConfig) {
  const {
    items,
    selection,
    isEditing,
    actions,
    behavior = {}
  } = config;

  // Default behavior
  const {
    wrapNavigation = true,
    preventDefault = ['ArrowUp', 'ArrowDown']
  } = behavior;

  /**
   * Handle arrow key navigation
   */
  function handleArrowNavigation(direction: 'up' | 'down') {
    const selectedIds = selection();
    const itemIds = items();
    
    if (selectedIds.size !== 1) return;
    
    const currentId = Array.from(selectedIds)[0];
    const currentIndex = itemIds.indexOf(currentId);
    
    if (currentIndex === -1) return;
    
    let nextIndex;
    if (direction === 'up') {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : (wrapNavigation ? itemIds.length - 1 : 0);
    } else {
      nextIndex = currentIndex < itemIds.length - 1 ? currentIndex + 1 : (wrapNavigation ? 0 : itemIds.length - 1);
    }
    
    const nextId = itemIds[nextIndex];
    actions.select(nextId);
    
    // Scroll into view if action is provided
    if (actions.scrollToItem) {
      actions.scrollToItem(nextId);
    }
  }

  /**
   * Handle escape key behavior
   */
  function handleEscape() {
    const selectedIds = selection();
    const editing = isEditing();
    
    if (editing) {
      actions.cancelEditing();
    } else if (selectedIds.size > 0) {
      actions.clearSelection();
      
      // Remove focus from any focused element
      if (document.activeElement && document.activeElement !== document.body) {
        (document.activeElement as HTMLElement).blur();
      }
    }
  }

  /**
   * Handle enter key behavior
   */
  function handleEnter() {
    const selectedIds = selection();
    const itemIds = items();
    const editing = isEditing();
    
    if (editing) return;
    
    if (selectedIds.size === 0) {
      // No selection: activate bottom creation
      actions.createBottom();
    } else if (selectedIds.size === 1) {
      // Single selection: check if it's the last item
      const selectedId = Array.from(selectedIds)[0];
      const selectedIndex = itemIds.indexOf(selectedId);
      const isLastItem = selectedIndex === itemIds.length - 1;
      
      if (isLastItem) {
        // Last item: create at bottom
        actions.clearSelection();
        actions.createBottom();
      } else {
        // Not last item: create inline after selected
        actions.createInline(selectedId);
        actions.clearSelection();
      }
    }
    // Multiple selections: do nothing
  }

  /**
   * Handle delete key behavior
   */
  function handleDelete() {
    const selectedIds = selection();
    const editing = isEditing();
    
    if (editing) return;
    
    if (selectedIds.size > 0) {
      actions.deleteSelected();
    }
  }

  /**
   * Handle initial arrow key selection when nothing is selected
   */
  function handleInitialSelection(direction: 'up' | 'down') {
    const itemIds = items();
    
    if (itemIds.length === 0) return;
    
    const itemId = direction === 'down' ? itemIds[0] : itemIds[itemIds.length - 1];
    actions.select(itemId);
    
    if (actions.scrollToItem) {
      actions.scrollToItem(itemId);
    }
  }

  /**
   * Check if the user is typing in an input field
   */
  function shouldSkipKeyboardShortcut(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement;
    
    // Check tag name
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return true;
    }
    
    // Check contenteditable
    if (target.contentEditable === 'true') {
      return true;
    }
    
    // Check role for accessibility
    if (target.getAttribute('role') === 'textbox') {
      return true;
    }
    
    return false;
  }

  /**
   * Handle item-level keyboard events (Enter/Space for activation)
   */
  function handleItemKeydown(event: KeyboardEvent, itemId: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      actions.onItemActivate?.(itemId, event);
    }
  }

  /**
   * Main keydown handler
   */
  function handleKeydown(event: KeyboardEvent) {
    // Skip ALL keyboard handling if any popover is open
    if (get(isAnyPopoverOpen)) {
      return;
    }
    
    const editing = isEditing();
    const selectedIds = selection();
    
    // Skip keyboard shortcuts if user is typing in an input field
    if (shouldSkipKeyboardShortcut(event)) {
      return;
    }
    
    // Escape key handling
    if (event.key === 'Escape') {
      event.preventDefault();
      handleEscape();
      return;
    }

    // Arrow key navigation
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (editing) return;
      
      if (preventDefault.includes(event.key)) {
        event.preventDefault();
      }
      
      const selectedCount = selectedIds.size;
      
      if (selectedCount === 0) {
        // No selection: select first/last item
        handleInitialSelection(event.key === 'ArrowDown' ? 'down' : 'up');
      } else if (selectedCount === 1) {
        // Single selection: navigate through items
        handleArrowNavigation(event.key === 'ArrowUp' ? 'up' : 'down');
      }
      // Multiple selections: do nothing
      return;
    }

    // Enter key for creation
    if (event.key === 'Enter') {
      if (editing) return;
      
      event.preventDefault();
      handleEnter();
      return;
    }

    // Delete key for deletion
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (editing) return;
      
      event.preventDefault();
      handleDelete();
      return;
    }
  }

  // Return handler object
  return {
    handleKeydown,
    handleItemKeydown,
    navigate: handleArrowNavigation,
    cleanup: () => {
      // Future: cleanup any internal state if needed
    }
  };
}