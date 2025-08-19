# TASKLIST-007: Modals & Overlays

## Story Details

### TASKLIST-007: Modals & Overlays
**Points**: 2  
**Type**: Technical Refactoring  
**Priority**: Medium  
**Epic**: TaskList Component Refactoring  
**Depends on**: TASKLIST-001, TASKLIST-002  

**As a** developer  
**I want** to extract modal and overlay components from the TaskList  
**So that** task deletion, development alerts, and overlay patterns are reusable and maintainable

**Acceptance Criteria:**
- [ ] Create `TaskDeleteModal.svelte` for task deletion confirmation
- [ ] Extract `DevelopmentAlerts.svelte` for development-specific UI warnings
- [ ] Create `ModalProvider.svelte` for centralized modal management
- [ ] Implement `OverlayManager.svelte` for z-index and focus management
- [ ] Support keyboard navigation (Enter, Escape) for all modals
- [ ] Implement click-outside-to-close functionality
- [ ] Focus management and accessibility (ARIA, focus trap)
- [ ] Use Svelte 5 runes for modal state management
- [ ] Integrate with existing task operations store
- [ ] Support animated entry/exit transitions
- [ ] Prevent body scroll when modals are open
- [ ] Screen reader compatibility

**Technical Implementation:**

**1. TaskDeleteModal Component:**
```svelte
<!-- lib/components/modals/TaskDeleteModal.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { taskOperations } from '$lib/stores/taskOperations.svelte';
  import type { Task } from '$lib/types/task';
  import Modal from './Modal.svelte';

  interface Props {
    task: Task;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (taskId: string) => void;
  }

  let { task, isOpen, onClose, onConfirm }: Props = $props();

  let isDeleting = $state(false);
  let deleteError = $state<string | null>(null);

  async function handleDelete() {
    if (isDeleting) return;

    isDeleting = true;
    deleteError = null;

    try {
      await taskOperations.deleteTask(task.id);
      onConfirm(task.id);
      onClose();
    } catch (error: any) {
      deleteError = error.message || 'Failed to delete task';
      isDeleting = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleDelete();
    }
  }

  // Clear error when modal closes
  $effect(() => {
    if (!isOpen) {
      deleteError = null;
      isDeleting = false;
    }
  });
</script>

<Modal {isOpen} {onClose} title="Delete Task" size="small">
  <div class="delete-modal-content">
    <div class="warning-icon">⚠️</div>
    
    <div class="delete-message">
      <h4>Delete "{task.title}"?</h4>
      <p>This action cannot be undone. The task and all its data will be permanently removed.</p>
      
      {#if task.subtasks && task.subtasks.length > 0}
        <div class="subtasks-warning">
          <p><strong>Warning:</strong> This task has {task.subtasks.length} subtask{task.subtasks.length !== 1 ? 's' : ''} that will also be deleted.</p>
        </div>
      {/if}

      {#if deleteError}
        <div class="error-message" role="alert">
          {deleteError}
        </div>
      {/if}
    </div>

    <div class="modal-actions">
      <button
        class="cancel-button"
        onclick={onClose}
        disabled={isDeleting}
      >
        Cancel
      </button>
      
      <button
        class="delete-button"
        onclick={handleDelete}
        onkeydown={handleKeydown}
        disabled={isDeleting}
        aria-label="Confirm deletion"
      >
        {#if isDeleting}
          <span class="spinner">⏳</span>
          Deleting...
        {:else}
          Delete Task
        {/if}
      </button>
    </div>
  </div>
</Modal>

<style>
  .delete-modal-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 20px;
  }

  .warning-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .delete-message {
    margin-bottom: 24px;
  }

  .delete-message h4 {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px 0;
  }

  .delete-message p {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 0 0 8px 0;
    line-height: 1.5;
  }

  .subtasks-warning {
    background-color: var(--bg-warning);
    border: 1px solid var(--border-warning);
    border-radius: 6px;
    padding: 12px;
    margin-top: 12px;
  }

  .subtasks-warning p {
    color: var(--text-warning);
    margin: 0;
    font-size: 13px;
  }

  .error-message {
    background-color: var(--bg-error);
    border: 1px solid var(--border-error);
    border-radius: 6px;
    padding: 8px 12px;
    margin-top: 12px;
    color: var(--text-error);
    font-size: 13px;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .cancel-button {
    padding: 8px 16px;
    background: none;
    border: 1px solid var(--border-primary);
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    color: var(--text-primary);
    transition: all 0.15s ease;
  }

  .cancel-button:hover:not(:disabled) {
    background-color: var(--bg-secondary);
    border-color: var(--border-secondary);
  }

  .cancel-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .delete-button {
    padding: 8px 16px;
    background-color: var(--accent-red);
    border: 1px solid var(--accent-red);
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    color: white;
    font-weight: 500;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .delete-button:hover:not(:disabled) {
    background-color: var(--accent-red-dark);
    border-color: var(--accent-red-dark);
  }

  .delete-button:focus-visible {
    outline: 2px solid var(--accent-red);
    outline-offset: 2px;
  }

  .delete-button:disabled {
    opacity: 0.8;
    cursor: not-allowed;
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
```

