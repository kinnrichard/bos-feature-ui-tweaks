<script lang="ts" generics="T = any">
  import { onMount } from 'svelte';

  // Option type definition
  interface MenuOption {
    id: string | number;
    value: T;
    label: string;
    icon?: string; // URL or emoji
    rightText?: string; // Text to show on the right side
    disabled?: boolean;
    divider?: boolean; // Render as divider
    header?: boolean; // Render as header
    [key: string]: any; // Allow custom properties
  }

  // Props interface
  interface Props {
    options: MenuOption[];
    selected?: T | T[];
    multiple?: boolean;
    onSelect: (value: T, option: MenuOption) => void;
    onClose?: () => void;
    showCheckmarks?: boolean;
    showIcons?: boolean;
    iconPosition?: 'left' | 'right';
    className?: string;
    optionClassName?: string;
    selectedClassName?: string;
    enableKeyboard?: boolean;
    autoFocus?: boolean;
    maxHeight?: string;
    optionContent?: import('svelte').Snippet<
      [{ option: MenuOption; isSelected: boolean; isFocused: boolean }]
    >;
    headerContent?: import('svelte').Snippet<[{ option: MenuOption }]>;
    iconContent?: import('svelte').Snippet<[{ option: MenuOption }]>;
  }

  let {
    options,
    selected,
    multiple = false,
    onSelect,
    onClose,
    showCheckmarks = true,
    showIcons = true,
    iconPosition = 'left',
    className = '',
    optionClassName = '',
    selectedClassName = '', // eslint-disable-line @typescript-eslint/no-unused-vars
    enableKeyboard = true,
    autoFocus = true,
    maxHeight = '',
    optionContent,
    headerContent,
    iconContent,
  }: Props = $props();

  let menuElement = $state<HTMLElement>();
  let focusedIndex = $state(-1);
  let searchQuery = $state('');
  let searchTimeout: ReturnType<typeof setTimeout>;

  // Filter out dividers and headers for keyboard navigation
  const selectableOptions = $derived(
    options.filter((opt) => !opt.divider && !opt.header && !opt.disabled)
  );

  // Find index in selectable options
  const focusedOption = $derived(
    focusedIndex >= 0 && focusedIndex < selectableOptions.length
      ? selectableOptions[focusedIndex]
      : null
  );

  function isSelected(value: T): boolean {
    if (selected === undefined) return false;
    if (Array.isArray(selected)) {
      return selected.includes(value);
    }
    return selected === value;
  }

  function handleSelect(option: MenuOption) {
    if (option.disabled || option.divider || option.header) return;

    onSelect(option.value, option);

    // Close on single select
    if (!multiple && onClose) {
      // Small delay to allow click animation
      setTimeout(() => onClose(), 100);
    }
  }

  function handleMouseLeave() {
    // Clear highlight when mouse leaves menu (native macOS behavior)
    focusedIndex = -1;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!enableKeyboard) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        if (focusedIndex === -1) {
          // First arrow press - select first item
          focusedIndex = 0;
        } else {
          // Normal cycling
          const nextIndex = focusedIndex < selectableOptions.length - 1 ? focusedIndex + 1 : 0;
          focusedIndex = nextIndex;
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        if (focusedIndex === -1) {
          // First arrow press - select last item
          focusedIndex = selectableOptions.length - 1;
        } else {
          // Normal cycling
          const prevIndex = focusedIndex > 0 ? focusedIndex - 1 : selectableOptions.length - 1;
          focusedIndex = prevIndex;
        }
        break;

      case 'Enter':
      case ' ':
        e.preventDefault();
        e.stopPropagation();
        if (focusedOption) {
          handleSelect(focusedOption);
        }
        break;

      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
        break;

      default:
        // Type-ahead search
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          clearTimeout(searchTimeout);
          searchQuery += e.key.toLowerCase();

          // Find first matching option
          const matchIndex = selectableOptions.findIndex((opt) =>
            opt.label.toLowerCase().startsWith(searchQuery)
          );

          if (matchIndex >= 0) {
            focusedIndex = matchIndex;
          }

          // Clear search after 1 second
          searchTimeout = setTimeout(() => {
            searchQuery = '';
          }, 1000);
        }
    }
  }

  // Focus management
  onMount(() => {
    if (autoFocus && menuElement) {
      menuElement.focus();
      // Don't set initial focus - let user initiate with keyboard or mouse
    }

    // Fix for text truncation bug: Force browser to recalculate layout
    // Without this, long text items (like "Test Customer Specialist") get truncated
    // until hover triggers a repaint. This is likely due to the popover's width
    // being calculated before the content is fully rendered.
    requestAnimationFrame(() => {
      if (menuElement) {
        menuElement.style.display = 'none';
        menuElement.offsetHeight; // Trigger reflow
        menuElement.style.display = '';
      }
    });

    return () => {
      clearTimeout(searchTimeout);
    };
  });
</script>

<div
  class="popover-menu {className}"
  role={multiple ? 'listbox' : 'menu'}
  aria-multiselectable={multiple}
  tabindex="0"
  bind:this={menuElement}
  onkeydown={handleKeydown}
  onmouseleave={handleMouseLeave}
  style={maxHeight ? `max-height: ${maxHeight};` : ''}
