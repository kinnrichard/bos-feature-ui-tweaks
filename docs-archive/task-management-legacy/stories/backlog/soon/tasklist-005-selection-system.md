# TASKLIST-005: Selection System

## Story Details

### TASKLIST-005: Selection System
**Points**: 3  
**Type**: Technical Refactoring  
**Priority**: Medium  
**Epic**: TaskList Component Refactoring  
**Depends on**: TASKLIST-001, TASKLIST-002, TASKLIST-003  

**As a** developer  
**I want** to extract multi-select and keyboard navigation logic into dedicated components  
**So that** selection behavior is modular, testable, and provides excellent UX

**Acceptance Criteria:**
- [ ] Create `TaskSelection.svelte` component for multi-select UI
- [ ] Extract `SelectionIndicator.svelte` for visual selection highlighting
- [ ] Create `SelectionActions.svelte` for bulk operations toolbar
- [ ] Implement `TaskKeyboardNav.svelte` for arrow key navigation
- [ ] Support click, Ctrl+click, Shift+click selection patterns
- [ ] Add keyboard shortcuts (Arrow keys, Enter, Delete, Escape)
- [ ] Visual indicators for consecutive selections
- [ ] Outside click deselection with smart detection
- [ ] Integrate with existing task operations (delete, status change)
- [ ] Use Svelte 5 runes for state management
- [ ] Accessibility features (ARIA, focus management)
- [ ] Smooth selection animations and transitions
- [ ] Performance optimization for large task lists

**Technical Implementation:**

