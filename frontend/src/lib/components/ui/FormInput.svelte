<script lang="ts">
  let {
    type = 'text' as
      | 'text'
      | 'email'
      | 'password'
      | 'url'
      | 'tel'
      | 'search'
      | 'number'
      | 'date'
      | 'time'
      | 'datetime-local',
    value = $bindable('') as string | number,
    placeholder = '',
    disabled = false,
    readonly = false,
    required = false,
    id = '',
    name = '',
    autocomplete = '',
    min = undefined as string | number | undefined,
    max = undefined as string | number | undefined,
    step = undefined as string | number | undefined,
    maxlength = undefined as number | undefined,
    pattern = '',
    title = '',
    ariaLabel = '',
    ariaDescribedby = '',
    // Styling props
    size = 'normal' as 'small' | 'normal' | 'large',
    variant = 'default' as 'default' | 'error' | 'success',
    fullWidth = false,
    customClass = '',
    // Error state
    error = '',
    showError = true,
    // Event callback props (Svelte 5 pattern)
    oninput = undefined as ((event: Event) => void) | undefined,
    onchange = undefined as ((event: Event) => void) | undefined,
    onfocus = undefined as ((event: FocusEvent) => void) | undefined,
    onblur = undefined as ((event: FocusEvent) => void) | undefined,
    onkeydown = undefined as ((event: KeyboardEvent) => void) | undefined,
    onkeyup = undefined as ((event: KeyboardEvent) => void) | undefined,
    onkeypress = undefined as ((event: KeyboardEvent) => void) | undefined,
  } = $props();

  // Focus management
  let inputElement: HTMLInputElement | undefined = $state();

  export function focus() {
    inputElement?.focus();
  }

  export function blur() {
    inputElement?.blur();
  }

  export function select() {
    inputElement?.select();
  }

  // Size configurations
  const sizeConfig = {
    small: { padding: '6px 10px', fontSize: '12px' },
    normal: { padding: '8px 12px', fontSize: '13px' },
    large: { padding: '10px 14px', fontSize: '14px' },
  };

  const config = $derived(sizeConfig[size]);
  const hasError = $derived(error && showError);
  const finalVariant = $derived(hasError ? 'error' : variant);
</script>

