/**
 * Composable input event handlers for DRY task input management
 * Eliminates repetitive keydown/blur handler patterns across TaskList.svelte
 */

interface InputHandlerConfig {
  onEnter?: () => Promise<void> | void;
  onEscape?: () => void;
  onBlur?: () => Promise<void> | void;
  shouldPreventDefault?: (key: string) => boolean;
}

export interface InputHandlers {
  keydown: (event: KeyboardEvent) => Promise<void>;
  blur: () => Promise<void>;
}

/**
 * Creates unified input handlers for consistent Enter/Escape/Blur behavior
 */
export function createInputHandler(config: InputHandlerConfig): InputHandlers {
  return {
    keydown: async (event: KeyboardEvent) => {
      const { key } = event;
      
      // Default prevention for Enter/Escape, or custom logic
      if (config.shouldPreventDefault?.(key) ?? ['Enter', 'Escape'].includes(key)) {
        event.preventDefault();
      }
      
      if (key === 'Enter' && config.onEnter) {
        event.stopPropagation(); // Prevent keyboard handler from seeing this event
        await config.onEnter();
      } else if (key === 'Escape' && config.onEscape) {
        config.onEscape();
      }
    },
    
    blur: async () => {
      if (config.onBlur) {
        await config.onBlur();
      }
    }
  };
}

/**
 * Task-specific handler configurations for common patterns
 */
export const TaskInputPatterns = {
  /**
   * New task creation: Enter to create & select, Escape to cancel, Blur to save if content
   */
  newTask: (
    createFn: (shouldSelect: boolean) => Promise<void>,
    cancelFn: () => void,
    titleGetter: () => string
  ) => createInputHandler({
    onEnter: () => createFn(true),
    onEscape: cancelFn,
    onBlur: () => titleGetter().trim() ? createFn(false) : cancelFn()
  })
};