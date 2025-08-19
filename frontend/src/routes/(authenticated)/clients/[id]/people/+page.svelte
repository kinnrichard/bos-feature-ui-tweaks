<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import AppLayout from '$lib/components/layout/AppLayout.svelte';
  import PersonAvatar from '$lib/components/ui/PersonAvatar.svelte';
  import { peopleSearch, shouldShowPerson } from '$lib/stores/peopleSearch.svelte';
  import { ReactivePerson } from '$lib/models/reactive-person';
  import { ReactiveClient } from '$lib/models/reactive-client';

  // Icon paths
  const PersonIcon = '/icons/person.circle.fill.svg';
  const ChevronIcon = '/icons/chevron-right.svg';

  let clientId = $page.params.id;

  // Load client to ensure it exists
  const clientQuery = $derived(ReactiveClient.find(clientId));
  const client = $derived(clientQuery?.data);

  // Load people for this client
  const peopleQuery = $derived(
    ReactivePerson.includes('contactMethods')
      .where({ client_id: clientId })
      .orderBy('name', 'asc')
      .all()
  );

  // Get all people for the client
  const allPeople = $derived(peopleQuery?.data || []);

  // Apply client-side filtering
  const people = $derived(allPeople.filter((person) => shouldShowPerson(person)));

  // Loading and error states
  const loading = $derived(peopleQuery?.isLoading || clientQuery?.isLoading || false);
  const error = $derived(peopleQuery?.error || clientQuery?.error);

  // Navigate to person details
  function navigateToPerson(personId: string) {
    goto(`/clients/${clientId}/people/${personId}`);
  }
</script>

<AppLayout currentClient={client}>
  <div class="people-page">
    <!-- Page Header -->
    <div class="page-header">
      <h1>People at {client?.name || 'Client'}</h1>
    </div>

    <!-- People List -->
    <div class="people-list">
      {#if loading}
        <div class="loading-state">
          <p>Loading people...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <div class="icon" aria-hidden="true">
            <img src="/icons/caution-triangle-yellow.svg" alt="" />
          </div>
          <p>{error.message || 'Failed to load people'}</p>
        </div>
      {:else if people.length === 0}
        <div class="empty-state">
          <div class="icon" aria-hidden="true"><img src={PersonIcon} alt="" /></div>
          <p>No people found</p>
          {#if peopleSearch.searchQuery || peopleSearch.activeFiltersCount > 0}
            <button onclick={() => window.location.reload()}>Clear filters</button>
          {/if}
        </div>
      {:else}
        {#each people as person}
          <button class="person-row" onclick={() => navigateToPerson(person.id)} type="button">
            <PersonAvatar name={person.name} size="medium" />

            <div class="person-info">
              <div class="person-header">
                <div class="person-name">
                  {person.name_preferred || person.name}
                  {#if person.name_pronunciation_hint}
                    <span class="pronunciation">({person.name_pronunciation_hint})</span>
                  {/if}
                </div>
                {#if !person.is_active}
                  <span class="inactive-badge">Inactive</span>
                {/if}
              </div>

              {#if person.title}
                <div class="person-title">{person.title}</div>
              {/if}
            </div>

            <div class="chevron-icon" aria-hidden="true">
              <img src={ChevronIcon} alt="" />
            </div>
          </button>
        {/each}
      {/if}
    </div>
  </div>
</AppLayout>

<style>
  .people-page {
    padding: 0 24px 12px 24px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .page-header {
    margin-bottom: 24px;
  }

  .page-header h1 {
    font-size: 28px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .people-list {
    background-color: var(--card-background);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .person-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-radius: 8px;
    cursor: default;
    transition: all 0.2s ease;
    position: relative;
  }

  .person-row:not(:first-child) {
    margin-top: 16px; /* Add spacing between rows, but not above the first */
  }

  .person-row::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 4.5rem;
    right: 1rem;
    height: 1px;
    background-color: var(--border-color);
  }

  .person-row:last-child::after {
    display: none;
  }

  /* Hover effect removed */

  /* Remove old person-icon styles as we're using PersonAvatar */

  .person-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .person-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .person-name {
    font-weight: 600;
    font-size: 1rem;
    color: var(--text-color);
    line-height: 1.4;
  }

  .pronunciation {
    font-size: 0.9rem;
    color: var(--secondary-text-color);
    font-weight: normal;
  }

  .person-title {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .inactive-badge {
    background-color: var(--bg-warning);
    color: var(--text-warning);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  /* Remove old contact-info style */

  .chevron-icon {
    width: 20px;
    height: 20px;
    color: var(--secondary-text-color);
    flex-shrink: 0;
  }

  .loading-state,
  .error-state,
  .empty-state {
    padding: 3rem 1rem;
    text-align: center;
    color: var(--secondary-text-color);
  }

  .error-state .icon,
  .empty-state .icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 1rem;
    opacity: 0.5;
  }

  .error-state .icon img,
  .empty-state .icon img {
    width: 100%;
    height: 100%;
  }

  .error-state .icon {
    color: var(--error-color);
  }

  .empty-state button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: default;
    font-size: 0.95rem;
  }
</style>