**1. TaskSelection Component (Main Selection Manager):**
```svelte
<!-- lib/components/selection/TaskSelection.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { taskSelection } from '$lib/stores/taskSelection.svelte';
  import { taskKeyboardNav } from '$lib/stores/taskKeyboardNav.svelte';
  import SelectionIndicator from './SelectionIndicator.svelte';
  import SelectionActions from './SelectionActions.svelte';
  import type { Task } from '$lib/types/task';

  interface Props {
    tasks: Task[];
    flatTaskIds: string[];
    onTaskClick: (event: MouseEvent, taskId: string) => void;
    onTaskKeydown: (event: KeyboardEvent, taskId: string) => void;
    onBulkDelete: (taskIds: string[]) => void;
    onBulkStatusChange: (taskIds: string[], status: string) => void;
    children: any;
  }

  let {
    tasks,
    flatTaskIds,
    onTaskClick,
    onTaskKeydown,
    onBulkDelete,
    onBulkStatusChange,
    children
  }: Props = $props();

  let selectionContainer: HTMLElement;

  // Update keyboard navigation with current task order
  $effect(() => {
    taskKeyboardNav.setTaskIds(flatTaskIds);
  });

  // Enhanced task click handler
  function handleTaskClick(event: MouseEvent, taskId: string) {
    event.stopPropagation();
    
    if (event.shiftKey) {
      taskSelection.selectRange(taskId, flatTaskIds);
    } else if (event.ctrlKey || event.metaKey) {
      taskSelection.toggleTask(taskId);
    } else {
      taskSelection.selectTask(taskId);
    }
    
    // Call original handler if provided
    if (onTaskClick) {
      onTaskClick(event, taskId);
    }
  }

  // Enhanced keyboard handler
  function handleTaskKeydown(event: KeyboardEvent, taskId: string) {
    // Let individual task handle first
    if (onTaskKeydown) {
      onTaskKeydown(event, taskId);
    }
    
    // Handle selection-specific keys
    handleSelectionKeydown(event, taskId);
  }

  function handleSelectionKeydown(event: KeyboardEvent, taskId: string) {
    // Don't handle keys if actively editing
    const activeElement = document.activeElement;
    const isEditing = activeElement?.tagName === 'INPUT' || 
                     activeElement?.tagName === 'TEXTAREA' || 
                     (activeElement as HTMLElement)?.isContentEditable;

    if (isEditing) return;

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        if (taskSelection.selectedCount === 0) {
          // Select last task
          if (flatTaskIds.length > 0) {
            taskSelection.selectTask(flatTaskIds[flatTaskIds.length - 1]);
            scrollTaskIntoView(flatTaskIds[flatTaskIds.length - 1]);
          }
        } else if (taskSelection.selectedCount === 1) {
          taskKeyboardNav.navigateUp();
        }
        break;

      case 'ArrowDown':
        event.preventDefault();
        if (taskSelection.selectedCount === 0) {
          // Select first task
          if (flatTaskIds.length > 0) {
            taskSelection.selectTask(flatTaskIds[0]);
            scrollTaskIntoView(flatTaskIds[0]);
          }
        } else if (taskSelection.selectedCount === 1) {
          taskKeyboardNav.navigateDown();
        }
        break;

      case 'Enter':
        if (taskSelection.selectedCount === 1) {
          event.preventDefault();
          handleEnterKeyAction(taskId);
        }
        break;

      case 'Delete':
      case 'Backspace':
        if (taskSelection.selectedCount > 0) {
          event.preventDefault();
          const selectedIds = Array.from(taskSelection.selectedTaskIds);
          onBulkDelete(selectedIds);
        }
        break;

      case 'Escape':
        event.preventDefault();
        taskSelection.clearSelection();
        // Remove focus from any focused element
        if (document.activeElement && document.activeElement !== document.body) {
          (document.activeElement as HTMLElement).blur();
        }
        break;

      case 'a':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          selectAllTasks();
        }
        break;
    }
  }

  function handleEnterKeyAction(taskId: string) {
    const selectedTaskIndex = flatTaskIds.indexOf(taskId);
    const isLastTask = selectedTaskIndex === flatTaskIds.length - 1;
    
    if (isLastTask) {
      // Trigger new task creation
      taskSelection.clearSelection();
      // Emit event for parent to handle
      const event = new CustomEvent('create-new-task');
      selectionContainer?.dispatchEvent(event);
    } else {
      // Create inline new task
      const event = new CustomEvent('create-inline-task', { 
        detail: { afterTaskId: taskId } 
      });
      selectionContainer?.dispatchEvent(event);
    }
  }

  function selectAllTasks() {
    flatTaskIds.forEach(taskId => {
      taskSelection.selectedTaskIds.add(taskId);
    });
    if (flatTaskIds.length > 0) {
      taskSelection.lastSelectedTaskId = flatTaskIds[flatTaskIds.length - 1];
    }
  }

  function scrollTaskIntoView(taskId: string) {
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
    if (taskElement) {
      taskElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Outside click detection
  function handleOutsideClick(event: MouseEvent) {
    if (!taskSelection.selectedTaskIds.size ||
        event.metaKey || event.ctrlKey || event.shiftKey) {
      return;
    }

    const target = event.target as Element;
    const isClickOutsideContainer = !selectionContainer?.contains(target);
    const isClickOnTask = target.closest('.task-item');
    const isClickOnAction = target.closest('.task-actions, .status-emoji, .disclosure-button');

    if (isClickOutsideContainer || (!isClickOnTask && !isClickOnAction)) {
      taskSelection.clearSelection();
    }
  }

  // Global keyboard handler
  function handleGlobalKeydown(event: KeyboardEvent) {
    // Only handle when not focused on an input
    const activeElement = document.activeElement;
    const isInputFocused = activeElement?.tagName === 'INPUT' || 
                          activeElement?.tagName === 'TEXTAREA' ||
                          (activeElement as HTMLElement)?.isContentEditable;

    if (!isInputFocused) {
      handleSelectionKeydown(event, taskSelection.lastSelectedTaskId || '');
    }
  }

  onMount(() => {
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleGlobalKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleOutsideClick);
    document.removeEventListener('keydown', handleGlobalKeydown);
  });

  // Calculate selection position classes for visual feedback
  function getSelectionPositionClass(taskId: string, index: number): string {
    if (!taskSelection.isSelected(taskId)) return '';
    
    const prevTaskId = index > 0 ? flatTaskIds[index - 1] : null;
    const nextTaskId = index < flatTaskIds.length - 1 ? flatTaskIds[index + 1] : null;
    
    const prevSelected = prevTaskId && taskSelection.isSelected(prevTaskId);
    const nextSelected = nextTaskId && taskSelection.isSelected(nextTaskId);
    
    if (prevSelected && nextSelected) return 'selection-middle';
    if (prevSelected) return 'selection-bottom';
    if (nextSelected) return 'selection-top';
    
    return '';
  }
</script>

<div 
  bind:this={selectionContainer}
  class="task-selection-container"
  role="listbox"
  aria-multiselectable="true"
  aria-label="Task list"
>
  <!-- Selection Actions Toolbar -->
  {#if taskSelection.hasSelection}
    <SelectionActions
      selectedCount={taskSelection.selectedCount}
      selectedTaskIds={Array.from(taskSelection.selectedTaskIds)}
      {tasks}
      onClearSelection={() => taskSelection.clearSelection()}
      onBulkDelete={(taskIds) => onBulkDelete(taskIds)}
      onBulkStatusChange={(taskIds, status) => onBulkStatusChange(taskIds, status)}
    />
  {/if}

  <!-- Task List with Selection Indicators -->
  {#snippet taskWrapper(task, index)}
    {@const isSelected = taskSelection.isSelected(task.id)}
    {@const positionClass = getSelectionPositionClass(task.id, index)}
    
    <div class="task-wrapper" class:selected={isSelected}>
      <SelectionIndicator
        {isSelected}
        {positionClass}
        multiSelectCount={taskSelection.selectedCount}
      />
      
      <div 
        class="task-content"
        onclick={(e) => handleTaskClick(e, task.id)}
        onkeydown={(e) => handleTaskKeydown(e, task.id)}
      >
        {@render children({ task, index, isSelected, positionClass })}
      </div>
    </div>
  {/snippet}

  {@render children({ taskWrapper })}
</div>

<style>
  .task-selection-container {
    position: relative;
  }

  .task-wrapper {
    position: relative;
    transition: all 0.15s ease;
  }

  .task-wrapper.selected {
    background-color: var(--accent-blue);
    color: white;
    border-radius: 8px;
  }

  .task-wrapper.selected .task-content {
    position: relative;
    z-index: 1;
  }

  .task-content {
    cursor: pointer;
  }
</style>
```

