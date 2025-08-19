<script lang="ts">
  import CircularButton from '$lib/components/ui/CircularButton.svelte';
  import type { PageAction } from '$lib/types/toolbar';

  interface Props {
    actions: PageAction[];
    disabled?: boolean;
  }

  const { actions, disabled = false }: Props = $props();
</script>

{#if actions.length > 0}
  <div class="page-actions" role="toolbar" aria-label="Page actions">
    {#each actions as action}
      <CircularButton
        variant="default"
        size="normal"
        onclick={disabled ? undefined : action.action}
        title={disabled ? 'Disabled' : action.label}
        data-testid={action.testId}
        {disabled}
        aria-label={action.label}
      >
        {#if action.iconType === 'svg'}
          <img src={action.icon} alt="" class="action-icon-svg" />
        {:else if action.iconType === 'emoji'}
          <span class="action-icon" aria-hidden="true">{action.icon}</span>
        {/if}
      </CircularButton>
    {/each}
  </div>
{/if}

<style>
  .page-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .action-icon {
    font-size: 16px;
    line-height: 1;
  }

  .action-icon-svg {
    width: 20px;
    height: 20px;
    opacity: 0.7;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .page-actions {
      gap: 8px;
    }
  }

  @media (max-width: 480px) {
    .action-icon-svg {
      width: 16px;
      height: 16px;
    }
  }
</style>
