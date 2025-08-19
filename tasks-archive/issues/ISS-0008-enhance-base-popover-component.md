---
issue_id: ISS-0008
title: Enhance BasePopover to handle all popover use cases
description: Audit and enhance BasePopover.svelte to support all current popover patterns, fixing positioning and arrow issues
status: completed
priority: high
assignee: unassigned
created_date: 2025-07-19T20:34:00.000Z
updated_date: 2025-07-21T18:41:00.000Z
estimated_hours: 6
actual_hours: 6
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

# Enhance BasePopover Component

## Overview
BasePopover.svelte exists but doesn't handle all use cases. Multiple components have custom popover implementations. This issue enhances BasePopover to be the single source of truth for all popovers.

## Current State Analysis

### Existing Popovers
1. **BasePopover.svelte** - Has arrow positioning issues, limited configurability
2. **JobStatusButton** - Uses BasePopover
3. **TechnicianAssignmentButton** - Uses BasePopover
4. **SchedulePriorityEditPopover** - Custom implementation
5. **TaskInfoPopover** - Custom positioning logic
6. **FilterPopover** - Custom implementation

### Current Issues
- Arrow positioning doesn't work correctly for all placements
- Limited width configuration options
- No support for max-height with scrolling
- Missing animation options
- Inconsistent close behavior

## Requirements

### Enhanced Props
```typescript
interface BasePopoverProps {
  // Existing
  preferredPlacement?: 'top' | 'bottom' | 'left' | 'right';
  panelWidth?: string;
  enabled?: boolean;
  
  // New additions
  panelMaxHeight?: string;      // Enable scrolling content
  panelMinWidth?: string;       // Minimum width constraint
  offset?: number;              // Distance from trigger
  showArrow?: boolean;          // Toggle arrow visibility
  closeOnClickOutside?: boolean; // default: true
  closeOnEscape?: boolean;      // default: true
  animationDuration?: number;   // Animation timing
  className?: string;           // Custom panel classes
  arrowClassName?: string;      // Custom arrow classes
  
  // Slots
  trigger: Snippet;
  children: Snippet;
}
```

### Arrow Positioning Fix
1. **Current Problem**: Arrow uses CSS ::before/::after with fixed positioning
2. **Solution**: Calculate arrow position dynamically based on trigger element
3. **Requirements**:
   - Arrow should point to center of trigger element
   - Handle viewport boundaries gracefully
   - Support all four placements correctly

### Scrolling Content Support
```css
.popover-content-wrapper {
  max-height: var(--panel-max-height, none);
  overflow-y: auto;
  overflow-x: hidden;
}
```

### Animation Support
```svelte
{#if $open && enabled}
  <div 
    transition:fade={{ duration: animationDuration }}
    ...
  >
</div>
{/if}
```

## Implementation Tasks

- [ ] Add new props with TypeScript interfaces
- [ ] Fix arrow positioning calculation
- [ ] Add scrolling support with max-height
- [ ] Implement animation transitions
- [ ] Add keyboard escape handler
- [ ] Improve outside click detection
- [ ] Add viewport boundary detection
- [ ] Test with all existing popover uses

## Migration Guide

### Before (Custom Popover):
```svelte
<div class="custom-popover" class:hidden={!isOpen}>
  <div class="popover-arrow"></div>
  <div class="popover-content">
    <!-- content -->
  </div>
</div>
```

### After (BasePopover):
```svelte
<BasePopover 
  preferredPlacement="bottom"
  panelMaxHeight="300px"
  showArrow={true}
>
  {#snippet trigger({ popover })}
    <button use:popover.button>Open</button>
  {/snippet}
  
  {#snippet children({ close })}
    <!-- content -->
  {/snippet}
</BasePopover>
```

## Components to Update

1. **SchedulePriorityEditPopover** - Migrate to BasePopover
2. **TaskInfoPopover** - Use BasePopover instead of custom
3. **FilterPopover** - Replace custom implementation
4. **All existing BasePopover uses** - Test for regressions

## Testing

1. **Visual Testing**
   - All four placements render correctly
   - Arrow points to trigger center
   - Animations are smooth
   - Scrolling works with long content

2. **Interaction Testing**
   - Click outside closes popover
   - Escape key closes popover
   - Multiple popovers don't interfere
   - Focus management works correctly

3. **Boundary Testing**
   - Popover adjusts near viewport edges
   - Arrow repositions appropriately
   - Content doesn't overflow viewport

## Example Enhanced Implementation

```svelte
<script lang="ts">
  // ... existing imports
  
  let {
    preferredPlacement = 'bottom',
    panelWidth = '240px',
    panelMaxHeight,
    panelMinWidth,
    offset = 8,
    showArrow = true,
    closeOnClickOutside = true,
    closeOnEscape = true,
    animationDuration = 200,
    className = '',
    arrowClassName = '',
    enabled = true,
    trigger,
    children
  }: BasePopoverProps = $props();
  
  // Enhanced arrow positioning
  async function positionArrow() {
    await tick();
    if (!showArrow || !buttonElement || !panelElement) return;
    
    const button = buttonElement.querySelector('button') || buttonElement;
    const buttonRect = button.getBoundingClientRect();
    const panelRect = panelElement.getBoundingClientRect();
    
    // Calculate center-aligned arrow position
    // ... implementation
  }
  
  // Escape key handler
  function handleKeydown(e: KeyboardEvent) {
    if (closeOnEscape && e.key === 'Escape' && $open) {
      closePopover();
    }
  }
</script>
```

## Definition of Done

- [ ] All new props implemented
- [ ] Arrow positioning fixed for all placements
- [ ] Scrolling content supported
- [ ] Animations working smoothly
- [ ] Keyboard shortcuts implemented
- [ ] All existing popovers still work
- [ ] Custom popovers migrated to BasePopover
- [ ] Documentation updated
- [ ] Tests passing