**2. SelectionIndicator Component:**
```svelte
<!-- lib/components/selection/SelectionIndicator.svelte -->
<script lang="ts">
  interface Props {
    isSelected: boolean;
    positionClass: string;
    multiSelectCount: number;
  }

  let { isSelected, positionClass, multiSelectCount }: Props = $props();

  let showCheckbox = $derived(isSelected || multiSelectCount > 0);
  let indicatorClass = $derived(`
    selection-indicator 
    ${isSelected ? 'selected' : ''} 
    ${positionClass}
    ${showCheckbox ? 'show-checkbox' : ''}
  `.trim());
</script>

{#if showCheckbox}
  <div class={indicatorClass}>
    <div class="checkbox-container">
      <input
        type="checkbox"
        checked={isSelected}
        readonly
        tabindex="-1"
        aria-hidden="true"
        class="selection-checkbox"
      />
      <div class="checkbox-custom">
        {#if isSelected}
          <svg class="checkmark" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="20,6 9,17 4,12"></polyline>
          </svg>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .selection-indicator {
    position: absolute;
    left: -32px;
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
    z-index: 10;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .selection-indicator.show-checkbox {
    opacity: 1;
  }

  .selection-indicator.selected {
    opacity: 1;
  }

  .checkbox-container {
    position: relative;
    width: 18px;
    height: 18px;
  }

  .selection-checkbox {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .checkbox-custom {
    position: absolute;
    top: 0;
    left: 0;
    width: 18px;
    height: 18px;
    background-color: var(--bg-secondary);
    border: 2px solid var(--border-primary);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .selection-indicator.selected .checkbox-custom {
    background-color: var(--accent-blue);
    border-color: var(--accent-blue);
  }

  .checkmark {
    width: 12px;
    height: 12px;
    stroke-width: 2;
    color: white;
  }

  /* Selection position styling */
  .selection-indicator.selection-top {
    /* Add any specific styling for top selection */
  }

  .selection-indicator.selection-middle {
    /* Add any specific styling for middle selection */
  }

  .selection-indicator.selection-bottom {
    /* Add any specific styling for bottom selection */
  }
</style>
```

