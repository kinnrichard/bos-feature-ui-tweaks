<script lang="ts">
  import TechnicianAvatarGroup from '$lib/components/jobs/TechnicianAvatarGroup.svelte';
  import type { UserData } from '$lib/models/types/user-data';

  interface Props {
    technicians?: UserData[];
    showNotAssigned?: boolean;
    disabled?: boolean;
    active?: boolean;
    title?: string;
    emptyIcon?: string;
    emptyIconAlt?: string;
    onClick?: (e: MouseEvent) => void;
    popoverButton?: any; // For use:popover.button directive
  }

  let {
    technicians = [],
    showNotAssigned = false,
    disabled = false,
    active = false,
    title = 'Technicians',
    emptyIcon = '/icons/person.fill.svg',
    emptyIconAlt = 'No selection',
    onClick,
    popoverButton,
  }: Props = $props();

  // Determine button state
  const buttonState = $derived(() => {
    if (technicians.length === 0 && !showNotAssigned) {
      return 'empty';
    } else if (showNotAssigned && technicians.length === 0) {
      return 'not-assigned';
    } else if (showNotAssigned && technicians.length > 0) {
      return 'mixed';
    } else {
      return 'technicians';
    }
  });

  // Should expand to pill shape?
  const shouldExpand = $derived(
    technicians.length > 1 || (showNotAssigned && technicians.length > 0)
  );

  function handleClick(e: MouseEvent) {
    if (!disabled) {
      e.stopPropagation();
      onClick?.(e);
    }
  }
</script>

<button
  class="technician-button"
  class:disabled
  class:active
  class:expanded={shouldExpand}
  use:popoverButton
  {title}
  {disabled}
  onclick={handleClick}
>
  {#if buttonState() === 'empty'}
    <img src={emptyIcon} alt={emptyIconAlt} class="button-icon empty" />
  {:else if buttonState() === 'not-assigned'}
    <img src="/icons/questionmark.circle.fill.svg" alt="Not assigned" class="not-assigned-avatar" />
  {:else if buttonState() === 'mixed'}
    <div class="avatars-mixed">
      <img src="/icons/questionmark.circle.fill.svg" alt="Not assigned" class="not-assigned-avatar" />
      <TechnicianAvatarGroup
        {technicians}
        maxDisplay={technicians.length <= 2 ? 2 : 1}
        size="xs"
        showNames={false}
      />
    </div>
  {:else}
    <TechnicianAvatarGroup
      {technicians}
      maxDisplay={technicians.length <= 3 ? 3 : 2}
      size="xs"
      showNames={false}
    />
  {/if}
</button>

<style>
  .technician-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s;
    width: 36px;
    height: 36px;
  }

  /* Expanded state when multiple items selected */
  .technician-button.expanded {
    border-radius: 18px;
    width: auto;
    min-width: 36px;
    padding: 0 6px;
  }

  .technician-button:hover:not(.disabled) {
    /* Match popover-button hover styles */
    background-color: #252527;
    border-color: #494a4d;
  }

  .technician-button.active {
    background-color: var(--color-primary-soft, var(--bg-secondary));
    border-color: var(--color-primary, var(--border-primary));
  }

  .technician-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .button-icon {
    width: 18px;
    height: 18px;
    object-fit: contain;
  }

  .button-icon.empty {
    opacity: 0.4;
  }

  .not-assigned-avatar {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .avatars-mixed {
    display: flex;
    align-items: center;
  }

  .avatars-mixed :global(.technician-avatar-group) {
    margin-left: -6px;
  }

  .avatars-mixed :global(.technician-avatar-group .avatars > *:not(:first-child)) {
    margin-left: -6px;
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .technician-button {
      border-width: 2px;
    }
  }
</style>