<!--
  Talk Page - All conversations listing
  
  This page shows all conversations filtered to exclude closed ones.
  Uses ConversationsListView with ReactiveQuery for live updates.
-->

<script lang="ts">
  import ConversationsListView from '$lib/components/conversations/ConversationsListView.svelte';
  import AppLayout from '$lib/components/layout/AppLayout.svelte';
  import { ReactiveFrontConversation } from '$lib/models/reactive-front-conversation';
  import type { FrontConversationData } from '$lib/models/types/front-conversation-data';

  // Create reactive query for all conversations, filtering out closed ones
  const conversationsQuery = $derived(
    ReactiveFrontConversation.where({ status_category: 'open' })
      .orderBy('waiting_since_timestamp', 'desc')
      .all()
  );

  // Additional client-side filter if needed (should be redundant now)
  function filterOpenConversations(
    conversations: FrontConversationData[]
  ): FrontConversationData[] {
    return conversations.filter((conv) => conv.status_category === 'open');
  }
</script>

<svelte:head>
  <title>Talk - FAULTLESS</title>
</svelte:head>

<AppLayout>
  <ConversationsListView
    query={conversationsQuery}
    displayFilter={filterOpenConversations}
    title="All Talk"
    showClient={true}
    emptyMessage="No open talk found"
    emptyIcon="💬"
    noResultsMessage="No talk matches your criteria"
    noResultsDescription="All talk may be closed or archived."
    noResultsIcon="🔍"
    strategy="progressive"
  />
</AppLayout>
