<script lang="ts">
  import ChromelessInput from '$lib/components/ui/ChromelessInput.svelte';
  import { resizeInputs, type DynamicWidthConfig } from '$lib/utils/person/dynamicWidth';

  interface Props {
    mode?: 'create' | 'edit' | 'view';
    name?: string;
    namePreferred?: string;
    namePronunciationHint?: string;
    title?: string;
    isActive?: boolean;
    avatarSrc?: string;
    dynamicWidthConfig?: DynamicWidthConfig | undefined;
  }

  let {
    mode = 'create',
    name = $bindable(''),
    namePreferred = $bindable(''),
    namePronunciationHint = $bindable(''),
    title = $bindable(''),
    isActive = $bindable(true),
    avatarSrc = '/icons/person.circle.fill.svg',
    dynamicWidthConfig = undefined,
  }: Props = $props();

  // Handle input changes with dynamic resizing
  function handleInput() {
    if (dynamicWidthConfig) {
      resizeInputs(dynamicWidthConfig);
    }
  }

  // Determine display name for view mode
  const displayName = $derived(namePreferred || name);
</script>

<div class="person-header" class:editing={mode !== 'view'}>
  <!-- Person Avatar/Icon -->
  <div class="person-avatar">
    <img src={avatarSrc} alt="Person" width="64" height="64" />
  </div>

  {#if mode === 'view'}
    <!-- View Mode -->
    <div class="person-info">
      <h1 class="person-name">{displayName}</h1>

      {#if namePronunciationHint}
        <p class="pronunciation">({namePronunciationHint})</p>
      {/if}

      {#if title}
        <p class="person-title">{title}</p>
      {/if}

      {#if !isActive}
        <span class="inactive-badge">Inactive</span>
      {/if}
    </div>
  {:else}
    <!-- Edit/Create Mode -->
    <div class="person-form-fields">
      <!-- Name Field -->
      <div class="field-group">
        <ChromelessInput
          id="person-name"
          bind:value={name}
          placeholder="Full name"
          customClass="name-input"
          required
          autoFocus={mode === 'create'}
          oninput={handleInput}
        />
      </div>

      <!-- Title Field -->
      <div class="field-group">
        <ChromelessInput
          id="person-title"
          bind:value={title}
          placeholder="Job title or role"
          customClass="title-input"
          oninput={handleInput}
        />
      </div>
    </div>
  {/if}
</div>

<style>
  .person-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
    margin-bottom: 24px;
  }

  .person-avatar {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-shrink: 0;
  }

  .person-avatar img {
    opacity: 0.7;
    filter: grayscale(0.3);
  }

  .person-info {
    text-align: center;
  }

  .person-name {
    margin: 0 0 4px 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .pronunciation {
    color: var(--text-secondary);
    font-size: 14px;
    margin: 0 0 4px 0;
    font-style: italic;
  }

  .person-title {
    color: var(--text-secondary);
    font-size: 14px;
    margin: 0 0 8px 0;
  }

  .inactive-badge {
    display: inline-block;
    background-color: rgba(255, 149, 0, 0.1);
    color: var(--accent-orange);
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .more-actions-menu {
    padding: 8px;
    min-width: 150px;
  }

  .delete-action {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px;
    background: none;
    border: none;
    color: var(--accent-red);
    cursor: default;
    font-size: 14px;
    text-align: left;
    border-radius: 4px;
  }

  .delete-action .icon {
    width: 16px;
    height: 16px;
  }

  .delete-action .icon img {
    width: 100%;
    height: 100%;
  }

  .person-form-fields {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .field-group {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  /* Input styling */
  .field-group :global(.name-input) {
    font-size: 18px;
    font-weight: 600;
    text-align: center;
    padding: 0 6px !important;
  }

  .field-group :global(.name-preferred-input) {
    font-size: 16px;
    font-weight: 500;
    text-align: center;
    color: var(--text-secondary);
    padding: 0 6px !important;
  }

  .field-group :global(.pronunciation-input) {
    font-size: 14px;
    font-weight: 400;
    text-align: center;
    color: var(--text-secondary);
    padding: 0 6px !important;
    font-style: italic;
  }

  .field-group :global(.title-input) {
    font-size: 14px;
    font-weight: 400;
    text-align: center;
    color: var(--text-secondary);
    padding: 0 6px !important;
  }

  /* Focus states */
  :global(.name-input:focus),
  :global(.name-preferred-input:focus),
  :global(.pronunciation-input:focus),
  :global(.title-input:focus) {
    background-color: rgba(0, 0, 0, 0.05);
    text-align: center;
  }

  /* Modal styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background-color: var(--bg-primary);
    border-radius: 8px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
  }

  .modal-content h2 {
    margin: 0 0 16px 0;
    color: var(--text-primary);
  }

  .modal-content p {
    margin-bottom: 24px;
    color: var(--text-secondary);
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .cancel-button {
    padding: 8px 16px;
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    border: none;
    border-radius: 6px;
    cursor: default;
    font-size: 14px;
  }

  .delete-button {
    padding: 8px 16px;
    background-color: var(--accent-red);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: default;
    font-size: 14px;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .person-header {
      gap: 12px;
    }

    .person-name {
      font-size: 16px;
    }

    .field-group :global(.name-input) {
      font-size: 16px;
    }

    .field-group :global(.title-input) {
      font-size: 14px;
    }
  }
</style>
