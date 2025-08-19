<script lang="ts" generics="T extends { id: string; value: string; label: string }">
  import BasePopover from '$lib/components/ui/BasePopover.svelte';
  import PopoverMenu from '$lib/components/ui/PopoverMenu.svelte';
  import '$lib/styles/popover-common.css';

  interface Props<T extends { id: string; value: string; label: string }> {
    title?: string | null;
    options: T[];
    selected: string[];
    onFilterChange: (selected: string[]) => void;
    disabled?: boolean;
    showAllSelectedByDefault?: boolean;
    preventAllUnchecked?: boolean;
    showDeletedToggle?: boolean;
    deletedLabel?: string;
    showDeleted?: boolean;
    onDeletedToggle?: (showDeleted: boolean) => void;
  }

  let {
    title,
    options,
    selected = $bindable([]),
    onFilterChange,
    disabled = false,
    showAllSelectedByDefault = true, // Kept for backwards compatibility
    preventAllUnchecked = true,
    showDeletedToggle = false,
    deletedLabel = 'Deleted',
    showDeleted = $bindable(false),
    onDeletedToggle = () => {},
  } = $props<Props<T>>();

  // Note: Initialization is handled by parent component to avoid circular updates
  // showAllSelectedByDefault is deprecated but kept for backwards compatibility
  void showAllSelectedByDefault; // Satisfy linter

  // Build menu options with optional title
  const menuOptions = $derived([
    ...(title ? [{ id: 'title', value: 'title', label: title, header: true }] : []),
    ...options,
    ...(showDeletedToggle
      ? [
          { id: 'separator', divider: true },
          { id: 'deleted', value: 'deleted', label: deletedLabel },
        ]
      : []),
  ]);

  // Handle option toggle with optional "prevent all unchecked" logic
  function handleOptionToggle(option: (typeof options)[0], event?: MouseEvent) {
    let newSelected: string[];

    // Easter egg: Option-click for exclusive selection or toggle to all
    if (event?.altKey) {
      // Check if already exclusively selected - if so, select all
      if (selected.length === 1 && selected.includes(option.value)) {
        newSelected = options.map((opt) => opt.value);
      } else {
        // Otherwise, select only this option
        newSelected = [option.value];
      }
    } else {
      const isCurrentlySelected = selected.includes(option.value);

      if (isCurrentlySelected) {
        // User wants to uncheck
        const tempSelected = selected.filter((value) => value !== option.value);

        if (preventAllUnchecked && tempSelected.length === 0) {
          // Would make all unchecked - select all instead
          newSelected = options.map((opt) => opt.value);
        } else {
          // Safe to uncheck this item
          newSelected = tempSelected;
        }
      } else {
        // User wants to check - add to selection
        newSelected = [...selected, option.value];
      }
    }

    // Update local state and notify parent
    selected = newSelected;
    onFilterChange(newSelected);
  }

  // Compute if filters are active (not all selected or deleted toggle is on)
  const hasActiveFilters = $derived(
    (selected.length > 0 && selected.length < options.length) || showDeleted
  );

  // Compute all selected values for PopoverMenu
  const allSelectedValues = $derived([...selected, ...(showDeleted ? ['deleted'] : [])]);

  // Notify parent when deleted toggle changes
  $effect(() => {
    onDeletedToggle(showDeleted);
  });

  function handleSelect(
    value: string | undefined,
    _option: { id: string; value: string; label: string }
  ) {
    if (!value || value === 'title') return;

    if (value === 'deleted') {
      showDeleted = !showDeleted;
    } else {
      // It's a regular option
      const regularOption = options.find((opt) => opt.value === value);
      if (regularOption) {
        handleOptionToggle(regularOption);
      }
    }
  }
</script>

<BasePopover preferredPlacement="bottom" panelWidth="max-content" {disabled}>
  {#snippet trigger({ popover })}
    <button
      class="popover-button"
      class:disabled
      use:popover.button
      title={disabled ? 'Disabled' : title ? `Filter ${title.toLowerCase()}` : 'Filter'}
      {disabled}
      onclick={disabled ? undefined : (e: MouseEvent) => e.stopPropagation()}
    >
      <img
        src={hasActiveFilters ? '/icons/filter-active.svg' : '/icons/filter-inactive.svg'}
        alt=""
        class="filter-icon"
        class:active={hasActiveFilters}
      />
    </button>
  {/snippet}

  {#snippet children({ close })}
    <PopoverMenu
      options={menuOptions}
      showCheckmarks={true}
      showIcons={false}
      multiple={true}
      selected={allSelectedValues}
      onSelect={handleSelect}
      onClose={close}
    />
  {/snippet}
</BasePopover>

<style>
  /* Base .popover-button styles are imported from popover-common.css */

  .filter-icon {
    width: 20px;
    height: 20px;
    opacity: 0.7;
  }

  .filter-icon.active {
    opacity: 1;
  }

  /* Accessibility improvements and high contrast support are imported from popover-common.css */
</style>
