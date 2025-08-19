<script lang="ts">
  import { onMount } from 'svelte';
  import JobStatusButton from '$lib/components/layout/JobStatusButton.svelte';
  import { isAnyPopoverOpen, openPopoverCount } from '$lib/stores/popover-state';
  
  // Mock job data
  let mockJob = $state({
    id: '123',
    status: 'in_progress'
  });
  
  // Test task list
  let tasks = $state([
    { id: '1', title: 'Task 1', selected: false },
    { id: '2', title: 'Task 2', selected: false },
    { id: '3', title: 'Task 3', selected: false },
    { id: '4', title: 'Task 4', selected: false },
    { id: '5', title: 'Task 5', selected: false }
  ]);
  
  let selectedTaskId = $state<string | null>(null);
  let keyboardEvents = $state<string[]>([]);
  
  function handleTaskKeydown(event: KeyboardEvent) {
    // Skip if popover is open (this simulates TaskList behavior)
    if ($isAnyPopoverOpen) {
      keyboardEvents.push(`⚠️ BLOCKED: ${event.key} (popover is open)`);
      return;
    }
    
    keyboardEvents.push(`✅ Task list handled: ${event.key}`);
    
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const currentIndex = selectedTaskId ? tasks.findIndex(t => t.id === selectedTaskId) : -1;
      
      if (event.key === 'ArrowUp') {
        const newIndex = currentIndex > 0 ? currentIndex - 1 : tasks.length - 1;
        selectedTaskId = tasks[newIndex].id;
      } else {
        const newIndex = currentIndex < tasks.length - 1 ? currentIndex + 1 : 0;
        selectedTaskId = tasks[newIndex].id;
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      keyboardEvents.push(`Task ${selectedTaskId} activated`);
    } else if (event.key === 'Delete') {
      event.preventDefault();
      keyboardEvents.push(`Task ${selectedTaskId} deleted`);
    }
  }
  
  onMount(() => {
    // Simulate TaskList global keyboard handler
    document.addEventListener('keydown', handleTaskKeydown);
    
    return () => {
      document.removeEventListener('keydown', handleTaskKeydown);
    };
  });
  
  function clearEvents() {
    keyboardEvents = [];
  }
  
  async function handleStatusChange(newStatus: string) {
    mockJob.status = newStatus;
    keyboardEvents.push(`Job status changed to: ${newStatus}`);
  }
</script>

<div class="test-container">
  <h1>Popover Keyboard Isolation Test</h1>
  
  <div class="test-info">
    <p><strong>Test Instructions:</strong></p>
    <ol>
      <li>Click on a task to select it</li>
      <li>Use arrow keys to navigate tasks (should work)</li>
      <li>Open the job status popover</li>
      <li>Use arrow keys - they should ONLY control the popover, NOT the task list</li>
      <li>Close the popover and verify task navigation works again</li>
    </ol>
  </div>
  
  <div class="status-info">
    <div class="status-item">
      <span>Popover Open:</span>
      <span class="status-value" class:open={$isAnyPopoverOpen}>
        {$isAnyPopoverOpen ? 'YES' : 'NO'}
      </span>
    </div>
    <div class="status-item">
      <span>Open Count:</span>
      <span class="status-value">{$openPopoverCount}</span>
    </div>
  </div>
  
  <div class="test-layout">
    <div class="job-section">
      <h2>Job Status Button</h2>
      <div class="job-display">
        <JobStatusButton job={mockJob} onStatusChange={handleStatusChange} />
        <span>Current Status: {mockJob.status}</span>
      </div>
    </div>
    
    <div class="task-section">
      <h2>Task List (simulated)</h2>
      <div class="task-list">
        {#each tasks as task}
          <button
            class="task-item"
            class:selected={selectedTaskId === task.id}
            onclick={() => selectedTaskId = task.id}
          >
            {task.title}
          </button>
        {/each}
      </div>
      <p class="selected-info">
        Selected: {selectedTaskId ? `Task ${selectedTaskId}` : 'None'}
      </p>
    </div>
  </div>
  
  <div class="event-log">
    <h3>Keyboard Event Log</h3>
    <button onclick={clearEvents}>Clear Log</button>
    <div class="event-list">
      {#if keyboardEvents.length === 0}
        <p class="no-events">No keyboard events yet...</p>
      {/if}
      {#each keyboardEvents as event, i}
        <div class="event-item" class:blocked={event.includes('BLOCKED')}>
          {i + 1}. {event}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .test-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  .test-info {
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    padding: 1rem;
    margin-bottom: 2rem;
  }
  
  .test-info ol {
    margin: 0.5rem 0 0 1.5rem;
  }
  
  .status-info {
    display: flex;
    gap: 2rem;
    margin-bottom: 2rem;
    padding: 1rem;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }
  
  .status-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .status-value {
    font-weight: bold;
    padding: 0.25rem 0.5rem;
    background: var(--bg-secondary);
    border-radius: var(--radius-sm);
  }
  
  .status-value.open {
    background: var(--error-bg);
    color: var(--error-text);
  }
  
  .test-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin-bottom: 2rem;
  }
  
  .job-section, .task-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    padding: 1.5rem;
  }
  
  .job-section h2, .task-section h2 {
    margin-top: 0;
    margin-bottom: 1rem;
  }
  
  .job-display {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .task-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .task-item {
    padding: 0.75rem;
    background: var(--bg-primary);
    border: 1px solid var(--border-secondary);
    border-radius: var(--radius-sm);
    text-align: left;
    transition: all 0.2s;
  }
  
  .task-item:hover {
    background: var(--bg-tertiary);
  }
  
  .task-item.selected {
    background: var(--accent-bg);
    border-color: var(--accent-border);
    font-weight: 500;
  }
  
  .selected-info {
    margin: 0;
    color: var(--text-secondary);
  }
  
  .event-log {
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    padding: 1.5rem;
  }
  
  .event-log h3 {
    margin-top: 0;
    margin-bottom: 1rem;
  }
  
  .event-log button {
    margin-bottom: 1rem;
  }
  
  .event-list {
    max-height: 300px;
    overflow-y: auto;
    background: var(--bg-primary);
    border: 1px solid var(--border-secondary);
    border-radius: var(--radius-sm);
    padding: 1rem;
  }
  
  .no-events {
    color: var(--text-tertiary);
    text-align: center;
    margin: 0;
  }
  
  .event-item {
    padding: 0.5rem;
    border-bottom: 1px solid var(--border-secondary);
    font-family: monospace;
    font-size: 0.875rem;
  }
  
  .event-item:last-child {
    border-bottom: none;
  }
  
  .event-item.blocked {
    color: var(--success-text);
    background: var(--success-bg);
    padding: 0.5rem;
    border-radius: var(--radius-sm);
    margin-bottom: 0.25rem;
  }
</style>