<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { debugComponent } from '$lib/utils/debug';

  // Portal props
  let {
    target = 'body' as HTMLElement | string,
    enabled = true,
    children,
  }: {
    target?: HTMLElement | string;
    enabled?: boolean;
    children?: import('svelte').Snippet;
  } = $props();

  let portalContainer = $state<HTMLElement>();
  let targetElement = $state<HTMLElement>();
  let contentElement = $state<HTMLElement>();

  onMount(() => {
    // Resolve target element
    if (typeof target === 'string') {
      if (target === 'body') {
        targetElement = document.body;
      } else {
        const element = document.querySelector(target);
        if (element instanceof HTMLElement) {
          targetElement = element;
        } else {
          debugComponent.warn('Portal target not found, falling back to body', { target });
          targetElement = document.body;
        }
      }
    } else {
      targetElement = target;
    }

    // Create a container element for this portal
    portalContainer = document.createElement('div');
    portalContainer.classList.add('portal-container');
  });

  onDestroy(() => {
    unmountPortal();
  });

  function mountPortal() {
    if (portalContainer && targetElement && contentElement) {
      if (!portalContainer.parentElement) {
        targetElement.appendChild(portalContainer);
      }
      // Move the content element to the portal container
      portalContainer.appendChild(contentElement);
    }
  }

  function unmountPortal() {
    if (portalContainer && portalContainer.parentElement) {
      portalContainer.parentElement.removeChild(portalContainer);
    }
  }

  // React to enabled changes
  $effect(() => {
    if (enabled && contentElement) {
      tick().then(() => mountPortal());
    } else if (!enabled) {
      unmountPortal();
    }
  });
</script>

{#if enabled}
  <div bind:this={contentElement} style="display: contents;">
    {@render children?.()}
  </div>
{:else}
  {@render children?.()}
{/if}

<style>
  :global(.portal-container) {
    /* Ensure portal containers don't interfere with layout */
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 9999;
    pointer-events: none;
  }

  :global(.portal-container > *) {
    /* Allow portal content to receive pointer events */
    pointer-events: auto;
  }
</style>
