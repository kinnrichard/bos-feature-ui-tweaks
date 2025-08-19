<script lang="ts">
  import type { JobData } from '$lib/models/types/job-data';
  import type { JobAssignmentData } from '$lib/models/types/job-assignment-data';
  import { getJobStatusEmoji, getJobPriorityEmoji } from '$lib/config/emoji';
  import { getJobDateIcon } from '$lib/utils/due-date-icon';
  import UserAvatar from '$lib/components/ui/UserAvatar.svelte';

  let {
    job,
    showClient = true,
  }: {
    job: JobData;
    showClient?: boolean;
  } = $props();

  // Use centralized enum conversion functions

  // Extract technicians from job assignments and sort alphabetically
  const technicians = $derived(
    (
      job.jobAssignments?.map((assignment: JobAssignmentData) => assignment.user).filter(Boolean) ||
      []
    ).sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''))
  );

  const statusEmoji = $derived(getJobStatusEmoji(job.status));
  const priorityEmoji = $derived(getJobPriorityEmoji(job.priority));
  // Show start icon (green) for upcoming jobs, due icon (red) for in-progress jobs
  // Hide date icon for completed or cancelled jobs
  const dateIcon = $derived(
    job.status === 'successfully_completed' ||
      job.status === 'cancelled' ||
      job.status === 5 ||
      job.status === 6
      ? null
      : getJobDateIcon(job.starts_at, job.start_time_set, job.due_at)
  );

  function getJobPath(job: JobData): string {
    return `/jobs/${job.id}`;
  }
</script>

<a
  href={getJobPath(job)}
  class="job-card-inline"
  data-job-id={job.id}
  data-sveltekit-preload-data="hover"
>
  <!-- Status emoji -->
  <span class="job-status-emoji">{statusEmoji}</span>

  <!-- Client and job name section -->
  <span class="job-name-section">
    {#if showClient}
      <button
        class="client-name-prefix client-link"
        onclick={(e) => {
          e.stopPropagation();
          window.location.href = `/clients/${job.client?.id}`;
        }}
      >
        {job.client?.name || 'Unknown Client'}
      </button>
    {/if}
    <span class="job-name">{job.title || 'Untitled Job'}</span>
  </span>

  <!-- Right side items -->
  <span class="job-right-section">
    <!-- Priority emoji (if not normal, leftmost) -->
    {#if job.priority !== 'normal' && priorityEmoji}
      <span class="job-priority-emoji">{priorityEmoji}</span>
    {/if}

    <!-- Technician avatars (middle) -->
    {#if technicians?.length > 0}
      <span class="technician-avatars">
        {#each technicians as technician, index}
          <UserAvatar user={technician} size="xs" overlap={index > 0} />
        {/each}
      </span>
    {/if}

    <!-- Date icon (green for start countdown, red for due date, rightmost) -->
    {#if dateIcon}
      <img
        src={dateIcon}
        alt={dateIcon.includes('green') ? 'Start date' : 'Due date'}
        class="due-date-icon"
      />
    {/if}
  </span>
</a>

<style>
  /* 
   * Note: Most styling comes from the existing CSS classes in application.css
   * This just adds any Svelte-specific styles if needed
   */
  .job-card-inline {
    display: flex;
    align-items: center;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    padding: 12px 16px;
    text-decoration: none;
    color: inherit;
    transition: all 0.2s ease;
    gap: 12px;
  }

  .job-status-emoji {
    font-size: 18px;
    flex-shrink: 0;
  }

  .job-name-section {
    flex: 1;
    display: flex;
    align-items: baseline;
    overflow: hidden;
  }

  .client-name-prefix {
    color: var(--text-tertiary);
    font-size: 13px;
    font-weight: 400;
    padding-right: 13px;
  }

  .client-link {
    text-decoration: none;
    color: var(--accent-blue);
    transition: color 0.15s ease;
  }

  .job-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 15px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .job-right-section {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .job-priority-emoji {
    font-size: 18px;
  }

  .due-date-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .technician-avatars {
    display: flex;
    align-items: center;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .job-card-inline {
      padding: 10px 12px;
      gap: 10px;
    }

    .client-name-prefix {
      font-size: 12px;
      padding-right: 10px;
    }

    .job-name {
      font-size: 14px; /* Slightly smaller on mobile */
    }
  }
</style>
