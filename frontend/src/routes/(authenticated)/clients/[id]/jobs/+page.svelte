<!--
  Client Jobs Index Page
  
  Displays all jobs for a specific client using the composable architecture
  EP-0018: DRY Jobs Pages with Composable Architecture
-->

<script lang="ts">
  import { page } from '$app/stores';
  import { ReactiveClient } from '$lib/models/reactive-client';
  import { ReactiveUser } from '$lib/models/reactive-user';
  import { createJobsQuery, withClientFilter } from '$lib/queries/jobs.svelte';
  import { createJobsFilter } from '$lib/filters/jobs.svelte';
  import { jobsSearch } from '$lib/stores/jobsSearch.svelte';
  import {
    getSelectedJobStatuses,
    getSelectedJobPriorities,
    getSelectedTechnicianIds,
  } from '$lib/stores/jobFilter.svelte';
  import { getCurrentUser } from '$lib/auth/current-user';
  import AppLayout from '$lib/components/layout/AppLayout.svelte';
  import JobsListView from '$lib/components/jobs/JobsListView.svelte';
  import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';

  // Get client ID from URL
  const clientId = $derived($page.params.id);

  // Query for the client
  const clientQuery = $derived(clientId ? ReactiveClient.find(clientId) : null);
  const client = $derived(clientQuery?.data);
  const clientError = $derived(clientQuery?.error);

  // Get current user for "mine" and "others" filters
  const currentUser = getCurrentUser();

  // Get technician filter from query params
  const technicianParam = $derived($page.url.searchParams.get('technician'));

  // Get all technicians for "others" filter
  const allTechniciansQuery = $derived(
    technicianParam === 'others'
      ? ReactiveUser.all()
          .where('role', 'IN', ['technician', 'admin', 'owner'])
          .orderBy('name', 'asc')
          .all()
      : null
  );
  const allTechnicians = $derived(allTechniciansQuery?.data || []);

  // Create jobs query with client filter using composable builders
  const jobsQuery = $derived(clientId ? withClientFilter(createJobsQuery(), clientId).all() : null);

  // Get filter selections
  const selectedStatuses = $derived(getSelectedJobStatuses());
  const selectedPriorities = $derived(getSelectedJobPriorities());
  const storedTechnicianIds = $derived(getSelectedTechnicianIds());

  // Determine technician filters based on query param or stored selection
  const selectedTechnicianIds = $derived(() => {
    if (!technicianParam) {
      // No query param, use stored selection from filter store
      return storedTechnicianIds;
    }

    switch (technicianParam) {
      case 'mine':
        return currentUser ? [currentUser.short_name || currentUser.id] : [];
      case 'others':
        // All technicians except current user
        return currentUser
          ? allTechnicians.filter((t) => t.id !== currentUser.id).map((t) => t.short_name || t.id)
          : [];
      case 'unassigned':
        return ['not_assigned'];
      default:
        // Parse comma-separated values (should be short_names)
        return technicianParam.split(',');
    }
  });

  // Create the display filter from filter store selections
  const displayFilter = $derived(
    createJobsFilter({
      search: jobsSearch.searchQuery,
      // Use filter store selections - empty array means show all
      statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      priorities: selectedPriorities.length > 0 ? selectedPriorities : undefined,
      technicianIds: selectedTechnicianIds().length > 0 ? selectedTechnicianIds() : undefined,
    })
  );

  // Page title
  const pageTitle = $derived(client ? `${client.name}'s Jobs - bŏs` : 'Client Jobs - bŏs');
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<AppLayout currentClient={client}>
  {#if clientError}
    <!-- Show client error state -->
    <div class="error-state">
      <h2>Unable to load client</h2>
      <p>{clientError.message}</p>
      <button onclick={() => window.location.reload()} class="retry-button">Retry</button>
    </div>
  {:else if jobsQuery}
    <!-- Show jobs with JobsListView -->
    <JobsListView
      query={jobsQuery}
      {displayFilter}
      showClient={false}
      title={client ? `Jobs for ${client.name}` : 'Client Jobs'}
      emptyMessage="No jobs yet for this client"
    />
  {:else}
    <!-- Loading client -->
    <div class="loading-container">
      <LoadingSkeleton type="job-card" count={6} />
    </div>
  {/if}
</AppLayout>

<style>
  @import '$lib/styles/jobs-shared.scss';

  /* Client error state specific styles */
  .error-state {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-height: 200px;
    padding: 32px;
    text-align: center;
  }

  .error-state h2 {
    color: var(--text-primary);
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 8px 0;
  }

  .error-state p {
    color: var(--text-secondary);
    font-size: 14px;
    margin: 0 0 16px 0;
  }

  .retry-button {
    padding: 8px 16px;
    background-color: var(--accent-blue);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: default;
    transition: background-color 0.2s ease;
  }

  .retry-button:hover {
    background-color: var(--accent-blue-hover, #0051d5);
  }

  /* Loading container */
  .loading-container {
    padding: 24px;
  }
</style>
