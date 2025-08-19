<!--
  JobsLayout Component
  
  Shared layout wrapper for job listing pages.
  Provides consistent container styling and structure.
-->

<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
    header?: Snippet;
  }

  let { children, header }: Props = $props();
</script>

<div class="jobs-page">
  {#if header}
    <!-- Page Header -->
    <div class="page-header">
      {@render header()}
    </div>
  {/if}

  <!-- Content Area -->
  <div class="jobs-content">
    {@render children()}
  </div>
</div>

<style>
  .jobs-page {
    min-height: 100%;
    background-color: var(--bg-black, #000);
  }

  /* Page Header */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 24px;
  }

  .page-header :global(h1) {
    font-size: 32px;
    font-weight: 600;
    color: #f2f2f7 !important;
    margin: 0;
  }

  /* Content Area */
  .jobs-content {
    padding: 24px 24px 12px 24px;
    max-width: 1200px;
    margin: 0 auto;
  }

  /* Responsive layout */
  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      gap: 16px;
      align-items: stretch;
    }

    .jobs-content {
      padding: 16px 16px 12px 16px;
    }
  }

  @media (max-width: 480px) {
    .jobs-content {
      padding: 12px 12px 12px 12px;
    }
  }
</style>