**2. Modal Base Component:**
```svelte
<!-- lib/components/modals/Modal.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { modalManager } from '$lib/stores/modalManager.svelte';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    size?: 'small' | 'medium' | 'large';
    closeOnOutsideClick?: boolean;
    closeOnEscape?: boolean;
    children: any;
  }

  let {
    isOpen,
    onClose,
    title = '',
    size = 'medium',
    closeOnOutsideClick = true,
    closeOnEscape = true,
    children
  }: Props = $props();

  let modalElement: HTMLElement;
  let backdropElement: HTMLElement;
  let previousActiveElement: HTMLElement | null = null;

  // Focus management
  $effect(() => {
    if (isOpen) {
      // Store current focus
      previousActiveElement = document.activeElement as HTMLElement;
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      // Register with modal manager
      modalManager.openModal();
      
      // Focus modal after render
      setTimeout(() => {
        modalElement?.focus();
      }, 0);
    } else {
      // Restore body scroll
      document.body.style.overflow = '';
      
      // Unregister from modal manager
      modalManager.closeModal();
      
      // Restore focus
      if (previousActiveElement) {
        previousActiveElement.focus();
      }
    }
  });

  function handleBackdropClick(event: MouseEvent) {
    if (closeOnOutsideClick && event.target === backdropElement) {
      onClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) return;

    if (closeOnEscape && event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }

    // Focus trap
    if (event.key === 'Tab') {
      trapFocus(event);
    }
  }

  function trapFocus(event: KeyboardEvent) {
    const focusableElements = modalElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
    // Cleanup on unmount
    document.body.style.overflow = '';
  });
</script>

{#if isOpen}
  <div 
    bind:this={backdropElement}
    class="modal-backdrop"
    onclick={handleBackdropClick}
    role="dialog"
    aria-modal="true"
    aria-labelledby={title ? 'modal-title' : undefined}
  >
    <div 
      bind:this={modalElement}
      class="modal-container {size}"
      tabindex="-1"
    >
      {#if title}
        <div class="modal-header">
          <h3 id="modal-title" class="modal-title">{title}</h3>
          <button
            class="close-button"
            onclick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
      {/if}

      <div class="modal-body">
        {@render children()}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
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
    padding: 20px;
    animation: fadeIn 0.2s ease-out;
  }

  .modal-container {
    background-color: var(--bg-primary);
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    max-height: 90vh;
    overflow-y: auto;
    animation: slideIn 0.2s ease-out;
    outline: none;
  }

  .modal-container.small {
    max-width: 400px;
    width: 100%;
  }

  .modal-container.medium {
    max-width: 600px;
    width: 100%;
  }

  .modal-container.large {
    max-width: 800px;
    width: 100%;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 20px 0 20px;
    border-bottom: 1px solid var(--border-primary);
    margin-bottom: 20px;
  }

  .modal-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    color: var(--text-secondary);
    transition: all 0.15s ease;
  }

  .close-button:hover {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .close-button:focus-visible {
    outline: 2px solid var(--accent-blue);
    outline-offset: 2px;
  }

  .modal-body {
    padding: 0 20px 20px 20px;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
```

