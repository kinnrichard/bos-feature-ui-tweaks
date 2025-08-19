# TASKLIST-006: Creation Forms

## Story Details

### TASKLIST-006: Creation Forms
**Points**: 2  
**Type**: Technical Refactoring  
**Priority**: Medium  
**Epic**: TaskList Component Refactoring  
**Depends on**: TASKLIST-001, TASKLIST-002  

**As a** developer  
**I want** to extract task creation forms into dedicated components  
**So that** task creation logic is modular, reusable, and provides consistent UX

**Acceptance Criteria:**
- [ ] Create `NewTaskForm.svelte` for bottom "New Task" row
- [ ] Extract `InlineTaskForm.svelte` for inline creation between tasks
- [ ] Create `TaskCreationControls.svelte` for shared creation logic
- [ ] Implement proper keyboard handling (Enter to save, Escape to cancel)
- [ ] Support both blur-to-save and explicit save patterns
- [ ] Auto-focus form inputs when activated
- [ ] Show loading states during task creation
- [ ] Handle creation errors with user feedback
- [ ] Use Svelte 5 runes for form state management
- [ ] Integrate with task operations store from TASKLIST-001
- [ ] Support positioning new tasks correctly in hierarchy
- [ ] Preserve creation state during errors
- [ ] Accessible form labels and error messages

**Technical Implementation:**

**1. NewTaskForm Component (Bottom Row):**
```svelte
<!-- lib/components/creation/NewTaskForm.svelte -->
<script lang="ts">
  import { tick } from 'svelte';
  import { taskOperations } from '$lib/stores/taskOperations.svelte';
  import { taskSelection } from '$lib/stores/taskSelection.svelte';
  import TaskCreationControls from './TaskCreationControls.svelte';

  interface Props {
    jobId: string;
    onTaskCreated?: (task: any) => void;
    onCancel?: () => void;
  }

  let { jobId, onTaskCreated, onCancel }: Props = $props();

  let showForm = $state(false);
  let title = $state('');
  let isCreating = $state(false);
  let error = $state<string | null>(null);
  let inputElement: HTMLInputElement;

  // Auto-focus when form is shown
  $effect(() => {
    if (showForm && inputElement) {
      tick().then(() => inputElement?.focus());
    }
  });

  function showNewTaskForm() {
    showForm = true;
    title = '';
    error = null;
  }

  function hideForm() {
    showForm = false;
    title = '';
    error = null;
    if (onCancel) onCancel();
  }

  async function createTask(options: { selectAfterCreate?: boolean } = {}) {
    if (!title.trim() || isCreating) return;

    isCreating = true;
    error = null;

    try {
      const newTask = await taskOperations.createTask({
        title: title.trim(),
        status: 'new_task',
        position: getNextPosition()
      });

      // Select newly created task if requested (Enter key)
      if (options.selectAfterCreate && newTask) {
        taskSelection.selectTask(newTask.id);
      }

      hideForm();

      if (onTaskCreated && newTask) {
        onTaskCreated(newTask);
      }
    } catch (err: any) {
      error = err.message || 'Failed to create task';
      // Keep form open on error so user can retry
    } finally {
      isCreating = false;
    }
  }

  function getNextPosition(): number {
    // Position at end of all root tasks
    const rootTasks = taskOperations.tasks.filter(t => !t.parent_id);
    return rootTasks.length > 0 
      ? Math.max(...rootTasks.map(t => t.position || 0)) + 1 
      : 1;
  }

  async function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      await createTask({ selectAfterCreate: true });
    } else if (event.key === 'Escape') {
      event.preventDefault();
      hideForm();
    }
  }

  async function handleBlur() {
    // Save on blur if there's content and no error state
    if (title.trim() && !isCreating && !error) {
      await createTask({ selectAfterCreate: false });
    } else if (!title.trim() && !isCreating) {
      hideForm();
    }
  }
</script>

<div class="new-task-form-container">
  <div 
    class="task-item task-item-add-new"
    style:--depth={0}
  >
    <!-- Disclosure Spacer -->
    <div class="disclosure-spacer"></div>

    <!-- Add Icon -->
    <div class="task-status">
      <div class="status-emoji">
        <img 
          src="/icons/plus-circle.svg" 
          alt="Add task" 
          style:width="16px" 
          style:height="16px" 
          style:opacity="0.6"
          style:pointer-events="none"
        />
      </div>
    </div>
    
    <!-- Task Content -->
    <div class="task-content">
      {#if showForm}
        <TaskCreationControls
          bind:title={title}
          bind:inputElement={inputElement}
          {isCreating}
          {error}
          placeholder="New Task"
          onKeydown={handleKeydown}
          onBlur={handleBlur}
        />
      {:else}
        <h5 
          class="task-title add-task-placeholder"
          onclick={showNewTaskForm}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              showNewTaskForm();
            }
          }}
          role="button"
          tabindex="0"
          aria-label="Create new task"
        >
          New Task
        </h5>
      {/if}
    </div>

    <!-- Task Metadata (empty for spacing) -->
    <div class="task-metadata"></div>

    <!-- Task Actions (empty - no info button) -->
    <div class="task-actions"></div>
  </div>
</div>

<style>
  .new-task-form-container {
    margin-top: 8px;
  }

  .task-item-add-new {
    display: flex;
    align-items: flex-start;
    padding: 4px !important;
    padding-left: calc(4px + (var(--depth, 0) * 32px)) !important;
    border: none !important;
    border-radius: 8px !important;
    background-color: transparent;
    transition: all 0.15s ease;
    min-height: 40px;
  }

  .task-item-add-new:hover {
    background-color: var(--bg-tertiary);
  }

  .disclosure-spacer {
    width: 20px;
    height: 20px;
    margin-right: 8px;
  }

  .task-status {
    display: flex;
    align-items: center;
    margin-right: 8px;
  }

  .status-emoji {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
  }

  .task-content {
    flex: 1;
    min-width: 0;
  }

  .add-task-placeholder {
    font-size: 14px;
    font-weight: 400;
    color: var(--text-tertiary);
    margin: 0;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    transition: all 0.15s ease;
    line-height: 1.4;
  }

  .add-task-placeholder:hover {
    color: var(--text-secondary);
    background-color: var(--bg-secondary);
  }

  .add-task-placeholder:focus-visible {
    outline: 2px solid var(--accent-blue);
    outline-offset: 2px;
    color: var(--text-primary);
  }

  .task-metadata,
  .task-actions {
    min-width: 80px; /* Maintain spacing alignment */
  }
</style>
```

