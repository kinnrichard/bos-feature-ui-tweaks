<script lang="ts">
  import type { SearchConfig } from '$lib/types/toolbar';
  import { debugSearch } from '$lib/utils/debug';

  interface Props {
    config: SearchConfig | null;
    disabled?: boolean;
  }

  const { config, disabled = false }: Props = $props();

  let searchFocused = $state(false);
  let inputElement: HTMLInputElement | null = $state(null);

  // Handle search submission
  function handleSearch() {
    if (!config) return;

    if (config.searchQuery.trim()) {
      debugSearch('Search query executed', {
        query: config.searchQuery,
        context: config.context,
      });
      // Search is handled by the respective stores
    }
  }

  // Handle input changes
  function handleInput(event: Event) {
    if (!config) return;

    const target = event.target as HTMLInputElement;
    config.setQuery(target.value);
  }

  // Handle keyboard shortcuts
  function handleKeydown(event: KeyboardEvent) {
    if (!config) return;

    switch (event.key) {
      case 'Enter':
        handleSearch();
        break;
      case 'Escape':
        config.clearQuery();
        inputElement?.blur();
        break;
    }
  }

  // Clear search
  function handleClear() {
    if (!config) return;

    config.clearQuery();
    inputElement?.focus();
  }
</script>

{#if config}
  <div class="search-container" class:focused={searchFocused && !disabled} class:disabled>
    <div class="search-input-wrapper">
      <img src="/icons/magnifyingglass.svg" alt="Search" class="search-icon" />
      <input
        bind:this={inputElement}
        type="text"
        placeholder={disabled ? '' : config.placeholder}
        value={config.searchQuery}
        oninput={disabled ? undefined : handleInput}
        onfocus={disabled ? undefined : () => (searchFocused = true)}
        onblur={disabled ? undefined : () => (searchFocused = false)}
        onkeydown={disabled ? undefined : handleKeydown}
        class="search-input"
        {disabled}
        readonly={disabled}
        aria-label={config.placeholder}
        role="searchbox"
      />
      {#if config.searchQuery && !disabled}
        <button class="search-clear" onclick={handleClear} aria-label="Clear search" type="button">
          <img src="/icons/close.svg" alt="Clear" />
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .search-container {
    position: relative;
    width: 240px;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 9999px;
    transition: all 0.15s ease;
    height: 36px;
  }

  .search-container.focused .search-input-wrapper {
    border-color: var(--accent-blue);
    border-width: 3px;
    padding: 0;
    margin: -2px;
  }

  /* Active search indicator */
  .search-container:has(.search-input:not(:placeholder-shown)) .search-input-wrapper {
    border-color: var(--accent-blue);
    background-color: rgba(0, 163, 255, 0.05);
  }

  /* Disabled state */
  .search-container.disabled .search-input-wrapper {
    opacity: 0.5;
    background-color: var(--bg-secondary);
    border-color: var(--border-primary);
  }

  .search-container.disabled .search-input {
    color: var(--text-tertiary);
    cursor: not-allowed;
  }

  .search-container.disabled .search-icon {
    opacity: 0.3;
  }

  .search-icon {
    width: 16px;
    height: 16px;
    opacity: 0.5;
    margin-left: 12px;
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    padding: 0 12px;
    color: var(--text-primary);
    font-size: 14px;
    min-width: 0;
    height: 100%;
    width: 100%;
  }

  .search-input::placeholder {
    color: var(--text-tertiary);
  }

  .search-clear {
    width: 20px;
    height: 20px;
    background: none;
    border: none;
    margin-right: 8px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.15s ease;
    cursor: default;
  }

  /* Search clear button - no hover state */

  .search-clear img {
    width: 12px;
    height: 12px;
    opacity: 0.5;
  }

  /* Responsive adjustments */
  @media (max-width: 1024px) {
    .search-container {
      width: 220px;
    }
  }

  @media (max-width: 768px) {
    .search-container {
      width: 180px;
    }
  }

  @media (max-width: 480px) {
    .search-container {
      width: 150px;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .search-input-wrapper {
      border-width: 2px;
    }
  }

  /* Accessibility improvements */
  @media (prefers-reduced-motion: reduce) {
    .search-input-wrapper {
      transition: none;
    }
  }
</style>
