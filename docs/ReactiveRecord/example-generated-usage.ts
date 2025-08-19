/**
 * Example usage of Epic-008 generated models
 * Demonstrates the modernized Rails generator output
 */

// ==========================================
// NON-REACTIVE USAGE (ActiveRecord)
// For Node.js, tests, utilities, server-side
// ==========================================

import { Task } from './frontend/src/lib/models/task';
import type { TaskData, CreateTaskData } from './frontend/src/lib/models/types/task-data';

// Promise-based operations
async function activeRecordExample() {
  // Find by ID (throws RecordNotFoundError if not found)
  const task = await Task.find('123');
  
  // Find by conditions (returns null if not found)
  const taskByTitle = await Task.findBy({ title: 'Example Task' });
  
  // Create new record
  const newTask = await Task.create({
    title: 'New Task',
    status: 'new_task',
    applies_to_all_targets: false,
    lock_version: 0
  });
  
  // Update existing record
  const updatedTask = await Task.update('123', { title: 'Updated Title' });
  
  // Soft delete using discard gem
  await Task.discard('123');
  
  // Restore discarded record
  await Task.undiscard('123');
  
  // Query with scopes (Rails-compatible)
  const allTasks = await Task.all().all();
  const activeTasks = await Task.kept().all();
  const discardedTasks = await Task.discarded().all();
  const firstTask = await Task.where({ status: 'in_progress' }).first();
  
  return { task, newTask, allTasks };
}

// ==========================================
// REACTIVE USAGE (ReactiveRecord)
// For Svelte components - automatically updates UI
// ==========================================

import { ReactiveTask } from './frontend/src/lib/models/reactive-task';

// In Svelte component or reactive context
function reactiveExample() {
  // Reactive queries - automatically update when data changes
  const taskQuery = ReactiveTask.find('123');
  const allTasksQuery = ReactiveTask.all().all();
  const activeTasksQuery = ReactiveTask.kept().all();
  
  // Access reactive properties (Svelte 5 $state)
  console.log('Current task:', taskQuery.data);
  console.log('Is loading:', taskQuery.isLoading);
  console.log('Error:', taskQuery.error);
  console.log('Is present:', taskQuery.present);
  
  // Mutation operations (still async like ActiveRecord)
  async function createReactiveTask() {
    const newTask = await ReactiveTask.create({
      title: 'Reactive Task',
      status: 'new_task',
      applies_to_all_targets: false,
      lock_version: 0
    });
    
    // Reactive queries automatically update with new data
    return newTask;
  }
  
  return { taskQuery, allTasksQuery, createReactiveTask };
}

// ==========================================
// IMPORT ALIAS PATTERN
// Easy switching between reactive/non-reactive
// ==========================================

// Option 1: Import reactive version with alias
import { ReactiveTask as Task } from './frontend/src/lib/models/reactive-task';

function aliasExample() {
  // Use Task as if it's normal ActiveRecord, but with reactive queries
  const taskQuery = Task.find('123');
  
  // taskQuery.data automatically updates Svelte components
  return taskQuery;
}

// Option 2: Conditional imports based on context
function getTaskModel() {
  if (typeof window !== 'undefined') {
    // Browser/Svelte context - use reactive
    return import('./frontend/src/lib/models/reactive-task').then(m => m.ReactiveTask);
  } else {
    // Server/Node.js context - use non-reactive
    return import('./frontend/src/lib/models/task').then(m => m.Task);
  }
}

// ==========================================
// ARCHITECTURAL BENEFITS DEMONSTRATED
// ==========================================

/**
 * Clean Architecture Benefits:
 * 
 * 1. TYPE SAFETY: Strong TypeScript interfaces (TaskData, CreateTaskData, UpdateTaskData)
 * 2. RAILS COMPATIBILITY: Same API as Rails ActiveRecord (find, create, update, destroy, discard)
 * 3. REACTIVE CHOICE: Pick reactive or non-reactive based on context
 * 4. DISCARD GEM: Built-in soft delete support (kept(), discarded(), withDiscarded())
 * 5. ZERO.JS INTEGRATION: Works with local-first database
 * 6. IMPORT ALIASES: Easy switching via import aliases
 * 7. SIMPLIFIED GENERATION: 2 clean files per model instead of complex factories
 */

export {
  activeRecordExample,
  reactiveExample,
  aliasExample,
  getTaskModel
};