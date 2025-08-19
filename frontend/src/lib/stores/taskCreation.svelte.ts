import { SvelteMap } from 'svelte/reactivity';

export interface TaskCreationState {
  isShowing: boolean;
  title: string;
  context?: {
    afterTaskId?: string;
    depth?: number;
  };
}

class TaskCreationManager {
  private states = new SvelteMap<string, TaskCreationState>();
  
  // Safe initialization method - call this before using getState in derived contexts
  ensureState(key: string): void {
    if (!this.states.has(key)) {
      this.states.set(key, {
        isShowing: false,
        title: '',
        context: undefined
      });
    }
  }
  
  // Read-only getter - no mutations, safe for $derived()
  getState(key: string): TaskCreationState {
    const state = this.states.get(key);
    if (!state) {
      throw new Error(`TaskCreationState for key "${key}" not found. Call ensureState("${key}") first.`);
    }
    return state;
  }
  
  // Safe getter that returns undefined if state doesn't exist
  getStateOrUndefined(key: string): TaskCreationState | undefined {
    return this.states.get(key);
  }
  
  updateState(key: string, changes: Partial<TaskCreationState>) {
    this.ensureState(key); // Ensure state exists before updating
    const currentState = this.getState(key);
    const newState = { ...currentState, ...changes };
    this.states.set(key, newState);
  }
  
  show(key: string, context?: TaskCreationState['context']) {
    this.updateState(key, { 
      isShowing: true, 
      context 
    });
  }
  
  hide(key: string) {
    this.updateState(key, { 
      isShowing: false, 
      title: '', 
      context: undefined 
    });
  }
  
  setTitle(key: string, title: string) {
    this.updateState(key, { title });
  }
  
  
  clear(key: string) {
    this.states.delete(key);
  }
  
  clearAll() {
    this.states.clear();
  }
}

export const taskCreationManager = new TaskCreationManager();