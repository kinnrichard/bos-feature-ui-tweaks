<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  
  let {
    message = '',
    type = 'info' as 'info' | 'success' | 'error' | 'warning',
    duration = 3000,
    visible = true,
    onDismiss = undefined as (() => void) | undefined
  } = $props();

  let timer: ReturnType<typeof setTimeout> | null = null;

  function startTimer() {
    if (duration > 0 && visible) {
      timer = setTimeout(() => {
        visible = false;
        if (onDismiss) onDismiss();
      }, duration);
    }
  }

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function handleDismiss() {
    clearTimer();
    visible = false;
    if (onDismiss) onDismiss();
  }

  $effect(() => {
    if (visible) {
      startTimer();
    }
    return () => clearTimer();
  });

  const typeColors = {
    info: 'var(--accent-blue)',
    success: 'var(--accent-green)',
    error: 'var(--accent-red)',
    warning: 'var(--accent-orange)'
  };

  const backgroundColor = $derived(typeColors[type] || typeColors.info);
</script>

{#if visible && message}
  <div 
    class="toast {type}"
    data-testid="toast-message"
    style:background-color={backgroundColor}
    transition:fly={{ y: -20, duration: 200 }}
  >
    <span class="toast-message">{message}</span>
    <button 
      class="toast-dismiss"
      onclick={handleDismiss}
      aria-label="Dismiss"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: 400px;
  }

  .toast-message {
    flex: 1;
    line-height: 1.4;
  }

  .toast-dismiss {
    background: none;
    border: none;
    color: white;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.15s ease;
    flex-shrink: 0;
  }

  .toast-dismiss:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }

  .toast-dismiss:focus {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    .toast {
      right: 10px;
      left: 10px;
      max-width: none;
    }
  }
</style>