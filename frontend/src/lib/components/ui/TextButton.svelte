<script lang="ts">
  let {
    variant = 'default' as 'default' | 'primary' | 'danger' | 'ghost' | 'ghost-danger',
    size = 'normal' as 'small' | 'normal' | 'large',
    disabled = false,
    loading = false,
    title = '',
    onclick = undefined as (() => void) | undefined,
    type = 'button' as 'button' | 'submit' | 'reset',
    ariaLabel = '',
    customClass = '',
    'data-testid': dataTestId = undefined as string | undefined,
    children,
  }: {
    variant?: 'default' | 'primary' | 'danger' | 'ghost' | 'ghost-danger';
    size?: 'small' | 'normal' | 'large';
    disabled?: boolean;
    loading?: boolean;
    title?: string;
    onclick?: (() => void) | undefined;
    type?: 'button' | 'submit' | 'reset';
    ariaLabel?: string;
    customClass?: string;
    'data-testid'?: string | undefined;
    children?: import('svelte').Snippet;
  } = $props();

  // Size configurations matching toolbar button heights
  const sizeConfig = {
    small: { height: 28, padding: '0 12px', fontSize: '13px' },
    normal: { height: 36, padding: '0 16px', fontSize: '14px' },
    large: { height: 44, padding: '0 20px', fontSize: '15px' },
  };

  const config = $derived(sizeConfig[size]);

  function handleClick() {
    if (!disabled && !loading && onclick) {
      onclick();
    }
  }
</script>

<button
  {type}
  class="text-button {variant} {size} {customClass}"
  class:disabled={disabled || loading}
  disabled={disabled || loading}
  {title}
  aria-label={ariaLabel || title}
  data-testid={dataTestId}
  style:height={`${config.height}px`}
  style:padding={config.padding}
  style:font-size={config.fontSize}
  onclick={handleClick}
>
  {#if loading}
    <span class="loading-text">Loading...</span>
  {:else}
    {@render children?.()}
  {/if}
</button>

<style>
  .text-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 18px; /* Fully rounded to match toolbar buttons */
    border: 1px solid transparent;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
    cursor: default;
    font-family: inherit;
    min-width: fit-content;
  }

  /* Variant styles */
  .text-button.default {
    background-color: var(--bg-secondary, #1c1c1d);
    border-color: var(--border-primary, #38383a);
    color: var(--text-primary, #f2f2f7);
  }

  .text-button.default:hover:not(.disabled) {
    /* 33% brighter than --bg-secondary (#1c1c1d) = #252527 */
    background-color: #252527;
    /* 33% brighter than --border-primary (#38383a) = #494a4d */
    border-color: #494a4d;
  }

  .text-button.default:active:not(.disabled) {
    background-color: var(--bg-quaternary, #48484a);
  }

  .text-button.primary {
    background-color: var(--accent-blue, #00a3ff);
    color: white;
    text-shadow: 1.5px 1.5px 3px rgba(0, 0, 0, 0.5);
  }

  .text-button.primary:hover:not(.disabled) {
    /* 20% darker than --accent-blue (#00a3ff) = #0082cc */
    background-color: #0082cc;
  }

  .text-button.primary:active:not(.disabled) {
    background-color: var(--accent-blue-dark, #0066cc);
  }

  .text-button.danger {
    background-color: var(--accent-red, #ff3b30);
    color: white;
  }

  .text-button.danger:active:not(.disabled) {
    background-color: var(--accent-red-dark, #cc2a20);
  }

  /* Ghost variant - transparent with border */
  .text-button.ghost {
    background-color: transparent;
    border-color: var(--border-primary, #38383a);
    color: var(--text-primary, #f2f2f7);
  }

  .text-button.ghost:hover:not(.disabled) {
    /* 33% brighter than transparent = slight background */
    background-color: rgba(37, 37, 39, 0.5);
    /* 33% brighter than --border-primary (#38383a) = #494a4d */
    border-color: #494a4d;
  }

  .text-button.ghost:active:not(.disabled) {
    background-color: var(--bg-tertiary, #3a3a3c);
  }

  /* Ghost danger variant - transparent with red */
  .text-button.ghost-danger {
    background-color: transparent;
    border-color: var(--accent-red, #ff3b30);
    color: var(--accent-red, #ff3b30);
  }

  .text-button.ghost-danger:hover:not(.disabled) {
    /* Subtle red background on hover */
    background-color: rgba(255, 59, 48, 0.08);
    /* 33% brighter than --accent-red (#ff3b30) = #ff4f40 (clamped for visibility) */
    border-color: #ff4f40;
  }

  .text-button.ghost-danger:active:not(.disabled) {
    background-color: rgba(255, 59, 48, 0.15);
  }

  /* Disabled state */
  .text-button.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* Loading text */
  .loading-text {
    opacity: 0.8;
  }

  /* Focus styles */
  .text-button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--accent-blue, #00a3ff);
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .text-button {
      border-width: 2px;
    }

    .text-button:focus-visible {
      box-shadow: 0 0 0 3px var(--accent-blue, #00a3ff);
    }
  }

  /* Reduced motion support */
</style>
