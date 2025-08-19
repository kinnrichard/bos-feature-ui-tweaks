<!--
  Clients Listing Page
  
  Displays all clients alphabetically
  Allows navigation to individual client details
-->

<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { ReactiveQuery } from '$lib/zero/reactive-query-unified.svelte';
  import { getZero } from '$lib/zero';
  import AppLayout from '$lib/components/layout/AppLayout.svelte';
  import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
  import {
    clientsSearch,
    clientsSearchActions,
    shouldShowClient,
  } from '$lib/stores/clientsSearch.svelte';

  // Create reactive query for all clients ordered alphabetically
  const clientsQuery = new ReactiveQuery(
    () => {
      const zero = getZero();
      if (!zero || !zero.query) return null;

      // Get all clients ordered by name
      return zero.query.clients.orderBy('name', 'asc');
    },
    { expectsCollection: true }
  );

  // Get query state
  const clients = $derived(clientsQuery.records || []);
  const isLoading = $derived(clientsQuery.isLoading);
  const error = $derived(clientsQuery.error);

  // Filter clients based on search
  const filteredClients = $derived(clients.filter((client) => shouldShowClient(client)));

  // Group filtered clients by first letter
  const groupedClients = $derived.by(() => {
    const groups: Record<string, typeof clients> = {};

    for (const client of filteredClients) {
      const firstLetter = (client.name || 'Unknown').charAt(0).toUpperCase();
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(client);
    }

    // Sort the keys alphabetically
    const sortedGroups: Record<string, typeof clients> = {};
    Object.keys(groups)
      .sort()
      .forEach((key) => {
        sortedGroups[key] = groups[key];
      });

    return sortedGroups;
  });

  // Navigate to client detail page
  function navigateToClient(clientId: string) {
    clearTimeout(debounceTimer); // Cancel any pending URL update
    updateUrlNow(); // Force URL update before navigating
    // Small delay to ensure URL update completes
    setTimeout(() => {
      goto(`/clients/${clientId}`);
    }, 0);
  }

  // Navigate to new client creation
  function createNewClient() {
    clearTimeout(debounceTimer); // Cancel any pending URL update
    updateUrlNow(); // Force URL update before navigating
    // Small delay to ensure URL update completes
    setTimeout(() => {
      goto('/clients/new');
    }, 0);
  }

  // Helper to get client type emoji
  function getClientTypeEmoji(type: string | null | undefined): string {
    switch (type) {
      case 'business':
        return '🏢';
      case 'residential':
        return '🏠';
      default:
        return '👤';
    }
  }

  // URL parameter handling
  $effect(() => {
    const searchQuery = $page.url.searchParams.get('q');
    if (searchQuery && !clientsSearch.searchQuery) {
      clientsSearchActions.setSearchQuery(searchQuery);
    }
  });

  // Debounced URL updates
  let debounceTimer: number;

  // Helper to update URL immediately
  function updateUrlNow() {
    const url = new URL($page.url);

    if (clientsSearch.searchQuery) {
      url.searchParams.set('q', clientsSearch.searchQuery);
    } else {
      url.searchParams.delete('q');
    }

    goto(url.toString(), {
      replaceState: true,
      keepFocus: true,
      noScroll: true,
    });
  }

  // Debounced URL update effect
  $effect(() => {
    // Only update URL if we're on the clients page
    if ($page.route.id === '/(authenticated)/clients') {
      clearTimeout(debounceTimer);

      debounceTimer = setTimeout(() => {
        updateUrlNow();
      }, 300); // 300ms debounce
    }
  });

  // Clean up timer on unmount
  $effect(() => {
    return () => {
      clearTimeout(debounceTimer);
    };
  });
</script>

<svelte:head>
  <title>Clients - Faultless</title>
</svelte:head>

