<script lang="ts">
  import { tick, onMount } from 'svelte';
  import { focusActions } from '$lib/stores/focusManager.svelte';
  import '../../styles/focus-ring.scss';

  // Props interface
  interface Props {
    value: string;
    placeholder?: string;
    onSave: (newValue: string) => Promise<void>;
    onCancel?: () => void;
    tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'span';
    className?: string;
    fontSize?: string;
    fontWeight?: string;
    selectAllOnFocus?: boolean;
    trimOnSave?: boolean;
    allowEmpty?: boolean;
    autoFocus?: boolean;
    onEditingChange?: (editing: boolean) => void;
    onClick?: (e: MouseEvent) => void;
    editable?: boolean;
    isCreationMode?: boolean;
  }

  let {
    value,
    placeholder = 'Untitled',
    onSave,
    onCancel,
    tag = 'h3',
    className = '',
    fontSize,
    fontWeight,
    selectAllOnFocus = false,
    trimOnSave = true,
    allowEmpty = false,
    autoFocus = false,
    onEditingChange,
    onClick,
    editable = true,
    isCreationMode = false,
  }: Props = $props();

  let element = $state<HTMLElement>();
  let originalValue = $state(value);
  let isSaving = $state(false);
  let hasFocus = $state(false);
  let hasAutoFocused = $state(false);

  let isCancelling = false;

  // Update original value when value prop changes
  // In creation mode, don't sync with external value to prevent duplication
  $effect(() => {
    if (!hasFocus && !isCreationMode) {
      originalValue = value;
      // When switching out of creation mode, update the element content
      if (element && !hasFocus) {
        element.textContent = value || '';
      }
    }
  });

  // Auto-focus on mount if requested
  onMount(() => {
    if (autoFocus && element && !hasAutoFocused) {
      // Give the browser time to fully render
      requestAnimationFrame(() => {
        element.focus();
        hasAutoFocused = true;
      });
    }
  });

  // Also use effect for when element becomes available later
  $effect(() => {
    if (autoFocus && element && !hasFocus && !hasAutoFocused) {
      // Use tick() to ensure DOM is ready before focusing
      tick().then(() => {
        element.focus();
        hasAutoFocused = true;
      });
    }
  });

  async function handleSave() {
    if (!element || isSaving) return;

    const newValue = element.textContent || '';
    const trimmedValue = trimOnSave ? newValue.trim() : newValue;

    // Validate empty values
    if (!allowEmpty && !trimmedValue) {
      handleCancel();
      return;
    }

    // Skip if value hasn't changed
    if (trimmedValue === originalValue) {
      element?.blur();
      return;
    }

    isSaving = true;
    try {
      await onSave(trimmedValue);
      originalValue = trimmedValue;
      element?.blur();
    } catch (error) {
      console.error('Failed to save title:', error);
      // Revert on error
      if (element) element.textContent = originalValue;
    } finally {
      isSaving = false;
    }
  }

  function handleCancel() {
    isCancelling = true;

    if (element) {
      element.textContent = originalValue;
    }
    onCancel?.();
    element?.blur();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }

  function handleFocus() {
    // Prevent focus if not editable
    if (!editable) {
      element?.blur();
      return;
    }

    hasFocus = true;
    // In creation mode, start with empty content; in edit mode, use current content
    originalValue = isCreationMode ? '' : element?.textContent || '';
    onEditingChange?.(true);

    // Enable spellcheck when focused
    if (element) {
      element.setAttribute('spellcheck', 'true');
      focusActions.setEditingElement(element, isCreationMode ? '' : value);
    }

    if (selectAllOnFocus && element?.textContent) {
      const range = document.createRange();
      range.selectNodeContents(element);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }

  function handleBlur() {
    hasFocus = false;
    onEditingChange?.(false);
    focusActions.clearFocus();

    if (isCancelling) {
      isCancelling = false;
      return;
    }

    // Disable spellcheck when not focused
    if (element) {
      element.setAttribute('spellcheck', 'false');

      // Re-enable dragging on parent element
      const draggableParent = element.closest('[data-task-id]');
      if (draggableParent) {
        draggableParent.setAttribute('draggable', 'true');
      }
    }

    handleSave();
  }

  function handleClick(e: MouseEvent) {
    // Always stop propagation to prevent double-handling
    e.stopPropagation();

    // Call parent's onClick if provided (for row selection)
    onClick?.(e);

    // If not editable, prevent focusing
    if (!editable) {
      e.preventDefault();
    }
  }

  function handleMouseDown(e: MouseEvent) {
    // Always stop mousedown propagation to prevent double-handling
    e.stopPropagation();
  }

  function handleMouseUp(_e: MouseEvent) {
    // If we're in edit mode after mouseup, disable dragging
    if (hasFocus && element) {
      const draggableParent = element.closest('[data-task-id]');
      if (draggableParent) {
        draggableParent.setAttribute('draggable', 'false');
      }
    }
  }

  // Fix contenteditable behavior
  function fixContentEditable(node: HTMLElement) {
    // Set initial state - spellcheck disabled by default
    node.setAttribute('spellcheck', 'false');

    // Prevent newlines from being inserted
    function handleBeforeInput(e: InputEvent) {
      if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') {
        e.preventDefault();
      }
    }

    // Add event listener
    node.addEventListener('beforeinput', handleBeforeInput);

    return {
      destroy() {
        // Clean up event listener
        node.removeEventListener('beforeinput', handleBeforeInput);
      },
    };
  }
</script>

<svelte:element
  this={tag}
  class="editable-title focus-ring-tight {className}"
  class:editing={hasFocus}
  class:saving={isSaving}
  class:not-editable={!editable}
  contenteditable={editable ? 'true' : 'false'}
  spellcheck="false"
  use:fixContentEditable
  bind:this={element}
  onclick={handleClick}
  onmousedown={handleMouseDown}
  onmouseup={handleMouseUp}
  onkeydown={handleKeydown}
  onblur={handleBlur}
  onfocus={handleFocus}
  style:font-size={fontSize}
  style:font-weight={fontWeight}
  data-placeholder={placeholder}
  role={editable ? 'textbox' : 'text'}
  aria-label={editable ? 'Edit title' : 'Title (read-only)'}
  aria-readonly={!editable}
  tabindex={editable ? '0' : '-1'}
>
  {value || ''}
</svelte:element>

<style>
  .editable-title {
    cursor: text;
    position: relative;
    min-height: 1.2em;
    word-break: break-word;
    /* Always have padding to prevent layout shift when focus ring appears */
    padding: 3px 8px;
    margin: -3px -8px;
  }

  /* Non-editable state */
  .editable-title.not-editable {
    cursor: default;
    user-select: none;
    pointer-events: none;
  }

  /* Remove hover effect for desktop-style experience */

  /* When editing, show visual feedback */
  .editable-title.editing {
    background-color: rgba(0, 0, 0, 0.9);
    border-radius: 4px;
  }

  /* Let browser handle default focus ring without modification */

  .editable-title.saving {
    opacity: 0.6;
    pointer-events: none;
  }

  /* Show placeholder when empty */
  .editable-title:empty::before {
    content: attr(data-placeholder);
    color: var(--text-tertiary);
    pointer-events: none;
  }

  /* Keep browser default focus outline */

  /* Dark mode adjustments */
  @media (prefers-color-scheme: dark) {
    /* No hover effects */
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .editable-title {
      transition: none;
    }
  }
</style>
