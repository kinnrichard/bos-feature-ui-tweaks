<script lang="ts">
  import type { ActivityLogData } from '$lib/models/types/activity-log-data';
  import UserAvatar from '$lib/components/ui/UserAvatar.svelte';
  import { getFormattedMessage } from '$lib/models/extensions/activity-log-helpers';

  interface Props {
    log: ActivityLogData;
    showGroupIndicator?: boolean;
    groupCount?: number;
    showDuplicateIndicator?: boolean;
  }

  let {
    log,
    showGroupIndicator = false,
    groupCount = 1,
    showDuplicateIndicator = true,
  }: Props = $props();

  // Format timestamp
  const formattedTime = $derived(() => {
    const date = new Date(log.created_at);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  });

  const fullDateTime = $derived(() => {
    const date = new Date(log.created_at);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  });

  // Check if this is a system action (no user)
  const isSystemAction = $derived(!log.user_id || log.user_id === 'system');

  // Get computed values using helper functions
  const formattedMessage = $derived(getFormattedMessage(log));

  // Duplicate detection from metadata
  const duplicateCount = $derived(log.metadata?.duplicateCount || 0);
  const hasDuplicates = $derived(duplicateCount > 1);
  const duplicateTimespan = $derived(log.metadata?.duplicateTimespan);

  // Format duplicate timespan for tooltip
  const duplicateTooltip = $derived(() => {
    if (!duplicateTimespan) return '';
    const start = new Date(duplicateTimespan.start);
    const end = new Date(duplicateTimespan.end);
    const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // minutes
    return `${duplicateCount} similar actions over ${duration} minute${duration !== 1 ? 's' : ''}`;
  });
</script>

<div class="activity-log-row">
  <div class="avatar-column">
    {#if isSystemAction}
      <div class="system-avatar">
        <span>S</span>
      </div>
    {:else}
      <UserAvatar user={log.user} size="small" />
    {/if}
  </div>

  <div class="content-column">
    <div class="message">
      <span class="message-text">
        {formattedMessage}
      </span>

      {#if showGroupIndicator && groupCount > 1}
        <span class="group-badge">{groupCount}x</span>
      {/if}

      {#if showDuplicateIndicator && hasDuplicates}
        <span class="duplicate-badge" title={duplicateTooltip()}>
          <span class="duplicate-icon">↻</span>
          <span class="duplicate-count">{duplicateCount}x</span>
        </span>
      {/if}
    </div>

    {#if log.user && !isSystemAction}
      <div class="user-name">
        by {log.user.name || log.user.email || 'Unknown User'}
      </div>
    {/if}
  </div>

  <div class="time-column">
    <time datetime={log.created_at} title={fullDateTime()}>
      {formattedTime()}
    </time>
  </div>
</div>

<style>
  .activity-log-row {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border-secondary);
  }

  .activity-log-row:last-child {
    border-bottom: none;
  }

  .avatar-column {
    flex-shrink: 0;
  }

  .system-avatar {
    width: 24px;
    height: 24px;
    background-color: var(--bg-tertiary);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .content-column {
    flex: 1;
    min-width: 0;
  }

  .message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    line-height: 1.4;
  }

  .message-text {
    color: var(--text-primary);
  }

  .user-name {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: 0.125rem;
  }

  .group-badge {
    background-color: var(--bg-tertiary);
    color: var(--text-secondary);
    padding: 0.125rem 0.375rem;
    border-radius: 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .duplicate-badge {
    background-color: var(--accent-orange, #ff9500);
    color: white;
    padding: 0.125rem 0.375rem;
    border-radius: 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    cursor: help;
  }

  .duplicate-icon {
    font-size: 0.875rem;
    opacity: 0.9;
  }

  .duplicate-count {
    font-weight: 600;
  }

  .time-column {
    flex-shrink: 0;
    color: var(--text-secondary);
    font-size: 0.75rem;
    padding-top: 0.125rem;
  }
</style>
