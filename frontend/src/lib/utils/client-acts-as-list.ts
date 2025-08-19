/**
 * Client-side simulation of Rails acts_as_list functionality
 * Handles position calculations and operations for drag-and-drop
 */

import type { Task, PositionUpdate, RelativePositionUpdate } from './position-calculator.js';

export interface PositionUpdateBatch {
  taskId: string;
  newPosition: number;
  oldPosition?: number;
  parent_id?: string | null;
  repositioned_after_id?: string | null;
}

export interface OperationRecord {
  type: 'gap-elimination' | 'insertion' | 'move';
  scope: string | null;
  affectedTasks: string[];
  details: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ApplyPositionUpdatesResult {
  updatedTasks: Task[];
  positionUpdates: PositionUpdateBatch[];
  operations: OperationRecord[];
}

export class ClientActsAsList {
  /**
   * Apply position updates to tasks array, simulating Rails acts_as_list behavior
   */
  static applyPositionUpdates(
    tasks: Task[],
    positionUpdates: PositionUpdate[]
  ): ApplyPositionUpdatesResult {
    const operations: OperationRecord[] = [];
    let updatedTasks = [...tasks];
    const positionUpdateBatches: PositionUpdateBatch[] = [];

    // Group updates by scope (parent_id)
    const updatesByScope = new Map<string | null, PositionUpdate[]>();
    for (const update of positionUpdates) {
      const scope = update.parent_id ?? null;
      if (!updatesByScope.has(scope)) {
        updatesByScope.set(scope, []);
      }
      updatesByScope.get(scope)!.push(update);
    }

    // Process each scope separately
    for (const [scope, scopeUpdates] of updatesByScope) {
      const scopeTasks = updatedTasks.filter((t) => (t.parent_id ?? null) === scope);

      // Phase 1: Gap elimination - remove tasks that are moving
      const movingTaskIds = new Set(scopeUpdates.map((u) => u.id));
      const remainingTasks = scopeTasks.filter((t) => !movingTaskIds.has(t.id));

      if (remainingTasks.length > 0) {
        // Eliminate gaps by resequencing remaining tasks
        remainingTasks.sort((a, b) => (a.position || 0) - (b.position || 0));
        for (let i = 0; i < remainingTasks.length; i++) {
          const task = remainingTasks[i];
          const newPosition = i + 1;
          if (task.position !== newPosition) {
            // Update the task position
            const taskIndex = updatedTasks.findIndex((t) => t.id === task.id);
            if (taskIndex >= 0) {
              updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], position: newPosition };
            }

            positionUpdateBatches.push({
              taskId: task.id,
              newPosition,
              oldPosition: task.position,
              parent_id: scope,
            });
          }
        }

        operations.push({
          type: 'gap-elimination',
          scope: scope,
          affectedTasks: remainingTasks.map((t) => t.id),
          details: `Eliminated gaps for ${remainingTasks.length} remaining tasks`,
        });
      }

      // Phase 2: Insert moving tasks at their target positions
      for (const update of scopeUpdates) {
        const taskIndex = updatedTasks.findIndex((t) => t.id === update.id);
        if (taskIndex >= 0) {
          const oldTask = updatedTasks[taskIndex];

          // Update task position and parent
          updatedTasks[taskIndex] = {
            ...oldTask,
            position: update.position,
            parent_id: update.parent_id ?? null,
          };

          // Shift other tasks to make space if needed
          const scopeTasksAfterGaps = updatedTasks.filter(
            (t) =>
              (t.parent_id ?? null) === scope &&
              t.id !== update.id &&
              (t.position || 0) >= update.position
          );

          for (const taskToShift of scopeTasksAfterGaps) {
            const shiftIndex = updatedTasks.findIndex((t) => t.id === taskToShift.id);
            if (shiftIndex >= 0) {
              const newPosition = (taskToShift.position || 0) + 1;
              updatedTasks[shiftIndex] = { ...updatedTasks[shiftIndex], position: newPosition };

              positionUpdateBatches.push({
                taskId: taskToShift.id,
                newPosition,
                oldPosition: taskToShift.position,
                parent_id: scope,
              });
            }
          }

          positionUpdateBatches.push({
            taskId: update.id,
            newPosition: update.position,
            oldPosition: oldTask.position,
            parent_id: update.parent_id ?? null,
          });

          operations.push({
            type: 'insertion',
            scope: scope,
            affectedTasks: [update.id],
            details: `Inserted task ${update.id} at position ${update.position}`,
          });
        }
      }
    }

