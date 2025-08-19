---
issue_id: ISS-0011
title: Extract UserAvatar component for consistent user display
description: Create a reusable UserAvatar component to standardize technician/user avatar display across the application
status: completed
priority: medium
assignee: unassigned
created_date: 2025-07-19T20:40:00.000Z
updated_date: 2025-07-21T18:42:00.000Z
estimated_hours: 3
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

# Extract UserAvatar Component

## Overview
User avatar rendering logic is duplicated across multiple components with inconsistent styling and behavior. This issue creates a standardized UserAvatar component.

## Current State

### In JobCard.svelte:
```svelte
const technicians = $derived(job.jobAssignments?.map((assignment: any) => ({
  id: assignment.user?.id,
  name: assignment.user?.name,
  initials: assignment.user?.name?.split(' ').map((n: string) => n[0]).join('') || '?',
  avatar_style: `background-color: var(--accent-blue);`
})) || []);

// Later in template:
<span 
  class="technician-avatar" 
  style={technician.avatar_style || `background-color: var(--accent-blue);`}
>
  {technician.initials}
</span>
```

### Similar patterns in:
- TechnicianAssignmentButton
- TaskRow (when showing assignees)
- Various popover components

## Requirements

### Component Location
- Create `frontend/src/lib/components/ui/UserAvatar.svelte`

### Component Props
```typescript
interface UserAvatarProps {
  user?: {
    id?: string | number;
    name?: string;
    email?: string;
    avatar_url?: string;
    color?: string;  // Hex color or CSS variable
  };
  
  // Display options
  size?: 'small' | 'medium' | 'large' | 'xlarge';  // default: 'medium'
  shape?: 'circle' | 'square';                      // default: 'circle'
  showTooltip?: boolean;                            // default: false
  showBorder?: boolean;                             // default: true
  
  // Behavior
  clickable?: boolean;                              // default: false
  onClick?: (user: any) => void;
  
  // Styling
  className?: string;
  style?: string;
  
  // Group display (for overlapping avatars)
  overlap?: boolean;                                // default: false
  overlapOrder?: number;                           // z-index order
}
```

### Features

1. **Initial Generation**
   - Extract initials from name
   - Handle various name formats
   - Fallback to "?" for missing names
   - Use email if no name available

2. **Color Assignment**
   - Use provided color if available
   - Generate consistent color from user ID
   - Support theme colors (CSS variables)
   - Ensure good contrast with text

3. **Image Support**
   - Display avatar_url if provided
   - Fallback to initials on load error
   - Lazy loading for performance

4. **Size Variants**
   - small: 24px
   - medium: 32px (default)
   - large: 40px
   - xlarge: 56px

5. **Tooltip Support**
   - Show full name on hover
   - Use Tippy.js or native title

## Implementation

