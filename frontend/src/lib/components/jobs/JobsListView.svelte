<!--
  JobsListView - Presentation component for job listings
  EP-0018: DRY Jobs Pages with Composable Architecture
  
  This component handles the presentation layer for job listings,
  integrating with ReactiveView and providing a consistent UI
  across all job listing contexts.
-->

<script lang="ts">
  import type { ReactiveQuery } from '$lib/models/base/types';
  import type { JobData } from '$lib/models/types/job-data';
  import type { Snippet } from 'svelte';
  import ReactiveView from '$lib/reactive/ReactiveView.svelte';
  import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
  import JobCard from '$lib/components/jobs/JobCard.svelte';
  import JobsLayout from '$lib/components/jobs/JobsLayout.svelte';
  import { groupJobs, getPopulatedSections } from '$lib/utils/job-grouping';

  interface Props {
    /**
     * The reactive query to fetch jobs
     */
    query: ReactiveQuery<JobData[]>;

    /**
     * Optional display filter to apply to loaded jobs
     * Defaults to identity function (no filtering)
     */
    displayFilter?: (jobs: JobData[]) => JobData[];

    /**
     * Whether to show the client name in job cards
     * Defaults to true
     */
    showClient?: boolean;

    /**
     * Optional title for the page
     */
    title?: string;

    /**
     * Optional snippet for additional header content
     */
    headerContent?: Snippet;

    /**
     * Optional loading message
     */
    loadingMessage?: string;

    /**
     * Optional empty state message
     */
    emptyMessage?: string;

    /**
     * Optional empty state icon
     */
    emptyIcon?: string;

    /**
     * Optional no results message (when filtered results are empty)
     */
    noResultsMessage?: string;

    /**
     * Optional no results description
     */
    noResultsDescription?: string;

    /**
     * Optional no results icon
     */
    noResultsIcon?: string;

    /**
     * Loading strategy for ReactiveView
     */
    strategy?: 'progressive' | 'immediate';
  }

  let {
    query,
    displayFilter = (jobs) => jobs,
    showClient = true,
    title,
    headerContent,
    emptyMessage = 'No jobs found',
    emptyIcon = '💼',
    noResultsMessage = 'No jobs match your filters',
    noResultsDescription = 'Try adjusting your filters or search criteria.',
    noResultsIcon = '🔍',
    strategy = 'progressive',
  }: Props = $props();
</script>

