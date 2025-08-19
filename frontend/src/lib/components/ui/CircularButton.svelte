<script lang="ts">
  let {
    size = 'normal' as 'small' | 'normal' | 'large',
    variant = 'default' as 'default' | 'avatar' | 'primary',
    disabled = false,
    title = '',
    onclick = undefined as (() => void) | undefined,
    type = 'button' as 'button' | 'submit' | 'reset',
    ariaLabel = '',
    ariaPressed = undefined as boolean | undefined,
    ariaExpanded = undefined as boolean | undefined,
    dynamicWidth = false,
    minWidth = undefined as number | undefined,
    borderRadius = undefined as number | string | undefined,
    customClass = '',
    'data-testid': dataTestId = undefined as string | undefined,
    children,
  }: {
    size?: 'small' | 'normal' | 'large';
    variant?: 'default' | 'avatar' | 'primary';
    disabled?: boolean;
    title?: string;
    onclick?: (() => void) | undefined;
    type?: 'button' | 'submit' | 'reset';
    ariaLabel?: string;
    ariaPressed?: boolean | undefined;
    ariaExpanded?: boolean | undefined;
    dynamicWidth?: boolean;
    minWidth?: number | undefined;
    borderRadius?: number | string | undefined;
    customClass?: string;
    'data-testid'?: string | undefined;
    children?: import('svelte').Snippet<[{ config: typeof config }]>;
  } = $props();

  // Size configurations
  const sizeConfig = {
    small: { width: 28, height: 28, iconSize: 16 },
    normal: { width: 36, height: 36, iconSize: 20 },
    large: { width: 44, height: 44, iconSize: 24 },
  };

  const config = $derived(sizeConfig[size]);

  function handleClick() {
    if (!disabled && onclick) {
      onclick();
    }
  }
</script>

<button
  {type}
  class="circular-button {variant} {size} {customClass}"
  class:dynamic-width={dynamicWidth}
  class:disabled
  {disabled}
  {title}
  aria-label={ariaLabel || title}
  aria-pressed={ariaPressed}
  aria-expanded={ariaExpanded}
  data-testid={dataTestId}
  style:width={dynamicWidth ? 'auto' : `${config.width}px`}
  style:height={`${config.height}px`}
  style:min-width={minWidth ? `${minWidth}px` : dynamicWidth ? `${config.width}px` : undefined}
  style:border-radius={borderRadius
    ? typeof borderRadius === 'string'
      ? borderRadius
      : `${borderRadius}px`
    : '50%'}
  onclick={handleClick}
>
  {@render children?.({ config })}
</button>

<style>
  .circular-button {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 0;
    font-family: inherit;
  }

  /* Size variants handled by style props - no CSS needed */

  /* Hover states */
  .circular-button.default:hover:not(:disabled) {
    /* 33% brighter than --bg-secondary (#1c1c1d) = #252527 */
    background-color: #252527;
    /* 33% brighter than --border-primary (#38383a) = #494a4d */
    border-color: #494a4d;
  }

  /* Variant styles */

  .circular-button.avatar {
    background-color: var(--accent-red);
    border: none;
    border-radius: 18px; /* Slightly rounded for avatar style */
  }

  .circular-button.primary {
    background-color: var(--accent-blue);
    border-color: var(--accent-blue);
    color: white;
  }

  /* Dynamic width for special cases */
  .circular-button.dynamic-width {
    width: auto !important;
    padding: 0 6px;
  }

  /* Disabled state */
  .circular-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* Content styling */
  .circular-button :global(.icon) {
    opacity: 0.7;
  }

  .circular-button :global(.emoji) {
    font-size: 16px;
    line-height: 1;
  }

  .circular-button.small :global(.emoji) {
    font-size: 14px;
  }

  .circular-button.large :global(.emoji) {
    font-size: 18px;
  }

  /* Avatar specific styling */
  .circular-button.avatar :global(.initials) {
    color: white;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    text-transform: uppercase;
  }

  .circular-button.small.avatar :global(.initials) {
    font-size: 11px;
  }

  .circular-button.normal.avatar :global(.initials) {
    font-size: 13px;
  }

  .circular-button.large.avatar :global(.initials) {
    font-size: 15px;
  }

  /* Responsive adjustments */
  /* Mobile styles handled by existing responsive design */

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .circular-button {
      border-width: 2px;
    }
  }

  /* Accessibility improvements */
</style>
