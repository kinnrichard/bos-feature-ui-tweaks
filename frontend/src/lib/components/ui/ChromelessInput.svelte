<script lang="ts">
  import '../../styles/focus-ring.scss';

  // Props interface
  interface Props {
    value?: string;
    placeholder?: string;
    type?: 'text' | 'email' | 'password' | 'url' | 'tel' | 'search';
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    id?: string;
    name?: string;
    autocomplete?: string;
    maxlength?: number;
    pattern?: string;
    title?: string;
    ariaLabel?: string;
    ariaDescribedby?: string;
    customClass?: string;
    autoFocus?: boolean;
    selectOnFocus?: boolean;
    // Event callback props
    oninput?: (event: Event) => void;
    onchange?: (event: Event) => void;
    onfocus?: (event: FocusEvent) => void;
    onblur?: (event: FocusEvent) => void;
    onkeydown?: (event: KeyboardEvent) => void;
    onkeyup?: (event: KeyboardEvent) => void;
    onkeypress?: (event: KeyboardEvent) => void;
  }

  let {
    value = $bindable(''),
    placeholder = '',
    type = 'text',
    disabled = false,
    readonly = false,
    required = false,
    id = '',
    name = '',
    autocomplete = '',
    maxlength,
    pattern = '',
    title = '',
    ariaLabel = '',
    ariaDescribedby = '',
    customClass = '',
    autoFocus = false,
    selectOnFocus = false,
    oninput,
    onchange,
    onfocus,
    onblur,
    onkeydown,
    onkeyup,
    onkeypress,
  }: Props = $props();

  let inputElement = $state<HTMLInputElement>();
  let hasFocus = $state(false);
  let hasAutoFocused = $state(false);

  // Auto-focus on mount if requested
  $effect(() => {
    if (autoFocus && inputElement && !hasFocus && !hasAutoFocused) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        inputElement?.focus();
        hasAutoFocused = true;
      });
    }
  });

  // Public methods for programmatic control
  export function focus() {
    inputElement?.focus();
  }

  export function blur() {
    inputElement?.blur();
  }

  export function select() {
    inputElement?.select();
  }

  function handleFocus(e: FocusEvent) {
    hasFocus = true;

    // Select all text on focus if requested
    if (selectOnFocus && inputElement?.value) {
      requestAnimationFrame(() => {
        inputElement?.select();
      });
    }

    // Call parent's onfocus handler
    onfocus?.(e);
  }

  function handleBlur(e: FocusEvent) {
    hasFocus = false;

    // Call parent's onblur handler
    onblur?.(e);
  }

  function handleInput(e: Event) {
    // Update the bindable value
    const target = e.target as HTMLInputElement;
    value = target.value;

    // Call parent's oninput handler
    oninput?.(e);
  }

  function handleChange(e: Event) {
    // Call parent's onchange handler
    onchange?.(e);
  }

  function handleKeydown(e: KeyboardEvent) {
    // Call parent's onkeydown handler
    onkeydown?.(e);
  }

  function handleKeyup(e: KeyboardEvent) {
    // Call parent's onkeyup handler
    onkeyup?.(e);
  }

  function handleKeypress(e: KeyboardEvent) {
    // Call parent's onkeypress handler
    onkeypress?.(e);
  }
</script>

<input
  bind:this={inputElement}
  bind:value
  {type}
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
  class="chromeless-input focus-ring-tight {customClass}"
  class:focused={hasFocus}
  class:disabled
  class:readonly
  aria-label={ariaLabel}
  aria-describedby={ariaDescribedby}
  oninput={handleInput}
  onchange={handleChange}
  onfocus={handleFocus}
  onblur={handleBlur}
  onkeydown={handleKeydown}
  onkeyup={handleKeyup}
  onkeypress={handleKeypress}
/>

<style>
  .chromeless-input {
    /* Chromeless styling - no borders by default */
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-family: inherit;
    font-size: inherit;
    line-height: 1.4;
    width: 100%;

    /* No padding/margin by default - let parent handle spacing */
    padding: 0;
    margin: 0;

    /* Border radius for focus state */
    border-radius: 4px;

    /* Smooth transitions */
    transition: background-color var(--duration-fast, 150ms) var(--easing-smooth, ease);
  }

  /* Focus state - matches EditableTitle pattern */
  .chromeless-input:focus,
  .chromeless-input.focused {
    background-color: rgba(0, 0, 0, 0.9);
  }

  /* Ensure placeholder text doesn't shift position on focus */
  .chromeless-input:focus::placeholder,
  .chromeless-input.focused::placeholder {
    /* Force consistent positioning */
    text-indent: 0;
  }

  /* Placeholder styling */
  .chromeless-input::placeholder {
    color: var(--text-tertiary);
    opacity: 1;
  }

  /* Disabled state */
  .chromeless-input:disabled,
  .chromeless-input.disabled {
    opacity: 0.6;
    pointer-events: none;
    cursor: not-allowed;
  }

  /* Readonly state */
  .chromeless-input:read-only,
  .chromeless-input.readonly {
    cursor: default;
    background-color: transparent;
  }

  .chromeless-input:read-only:focus,
  .chromeless-input.readonly:focus {
    background-color: transparent;
  }

  /* Remove browser-specific input styling */
  .chromeless-input[type='search'] {
    -webkit-appearance: none;
    appearance: none;
  }

  .chromeless-input[type='search']::-webkit-search-decoration,
  .chromeless-input[type='search']::-webkit-search-cancel-button {
    -webkit-appearance: none;
  }

  /* Ensure text selection and cursor don't interfere with centering */
  .chromeless-input::selection {
    background-color: var(--accent-blue, rgba(0, 122, 255, 0.3));
  }

  /* Firefox-specific selection styling */
  .chromeless-input::-moz-selection {
    background-color: var(--accent-blue, rgba(0, 122, 255, 0.3));
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .chromeless-input:focus {
      outline: 2px solid var(--accent-blue);
      outline-offset: 1px;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .chromeless-input {
      transition: none;
    }
  }

  /* Dark mode adjustments */
  @media (prefers-color-scheme: dark) {
    .chromeless-input {
      color-scheme: dark;
    }
  }
</style>
