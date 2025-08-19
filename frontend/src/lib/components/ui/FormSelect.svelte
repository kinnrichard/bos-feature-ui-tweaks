<script lang="ts">
  let {
    value = '' as string | number,
    disabled = false,
    required = false,
    id = '',
    name = '',
    title = '',
    ariaLabel = '',
    ariaDescribedby = '',
    // Options - can be simple strings or objects
    options = [] as Array<string | { value: string | number; label: string; disabled?: boolean }>,
    placeholder = '',
    showPlaceholder = true,
    // Styling props
    size = 'normal' as 'small' | 'normal' | 'large',
    variant = 'default' as 'default' | 'error' | 'success',
    fullWidth = false,
    customClass = '',
    // Error state
    error = '',
    showError = true,
    // Event callback props (Svelte 5 pattern)
    onchange = undefined as ((event: Event) => void) | undefined,
    onfocus = undefined as ((event: FocusEvent) => void) | undefined,
    onblur = undefined as ((event: FocusEvent) => void) | undefined
  } = $props();

  // Focus management
  let selectElement: HTMLSelectElement;
  export function focus() {
    selectElement?.focus();
  }

  export function blur() {
    selectElement?.blur();
  }

  // Size configurations
  const sizeConfig = {
    small: { padding: '6px 30px 6px 10px', fontSize: '12px' },
    normal: { padding: '8px 32px 8px 12px', fontSize: '13px' },
    large: { padding: '10px 34px 10px 14px', fontSize: '14px' }
  };

  const config = $derived(sizeConfig[size]);
  const hasError = $derived(error && showError);
  const finalVariant = $derived(hasError ? 'error' : variant);

  // Process options to ensure consistent format
  const processedOptions = $derived(options.map(option => {
    if (typeof option === 'string') {
      return { value: option, label: option, disabled: false };
    }
    return { ...option, disabled: option.disabled || false };
  }));
</script>

<div class="form-select-wrapper" class:full-width={fullWidth}>
  <div class="select-container">
    <select
      bind:this={selectElement}
      bind:value
      {disabled}
      {required}
      {id}
      {name}
      {title}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      class="form-select {size} {finalVariant} {customClass}"
      class:has-error={hasError}
      style:padding={config.padding}
      style:font-size={config.fontSize}
      onchange={onchange}
      onfocus={onfocus}
      onblur={onblur}
    >
      {#if showPlaceholder && placeholder}
        <option value="" disabled selected={!value}>
          {placeholder}
        </option>
      {/if}
      
      {#each processedOptions as option}
        <option 
          value={option.value} 
          disabled={option.disabled}
          selected={option.value === value}
        >
          {option.label}
        </option>
      {/each}
    </select>
    
    <!-- Custom dropdown arrow -->
    <div class="select-arrow" class:disabled>
      <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>
  
  {#if hasError}
    <div class="select-error" id="{id}-error">
      {error}
    </div>
  {/if}
</div>

<style>
  .form-select-wrapper {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-select-wrapper.full-width {
    width: 100%;
  }

  .select-container {
    position: relative;
    display: inline-block;
    width: 100%;
  }

  .form-select {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    color: var(--text-primary);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    font-family: inherit;
    line-height: 1.4;
    width: 100%;
    box-sizing: border-box;
    /* Remove default arrow */
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-image: none;
  }

  .form-select:focus {
    outline: none;
    border-color: var(--accent-blue);
    box-shadow: 0 0 0 3px rgba(0, 163, 255, 0.1);
  }

  .form-select:disabled {
    opacity: 0.6;
    pointer-events: none;
    background-color: var(--bg-tertiary);
    cursor: not-allowed;
  }

  /* Variant styles */
  .form-select.error {
    border-color: var(--accent-red);
  }

  .form-select.error:focus {
    border-color: var(--accent-red);
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
  }

  .form-select.success {
    border-color: var(--accent-green);
  }

  .form-select.success:focus {
    border-color: var(--accent-green);
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
  }

  /* Custom dropdown arrow */
  .select-arrow {
    position: absolute;
    top: 50%;
    right: 12px;
    transform: translateY(-50%);
    pointer-events: none;
    color: var(--text-secondary);
    transition: color 0.15s ease;
  }

  .select-arrow.disabled {
    opacity: 0.6;
  }

  .form-select:focus + .select-arrow {
    color: var(--text-primary);
  }

  /* Error message */
  .select-error {
    color: var(--accent-red);
    font-size: 12px;
    line-height: 1.3;
    margin-top: 2px;
  }

  /* Placeholder styling */
  .form-select option[value=""]:disabled {
    color: var(--text-tertiary);
  }

  /* Option styling */
  .form-select option {
    background-color: var(--bg-primary);
    color: var(--text-primary);
    padding: 4px 8px;
  }

  .form-select option:disabled {
    color: var(--text-tertiary);
    opacity: 0.6;
  }

  /* Size variants handled by style props - no CSS needed */

  /* Adjust arrow position for different sizes */
  .form-select.small + .select-arrow {
    right: 10px;
  }

  .form-select.large + .select-arrow {
    right: 14px;
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .form-select {
      border-width: 2px;
    }

    .form-select:focus {
      box-shadow: 0 0 0 2px var(--accent-blue);
    }

    .select-arrow {
      color: var(--text-primary);
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .form-select,
    .select-arrow {
      transition: none;
    }
  }

  /* Dark mode support for options */
  @media (prefers-color-scheme: dark) {
    .form-select {
      color-scheme: dark;
    }
  }

  /* Firefox specific fixes */
  @-moz-document url-prefix() {
    .form-select {
      text-indent: 0.01px;
      text-overflow: '';
    }
  }
</style>