<!--
  JobsList Component
  
  Reusable jobs list with loading, error, and empty states.
  Handles the display logic for job collections.
-->

<script lang="ts">
  import type { JobData } from '$lib/models/types/job-data';
  import JobCard from './JobCard.svelte';
  import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    jobs: JobData[];
    isLoading?: boolean;
    error?: Error | null;
    showClient?: boolean;
    emptyMessage?: string;
    emptyAction?: Snippet;
    showCount?: boolean;
  }

  let {
    jobs = [],
    isLoading = false,
    error = null,
    showClient = false,
    emptyMessage = 'No jobs found',
    emptyAction,
    showCount = false,
  }: Props = $props();
</script>

{#if isLoading}
  <div class="jobs-list">
    <LoadingSkeleton type="job-card" count={5} />
  </div>
{:else if error}
  <div class="error-state">
    <div class="error-content">
      <h2>Unable to load jobs</h2>
      <p>Zero.js will automatically retry. Please check your connection.</p>
      <div class="error-details">
        <code>{error.message}</code>
      </div>
    </div>
  </div>
{:else if jobs.length === 0}
  <div class="empty-state-wrapper">
    <div class="empty-state">
      <div class="empty-state-icon">📋</div>
      <h2>{emptyMessage}</h2>
      {#if emptyAction}
        {@render emptyAction()}
      {/if}
    </div>
  </div>
{:else}
  <div class="jobs-list" data-testid="job-list">
    {#each jobs as job (job.id)}
      <JobCard {job} {showClient} />
    {/each}
  </div>

  {#if showCount}
    <div class="jobs-info">
      <p>Showing {jobs.length} jobs</p>
    </div>
  {/if}
{/if}

<style>
  .jobs-list {
    display: flex;
    flex-direction: column;
    gap: 12px; /* Using consistent gap across both pages */
  }

  /* Error State */
  .error-state {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: 40px 20px;
  }

  .error-content {
    text-align: center;
    max-width: 400px;
  }

  .error-content h2 {
    color: var(--text-primary);
    margin-bottom: 12px;
    font-size: 24px;
  }

  .error-content p {
    color: var(--text-secondary);
    margin-bottom: 16px;
    line-height: 1.5;
  }

  .error-details {
    background-color: var(--bg-tertiary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    padding: 12px;
    margin: 16px 0;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  }

  .error-details code {
    color: var(--text-secondary);
    font-size: 13px;
    word-break: break-word;
  }

  /* Empty State */
  .empty-state-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: 40px 20px;
  }

  .empty-state {
    text-align: center;
    max-width: 400px;
  }

  .empty-state-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .empty-state h2 {
    color: var(--text-primary);
    margin-bottom: 12px;
    font-size: 24px;
  }

  /* Jobs Count Info */
  .jobs-info {
    margin-top: 24px;
    padding: 16px 0;
    text-align: center;
    border-top: 1px solid var(--border-primary);
  }

  .jobs-info p {
    color: var(--text-tertiary);
    font-size: 14px;
    margin: 0;
  }

  /* Responsive adjustments */
  @media (max-width: 480px) {
    .error-content h2 {
      font-size: 20px;
    }

    .error-content p {
      font-size: 14px;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .jobs-list {
      gap: 12px;
    }

    .error-details {
      border-width: 2px;
    }
  }
</style>
