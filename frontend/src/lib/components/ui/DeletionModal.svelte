<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import Portal from './Portal.svelte';

  // Props
  let {
    open = false,
    title = '',
    description = '',
    onCancel = () => {},
    onConfirm = () => {}
  }: {
    open?: boolean;
    title?: string;
    description?: string;
    onCancel?: () => void;
    onConfirm?: () => void;
  } = $props();

  // Focus management
  let modalContainerElement = $state<HTMLElement>();
  let deleteButtonElement = $state<HTMLButtonElement>();
  let previouslyFocusedElement = $state<HTMLElement | null>(null);

  // Store focus when modal opens
  $effect(() => {
    if (open) {
      previouslyFocusedElement = document.activeElement as HTMLElement;
      setupModal();
    } else {
      cleanupModal();
    }
  });

  async function setupModal() {
    // Ensure modal gets focus immediately for keyboard event capture
    await tick();
    
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
      if (modalContainerElement) {
        // Try to focus the modal container first
        modalContainerElement.focus();
        // Prevent focus from escaping the modal
        modalContainerElement.addEventListener('focusout', handleModalFocusOut);
        
        // If modal container didn't get focus, try focusing the delete button
        setTimeout(() => {
          if (open) {
            const activeElement = document.activeElement;
            if (!modalContainerElement.contains(activeElement)) {
              // Try delete button as fallback since buttons are more reliably focusable
              if (deleteButtonElement) {
                deleteButtonElement.focus();
              } else {
                // Final fallback to modal container
                modalContainerElement.focus();
              }
            }
          }
        }, 10);
      }
    }, 0);
  }

  function cleanupModal() {
    // Clean up focus event listener
    if (modalContainerElement) {
      modalContainerElement.removeEventListener('focusout', handleModalFocusOut);
    }
    
    // Return focus to previously focused element
    if (previouslyFocusedElement && document.body.contains(previouslyFocusedElement)) {
      previouslyFocusedElement.focus();
    }
  }

  function handleModalFocusOut(event: FocusEvent) {
    // If focus is leaving the modal but modal is still open, return focus to modal
    if (open && modalContainerElement && !modalContainerElement.contains(event.relatedTarget as Node)) {
      setTimeout(() => {
        if (open && modalContainerElement) {
          modalContainerElement.focus();
        }
      }, 0);
    }
  }

  function handleModalKeydown(event: KeyboardEvent) {
    // Prevent all keyboard events from bubbling to main UI
    event.stopPropagation();
    
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      onConfirm();
    } else if (event.key === 'Tab') {
      // Keep focus within modal by cycling between buttons
      event.preventDefault();
      const buttons = modalContainerElement?.querySelectorAll('button:not(:disabled)');
      if (buttons && buttons.length > 0) {
        const focusedButton = document.activeElement;
        const currentIndex = Array.from(buttons).indexOf(focusedButton as HTMLButtonElement);
        const nextIndex = event.shiftKey 
          ? (currentIndex - 1 + buttons.length) % buttons.length
          : (currentIndex + 1) % buttons.length;
        (buttons[nextIndex] as HTMLButtonElement).focus();
      }
    }
  }

  function handleBackdropClick() {
    onCancel();
  }

  function handleContainerClick(event: MouseEvent) {
    event.stopPropagation();
  }
</script>