**2. InlineTaskForm Component:**
```svelte
<!-- lib/components/creation/InlineTaskForm.svelte -->
<script lang="ts">
  import { tick } from 'svelte';
  import { taskOperations } from '$lib/stores/taskOperations.svelte';
  import { taskSelection } from '$lib/stores/taskSelection.svelte';
  import TaskCreationControls from './TaskCreationControls.svelte';
  import type { Task } from '$lib/types/task';

  interface Props {
    jobId: string;
    afterTaskId: string;
    depth: number;
    onTaskCreated?: (task: Task) => void;
    onCancel?: () => void;
  }

  let { jobId, afterTaskId, depth, onTaskCreated, onCancel }: Props = $props();

  let title = $state('');
  let isCreating = $state(false);
  let error = $state<string | null>(null);
  let inputElement: HTMLInputElement;

  // Auto-focus when component mounts
  $effect(() => {
    tick().then(() => inputElement?.focus());
  });

  async function createTask(options: { selectAfterCreate?: boolean } = {}) {
    if (!title.trim() || isCreating) return;

    isCreating = true;
    error = null;

    try {
      const afterTask = taskOperations.tasks.find(t => t.id === afterTaskId);
      if (!afterTask) {
        throw new Error('Reference task not found');
      }

      const newTask = await taskOperations.createTask({
        title: title.trim(),
        status: 'new_task',
        parent_id: afterTask.parent_id, // Same parent as reference task
        position: calculateInsertPosition(afterTask)
      });

      // Select newly created task if requested (Enter key)
      if (options.selectAfterCreate && newTask) {
        taskSelection.selectTask(newTask.id);
      }

      if (onTaskCreated && newTask) {
        onTaskCreated(newTask);
      }
    } catch (err: any) {
      error = err.message || 'Failed to create task';
      // Keep form open on error so user can retry
    } finally {
      isCreating = false;
    }
  }

  function calculateInsertPosition(afterTask: Task): number {
    // Find siblings at the same level
    const siblings = taskOperations.tasks.filter(t => 
      t.parent_id === afterTask.parent_id && 
      t.id !== afterTaskId
    );

    // Find position after the reference task
    const afterPosition = afterTask.position || 0;
    const nextSibling = siblings.find(t => (t.position || 0) > afterPosition);
    
    if (nextSibling) {
      // Insert between afterTask and nextSibling
      return afterPosition + ((nextSibling.position || 0) - afterPosition) / 2;
    } else {
      // Insert at the end
      return afterPosition + 1;
    }
  }

  function cancel() {
    if (onCancel) onCancel();
  }

  async function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      await createTask({ selectAfterCreate: true });
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  }

  async function handleBlur() {
    // Save on blur if there's content and no error state
    if (title.trim() && !isCreating && !error) {
      await createTask({ selectAfterCreate: false });
    } else if (!title.trim() && !isCreating) {
      cancel();
    }
  }
</script>

<div 
  class="task-item task-item-inline-new"
  style:--depth={depth}
>
  <!-- Disclosure Spacer -->
  <div class="disclosure-spacer"></div>

  <!-- Status Icon -->
  <div class="task-status">
    <div class="status-emoji">
      📋
    </div>
  </div>
  
  <!-- Task Content -->
  <div class="task-content">
    <TaskCreationControls
      bind:title={title}
      bind:inputElement={inputElement}
      {isCreating}
      {error}
      placeholder="New Task"
      onKeydown={handleKeydown}
      onBlur={handleBlur}
    />
  </div>

  <!-- Task Metadata (empty for spacing) -->
  <div class="task-metadata"></div>

  <!-- Task Actions (empty) -->
  <div class="task-actions"></div>
</div>

<style>
  .task-item-inline-new {
    display: flex;
    align-items: flex-start;
    padding: 4px !important;
    padding-left: calc(4px + (var(--depth, 0) * 32px)) !important;
    border: none !important;
    border-radius: 8px !important;
    background-color: var(--bg-secondary);
    border: 1px dashed var(--border-primary);
    min-height: 40px;
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .disclosure-spacer {
    width: 20px;
    height: 20px;
    margin-right: 8px;
  }

  .task-status {
    display: flex;
    align-items: center;
    margin-right: 8px;
  }

  .status-emoji {
    font-size: 16px;
    opacity: 0.6;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .task-content {
    flex: 1;
    min-width: 0;
  }

  .task-metadata,
  .task-actions {
    min-width: 80px; /* Maintain spacing alignment */
  }
</style>
```

