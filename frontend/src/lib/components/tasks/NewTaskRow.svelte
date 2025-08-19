<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { TaskInputManager } from '$lib/utils/task-input-manager';
  import type { TaskCreationState } from '$lib/stores/taskCreation.svelte';
  import '../../styles/task-components.scss';

  // Props
  let {
    mode = 'bottom-row',
    depth = 0,
    manager,
    taskState,
    onStateChange,
    isEmptyList = false
  }: {
    mode?: 'bottom-row' | 'inline-after-task';
    depth?: number;
    manager: TaskInputManager;
    taskState?: TaskCreationState;
    onStateChange?: (changes: Partial<TaskCreationState>) => void;
    isEmptyList?: boolean;
  } = $props();

  const dispatch = createEventDispatcher();

  // Derive state from unified state object
  const isShowing = $derived(taskState?.isShowing ?? false);
  const title = $derived(taskState?.title ?? '');
  
  // Local state
  let inputElement = $state<HTMLInputElement>();
  let isHovered = $state(false);

  function handleRowClick(event: MouseEvent) {
    if (mode === 'bottom-row' && !isShowing) {
      manager.show(event);
    }
  }

  function handleShowTask(event: MouseEvent) {
    manager.show(event);
  }

  // Focus input when showing - pure DOM manipulation, no state updates
  $effect(() => {
    if (isShowing && inputElement) {
      inputElement.focus();
      // No state updates needed - DOM stays local to component
    }
  });
</script>

<div 
  class="task-item task-item-add-new"
  class:is-empty-list={isEmptyList}
  class:is-hovered={isHovered}
  style="--depth: {depth}"
  onclick={handleRowClick}
  onmouseenter={() => isHovered = true}
  onmouseleave={() => isHovered = false}
  data-testid={mode === 'bottom-row' ? 'create-task-button' : undefined}
>
  <!-- Disclosure Spacer -->
  <div class="disclosure-spacer"></div>

  <!-- Invisible Status for Spacing -->
  <div class="task-status">
    <div class="status-emoji">
      <img 
        src={isHovered ? '/icons/plus-circle-blue.svg' : '/icons/plus-circle.svg'}
        alt="Add task" 
        style="width: 16px; height: 16px; {mode === 'bottom-row' ? 'pointer-events: none;' : ''}" 
      />
    </div>
  </div>
  
  <!-- Task Content -->
  <div class="task-content">
    {#if isShowing}
      <input 
        class="task-title task-title-input"
        value={title}
        bind:this={inputElement}
        placeholder="New Task"
        data-testid="task-title-input"
        onkeydown={manager.handlers.keydown}
        onblur={manager.handlers.blur}
        oninput={(e) => {
          const newTitle = e.target.value;
          onStateChange?.({ title: newTitle });
          dispatch('titlechange', { value: newTitle });
        }}
      />
    {:else if mode === 'bottom-row'}
      <h5 
        class="task-title add-task-placeholder"
        onclick={handleShowTask}
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

<style>
  /* Component-specific styles will inherit from parent TaskList styles */
  /* NEW: added display: flex to task-item-add-new to expand input box to the end when inputting; Added By Richard 08/05/2025*/
  .task-item-add-new {
    display: flex;
    opacity: 0.7;
  }

  .task-item-add-new.is-hovered .add-task-placeholder {
    opacity: 1;
    cursor: default;
    transition: color 0.2s ease, opacity 0.2s ease;
  }

  .task-item-add-new .add-task-placeholder {
    opacity: 0.5;
    transition: opacity 0.2s ease;
  }

  .task-content {
    flex: 1;
    display: flex;
  }

  .task-title-input {
    width: 100%;
    min-width: 0;
    flex: 1;
    box-sizing: border-box;
  }
  
  .add-task-placeholder {
    opacity: 0.5;
  }
  
  .add-task-placeholder:hover {
    opacity: 1;
  }
</style>