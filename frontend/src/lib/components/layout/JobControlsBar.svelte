<script lang="ts">
  import JobStatusButton from './JobStatusButton.svelte';
  import TechnicianAssignmentButton from './TechnicianAssignmentButton.svelte';
  import JobSchedulePopover from '$lib/components/schedule/JobSchedulePopover.svelte';
  import JobPriorityButton from './JobPriorityButton.svelte';
  import type { PopulatedJob } from '$lib/types/job';

  interface Props {
    jobId: string;
    currentJob?: PopulatedJob | null;
    disabled?: boolean;
  }

  const { jobId, currentJob = null, disabled = false }: Props = $props();

  // Derive job properties with fallbacks
  const status = $derived(currentJob?.status);
  const technicians = $derived(currentJob?.technicians || []);
  const priority = $derived(currentJob?.priority);
</script>

<div class="job-controls" role="toolbar" aria-label="Job controls">
  <JobStatusButton {jobId} initialStatus={status} {disabled} />

  <JobPriorityButton {jobId} initialPriority={priority} {disabled} />

  <TechnicianAssignmentButton {jobId} initialTechnicians={technicians} {disabled} />

  <JobSchedulePopover {jobId} initialJob={currentJob} {disabled} />
</div>

<style>
  .job-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .job-controls {
      gap: 4px;
    }
  }
</style>