{#if open}
  <Portal>
    <div class="modal-backdrop" onclick={handleBackdropClick}>
      <div 
        class="modal-container" 
        bind:this={modalContainerElement} 
        onclick={handleContainerClick} 
        onkeydown={handleModalKeydown} 
        tabindex="-1" 
        autofocus
      >
        <div class="warning-icon">
          <svg class="w-12 h-12" viewBox="0 0 24.5703 30.0293" xmlns="http://www.w3.org/2000/svg">
            <g>
              <rect height="30.0293" opacity="0" width="24.5703" x="0" y="0"/>
              <path d="M8.26172 24.1113C7.8418 24.1113 7.56836 23.8477 7.54883 23.4473L7.14844 9.35547C7.13867 8.94531 7.41211 8.69141 7.85156 8.69141C8.24219 8.69141 8.53516 8.93555 8.54492 9.3457L8.96484 23.4375C8.97461 23.8379 8.69141 24.1113 8.26172 24.1113ZM12.1094 24.1113C11.6895 24.1113 11.3867 23.8379 11.3867 23.4375L11.3867 9.35547C11.3867 8.95508 11.6895 8.69141 12.1094 8.69141C12.5293 8.69141 12.832 8.95508 12.832 9.35547L12.832 23.4375C12.832 23.8379 12.5293 24.1113 12.1094 24.1113ZM15.9473 24.1113C15.5176 24.1113 15.2441 23.8379 15.2539 23.4473L15.6641 9.35547C15.6738 8.94531 15.9668 8.69141 16.3672 8.69141C16.7969 8.69141 17.0703 8.95508 17.0605 9.36523L16.6602 23.4473C16.6406 23.8574 16.3672 24.1113 15.9473 24.1113ZM6.66992 5.58594L8.37891 5.58594L8.37891 2.90039C8.37891 2.11914 8.91602 1.61133 9.75586 1.61133L14.4336 1.61133C15.2734 1.61133 15.8105 2.11914 15.8105 2.90039L15.8105 5.58594L17.5195 5.58594L17.5195 2.80273C17.5195 1.06445 16.3965 0 14.5312 0L9.6582 0C7.80273 0 6.66992 1.06445 6.66992 2.80273ZM0.810547 6.43555L23.3984 6.43555C23.8477 6.43555 24.209 6.06445 24.209 5.625C24.209 5.17578 23.8477 4.80469 23.3984 4.80469L0.810547 4.80469C0.380859 4.80469 0 5.18555 0 5.625C0 6.07422 0.380859 6.43555 0.810547 6.43555ZM6.37695 27.8906L17.8516 27.8906C19.5312 27.8906 20.7129 26.748 20.8008 25.0684L21.7285 6.18164L2.49023 6.18164L3.41797 25.0781C3.50586 26.7578 4.66797 27.8906 6.37695 27.8906Z" fill="#ff453a"/>
            </g>
          </svg>
        </div>
        
        <h2 class="modal-title">{title}</h2>
        
        {#if description}
          <p class="modal-description">{description}</p>
        {/if}
                
        <div class="modal-buttons">
          <button class="button button--secondary" onclick={onCancel}>
            Cancel
          </button>
          <button class="button button--danger" bind:this={deleteButtonElement} onclick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  </Portal>
{/if}

<style>
  /* Delete Confirmation Modal Styles */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(1px);
  }

  .modal-container {
    background: #000000;
    border: 1px solid #374151;
    border-radius: 12px;
    padding: 24px;
    max-width: 20rem;
    outline: none;
    box-shadow: 0 20px 30px rgba(0, 0, 0, 0.3);
  }

  .warning-icon {
    display: flex;
    align-items: center;
    margin-bottom: 16px;
    height: 48px;
    width: 48px;
  }

  .modal-title {
    color: white;
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
  }

  .modal-description {
    color: #d1d5db;
    margin-bottom: 16px;
    font-size: 16px;
  }

  .modal-buttons {
    display: flex;
    gap: 16px;
  }

  .button {
    border-radius: 9999px;
    padding: 6px 12px;
    font-weight: 500;
    flex: 1;
    border: none;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    font-size: 16px;
  }

  .button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .button--secondary {
    background: #374151;
    color: white;
  }

  .button--secondary:hover:not(:disabled) {
    background: #4b5563;
  }

  .button--danger {
    background: #991b1b;
    color: #fff;
  }

  .button--danger:hover:not(:disabled) {
    background: #7f1d1d;
  }
</style>