---
issue_id: ISS-0007
title: Create PriorityBadge component for consistent priority display
description: Extract repeated priority emoji logic into a reusable PriorityBadge component with smart visibility handling
status: completed
priority: high
assignee: unassigned
created_date: 2025-07-19T20:32:00.000Z
updated_date: 2025-07-21T18:43:00.000Z
estimated_hours: 3
actual_hours: 3
tags:
  - frontend
  - component
  - refactoring
  - ui
epic_id: EP-0003
sprint: null
completion_percentage: 100
---

# Create PriorityBadge Component

## Overview
Priority emoji logic is currently repeated across multiple components. This issue creates a reusable PriorityBadge component with intelligent display logic (hiding "normal" priority by default).

## Current State
```typescript
// In JobCard.svelte:
const priorityEmoji = $derived(getJobPriorityEmoji(job.priority));
// Then conditionally rendered:
{#if job.priority !== 'normal' && priorityEmoji}
  <span class="job-priority-emoji">{priorityEmoji}</span>
{/if}
```

## Requirements

### Component Location
- Create `frontend/src/lib/components/ui/PriorityBadge.svelte`

### Component Props
```typescript
interface PriorityBadgeProps {
  priority: string | undefined;
  showLabel?: boolean;      // default: false
  hideIfNormal?: boolean;   // default: true
  size?: 'small' | 'medium' | 'large';  // default: 'medium'
  className?: string;       // additional CSS classes
}
```

### Implementation Details

1. **Smart Visibility**
   - Hide badge when priority is "normal" and `hideIfNormal` is true
   - Always show if `hideIfNormal` is false
   - Handle undefined/null priority gracefully

2. **Emoji Display**
   - Use existing `getJobPriorityEmoji` function
   - Support all priority levels

3. **Label Display**
   - Show priority text when `showLabel` is true
   - Format as capitalized text

4. **Consistent Sizing**
   - Match StatusBadge sizing for consistency
   - small: 14px, medium: 16px, large: 18px

## Acceptance Criteria

- [ ] Component created at specified location
- [ ] All props implemented with proper TypeScript types
- [ ] Badge hidden by default for "normal" priority
- [ ] Emoji displays correctly for all priority values
- [ ] Label displays when enabled
- [ ] Size variants work correctly
- [ ] Component handles null/undefined gracefully
- [ ] No style leakage

## Components to Update

1. **JobCard.svelte**
   ```svelte
   <!-- Replace -->
   {#if job.priority !== 'normal' && priorityEmoji}
     <span class="job-priority-emoji">{priorityEmoji}</span>
   {/if}
   
   <!-- With -->
   <PriorityBadge priority={job.priority} />
   ```

2. **JobDetailView.svelte**
   ```svelte
   <!-- Add where priority display is needed -->
   <PriorityBadge priority={job?.priority} showLabel={true} />
   ```

3. **SchedulePriorityEditPopover.svelte**
   ```svelte
   <!-- Use in priority selection list -->
   <PriorityBadge 
     priority={option.value} 
     showLabel={true} 
     hideIfNormal={false} 
   />
   ```

## Testing

1. **Unit Tests** (`PriorityBadge.test.ts`)
   - Test all priority values
   - Test hideIfNormal behavior
   - Test null/undefined handling
   - Test label display
   - Test size variants

2. **Edge Cases**
   - Undefined priority
   - Empty string priority
   - Unknown priority values

## Example Implementation

```svelte
<script lang="ts">
  import { getJobPriorityEmoji } from '$lib/config/emoji';
  
  let {
    priority,
    showLabel = false,
    hideIfNormal = true,
    size = 'medium',
    className = ''
  }: PriorityBadgeProps = $props();
  
  const emoji = $derived(priority ? getJobPriorityEmoji(priority) : '');
  const isNormal = $derived(priority === 'normal');
  const shouldShow = $derived(priority && (!hideIfNormal || !isNormal));
  
  const label = $derived(
    priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : ''
  );
</script>

{#if shouldShow}
  <span class="priority-badge priority-badge--{size} {className}">
    <span class="priority-emoji">{emoji}</span>
    {#if showLabel}
      <span class="priority-label">{label}</span>
    {/if}
  </span>
{/if}

<style>
  .priority-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .priority-badge--small { font-size: 14px; }
  .priority-badge--medium { font-size: 16px; }
  .priority-badge--large { font-size: 18px; }
  
  .priority-label {
    color: var(--text-secondary);
    font-weight: 500;
  }
</style>
```

## Definition of Done

- [ ] Component implemented with all requirements
- [ ] Unit tests written and passing
- [ ] TypeScript types defined
- [ ] Listed components updated
- [ ] Visual regression tests pass
- [ ] Code reviewed and approved
- [ ] No functionality regressions