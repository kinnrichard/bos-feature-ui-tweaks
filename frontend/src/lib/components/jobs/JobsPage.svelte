<script lang="ts">
  import { page } from '$app/stores';
  import { createJobsQuery } from '$lib/queries/jobs.svelte';
  import { createJobsFilter } from '$lib/filters/jobs.svelte';
  import { jobsSearch } from '$lib/stores/jobsSearch.svelte';
  import {
    getSelectedJobStatuses,
    getSelectedJobPriorities,
    getSelectedTechnicianIds,
  } from '$lib/stores/jobFilter.svelte';
  import { getCurrentUser } from '$lib/auth/current-user';
  import { ReactiveUser } from '$lib/models/reactive-user';
  import AppLayout from '$lib/components/layout/AppLayout.svelte';
  import JobsListView from '$lib/components/jobs/JobsListView.svelte';

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

  // Create the query using composable builders
  const query = $derived(createJobsQuery().all());

  // Get filter selections from store
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

  // Create the display filter
  const displayFilter = $derived(
    createJobsFilter({
      search: jobsSearch.searchQuery,
      statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      priorities: selectedPriorities.length > 0 ? selectedPriorities : undefined,
      technicianIds: selectedTechnicianIds().length > 0 ? selectedTechnicianIds() : undefined,
    })
  );

  // Page title based on filter
  const pageTitle = $derived(() => {
    switch (technicianParam) {
      case 'mine':
        return 'My Jobs';
      case 'others':
        return 'Other Jobs';
      case 'unassigned':
        return 'Unassigned Jobs';
      default:
        return 'Jobs';
    }
  });
</script>

<svelte:head>
  <title>{pageTitle()} - bŏs</title>
</svelte:head>

<AppLayout>
  <JobsListView {query} {displayFilter} title={pageTitle()} />
</AppLayout>

<style>
  @import '$lib/styles/jobs-shared.scss';
</style>
