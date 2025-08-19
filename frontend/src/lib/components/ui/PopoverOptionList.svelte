<script lang="ts">
  let {
    options,
    loading = false,
    maxHeight = '',
    onOptionClick,
    isSelected = () => false,
    optionContent
  }: {
    options: Array<{
      id: string;
      [key: string]: any;
    }>;
    loading?: boolean;
    maxHeight?: string;
    onOptionClick: (option: any, event?: MouseEvent) => void;
    isSelected?: (option: any) => boolean;
    optionContent?: import('svelte').Snippet<[{ option: any }]>;
  } = $props();

  function handleOptionClick(option: any, event: MouseEvent) {
    if (loading) return;
    
    // Prevent event from bubbling and interfering with hover state
    event.stopPropagation();
    
    // Use requestAnimationFrame to defer the callback
    // This preserves hover state during the click handling
    requestAnimationFrame(() => {
      onOptionClick(option, event);
    });
  }
</script>

<div class="option-list" style:max-height={maxHeight}>
  {#each options as option}
    <button 
      type="button"
      class="option-item"
      class:selected={isSelected(option)}
      disabled={loading}
      onclick={(event) => handleOptionClick(option, event)}
    >
      {@render optionContent?.({ option })}
    </button>
  {/each}
</div>

<style>
  .option-list {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .option-item {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    min-height: 31px;
    background: none;
    border: none;
    border-radius: 8px;
    transition: background-color 0.15s ease;
    text-align: left;
    width: 100%;
    /* Hardware acceleration to prevent transition interruption */
    will-change: background-color;
    transform: translateZ(0);
    /* Stabilize composite layer to prevent flicker during DOM updates */
    backface-visibility: hidden;
  }

  .option-item:hover:not(:disabled) {
    background-color: var(--bg-tertiary);
  }

  .option-item:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Accessibility improvements */
  @media (prefers-reduced-motion: reduce) {
    .option-item {
      transition: none;
    }
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .option-list {
      max-height: min(300px, 40vh);
    }
  }
</style>