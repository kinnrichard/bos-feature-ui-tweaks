---
issue_id: ISS-0006
title: Create StatusBadge component for consistent status display
description: Extract repeated status emoji logic into a reusable StatusBadge component that can be used across job and task views
status: completed
priority: high
assignee: unassigned
created_date: 2025-07-19T20:30:00.000Z
updated_date: 2025-07-21T18:44:00.000Z
estimated_hours: 4
actual_hours: 4
tags:
  - frontend
  - component
  - refactoring
  - ui
epic_id: EP-0003
sprint: null
completion_percentage: 100
---

# Create StatusBadge Component

## Overview
Currently, status emoji logic is duplicated across multiple components (JobDetailView, JobCard, JobStatusButton, TaskRow). This issue focuses on creating a reusable StatusBadge component to eliminate this duplication.

## Current State
```typescript
// Repeated in multiple files:
import { getJobStatusEmoji, getTaskStatusEmoji } from '$lib/config/emoji';
const statusEmoji = $derived(getJobStatusEmoji(job?.status));
```

## Requirements

### Component Location
- Create `frontend/src/lib/components/ui/StatusBadge.svelte`

### Component Props
```typescript
interface StatusBadgeProps {
  status: string;
  type?: 'job' | 'task';  // default: 'job'
  showLabel?: boolean;    // default: false
  size?: 'small' | 'medium' | 'large';  // default: 'medium'
  className?: string;     // additional CSS classes
}
```

### Implementation Details

1. **Emoji Display**
   - Use existing `getJobStatusEmoji` and `getTaskStatusEmoji` functions
   - Handle null/undefined status gracefully
   - Support both job and task status types

2. **Label Formatting**
   - Convert snake_case to Title Case (e.g., "in_progress" → "In Progress")
   - Only show label when `showLabel` is true

3. **Size Variants**
   - small: 14px font size
   - medium: 16px font size (default)
   - large: 18px font size

4. **Styling**
   - Use CSS classes for consistency
   - Support custom className prop for flexibility
   - Ensure proper alignment with inline-flex

## Acceptance Criteria

- [ ] Component created at specified location
- [ ] All props implemented with proper TypeScript types
- [ ] Emoji displays correctly for all status values
- [ ] Label formatting works correctly when enabled
- [ ] Size variants apply correct font sizes
- [ ] Component handles null/undefined status without errors
- [ ] CSS is scoped and doesn't leak styles

## Components to Update

After creating StatusBadge, update these components:

1. **JobDetailView.svelte**
   - Replace: `const statusEmoji = $derived(getJobStatusEmoji(job?.status));`
   - With: `<StatusBadge status={job?.status} type="job" />`

2. **JobCard.svelte**
   - Replace: `<span class="job-status-emoji">{statusEmoji}</span>`
   - With: `<StatusBadge status={job.status} type="job" />`

3. **JobStatusButton.svelte**
   - Replace emoji span in button
   - With: `<StatusBadge status={currentStatus} type="job" />`

4. **TaskRow.svelte**
   - Replace status emoji logic
   - With: `<StatusBadge status={task.status} type="task" size="small" />`

## Testing

1. **Unit Tests** (`StatusBadge.test.ts`)
   - Test all status values for both job and task types
   - Test null/undefined handling
   - Test label formatting
   - Test size variants
   - Test custom className application

2. **Visual Testing**
   - Verify emoji displays correctly
   - Check alignment in different contexts
   - Test all size variants
   - Ensure no style leakage

## Example Implementation

```svelte
<script lang="ts">
  import { getJobStatusEmoji, getTaskStatusEmoji } from '$lib/config/emoji';
  
  let {
    status,
    type = 'job',
    showLabel = false,
    size = 'medium',
    className = ''
  }: StatusBadgeProps = $props();
  
  const emoji = $derived(
    !status ? '' :
    type === 'job' 
      ? getJobStatusEmoji(status) 
      : getTaskStatusEmoji(status)
  );
  
  const label = $derived(
    status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || ''
  );
</script>

{#if status}
  <span class="status-badge status-badge--{size} {className}">
    <span class="status-emoji">{emoji}</span>
    {#if showLabel}
      <span class="status-label">{label}</span>
    {/if}
  </span>
{/if}
```

## Definition of Done

- [ ] Component implemented with all requirements
- [ ] Unit tests written and passing
- [ ] No TypeScript errors
- [ ] All listed components updated to use StatusBadge
- [ ] Code reviewed and approved
- [ ] No regressions in existing functionality