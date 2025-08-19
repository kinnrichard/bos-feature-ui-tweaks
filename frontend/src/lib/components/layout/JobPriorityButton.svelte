<script lang="ts">
  import BasePopover from '$lib/components/ui/BasePopover.svelte';
  import PopoverMenu from '$lib/components/ui/PopoverMenu.svelte';
  import { getJobPriorityEmoji, EMOJI_MAPPINGS } from '$lib/config/emoji';
  import '$lib/styles/popover-common.css';
  import { Job } from '$lib/models/job';
  import { ReactiveJob } from '$lib/models/reactive-job';
  import { debugUI, debugBusiness, debugMonitor } from '$lib/utils/debug';

  // Self-sufficient props pattern - matches TechnicianAssignmentButton and JobStatusButton
  let {
    jobId,
    initialPriority = 'normal',
    disabled = false,
  }: {
    jobId: string;
    initialPriority?: string;
    disabled?: boolean;
  } = $props();

  // Self-sufficient query pattern - matches TechnicianAssignmentButton and JobStatusButton
  const jobQuery = $derived(jobId ? ReactiveJob.find(jobId) : null);
  const job = $derived(jobQuery?.data);

  // All available job priorities with their display information - formatted for PopoverMenu
  const availablePriorities = [
    { id: 'title', value: 'title', label: 'Job Priority', header: true },
    {
      id: 'critical',
      value: 'critical',
      label: 'Critical',
      icon: EMOJI_MAPPINGS.jobPriorities.critical,
    },
    {
      id: 'very_high',
      value: 'very_high',
      label: 'Very High',
      icon: EMOJI_MAPPINGS.jobPriorities.very_high,
    },
    { id: 'high', value: 'high', label: 'High', icon: EMOJI_MAPPINGS.jobPriorities.high },
    { id: 'normal', value: 'normal', label: 'Normal', icon: EMOJI_MAPPINGS.jobPriorities.normal },
    { id: 'low', value: 'low', label: 'Low', icon: EMOJI_MAPPINGS.jobPriorities.low },
    {
      id: 'proactive_followup',
      value: 'proactive_followup',
      label: 'Proactive Follow-up',
      icon: EMOJI_MAPPINGS.jobPriorities.proactive_followup,
    },
  ];

  // Fallback to initialPriority during loading - self-sufficient pattern
  const currentPriority = $derived(job?.priority || initialPriority);

  // Get job priority emoji with fallback handling
  const jobPriorityEmoji = $derived(
    job ? getJobPriorityEmoji(currentPriority) : getJobPriorityEmoji(initialPriority)
  );

  // Handle priority change using ActiveRecord pattern (Zero.js handles optimistic updates)
  async function handlePriorityChange(newPriority: string, _option: unknown) {
    // Use jobId directly - always available in self-sufficient pattern
    if (!jobId) {
      debugMonitor.error(
        '[JobPriorityButton] handlePriorityChange called with invalid jobId - aborting'
      );
      return;
    }

    debugUI.component('[JobPriorityButton] handlePriorityChange called', {
      newPriority,
      currentPriority,
      jobId,
      timestamp: Date.now(),
    });

    if (newPriority === currentPriority) {
      debugBusiness.workflow('[JobPriorityButton] Priority change skipped - same priority');
      return;
    }

    try {
      // Persist to database using ActiveRecord pattern (Zero.js handles optimistic updates)
      debugBusiness.workflow('[JobPriorityButton] Calling Job.update');
      await Job.update(jobId, { priority: newPriority });

      debugBusiness.workflow('[JobPriorityButton] AFTER ActiveRecord mutation - SUCCESS', {
        persistedPriority: newPriority,
        timestamp: Date.now(),
      });
    } catch (error) {
      debugMonitor.error('[JobPriorityButton] Failed to update job priority', error);
      // TODO: Show error toast to user
    }
  }
</script>

<BasePopover preferredPlacement="bottom" panelWidth="max-content" {disabled}>
  {#snippet trigger({ popover })}
    <button
      class="popover-button"
      class:disabled
      use:popover.button
      title={disabled ? 'Disabled' : `Job Priority: ${jobPriorityEmoji}`}
      {disabled}
      onclick={disabled
        ? undefined
        : (e) => {
            e.stopPropagation();
          }}
    >
      <span class="job-priority-emoji">{jobPriorityEmoji}</span>
    </button>
  {/snippet}

  {#snippet children({ close })}
    <PopoverMenu
      options={availablePriorities}
      selected={currentPriority}
      onSelect={handlePriorityChange}
      onClose={close}
      showCheckmarks={true}
      showIcons={true}
      iconPosition="left"
      enableKeyboard={true}
      autoFocus={true}
    />
  {/snippet}
</BasePopover>

<style>
  .job-priority-emoji {
    font-size: 18px;
    line-height: 1;
  }

  /* Accessibility improvements */
  @media (prefers-reduced-motion: reduce) {
    .popover-button {
      transition: none;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .popover-button {
      border-width: 2px;
    }
  }
</style>
