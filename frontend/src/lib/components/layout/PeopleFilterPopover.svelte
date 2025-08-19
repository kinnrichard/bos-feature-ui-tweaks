<script lang="ts">
  import CircularButton from '$lib/components/ui/CircularButton.svelte';
  import BasePopover from '$lib/components/ui/BasePopover.svelte';
  import { peopleSearch, peopleSearchActions } from '$lib/stores/peopleSearch.svelte';
  import { ReactivePeopleGroup } from '$lib/models/reactive-people-group';
  import { page } from '$app/stores';

  interface Props {
    disabled?: boolean;
  }

  const { disabled = false }: Props = $props();

  let isOpen = $state(false);

  // Get client ID from route
  const clientId = $derived($page.params.id);

  // Load groups and departments for this client
  const groupsQuery = $derived(
    clientId
      ? ReactivePeopleGroup.where({ client_id: clientId }).orderBy('name', 'asc').all()
      : null
  );
  const allGroups = $derived(groupsQuery?.data || []);
  const groups = $derived(allGroups.filter((g) => !g.is_department));
  const departments = $derived(allGroups.filter((g) => g.is_department));

  const filterCount = $derived(peopleSearch.activeFiltersCount);
  const hasActiveFilters = $derived(filterCount > 0);

  function resetFilters() {
    peopleSearchActions.resetFilters();
  }
</script>

<BasePopover bind:isOpen>
  <CircularButton
    slot="trigger"
    variant="default"
    size="normal"
    iconSrc="/icons/filter-{hasActiveFilters ? 'active' : 'inactive'}.svg"
    title={disabled ? 'Disabled' : 'Filter people'}
    {disabled}
    badgeCount={filterCount}
  />

  <div slot="content" class="filter-popover">
    <h3>Filter People</h3>

    <div class="filter-section">
      <label>
        <input
          type="checkbox"
          bind:checked={peopleSearch.showActiveOnly}
          onchange={() => peopleSearchActions.setShowActiveOnly(peopleSearch.showActiveOnly)}
        />
        Active only
      </label>
    </div>

    {#if departments.length > 0}
      <div class="filter-section">
        <label for="department-filter">Department</label>
        <select
          id="department-filter"
          bind:value={peopleSearch.selectedDepartmentId}
          onchange={(e) =>
            peopleSearchActions.setSelectedDepartmentId(e.currentTarget.value || null)}
        >
          <option value="">All departments</option>
          {#each departments as dept}
            <option value={dept.id}>{dept.name}</option>
          {/each}
        </select>
      </div>
    {/if}

    {#if groups.length > 0}
      <div class="filter-section">
        <label for="group-filter">Group</label>
        <select
          id="group-filter"
          bind:value={peopleSearch.selectedGroupId}
          onchange={(e) => peopleSearchActions.setSelectedGroupId(e.currentTarget.value || null)}
        >
          <option value="">All groups</option>
          {#each groups as group}
            <option value={group.id}>{group.name}</option>
          {/each}
        </select>
      </div>
    {/if}

    <div class="filter-actions">
      <button class="reset-button" onclick={resetFilters} disabled={!hasActiveFilters}>
        Reset Filters
      </button>
    </div>
  </div>
</BasePopover>

<style>
  .filter-popover {
    padding: 1rem;
    min-width: 200px;
  }

  h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .filter-section {
    margin-bottom: 1rem;
  }

  .filter-section label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .filter-section input[type='checkbox'] {
    margin-right: 0.5rem;
  }

  .filter-section select {
    width: 100%;
    padding: 0.5rem;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .filter-actions {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-primary);
  }

  .reset-button {
    width: 100%;
    padding: 0.5rem;
    background-color: var(--bg-tertiary);
    border: none;
    border-radius: 6px;
    color: var(--text-primary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: default;
    transition: opacity 0.2s;
  }

  .reset-button:hover:not(:disabled) {
    opacity: 0.8;
  }

  .reset-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
