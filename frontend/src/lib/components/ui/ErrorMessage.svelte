<script lang="ts">
  let {
    message = '',
    variant = 'inline' as 'inline' | 'block' | 'popover' | 'form',
    size = 'normal' as 'small' | 'normal' | 'large',
    dismissible = false,
    icon = true,
    customClass = '',
    id = '',
    // Show/hide state
    visible = true,
    // Event handlers
    onDismiss = undefined as (() => void) | undefined
  } = $props();

  function handleDismiss() {
    visible = false;
    if (onDismiss) {
      onDismiss();
    }
  }

  // Size configurations
  const sizeConfig = {
    small: { fontSize: '11px', padding: '4px 8px', iconSize: '12px' },
    normal: { fontSize: '12px', padding: '6px 12px', iconSize: '14px' },
    large: { fontSize: '13px', padding: '8px 16px', iconSize: '16px' }
  };

  const config = $derived(sizeConfig[size]);
  const showMessage = $derived(message && visible);
</script>

{#if showMessage}
  <div 
    class="error-message {variant} {size} {customClass}"
    class:dismissible
    class:with-icon={icon}
    {id}
    role="alert"
    aria-live="polite"
    data-testid="error-message"
    style:font-size={config.fontSize}
    style:padding={variant === 'inline' ? '0' : config.padding}
  >
    {#if icon}
      <div class="error-icon" style:width={config.iconSize} style:height={config.iconSize}>
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
        </svg>
      </div>
    {/if}
    
    <span class="error-text">{message}</span>
    
    {#if dismissible}
      <button 
        type="button"
        class="dismiss-button"
        aria-label="Dismiss error"
        onclick={handleDismiss}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    {/if}
  </div>
{/if}

<style>
  .error-message {
    color: var(--accent-red);
    display: flex;
    align-items: flex-start;
    gap: 6px;
    line-height: 1.3;
    word-break: break-word;
  }

  /* Inline variant uses minimal default styling */

  .error-message.block {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 6px;
    border-left: 4px solid var(--accent-red);
  }

  .error-message.popover {
    text-align: center;
    margin-bottom: 8px;
  }

  .error-message.form {
    margin-top: 2px;
  }

  /* Icon styling */
  .error-icon {
    flex-shrink: 0;
    margin-top: 1px; /* Align with first line of text */
  }

  .error-icon svg {
    width: 100%;
    height: 100%;
  }

  /* Text styling */
  .error-text {
    flex: 1;
    margin: 0;
  }

  /* Dismiss button */
  .dismiss-button {
    background: none;
    border: none;
    color: inherit;
    padding: 2px;
    border-radius: 2px;
    flex-shrink: 0;
    margin-top: 1px;
    transition: background-color 0.15s ease;
  }

  .dismiss-button:hover {
    background-color: rgba(239, 68, 68, 0.1);
  }

  .dismiss-button:focus {
    outline: 1px solid var(--accent-red);
    outline-offset: 1px;
  }

  /* Size variants */
  .error-message.small {
    gap: 4px;
  }

  .error-message.large {
    gap: 8px;
  }

  .error-message.small .dismiss-button {
    padding: 1px;
  }

  .error-message.large .dismiss-button {
    padding: 3px;
  }

  /* Remove icon spacing when no icon */
  .error-message:not(.with-icon) {
    gap: 0;
  }

  .error-message:not(.with-icon) .error-text {
    margin: 0;
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .error-message.block {
      border-width: 2px;
      border-left-width: 6px;
    }

    .dismiss-button:focus {
      outline-width: 2px;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .dismiss-button {
      transition: none;
    }
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .error-message {
      font-size: 11px;
    }

    .error-message.normal {
      font-size: 11px;
    }

    .error-message.large {
      font-size: 12px;
    }
  }
</style>