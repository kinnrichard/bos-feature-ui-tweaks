# TASKLIST-002: Core Task Components

## Story Details

### TASKLIST-002: Core Task Components
**Points**: 3  
**Type**: Technical Refactoring  
**Priority**: Critical  
**Epic**: TaskList Component Refactoring  
**Depends on**: TASKLIST-001  

**As a** developer  
**I want** to extract core task display components from the monolithic TaskList  
**So that** task rendering is modular, reusable, and easier to maintain

**Acceptance Criteria:**
- [ ] Create `TaskItem.svelte` as the main task row component
- [ ] Extract `TaskStatusBadge.svelte` for status emoji and interaction
- [ ] Create `TaskTitle.svelte` with inline editing functionality
- [ ] Extract `TaskMetadata.svelte` for time tracking, assignment, and notes
- [ ] Create `TaskActions.svelte` for info popover and action buttons
- [ ] All components use Svelte 5 runes (`$props`, `$state`, `$derived`)
- [ ] Implement modern event handling (`onclick` instead of `on:click`)
- [ ] Use snippets for reusable markup patterns where appropriate
- [ ] Maintain exact visual design and spacing
- [ ] Preserve all existing functionality (editing, time tracking, etc.)
- [ ] TypeScript interfaces for all component props
- [ ] Accessibility attributes preserved (ARIA, roles, etc.)
- [ ] Component tests for each extracted component

**Technical Implementation:**

**1. TaskItem Component (Main Container):**
```svelte
<!-- lib/components/tasks/TaskItem.svelte -->
<script lang="ts">
  import type { Task, TaskSelectionState } from '$lib/types/task';
  import TaskStatusBadge from './TaskStatusBadge.svelte';
  import TaskTitle from './TaskTitle.svelte';
  import TaskMetadata from './TaskMetadata.svelte';
  import TaskActions from './TaskActions.svelte';
  import TaskIndentation from './TaskIndentation.svelte';

  interface Props {
    task: Task;
    depth: number;
    isSelected: boolean;
    selectionPosition: 'top' | 'middle' | 'bottom' | '';
    showDisclosure: boolean;
    isExpanded: boolean;
    onTaskClick: (event: MouseEvent, taskId: string) => void;
    onTaskKeydown: (event: KeyboardEvent, taskId: string) => void;
    onDisclosureClick: (taskId: string) => void;
    onStatusChange: (taskId: string, newStatus: string) => void;
    onTitleUpdate: (taskId: string, newTitle: string) => void;
  }

  let {
    task,
    depth,
    isSelected,
    selectionPosition,
    showDisclosure,
    isExpanded,
    onTaskClick,
    onTaskKeydown,
    onDisclosureClick,
    onStatusChange,
    onTitleUpdate
  }: Props = $props();

  // Reactive classes for selection state
  let itemClasses = $derived(`
    task-item 
    ${isSelected ? 'selected' : ''} 
    ${selectionPosition ? `selection-${selectionPosition}` : ''}
  `.trim());
</script>

<div 
  class={itemClasses}
  style:--depth={depth}
  data-task-id={task.id}
  tabindex={isSelected ? 0 : -1}
  role="listitem"
  aria-selected={isSelected}
  onclick={(e) => onTaskClick(e, task.id)}
  onkeydown={(e) => onTaskKeydown(e, task.id)}
>
  <!-- Indentation and Disclosure -->
  <TaskIndentation 
    {depth} 
    {showDisclosure} 
    {isExpanded}
    onclick={() => onDisclosureClick(task.id)}
  />

  <!-- Status Badge -->
  <TaskStatusBadge 
    status={task.status} 
    onclick={(newStatus) => onStatusChange(task.id, newStatus)}
  />
  
  <!-- Task Content -->
  <div class="task-content">
    <TaskTitle 
      title={task.title}
      taskId={task.id}
      isEditing={false}
      onUpdate={(newTitle) => onTitleUpdate(task.id, newTitle)}
    />
  </div>

  <!-- Metadata -->
  <TaskMetadata {task} />

  <!-- Actions -->
  <TaskActions {task} />
</div>

<style>
  .task-item {
    display: flex;
    align-items: flex-start;
    padding: 4px !important;
    padding-left: calc(4px + (var(--depth, 0) * 32px)) !important;
    border: none !important;
    border-radius: 8px !important;
    background-color: transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
    min-height: 40px;
  }

  .task-item:hover {
    background-color: var(--bg-tertiary);
  }

  .task-item.selected {
    background-color: var(--accent-blue);
    color: white;
  }

  .task-item.selection-top {
    border-radius: 8px 8px 0 0;
  }

  .task-item.selection-middle {
    border-radius: 0;
  }

  .task-item.selection-bottom {
    border-radius: 0 0 8px 8px;
  }

  .task-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
</style>
```