**3. SelectionActions Component:**
```svelte
<!-- lib/components/selection/SelectionActions.svelte -->
<script lang="ts">
  import type { Task } from '$lib/types/task';

  interface Props {
    selectedCount: number;
    selectedTaskIds: string[];
    tasks: Task[];
    onClearSelection: () => void;
    onBulkDelete: (taskIds: string[]) => void;
    onBulkStatusChange: (taskIds: string[], status: string) => void;
  }

  let {
    selectedCount,
    selectedTaskIds,
    tasks,
    onClearSelection,
    onBulkDelete,
    onBulkStatusChange
  }: Props = $props();

  let selectedTasks = $derived(
    tasks.filter(task => selectedTaskIds.includes(task.id))
  );

  let commonStatus = $derived(() => {
    if (selectedTasks.length === 0) return null;
    
    const firstStatus = selectedTasks[0].status;
    const allSameStatus = selectedTasks.every(task => task.status === firstStatus);
    
    return allSameStatus ? firstStatus : null;
  });

  let showStatusDropdown = $state(false);

  const statusOptions = [
    { value: 'new_task', label: 'New', emoji: '📋' },
    { value: 'in_progress', label: 'In Progress', emoji: '🔄' },
    { value: 'paused', label: 'Paused', emoji: '⏸️' },
    { value: 'successfully_completed', label: 'Completed', emoji: '✅' },
    { value: 'cancelled', label: 'Cancelled', emoji: '❌' },
    { value: 'failed', label: 'Failed', emoji: '💥' }
  ];

  function handleStatusChange(newStatus: string) {
    onBulkStatusChange(selectedTaskIds, newStatus);
    showStatusDropdown = false;
  }

  function handleDelete() {
    onBulkDelete(selectedTaskIds);
  }
</script>

<div class="selection-actions" role="toolbar" aria-label="Bulk actions">
  <div class="selection-info">
    <span class="selected-count">
      {selectedCount} task{selectedCount !== 1 ? 's' : ''} selected
    </span>
  </div>

  <div class="action-buttons">
    <!-- Status Change Dropdown -->
    <div class="status-dropdown" class:open={showStatusDropdown}>
      <button
        class="action-button status-button"
        onclick={() => showStatusDropdown = !showStatusDropdown}
        aria-expanded={showStatusDropdown}
        aria-haspopup="menu"
        title="Change status of selected tasks"
      >
        <span class="button-icon">📊</span>
        <span class="button-text">Status</span>
        <span class="dropdown-arrow">▼</span>
      </button>

      {#if showStatusDropdown}
        <div class="dropdown-menu" role="menu">
          {#each statusOptions as option}
            <button
              class="dropdown-item"
              class:current={commonStatus === option.value}
              onclick={() => handleStatusChange(option.value)}
              role="menuitem"
            >
              <span class="status-emoji">{option.emoji}</span>
              <span class="status-label">{option.label}</span>
              {#if commonStatus === option.value}
                <span class="current-indicator">✓</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Delete Button -->
    <button
      class="action-button delete-button"
      onclick={handleDelete}
      title="Delete selected tasks"
    >
      <span class="button-icon">🗑️</span>
      <span class="button-text">Delete</span>
    </button>

    <!-- Clear Selection -->
    <button
      class="action-button clear-button"
      onclick={onClearSelection}
      title="Clear selection"
    >
      <span class="button-icon">✕</span>
      <span class="button-text">Clear</span>
    </button>
  </div>
</div>

<style>
  .selection-actions {
    position: sticky;
    top: 0;
    z-index: 100;
    background-color: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    animation: slideDown 0.2s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .selection-info {
    display: flex;
    align-items: center;
  }

  .selected-count {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .action-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: none;
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.15s ease;
    color: var(--text-primary);
  }

  .action-button:hover {
    background-color: var(--bg-secondary);
    border-color: var(--border-secondary);
  }

  .action-button:focus-visible {
    outline: 2px solid var(--accent-blue);
    outline-offset: 2px;
  }

  .delete-button:hover {
    background-color: var(--accent-red);
    border-color: var(--accent-red);
    color: white;
  }

  .button-icon {
    font-size: 14px;
  }

  .button-text {
    font-weight: 500;
  }

  /* Status Dropdown */
  .status-dropdown {
    position: relative;
  }

  .dropdown-arrow {
    font-size: 10px;
    transition: transform 0.15s ease;
  }

  .status-dropdown.open .dropdown-arrow {
    transform: rotate(180deg);
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    margin-top: 4px;
    min-width: 150px;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-primary);
    transition: background-color 0.15s ease;
  }

  .dropdown-item:hover {
    background-color: var(--bg-tertiary);
  }

  .dropdown-item:first-child {
    border-radius: 6px 6px 0 0;
  }

  .dropdown-item:last-child {
    border-radius: 0 0 6px 6px;
  }

  .dropdown-item.current {
    background-color: var(--accent-blue);
    color: white;
  }

  .status-emoji {
    font-size: 14px;
  }

  .status-label {
    flex: 1;
    font-weight: 500;
  }

  .current-indicator {
    font-size: 12px;
    color: currentColor;
  }

  .clear-button {
    background-color: var(--bg-tertiary);
  }

  .clear-button:hover {
    background-color: var(--bg-secondary);
  }
</style>
```

