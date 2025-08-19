<script lang="ts">
  import { getJobStatusEmoji } from '$lib/config/emoji';
  import PriorityBadge from '$lib/components/ui/PriorityBadge.svelte';

  let {
    status,
    priority,
    isOverdue = false,
  }: {
    status: string;
    priority: string;
    isOverdue?: boolean;
  } = $props();

  function getStatusInfo(status: string) {
    const statusMap: Record<string, { label: string; color: string }> = {
      open: {
        label: 'Open',
        color: 'var(--text-secondary)',
      },
      in_progress: {
        label: 'In Progress',
        color: 'var(--accent-blue)',
      },
      waiting_for_customer: {
        label: 'Waiting for Customer',
        color: 'var(--text-secondary)',
      },
      waiting_for_scheduled_appointment: {
        label: 'Waiting for Appointment',
        color: 'var(--text-secondary)',
      },
      paused: {
        label: 'Paused',
        color: 'var(--text-secondary)',
      },
      successfully_completed: {
        label: 'Completed',
        color: 'var(--accent-green)',
      },
      cancelled: {
        label: 'Cancelled',
        color: 'var(--accent-red)',
      },
    };

    return (
      statusMap[status] || {
        label: status && typeof status === 'string' ? status.replace('_', ' ') : 'Unknown',
        color: 'var(--text-secondary)',
      }
    );
  }

  // Use centralized priority system via PriorityBadge component

  const statusInfo = $derived(
    status ? getStatusInfo(status) : { label: 'Unknown', color: 'var(--text-secondary)' }
  );
  const statusEmoji = $derived(status ? getJobStatusEmoji(status) : '📝');
</script>

<div class="status-indicator">
  <!-- Primary Status -->
  <div class="status-badge primary" style="color: {statusInfo.color}" data-status={status}>
    <span class="status-emoji">{statusEmoji}</span>
    <span class="status-label">{statusInfo.label}</span>
  </div>

  <!-- Priority Indicator (only if not normal) -->
  {#if priority !== 'normal'}
    <div class="priority-badge-wrapper">
      <PriorityBadge {priority} type="job" size="small" showLabel={true} hideNormal={true} />
    </div>
  {/if}

  <!-- Overdue Warning -->
  {#if isOverdue}
    <div class="status-badge overdue">
      <span class="status-emoji">⚠️</span>
      <span class="status-label">Overdue</span>
    </div>
  {/if}
</div>

<style>
  .status-indicator {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background-color: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .status-badge.primary {
    font-size: 13px;
    padding: 8px 14px;
  }

  .priority-badge-wrapper {
    /* Priority badge styling now handled by PriorityBadge component */
  }

  .status-badge.overdue {
    background-color: rgba(255, 69, 58, 0.15);
    border-color: var(--accent-red);
    color: var(--accent-red);
    font-weight: 600;
    animation: pulse-subtle 2s infinite;
  }

  .status-emoji {
    font-size: 14px;
    line-height: 1;
  }

  .status-badge.primary .status-emoji {
    font-size: 16px;
  }

  .status-label {
    color: inherit;
    line-height: 1;
  }

  /* Subtle pulse animation for overdue items */
  @keyframes pulse-subtle {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }

  /* Status-specific styling based on status type */
  .status-badge.primary[data-status='successfully_completed'] {
    background-color: rgba(50, 215, 75, 0.1);
    border-color: rgba(50, 215, 75, 0.2);
  }

  .status-badge.primary[data-status='in_progress'] {
    background-color: rgba(0, 163, 255, 0.1);
    border-color: rgba(0, 163, 255, 0.2);
  }

  .status-badge.primary[data-status='cancelled'] {
    background-color: rgba(255, 69, 58, 0.1);
    border-color: rgba(255, 69, 58, 0.2);
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .status-indicator {
      align-items: flex-start;
      gap: 6px;
    }

    .status-badge {
      font-size: 11px;
      padding: 5px 10px;
    }

    .status-badge.primary {
      font-size: 12px;
      padding: 6px 12px;
    }

    .status-emoji {
      font-size: 12px;
    }

    .status-badge.primary .status-emoji {
      font-size: 14px;
    }
  }

  @media (max-width: 480px) {
    .status-badge {
      padding: 4px 8px;
      gap: 4px;
    }

    .status-badge.primary {
      padding: 5px 10px;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .status-badge {
      border-width: 2px;
      font-weight: 600;
    }

    .status-badge.overdue {
      border-width: 3px;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .status-badge.overdue {
      animation: none;
    }
  }
</style>
