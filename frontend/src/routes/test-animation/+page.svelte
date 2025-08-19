<script lang="ts">
  import { onMount } from 'svelte';
  import { FlipAnimator } from '$lib/utils/flip-animation';

  let tasks = [
    { id: '1', title: 'Task 1: Setup environment', position: 1 },
    { id: '2', title: 'Task 2: Design schema', position: 2 },
    { id: '3', title: 'Task 3: Build API', position: 3 },
    { id: '4', title: 'Task 4: Create UI', position: 4 },
    { id: '5', title: 'Task 5: Write tests', position: 5 },
  ];

  let animator: FlipAnimator;
  let container: HTMLElement;

  onMount(() => {
    animator = new FlipAnimator();
    const elements = Array.from(container.querySelectorAll('.demo-task')) as HTMLElement[];
    animator.capturePositions(elements, (el) => el.dataset.taskId || '');
  });

  function reorderTasks() {
    // Swap first two tasks
    if (tasks.length >= 2) {
      [tasks[0], tasks[1]] = [tasks[1], tasks[0]];
      tasks = [...tasks];

      // Animate after DOM updates
      setTimeout(() => {
        const elements = Array.from(container.querySelectorAll('.demo-task')) as HTMLElement[];
        animator.animate(elements, (el) => el.dataset.taskId || '', {
          duration: 300,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        });
      }, 0);
    }
  }

  function shuffleTasks() {
    // Fisher-Yates shuffle
    const shuffled = [...tasks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    tasks = shuffled;

    // Animate after DOM updates
    setTimeout(() => {
      const elements = Array.from(container.querySelectorAll('.demo-task')) as HTMLElement[];
      animator.animate(elements, (el) => el.dataset.taskId || '', {
        duration: 300,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        stagger: 20,
      });
    }, 0);
  }

  function simulateMultiDrag() {
    // Simulate a multi-drag by capturing "pre-drag" positions first
    const elements = Array.from(container.querySelectorAll('.demo-task')) as HTMLElement[];

    // Capture current positions as "pre-drag"
    animator.capturePreDragPositions(elements, (el) => el.dataset.taskId || '');

    // Move tasks 1 and 3 to the end
    const task1 = tasks.find((t) => t.id === '1');
    const task3 = tasks.find((t) => t.id === '3');
    const otherTasks = tasks.filter((t) => t.id !== '1' && t.id !== '3');

    if (task1 && task3) {
      tasks = [...otherTasks, task1, task3];

      // Animate after DOM updates using pre-drag positions
      setTimeout(() => {
        const elements = Array.from(container.querySelectorAll('.demo-task')) as HTMLElement[];
        animator.animate(elements, (el) => el.dataset.taskId || '', {
          duration: 400,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          stagger: 30,
        });
      }, 0);
    }
  }
</script>

<div class="container">
  <h1>Task Animation Demo</h1>
  <p>This demonstrates the FLIP animation for task reordering</p>

  <div class="controls">
    <button onclick={reorderTasks}>Reorder First Two</button>
    <button onclick={shuffleTasks}>Shuffle All</button>
    <button onclick={simulateMultiDrag}>Simulate Multi-Drag</button>
  </div>

  <div class="task-container" bind:this={container}>
    {#each tasks as task (task.id)}
      <div class="demo-task" data-task-id={task.id}>
        {task.title}
      </div>
    {/each}
  </div>
</div>

<style>
  .container {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
  }

  h1 {
    font-size: 24px;
    margin-bottom: 10px;
  }

  p {
    color: var(--text-secondary);
    margin-bottom: 20px;
  }

  .controls {
    margin-bottom: 20px;
  }

  button {
    background: var(--accent-blue);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    cursor: default;
    margin-right: 10px;
    font-size: 14px;
    font-weight: 500;
  }

  button:hover {
    background: var(--accent-blue-hover);
  }

  .task-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .demo-task {
    background: var(--bg-secondary);
    padding: 16px;
    border-radius: 8px;
    cursor: move;
    will-change: transform;
  }

  .demo-task:hover {
    background: var(--bg-tertiary);
  }
</style>