<AppLayout>
  <div class="clients-page">
    <!-- Page Header -->
    <div class="page-header">
      <h1>Clients</h1>
    </div>

    <!-- Content Area -->
    <div class="clients-content">
      {#if isLoading}
        <div class="loading-state">
          <LoadingSkeleton type="list" />
        </div>
      {:else if error}
        <div class="error-state">
          <p>Error loading clients. Please try again.</p>
        </div>
      {:else if clients.length === 0}
        <div class="empty-state">
          <p class="empty-message">No clients yet</p>
          <button class="empty-action-button" onclick={createNewClient}>
            <span class="button-icon">➕</span>
            Create Your First Client
          </button>
        </div>
      {:else if filteredClients.length === 0}
        <div class="empty-state">
          <p class="empty-message">No clients match your search</p>
        </div>
      {:else if filteredClients.length <= 6}
        <!-- Simple list for 6 or fewer clients -->
        <div class="clients-simple-list">
          {#each filteredClients as client (client.id)}
            <button class="client-item" onclick={() => navigateToClient(client.id)}>
              <span class="client-icon">{getClientTypeEmoji(client.client_type)}</span>
              <span class="client-name">{client.name || 'Unnamed Client'}</span>
            </button>
          {/each}
        </div>
      {:else}
        <!-- Grouped list for more than 6 clients -->
        <div class="clients-list">
          {#each Object.entries(groupedClients) as [letter, letterClients]}
            <div class="letter-group">
              <h2 class="letter-header">{letter}</h2>
              <div class="letter-clients">
                {#each letterClients as client (client.id)}
                  <button class="client-item" onclick={() => navigateToClient(client.id)}>
                    <span class="client-icon">{getClientTypeEmoji(client.client_type)}</span>
                    <span class="client-name">{client.name || 'Unnamed Client'}</span>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</AppLayout>

<style>
  .clients-page {
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

  .page-header h1 {
    font-size: 32px;
    font-weight: 600;
    color: var(--text-primary, #f2f2f7);
    margin: 0;
  }

  .new-client-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background-color: var(--accent-blue, #00a3ff);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.15s ease;
  }

  .new-client-button:hover {
    background-color: var(--accent-blue-hover, #0089e0);
  }

  .button-icon {
    font-size: 16px;
  }

  /* Content Area */
  .clients-content {
    padding: 24px 24px 12px 24px;
    max-width: 1200px;
    margin: 0 auto;
  }

  /* Simple list for 6 or fewer clients */
  .clients-simple-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 600px;
    margin: 0 auto;
  }

  /* Client List */
  .clients-list {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .letter-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .letter-header {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-secondary, #c7c7cc);
    margin: 0;
    padding: 0 16px;
  }

  .letter-clients {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 12px;
    align-content: start;
  }

  .client-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    background-color: var(--bg-secondary, #1c1c1d);
    border: 1px solid var(--border-primary, #38383a);
    border-radius: 8px;
    color: var(--text-primary, #f2f2f7);
    font-size: 16px;
    font-weight: 400;
    text-align: left;
    transition: all 0.15s ease;
    width: 100%;
  }

  .client-item:active {
    background-color: var(--bg-quaternary, #48484a);
  }

  .client-icon {
    font-size: 20px;
    width: 24px;
    text-align: center;
    flex-shrink: 0;
  }

  .client-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* States */
  .loading-state,
  .error-state {
    text-align: center;
    padding: 80px 20px;
    color: var(--text-secondary, #c7c7cc);
  }

  .empty-state {
    text-align: center;
    padding: 80px 20px;
  }

  .empty-message {
    font-size: 18px;
    color: var(--text-secondary, #c7c7cc);
    margin-bottom: 24px;
  }

  .empty-action-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background-color: var(--accent-blue, #00a3ff);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    transition: all 0.15s ease;
  }

  .empty-action-button:hover {
    background-color: var(--accent-blue-hover, #0089e0);
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      gap: 16px;
      align-items: stretch;
    }

    .new-client-button {
      justify-content: center;
    }

    .letter-clients {
      grid-template-columns: 1fr;
    }
  }
</style>
