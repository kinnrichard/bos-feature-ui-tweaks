<!--
  AppLoading Component
  
  System-level loading component for app initialization states.
  Used when waiting for Zero.js initialization, authentication checks, etc.
-->

<script lang="ts">
  import ProgressSpinner from './ui/ProgressSpinner.svelte';

  interface Props {
    message?: string;
    showSpinner?: boolean;
  }

  let { message = 'Connecting to data...', showSpinner = true }: Props = $props();
</script>

<div class="app-loading">
  <div class="app-loading__content">
    {#if showSpinner}
      <div class="app-loading__spinner">
        <ProgressSpinner size="large" />
      </div>
    {/if}

    <div class="app-loading__message">
      {message}
    </div>

    <div class="app-loading__subtitle">Please wait while we initialize the system</div>
  </div>
</div>

<style>
  .app-loading {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-black, #000);
    padding: 20px;
  }

  .app-loading__content {
    text-align: center;
    max-width: 400px;
  }

  .app-loading__spinner {
    margin: 0 auto 24px;
    display: flex;
    justify-content: center;
  }

  .app-loading__message {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary, #f2f2f7);
    margin-bottom: 8px;
  }

  .app-loading__subtitle {
    font-size: 14px;
    color: var(--text-secondary, #c7c7cc);
    opacity: 0.8;
  }

  /* Progress spinner animation and reduced motion are handled by ProgressSpinner component */

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .app-loading__spinner {
      border-width: 4px;
    }
  }
</style>