    return {
      updatedTasks,
      positionUpdates: positionUpdateBatches,
      operations,
    };
  }

  /**
   * Validate task positions for consistency
   */
  static validatePositions(tasks: Task[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Group tasks by scope
    const tasksByScope = new Map<string | null, Task[]>();
    for (const task of tasks) {
      const scope = task.parent_id ?? null;
      if (!tasksByScope.has(scope)) {
        tasksByScope.set(scope, []);
      }
      tasksByScope.get(scope)!.push(task);
    }

    // Validate each scope
    for (const [scope, scopeTasks] of tasksByScope) {
      const scopeName = scope || 'root';
      const positions = scopeTasks.map((t) => t.position || 0).sort((a, b) => a - b);

      // Check for duplicates
      const duplicates = positions.filter((pos, index) => positions.indexOf(pos) !== index);
      if (duplicates.length > 0) {
        const uniqueDuplicates = [...new Set(duplicates)];
        errors.push(
          `Scope ${scopeName}: Duplicate positions found: ${uniqueDuplicates.join(', ')}`
        );
      }

      // Check for gaps and starting position
      if (positions.length > 0) {
        if (positions[0] !== 1) {
          warnings.push(
            `Scope ${scopeName}: Positions don't start from 1 (first position: ${positions[0]})`
          );
        }

        const missingPositions: number[] = [];
        for (let i = 1; i < positions[positions.length - 1]; i++) {
          if (!positions.includes(i)) {
            missingPositions.push(i);
          }
        }

        if (missingPositions.length > 0) {
          warnings.push(`Scope ${scopeName}: Missing positions: ${missingPositions.join(', ')}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Predict what server positions will be after Rails processes the updates
   */
  static predictServerPositions(
    tasks: Task[],
    positionUpdates: PositionUpdate[]
  ): Map<string, number> {
    const result = this.applyPositionUpdates(tasks, positionUpdates);
    const predictions = new Map<string, number>();

    for (const task of result.updatedTasks) {
      predictions.set(task.id, task.position || 0);
    }

    return predictions;
  }

  /**
   * Convert relative position updates to absolute position updates
   */
  static convertRelativeToPositionUpdates(
    tasks: Task[],
    relativeUpdates: RelativePositionUpdate[]
  ): PositionUpdate[] {
    const positionUpdates: PositionUpdate[] = [];

    for (const relativeUpdate of relativeUpdates) {
      const { id, parent_id, before_task_id, after_task_id, position } = relativeUpdate;

      // Find tasks in the target scope
      const scopeTasks = tasks.filter((t) => (t.parent_id ?? null) === (parent_id ?? null));
      scopeTasks.sort((a, b) => (a.position || 0) - (b.position || 0));

      let calculatedPosition: number;
      let repositioned_after_id: string | null = null;
      let position_finalized = true;
      let repositioned_to_top = false;

      if (position === 'first') {
        // Use negative positioning for first position
        calculatedPosition = Math.floor(Math.random() * -9000) - 1000; // Random between -10000 and -1000
        repositioned_after_id = null;
        position_finalized = false;
        repositioned_to_top = true;
      } else if (position === 'last') {
        // Position after the last task
        const lastTask = scopeTasks[scopeTasks.length - 1];
        if (lastTask) {
          calculatedPosition = (lastTask.position || 0) + Math.floor(Math.random() * 1000) + 1;
          repositioned_after_id = lastTask.id;
        } else {
          calculatedPosition = 1;
          repositioned_after_id = null;
        }
      } else if (before_task_id) {
        // Position before a specific task
        const beforeTask = scopeTasks.find((t) => t.id === before_task_id);
        if (beforeTask) {
          const beforeIndex = scopeTasks.findIndex((t) => t.id === before_task_id);
          const previousTask = beforeIndex > 0 ? scopeTasks[beforeIndex - 1] : null;

          if (previousTask) {
            // Position between previous and target task
            const prevPos = previousTask.position || 0;
            const targetPos = beforeTask.position || 0;
            calculatedPosition = prevPos + (targetPos - prevPos) / 2;
            repositioned_after_id = previousTask.id;
          } else {
            // Position before first task
            calculatedPosition = (beforeTask.position || 1) - 0.5;
            repositioned_after_id = null;
          }
        } else {
          calculatedPosition = 1;
          repositioned_after_id = null;
        }
      } else if (after_task_id) {
        // Position after a specific task
        const afterTask = scopeTasks.find((t) => t.id === after_task_id);
        if (afterTask) {
          const afterIndex = scopeTasks.findIndex((t) => t.id === after_task_id);
          const nextTask = afterIndex < scopeTasks.length - 1 ? scopeTasks[afterIndex + 1] : null;

          if (nextTask) {
            // Position between target and next task
            const afterPos = afterTask.position || 0;
            const nextPos = nextTask.position || 0;
            calculatedPosition = afterPos + (nextPos - afterPos) / 2;
          } else {
            // Position after last task
            calculatedPosition = (afterTask.position || 0) + 1;
          }
          repositioned_after_id = after_task_id;
        } else {
          calculatedPosition = 1;
          repositioned_after_id = null;
        }
      } else {
        // Default to first position
        calculatedPosition = 1;
        repositioned_after_id = null;
      }

      const positionUpdate: PositionUpdate & {
        position_finalized?: boolean;
        repositioned_to_top?: boolean;
      } = {
        id,
        position: calculatedPosition,
        parent_id: parent_id ?? null,
        repositioned_after_id,
      };

      if (position_finalized === false) {
        positionUpdate.position_finalized = false;
      }
      if (repositioned_to_top) {
        positionUpdate.repositioned_to_top = true;
      }

      positionUpdates.push(positionUpdate);
    }

    return positionUpdates;
  }
}