<JobsLayout>
  {#snippet header()}
    {#if title}
      <h1>{title}</h1>
    {/if}
    {#if headerContent}
      {@render headerContent()}
    {/if}
  {/snippet}

  <ReactiveView {query} {strategy}>
    {#snippet loading()}
      <LoadingSkeleton type="job-card" count={6} />
    {/snippet}

    {#snippet error({ error, refresh })}
      <div class="error-state">
        <h2>Unable to load jobs</h2>
        <p>{error.message}</p>
        <button onclick={refresh} class="retry-button">Retry</button>
      </div>
    {/snippet}

    {#snippet empty()}
      <div class="empty-state">
        <div class="empty-state-icon">{emptyIcon}</div>
        <h2>{emptyMessage}</h2>
      </div>
    {/snippet}

    {#snippet content({ data })}
      {@const filteredJobs = displayFilter(data)}
      {@const groupedJobs = groupJobs(filteredJobs)}
      {@const populatedSections = getPopulatedSections(groupedJobs)}
      {@const activeJobCount = filteredJobs.filter(
        (job) =>
          job.status !== 'successfully_completed' &&
          job.status !== 'cancelled' &&
          job.status !== 5 && // numeric value for successfully_completed
          job.status !== 6 // numeric value for cancelled
      ).length}
      {@const isCompactMode = activeJobCount >= 7}

      {#if filteredJobs.length === 0}
        <div class="empty-state">
          <div class="empty-state-icon">{noResultsIcon}</div>
          <h2>{noResultsMessage}</h2>
          {#if noResultsDescription}
            <p>{noResultsDescription}</p>
          {/if}
        </div>
      {:else}
        <div class="jobs-list" class:compact-mode={isCompactMode}>
          {#each populatedSections as { section, jobs, info } (section)}
            <div class="job-section">
              <div class="section-header">
                <h3 class="section-title">{info.title}</h3>
                <span class="section-count">{jobs.length}</span>
              </div>
              <div class="section-jobs">
                {#each jobs as job (job.id)}
                  <JobCard {job} {showClient} />
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/snippet}
  </ReactiveView>
</JobsLayout>

<style>
  /* Import shared styles */
  @import '$lib/styles/jobs-shared.scss';

  /* Jobs list container */
  .jobs-list {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Job section */
  .job-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Section header */
  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0;
  }

  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #1d1d1f);
    margin: 0;
    flex: 1;
  }

  .section-count {
    margin-left: auto;
    background-color: var(--bg-tertiary);
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 12px;
    min-width: 24px;
    text-align: center;
    display: inline-block;
  }

  /* Section jobs container */
  .section-jobs {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Compact mode styles - applied when 7+ active jobs */
  .jobs-list.compact-mode .section-jobs {
    gap: 0;
  }

  /* Reduce padding and remove individual borders in compact mode */
  .jobs-list.compact-mode .section-jobs :global(.job-card-inline) {
    padding-top: 8px;
    padding-bottom: 8px;
    border-radius: 0;
    border-bottom: none;
  }

  /* First card gets top rounded corners */
  .jobs-list.compact-mode .section-jobs :global(.job-card-inline:first-child) {
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }

  /* Last card gets bottom rounded corners and bottom border */
  .jobs-list.compact-mode .section-jobs :global(.job-card-inline:last-child) {
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
    border-bottom: 1px solid var(--border-primary);
  }

  /* Add subtle separator between cards in compact mode */
  .jobs-list.compact-mode .section-jobs :global(.job-card-inline:not(:last-child))::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 16px;
    right: 16px;
    height: 1px;
    background-color: var(--border-secondary, rgba(0, 0, 0, 0.05));
  }

  /* Make job cards position relative for the separator */
  .jobs-list.compact-mode .section-jobs :global(.job-card-inline) {
    position: relative;
  }

  /* Mobile responsive adjustments */
  @media (max-width: 768px) {
    .jobs-list {
      gap: 20px;
    }

    .section-header {
      padding: 0;
    }

    .section-title {
      font-size: 15px;
    }

    .section-count {
      font-size: 13px;
      padding: 1px 6px;
    }

    .section-jobs {
      gap: 10px;
    }

    /* Compact mode on mobile */
    .jobs-list.compact-mode .section-jobs {
      gap: 0;
    }

    .jobs-list.compact-mode .section-jobs :global(.job-card-inline) {
      padding-top: 6px;
      padding-bottom: 6px;
    }
  }

  /* Error state */
  .error-state {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-height: 200px;
    padding: 32px;
    text-align: center;
  }

  .error-state h2 {
    color: var(--text-primary);
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 8px 0;
  }

  .error-state p {
    color: var(--text-secondary);
    font-size: 14px;
    margin: 0 0 16px 0;
  }

  .retry-button {
    padding: 8px 16px;
    background-color: var(--accent-blue);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: default;
    transition: background-color 0.2s ease;
  }

  .retry-button:hover {
    background-color: var(--accent-blue-hover, #0051d5);
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    padding: 32px;
    text-align: center;
  }

  .empty-state-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.6;
  }

  .empty-state h2 {
    color: var(--text-secondary, #86868b);
    font-size: 18px;
    font-weight: 500;
    margin: 0;
  }

  .empty-state p {
    color: var(--text-tertiary, #98989d);
    font-size: 14px;
    margin: 8px 0 0 0;
  }
</style>
