<!--
  MessageList - Scrollable container for messages
  
  Displays messages in chronological order with proper grouping
  and iOS Messages-style scroll behavior.
-->

<script lang="ts">
  import type { FrontMessageData } from '$lib/models/types/front-message-data';
  import type { FrontConversationData } from '$lib/models/types/front-conversation-data';
  import MessageBubble from './MessageBubble.svelte';
  import LoadingIndicator from '$lib/components/ui/LoadingIndicator.svelte';
  import { onMount, tick } from 'svelte';

  interface Props {
    messages: FrontMessageData[];
    loading?: boolean;
    conversation?: FrontConversationData;
  }

  let { messages, loading = false, conversation }: Props = $props();

  let scrollContainer: HTMLDivElement;
  let shouldAutoScroll = true;

  // Group messages by author and time proximity
  const groupedMessages = $derived(
    (() => {
      const groups: Array<{
        messages: FrontMessageData[];
        authorId: string | undefined;
        isInbound: boolean;
      }> = [];

      messages.forEach((message, index) => {
        const prevMessage = messages[index - 1];
        const timeDiff =
          prevMessage && message.created_at_timestamp && prevMessage.created_at_timestamp
            ? message.created_at_timestamp - prevMessage.created_at_timestamp
            : Infinity;

        // Group messages if:
        // 1. Same author
        // 2. Same direction (inbound/outbound)
        // 3. Within 1 minute of each other
        const shouldGroup =
          prevMessage &&
          prevMessage.author_id === message.author_id &&
          prevMessage.is_inbound === message.is_inbound &&
          timeDiff < 60; // 60 seconds

        if (shouldGroup && groups.length > 0) {
          groups[groups.length - 1].messages.push(message);
        } else {
          groups.push({
            messages: [message],
            authorId: message.author_id,
            isInbound: message.is_inbound || false,
          });
        }
      });

      return groups;
    })()
  );

  // Auto-scroll to bottom when new messages arrive
  $effect(() => {
    if (messages.length && shouldAutoScroll) {
      scrollToBottom();
    }
  });

  async function scrollToBottom() {
    await tick();
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: 'smooth',
      });
    }
  }

  function handleScroll() {
    if (!scrollContainer) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    shouldAutoScroll = isNearBottom;
  }

  onMount(() => {
    scrollToBottom();
  });
</script>

<div class="message-list" bind:this={scrollContainer} onscroll={handleScroll}>
  {#if loading}
    <div class="loading-container">
      <LoadingIndicator
        type="spinner"
        size="large"
        message="Loading messages..."
        color="secondary"
        center={true}
      />
    </div>
  {:else if messages.length === 0}
    <div class="empty-state">
      <div class="empty-icon">💬</div>
      <h3>No messages yet</h3>
      <p>Start the conversation by sending a message</p>
    </div>
  {:else}
    <div class="messages-container">
      {#each groupedMessages as group}
        <div class="message-group">
          {#each group.messages as message, messageIndex}
            <MessageBubble
              {message}
              showAuthor={group.isInbound && group.messages.length > 1}
              isFirstInGroup={messageIndex === 0}
              isLastInGroup={messageIndex === group.messages.length - 1}
              recipientHandle={conversation?.recipient_handle}
            />
          {/each}
        </div>
      {/each}
    </div>
  {/if}

  {#if !loading && messages.length > 0}
    <button
      class="scroll-to-bottom"
      class:visible={!shouldAutoScroll}
      onclick={scrollToBottom}
      aria-label="Scroll to bottom"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10 14L6 10M10 14L14 10M10 14V6"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  {/if}
</div>

<style>
  .message-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    background-color: var(--bg-black);
    /* iOS-style elastic scrolling */
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
    height: 100%;
  }

  .messages-container {
    padding: 16px 0;
    min-height: 100%;
    display: flex;
    flex-direction: column;
  }

  .message-group {
    display: flex;
    flex-direction: column;
  }

  /* Loading state */
  .loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 40px 20px;
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 40px 20px;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty-state h3 {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px 0;
  }

  .empty-state p {
    font-size: 15px;
    color: var(--text-secondary);
    margin: 0;
  }

  /* Adjust empty state emoji for dark background */
  .empty-icon {
    opacity: 0.8;
  }

  /* Scroll to bottom button */
  .scroll-to-bottom {
    position: absolute;
    bottom: 20px;
    right: 20px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background-color: var(--bg-tertiary);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    visibility: hidden;
    transform: scale(0.8);
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .scroll-to-bottom.visible {
    opacity: 1;
    visibility: visible;
    transform: scale(1);
  }

  .scroll-to-bottom:hover {
    background-color: rgba(255, 255, 255, 0.1);
    transform: scale(1.05);
  }

  .scroll-to-bottom:active {
    transform: scale(0.95);
  }

  .scroll-to-bottom svg {
    color: var(--text-secondary);
  }

  /* Custom scrollbar for webkit browsers */
  .message-list::-webkit-scrollbar {
    width: 6px;
  }

  .message-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .message-list::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }

  .message-list::-webkit-scrollbar-thumb:hover {
    background-color: rgba(0, 0, 0, 0.3);
  }

  /* Dark mode scrollbar */
  @media (prefers-color-scheme: dark) {
    .message-list::-webkit-scrollbar-thumb {
      background-color: rgba(255, 255, 255, 0.2);
    }

    .message-list::-webkit-scrollbar-thumb:hover {
      background-color: rgba(255, 255, 255, 0.3);
    }
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .messages-container {
      padding: 12px 0;
    }

    .scroll-to-bottom {
      bottom: 16px;
      right: 16px;
      width: 40px;
      height: 40px;
    }
  }
</style>