**2. TaskStatusBadge Component:**
```svelte
<!-- lib/components/tasks/TaskStatusBadge.svelte -->
<script lang="ts">
  import { getTaskStatusEmoji } from '$lib/config/emoji';
  import type { TaskStatus } from '$lib/types/task';

  interface Props {
    status: TaskStatus;
    onclick?: (newStatus: TaskStatus) => void;
  }

  let { status, onclick }: Props = $props();

  let statusEmoji = $derived(getTaskStatusEmoji(status));
  let statusLabel = $derived(getStatusLabel(status));

  function getStatusLabel(status: TaskStatus): string {
    const labelMap: Record<TaskStatus, string> = {
      'new_task': 'New',
      'in_progress': 'In Progress',
      'paused': 'Paused',
      'successfully_completed': 'Completed',
      'cancelled': 'Cancelled',
      'failed': 'Failed'
    };
    return labelMap[status] || status.replace('_', ' ');
  }

  function handleClick(event: MouseEvent) {
    event.stopPropagation();
    if (onclick) {
      // For now, cycle through common statuses
      const statusCycle: TaskStatus[] = ['new_task', 'in_progress', 'successfully_completed'];
      const currentIndex = statusCycle.indexOf(status);
      const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];
      onclick(nextStatus);
    }
  }
</script>

<div class="task-status">
  <button 
    class="status-emoji"
    onclick={handleClick}
    title={statusLabel}
    aria-label={`Status: ${statusLabel}. Click to change.`}
  >
    {statusEmoji}
  </button>
</div>

<style>
  .task-status {
    display: flex;
    align-items: center;
    margin-right: 8px;
  }

  .status-emoji {
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: background-color 0.15s ease;
    line-height: 1;
  }

  .status-emoji:hover {
    background-color: var(--bg-tertiary);
  }

  .status-emoji:focus-visible {
    outline: 2px solid var(--accent-blue);
    outline-offset: 2px;
  }
</style>
```

