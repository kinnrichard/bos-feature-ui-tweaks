<script lang="ts">
  import BasePopover from '$lib/components/ui/BasePopover.svelte';
  import PopoverMenu from '$lib/components/ui/PopoverMenu.svelte';
  import { getTaskStatusOptions } from '$lib/config/emoji';
  import { createEventDispatcher } from 'svelte';

  // Headless popover props - wraps existing content instead of creating new button
  let {
    taskId,
    initialStatus = 'new_task',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    children, // Used in template via {@render children()}
  }: {
    taskId: string;
    initialStatus?: string;
    children: import('svelte').Snippet<
      [{ popover: { close: () => void; expanded: boolean; button: unknown } }]
    >;
  } = $props();

  const dispatch = createEventDispatcher();

  // Use centralized status options - no duplication!
  const availableStatuses = getTaskStatusOptions();

  // Handle status change using event dispatcher pattern (matches TaskRow.svelte)
  async function handleStatusChange(newStatus: string, _option: unknown) {
    if (newStatus === initialStatus) {
      return;
    }

    // Use same event pattern as TaskRow.svelte
    dispatch('taskaction', {
      type: 'statusChange',
      taskId,
      data: { newStatus },
    });
  }

  // Handle popover close
  function handlePopoverClose() {
    dispatch('close');
  }
</script>

<!-- Headless popover - wraps the provided children as trigger -->
<BasePopover preferredPlacement="bottom" panelWidth="max-content">
  {#snippet trigger({ popover })}
    {@render children({ popover })}
  {/snippet}

  {#snippet children({ close })}
    <PopoverMenu
      options={availableStatuses}
      selected={initialStatus}
      onSelect={handleStatusChange}
      onClose={() => {
        close();
        handlePopoverClose();
      }}
      showCheckmarks={true}
      showIcons={true}
      iconPosition="left"
      enableKeyboard={true}
      autoFocus={true}
    />
  {/snippet}
</BasePopover>
