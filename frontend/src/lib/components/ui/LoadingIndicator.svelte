<script lang="ts">
  import ProgressSpinner from './ProgressSpinner.svelte';
  import { SPINNER_SIZES, type SpinnerSize } from '$lib/constants/spinner-sizes.js';

  // Type definitions for better TypeScript support
  type LoadingType = 'text' | 'spinner' | 'dots' | 'skeleton';
  type LoadingSize = SpinnerSize; // Use shared type for consistency
  type LoadingColor = 'primary' | 'secondary' | 'tertiary';

  interface SizeConfig {
    fontSize: string;
    spinnerSize: string;
    dotSize: string;
    skeletonHeight: {
      normal: string;
      short: string;
    };
  }

  interface LoadingIndicatorProps {
    type?: LoadingType;
    size?: LoadingSize;
    message?: string;
    color?: LoadingColor;
    center?: boolean;
    inline?: boolean;
    customClass?: string;
    visible?: boolean;
  }

  let {
    type = 'text',
    size = 'normal',
    message = 'Loading...',
    color = 'tertiary',
    center = false,
    inline = false,
    customClass = '',
    visible = true,
  }: LoadingIndicatorProps = $props();

  // Centralized size configurations using DRY principles
  const sizeConfigs: Record<LoadingSize, SizeConfig> = {
    small: {
      fontSize: '11px',
      spinnerSize: SPINNER_SIZES.small,
      dotSize: '4px',
      skeletonHeight: { normal: '10px', short: '8px' },
    },
    normal: {
      fontSize: '12px',
      spinnerSize: SPINNER_SIZES.normal,
      dotSize: '6px',
      skeletonHeight: { normal: '12px', short: '10px' },
    },
    large: {
      fontSize: '14px',
      spinnerSize: SPINNER_SIZES.large,
      dotSize: '8px',
      skeletonHeight: { normal: '14px', short: '12px' },
    },
  };

  // Derived reactive state
  const config = $derived(sizeConfigs[size]);
  const shouldShowMessage = $derived(message && message !== 'Loading...');
  const containerClasses = $derived(`loading-indicator ${type} ${size} ${color} ${customClass}`);

  // Constants to avoid magic numbers
  const DOT_COUNT = 3;
</script>

{#snippet optionalMessage()}
  {#if shouldShowMessage}
    <span class="loading-text">{message}</span>
  {/if}
{/snippet}

{#snippet spinnerIcon()}
  <ProgressSpinner {size} class="loading-spinner" />
{/snippet}

{#snippet dotsAnimation()}
  <div class="dots-container" aria-label={message}>
    {#each Array(DOT_COUNT) as _, index}
      <div
        class="dot"
        style:width={config.dotSize}
        style:height={config.dotSize}
        style:animation-delay="{-0.32 + index * 0.16}s"
      ></div>
    {/each}
  </div>
{/snippet}

{#snippet skeletonLines()}
  <div class="skeleton-container" aria-label={message}>
    <div class="skeleton-line" style:height={config.skeletonHeight.normal}></div>
    <div class="skeleton-line short" style:height={config.skeletonHeight.short}></div>
  </div>
{/snippet}

{#if visible}
  <div
    class={containerClasses}
    class:center
    class:inline
    data-testid="loading-indicator"
    style:font-size={config.fontSize}
    role="status"
    aria-live="polite"
    aria-label={message}
  >
    {#if type === 'text'}
      <span class="loading-text">{message}</span>
    {:else if type === 'spinner'}
      {@render spinnerIcon()}
      {@render optionalMessage()}
    {:else if type === 'dots'}
      {@render dotsAnimation()}
      {@render optionalMessage()}
    {:else if type === 'skeleton'}
      {@render skeletonLines()}
    {/if}
  </div>
{/if}

<style lang="scss">
  @use 'sass:map';

  // SASS Variables for DRY principles
  $base-gap: 8px;
  $animation-duration-base: 1.4s;
  $border-radius-small: 4px;
  $skeleton-width-short: 60%;

  // Size configuration map
  $size-configs: (
    small: (
      gap: 6px,
      dots-gap: 3px,
      skeleton-gap: 6px,
    ),
    normal: (
      gap: $base-gap,
      dots-gap: 4px,
      skeleton-gap: $base-gap,
    ),
    large: (
      gap: 10px,
      dots-gap: 5px,
      skeleton-gap: 10px,
    ),
  );

  // Color configuration map
  $color-variants: (
    primary: var(--text-primary),
    secondary: var(--text-secondary),
    tertiary: var(--text-tertiary),
  );

  // Animation keyframes (dots and skeleton only)
  // Progress spinner animation is handled by ProgressSpinner component

  @keyframes dot-bounce {
    0%,
    80%,
    100% {
      transform: scale(0.7);
      opacity: 0.5;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes skeleton-loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  // Base component styles
  .loading-indicator {
    display: flex;
    align-items: center;
    gap: $base-gap;
    line-height: 1.3;

    // Modifiers
    &.center {
      justify-content: center;
      text-align: center;
    }

    &.inline {
      display: inline-flex;
    }

    // Color variants using SASS map
    @each $color, $value in $color-variants {
      &.#{$color} {
        color: #{$value};
      }
    }

    // Size variants using SASS map and mixins
    @each $size, $config in $size-configs {
      &.#{$size} {
        gap: map.get($config, gap);

        .dots-container {
          gap: map.get($config, dots-gap);
        }

        .skeleton-container {
          gap: map.get($config, skeleton-gap);
        }
      }
    }
  }

  // Text loading
  .loading-text {
    font-size: inherit;
    color: inherit;
    font-weight: inherit;
  }

  // Progress spinner loading
  .loading-spinner {
    flex-shrink: 0;
  }

  // Dots loading
  .dots-container {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .dot {
    background-color: currentColor;
    border-radius: 50%;
    animation: dot-bounce $animation-duration-base ease-in-out infinite both;
    flex-shrink: 0;
  }

  // Skeleton loading
  .skeleton-container {
    display: flex;
    flex-direction: column;
    gap: $base-gap;
    width: 100%;
  }

  .skeleton-line {
    background: linear-gradient(
      90deg,
      var(--bg-tertiary) 25%,
      var(--bg-quaternary) 50%,
      var(--bg-tertiary) 75%
    );
    background-size: 200% 100%;
    border-radius: $border-radius-small;
    animation: skeleton-loading 1.5s ease-in-out infinite;

    &.short {
      width: $skeleton-width-short;
    }
  }

  // Accessibility and reduced motion support
  @media (prefers-reduced-motion: reduce) {
    // Progress spinner motion is handled by ProgressSpinner component

    .dot {
      animation: none;
      opacity: 0.7;
    }

    .skeleton-line {
      animation: none;
      background: var(--bg-tertiary);
    }
  }

  // High contrast mode support
  @media (prefers-contrast: high) {
    .skeleton-line {
      background: var(--bg-quaternary);
      border: 1px solid var(--border-primary);
    }

    .dot {
      border: 1px solid currentColor;
    }
  }

  // Focus management for accessibility
  .loading-indicator:focus-visible {
    outline: 2px solid var(--focus-ring-color, currentColor);
    outline-offset: 2px;
    border-radius: $border-radius-small;
  }

  // Ensure proper contrast in all themes
  @media (prefers-color-scheme: dark) {
    .skeleton-line {
      background: linear-gradient(
        90deg,
        var(--bg-tertiary) 25%,
        var(--bg-secondary) 50%,
        var(--bg-tertiary) 75%
      );
    }
  }
</style>
