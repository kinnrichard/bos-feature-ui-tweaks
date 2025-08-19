<script lang="ts">
  import UserAvatar from '$lib/components/ui/UserAvatar.svelte';
  import type { UserData } from '$lib/models/types/user-data';

  interface Props {
    technicians: UserData[];
    maxDisplay?: number;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    showNames?: boolean;
  }

  let { technicians = [], maxDisplay = 3, size = 'xs', showNames = false }: Props = $props();

  const displayTechnicians = $derived(technicians.slice(0, maxDisplay));
  const extraCount = $derived(Math.max(0, technicians.length - maxDisplay));
</script>

<div class="technician-avatar-group" class:show-names={showNames}>
  {#if technicians.length === 0}
    <span class="no-technicians">Not Assigned</span>
  {:else}
    <div class="avatars">
      {#each displayTechnicians as technician, index}
        <UserAvatar
          user={technician}
          {size}
          overlap={index > 0}
          title={technician.name || technician.email}
        />
      {/each}
      {#if extraCount > 0}
        <div class="extra-count" class:size-xs={size === 'xs'} class:size-sm={size === 'sm'}>
          +{extraCount}
        </div>
      {/if}
    </div>

    {#if showNames}
      <div class="names">
        {technicians.map((t) => t.name || t.email).join(', ')}
      </div>
    {/if}
  {/if}
</div>

<style>
  .technician-avatar-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .technician-avatar-group.show-names {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .avatars {
    display: flex;
    align-items: center;
  }

  .no-technicians {
    color: var(--text-secondary);
    font-size: 14px;
    font-style: italic;
  }

  .names {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.2;
  }

  .extra-count {
    background-color: #555555; /* 66% gray - closer to black than white */
    color: white;
    font-size: 10px;
    font-weight: 600;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: -6px;
    position: relative;
    z-index: 10; /* Ensure badge appears above adjacent avatars */
  }

  .extra-count.size-xs {
    width: 24px;
    height: 24px;
    font-size: 11px;
  }

  .extra-count.size-sm {
    width: 32px;
    height: 32px;
    font-size: 12px;
  }
</style>