**3. TaskTitle Component:**
```svelte
<!-- lib/components/tasks/TaskTitle.svelte -->
<script lang="ts">
  import { tick } from 'svelte';

  interface Props {
    title: string;
    taskId: string;
    isEditing: boolean;
    onUpdate: (newTitle: string) => void;
  }

  let { title, taskId, isEditing = false, onUpdate }: Props = $props();

  let editingTitle = $state('');
  let originalTitle = $state('');
  let titleInput: HTMLInputElement;
  let editMode = $state(isEditing);

  function startEdit(event: MouseEvent) {
    event.stopPropagation();
    editMode = true;
    editingTitle = title;
    originalTitle = title;

    tick().then(() => {
      if (titleInput) {
        titleInput.focus();
        
        // Position cursor at click location
        const clickX = event.clientX;
        const inputRect = titleInput.getBoundingClientRect();
        const relativeX = clickX - inputRect.left;
        const charWidth = inputRect.width / titleInput.value.length;
        const cursorPosition = Math.round(relativeX / charWidth);
        
        titleInput.setSelectionRange(cursorPosition, cursorPosition);
      }
    });
  }

  function saveEdit() {
    if (editingTitle.trim() && editingTitle !== originalTitle) {
      onUpdate(editingTitle.trim());
    }
    cancelEdit();
  }

  function cancelEdit() {
    editMode = false;
    editingTitle = '';
    originalTitle = '';
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    }
  }

  function handleBlur() {
    // Only save if the content actually changed
    if (editingTitle.trim() !== '' && editingTitle !== originalTitle) {
      saveEdit();
    } else {
      cancelEdit();
    }
  }
</script>

{#if editMode}
  <input
    bind:this={titleInput}
    bind:value={editingTitle}
    class="task-title task-title-input"
    onkeydown={handleKeydown}
    onblur={handleBlur}
    aria-label="Edit task title"
  />
{:else}
  <h5 
    class="task-title"
    onclick={startEdit}
    role="button"
    tabindex="0"
    aria-label={`Task: ${title}. Click to edit.`}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        startEdit(e as any);
      }
    }}
  >
    {title}
  </h5>
{/if}

<style>
  .task-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    margin: 0;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    transition: background-color 0.15s ease;
    line-height: 1.4;
    word-break: break-word;
  }

  .task-title:hover {
    background-color: var(--bg-secondary);
  }

  .task-title-input {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: 4px;
    padding: 2px 4px;
    margin: 0;
    width: 100%;
    line-height: 1.4;
  }

  .task-title-input:focus {
    outline: none;
    border-color: var(--accent-blue);
    box-shadow: 0 0 0 2px rgba(0, 163, 255, 0.3);
  }
</style>
```

**4. TaskMetadata Component:**
```svelte
<!-- lib/components/tasks/TaskMetadata.svelte -->
<script lang="ts">
  import type { Task } from '$lib/types/task';

  interface Props {
    task: Task;
  }

  let { task }: Props = $props();

  let currentTime = $state(Date.now());
  let timeInterval: any;

  // Update time every second for in-progress tasks
  $effect(() => {
    if (task.status === 'in_progress') {
      timeInterval = setInterval(() => {
        currentTime = Date.now();
      }, 1000);
    } else {
      if (timeInterval) {
        clearInterval(timeInterval);
      }
    }

    return () => {
      if (timeInterval) {
        clearInterval(timeInterval);
      }
    };
  });

  let currentDuration = $derived(calculateCurrentDuration());
  let formattedDuration = $derived(formatTimeDuration(currentDuration));
  let assignedToDisplay = $derived(task.assigned_to?.initials || '');
  let notesCount = $derived(task.notes_count || 0);

  function calculateCurrentDuration(): number {
    if (task.status !== 'in_progress' || !task.in_progress_since) {
      return task.accumulated_seconds || 0;
    }
    
    const startTime = new Date(task.in_progress_since).getTime();
    const currentSessionSeconds = Math.floor((currentTime - startTime) / 1000);
    
    return (task.accumulated_seconds || 0) + currentSessionSeconds;
  }

  function formatTimeDuration(seconds: number): string {
    if (!seconds || seconds === 0) return '';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours >= 1) {
      return `${hours.toFixed(1)}h`;
    } else {
      return `${Math.floor(minutes)}m`;
    }
  }
</script>

<div class="task-metadata">
  {#if formattedDuration}
    <span class="duration-display" class:live={task.status === 'in_progress'}>
      {formattedDuration}
    </span>
  {/if}
  
  {#if assignedToDisplay}
    <span class="assigned-to" title={task.assigned_to?.name}>
      {assignedToDisplay}
    </span>
  {/if}
  
  {#if notesCount > 0}
    <span class="notes-count" title={`${notesCount} note${notesCount !== 1 ? 's' : ''}`}>
      {notesCount} 💬
    </span>
  {/if}
</div>

<style>
  .task-metadata {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    margin-left: auto;
    padding-left: 8px;
  }

  .duration-display {
    font-weight: 500;
    color: var(--text-tertiary);
  }

  .duration-display.live {
    color: var(--accent-blue);
    animation: pulse 2s infinite;
  }

  .assigned-to {
    background-color: var(--bg-tertiary);
    color: var(--text-primary);
    padding: 2px 6px;
    border-radius: 12px;
    font-weight: 500;
    font-size: 11px;
  }

  .notes-count {
    color: var(--text-tertiary);
    font-size: 11px;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
</style>
```

