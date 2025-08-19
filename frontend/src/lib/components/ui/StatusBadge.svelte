<script lang="ts">
  import { getJobStatusEmoji, getTaskStatusEmoji, getTaskEmoji } from '$lib/config/emoji';
  import type { JobStatus } from '$lib/models/types/job-status';
  import type { TaskStatus } from '$lib/models/types/task-status';

  // Props
  let {
    status,
    type = 'job',
    size = 'medium',
    showLabel = true,
    class: className = '',
    task = null
  }: {
    status: JobStatus | TaskStatus;
    type?: 'job' | 'task';
    size?: 'small' | 'medium' | 'large';
    showLabel?: boolean;
    class?: string;
    task?: { discarded_at?: string | number | null } | null;
  } = $props();

  // Get the appropriate emoji based on type
  const emoji = $derived(
    type === 'job' 
      ? getJobStatusEmoji(status as JobStatus)
      : task 
        ? getTaskEmoji(task as any)
        : getTaskStatusEmoji(status as TaskStatus)
  );

  // Get status label with proper formatting
  const label = $derived(() => {
    if (!showLabel) return '';
    
    // Convert snake_case to Title Case
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  });

  // Get status color class
  const statusColorClass = $derived(() => {
    switch (status) {
      case 'successfully_completed':
        return 'status-completed';
      case 'in_progress':
        return 'status-in-progress';
      case 'cancelled':
        return 'status-cancelled';
      case 'paused':
      case 'waiting_for_customer':
      case 'waiting_for_scheduled_appointment':
        return 'status-waiting';
      case 'open':
      case 'new_task':
      default:
        return 'status-open';
    }
  });

  const sizeClass = `status-badge-${size}`;
  const combinedClass = `status-badge ${sizeClass} ${statusColorClass()} ${className}`;
</script>

<span class={combinedClass} data-status={status}>
  <span class="status-badge-emoji">{emoji}</span>
  {#if showLabel}
    <span class="status-badge-label">{label()}</span>
  {/if}
</span>

<style>
  /* Base status badge styles */
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    border-radius: 0.375rem;
    font-weight: 500;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  /* Size variants */
  .status-badge-small {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    gap: 0.125rem;
  }

  .status-badge-medium {
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
  }

  .status-badge-large {
    font-size: 1rem;
    padding: 0.375rem 0.75rem;
    gap: 0.375rem;
  }

  /* Status color variants */
  .status-open {
    background-color: var(--bg-tertiary);
    color: var(--text-secondary);
    border: 1px solid var(--border-primary);
  }

  .status-in-progress {
    background-color: var(--accent-green-bg);
    color: var(--accent-green);
    border: 1px solid var(--accent-green-border);
  }

  .status-completed {
    background-color: var(--accent-blue-bg);
    color: var(--accent-blue);
    border: 1px solid var(--accent-blue-border);
  }

  .status-cancelled {
    background-color: var(--danger-bg);
    color: var(--danger);
    border: 1px solid var(--danger-border);
  }

  .status-waiting {
    background-color: var(--warning-bg);
    color: var(--warning);
    border: 1px solid var(--warning-border);
  }

  /* Emoji styles */
  .status-badge-emoji {
    font-size: 1em;
    line-height: 1;
  }

  /* Label styles */
  .status-badge-label {
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  /* Dark mode adjustments */
  @media (prefers-color-scheme: dark) {
    .status-badge {
      /* Colors are already using CSS variables that adapt to dark mode */
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .status-badge {
      transition: none;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .status-badge {
      border-width: 2px;
      font-weight: 600;
    }
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .status-badge-large {
      font-size: 0.875rem;
      padding: 0.25rem 0.5rem;
    }
  }
</style>