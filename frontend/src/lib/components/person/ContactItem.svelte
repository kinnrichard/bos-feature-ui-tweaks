<script lang="ts">
  import ChromelessInput from '$lib/components/ui/ChromelessInput.svelte';
  import {
    normalizeContact,
    formatPhoneForDisplay,
    getContactTypeIcon,
    getContactTypeLabel,
  } from '$lib/utils/shared/contactNormalizer';
  import type { NormalizedContact } from '$lib/utils/shared/contactNormalizer';
  import type { ContactValidationResult } from '$lib/utils/person/contactValidation';
  import { validateContact } from '$lib/utils/person/contactValidation';

  interface Props {
    value?: string;
    placeholder?: string;
    customClass?: string;
    ariaLabel?: string;
    mode?: 'create' | 'edit' | 'view';
    showValidation?: boolean;
    normalized?: NormalizedContact | null;
    onInput?: ((event: Event) => void) | undefined;
    onBlur?: ((event: Event) => void) | undefined;
  }

  let {
    value = $bindable(''),
    placeholder = 'Email, phone, or address',
    customClass = 'contact-input',
    ariaLabel = 'Contact method',
    mode = 'create',
    showValidation = false,
    normalized: normalizedFromParent = null,
    onInput = undefined,
    onBlur = undefined,
  }: Props = $props();

  let validation: ContactValidationResult | null = null;
  let normalizedForEdit: NormalizedContact | null = null;

  // Derived value for immediate normalization in view mode and when edit has normalized value
  const normalized = $derived(
    normalizedFromParent || (mode === 'view' && value ? normalizeContact(value) : normalizedForEdit)
  );

  // Handle contact normalization and validation
  function handleBlur(event: Event) {
    normalizedForEdit = normalizeContact(value);

    if (showValidation) {
      validation = validateContact(value);
    }

    // Update the input value to show the formatted version
    if (normalizedForEdit) {
      if (normalizedForEdit.contact_type === 'phone') {
        // Format phone numbers for display
        value = formatPhoneForDisplay(value) || value;
      } else if (normalizedForEdit.contact_type === 'email') {
        // Use normalized (lowercase) email
        value = normalizedForEdit.normalized_value || value;
      }
    }

    onBlur?.(event);
  }

  function handleInput(event: Event) {
    // Clear validation on input
    if (validation && !validation.isValid) {
      validation = null;
    }

    onInput?.(event);
  }
</script>

{#if mode === 'view'}
  <div class="contact-item-view">
    {#if normalized}
      <span class="contact-type-indicator" title={getContactTypeLabel(normalized.contact_type)}>
        <img
          src={getContactTypeIcon(normalized.contact_type)}
          alt={getContactTypeLabel(normalized.contact_type)}
          width="16"
          height="16"
        />
      </span>
      <span class="contact-value">
        {normalized.contact_type === 'phone' ? formatPhoneForDisplay(value) || value : value}
      </span>
    {:else}
      <span class="contact-type-indicator placeholder"></span>
      <span class="contact-value">{value}</span>
    {/if}
  </div>
{:else}
  <div class="contact-item-edit">
    {#if normalized}
      <span class="contact-type-indicator" title={getContactTypeLabel(normalized.contact_type)}>
        <img
          src={getContactTypeIcon(normalized.contact_type)}
          alt={getContactTypeLabel(normalized.contact_type)}
          width="16"
          height="16"
        />
      </span>
    {:else}
      <span class="contact-type-indicator placeholder"></span>
    {/if}

    <ChromelessInput
      bind:value
      {placeholder}
      {customClass}
      type="text"
      {ariaLabel}
      oninput={handleInput}
      onblur={handleBlur}
    />

    {#if validation && !validation.isValid}
      <div class="validation-errors">
        {#each validation.errors as error}
          <span class="error-text">{error}</span>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .contact-item-view {
    display: flex;
    align-items: center;
    width: auto;
    min-width: 0;
    gap: 8px;
  }

  .contact-item-edit {
    display: flex;
    align-items: center;
    width: auto;
    min-width: 0;
    gap: 4px;
    position: relative;
  }

  .contact-type-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    opacity: 0.6;
    transition: opacity 0.2s ease;
    flex-shrink: 0;
  }

  .contact-type-indicator.placeholder {
    opacity: 0;
  }

  .contact-type-indicator:not(.placeholder):hover {
    opacity: 1;
  }

  .contact-type-indicator img {
    filter: var(--icon-filter, none);
  }

  .contact-value {
    color: var(--text-primary);
  }

  .validation-errors {
    position: absolute;
    top: 100%;
    left: 28px; /* Account for type indicator */
    right: 0;
    margin-top: 4px;
    z-index: 10;
  }

  .error-text {
    display: block;
    font-size: 12px;
    color: var(--accent-red);
    background-color: rgba(255, 69, 58, 0.1);
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid rgba(255, 69, 58, 0.2);
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .contact-item-edit {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    .validation-errors {
      left: 0;
      position: static;
      margin-top: 8px;
    }
  }
</style>
