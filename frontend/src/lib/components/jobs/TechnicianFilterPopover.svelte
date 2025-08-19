<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import BasePopover from '$lib/components/ui/BasePopover.svelte';
  import PopoverMenu from '$lib/components/ui/PopoverMenu.svelte';
  import TechnicianButton from '$lib/components/ui/TechnicianButton.svelte';
  import UserAvatar from '$lib/components/ui/UserAvatar.svelte';
  import { ReactiveUser } from '$lib/models/reactive-user';
  import { getCurrentUser } from '$lib/auth/current-user';
  import '$lib/styles/popover-common.css';

  interface Props {
    selected: string[];
    onFilterChange: (selected: string[]) => void;
    disabled?: boolean;
  }

  let { selected = [], onFilterChange, disabled = false }: Props = $props();

  const currentUser = getCurrentUser();
  const currentUrl = $derived($page.url);

  // Query for all users that can be assigned as technicians
  // Note: Using all() and filtering client-side since where() doesn't support array filters
  const usersQuery = ReactiveUser.all().orderBy('name', 'asc').all();

  // Filter to only include users who can be technicians
  const allUsers = $derived(usersQuery.data || []);
  const technicians = $derived(
    Array.isArray(allUsers)
      ? allUsers.filter(
          (user) => user.role === 'technician' || user.role === 'admin' || user.role === 'owner'
        )
      : []
  );

  // Determine effective selection based on query param or props
  const effectiveSelection = $derived(() => {
    const technicianParam = currentUrl.searchParams.get('technician');

    if (!technicianParam) return selected;

    switch (technicianParam) {
      case 'mine':
        return currentUser ? [`technician:${currentUser.id}`] : [];
      case 'others':
        // All technicians except current user
        return currentUser
          ? technicians.filter((t) => t.id !== currentUser.id).map((t) => `technician:${t.id}`)
          : [];
      case 'unassigned':
        return ['technician:not_assigned'];
      default:
        // Parse comma-separated values (short_names)
        return technicianParam.split(',').map((value) => {
          if (value === 'not_assigned') {
            return 'technician:not_assigned';
          }
          // Find technician by short_name to get their ID for selection tracking
          const tech = technicians.find((t) => t.short_name === value);
          return tech ? `technician:${tech.id}` : `technician:${value}`;
        });
    }
  });

  // Parse selected technicians
  const selectedTechnicianIds = $derived(
    effectiveSelection()
      .filter((id) => id.startsWith('technician:') && id !== 'technician:not_assigned')
      .map((id) => id.replace('technician:', ''))
  );

  const isNotAssignedSelected = $derived(effectiveSelection().includes('technician:not_assigned'));

  const selectedTechnicians = $derived(
    technicians
      .filter((tech) => selectedTechnicianIds.includes(tech.id))
      .sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''))
  );

  // Create filter options with icons
  const menuOptions = $derived([
    // Title
    { id: 'title', value: 'title', label: 'Filter by Technician', header: true },
    // Not Assigned option (icon rendered via iconContent snippet)
    {
      id: 'technician:not_assigned',
      value: 'technician:not_assigned',
      label: 'Not Assigned',
    },
    // Divider
    { id: 'divider', value: 'divider', label: '', divider: true },
    // Technician options with user data for avatar display
    ...technicians.map((technician) => ({
      id: `technician:${technician.id}`,
      value: `technician:${technician.id}`,
      label: technician.name || technician.email || `User ${technician.id}`,
      user: technician, // Include for avatar display in iconContent snippet
    })),
  ]);

  async function handleSelect(value: string | undefined) {
    if (!value || value === 'title' || value === 'divider') return;

    const isCurrentlySelected = effectiveSelection().includes(value);
    let newSelection: string[];

    if (isCurrentlySelected) {
      // Remove from selection
      newSelection = effectiveSelection().filter((id) => id !== value);
    } else {
      // Add to selection
      newSelection = [...effectiveSelection(), value];
    }

    // Build new URL with appropriate query params
    const url = new URL(currentUrl);

    if (newSelection.length === 0) {
      // No selection, remove technician param
      url.searchParams.delete('technician');
    } else if (
      currentUser &&
      newSelection.length === 1 &&
      newSelection[0] === `technician:${currentUser.id}`
    ) {
      // Only current user selected
      url.searchParams.set('technician', 'mine');
    } else if (newSelection.length === 1 && newSelection[0] === 'technician:not_assigned') {
      // Only not assigned selected
      url.searchParams.set('technician', 'unassigned');
    } else {
      // Check if all other technicians are selected
      const technicianSelections = newSelection.filter(
        (id) => id.startsWith('technician:') && id !== 'technician:not_assigned'
      );
      const selectedTechIds = technicianSelections.map((id) => id.replace('technician:', ''));
      const allOtherTechIds = technicians
        .filter((t) => currentUser && t.id !== currentUser.id)
        .map((t) => t.id);

      if (
        currentUser &&
        selectedTechIds.length === allOtherTechIds.length &&
        selectedTechIds.every((id) => allOtherTechIds.includes(id))
      ) {
        url.searchParams.set('technician', 'others');
      } else {
        // Custom selection - use comma-separated short_names
        const shortNames = newSelection.map((id) => {
          if (id === 'technician:not_assigned') {
            return 'not_assigned';
          }
          const techId = id.replace('technician:', '');
          const tech = technicians.find((t) => t.id === techId);
          return tech?.short_name || techId; // Fallback to ID if no short_name
        });
        url.searchParams.set('technician', shortNames.join(','));
      }
    }

    // Navigate to the new URL
    await goto(url.toString());

    // Also update the filter store for non-query-param handling
    onFilterChange(newSelection);
  }

  const hasActiveFilters = $derived(effectiveSelection().length > 0);
</script>

<BasePopover preferredPlacement="bottom" panelWidth="max-content">
  {#snippet trigger({ popover })}
    <TechnicianButton
      technicians={selectedTechnicians}
      showNotAssigned={isNotAssignedSelected}
      {disabled}
      active={hasActiveFilters}
      title={disabled ? 'Disabled' : 'Filter by Technician'}
      popoverButton={popover.button as any}
    />
  {/snippet}

  {#snippet children({ close })}
    <PopoverMenu
      options={menuOptions}
      showCheckmarks={true}
      showIcons={true}
      iconPosition="left"
      multiple={true}
      selected={effectiveSelection()}
      onSelect={handleSelect}
      onClose={close}
    >
      {#snippet iconContent({ option })}
        {#if option.value === 'technician:not_assigned'}
          <img src="/icons/questionmark.circle.fill.svg" alt="Not assigned" class="menu-icon" />
        {:else if option.user}
          <UserAvatar user={option.user} size="xs" />
        {/if}
      {/snippet}
    </PopoverMenu>
  {/snippet}
</BasePopover>

<style>
  .menu-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    object-fit: contain;
  }
</style>
