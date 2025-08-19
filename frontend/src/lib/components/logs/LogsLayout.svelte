<script lang="ts">
  interface Props {
    title: string;
    subtitle?: string;
    children?: import('svelte').Snippet;
  }

  let { title, subtitle, children }: Props = $props();
</script>

<div class="logs-layout">
  <div class="logs-header">
    <h1 class="logs-title">{title}</h1>
    {#if subtitle}
      <p class="logs-subtitle">{subtitle}</p>
    {/if}
  </div>

  <div class="logs-content">
    {@render children?.()}
  </div>
</div>

<style>
  .logs-layout {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px 24px 24px;
  }

  .logs-header {
    margin-bottom: 2rem;
  }

  .logs-title {
    font-size: 2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .logs-subtitle {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .logs-content {
    /* Content styling matches app patterns */
  }
</style>