>
  {#each options as option (option.id)}
    {#if option.divider}
      <div class="popover-menu-divider" role="separator"></div>
    {:else if option.header}
      <div class="popover-menu-header" role="heading" aria-level="3">
        {#if headerContent}
          {@render headerContent({ option })}
        {:else}
          {#if showCheckmarks}
            <div class="popover-menu-checkmark">
              <!-- Empty placeholder for alignment -->
            </div>
          {/if}
          {#if showIcons && iconPosition === 'left'}
            <span class="popover-menu-icon popover-menu-icon-left">
              <!-- Empty placeholder for alignment -->
            </span>
          {/if}
          <span class="popover-menu-label">{option.label}</span>
        {/if}
      </div>
    {:else}
      <button
        type="button"
        role={multiple ? 'option' : 'menuitem'}
        aria-selected={isSelected(option.value)}
        aria-disabled={option.disabled}
        class="popover-menu-option {optionClassName}"
        class:selected={isSelected(option.value)}
        class:focused={option === focusedOption}
        class:disabled={option.disabled}
        disabled={option.disabled}
        onclick={() => handleSelect(option)}
        onmouseenter={() => {
          const idx = selectableOptions.indexOf(option);
          if (idx >= 0) focusedIndex = idx;
        }}
      >
        {#if optionContent}
          {@render optionContent({
            option,
            isSelected: isSelected(option.value),
            isFocused: option === focusedOption,
          })}
        {:else}
          {#if showCheckmarks}
            <div class="popover-menu-checkmark">
              {#if isSelected(option.value)}
                <img
                  src={option === focusedOption
                    ? '/icons/checkmark-white.svg'
                    : '/icons/checkmark-blue.svg'}
                  alt="Selected"
                  width="12"
                  height="12"
                />
              {/if}
            </div>
          {/if}

          {#if showIcons && iconPosition === 'left'}
            <span class="popover-menu-icon popover-menu-icon-left">
              {#if iconContent}
                {@render iconContent({ option })}
              {:else if option.icon}
                {#if option.icon.startsWith('/') || option.icon.startsWith('http')}
                  <img src={option.icon} alt="" />
                {:else}
                  {option.icon}
                {/if}
              {/if}
            </span>
          {/if}

          <span class="popover-menu-label">{option.label}</span>

          {#if option.rightText}
            <span class="popover-menu-right-text">{option.rightText}</span>
          {/if}

          {#if showIcons && option.icon && iconPosition === 'right' && !showCheckmarks}
            <span class="popover-menu-icon popover-menu-icon-right">
              {#if option.icon.startsWith('/') || option.icon.startsWith('http')}
                <img src={option.icon} alt="" />
              {:else}
                {option.icon}
              {/if}
            </span>
          {/if}
        {/if}
      </button>
    {/if}
  {/each}
</div>

<style>
  .popover-menu {
    display: flex;
    flex-direction: column;
    padding: 4px;
    min-width: 200px;
    outline: none;
  }

  /* Scrollbar styling */
  .popover-menu::-webkit-scrollbar {
    width: 6px;
  }

  .popover-menu::-webkit-scrollbar-track {
    background: transparent;
  }

  .popover-menu::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary);
    border-radius: 3px;
  }

  .popover-menu-option {
    display: flex;
    align-items: center;
    padding: 4px 12px;
    border: none;
    background: none;
    text-align: left;
    border-radius: 6px;
    color: var(--text-primary); /* Use theme color by default */
    font-size: 14px;
    font-weight: 400;
    line-height: 1.5;
    width: 100%;
    position: relative;
    outline: none; /* Remove focus outline */
  }

  /* Remove focus styles from all states */
  .popover-menu-option:focus {
    outline: none;
  }

  .popover-menu-option:focus-visible {
    outline: none;
  }

  .popover-menu-option:hover:not(.disabled) {
    background-color: var(--bg-tertiary);
  }

  .popover-menu-option.focused:not(.disabled) {
    background-color: var(--accent-blue);
    color: #ffffff; /* Pure white when highlighted */
    text-shadow: 1.5px 1.5px 3px rgba(0, 0, 0, 0.5);
  }

  .popover-menu-option.selected:not(.disabled) {
    background-color: var(--accent-blue-bg);
  }

  .popover-menu-option.selected.focused:not(.disabled) {
    background-color: var(--accent-blue);
    color: #ffffff; /* Pure white when highlighted */
    text-shadow: 1.5px 1.5px 3px rgba(0, 0, 0, 0.5);
  }

  .popover-menu-option.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .popover-menu-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    line-height: 1;
  }

  .popover-menu-icon img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .popover-menu-icon-left {
    margin-right: 8px;
  }

  .popover-menu-icon-right {
    margin-left: auto;
  }

  .popover-menu-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .popover-menu-right-text {
    margin-left: auto;
    padding-left: 12px;
    color: var(--text-secondary);
    font-size: 14px;
    white-space: nowrap;
  }

  /* When focused, make right text white too */
  .popover-menu-option.focused .popover-menu-right-text {
    color: #ffffff;
  }

  .popover-menu-checkmark {
    flex-shrink: 0;
    min-width: 12px;
    width: 12px;
    height: 12px;
    margin-right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .popover-menu-divider {
    height: 1px;
    background-color: var(--border-primary);
    margin: 4px 12px 4px 32px; /* 32px = 12px padding + 12px checkmark + 8px gap */
  }

  .popover-menu-header {
    display: flex;
    align-items: center;
    padding: 4px 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    opacity: 0.33;
    line-height: 1.5;
  }

  .popover-menu-header .popover-menu-label {
    /* Remove the right padding since headers don't need space for right-side elements */
    padding-right: 0;
  }

  /* Accessibility improvements */
  @media (prefers-reduced-motion: reduce) {
    .popover-menu-option {
      transition: none;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .popover-menu-option.focused {
      /* Use stronger background instead of outline for high contrast */
      background-color: var(--bg-tertiary);
    }

    .popover-menu-option.selected {
      font-weight: 600;
    }
  }

  /* Dark mode adjustments */
  @media (prefers-color-scheme: dark) {
    .popover-menu {
      /* Colors are already using CSS variables that adapt to dark mode */
    }
  }
</style>
