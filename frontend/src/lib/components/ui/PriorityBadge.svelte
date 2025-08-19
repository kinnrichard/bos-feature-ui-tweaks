<script lang="ts">
  import { getJobPriorityEmoji, getTaskPriorityEmoji } from '$lib/config/emoji';
  import type { JobPriority } from '$lib/models/types/job-priority';
  import type { TaskPriority } from '$lib/models/types/task-priority';

  // Props
  let {
    priority,
    type = 'job',
    size = 'medium',
    showLabel = true,
    hideNormal = true,
    class: className = '',
  }: {
    priority: JobPriority | TaskPriority;
    type?: 'job' | 'task';
    size?: 'small' | 'medium' | 'large';
    showLabel?: boolean;
    hideNormal?: boolean;
    class?: string;
  } = $props();

  // Check if we should hide the badge (normal priority and hideNormal is true)
  const shouldHide = $derived(
    hideNormal && (priority === 'normal' || (type === 'task' && priority === 'medium'))
  );

  // Get the appropriate emoji based on type
  const emoji = $derived(
    type === 'job'
      ? getJobPriorityEmoji(priority as JobPriority)
      : getTaskPriorityEmoji(priority as TaskPriority)
  );

  // Get priority label with proper formatting
  const label = $derived(() => {
    if (!showLabel) return '';

    // Special case for job priorities
    if (type === 'job' && priority === 'proactive_followup') {
      return 'Proactive Follow-up';
    }
    if (type === 'job' && priority === 'very_high') {
      return 'Very High';
    }

    // Convert to Title Case
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  });

  // Get priority color class
  const priorityColorClass = $derived(() => {
    switch (priority) {
      case 'critical':
      case 'very_high':
      case 'high':
        return 'priority-high';
      case 'normal':
      case 'medium':
        return 'priority-normal';
      case 'low':
        return 'priority-low';
      case 'proactive_followup':
        return 'priority-followup';
      default:
        return 'priority-normal';
    }
  });

  const sizeClass = `priority-badge-${size}`;
  const combinedClass = $derived(`priority-badge ${sizeClass} ${priorityColorClass} ${className}`);
</script>

{#if !shouldHide}
  <span class={combinedClass} data-priority={priority}>
    <span class="priority-badge-emoji">{emoji}</span>
    {#if showLabel}
      <span class="priority-badge-label">{label}</span>
    {/if}
  </span>
{/if}

<style>
  /* Base priority badge styles */
  .priority-badge {
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
  .priority-badge-small {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    gap: 0.125rem;
  }

  .priority-badge-medium {
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
  }

  .priority-badge-large {
    font-size: 1rem;
    padding: 0.375rem 0.75rem;
    gap: 0.375rem;
  }

  /* Priority color variants */
  .priority-high {
    background-color: var(--danger-bg);
    color: var(--danger);
    border: 1px solid var(--danger-border);
  }

  .priority-normal {
    background-color: var(--bg-tertiary);
    color: var(--text-secondary);
    border: 1px solid var(--border-primary);
  }

  .priority-low {
    background-color: var(--accent-green-bg);
    color: var(--accent-green);
    border: 1px solid var(--accent-green-border);
  }

  .priority-followup {
    background-color: var(--accent-purple-bg);
    color: var(--accent-purple);
    border: 1px solid var(--accent-purple-border);
  }

  /* Emoji styles */
  .priority-badge-emoji {
    font-size: 1em;
    line-height: 1;
  }

  /* Label styles */
  .priority-badge-label {
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  /* Dark mode adjustments */
  @media (prefers-color-scheme: dark) {
    .priority-badge {
      /* Colors are already using CSS variables that adapt to dark mode */
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .priority-badge {
      transition: none;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .priority-badge {
      border-width: 2px;
      font-weight: 600;
    }
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .priority-badge-large {
      font-size: 0.875rem;
      padding: 0.25rem 0.5rem;
    }
  }
</style>
