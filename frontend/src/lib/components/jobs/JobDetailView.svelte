<script lang="ts">
  import type { PopulatedJob } from '$lib/types/job';
  import EditableTitle from '../ui/EditableTitle.svelte';
  import TaskList from './TaskList.svelte';
  import { debugComponent } from '$lib/utils/debug';

  // ✨ USE $props() FOR SVELTE 5 RUNES MODE
  let {
    job,
    keptTasks = [],
    batchTaskDetails = null,
    isNewJobMode = false, // NEW: Indicates creation mode
    onJobTitleSave = null, // NEW: Custom save handler for creation
    onCancel = null, // NEW: Cancel handler for creation
  }: {
    job: PopulatedJob;
    keptTasks?: unknown[];
    batchTaskDetails?: unknown;
    isNewJobMode?: boolean; // NEW
    onJobTitleSave?: ((title: string) => Promise<unknown>) | null; // NEW
    onCancel?: (() => void) | null; // NEW
  } = $props();

  // ✨ USE $inspect FOR DEBUGGING REACTIVE STATE IN SVELTE 5
  $effect(() => {
    if (job) {
      $inspect('[JobDetailView] Received job data:', job);
      debugComponent('[JobDetailView] Job data loaded', {
        title: job?.title,
        client: job?.client?.name || 'Using Zero.js flat structure',
        status: job?.status,
        tasksType: typeof job?.tasks,
        tasksLength: job?.tasks?.length,
      });
      if (job?.tasks && job.tasks.length > 0) {
        $inspect('[JobDetailView] First task:', job.tasks[0]);
        debugComponent('[JobDetailView] First task data', {
          taskId: job.tasks[0]?.id,
          taskTitle: job.tasks[0]?.title,
        });
      }
    }
  });

  // ✨ USE $derived FOR COMPUTED VALUES (NOT REACTIVE STATEMENTS)
  const jobTitle = $derived(job?.title || '');
  const jobId = $derived(job?.id || '');
  const isUntitledJob = $derived(jobTitle === 'Untitled Job' || jobTitle === '');

  // Determine auto-focus behavior
  const shouldAutoFocus = $derived(isNewJobMode || isUntitledJob);

  // Handle job title save - use custom handler in new job mode
  async function handleJobTitleSave(newTitle: string) {
    if (isNewJobMode && onJobTitleSave) {
      return await onJobTitleSave(newTitle);
    }

    // Existing logic for updating existing jobs
    try {
      // Use the Job ActiveRecord model to update
      const { Job } = await import('$lib/models/job');
      await Job.update(jobId, { title: newTitle });
      debugComponent('Job title updated successfully', { jobId, newTitle });
    } catch (error) {
      debugComponent.error('Job title update failed', { error, jobId, newTitle });
      throw error; // Re-throw so EditableTitle can handle the error
    }
  }
</script>

<div class="job-detail-view">
  <EditableTitle
    value={jobTitle}
    tag="h1"
    className="job-title"
    placeholder="Untitled Job"
    autoFocus={shouldAutoFocus}
    onSave={handleJobTitleSave}
    isCreationMode={isNewJobMode}
  />

  <!-- Tasks Section -->
  <div class="tasks-section">
    <TaskList
      tasks={Array.isArray(job?.tasks) ? job.tasks.map((task, index) => ({
        ...task,
        position: task.position ?? (index + 1) * 1000,
        parent_id: task.parent_id === undefined ? null : task.parent_id
      })) : []}
      {keptTasks}
      jobId={job?.id}
      {batchTaskDetails}
      {isNewJobMode}
      {onCancel}
      jobLoaded={!!job}
    />
  </div>
</div>

<style>
  .job-detail-view {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .job-detail-view :global(.job-title) {
    flex-shrink: 0;
  }

  .tasks-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* Responsive layout */
  @media (max-width: 768px) {
    .job-detail-view {
      gap: 24px;
    }
  }
</style>
