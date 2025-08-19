<!--
  ProgressSpinner Component
  
  Reusable progress indicator using 8-segment SVG with stepped rotation animation.
  Inherits color from parent context and supports multiple sizes.
-->

<script lang="ts">
  import { SPINNER_SIZES, type SpinnerSize } from '$lib/constants/spinner-sizes.js';

  interface Props {
    size?: SpinnerSize;
    class?: string;
  }

  let { size = 'normal', class: className = '' }: Props = $props();

  const spinnerSize = $derived(SPINNER_SIZES[size]);
</script>

<div
  class="progress-spinner {className}"
  style:width={spinnerSize}
  style:height={spinnerSize}
  role="status"
  aria-label="Loading"
>
  <img src="/icons/progress.indicator.svg" alt="" />
</div>

<style>
  .progress-spinner {
    flex-shrink: 0;
    animation: progress-rotate 1s steps(8, end) infinite;
    display: inline-block;
  }

  .progress-spinner img {
    width: 100%;
    height: 100%;
    display: block;
    /* Inherit color from parent context for theming */
    filter: brightness(0) invert(1);
    opacity: 0.8;
  }

  @keyframes progress-rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .progress-spinner {
      animation: none;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .progress-spinner img {
      opacity: 1;
    }
  }
</style>
