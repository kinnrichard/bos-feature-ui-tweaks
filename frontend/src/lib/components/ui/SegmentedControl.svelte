<script lang="ts">
  interface Option {
    value: string;
    label: string;
    icon?: string;
  }

  interface Props {
    id?: string;
    options: Option[];
    value: string;
    onchange?: (value: string) => void;
    disabled?: boolean;
    fullWidth?: boolean;
    size?: 'small' | 'normal' | 'large';
    variant?: 'default' | 'minimal';
    ariaLabel?: string;
  }

  let {
    id,
    options,
    value = $bindable(),
    onchange,
    disabled = false,
    fullWidth = false,
    size = 'normal',
    variant = 'default',
    ariaLabel = 'Select option',
  }: Props = $props();

  // Element references for measuring positions
  let containerEl = $state<HTMLDivElement>();
  let buttonElements: Record<string, HTMLButtonElement> = {};

  // Sliding indicator state
  let indicatorStyle = $state({
    transform: 'translateX(0px)',
    width: '0px',
    borderRadius: '14.5px', // Default for normal size
  });

  // Track if this is the initial render to prevent animation
  let isInitialRender = $state(true);

  // Update indicator position when value changes or on mount
  $effect(() => {
    if (!containerEl || !value) return;

    const selectedButton = buttonElements[value];
    if (!selectedButton) return;

    // Calculate position relative to container
    const containerRect = containerEl.getBoundingClientRect();
    const buttonRect = selectedButton.getBoundingClientRect();

    // Account for container padding when calculating position
    const containerPaddingLeft = 4; // matches CSS padding-left
    const offsetX = buttonRect.left - containerRect.left - containerPaddingLeft;
    const width = buttonRect.width;

    // Use same large border radius for pill shape
    const indicatorBorderRadius = '999px';

    indicatorStyle = {
      transform: `translateX(${offsetX}px)`,
      width: `${width}px`,
      borderRadius: indicatorBorderRadius,
    };

    // After first positioning, enable animations
    if (isInitialRender) {
      // Use a small delay to ensure styles are applied before enabling transitions
      setTimeout(() => {
        isInitialRender = false;
      }, 50);
    }
  });

  function handleOptionClick(optionValue: string) {
    if (disabled || optionValue === value) return;
    value = optionValue;
    onchange?.(optionValue);
  }

  function handleKeydown(event: KeyboardEvent, optionValue: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOptionClick(optionValue);
    }
  }

  const sizeConfig = {
    small: {
      fontSize: '12px',
      padding: '6px 12px',
      gap: '4px',
      height: 32, // 12px font + 6px*2 padding + 4px*2 container padding
      borderRadius: '999px', // Large value for pill shape
    },
    normal: {
      fontSize: '13px',
      padding: '8px 16px',
      gap: '6px',
      height: 37, // 13px font + 8px*2 padding + 4px*2 container padding
      borderRadius: '999px', // Large value for pill shape
    },
    large: {
      fontSize: '14px',
      padding: '10px 20px',
      gap: '8px',
      height: 42, // 14px font + 10px*2 padding + 4px*2 container padding
      borderRadius: '999px', // Large value for pill shape
    },
  };

  const config = $derived(sizeConfig[size]);
</script>

<div
  {id}
  bind:this={containerEl}
  class="segmented-control {size} {variant}"
  class:full-width={fullWidth}
  class:disabled
  role="radiogroup"
  aria-label={ariaLabel}
  style:gap={config.gap}
  style:border-radius={config.borderRadius}
>
  {#if variant === 'default'}
    <div
      class="sliding-indicator"
      class:no-transition={isInitialRender}
      style:transform={indicatorStyle.transform}
      style:width={indicatorStyle.width}
      style:border-radius={indicatorStyle.borderRadius}
      aria-hidden="true"
    ></div>
  {/if}
  {#each options as option (option.value)}
    <button
      bind:this={buttonElements[option.value]}
      type="button"
      class="segmented-option"
      class:selected={value === option.value}
      {disabled}
      role="radio"
      aria-checked={value === option.value}
      aria-label={option.label}
      style:font-size={config.fontSize}
      style:padding={config.padding}
      style:border-radius={config.borderRadius}
      onclick={() => handleOptionClick(option.value)}
      onkeydown={(e) => handleKeydown(e, option.value)}
    >
      {#if option.icon}
        <span class="option-icon">{option.icon}</span>
      {/if}
      <span class="option-label">{option.label}</span>
    </button>
  {/each}
</div>

<style>
  .segmented-control {
    display: inline-flex;
    background-color: rgba(255, 255, 255, 0.15);
    padding: 4px 4px;
    position: relative;
    isolation: isolate;
  }

  .segmented-control.full-width {
    width: 100%;
  }

  .segmented-control.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  /* Sliding indicator for default variant */
  .sliding-indicator {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 4px;
    background-color: #000;
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.15),
      0 1px 2px rgba(0, 0, 0, 0.1);
    transition:
      transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
      width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
      border-radius 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 0;
  }

  /* Disable transitions on initial render */
  .sliding-indicator.no-transition {
    transition: none;
  }

  .segmented-option {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--text-secondary, #c7c7cc);
    cursor: default;
    transition: color 0.15s ease;
    font-weight: 500;
    white-space: nowrap;
    min-width: 0;
    flex: 1;
    position: relative;
    z-index: 1;
  }

  .full-width .segmented-option {
    flex: 1;
  }

  /* For default variant, rely on sliding indicator for background */
  .segmented-control.default .segmented-option:hover:not(.selected) {
    color: var(--text-primary, #f2f2f7);
  }

  .segmented-control.default .segmented-option.selected {
    color: var(--accent-blue, #00a3ff);
  }

  /* Minimal variant retains original styling */
  .segmented-control.minimal .segmented-option:hover:not(.selected) {
    background-color: var(--bg-quaternary, #48484a);
    color: var(--text-primary, #f2f2f7);
  }

  .segmented-control.minimal .segmented-option.selected {
    background-color: var(--bg-primary, #1c1c1d);
    color: var(--text-primary, #f2f2f7);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .segmented-option:focus-visible {
    outline: 2px solid var(--accent-blue, #00a3ff);
    outline-offset: 2px;
  }

  .segmented-option:active {
    transform: scale(0.97);
  }

  .option-icon {
    font-size: 1.1em;
    margin-right: 6px;
  }

  .option-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Variant styles */
  .segmented-control.minimal {
    background-color: transparent;
    border: none;
    padding: 0;
    gap: 4px;
  }

  .segmented-control.minimal .segmented-option {
    border: 1px solid var(--border-primary, #48484a);
  }

  .segmented-control.minimal .segmented-option.selected {
    border-color: var(--accent-blue, #00a3ff);
    background-color: var(--accent-blue, #00a3ff);
    color: white;
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .segmented-control {
      border-width: 2px;
    }

    .segmented-option:focus {
      box-shadow: 0 0 0 3px var(--accent-blue, #00a3ff);
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .segmented-option {
      transition: none;
    }

    .segmented-option:active {
      transform: none;
    }
  }
</style>
