<!--
  Client Talk Page - Client-specific talk listing
  
  This page shows talk for a specific client, filtered to exclude closed ones.
  Uses ConversationsListView with ReactiveQuery for live updates.
  
  Epic-010: Uses ReactiveClient.includes('frontConversations') pattern for client-specific filtering
-->

<script lang="ts">
  import { page } from '$app/stores';
  import ConversationsListView from '$lib/components/conversations/ConversationsListView.svelte';
  import AppLayout from '$lib/components/layout/AppLayout.svelte';
  import { ReactiveClient } from '$lib/models/reactive-client';
  import { ReactiveClientFrontConversation } from '$lib/models/reactive-client-front-conversation';
  import { ReactiveFrontConversation } from '$lib/models/reactive-front-conversation';
  import type { FrontConversationData } from '$lib/models/types/front-conversation-data';

  // Get client ID from route params
  const clientId = $derived($page.params.id);

  // Get client info for page title
  const clientQuery = $derived(ReactiveClient.find(clientId));

  // Query the join table to get conversation IDs for this client
  // Epic-010: Zero.js many-to-many pattern - query join table first
  const joinTableQuery = $derived(
    ReactiveClientFrontConversation.where({ client_id: clientId }).all()
  );

  // Extract conversation IDs from join table records
  const conversationIds = $derived(
    joinTableQuery.data?.map((record) => record.front_conversation_id) || []
  );

  // Query all open conversations directly
  // Epic-010: Using displayFilter pattern for client-side filtering
  const conversationsQuery = $derived(
    ReactiveFrontConversation.where({ status_category: 'open' })
      .orderBy('waiting_since_timestamp', 'desc')
      .all()
  );

  // Client-side filter function for conversations
  // This follows the pattern used in /conversations and /jobs pages
  function filterClientConversations(
    conversations: FrontConversationData[]
  ): FrontConversationData[] {
    // If join table hasn't loaded yet or no conversations for client, return empty
    if (joinTableQuery.isLoading || conversationIds.length === 0) {
      return [];
    }
    // Filter to only include conversations that belong to this client
    return conversations.filter((conv) => conversationIds.includes(conv.id));
  }

  // Get client name for title with error handling
  const clientName = $derived.by(() => {
    if (clientQuery.error) return 'Error Loading Client';
    if (clientQuery.isLoading) return 'Loading...';
    return clientQuery.data?.name || 'Unknown Client';
  });

  const pageTitle = $derived(`${clientName} - Talk`);

  // Handle client not found error
  // Distinguishes between loading states and actual missing client
  const clientNotFound = $derived(clientQuery.resultType === 'complete' && !clientQuery.data);
</script>

<svelte:head>
  <title>{pageTitle} - FAULTLESS</title>
</svelte:head>

<AppLayout currentClient={clientQuery.data}>
  {#if clientNotFound}
    <div class="error-state">
      <div class="error-content">
        <span class="error-icon">❌</span>
        <h2>Client Not Found</h2>
        <p>The client with ID "{clientId}" could not be found.</p>
        <p>It may have been deleted or you may not have permission to view it.</p>
      </div>
    </div>
  {:else if clientQuery.error}
    <div class="error-state">
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <h2>Error Loading Client</h2>
        <p>There was an error loading the client: {clientQuery.error.message}</p>
        <button onclick={() => clientQuery.refresh()} class="retry-button"> Try Again </button>
      </div>
    </div>
  {:else}
    <ConversationsListView
      query={conversationsQuery}
      displayFilter={filterClientConversations}
      title="{clientName} Talk"
      emptyMessage="No open talk found for this client"
      emptyIcon="💬"
      noResultsMessage="No open talk matches your criteria"
      noResultsDescription="This client may not have any open talk at the moment."
      noResultsIcon="🔍"
      strategy="progressive"
    />
  {/if}
</AppLayout>

<style>
  .error-state {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 60vh;
    padding: 2rem;
  }

  .error-content {
    text-align: center;
    max-width: 400px;
  }

  .error-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 1rem;
  }

  .error-content h2 {
    margin-bottom: 1rem;
    color: var(--color-text-primary);
  }

  .error-content p {
    margin-bottom: 1rem;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .retry-button {
    padding: 0.75rem 1.5rem;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 1rem;
    transition: background-color 0.2s;
  }

  .retry-button:hover {
    background: var(--color-primary-dark);
  }
</style>
