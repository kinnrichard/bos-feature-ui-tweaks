---
issue_id: ISS-0010
title: Create PopoverMenu component for consistent option lists
description: Extract repeated popover menu patterns into a reusable component for status, priority, and other selection lists
status: completed
priority: medium
assignee: unassigned
created_date: 2025-07-19T20:38:00.000Z
updated_date: 2025-07-21T18:45:00.000Z
estimated_hours: 4
actual_hours: 5
tags:
  - frontend
  - component
  - refactoring
  - ui
  - popover
epic_id: EP-0003
sprint: null
completion_percentage: 100
---

# Create PopoverMenu Component

## Overview
Multiple components implement similar option list patterns inside popovers (status selection, priority selection, technician assignment). This issue creates a reusable PopoverMenu component that works with BasePopover.

## Current State

### Repeated Pattern in JobStatusButton:
```svelte
<PopoverOptionList
  options={availableStatuses}
  onOptionClick={handleStatusChange}
  isSelected={(option) => option.value === currentStatus}
>
  {#snippet optionContent({ option })}
    <span class="status-emoji">{option.emoji}</span>
    <span class="popover-option-main-label">{option.label}</span>
    <div class="popover-checkmark-container">
      {#if option.value === currentStatus}
        <img src="/icons/checkmark.svg" alt="Selected" />
      {/if}
    </div>
  {/snippet}
</PopoverOptionList>
```

Similar patterns exist in TechnicianAssignmentButton, SchedulePriorityEditPopover, and others.

## Requirements

### Component Location
- Create `frontend/src/lib/components/ui/PopoverMenu.svelte`

### Component Props
```typescript
interface PopoverMenuProps<T = any> {
  options: Array<{
    id: string | number;
    value: T;
    label: string;
    icon?: string;      // URL or emoji
    disabled?: boolean;
    divider?: boolean;  // Render as divider
    header?: boolean;   // Render as header
  }>;
  
  selected?: T | T[];   // Current selection(s)
  multiple?: boolean;   // Allow multiple selection
  
  onSelect: (value: T, option: any) => void;
  onClose?: () => void;
  
  // Display options
  showCheckmarks?: boolean;  // default: true
  showIcons?: boolean;      // default: true
  iconPosition?: 'left' | 'right';  // default: 'left'
  
  // Styling
  className?: string;
  optionClassName?: string;
  selectedClassName?: string;
  
  // Keyboard navigation
  enableKeyboard?: boolean;  // default: true
  autoFocus?: boolean;      // default: true
}
```

### Features

1. **Option Types**
   - Regular selectable options
   - Dividers for visual separation
   - Headers for grouping
   - Disabled options

2. **Selection Modes**
   - Single selection (radio behavior)
   - Multiple selection (checkbox behavior)
   - Optional selection (can deselect all)

3. **Keyboard Navigation**
   - Arrow keys to navigate
   - Enter/Space to select
   - Escape to close
   - Type-ahead search

4. **Visual Feedback**
   - Hover states
   - Selected state with checkmark
   - Disabled state styling
   - Focus indicators

## Implementation Example