<div class="form-input-wrapper" class:full-width={fullWidth}>
  {#if type === 'text'}
    <input
      bind:this={inputElement}
      bind:value
      type="text"
      {placeholder}
      {disabled}
      {readonly}
      {required}
      {id}
      {name}
      {autocomplete}
      {maxlength}
      {pattern}
      {title}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      class="form-input {size} {finalVariant} {customClass}"
      class:has-error={hasError}
      style:padding={config.padding}
      style:font-size={config.fontSize}
      {oninput}
      {onchange}
      {onfocus}
      {onblur}
      {onkeydown}
      {onkeyup}
      {onkeypress}
    />
  {:else if type === 'email'}
    <input
      bind:this={inputElement}
      bind:value
      type="email"
      {placeholder}
      {disabled}
      {readonly}
      {required}
      {id}
      {name}
      {autocomplete}
      {maxlength}
      {pattern}
      {title}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      class="form-input {size} {finalVariant} {customClass}"
      class:has-error={hasError}
      style:padding={config.padding}
      style:font-size={config.fontSize}
      {oninput}
      {onchange}
      {onfocus}
      {onblur}
      {onkeydown}
      {onkeyup}
      {onkeypress}
    />
  {:else if type === 'password'}
    <input
      bind:this={inputElement}
      bind:value
      type="password"
      {placeholder}
      {disabled}
      {readonly}
      {required}
      {id}
      {name}
      {autocomplete}
      {maxlength}
      {title}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      class="form-input {size} {finalVariant} {customClass}"
      class:has-error={hasError}
      style:padding={config.padding}
      style:font-size={config.fontSize}
      {oninput}
      {onchange}
      {onfocus}
      {onblur}
      {onkeydown}
      {onkeyup}
      {onkeypress}
    />
  {:else if type === 'url'}
    <input
      bind:this={inputElement}
      bind:value
      type="url"
      {placeholder}
      {disabled}
      {readonly}
      {required}
      {id}
      {name}
      {autocomplete}
      {maxlength}
      {pattern}
      {title}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      class="form-input {size} {finalVariant} {customClass}"
      class:has-error={hasError}
      style:padding={config.padding}
      style:font-size={config.fontSize}
      {oninput}
      {onchange}
      {onfocus}
      {onblur}
      {onkeydown}
      {onkeyup}
      {onkeypress}
    />
  {:else if type === 'tel'}
    <input
      bind:this={inputElement}
      bind:value
      type="tel"
      {placeholder}
      {disabled}
      {readonly}
      {required}
      {id}
      {name}
      {autocomplete}
      {maxlength}
      {pattern}
      {title}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      class="form-input {size} {finalVariant} {customClass}"
      class:has-error={hasError}
      style:padding={config.padding}
      style:font-size={config.fontSize}
      {oninput}
      {onchange}
      {onfocus}
      {onblur}
      {onkeydown}
      {onkeyup}
      {onkeypress}
    />
  {:else if type === 'search'}
    <input
      bind:this={inputElement}
      bind:value
      type="search"
      {placeholder}
      {disabled}
      {readonly}
      {required}
      {id}
      {name}
      {autocomplete}
      {maxlength}
      {pattern}
      {title}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      class="form-input {size} {finalVariant} {customClass}"
      class:has-error={hasError}
      style:padding={config.padding}
      style:font-size={config.fontSize}
      {oninput}
      {onchange}
      {onfocus}
      {onblur}
      {onkeydown}
      {onkeyup}
      {onkeypress}
    />
  {:else if type === 'number'}
    <input
      bind:this={inputElement}
      bind:value
      type="number"
      {placeholder}
      {disabled}
      {readonly}
      {required}
      {id}
      {name}
      {autocomplete}
      {min}
      {max}
      {step}
      {title}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      class="form-input {size} {finalVariant} {customClass}"
      class:has-error={hasError}
      style:padding={config.padding}
      style:font-size={config.fontSize}
      {oninput}
      {onchange}
      {onfocus}
      {onblur}
      {onkeydown}
      {onkeyup}
      {onkeypress}
    />
  {:else if type === 'date'}
    <input
      bind:this={inputElement}
      bind:value
      type="date"
      {disabled}
      {readonly}
      {required}
      {id}
      {name}
      {min}
      {max}
      {title}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      class="form-input {size} {finalVariant} {customClass}"
      class:has-error={hasError}
      style:padding={config.padding}
      style:font-size={config.fontSize}
      {oninput}
      {onchange}
      {onfocus}
      {onblur}
      {onkeydown}
      {onkeyup}
      {onkeypress}
    />
  {:else if type === 'time'}
    <input
      bind:this={inputElement}
      bind:value
      type="time"
      {disabled}
      {readonly}
      {required}
      {id}
      {name}
      {min}
      {max}
      {step}
      {title}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      class="form-input {size} {finalVariant} {customClass}"
      class:has-error={hasError}
      style:padding={config.padding}
      style:font-size={config.fontSize}
      {oninput}
      {onchange}
      {onfocus}
      {onblur}
      {onkeydown}
      {onkeyup}
      {onkeypress}
    />
  {:else if type === 'datetime-local'}
    <input
      bind:this={inputElement}
      bind:value
      type="datetime-local"
      {disabled}
      {readonly}
      {required}
      {id}
      {name}
      {min}
      {max}
      {step}
      {title}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      class="form-input {size} {finalVariant} {customClass}"
      class:has-error={hasError}
      style:padding={config.padding}
      style:font-size={config.fontSize}
      {oninput}
      {onchange}
      {onfocus}
      {onblur}
      {onkeydown}
      {onkeyup}
      {onkeypress}
    />
  {/if}

  {#if hasError}
    <div class="input-error" id="{id}-error">
      {error}
    </div>
  {/if}
</div>

<style>
  .form-input-wrapper {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-input-wrapper.full-width {
    width: 100%;
  }

  .form-input {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    color: var(--text-primary);
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
    font-family: inherit;
    line-height: 1.4;
    width: 100%;
    box-sizing: border-box;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--accent-blue);
    box-shadow: 0 0 0 3px rgba(0, 163, 255, 0.1);
  }

  .form-input:disabled {
    opacity: 0.6;
    pointer-events: none;
    background-color: var(--bg-tertiary);
  }

  .form-input:readonly {
    background-color: var(--bg-tertiary);
    cursor: default;
  }

  .form-input::placeholder {
    color: var(--text-tertiary);
    opacity: 1;
  }

  /* Variant styles */
  .form-input.error {
    border-color: var(--accent-red);
  }

  .form-input.error:focus {
    border-color: var(--accent-red);
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
  }

  .form-input.success {
    border-color: var(--accent-green);
  }

  .form-input.success:focus {
    border-color: var(--accent-green);
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
  }

  /* Error message */
  .input-error {
    color: var(--accent-red);
    font-size: 12px;
    line-height: 1.3;
    margin-top: 2px;
  }

  /* Size variants handled by style props - no CSS needed */

  /* Special input types */
  .form-input[type='date'],
  .form-input[type='time'],
  .form-input[type='datetime-local'] {
    /* Ensure consistent appearance across browsers */
    -webkit-appearance: none;
    -moz-appearance: textfield;
    appearance: none;
  }

  .form-input[type='number'] {
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .form-input[type='number']::-webkit-outer-spin-button,
  .form-input[type='number']::-webkit-inner-spin-button {
    -webkit-appearance: none;
    appearance: none;
    margin: 0;
  }

  /* Search input specific styling */
  .form-input[type='search'] {
    -webkit-appearance: none;
    appearance: none;
  }

  .form-input[type='search']::-webkit-search-decoration,
  .form-input[type='search']::-webkit-search-cancel-button {
    -webkit-appearance: none;
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .form-input {
      border-width: 2px;
    }

    .form-input:focus {
      box-shadow: 0 0 0 2px var(--accent-blue);
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .form-input {
      transition: none;
    }
  }

  /* Dark mode adjustments */
  @media (prefers-color-scheme: dark) {
    .form-input[type='date'],
    .form-input[type='time'],
    .form-input[type='datetime-local'] {
      color-scheme: dark;
    }
  }
</style>
