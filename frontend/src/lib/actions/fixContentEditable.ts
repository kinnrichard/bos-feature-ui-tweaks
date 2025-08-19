/**
 * Fix ContentEditable Action
 * 
 * A comprehensive Svelte action that fixes common contenteditable browser quirks.
 * Handles spellcheck management and selection clearing to prevent visual issues.
 * 
 * Features:
 * - Manages spellcheck behavior (enabled during editing, disabled when idle)
 * - Clears text selection/cursor on blur to prevent insertion point persistence
 * - Prevents visual clutter from persistent spell check suggestions
 * - Extensible for future contenteditable browser quirks
 * 
 * Usage:
 * ```svelte
 * <div contenteditable="true" use:fixContentEditable>Content</div>
 * ```
 */

export function fixContentEditable(element: HTMLElement) {
  // Set initial state - spellcheck disabled by default
  element.setAttribute('spellcheck', 'false');
  
  function handleFocus() {
    // Enable spellcheck when element gains focus
    element.setAttribute('spellcheck', 'true');
  }
  
  function handleBlur() {
    // Fix spellcheck visual clutter
    element.setAttribute('spellcheck', 'false');
    
    // Fix insertion point persistence bug
    // Clear selection to remove cursor/insertion point after blur
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  }
  
  // Add event listeners
  element.addEventListener('focus', handleFocus);
  element.addEventListener('blur', handleBlur);
  
  return {
    destroy() {
      // Clean up event listeners when element is destroyed
      element.removeEventListener('focus', handleFocus);
      element.removeEventListener('blur', handleBlur);
    }
  };
}