```svelte
<script lang="ts" generics="T">
  import { onMount } from 'svelte';
  
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
    selectedClassName = '',
    enableKeyboard = true,
    autoFocus = true
  }: PopoverMenuProps<T> = $props();
  
  let menuElement = $state<HTMLElement>();
  let focusedIndex = $state(0);
  
  const selectableOptions = $derived(
    options.filter(opt => !opt.divider && !opt.header && !opt.disabled)
  );
  
  function isSelected(value: T): boolean {
    if (Array.isArray(selected)) {
      return selected.includes(value);
    }
    return selected === value;
  }
  
  function handleSelect(option: any) {
    if (option.disabled) return;
    
    onSelect(option.value, option);
    
    if (!multiple) {
      onClose?.();
    }
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (!enableKeyboard) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusedIndex = Math.min(focusedIndex + 1, selectableOptions.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusedIndex = Math.max(focusedIndex - 1, 0);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        const focusedOption = selectableOptions[focusedIndex];
        if (focusedOption) handleSelect(focusedOption);
        break;
      case 'Escape':
        e.preventDefault();
        onClose?.();
        break;
    }
  }
  
  onMount(() => {
    if (autoFocus && menuElement) {
      menuElement.focus();
    }
  });
</script>

<div 
  class="popover-menu {className}"
  role="menu"
  tabindex="-1"
  bind:this={menuElement}
  onkeydown={handleKeydown}
>
  {#each options as option, index}
    {#if option.divider}
      <div class="popover-menu-divider" role="separator"></div>
    {:else if option.header}
      <div class="popover-menu-header" role="heading">
        {option.label}
      </div>
    {:else}
      <button
        type="button"
        role="menuitem"
        class="popover-menu-option {optionClassName}"
        class:selected={isSelected(option.value)}
        class:focused={selectableOptions.indexOf(option) === focusedIndex}
        class:disabled={option.disabled}
        disabled={option.disabled}
        onclick={() => handleSelect(option)}
      >
        {#if showIcons && option.icon && iconPosition === 'left'}
          <span class="popover-menu-icon">
            {#if option.icon.startsWith('/')}
              <img src={option.icon} alt="" />
            {:else}
              {option.icon}
            {/if}
          </span>
        {/if}
        
        <span class="popover-menu-label">{option.label}</span>
        
        {#if showIcons && option.icon && iconPosition === 'right'}
          <span class="popover-menu-icon">
            {#if option.icon.startsWith('/')}
              <img src={option.icon} alt="" />
            {:else}
              {option.icon}
            {/if}
          </span>
        {/if}
        
        {#if showCheckmarks}
          <div class="popover-menu-checkmark">
            {#if isSelected(option.value)}
              <img src="/icons/checkmark.svg" alt="Selected" />
            {/if}
          </div>
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
  
  .popover-menu-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    border-radius: 6px;
    transition: background-color 0.15s ease;
    color: var(--text-primary);
    font-size: 14px;
    width: 100%;
  }
  
  .popover-menu-option:hover:not(.disabled) {
    background-color: var(--bg-tertiary);
  }
  
  .popover-menu-option.focused {
    background-color: var(--bg-tertiary);
    outline: 2px solid var(--accent-blue);
    outline-offset: -2px;
  }
  
  .popover-menu-option.selected {
    background-color: var(--accent-blue-bg);
    color: var(--accent-blue);
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
  }
  
  .popover-menu-icon img {
    width: 100%;
    height: 100%;
  }
  
  .popover-menu-label {
    flex: 1;
  }
  
  .popover-menu-checkmark {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .popover-menu-divider {
    height: 1px;
    background-color: var(--border-secondary);
    margin: 4px 0;
  }
  
  .popover-menu-header {
    padding: 8px 12px 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-tertiary);
    text-transform: uppercase;
  }
</style>
```

## Usage Examples

### Status Selection:
```svelte
<BasePopover>
  {#snippet children({ close })}
    <PopoverMenu
      options={statusOptions}
      selected={currentStatus}
      onSelect={(value) => handleStatusChange(value)}
      onClose={close}
    />
  {/snippet}
</BasePopover>
```

### Multi-select Technicians:
```svelte
<PopoverMenu
  options={technicianOptions}
  selected={selectedTechnicianIds}
  multiple={true}
  onSelect={(value, option) => toggleTechnician(value)}
/>
```

## Components to Update

1. Replace PopoverOptionList usage in:
   - JobStatusButton
   - TechnicianAssignmentButton
   - SchedulePriorityEditPopover
   - FilterPopover

2. Standardize option formats across components

## Definition of Done

- [ ] Component created with all features
- [ ] Keyboard navigation working
- [ ] Single and multi-select modes work
- [ ] Visual states implemented
- [ ] Existing components updated
- [ ] Tests written
- [ ] Accessibility requirements met
- [ ] Documentation complete