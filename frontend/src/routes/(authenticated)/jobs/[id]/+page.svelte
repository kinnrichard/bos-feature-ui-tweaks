<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onDestroy } from 'svelte';
  // Epic-009: Import ReactiveJob for Rails-style includes()
  import { ReactiveJob } from '$lib/models/reactive-job';
  import { ReactiveClient } from '$lib/models/reactive-client';
  import { Job } from '$lib/models/job';
  import { taskFilterActions, shouldShowTask } from '$lib/stores/taskFilter.svelte';
  import { toastStore } from '$lib/stores/toast.svelte';

  // ✨ NEW: Use ReactiveQuery for automatic Svelte reactivity
  import AppLayout from '$lib/components/layout/AppLayout.svelte';
  import JobDetailView from '$lib/components/jobs/JobDetailView.svelte';
  import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';

  // ✨ Route Detection Logic: Detect if this is "new" job creation mode
  const isNewJobMode = $derived($page.params.id === 'new');
  const jobId = $derived(!isNewJobMode ? $page.params.id : null);
  const clientId = $derived(isNewJobMode ? $page.url.searchParams.get('clientId') : null);

  // ✨ Conditional Data Loading: Job query for regular jobs
  const jobQuery = $derived(
    !isNewJobMode && jobId
      ? ReactiveJob.includes('client')
          .includes('tasks', { orderBy: ['position', 'created_at'] })
          .includes('jobAssignments')
          .find(jobId)
      : null
  );

  // ✨ Conditional Data Loading: Client query for new job creation
  const clientQuery = $derived(isNewJobMode && clientId ? ReactiveClient.find(clientId) : null);

  // ✨ Create new job object using ActiveRecord.new() for new job creation mode
  const newJobMock = $derived(
    isNewJobMode && clientQuery?.data
      ? {
          ...Job.new({
            client_id: clientId || undefined,
            title: '', // Start empty, EditableTitle will handle in creation mode
          }),
          client: clientQuery.data,
          tasks: [],
        }
      : null
  );

  // ✨ Unified job object: use mock for creation mode, real data for regular jobs
  const job = $derived(isNewJobMode ? newJobMock : jobQuery?.data);
  // ULTRA-CONSERVATIVE: Only show loading when we definitly have no data AND query is actually loading
  const isLoading = $derived(
    isNewJobMode
      ? !newJobMock &&
          (clientQuery?.resultType === 'loading' || clientQuery?.resultType === 'unknown')
      : !job && (jobQuery?.resultType === 'loading' || jobQuery?.resultType === 'unknown')
  );
  const error = $derived(isNewJobMode ? clientQuery?.error : jobQuery?.error);
  const resultType = $derived(
    isNewJobMode
      ? newJobMock
        ? 'complete'
        : (clientQuery?.resultType ?? 'loading')
      : job
        ? 'complete'
        : (jobQuery?.resultType ?? 'loading')
  );

  // ✨ Page Title Logic: Different titles for creation vs viewing
  const pageTitle = $derived(
    isNewJobMode
      ? clientQuery?.data
        ? `New Job for ${clientQuery.data.name} - bŏs`
        : 'New Job - bŏs'
      : job
        ? `${job.title || 'Job'} - bŏs`
        : 'Job Details - bŏs'
  );

  // ✨ Pass job to AppLayout once loaded (for client display in sidebar)
  const currentJobForLayout = $derived(job);

  // ✨ NOTES: Will be loaded via job associations for now
  // TODO: Implement separate NotesReactive query when needed
  const notes = $derived(job?.notes || []);
  const notesLoading = $derived(false); // Notes load with job for now

  // ✨ DUAL QUERY PATTERN:
  // keptTasks: All non-discarded tasks (for positioning calculations)
  const keptTasks = $derived(job?.tasks?.filter((t) => !t.discarded_at) || []);

  // displayedTasks: Tasks matching current filters (for UI rendering)
  const displayedTasks = $derived(job?.tasks?.filter(shouldShowTask) || []);

  // ✨ TASK BATCH DETAILS: Based on displayed tasks (what user sees)
  const taskBatchDetails = $derived(
    displayedTasks.length > 0
      ? {
          total: displayedTasks.length,
          completed: displayedTasks.filter((task) => task.status === 'completed').length,
          pending: displayedTasks.filter((task) => task.status === 'pending').length,
          in_progress: displayedTasks.filter((task) => task.status === 'in_progress').length,
        }
      : undefined
  );

  // ✨ USE $effect FOR SIDE EFFECTS (NOT REACTIVE STATEMENTS)
  $effect(() => {
    if (error) {
      console.error('[JobPage] Job loading error:', error.message);
    }
  });

  // Note: No need to clear layout store since we're not using it anymore

  // ✨ Creation Handler: Handle job title save (creation)
  async function handleJobTitleSave(newTitle: string) {
    const trimmedTitle = newTitle.trim();

    if (!trimmedTitle) {
      toastStore.error('Please give this job a name');
      return Promise.reject(new Error('Job title is required'));
    }

    try {
      const createdJob = await Job.create({
        ...Job.new({
          client_id: clientId || undefined,
        }),
        title: trimmedTitle,
      });

      // Navigate to the newly created job
      goto(`/jobs/${createdJob.id}`);
      return createdJob;
    } catch (error) {
      console.error('Failed to create job:', error);
      toastStore.error('Failed to create job. Please try again.');
      throw error;
    }
  }

  // ✨ Cancel Handler: Handle cancel action in creation mode
  function handleCancel() {
    goto(`/clients/${clientId}/jobs`);
  }

  // Handle back navigation
  function handleBack() {
    // Reset filters when navigating away from job detail
    taskFilterActions.clearSearch();
    goto('/jobs');
  }

  // Reset filters when component unmounts (user navigates away)
  onDestroy(() => {
    taskFilterActions.clearSearch();
  });

  // Zero.js handles all retries and refreshes automatically
  // No manual retry logic needed - trust Zero's built-in resilience
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<AppLayout
  currentJob={currentJobForLayout}
  currentClient={isNewJobMode ? clientQuery?.data : undefined}
  toolbarDisabled={isNewJobMode}
