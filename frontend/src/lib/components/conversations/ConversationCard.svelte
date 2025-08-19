<script lang="ts">
  import type { FrontConversationData } from '$lib/models/types/front-conversation-data';

  let {
    conversation,
  }: {
    conversation: FrontConversationData;
  } = $props();

  // Format the waiting_since_timestamp
  const formatWaitingTime = (timestamp?: number): string => {
    if (!timestamp) return '';

    const date = new Date(timestamp * 1000); // Assuming Unix timestamp
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  // Get status emoji based on status_category
  const getStatusEmoji = (statusCategory?: string): string => {
    switch (statusCategory) {
      case 'assigned':
        return '👤';
      case 'unassigned':
        return '❓';
      case 'archived':
        return '📁';
      case 'snoozed':
        return '😴';
      case 'closed':
        return '✅';
      default:
        return '💬';
    }
  };

  const statusEmoji = $derived(getStatusEmoji(conversation.status_category));
  const waitingTime = $derived(formatWaitingTime(conversation.waiting_since_timestamp));

  function getConversationPath(conversation: FrontConversationData): string {
    return `/talk/${conversation.id}`;
  }
</script>

<a
  href={getConversationPath(conversation)}
  class="conversation-card-inline"
  data-conversation-id={conversation.id}
  data-sveltekit-preload-data="hover"
>
  <!-- Status emoji -->
  <span class="conversation-status-emoji">{statusEmoji}</span>

  <!-- Main content section -->
  <span class="conversation-content-section">
    <span class="conversation-recipient">{conversation.recipient_handle || 'Unknown Contact'}</span>
    <span class="conversation-subject">{conversation.subject || 'No Subject'}</span>
  </span>

  <!-- Right side items -->
  <span class="conversation-right-section">
    {#if waitingTime}
      <span class="waiting-time">{waitingTime}</span>
    {/if}
  </span>
</a>

<style>
  .conversation-card-inline {
    display: flex;
    align-items: flex-start;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    padding: 12px 16px;
    text-decoration: none;
    color: inherit;
    gap: 12px;
  }

  .conversation-card-inline:active {
    transform: scale(0.99);
  }

  .conversation-status-emoji {
    font-size: 18px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .conversation-content-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: hidden;
  }

  .conversation-recipient {
    color: var(--accent-blue);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .conversation-subject {
    font-weight: 400;
    color: var(--text-primary);
    font-size: 15px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .conversation-right-section {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .waiting-time {
    color: var(--text-tertiary);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .conversation-card-inline {
      padding: 10px 12px;
      gap: 10px;
    }

    .conversation-recipient {
      font-size: 13px;
    }

    .conversation-subject {
      font-size: 14px;
    }

    .waiting-time {
      font-size: 11px;
    }
  }
</style>