**3. DevelopmentAlerts Component:**
```svelte
<!-- lib/components/alerts/DevelopmentAlerts.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    environment?: string;
    showDragDropHelp?: boolean;
    showKeyboardShortcuts?: boolean;
  }

  let {
    environment = 'development',
    showDragDropHelp = true,
    showKeyboardShortcuts = true
  }: Props = $props();

  let dismissedAlerts = $state(new Set<string>());
  let showEnvironmentBanner = $derived(environment === 'development' && !dismissedAlerts.has('environment'));
  let showDragHelp = $derived(showDragDropHelp && !dismissedAlerts.has('drag-help'));
  let showKeyboardHelp = $derived(showKeyboardShortcuts && !dismissedAlerts.has('keyboard-help'));

  function dismissAlert(alertId: string) {
    dismissedAlerts.add(alertId);
    // Store in localStorage to persist across sessions
    localStorage.setItem(`dismissed-alert-${alertId}`, 'true');
  }

  onMount(() => {
    // Restore dismissed alerts from localStorage
    const alertIds = ['environment', 'drag-help', 'keyboard-help'];
    alertIds.forEach(id => {
      if (localStorage.getItem(`dismissed-alert-${id}`) === 'true') {
        dismissedAlerts.add(id);
      }
    });
  });
</script>

{#if showEnvironmentBanner}
  <div class="dev-alert environment-banner" role="banner">
    <div class="alert-content">
      <span class="alert-icon">🚧</span>
      <div class="alert-text">
        <strong>Development Mode</strong>
        <p>You're running in development mode. Some features may behave differently than in production.</p>
      </div>
    </div>
    <button
      class="dismiss-button"
      onclick={() => dismissAlert('environment')}
      aria-label="Dismiss development banner"
    >
      ✕
    </button>
  </div>
{/if}

{#if showDragHelp}
  <div class="dev-alert drag-help" role="complementary">
    <div class="alert-content">
      <span class="alert-icon">🖱️</span>
      <div class="alert-text">
        <strong>Drag & Drop Tip</strong>
        <p>Drag tasks to reorder or nest them. Hold near the center to nest, near edges to reorder.</p>
      </div>
    </div>
    <button
      class="dismiss-button"
      onclick={() => dismissAlert('drag-help')}
      aria-label="Dismiss drag and drop tip"
    >
      ✕
    </button>
  </div>
{/if}

{#if showKeyboardHelp}
  <div class="dev-alert keyboard-help" role="complementary">
    <div class="alert-content">
      <span class="alert-icon">⌨️</span>
      <div class="alert-text">
        <strong>Keyboard Shortcuts</strong>
        <p>
          Use <kbd>↑</kbd><kbd>↓</kbd> to navigate, <kbd>Enter</kbd> to create tasks, 
          <kbd>Del</kbd> to delete, <kbd>Esc</kbd> to clear selection
        </p>
      </div>
    </div>
    <button
      class="dismiss-button"
      onclick={() => dismissAlert('keyboard-help')}
      aria-label="Dismiss keyboard shortcuts tip"
    >
      ✕
    </button>
  </div>
{/if}

<style>
  .dev-alert {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 12px 16px;
    margin-bottom: 16px;
    border-radius: 8px;
    border-left: 4px solid;
    animation: slideDown 0.3s ease-out;
  }

  .environment-banner {
    background-color: var(--bg-warning);
    border-color: var(--accent-yellow);
    color: var(--text-warning);
  }

  .drag-help {
    background-color: var(--bg-info);
    border-color: var(--accent-blue);
    color: var(--text-info);
  }

  .keyboard-help {
    background-color: var(--bg-success);
    border-color: var(--accent-green);
    color: var(--text-success);
  }

  .alert-content {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    flex: 1;
  }

  .alert-icon {
    font-size: 20px;
    line-height: 1;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .alert-text {
    flex: 1;
  }

  .alert-text strong {
    display: block;
    font-weight: 600;
    margin-bottom: 4px;
    font-size: 14px;
  }

  .alert-text p {
    margin: 0;
    font-size: 13px;
    line-height: 1.4;
    opacity: 0.9;
  }

  .dismiss-button {
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    color: currentColor;
    opacity: 0.7;
    transition: all 0.15s ease;
    flex-shrink: 0;
    margin-left: 12px;
  }

  .dismiss-button:hover {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.1);
  }

  .dismiss-button:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  kbd {
    display: inline-block;
    padding: 2px 4px;
    font-size: 11px;
    font-family: monospace;
    background-color: rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 3px;
    margin: 0 1px;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
```