```svelte
<script lang="ts">
  import { createTooltip } from '@melt-ui/svelte';
  
  let {
    user,
    size = 'medium',
    shape = 'circle',
    showTooltip = false,
    showBorder = true,
    clickable = false,
    onClick,
    className = '',
    style = '',
    overlap = false,
    overlapOrder = 0
  }: UserAvatarProps = $props();
  
  // Generate initials
  const initials = $derived(() => {
    if (!user?.name && !user?.email) return '?';
    
    const source = user.name || user.email || '';
    
    // Handle email format
    if (!user.name && user.email) {
      return user.email.charAt(0).toUpperCase();
    }
    
    // Handle full names
    const parts = source.trim().split(/\s+/);
    if (parts.length >= 2) {
      return parts[0][0] + parts[parts.length - 1][0];
    }
    
    // Single name or word
    return source.slice(0, 2).toUpperCase();
  });
  
  // Generate color from user ID
  const backgroundColor = $derived(() => {
    if (user?.color) return user.color;
    
    if (!user?.id) return 'var(--accent-blue)';
    
    // Simple color generation from ID
    const colors = [
      'var(--accent-blue)',
      'var(--accent-green)',
      'var(--accent-purple)',
      'var(--accent-orange)',
      'var(--accent-red)',
      'var(--accent-teal)'
    ];
    
    const index = typeof user.id === 'number' 
      ? user.id % colors.length
      : parseInt(user.id, 36) % colors.length;
      
    return colors[index];
  });
  
  const sizeClasses = {
    small: 'avatar--small',
    medium: 'avatar--medium',
    large: 'avatar--large',
    xlarge: 'avatar--xlarge'
  };
  
  let imageError = $state(false);
  
  const tooltip = showTooltip ? createTooltip() : null;
</script>

{#if showTooltip && tooltip}
  <div use:tooltip.trigger>
    <!-- Avatar content below -->
  </div>
  {#if $tooltip.open}
    <div use:tooltip.content class="avatar-tooltip">
      {user?.name || user?.email || 'Unknown User'}
    </div>
  {/if}
{/if}

<button
  type="button"
  class="user-avatar {sizeClasses[size]} {className}"
  class:avatar--circle={shape === 'circle'}
  class:avatar--square={shape === 'square'}
  class:avatar--clickable={clickable}
  class:avatar--border={showBorder}
  class:avatar--overlap={overlap}
  style="background-color: {backgroundColor}; {style}"
  style:z-index={overlap ? overlapOrder : undefined}
  disabled={!clickable}
  onclick={clickable ? () => onClick?.(user) : undefined}
  title={!showTooltip ? (user?.name || user?.email) : undefined}
>
  {#if user?.avatar_url && !imageError}
    <img 
      src={user.avatar_url} 
      alt={user.name || 'User avatar'}
      onerror={() => imageError = true}
      loading="lazy"
    />
  {:else}
    <span class="avatar-initials">{initials()}</span>
  {/if}
</button>

<style>
  .user-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: white;
    text-shadow: 0.5px 0.5px 2px rgba(0, 0, 0, 0.75);
    position: relative;
    flex-shrink: 0;
    border: none;
    padding: 0;
    overflow: hidden;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  
  .avatar--circle {
    border-radius: 50%;
  }
  
  .avatar--square {
    border-radius: 6px;
  }
  
  .avatar--border {
    box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 3px var(--border-primary);
  }
  
  .avatar--clickable {
    cursor: pointer;
  }
  
  .avatar--clickable:hover {
    transform: scale(1.05);
    box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 3px var(--accent-blue);
  }
  
  .avatar--clickable:active {
    transform: scale(0.95);
  }
  
  /* Size variants */
  .avatar--small {
    width: 24px;
    height: 24px;
    font-size: 10px;
  }
  
  .avatar--medium {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }
  
  .avatar--large {
    width: 40px;
    height: 40px;
    font-size: 16px;
  }
  
  .avatar--xlarge {
    width: 56px;
    height: 56px;
    font-size: 20px;
  }
  
  /* Overlap styles */
  .avatar--overlap:not(:first-child) {
    margin-left: -8px;
  }
  
  .user-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .avatar-initials {
    text-transform: uppercase;
  }
  
  .avatar-tooltip {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    box-shadow: var(--shadow-md);
    z-index: 1000;
  }
</style>
```

## Usage Examples

### Single Avatar:
```svelte
<UserAvatar 
  user={{
    id: 123,
    name: "John Doe",
    avatar_url: "/avatars/john.jpg"
  }}
  size="medium"
  showTooltip={true}
/>
```

### Avatar Group:
```svelte
<div class="avatar-group">
  {#each technicians as technician, index}
    <UserAvatar 
      user={technician}
      size="small"
      overlap={true}
      overlapOrder={technicians.length - index}
    />
  {/each}
</div>
```

## Components to Update

1. **JobCard** - Replace technician avatar rendering
2. **TechnicianAssignmentButton** - Use for selected technicians
3. **TaskRow** - Show assignees with UserAvatar
4. **Any user lists** - Standardize all user displays

## Definition of Done

- [ ] Component created with all props
- [ ] Initial generation working correctly
- [ ] Color assignment consistent
- [ ] Image loading with fallback
- [ ] All size variants styled
- [ ] Tooltip functionality working
- [ ] Overlap mode for groups
- [ ] Components updated to use UserAvatar
- [ ] Tests written
- [ ] No visual regressions