**4. Enhanced TaskKeyboardNav Store:**
```typescript
// lib/stores/taskKeyboardNav.svelte.ts (Enhanced from TASKLIST-001)
import { taskSelection } from './taskSelection.svelte.ts';

export class TaskKeyboardNavStore {
  private flatTaskIds = $state<string[]>([]);

  setTaskIds(taskIds: string[]) {
    this.flatTaskIds = taskIds;
  }

  navigateUp() {
    if (taskSelection.selectedCount !== 1) return;
    
    const currentTaskId = Array.from(taskSelection.selectedTaskIds)[0];
    const currentIndex = this.flatTaskIds.indexOf(currentTaskId);
    
    if (currentIndex === -1) return;
    
    const nextIndex = currentIndex > 0 ? currentIndex - 1 : this.flatTaskIds.length - 1;
    const nextTaskId = this.flatTaskIds[nextIndex];
    
    taskSelection.selectTask(nextTaskId);
    this.scrollTaskIntoView(nextTaskId);
  }

  navigateDown() {
    if (taskSelection.selectedCount !== 1) return;
    
    const currentTaskId = Array.from(taskSelection.selectedTaskIds)[0];
    const currentIndex = this.flatTaskIds.indexOf(currentTaskId);
    
    if (currentIndex === -1) return;
    
    const nextIndex = currentIndex < this.flatTaskIds.length - 1 ? currentIndex + 1 : 0;
    const nextTaskId = this.flatTaskIds[nextIndex];
    
    taskSelection.selectTask(nextTaskId);
    this.scrollTaskIntoView(nextTaskId);
  }

  navigateToFirst() {
    if (this.flatTaskIds.length > 0) {
      const firstTaskId = this.flatTaskIds[0];
      taskSelection.selectTask(firstTaskId);
      this.scrollTaskIntoView(firstTaskId);
    }
  }

  navigateToLast() {
    if (this.flatTaskIds.length > 0) {
      const lastTaskId = this.flatTaskIds[this.flatTaskIds.length - 1];
      taskSelection.selectTask(lastTaskId);
      this.scrollTaskIntoView(lastTaskId);
    }
  }

  private scrollTaskIntoView(taskId: string) {
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
    if (taskElement) {
      taskElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Enhanced range selection
  extendSelectionUp() {
    if (taskSelection.selectedCount === 0) return;
    
    const lastSelected = taskSelection.lastSelectedTaskId;
    if (!lastSelected) return;
    
    const currentIndex = this.flatTaskIds.indexOf(lastSelected);
    if (currentIndex > 0) {
      const previousTaskId = this.flatTaskIds[currentIndex - 1];
      taskSelection.selectedTaskIds.add(previousTaskId);
      taskSelection.lastSelectedTaskId = previousTaskId;
      this.scrollTaskIntoView(previousTaskId);
    }
  }

  extendSelectionDown() {
    if (taskSelection.selectedCount === 0) return;
    
    const lastSelected = taskSelection.lastSelectedTaskId;
    if (!lastSelected) return;
    
    const currentIndex = this.flatTaskIds.indexOf(lastSelected);
    if (currentIndex < this.flatTaskIds.length - 1) {
      const nextTaskId = this.flatTaskIds[currentIndex + 1];
      taskSelection.selectedTaskIds.add(nextTaskId);
      taskSelection.lastSelectedTaskId = nextTaskId;
      this.scrollTaskIntoView(nextTaskId);
    }
  }
}

export const taskKeyboardNav = new TaskKeyboardNavStore();
```

**Migration Strategy:**
1. Create selection components alongside existing TaskList
2. Add feature flag to switch between old/new selection logic
3. Test selection patterns incrementally (single select, then multi-select)
4. Verify keyboard navigation works correctly
5. Test accessibility features with screen readers

**Testing Strategy:**
- Unit tests for selection logic and keyboard navigation
- Interaction tests for click patterns (single, Ctrl+click, Shift+click)
- Keyboard navigation tests for all shortcuts
- Accessibility tests for ARIA compliance and screen reader support
- Performance tests with large task lists

**Acceptance Testing:**
- All existing selection functionality preserved
- Keyboard navigation works as expected
- Visual feedback is clear and consistent
- Accessibility standards met
- Performance is equivalent or better

**Accessibility Features:**
- ARIA roles and labels for screen readers
- Proper focus management
- Keyboard navigation support
- High contrast visual indicators
- Announcement of selection changes

**Performance Considerations:**
- Efficient selection state updates
- Debounced scroll-into-view for rapid navigation
- Virtual scrolling support for large lists
- Optimized DOM queries for selection detection
- Smooth animations without blocking UI

**Dependencies:**
- Requires taskSelection store from TASKLIST-001
- Uses TaskItem components from TASKLIST-002
- Integrates with TaskHierarchy from TASKLIST-003
- Needs task operations for bulk actions
- Uses existing keyboard event handling patterns