**4. Modal Manager Store:**
```typescript
// lib/stores/modalManager.svelte.ts
export class ModalManagerStore {
  private openModals = $state(0);
  private originalOverflow = $state('');

  openModal() {
    if (this.openModals === 0) {
      // Store original overflow value
      this.originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    this.openModals++;
  }

  closeModal() {
    this.openModals = Math.max(0, this.openModals - 1);
    
    if (this.openModals === 0) {
      // Restore original overflow
      document.body.style.overflow = this.originalOverflow;
    }
  }

  get hasOpenModals(): boolean {
    return this.openModals > 0;
  }

  get modalCount(): number {
    return this.openModals;
  }

  // Force close all modals (for emergency cleanup)
  closeAllModals() {
    this.openModals = 0;
    document.body.style.overflow = this.originalOverflow;
  }
}

export const modalManager = new ModalManagerStore();
```

**5. Enhanced Task Operations Store (Modal Integration):**
```typescript
// lib/stores/taskOperations.svelte.ts (Enhanced for modal integration)
export class TaskOperationsStore {
  // ... existing properties ...

  private deleteModalOpen = $state(false);
  private taskToDelete = $state<Task | null>(null);

  // Modal state getters
  get isDeleteModalOpen(): boolean {
    return this.deleteModalOpen;
  }

  get pendingDeleteTask(): Task | null {
    return this.taskToDelete;
  }

  // Show delete confirmation modal
  showDeleteConfirmation(task: Task) {
    this.taskToDelete = task;
    this.deleteModalOpen = true;
  }

  // Hide delete modal
  hideDeleteModal() {
    this.deleteModalOpen = false;
    this.taskToDelete = null;
  }

  // Confirm deletion (called from modal)
  async confirmDelete(taskId: string): Promise<void> {
    if (!this.taskToDelete || this.taskToDelete.id !== taskId) {
      throw new Error('Invalid task deletion attempt');
    }

    this.isLoading = true;

    try {
      // Delete from server
      await tasksService.deleteTask(this.jobId, taskId);
      
      // Remove from local state
      this.tasks = this.tasks.filter(t => t.id !== taskId);
      
      // Also remove any child tasks
      this.tasks = this.tasks.filter(t => t.parent_id !== taskId);
      
      this.hideDeleteModal();
    } catch (error: any) {
      this.error = error.message || 'Failed to delete task';
      setTimeout(() => this.error = null, 3000);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Enhanced delete method that shows confirmation
  async deleteTaskWithConfirmation(taskId: string): Promise<void> {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    this.showDeleteConfirmation(task);
  }
}
```

**Migration Strategy:**
1. Create modal components alongside existing TaskList implementation
2. Add feature flag to switch between old/new modal patterns
3. Test modal functionality independently with mock data
4. Integrate modals one by one into TaskList workflows
5. Verify accessibility and keyboard navigation work correctly

**Testing Strategy:**
- Unit tests for modal state management and focus handling
- Integration tests for task deletion workflow
- Accessibility tests for keyboard navigation and screen readers
- Visual tests for modal animations and positioning
- Touch device tests for mobile modal interactions

**Acceptance Testing:**
- All modal operations work identically to current implementation
- Keyboard navigation works as expected (Tab, Enter, Escape)
- Focus management is proper (focus trap, restoration)
- Click-outside-to-close works correctly
- Screen reader compatibility maintained

**Accessibility Features:**
- Proper ARIA roles and labels for all modals
- Focus trap within modals during interaction
- Focus restoration when modals close
- Keyboard navigation support
- Screen reader announcements for modal state changes

**Performance Considerations:**
- Lazy loading of modal content when possible
- Efficient DOM manipulation for show/hide
- Debounced outside click detection
- Optimized animation performance
- Memory cleanup when modals unmount

**Dependencies:**
- Requires task operations store from TASKLIST-001
- Uses existing Task type definitions and API services
- Integrates with development environment configuration
- Uses shared styling and design tokens