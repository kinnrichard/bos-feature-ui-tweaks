<script lang="ts">
  import GenericFilterPopover from '$lib/components/ui/GenericFilterPopover.svelte';
  import { jobFilter, jobFilterOptions } from '$lib/stores/jobFilter.svelte';

  interface Props {
    disabled?: boolean;
  }

  let { disabled = false }: Props = $props();

  function handleFilterChange(newSelection: string[]) {
    jobFilter.setSelected(newSelection);
  }
</script>

<GenericFilterPopover
  title={null}
  options={jobFilterOptions}
  selected={jobFilter.selected}
  onFilterChange={handleFilterChange}
  {disabled}
  showAllSelectedByDefault={false}
  preventAllUnchecked={false}
/>
