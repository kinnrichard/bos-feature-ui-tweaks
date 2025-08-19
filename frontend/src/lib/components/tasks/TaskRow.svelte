<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { getTaskEmoji } from '$lib/config/emoji';
  import { formatTimeDuration, calculateCurrentDuration } from '$lib/utils/taskRowHelpers';
  import { taskPermissionHelpers } from '$lib/stores/taskPermissions.svelte';
  import EditableTitle from '../ui/EditableTitle.svelte';
  import TaskInfoPopover from './TaskInfoPopover.svelte';
  import TaskStatusPopover from './TaskStatusPopover.svelte';
  import type { Task } from '$lib/api/tasks';
  import { debugUI } from '$lib/utils/debug';
  import '../../styles/task-components.scss';
  import '../../styles/focus-ring.scss';

  // Use static SVG URLs for better compatibility
  const chevronRight = '/icons/chevron-right.svg';

  // Props
  let {
    task,
    depth = 0,
    hasSubtasks = false,
    isExpanded = false,
    isSelected = false,
    isEditing = false,
    isDeleting = false,
    canEdit = true,
    jobId = '',
    batchTaskDetails = null,
    currentTime = Date.now(),
  }: {
    task: Task;
    depth?: number;
    hasSubtasks?: boolean;
    isExpanded?: boolean;
    isSelected?: boolean;
    isEditing?: boolean;
    isDeleting?: boolean;
    canEdit?: boolean;
    jobId?: string;
    batchTaskDetails?: unknown;
    currentTime?: number;
  } = $props();

  const dispatch = createEventDispatcher();

  // Derive task-specific permissions
  const taskCanEdit = $derived(canEdit && taskPermissionHelpers.canEditTask(task));
  const taskCanChangeStatus = $derived(canEdit && taskPermissionHelpers.canChangeStatus(task));

  // Reference for right-click popover trigger
  let rightClickTrigger = $state<HTMLButtonElement | null>(null);

  // Debug permissions using proper debug system
  $effect(() => {
    debugUI.component('TaskRow permissions:', {
      taskId: task.id.substring(0, 8),
      canEdit,
      taskCanEdit,
      taskCanChangeStatus,
      taskStatus: task.status,
      taskDiscardedAt: task.discarded_at,
      canEditTasksGlobal: taskPermissionHelpers.canEditTasks,
      canChangeStatusHelper: taskPermissionHelpers.canChangeStatus(task),
    });
  });

  // Dispatch helper for editing events
  function handleEditingChange(editing: boolean) {
    if (!canEdit && editing) return; // Prevent entering edit mode if not allowed

    if (editing) {
      // When entering edit mode, dispatch titleClick to notify parent
      dispatch('taskaction', {
        type: 'titleClick',
        taskId: task.id,
        data: {
          event: new MouseEvent('click'),
          originalTitle: task.title,
        },
      });
    } else {
      // When exiting edit mode, dispatch cancelEdit
      dispatch('taskaction', {
        type: 'cancelEdit',
        taskId: task.id,
      });
    }
  }

  async function handleSaveTitle(newTitle: string) {
    try {
      const { Task } = await import('$lib/models/task');
      await Task.update(task.id, { title: newTitle });
    } catch (error) {
      console.error('Failed to update task title:', error);
      throw error; // Re-throw so EditableTitle can handle the error
    }
  }

  function handleTaskClick(event: MouseEvent) {
    // Always dispatch click event so parent can cancel edit mode
    // Parent will handle the logic of what to do when editing
    dispatch('taskaction', {
      type: 'click',
      taskId: task.id,
      data: { event },
    });
  }

  function handleTaskKeydown(event: KeyboardEvent) {
    // Don't handle keyboard events when task is being edited
    if (isEditing) {
      return;
    }

    dispatch('taskaction', {
      type: 'keydown',
      taskId: task.id,
      data: { event },
    });
  }

  function handleToggleExpansion(event: MouseEvent) {
    event.stopPropagation();
    dispatch('taskaction', {
      type: 'toggleExpansion',
      taskId: task.id,
    });
  }

  // Status click handler for auto-advance statuses only
  function handleStatusClick(event: MouseEvent) {
    // Check if status change is allowed
    if (!taskCanChangeStatus) {
      return;
    }

    // Prevent this click from bubbling up to trigger row selection
    event.stopPropagation();

    // Only called for 'new_task' and 'in_progress' - auto-advance to next status
    handleQuickStatusCycle();
  }

  // Universal click handler for all statuses
  function handleButtonClick(event: MouseEvent) {
    // Check if status change is allowed
    if (!taskCanChangeStatus) {
      return;
    }

    // Prevent this click from bubbling up to trigger row selection
    event.stopPropagation();

    if (task.status === 'new_task' || task.status === 'in_progress') {
      // Auto-advance for progression statuses
      handleStatusClick(event);
    } else {
      // Open popover for terminal statuses
      if (rightClickTrigger) {
        rightClickTrigger.click();
      }
    }
  }

  // Universal right-click handler for all statuses
  function handleRightClick(event: MouseEvent) {
    // Check if status change is allowed
    if (!taskCanChangeStatus) {
      return;
    }

    // Prevent browser context menu
    event.preventDefault();
    event.stopPropagation();

    // Trigger the hidden popover for all statuses
    if (rightClickTrigger) {
      rightClickTrigger.click();
    }
  }

  // Quick status cycling for single clicks (preserves existing behavior)
  function handleQuickStatusCycle() {
    const statusCycle = ['new_task', 'in_progress', 'successfully_completed'];
    const currentIndex = statusCycle.indexOf(task.status);
    const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];

    dispatch('taskaction', {
      type: 'statusChange',
      taskId: task.id,
      data: { newStatus: nextStatus },
    });
  }

  // Handle popover status selection
  function handlePopoverStatusChange(event: CustomEvent) {
    const { type, taskId, data } = event.detail;
    if (type === 'statusChange') {
      dispatch('taskaction', { type, taskId, data });
    }
  }

  // Handle editing state changes from EditableTitle
  // The EditableTitle component now manages its own click handling

  function handleTaskUpdated(event: CustomEvent) {
    dispatch('taskaction', {
      type: 'taskUpdated',
      taskId: task.id,
      data: event.detail,
    });
  }

  // Focus management is now handled by the centralized focus store
  // The focus store coordinates all focus operations to prevent race conditions
