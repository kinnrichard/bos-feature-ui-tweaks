<!--
  ConversationsListView - Presentation component for conversation listings
  
  This component handles the presentation layer for conversation listings,
  integrating with ReactiveView and providing a consistent UI
  across all conversation listing contexts.
-->

<script lang="ts">
  import type { ReactiveQuery } from '$lib/models/base/types';
  import type { FrontConversationData } from '$lib/models/types/front-conversation-data';
  import type { Snippet } from 'svelte';
  import ReactiveView from '$lib/reactive/ReactiveView.svelte';
  import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
  import ConversationCard from '$lib/components/conversations/ConversationCard.svelte';
  import {
    groupConversationsByMonth,
    shouldUseCompactMode,
  } from '$lib/utils/conversation-grouping';

  interface Props {
    /**
     * The reactive query to fetch conversations
     */
    query: ReactiveQuery<FrontConversationData[]>;

    /**
     * Optional display filter to apply to loaded conversations
     * Defaults to identity function (no filtering)
     */
    displayFilter?: (conversations: FrontConversationData[]) => FrontConversationData[];

    /**
     * Optional title for the page
     */
    title?: string;

    /**
     * Optional snippet for additional header content
     */
    headerContent?: Snippet;

    /**
     * Optional loading message
     */
    loadingMessage?: string;

    /**
     * Optional empty state message
     */
    emptyMessage?: string;

    /**
     * Optional empty state icon
     */
    emptyIcon?: string;

    /**
     * Optional no results message (when filtered results are empty)
     */
    noResultsMessage?: string;

    /**
     * Optional no results description
     */
    noResultsDescription?: string;

    /**
     * Optional no results icon
     */
    noResultsIcon?: string;

    /**
     * Loading strategy for ReactiveView
     */
    strategy?: 'progressive' | 'immediate';
  }

  let {
    query,
    displayFilter = (conversations) => conversations,
    title,
    headerContent,
    emptyMessage = 'No conversations found',
    emptyIcon = '💬',
    noResultsMessage = 'No conversations match your filters',
    noResultsDescription = 'Try adjusting your filters or search criteria.',
    noResultsIcon = '🔍',
    strategy = 'progressive',
  }: Props = $props();
</script>

<div class="conversations-page">
  {#if title}
    <div class="page-header">
      <h1>{title}</h1>
      {#if headerContent}
        {@render headerContent()}
      {/if}
    </div>
  {/if}

  <div class="conversations-content">
    <ReactiveView {query} {strategy}>
      {#snippet loading()}
        <LoadingSkeleton type="conversation-card" count={6} />
      {/snippet}

      {#snippet error({ error, refresh })}
        <div class="error-state">
          <h2>Unable to load conversations</h2>
          <p>{error.message}</p>
          <button onclick={refresh} class="retry-button">Retry</button>
        </div>
      {/snippet}

      {#snippet empty()}
        <div class="empty-state">
          <div class="empty-state-icon">{emptyIcon}</div>
          <h2>{emptyMessage}</h2>
        </div>
      {/snippet}

      {#snippet content({ data })}
        {@const filteredConversations = displayFilter(data)}
        {@const monthSections = groupConversationsByMonth(filteredConversations)}
        {@const isCompactMode = shouldUseCompactMode(filteredConversations)}

        {#if filteredConversations.length === 0}
          <div class="empty-state">
            <div class="empty-state-icon">{noResultsIcon}</div>
            <h2>{noResultsMessage}</h2>
            {#if noResultsDescription}
              <p>{noResultsDescription}</p>
            {/if}
          </div>
        {:else}
          <div class="conversations-list" class:compact-mode={isCompactMode}>
            {#each monthSections as section (section.key)}
              <div class="month-section">
                <div class="section-header">
                  <h3 class="section-title">{section.title}</h3>
                  <span class="section-count">{section.conversations.length}</span>
                </div>
                <div class="section-conversations">
                  {#each section.conversations as conversation (conversation.id)}
                    <ConversationCard {conversation} />
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/snippet}
    </ReactiveView>
  </div>
</div>

<style>
  .conversations-page {
    min-height: 100%;
    background-color: var(--bg-black, #000);
  }

  /* Page Header */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 24px;
  }

  .page-header :global(h1) {
    font-size: 32px;
    font-weight: 600;
    color: #f2f2f7 !important;
    margin: 0;
  }

  /* Content Area */
  .conversations-content {
    padding: 24px 24px 12px 24px;
    max-width: 1200px;
    margin: 0 auto;
  }

  /* Conversations list container */
  .conversations-list {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Month section */
  .month-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Section header */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;
    margin-bottom: 4px;
  }

  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary, #1d1d1f);
    margin: 0;
    flex: 1;
  }

  .section-count {
    margin-left: auto;
    background-color: var(--bg-tertiary);
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 12px;
    min-width: 24px;
    text-align: center;
    display: inline-block;
  }

  /* Section conversations container */
  .section-conversations {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Compact mode styles - applied when 7+ conversations */
  .conversations-list.compact-mode .section-conversations {
    gap: 0;
  }

  /* Reduce padding and remove individual borders in compact mode */
  .conversations-list.compact-mode .section-conversations :global(.conversation-card-inline) {
    padding-top: 8px;
    padding-bottom: 8px;
    border-radius: 0;
    border-bottom: none;
  }

  /* First card gets top rounded corners */
  .conversations-list.compact-mode
    .section-conversations
    :global(.conversation-card-inline:first-child) {
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }

  /* Last card gets bottom rounded corners and bottom border */
  .conversations-list.compact-mode
    .section-conversations
    :global(.conversation-card-inline:last-child) {
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
    border-bottom: 1px solid var(--border-primary);
  }

  /* Add subtle separator between cards in compact mode */
  .conversations-list.compact-mode
    .section-conversations
    :global(.conversation-card-inline:not(:last-child))::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 16px;
    right: 16px;
    height: 1px;
    background-color: var(--border-secondary, rgba(0, 0, 0, 0.05));
  }

  /* Make conversation cards position relative for the separator */
  .conversations-list.compact-mode .section-conversations :global(.conversation-card-inline) {
    position: relative;
  }

  /* Error state */
  .error-state {
    text-align: center;
    padding: 40px 20px;
  }

  .error-state h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 12px 0;
  }

  .error-state p {
    color: var(--text-secondary);
    margin: 0 0 20px 0;
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

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 40px 20px;
  }

  .empty-state-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty-state h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px 0;
  }

  .empty-state p {
    color: var(--text-secondary);
    margin: 0;
  }

  /* Responsive layout */
  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      gap: 16px;
      align-items: stretch;
    }

    .conversations-content {
      padding: 16px 16px 12px 16px;
    }

    .conversations-list {
      gap: 20px;
    }

    .section-header {
      padding: 0;
    }

    .section-title {
      font-size: 15px;
    }

    .section-count {
      font-size: 11px;
      padding: 1px 6px;
    }

    .section-conversations {
      gap: 10px;
    }

    /* Compact mode on mobile */
    .conversations-list.compact-mode .section-conversations {
      gap: 0;
    }

    .conversations-list.compact-mode .section-conversations :global(.conversation-card-inline) {
      padding-top: 6px;
      padding-bottom: 6px;
    }
  }

  @media (max-width: 480px) {
    .conversations-content {
      padding: 12px 12px 12px 12px;
    }
  }
</style>
