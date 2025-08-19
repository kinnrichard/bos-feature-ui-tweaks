---
issue_id: ISS-0009
title: Create EditableTitle component for consistent inline editing
description: Extract contenteditable title logic into a reusable component for job and task title editing
status: completed
priority: high
assignee: unassigned
created_date: 2025-07-19T20:36:00.000Z
updated_date: 2025-07-21T18:40:00.000Z
estimated_hours: 5
actual_hours: 5
tags:
  - frontend
  - component
  - refactoring
  - ui
  - forms
epic_id: EP-0003
sprint: null
completion_percentage: 100
---

# Create EditableTitle Component

## Overview
Title editing logic is duplicated in JobDetailView and TaskRow components. Both use contenteditable with similar patterns for focus, save, and cancel. This issue extracts that logic into a reusable EditableTitle component.

## Current State

### In JobDetailView.svelte:
```svelte
<h1 
  class="job-title" 
  contenteditable="true"
  use:fixContentEditable
  onkeydown={handleJobTitleKeydown}
  onblur={handleJobTitleBlur}
  onfocus={handleJobTitleFocus}
  bind:this={jobTitleElement}
>
  {jobTitle}
</h1>

// Plus ~40 lines of handler functions
```

### In TaskRow.svelte:
```svelte
{#if isEditing}
  <h3 
    class="task-title"
    contenteditable="true"
    use:fixContentEditable
    // Similar handlers...
  >
{/if}
```

## Requirements

### Component Location
- Create `frontend/src/lib/components/ui/EditableTitle.svelte`

### Component Props
```typescript
interface EditableTitleProps {
  value: string;                // Current title value
  placeholder?: string;         // Placeholder when empty
  onSave: (newValue: string) => Promise<void>;  // Save callback
  onCancel?: () => void;       // Cancel callback
  
  // Styling
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'span';  // default: 'h3'
  className?: string;          // Additional CSS classes
  fontSize?: string;           // Font size override
  fontWeight?: string;         // Font weight override
  
  // Behavior
  selectAllOnFocus?: boolean;  // Select all text on focus (default: true)
  trimOnSave?: boolean;        // Trim whitespace (default: true)
  allowEmpty?: boolean;        // Allow saving empty values (default: false)
  autoFocus?: boolean;         // Focus on mount (default: false)
  
  // Edit mode control (for external management)
  isEditing?: boolean;         // Controlled edit state
  onEditingChange?: (editing: boolean) => void;
}
```

### Key Features

1. **Keyboard Handling**
   - Enter: Save changes
   - Escape: Cancel and revert
   - Click outside: Save (configurable)

2. **Focus Management**
   - Use focusManager store integration
   - Handle cursor positioning
   - Select all text option

3. **Validation**
   - Prevent saving empty titles (unless allowed)
   - Trim whitespace
   - Revert on invalid input

4. **Visual Feedback**
   - Focus ring styling
   - Cursor change on hover
   - Loading state during save

## Implementation Details

```svelte
<script lang="ts">
  import { fixContentEditable } from '$lib/actions/fixContentEditable';
  import { focusActions } from '$lib/stores/focusManager.svelte';
  
  let {
    value,
    placeholder = 'Untitled',
    onSave,
    onCancel,
    tag = 'h3',
    className = '',
    fontSize,
    fontWeight,
    selectAllOnFocus = true,
    trimOnSave = true,
    allowEmpty = false,
    autoFocus = false,
    isEditing: externalIsEditing,
    onEditingChange
  }: EditableTitleProps = $props();
  
  let element = $state<HTMLElement>();
  let originalValue = $state(value);
  let isSaving = $state(false);
  
  // Support both controlled and uncontrolled modes
  let internalIsEditing = $state(false);
  const isEditing = $derived(externalIsEditing ?? internalIsEditing);
  
  async function handleSave() {
    const newValue = element?.textContent || '';
    const trimmedValue = trimOnSave ? newValue.trim() : newValue;
    
    if (!allowEmpty && !trimmedValue) {
      handleCancel();
      return;
    }
    
    if (trimmedValue === originalValue) {
      exitEditMode();
      return;
    }
    
    isSaving = true;
    try {
      await onSave(trimmedValue);
      originalValue = trimmedValue;
      exitEditMode();
    } catch (error) {
      // Revert on error
      if (element) element.textContent = originalValue;
    } finally {
      isSaving = false;
    }
  }
  
  function handleCancel() {
    if (element) element.textContent = originalValue;
    onCancel?.();
    exitEditMode();
  }
  
  function enterEditMode() {
    if (externalIsEditing === undefined) {
      internalIsEditing = true;
    }
    onEditingChange?.(true);
    focusActions.setEditingElement(element!, value);
  }
  
  function exitEditMode() {
    if (externalIsEditing === undefined) {
      internalIsEditing = false;
    }
    onEditingChange?.(false);
    focusActions.clearFocus();
  }
</script>

<svelte:element 
  this={tag}
  class="editable-title {className}"
  class:editing={isEditing}
  class:saving={isSaving}
  contenteditable={isEditing}
  use:fixContentEditable
  bind:this={element}
  onclick={!isEditing ? enterEditMode : undefined}
  onkeydown={(e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }}
  onblur={handleSave}
  onfocus={(e) => {
    originalValue = element?.textContent || '';
    if (selectAllOnFocus) {
      const range = document.createRange();
      range.selectNodeContents(e.currentTarget);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }}
  style:font-size={fontSize}
  style:font-weight={fontWeight}
  data-placeholder={placeholder}
>
  {value}
</svelte:element>

<style>
  .editable-title {
    cursor: text;
    transition: all 0.15s ease;
    position: relative;
  }
  
  .editable-title:not(.editing):hover {
    background-color: var(--bg-tertiary);
    border-radius: 4px;
  }
  
  .editable-title.editing {
    outline: 2px solid var(--accent-blue);
    outline-offset: 2px;
    border-radius: 4px;
    padding: 2px 4px;
  }
  
  .editable-title.saving {
    opacity: 0.6;
    pointer-events: none;
  }
  
  .editable-title:empty::before {
    content: attr(data-placeholder);
    color: var(--text-tertiary);
  }
</style>
```

## Components to Update

1. **JobDetailView.svelte**
   ```svelte
   <EditableTitle
     value={job?.title || ''}
     tag="h1"
     className="job-title"
     placeholder="Untitled Job"
     autoFocus={isUntitledJob}
     onSave={async (newTitle) => {
       await Job.update(jobId, { title: newTitle });
     }}
   />
   ```

2. **TaskRow.svelte**
   ```svelte
   <EditableTitle
     value={task.title}
     tag="h3"
     className="task-title"
     isEditing={isEditing}
     onEditingChange={(editing) => {
       dispatch('taskaction', {
         type: editing ? 'startEdit' : 'cancelEdit',
         taskId: task.id
       });
     }}
     onSave={async (newTitle) => {
       await Task.update(task.id, { title: newTitle });
     }}
   />
   ```

## Testing

1. **Unit Tests**
   - Test keyboard shortcuts
   - Test save/cancel behavior
   - Test empty value handling
   - Test focus management
   - Test controlled/uncontrolled modes

2. **Integration Tests**
   - Test with Job model updates
   - Test with Task model updates
   - Test error handling
   - Test loading states

## Definition of Done

- [ ] Component created with all props
- [ ] Keyboard shortcuts working
- [ ] Focus management implemented
- [ ] Save/cancel logic working
- [ ] JobDetailView updated
- [ ] TaskRow updated
- [ ] Tests written and passing
- [ ] No regressions in title editing
- [ ] Documentation added