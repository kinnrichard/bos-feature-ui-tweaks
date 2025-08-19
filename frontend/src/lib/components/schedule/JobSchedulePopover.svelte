<script lang="ts">
  import BasePopover from '$lib/components/ui/BasePopover.svelte';
  import PopoverMenu from '$lib/components/ui/PopoverMenu.svelte';
  import DateEditor from './DateEditor.svelte';
  import TimeEditor from './TimeEditor.svelte';
  import type { PopulatedJob } from '$lib/types/job';
  import { validateDateRange } from '$lib/utils/date-formatting';
  import { getToolbarDateIcon } from '$lib/utils/due-date-icon';
  import { debugComponent } from '$lib/utils/debug';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import '$lib/styles/popover-common.css';

  interface Props {
    jobId: string;
    initialJob?: PopulatedJob | null;
    disabled?: boolean;
  }

  let {
    jobId: _jobId, // eslint-disable-line @typescript-eslint/no-unused-vars
    initialJob = null,
    disabled = false,
  }: Props = $props();

  // Component state
  let basePopover = $state();
  let currentView = $state<
    | 'menu'
    | 'start-date'
    | 'start-time'
    | 'due-date'
    | 'due-time'
    | 'followup-date'
    | 'followup-time'
  >('menu');
  let editingFollowupId = $state<string | null>(null);
  let containerElement = $state<HTMLDivElement>();
  let contentElement = $state<HTMLDivElement>();
  let containerHeight = $state<number | null>(null);

  // Derive job data
  const job = $derived(initialJob);
  const startDate = $derived(job?.starts_at ? new Date(job.starts_at) : null);
  const dueDate = $derived(job?.due_at ? new Date(job.due_at) : null);
  const followupDates = $derived(job?.scheduledDateTimes || []);

  // Check if times are set
  const startTimeSet = $derived(job?.start_time_set || false);
  const dueTimeSet = $derived(job?.due_time_set || false);

  // Dynamic icon based on start/due dates (shows green for upcoming starts, red for due dates)
  const calendarIcon = $derived(getToolbarDateIcon(job?.starts_at, startTimeSet, job?.due_at));

  // Helper to format time only
  function formatTimeOnly(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  // Helper to format date without time
  function formatDateOnly(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  // Create menu options
  const menuOptions = $derived.by(() => {
    const options = [];

    // Start Date
    options.push({
      id: 'start-date',
      value: 'start-date',
      label: startDate ? 'Start' : 'Add a Start Date',
      rightText: startDate ? formatDateOnly(startDate) : undefined,
      icon: '/icons/calendar.svg',
    });

    // Start Time (only if start date exists)
    if (startDate) {
      options.push({
        id: 'start-time',
        value: 'start-time',
        label: '',
        rightText: startTimeSet ? `at ${formatTimeOnly(startDate)}` : 'Add a Start Time',
        icon: null, // No icon for time, indented label
      });
    }

    // Separator before due date
    options.push({
      id: 'due-separator',
      divider: true,
    });

    // Due Date
    options.push({
      id: 'due-date',
      value: 'due-date',
      label: dueDate ? 'Due' : 'Add a Due Date',
      rightText: dueDate ? formatDateOnly(dueDate) : undefined,
      icon: '/icons/calendar-with-badge.svg',
    });

    // Due Time (only if due date exists)
    if (dueDate) {
      options.push({
        id: 'due-time',
        value: 'due-time',
        label: '',
        rightText: dueTimeSet ? `at ${formatTimeOnly(dueDate)}` : 'Add a Due Time',
        icon: null, // No icon for time, indented label
      });
    }

    // Separator before followups
    options.push({
      id: 'followup-separator',
      divider: true,
    });

    // Followup dates
    followupDates.forEach((followup) => {
      options.push({
        id: `followup-${followup.id}`,
        value: `followup-${followup.id}`,
        label: followup.scheduled_at ? 'Followup' : 'Followup',
        rightText: followup.scheduled_at
          ? formatDateOnly(new Date(followup.scheduled_at))
          : undefined,
        icon: '/icons/calendar.svg',
      });

      // Followup time if date is set
      if (followup.scheduled_at) {
        options.push({
          id: `followup-time-${followup.id}`,
          value: `followup-time-${followup.id}`,
          label: '',
          rightText: followup.time_set
            ? `at ${formatTimeOnly(new Date(followup.scheduled_at))}`
            : 'Add a Time',
          icon: null,
        });
      }
    });

    // Add followup option
    options.push({
      id: 'add-followup',
      value: 'add-followup',
      label: 'Add a Followup Date',
      icon: '/icons/plus.svg',
    });

    return options;
  });

  // Handle menu option selection
  function handleMenuSelect(value: string) {
    if (value === 'start-date') {
      currentView = 'start-date';
    } else if (value === 'start-time') {
      currentView = 'start-time';
    } else if (value === 'due-date') {
      currentView = 'due-date';
    } else if (value === 'due-time') {
      currentView = 'due-time';
    } else if (value === 'add-followup') {
      currentView = 'followup-date';
      editingFollowupId = null;
    } else if (value.startsWith('followup-time-')) {
      const followupId = value.replace('followup-time-', '');
      editingFollowupId = followupId;
      currentView = 'followup-time';
    } else if (value.startsWith('followup-')) {
      const followupId = value.replace('followup-', '');
      editingFollowupId = followupId;
      currentView = 'followup-date';
    }
  }

  // Handle back to menu
  function handleBackToMenu() {
    currentView = 'menu';
    editingFollowupId = null;
  }

  // Handle start date save
  async function handleStartDateSave(date: Date | null) {
    if (!job) return;

    try {
      // If we're removing the date, clear time as well
      if (!date) {
        const updates: Record<string, unknown> = {
          starts_at: null,
          start_time_set: false,
        };
        const { Job } = await import('$lib/models/job');
        await Job.update(job.id, updates);
      } else {
        // Set the date to start of day if no time was previously set
        const finalDate = new Date(date);
        if (!startTimeSet) {
          finalDate.setHours(0, 0, 0, 0);
        } else if (startDate) {
          // Preserve existing time
          finalDate.setHours(
            startDate.getHours(),
            startDate.getMinutes(),
            startDate.getSeconds(),
            0
          );
        }

        const updates: Record<string, unknown> = {
          starts_at: finalDate.toISOString(),
          start_time_set: startTimeSet || false,
        };

        // Validate date range
        if (dueDate) {
          const validation = validateDateRange(finalDate, dueDate);
          if (!validation.isValid) {
            // TODO: Show error toast
            debugComponent.error('Date validation failed', validation.error);
            return;
          }
        }

        const { Job } = await import('$lib/models/job');
        await Job.update(job.id, updates);
      }

      currentView = 'menu';
    } catch (error) {
      debugComponent.error('Failed to update start date', { error, jobId: job.id });
    }
  }

  // Handle start time save
  async function handleStartTimeSave(dateWithTime: Date | null) {
    if (!job || !startDate) return;

    try {
      const updates: Record<string, unknown> = {
        starts_at: dateWithTime ? dateWithTime.toISOString() : startDate.toISOString(),
        start_time_set: !!dateWithTime,
      };

      const { Job } = await import('$lib/models/job');
      await Job.update(job.id, updates);

      currentView = 'menu';
    } catch (error) {
      debugComponent.error('Failed to update start time', { error, jobId: job.id });
    }
  }

  // Handle due date save
  async function handleDueDateSave(date: Date | null) {
    if (!job) return;

    try {
      // If we're removing the date, clear time as well
      if (!date) {
        const updates: Record<string, unknown> = {
          due_at: null,
          due_time_set: false,
        };
        const { Job } = await import('$lib/models/job');
        await Job.update(job.id, updates);
      } else {
        // Set the date to start of day if no time was previously set
        const finalDate = new Date(date);
        if (!dueTimeSet) {
          finalDate.setHours(0, 0, 0, 0);
        } else if (dueDate) {
          // Preserve existing time
          finalDate.setHours(dueDate.getHours(), dueDate.getMinutes(), dueDate.getSeconds(), 0);
        }

        const updates: Record<string, unknown> = {
          due_at: finalDate.toISOString(),
          due_time_set: dueTimeSet || false,
        };

        // Validate date range
        if (startDate) {
          const validation = validateDateRange(startDate, finalDate);
          if (!validation.isValid) {
            // TODO: Show error toast
            debugComponent.error('Date validation failed', validation.error);
            return;
          }
        }

        const { Job } = await import('$lib/models/job');
        await Job.update(job.id, updates);
      }

      currentView = 'menu';
    } catch (error) {
      debugComponent.error('Failed to update due date', { error, jobId: job.id });
    }
  }

  // Handle due time save
  async function handleDueTimeSave(dateWithTime: Date | null) {
    if (!job || !dueDate) return;

    try {
      const updates: Record<string, unknown> = {
        due_at: dateWithTime ? dateWithTime.toISOString() : dueDate.toISOString(),
        due_time_set: !!dateWithTime,
      };

      const { Job } = await import('$lib/models/job');
      await Job.update(job.id, updates);

      currentView = 'menu';
    } catch (error) {
      debugComponent.error('Failed to update due time', { error, jobId: job.id });
    }
  }

  // Handle followup date save
  async function handleFollowupDateSave(date: Date | null) {
    if (!job) return;

    try {
      if (editingFollowupId) {
        // Update existing followup
        if (date) {
          // Preserve time if it was set
          const existingFollowup = followupDates.find((f) => f.id === editingFollowupId);
          const finalDate = new Date(date);

          if (existingFollowup?.time_set && existingFollowup.scheduled_at) {
            const existingDate = new Date(existingFollowup.scheduled_at);
            finalDate.setHours(
              existingDate.getHours(),
              existingDate.getMinutes(),
              existingDate.getSeconds(),
              0
            );
          } else {
            finalDate.setHours(0, 0, 0, 0);
          }

          const { ScheduledDateTime } = await import('$lib/models/scheduled-date-time');
          await ScheduledDateTime.update(editingFollowupId, {
            scheduled_at: finalDate.toISOString(),
            time_set: existingFollowup?.time_set || false,
          });
        } else {
          // Remove followup
          await handleFollowupRemove();
          return;
        }
      } else if (date) {
        // Create new followup
        const finalDate = new Date(date);
        finalDate.setHours(0, 0, 0, 0);

        const { ScheduledDateTime } = await import('$lib/models/scheduled-date-time');
        await ScheduledDateTime.create({
          schedulable_type: 'Job',
          schedulable_id: job.id,
          scheduled_type: 'followup',
          scheduled_at: finalDate.toISOString(),
          time_set: false,
        });
      }

      currentView = 'menu';
      editingFollowupId = null;
    } catch (error) {
      debugComponent.error('Failed to update followup date', {
        error,
        jobId: job.id,
        editingFollowupId,
      });
    }
  }

  // Handle followup time save
  async function handleFollowupTimeSave(dateWithTime: Date | null) {
    if (!job || !editingFollowupId) return;

    try {
      const followup = followupDates.find((f) => f.id === editingFollowupId);
      if (!followup || !followup.scheduled_at) return;

      const updates: Record<string, unknown> = {
        scheduled_at: dateWithTime ? dateWithTime.toISOString() : followup.scheduled_at,
        time_set: !!dateWithTime,
      };

      const { ScheduledDateTime } = await import('$lib/models/scheduled-date-time');
      await ScheduledDateTime.update(editingFollowupId, updates);

      currentView = 'menu';
      editingFollowupId = null;
    } catch (error) {
      debugComponent.error('Failed to update followup time', {
        error,
        followupId: editingFollowupId,
      });
    }
  }

  // Handle followup remove
  async function handleFollowupRemove() {
    if (!editingFollowupId) return;

    try {
      const { ScheduledDateTime } = await import('$lib/models/scheduled-date-time');
      await ScheduledDateTime.destroy(editingFollowupId);

      currentView = 'menu';
      editingFollowupId = null;
    } catch (error) {
      debugComponent.error('Failed to remove followup date', {
        error,
        followupId: editingFollowupId,
      });
    }
  }

  // Get editing followup data
  const editingFollowup = $derived(
    editingFollowupId ? followupDates.find((f) => f.id === editingFollowupId) || null : null
  );

  // Get followup value
  const followupValue = $derived(editingFollowup?.scheduled_at || null);

  // Animation config
  const slideInFromRight = { x: 240, duration: 300, easing: cubicOut };
  const slideOutToRight = { x: 240, duration: 300, easing: cubicOut };
  const slideInFromLeft = { x: -240, duration: 300, easing: cubicOut };
  const slideOutToLeft = { x: -240, duration: 300, easing: cubicOut };

  // Function to recalculate height
  function recalculateHeight() {
    if (contentElement) {
      requestAnimationFrame(() => {
        const rect = contentElement.getBoundingClientRect();
        const newHeight = rect.height;

        // Only update if height actually changed (avoid infinite loops)
        if (containerHeight !== newHeight && newHeight > 0) {
          containerHeight = newHeight;
        }
      });
    }
  }

  // Auto-detect and update container height on mount
  $effect(() => {
    if (contentElement) {
      recalculateHeight();
    }
  });

  // Reset height tracking when view changes
  $effect(() => {
    currentView; // Track view changes
    // Force a small delay to let new content render before measuring
    setTimeout(() => {
      if (contentElement) {
        const rect = contentElement.getBoundingClientRect();
        containerHeight = rect.height;
      }
    }, 10);
  });
</script>

<BasePopover
  bind:popover={basePopover}
  preferredPlacement="bottom"
  panelWidth="240px"
  {disabled}
  closeOnClickOutside={currentView === 'menu'}
>
  {#snippet trigger({ popover })}
    <button
      class="popover-button"
      class:disabled
      use:popover.button
      title={disabled ? 'Disabled' : 'Schedule'}
      {disabled}
      onclick={disabled ? undefined : (e) => e.stopPropagation()}
    >
      <img src={calendarIcon} alt="Schedule" class="calendar-icon" />
    </button>
  {/snippet}

  {#snippet children({ close: _close })}
    <div
      class="schedule-popover-container"
      bind:this={containerElement}
      style="height: {containerHeight ? `${containerHeight}px` : 'auto'}"
    >
      {#if currentView === 'menu'}
        <div
          class="schedule-menu"
          bind:this={contentElement}
          in:fly={slideInFromLeft}
          out:fly={slideOutToLeft}
        >
          <PopoverMenu
            options={[
              { id: 'title', value: 'title', label: 'Schedule', header: true },
              ...menuOptions,
            ]}
            onSelect={handleMenuSelect}
            showIcons={true}
            showCheckmarks={false}
            className="schedule-menu-inner"
          />
        </div>
      {:else if currentView === 'start-date'}
        <div
          class="schedule-editor"
          bind:this={contentElement}
          in:fly={slideInFromRight}
          out:fly={slideOutToRight}
        >
          <DateEditor
            title="Start Date"
            value={startDate}
            onSave={handleStartDateSave}
            onCancel={handleBackToMenu}
            onRemove={startDate ? () => handleStartDateSave(null) : undefined}
            canRemove={!!startDate}
            onHeightChange={recalculateHeight}
          />
        </div>
      {:else if currentView === 'start-time'}
        <div
          class="schedule-editor"
          bind:this={contentElement}
          in:fly={slideInFromRight}
          out:fly={slideOutToRight}
        >
          <TimeEditor
            title="Start Time"
            baseDate={startDate || new Date()}
            value={startTimeSet ? startDate : null}
            onSave={handleStartTimeSave}
            onCancel={handleBackToMenu}
            onRemove={() => handleStartTimeSave(null)}
            canRemove={startTimeSet}
          />
        </div>
      {:else if currentView === 'due-date'}
        <div
          class="schedule-editor"
          bind:this={contentElement}
          in:fly={slideInFromRight}
          out:fly={slideOutToRight}
        >
          <DateEditor
            title="Due Date"
            value={dueDate}
            onSave={handleDueDateSave}
            onCancel={handleBackToMenu}
            onRemove={dueDate ? () => handleDueDateSave(null) : undefined}
            canRemove={!!dueDate}
            onHeightChange={recalculateHeight}
          />
        </div>
      {:else if currentView === 'due-time'}
        <div
          class="schedule-editor"
          bind:this={contentElement}
          in:fly={slideInFromRight}
          out:fly={slideOutToRight}
        >
          <TimeEditor
            title="Due Time"
            baseDate={dueDate || new Date()}
            value={dueTimeSet ? dueDate : null}
            onSave={handleDueTimeSave}
            onCancel={handleBackToMenu}
            onRemove={() => handleDueTimeSave(null)}
            canRemove={dueTimeSet}
          />
        </div>
      {:else if currentView === 'followup-date'}
        <div
          class="schedule-editor"
          bind:this={contentElement}
          in:fly={slideInFromRight}
          out:fly={slideOutToRight}
        >
          <DateEditor
            title={editingFollowup ? 'Edit Followup' : 'Add Followup'}
            value={followupValue}
            onSave={handleFollowupDateSave}
            onCancel={handleBackToMenu}
            onRemove={editingFollowup ? handleFollowupRemove : undefined}
            canRemove={!!editingFollowup}
            onHeightChange={recalculateHeight}
          />
        </div>
      {:else if currentView === 'followup-time'}
        <div
          class="schedule-editor"
          bind:this={contentElement}
          in:fly={slideInFromRight}
          out:fly={slideOutToRight}
        >
          <TimeEditor
            title="Followup Time"
            baseDate={followupValue ? new Date(followupValue) : new Date()}
            value={editingFollowup?.time_set ? new Date(followupValue) : null}
            onSave={handleFollowupTimeSave}
            onCancel={handleBackToMenu}
            onRemove={() => handleFollowupTimeSave(null)}
            canRemove={editingFollowup?.time_set || false}
          />
        </div>
      {/if}
    </div>
  {/snippet}
</BasePopover>

<style>
  /* Component-specific styling only - shared .popover-button styles in popover-common.css */
  .calendar-icon {
    width: 20px;
    height: 20px;
  }

  .schedule-popover-container {
    position: relative;
    width: 100%;
    overflow: hidden;
    transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .schedule-menu {
    width: 100%;
    min-height: 0;
  }

  .schedule-editor {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    min-height: 0;
  }

  :global(.schedule-menu-inner) {
    padding: 8px 4px;
  }

  /* Responsive adjustments */
  @media (max-width: 480px) {
    /* Styles removed - using PopoverMenu header now */
  }

  /* Accessibility improvements */
  @media (prefers-reduced-motion: reduce) {
    .schedule-menu,
    .schedule-editor {
      transition: none;
    }
  }
</style>
