<!--
  MessageBubble - Apple-style message bubble component
  
  Displays individual messages with iOS Messages-inspired design.
  Handles inbound/outbound styling, timestamps, and author info.
-->

<script lang="ts">
  import type { FrontMessageData } from '$lib/models/types/front-message-data';

  interface Props {
    message: FrontMessageData;
    showAuthor?: boolean;
    isFirstInGroup?: boolean;
    isLastInGroup?: boolean;
    recipientHandle?: string;
  }

  let {
    message,
    showAuthor = false,
    isFirstInGroup = true,
    isLastInGroup = true,
    recipientHandle,
  }: Props = $props();

  // Determine if message is outbound (sent by team)
  const isOutbound = $derived(!message.is_inbound);

  // Format timestamp
  const formattedTime = $derived(() => {
    if (!message.created_at_timestamp) return '';

    const date = new Date(message.created_at_timestamp * 1000);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
  });

  // Get message content with fallback
  const messageContent = $derived(
    message.body_plain || message.blurb || 'Message content unavailable'
  );

  // Get author display name
  const authorName = $derived(() => {
    // For inbound messages, use the conversation's recipient handle
    if (!isOutbound && recipientHandle) {
      return recipientHandle;
    }
    // Fallback to message author info
    return message.author_name || message.author_handle || 'Unknown';
  });
</script>

<div
  class="message-wrapper"
  class:outbound={isOutbound}
  class:inbound={!isOutbound}
  class:first-in-group={isFirstInGroup}
  class:last-in-group={isLastInGroup}
>
  {#if showAuthor && !isOutbound && isFirstInGroup}
    <div class="author-name">{authorName()}</div>
  {/if}

  {#if isFirstInGroup}
    <div class="timestamp-row">
      <span class="timestamp">{formattedTime()}</span>
    </div>
  {/if}

  <div class="message-bubble">
    <div class="message-content">
      {messageContent}
    </div>
  </div>
</div>

<style>
  .message-wrapper {
    display: flex;
    flex-direction: column;
    margin-bottom: 2px;
    padding: 0 16px;
  }

  .message-wrapper.first-in-group {
    margin-top: 12px;
  }

  .message-wrapper.last-in-group {
    margin-bottom: 16px;
  }

  /* Author name for inbound messages */
  .author-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 4px;
    margin-left: 12px;
  }

  /* Inbound messages (left side) */
  .message-wrapper.inbound {
    align-items: flex-start;
  }

  .message-wrapper.inbound .message-bubble {
    background-color: #1c1c1e;
    color: var(--text-primary);
    margin-right: auto;
    max-width: 70%;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  /* Outbound messages (right side) */
  .message-wrapper.outbound {
    align-items: flex-end;
  }

  .message-wrapper.outbound .message-bubble {
    background-color: var(--accent-blue, #007aff);
    color: white;
    margin-left: auto;
    max-width: 70%;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  /* Message bubble */
  .message-bubble {
    padding: 8px 12px;
    border-radius: 18px;
    word-wrap: break-word;
    position: relative;
    animation: messageSlideIn 0.3s ease-out;
    transform-origin: bottom;
  }

  @keyframes messageSlideIn {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Adjust border radius for grouped messages */
  .message-wrapper.inbound:not(.first-in-group) .message-bubble {
    border-top-left-radius: 4px;
  }

  .message-wrapper.inbound:not(.last-in-group) .message-bubble {
    border-bottom-left-radius: 4px;
  }

  .message-wrapper.outbound:not(.first-in-group) .message-bubble {
    border-top-right-radius: 4px;
  }

  .message-wrapper.outbound:not(.last-in-group) .message-bubble {
    border-bottom-right-radius: 4px;
  }

  /* Message content */
  .message-content {
    font-size: 15px;
    line-height: 1.4;
    white-space: pre-wrap;
  }

  /* Timestamp above bubble */
  .timestamp-row {
    margin-bottom: 4px;
    padding: 0 12px;
  }

  .timestamp {
    font-size: 11px;
    font-weight: 400;
    color: var(--text-tertiary);
  }

  /* Align timestamp based on message direction */
  .message-wrapper.inbound .timestamp-row {
    text-align: left;
  }

  .message-wrapper.outbound .timestamp-row {
    text-align: right;
  }

  /* Dark mode adjustments */
  @media (prefers-color-scheme: dark) {
    .message-wrapper.inbound .message-bubble {
      background-color: #1c1c1e;
      color: var(--text-primary, #fff);
    }
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .message-wrapper {
      padding: 0 12px;
    }

    .message-bubble {
      max-width: 80%;
    }

    .message-content {
      font-size: 14px;
    }

    .message-metadata {
      font-size: 10px;
    }
  }
</style>
