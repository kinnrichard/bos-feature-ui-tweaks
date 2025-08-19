/**
 * High-level task input management for unified state coordination
 * Eliminates repetitive input show/hide/create patterns in TaskList.svelte
 */

import { type InputHandlers, TaskInputPatterns } from './input-handlers';


interface TaskInputState {
  title: { get: () => string; set: (v: string) => void };
  inputElement: { get: () => HTMLInputElement | undefined };
  isCreating: { get: () => boolean; set: (v: boolean) => void };
  isShowing: { get: () => boolean; set: (v: boolean) => void };
}

interface TaskInputActions {
  create: (shouldSelect: boolean) => Promise<void>;
  cancel: () => void;
}

export interface TaskInputManager {
  show: () => void;
  hide: () => void;
  createTask: (shouldSelect?: boolean) => Promise<void>;
  handlers: InputHandlers;
}

/**
 * Creates a unified task input manager that handles show/hide/create lifecycle
 */
export function createTaskInputManager(
  state: TaskInputState,
  actions: TaskInputActions
): TaskInputManager {
  
  // Create unified handlers using the composable pattern
  const handlers = TaskInputPatterns.newTask(
    actions.create,
    actions.cancel,
    state.title.get
  );
  
  return {
    show: () => {
      state.isShowing.set(true);
      
      // Focus input after DOM update
      setTimeout(() => {
        const input = state.inputElement.get();
        if (input) {
          input.focus();
        }
      }, 0);
    },
    
    hide: actions.cancel,
    
    createTask: actions.create,
    
    handlers
  };
}