**5. TaskActions Component:**
```svelte
<!-- lib/components/tasks/TaskActions.svelte -->
<script lang="ts">
  import type { Task } from '$lib/types/task';
  import TaskInfoPopoverHeadless from './TaskInfoPopoverHeadless.svelte';

  interface Props {
    task: Task;
  }

  let { task }: Props = $props();

  let showPopover = $state(false);

  function toggleInfo(event: MouseEvent) {
    event.stopPropagation();
    showPopover = !showPopover;
  }
</script>

<div class="task-actions">
  <button
    class="info-button"
    onclick={toggleInfo}
    title="Task information"
    aria-label="Show task details"
    aria-expanded={showPopover}
  >
    ℹ️
  </button>

  {#if showPopover}
    <TaskInfoPopoverHeadless
      {task}
      onClose={() => showPopover = false}
    />
  {/if}
</div>

<style>
  .task-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    position: relative;
  }

  .info-button {
    background: none;
    border: none;
    font-size: 14px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: background-color 0.15s ease;
    opacity: 0.6;
  }

  .info-button:hover {
    background-color: var(--bg-tertiary);
    opacity: 1;
  }

  .info-button:focus-visible {
    outline: 2px solid var(--accent-blue);
    outline-offset: 2px;
    opacity: 1;
  }
</style>
```

**6. TaskIndentation Component:**
```svelte
<!-- lib/components/tasks/TaskIndentation.svelte -->
<script lang="ts">
  interface Props {
    depth: number;
    showDisclosure: boolean;
    isExpanded: boolean;
    onclick?: () => void;
  }

  let { depth, showDisclosure, isExpanded, onclick }: Props = $props();

  const chevronRight = '/icons/chevron-right.svg';
  const chevronDown = '/icons/chevron-down.svg';

  function handleDisclosureClick(event: MouseEvent) {
    event.stopPropagation();
    if (onclick) onclick();
  }
</script>

<div class="task-indentation" style:--depth={depth}>
  {#if showDisclosure}
    <button 
      class="disclosure-button"
      onclick={handleDisclosureClick}
      aria-expanded={isExpanded}
      aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
    >
      <img 
        src={isExpanded ? chevronDown : chevronRight}
        alt=""
        class="chevron"
      />
    </button>
  {:else}
    <div class="disclosure-spacer"></div>
  {/if}
</div>

<style>
  .task-indentation {
    display: flex;
    align-items: center;
    margin-right: 8px;
  }

  .disclosure-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    transition: background-color 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
  }

  .disclosure-button:hover {
    background-color: var(--bg-tertiary);
  }

  .disclosure-button:focus-visible {
    outline: 2px solid var(--accent-blue);
    outline-offset: 2px;
  }

  .disclosure-spacer {
    width: 20px;
    height: 20px;
  }

  .chevron {
    width: 12px;
    height: 12px;
    opacity: 0.6;
    transition: opacity 0.15s ease;
  }

  .disclosure-button:hover .chevron {
    opacity: 1;
  }
</style>
```

**Migration Strategy:**
1. Create components alongside existing TaskList
2. Add feature flag to switch between old/new rendering
3. Test components individually with mock data
4. Integrate components one by one into TaskList
5. Remove old rendering code once components are proven

**Testing Strategy:**
- Unit tests for each component with mock data
- Visual regression tests to ensure design consistency
- Interaction tests for editing, status changes, etc.
- Accessibility tests for keyboard navigation and screen readers

**Acceptance Testing:**
- All task operations work identically to current implementation
- Visual design matches current layout exactly
- Performance is equivalent or better
- Accessibility is preserved
- Components can be used independently

**Dependencies:**
- Requires TASKLIST-001 stores for state management
- Needs TypeScript interfaces for Task and related types
- Uses existing emoji configuration and API services
- Requires TaskInfoPopoverHeadless component (existing)