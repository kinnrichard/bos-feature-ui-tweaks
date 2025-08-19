<!--
  Conversation Detail View - Apple-style message thread display
  
  Shows all messages in a conversation with iOS Messages-inspired UI.
  Includes real-time updates via ReactiveView.
-->

<script lang="ts">
  import type { PageData } from './$types';
  import AppLayout from '$lib/components/layout/AppLayout.svelte';
  import ConversationHeader from '$lib/components/conversations/ConversationHeader.svelte';
  import MessageList from '$lib/components/conversations/MessageList.svelte';
  import ReactiveView from '$lib/reactive/ReactiveView.svelte';
  import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Conversation - FAULTLESS</title>
</svelte:head>

<AppLayout showToolbar={false}>
  <div class="conversation-detail">
    <!-- Load conversation data and render everything inside -->
    <ReactiveView query={data.conversationQuery} strategy="immediate">
      {#snippet loading()}
        <div class="header-skeleton">
          <LoadingSkeleton type="text" width="200px" height="32px" />
        </div>
        <div class="message-list-container">
          <MessageList messages={[]} loading={true} conversation={null} />
        </div>
      {/snippet}

      {#snippet error({ error })}
        <div class="error-banner">
          <h2>Unable to load conversation</h2>
          <p>{error.message}</p>
        </div>
      {/snippet}

      {#snippet empty()}
        <div class="error-banner">
          <h2>Conversation not found</h2>
          <p>This conversation may have been deleted or you don't have access to it.</p>
        </div>
      {/snippet}

      {#snippet content({ data: conversation })}
        <ConversationHeader {conversation} />

        <!-- Message list container -->
        <div class="message-list-container">
          <ReactiveView query={data.messagesQuery} strategy="progressive">
            {#snippet loading()}
              <MessageList messages={[]} loading={true} {conversation} />
            {/snippet}

            {#snippet error({ error, refresh })}
              <div class="messages-error">
                <h3>Unable to load messages</h3>
                <p>{error.message}</p>
                <button onclick={refresh} class="retry-button">Retry</button>
              </div>
            {/snippet}

            {#snippet empty()}
              <MessageList messages={[]} {conversation} />
            {/snippet}

            {#snippet content({ data: messages })}
              <MessageList {messages} {conversation} />
            {/snippet}
          </ReactiveView>
        </div>
      {/snippet}
    </ReactiveView>

    <!-- Message input area (placeholder for future implementation) -->
    <div class="message-input-area">
      <div class="input-container">
        <button class="attach-button" aria-label="Attach file">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <div class="input-wrapper">
          <input type="text" placeholder="Type a message..." class="message-input" disabled />
        </div>

        <button class="send-button active" disabled aria-label="Send message">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</AppLayout>

<style>
  .conversation-detail {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background-color: var(--bg-black);
    overflow: hidden;
  }

  /* Make ReactiveView wrappers participate in flex layout */
  .conversation-detail > :global(.reactive-view__content) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  /* Header skeleton */
  .header-skeleton {
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    border-bottom: 1px solid var(--border-primary);
  }

  /* Error states */
  .error-banner {
    padding: 24px;
    text-align: center;
    border-bottom: 1px solid var(--border-primary);
  }

  .error-banner h2 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px 0;
  }

  .error-banner p {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0;
  }

  /* Message list container */
  .message-list-container {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0; /* Important for flex children */
  }

  /* Make ReactiveView containers flex properly */
  .message-list-container :global(.reactive-view__content) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .messages-error {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
  }

  .messages-error h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px 0;
  }

  .messages-error p {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0 0 16px 0;
  }

  .retry-button {
    background-color: var(--accent-blue);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .retry-button:hover {
    background-color: var(--accent-blue-hover);
  }

  /* Message input area */
  .message-input-area {
    border-top: 0.5px solid rgba(255, 255, 255, 0.1);
    background-color: var(--bg-black);
    padding: 12px 16px;
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  .input-container {
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .attach-button,
  .send-button {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 50%;
    transition: background-color 0.2s;
    flex-shrink: 0;
  }

  .attach-button:hover:not(:disabled),
  .send-button:hover:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .attach-button:disabled,
  .send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Active send button when message is ready */
  .send-button.active:not(:disabled) {
    background-color: var(--accent-blue);
    color: white;
  }

  .send-button.active:not(:disabled):hover {
    background-color: var(--accent-blue-hover);
  }

  .input-wrapper {
    flex: 1;
  }

  .message-input {
    width: 100%;
    padding: 8px 16px;
    background-color: var(--bg-tertiary);
    border: 1px solid var(--bg-tertiary);
    border-radius: 20px;
    font-size: 16px;
    color: var(--text-primary);
    outline: none;
    transition: all 0.2s;
  }

  .message-input:focus {
    border-color: var(--accent-blue);
  }

  .message-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .message-input::placeholder {
    color: var(--text-tertiary);
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .header-skeleton {
      height: 56px;
    }

    .message-input-area {
      padding: 8px 12px;
      padding-bottom: calc(8px + env(safe-area-inset-bottom));
    }

    .attach-button,
    .send-button {
      width: 32px;
      height: 32px;
    }

    .message-input {
      font-size: 15px;
      padding: 6px 14px;
    }
  }
</style>