**3. TaskCreationControls Component (Shared Logic):**
```svelte
<!-- lib/components/creation/TaskCreationControls.svelte -->
<script lang="ts">
  interface Props {
    title: string;
    inputElement?: HTMLInputElement;
    isCreating: boolean;
    error: string | null;
    placeholder: string;
    onKeydown: (event: KeyboardEvent) => void;
    onBlur: () => void;
  }

  let {
    title = $bindable(),
    inputElement = $bindable(),
    isCreating,
    error,
    placeholder,
    onKeydown,
    onBlur
  }: Props = $props();

  let showError = $derived(!!error);
</script>

<div class="creation-controls">
  <div class="input-container">
    <input 
      bind:this={inputElement}
      bind:value={title}
      class="task-title-input"
      class:error={showError}
      {placeholder}
      onkeydown={onKeydown}
      onblur={onBlur}
      disabled={isCreating}
      aria-label={placeholder}
      aria-invalid={showError}
      aria-describedby={showError ? 'creation-error' : undefined}
    />
    
    {#if isCreating}
      <div class="creating-indicator">
        <span class="spinner" title="Creating task...">⏳</span>
      </div>
    {/if}
  </div>

  {#if showError}
    <div class="error-message" id="creation-error" role="alert">
      {error}
    </div>
  {/if}

  <div class="help-text">
    <span class="help-item">
      <kbd>Enter</kbd> to save and select
    </span>
    <span class="help-item">
      <kbd>Esc</kbd> to cancel
    </span>
    <span class="help-item">
      Blur to save
    </span>
  </div>
</div>

<style>
  .creation-controls {
    width: 100%;
  }

  .input-container {
    position: relative;
    display: flex;
    align-items: center;
  }

  .task-title-input {
    width: 100%;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    background-color: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: 4px;
    padding: 6px 8px;
    line-height: 1.4;
    transition: all 0.15s ease;
  }

  .task-title-input:focus {
    outline: none;
    border-color: var(--accent-blue);
    box-shadow: 0 0 0 2px rgba(0, 163, 255, 0.3);
    background-color: var(--bg-secondary);
  }

  .task-title-input.error {
    border-color: var(--accent-red);
    box-shadow: 0 0 0 2px rgba(255, 69, 58, 0.3);
  }

  .task-title-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .creating-indicator {
    position: absolute;
    right: 8px;
    display: flex;
    align-items: center;
  }

  .spinner {
    font-size: 14px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .error-message {
    margin-top: 4px;
    font-size: 12px;
    color: var(--accent-red);
    font-weight: 500;
  }

  .help-text {
    margin-top: 4px;
    font-size: 11px;
    color: var(--text-tertiary);
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .help-item {
    white-space: nowrap;
  }

  kbd {
    display: inline-block;
    padding: 1px 4px;
    font-size: 10px;
    color: var(--text-primary);
    background-color: var(--bg-tertiary);
    border: 1px solid var(--border-primary);
    border-radius: 3px;
    font-family: monospace;
    font-weight: normal;
  }
</style>
```