</script>

<div
  class="task-item focus-ring"
  class:completed={task.status === 'successfully_completed'}
  class:in-progress={task.status === 'in_progress'}
  class:cancelled={task.status === 'cancelled' || task.status === 'failed'}
  class:has-subtasks={hasSubtasks}
  class:selected={isSelected}
  class:task-selected-for-drag={isSelected}
  class:task-deleting={isDeleting}
  class:non-editable={!taskCanEdit}
  style="--depth: {depth || 0}"
  data-task-id={task.id}
  role="button"
  tabindex="0"
  aria-label="Task: {task.title}. {isSelected
    ? 'Selected'
    : 'Not selected'}. Click to select, Shift+click for range selection, Ctrl/Cmd+click to toggle."
  onclick={handleTaskClick}
  onkeydown={handleTaskKeydown}
>
  <!-- Disclosure Triangle (if has subtasks) -->
  {#if hasSubtasks}
    <button
      class="disclosure-button"
      onclick={handleToggleExpansion}
      aria-expanded={isExpanded}
      aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
    >
      <img
        src={chevronRight}
        alt={isExpanded ? 'Expanded' : 'Collapsed'}
        class="chevron-icon"
        class:expanded={isExpanded}
      />
    </button>
  {:else}
    <div class="disclosure-spacer"></div>
  {/if}

  <!-- Task Status Button -->
  <div class="task-status">
    <!-- Universal pattern: visible button + hidden popover for right-click -->
    <button
      class="status-emoji"
      class:disabled={!taskCanChangeStatus}
      onclick={handleButtonClick}
      oncontextmenu={handleRightClick}
      title={taskCanChangeStatus
        ? task.status === 'new_task' || task.status === 'in_progress'
          ? 'Left-click to advance, right-click for all options'
          : 'Left-click or right-click for status options'
        : 'Status cannot be changed'}
      disabled={!taskCanChangeStatus}
    >
      {getTaskEmoji(task)}
    </button>

    <!-- Hidden popover for right-click (works for all statuses) -->
    <TaskStatusPopover
      taskId={task.id}
      initialStatus={task.status}
      on:taskaction={handlePopoverStatusChange}
    >
      {#snippet children({ popover })}
        <button
          class="status-emoji"
          style="position: absolute; top: 0; left: 0; opacity: 0; pointer-events: none;"
          use:popover.button
          bind:this={rightClickTrigger}
          tabindex="-1"
        >
          {getTaskEmoji(task)}
        </button>
      {/snippet}
    </TaskStatusPopover>
  </div>

  <!-- Task Content -->
  <div class="task-content">
    <EditableTitle
      value={task.title}
      tag="h5"
      className="task-title"
      placeholder="Untitled Task"
      {isEditing}
      onEditingChange={handleEditingChange}
      onSave={handleSaveTitle}
      onClick={handleTaskClick}
      editable={taskCanEdit}
    />

    <!-- Time Tracking Display -->
    {#if task.status === 'in_progress' || (task.accumulated_seconds && task.accumulated_seconds > 0)}
      {@const duration = calculateCurrentDuration(task, currentTime)}
      {@const formattedTime = formatTimeDuration(duration)}
      {#if formattedTime}
        <div class="time-tracking">
          <span class="time-icon">⏱️</span>
          <span class="time-duration" class:in-progress={task.status === 'in_progress'}>
            {formattedTime}
          </span>
        </div>
      {/if}
    {/if}
  </div>

  <!-- Task Metadata (Assignment & Notes) -->
  <div class="task-metadata">
    <!-- Assignment Indicator -->
    {#if task.assigned_to}
      <div class="assigned-indicator" title="Assigned to {task.assigned_to.name}">
        <span class="assignee-initials">{task.assigned_to.initials}</span>
      </div>
    {/if}

    <!-- Notes Indicator removed - notes_count column doesn't exist in database -->
  </div>

  <!-- Task Actions -->
  <div class="task-actions">
    <TaskInfoPopover
      {task}
      {jobId}
      {batchTaskDetails}
      {isSelected}
      on:task-updated={handleTaskUpdated}
    />
  </div>
</div>

<style>
  /* Component-specific styles will inherit from parent TaskList styles */
  .chevron-icon.expanded {
    transform: rotate(90deg);
  }
</style>
