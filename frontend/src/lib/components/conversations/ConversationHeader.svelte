<!--
  ConversationHeader - Apple-style header for conversation detail view
  
  Displays recipient information, status, and navigation controls
  with iOS Messages-inspired design.
-->

<script lang="ts">
  import type { FrontConversationData } from '$lib/models/types/front-conversation-data';
  import { goto } from '$app/navigation';

  interface Props {
    conversation: FrontConversationData;
  }

  let { conversation }: Props = $props();

  // Format the recipient name with fallback
  const recipientName = $derived(conversation.recipient_handle || 'Unknown Contact');

  // Get status color based on status_category
  const statusColor = $derived(() => {
    switch (conversation.status_category) {
      case 'assigned':
        return 'var(--accent-blue)';
      case 'unassigned':
        return 'var(--accent-orange)';
      case 'archived':
        return 'var(--text-tertiary)';
      case 'snoozed':
        return 'var(--accent-purple)';
      case 'closed':
        return 'var(--accent-green)';
      default:
        return 'var(--text-secondary)';
    }
  });

  function handleBack() {
    goto('/talk');
  }
</script>

<header class="conversation-header">
  <div class="header-content">
    <!-- Back button -->
    <button class="back-button" onclick={handleBack} aria-label="Back to conversations">
      <svg
        width="12"
        height="20"
        viewBox="0 0 12 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10 18L2 10L10 2"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="back-text">Talk</span>
    </button>

    <!-- Center section with recipient info -->
    <div class="header-center">
      <div class="recipient-avatar">
        {recipientName.charAt(0).toUpperCase()}
      </div>
      <div class="recipient-info">
        <h1 class="recipient-name">{recipientName}</h1>
        <div class="status-indicator" style="color: {statusColor()}">
          <span class="status-dot" style="background-color: {statusColor()}"></span>
          <span class="status-text">{conversation.status_category || 'open'}</span>
        </div>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="header-actions">
      <button class="action-button" aria-label="More options">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="10" cy="10" r="1.5" fill="currentColor" />
          <circle cx="10" cy="4" r="1.5" fill="currentColor" />
          <circle cx="10" cy="16" r="1.5" fill="currentColor" />
        </svg>
      </button>
    </div>
  </div>
</header>

<style>
  .conversation-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background-color: var(--bg-black);
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    height: 64px;
    max-width: 1200px;
    margin: 0 auto;
  }

  /* Back button */
  .back-button {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    margin-left: -8px;
    background: none;
    border: none;
    color: var(--accent-blue);
    font-size: 17px;
    font-weight: 400;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .back-button:hover {
    background-color: rgba(255, 255, 255, 0.05);
    transform: translateX(-2px);
  }

  .back-button:active {
    transform: translateX(-1px) scale(0.98);
  }

  .back-button svg {
    width: 12px;
    height: 20px;
    flex-shrink: 0;
  }

  .back-text {
    font-size: 17px;
    line-height: 1;
  }

  /* Center section */
  .header-center {
    display: flex;
    align-items: center;
    gap: 12px;
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
  }

  .recipient-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background-color: var(--accent-blue);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .recipient-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .recipient-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    white-space: nowrap;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .status-text {
    font-weight: 500;
    text-transform: lowercase;
  }

  /* Action buttons */
  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .action-button {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 50%;
    transition: background-color 0.2s;
  }

  .action-button:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .header-content {
      height: 56px;
      padding: 0 12px;
    }

    .header-center {
      position: static;
      transform: none;
      flex: 1;
      margin-left: 8px;
    }

    .recipient-avatar {
      width: 32px;
      height: 32px;
      font-size: 14px;
    }

    .recipient-name {
      font-size: 15px;
    }

    .status-indicator {
      font-size: 11px;
    }

    .action-button {
      width: 28px;
      height: 28px;
    }
  }

  @media (max-width: 480px) {
    .back-text {
      display: none;
    }

    .back-button {
      padding: 6px;
    }
  }
</style>