**4. Enhanced Task Operations Store (Creation Focus):**
```typescript
// lib/stores/taskOperations.svelte.ts (Enhanced creation methods)
import { tasksService } from '$lib/api/tasks';
import type { Task } from '$lib/types/task';

export class TaskOperationsStore {
  // ... existing properties ...

  private creationQueue = $state(new Map<string, Promise<Task>>());

  // Enhanced create method with position handling
  async createTask(taskData: {
    title: string;
    status?: string;
    parent_id?: string;
    position?: number;
  }): Promise<Task> {
    // Generate temporary ID for optimistic updates
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    
    // Check if we're already creating a task with the same title
    const existingCreation = Array.from(this.creationQueue.values())
      .find(promise => promise.then(task => task.title === taskData.title));
    
    if (existingCreation) {
      return existingCreation;
    }

    this.isLoading = true;
    
    // Create the task promise
    const creationPromise = this.performTaskCreation(taskData);
    this.creationQueue.set(tempId, creationPromise);
    
    try {
      const newTask = await creationPromise;
      
      // Add to local tasks array
      this.tasks.push(newTask);
      
      // Sort tasks to maintain order
      this.sortTasks();
      
      return newTask;
    } catch (error: any) {
      this.error = error.message || 'Failed to create task - please try again';
      setTimeout(() => this.error = null, 3000);
      throw error;
    } finally {
      this.creationQueue.delete(tempId);
      this.isLoading = false;
    }
  }

  private async performTaskCreation(taskData: any): Promise<Task> {
    const response = await tasksService.createTask(this.jobId, {
      title: taskData.title,
      status: taskData.status || 'new_task',
      parent_id: taskData.parent_id || null,
      position: taskData.position || this.getNextRootPosition()
    });
    
    return response.task;
  }

  private getNextRootPosition(): number {
    const rootTasks = this.tasks.filter(t => !t.parent_id);
    return rootTasks.length > 0 
      ? Math.max(...rootTasks.map(t => t.position || 0)) + 1 
      : 1;
  }

  private sortTasks() {
    // Sort tasks by parent relationship and position
    this.tasks.sort((a, b) => {
      // Root tasks first
      if (!a.parent_id && b.parent_id) return -1;
      if (a.parent_id && !b.parent_id) return 1;
      
      // Same parent - sort by position
      if (a.parent_id === b.parent_id) {
        return (a.position || 0) - (b.position || 0);
      }
      
      return 0;
    });
  }

  // Batch creation for multiple tasks
  async createMultipleTasks(tasksData: Array<{
    title: string;
    status?: string;
    parent_id?: string;
    position?: number;
  }>): Promise<Task[]> {
    this.isLoading = true;
    
    try {
      const createdTasks = await Promise.all(
        tasksData.map(taskData => this.performTaskCreation(taskData))
      );
      
      // Add all tasks to local array
      this.tasks.push(...createdTasks);
      this.sortTasks();
      
      return createdTasks;
    } catch (error: any) {
      this.error = 'Failed to create tasks - please try again';
      setTimeout(() => this.error = null, 3000);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Check if creation is in progress
  isCreatingTask(title: string): boolean {
    return Array.from(this.creationQueue.values())
      .some(promise => {
        // This is a bit hacky but works for deduplication
        return promise.then(task => task.title === title).catch(() => false);
      });
  }
}
```

**Migration Strategy:**
1. Create creation components alongside existing TaskList
2. Add feature flag to switch between old/new creation forms
3. Test creation workflows incrementally (bottom form first, then inline)
4. Verify keyboard shortcuts and accessibility
5. Test error handling and loading states

**Testing Strategy:**
- Unit tests for creation logic and form validation
- Integration tests for form workflows (Enter, Escape, blur)
- Keyboard navigation tests for form accessibility
- Error handling tests with network failures
- Position calculation tests for task ordering

**Acceptance Testing:**
- All existing task creation functionality preserved
- Keyboard shortcuts work as expected
- Error handling provides clear user feedback
- Loading states are visible during creation
- Form accessibility meets standards

**User Experience Improvements:**
- Clear visual feedback for form states
- Helpful keyboard shortcuts with hints
- Auto-focus for better workflow
- Smart blur-to-save behavior
- Error recovery without losing form data

**Dependencies:**
- Requires taskOperations store from TASKLIST-001
- Uses taskSelection store for post-creation selection
- Integrates with existing task creation API
- Needs Task type definitions
- Uses shared styling and design tokens