>
  <div class="job-detail-container">
    <!-- Loading State -->
    {#if isLoading}
      <div class="job-detail-loading">
        <LoadingSkeleton type="job-detail" />
      </div>

      <!-- Error State -->
    {:else if error}
      <div class="error-state">
        <div class="error-content">
          <h2>{isNewJobMode ? 'Client not found' : 'Unable to load job'}</h2>
          <p>
            {isNewJobMode
              ? 'The specified client could not be found.'
              : 'There was a problem loading this job. Please try again.'}
          </p>
          {#if error.message}
            <div class="error-details">
              <code>{error.message}</code>
            </div>
          {/if}
          <div class="error-actions">
            {#if !isNewJobMode}
              <p>Zero.js will automatically retry the connection.</p>
            {/if}
            <button
              class="button button--{isNewJobMode ? 'primary' : 'secondary'}"
              onclick={isNewJobMode ? () => goto('/clients') : handleBack}
            >
              {isNewJobMode ? 'Back to Clients' : 'Back to Jobs'}
            </button>
          </div>
        </div>
      </div>

      <!-- Job Detail Content -->
    {:else if job}
      <JobDetailView
        job={isNewJobMode ? job : { ...job, tasks: displayedTasks }}
        keptTasks={isNewJobMode ? [] : keptTasks}
        batchTaskDetails={isNewJobMode ? undefined : taskBatchDetails}
        notes={isNewJobMode ? [] : notes}
        notesLoading={isNewJobMode ? false : notesLoading}
        {isNewJobMode}
        onJobTitleSave={isNewJobMode ? handleJobTitleSave : undefined}
        onCancel={isNewJobMode ? handleCancel : undefined}
      />

      <!-- Not Found State - Zero.js pattern: Only show when complete with no job -->
    {:else if !job && resultType === 'complete'}
      <div class="error-state">
        <div class="error-content">
          <h2>{isNewJobMode ? 'Client not found' : 'Job not found'}</h2>
          <p>
            {isNewJobMode
              ? 'The specified client could not be found.'
              : 'The requested job could not be found.'}
          </p>
          <button
            class="button button--primary"
            onclick={isNewJobMode ? () => goto('/clients') : handleBack}
          >
            {isNewJobMode ? 'Back to Clients' : 'Back to Jobs'}
          </button>
        </div>
      </div>
    {/if}
  </div>
</AppLayout>

<style>
  .job-detail-container {
    padding: 3px 24px 0 24px;
    max-width: 1200px;
    margin: 0 auto;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .job-detail-loading {
    padding: 20px 0;
  }

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

  .error-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 20px;
  }

  .button {
    padding: 12px 24px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.15s ease;
  }

  .button--primary {
    background: var(--accent-blue);
    color: white;
  }

  .button--primary:hover {
    background: var(--accent-blue-hover);
  }

  .button--secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-primary);
  }

  .button--secondary:hover {
    background: var(--bg-quaternary);
  }

  /* Responsive layout */
  @media (max-width: 768px) {
    .job-detail-container {
      padding: 16px;
    }

    .error-actions {
      flex-direction: column;
    }

    .error-content h2 {
      font-size: 20px;
    }

    .error-content p {
      font-size: 14px;
    }
  }

  @media (min-width: 768px) {
    .error-actions {
      flex-direction: row;
      justify-content: center;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .error-details {
      border-width: 2px;
    }
  }
</style>
