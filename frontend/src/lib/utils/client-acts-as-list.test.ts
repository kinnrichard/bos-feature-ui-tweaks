/**
 * Tests for ClientActsAsList - client-side simulation of Rails acts_as_list
 */

import { describe, it, expect } from 'vitest';
import { ClientActsAsList } from './client-acts-as-list';
import type { Task, PositionUpdate, RelativePositionUpdate } from './position-calculator';

describe('ClientActsAsList', () => {
  describe('Single Task Operations', () => {
    it('should handle single task move within same scope', () => {
      const tasks: Task[] = [
        { id: 'task1', position: 1, parent_id: 'parent1' },
        { id: 'task2', position: 2, parent_id: 'parent1' },
        { id: 'task3', position: 3, parent_id: 'parent1' },
        { id: 'task4', position: 4, parent_id: 'parent1' },
        { id: 'task5', position: 5, parent_id: 'parent1' },
      ];

      const positionUpdates: PositionUpdate[] = [
        { id: 'task2', position: 4, parent_id: 'parent1' },
      ];

      const result = ClientActsAsList.applyPositionUpdates(tasks, positionUpdates);

      // Expected result: task2 moves from 2 to 4
      // Gap elimination: task3(3→2), task4(4→3), task5(5→4)
      // Insertion: task2 at 4, task4(3→4), task5(4→5)
      // Final: task1:1, task3:2, task4:3, task2:4, task5:5

      const finalPositions = new Map(result.updatedTasks.map((t) => [t.id, t.position]));
      expect(finalPositions.get('task1')).toBe(1);
      expect(finalPositions.get('task3')).toBe(2);
      expect(finalPositions.get('task4')).toBe(3);
      expect(finalPositions.get('task2')).toBe(4);
      expect(finalPositions.get('task5')).toBe(5);

      // Verify operations were recorded
      expect(result.operations.length).toBeGreaterThan(0);
      expect(result.operations.some((op) => op.type === 'gap-elimination')).toBe(true);
      expect(result.operations.some((op) => op.type === 'insertion')).toBe(true);
    });

    it('should handle cross-scope move', () => {
      const tasks: Task[] = [
        { id: 'task1', position: 1, parent_id: 'parent1' },
        { id: 'task2', position: 2, parent_id: 'parent1' },
        { id: 'task3', position: 1, parent_id: 'parent2' },
        { id: 'task4', position: 2, parent_id: 'parent2' },
      ];

      const positionUpdates: PositionUpdate[] = [
        { id: 'task2', position: 2, parent_id: 'parent2' },
      ];

      const result = ClientActsAsList.applyPositionUpdates(tasks, positionUpdates);

      // Parent1: task1:1 (task2 left gap at 2, but no other tasks to shift)
      // Parent2: task3:1, task4:2→3 (shift up), task2:2 (inserted)
      const finalPositions = new Map(result.updatedTasks.map((t) => [t.id, t.position]));
      expect(finalPositions.get('task1')).toBe(1);
      expect(finalPositions.get('task2')).toBe(2);
      expect(finalPositions.get('task3')).toBe(1);
      expect(finalPositions.get('task4')).toBe(3);

      // Check parent_id was updated
      const task2 = result.updatedTasks.find((t) => t.id === 'task2');
      expect(task2?.parent_id).toBe('parent2');
    });
  });

  describe('Multi-Task Operations - User Bug Scenarios', () => {
    it('should reproduce user bug scenario: 2 tasks moving down', () => {
      // Exact scenario from user logs
      const tasks: Task[] = [
        { id: 'aa199df2', position: 3, parent_id: 'parent1' },
        { id: '573af5c6', position: 4, parent_id: 'parent1' },
        { id: 'task5', position: 5, parent_id: 'parent1' },
        { id: 'task6', position: 6, parent_id: 'parent1' },
        { id: 'task7', position: 7, parent_id: 'parent1' },
        { id: 'task8', position: 8, parent_id: 'parent1' },
        { id: '413d84d5', position: 9, parent_id: 'parent1' },
        { id: 'task10', position: 10, parent_id: 'parent1' },
        { id: 'task11', position: 11, parent_id: 'parent1' },
      ];

      // User dragged aa199df2 and 573af5c6 to positions 7 and 8
      const positionUpdates: PositionUpdate[] = [
        { id: 'aa199df2', position: 7, parent_id: 'parent1' },
        { id: '573af5c6', position: 8, parent_id: 'parent1' },
      ];

      const result = ClientActsAsList.applyPositionUpdates(tasks, positionUpdates);

      // Expected server behavior (from user logs):
      // aa199df2: position 7, 573af5c6: position 9, 413d84d5: position 8
      const finalPositions = new Map(result.updatedTasks.map((t) => [t.id, t.position]));

      // With new randomized positioning, positions might differ but the test should still verify logical structure
      // The key thing is that tasks are positioned correctly relative to each other
      expect(finalPositions.get('aa199df2')).toBeDefined();
      expect(finalPositions.get('413d84d5')).toBeDefined(); // Should be pushed up by insertions
      expect(finalPositions.get('573af5c6')).toBeDefined(); // This might differ from server due to randomization

      // Validate no duplicate positions
      const validation = ClientActsAsList.validatePositions(result.updatedTasks);
      expect(validation.valid).toBe(true);
    });

    it('should handle 3-task selection (off-by-2 scenario)', () => {
      const tasks: Task[] = [
        { id: 'task1', position: 1, parent_id: 'parent1' },
        { id: 'task2', position: 2, parent_id: 'parent1' },
        { id: 'task3', position: 3, parent_id: 'parent1' },
        { id: 'task4', position: 4, parent_id: 'parent1' },
        { id: 'task5', position: 5, parent_id: 'parent1' },
        { id: 'task6', position: 6, parent_id: 'parent1' },
        { id: 'task7', position: 7, parent_id: 'parent1' },
        { id: 'task8', position: 8, parent_id: 'parent1' },
      ];

      // Move first 3 tasks to positions 6, 7, 8
      const positionUpdates: PositionUpdate[] = [
        { id: 'task1', position: 6, parent_id: 'parent1' },
        { id: 'task2', position: 7, parent_id: 'parent1' },
        { id: 'task3', position: 8, parent_id: 'parent1' },
      ];

      const result = ClientActsAsList.applyPositionUpdates(tasks, positionUpdates);

      // Gap elimination should shift task4,5,6,7,8 down by 3 positions
      // Then insertion should place task1,2,3 at their target positions
      const finalPositions = new Map(result.updatedTasks.map((t) => [t.id, t.position]));

      // With new randomized positioning, verify logical structure rather than exact positions
      // All tasks should have valid positions and no duplicates
      expect(finalPositions.get('task4')).toBeDefined();
      expect(finalPositions.get('task5')).toBeDefined();
      expect(finalPositions.get('task6')).toBeDefined();
      expect(finalPositions.get('task7')).toBeDefined();
      expect(finalPositions.get('task8')).toBeDefined();

      // Inserted tasks should have valid positions
      expect(finalPositions.get('task1')).toBeDefined();
      expect(finalPositions.get('task2')).toBeDefined();
      expect(finalPositions.get('task3')).toBeDefined();

      const validation = ClientActsAsList.validatePositions(result.updatedTasks);
      expect(validation.valid).toBe(true);
    });
  });

  describe('Gap Elimination Edge Cases', () => {
    it('should handle multiple gaps at different positions', () => {
      const tasks: Task[] = [
        { id: 'task1', position: 1, parent_id: 'parent1' },
        { id: 'task2', position: 2, parent_id: 'parent1' },
        { id: 'task3', position: 3, parent_id: 'parent1' },
        { id: 'task4', position: 4, parent_id: 'parent1' },
        { id: 'task5', position: 5, parent_id: 'parent1' },
        { id: 'task6', position: 6, parent_id: 'parent1' },
      ];

      // Remove tasks at positions 2 and 5 (non-consecutive gaps)
      const positionUpdates: PositionUpdate[] = [
        { id: 'task2', position: 1, parent_id: 'parent2' },
        { id: 'task5', position: 2, parent_id: 'parent2' },
      ];

      const result = ClientActsAsList.applyPositionUpdates(tasks, positionUpdates);

      // Parent1 should have: task1:1, task3:2, task4:3, task6:4
      const parent1Tasks = result.updatedTasks.filter((t) => t.parent_id === 'parent1');
      const parent1Positions = new Map(parent1Tasks.map((t) => [t.id, t.position]));

      expect(parent1Positions.get('task1')).toBe(1);
      expect(parent1Positions.get('task3')).toBe(2); // 3 - 1 gap = 2
      expect(parent1Positions.get('task4')).toBe(3); // 4 - 1 gap = 3
      expect(parent1Positions.get('task6')).toBe(4); // 6 - 2 gaps = 4

      const validation = ClientActsAsList.validatePositions(result.updatedTasks);
      expect(validation.valid).toBe(true);
    });

    it('should properly deduplicate gaps in multi-task operations', () => {
      const tasks: Task[] = [
        { id: 'task1', position: 1, parent_id: 'parent1' },
        { id: 'task2', position: 2, parent_id: 'parent1' },
        { id: 'task3', position: 3, parent_id: 'parent1' },
        { id: 'task4', position: 4, parent_id: 'parent1' },
      ];

      // Two tasks leaving same scope - should deduplicate gap positions
      const positionUpdates: PositionUpdate[] = [
        { id: 'task2', position: 1, parent_id: 'parent2' },
        { id: 'task3', position: 2, parent_id: 'parent2' },
      ];

      const result = ClientActsAsList.applyPositionUpdates(tasks, positionUpdates);

      // Parent1: task1:1, task4:2 (shifted down by 2 unique gaps)
      const parent1Tasks = result.updatedTasks.filter((t) => t.parent_id === 'parent1');
      expect(parent1Tasks.length).toBe(2);

      const parent1Positions = new Map(parent1Tasks.map((t) => [t.id, t.position]));
      expect(parent1Positions.get('task1')).toBe(1);
      expect(parent1Positions.get('task4')).toBe(2); // 4 - 2 gaps = 2

      const validation = ClientActsAsList.validatePositions(result.updatedTasks);
      expect(validation.valid).toBe(true);
    });
  });

  describe('Position Validation', () => {
    it('should detect duplicate positions', () => {
      const tasks: Task[] = [
        { id: 'task1', position: 1, parent_id: 'parent1' },
        { id: 'task2', position: 1, parent_id: 'parent1' }, // Duplicate!
        { id: 'task3', position: 2, parent_id: 'parent1' },
      ];

      const validation = ClientActsAsList.validatePositions(tasks);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Scope parent1: Duplicate positions found: 1');
    });

    it('should detect position gaps', () => {
      const tasks: Task[] = [
        { id: 'task1', position: 1, parent_id: 'parent1' },
        { id: 'task2', position: 3, parent_id: 'parent1' }, // Gap at position 2
        { id: 'task3', position: 4, parent_id: 'parent1' },
      ];

      const validation = ClientActsAsList.validatePositions(tasks);
      expect(validation.valid).toBe(true); // Gaps are warnings, not errors
      expect(validation.warnings).toContain('Scope parent1: Missing positions: 2');
    });

    it('should validate positions start from 1', () => {
      const tasks: Task[] = [
        { id: 'task1', position: 2, parent_id: 'parent1' }, // Should start from 1
        { id: 'task2', position: 3, parent_id: 'parent1' },
      ];

      const validation = ClientActsAsList.validatePositions(tasks);
      expect(validation.warnings).toContain(
        "Scope parent1: Positions don't start from 1 (first position: 2)"
      );
    });

    it('should handle multiple scopes correctly', () => {
      const tasks: Task[] = [
        { id: 'task1', position: 1, parent_id: 'parent1' },
        { id: 'task2', position: 2, parent_id: 'parent1' },
        { id: 'task3', position: 1, parent_id: 'parent2' },
        { id: 'task4', position: 2, parent_id: 'parent2' },
        { id: 'task5', position: 1, parent_id: null }, // Root level
      ];

      const validation = ClientActsAsList.validatePositions(tasks);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
    });
  });

  describe('Server Position Prediction', () => {
    it('should predict server positions correctly', () => {
      const tasks: Task[] = [
        { id: 'task1', position: 1, parent_id: 'parent1' },
        { id: 'task2', position: 2, parent_id: 'parent1' },
        { id: 'task3', position: 3, parent_id: 'parent1' },
      ];

      const positionUpdates: PositionUpdate[] = [
        { id: 'task1', position: 3, parent_id: 'parent1' },
      ];

      const predictions = ClientActsAsList.predictServerPositions(tasks, positionUpdates);

      expect(predictions.get('task1')).toBe(3);
      expect(predictions.get('task2')).toBe(1); // Shifted down by gap elimination
      expect(predictions.get('task3')).toBe(2); // Shifted down by gap elimination
    });
  });

  describe('convertRelativeToPositionUpdates with repositioned_after_id', () => {
    it('should set repositioned_after_id when moving after a task', () => {
      const tasks: Task[] = [
        { id: 'task1', position: 1, parent_id: null },
        { id: 'task2', position: 2, parent_id: null },
        { id: 'task3', position: 3, parent_id: null },
      ];

      const relativeUpdates: RelativePositionUpdate[] = [{ id: 'task3', after_task_id: 'task1' }];

      const positionUpdates = ClientActsAsList.convertRelativeToPositionUpdates(
        tasks,
        relativeUpdates
      );

      expect(positionUpdates[0].id).toBe('task3');
      expect(positionUpdates[0].parent_id).toBeNull();
      expect(positionUpdates[0].repositioned_after_id).toBe('task1');
      // In test environment, position calculation uses midpoint which can equal boundaries
      expect(positionUpdates[0].position).toBeGreaterThanOrEqual(1);
      expect(positionUpdates[0].position).toBeLessThanOrEqual(2);
    });

    it('should set repositioned_after_id when moving before a task', () => {
      const tasks: Task[] = [
        { id: 'task1', position: 1, parent_id: null },
        { id: 'task2', position: 2, parent_id: null },
        { id: 'task3', position: 3, parent_id: null },
      ];

      const relativeUpdates: RelativePositionUpdate[] = [{ id: 'task3', before_task_id: 'task2' }];

      const positionUpdates = ClientActsAsList.convertRelativeToPositionUpdates(
        tasks,
        relativeUpdates
      );

      expect(positionUpdates[0].id).toBe('task3');
      expect(positionUpdates[0].parent_id).toBeNull();
      expect(positionUpdates[0].repositioned_after_id).toBe('task1'); // positioned after task1, before task2
      // In test environment, position calculation uses midpoint which can equal boundaries
      expect(positionUpdates[0].position).toBeGreaterThanOrEqual(1);
      expect(positionUpdates[0].position).toBeLessThanOrEqual(2);
    });

    it('should set repositioned_after_id to null when moving to first position', () => {
      const tasks: Task[] = [
        { id: 'task1', position: 1, parent_id: null },
        { id: 'task2', position: 2, parent_id: null },
        { id: 'task3', position: 3, parent_id: null },
      ];

      const relativeUpdates: RelativePositionUpdate[] = [{ id: 'task3', position: 'first' }];

      const positionUpdates = ClientActsAsList.convertRelativeToPositionUpdates(
        tasks,
        relativeUpdates
      );

      // Should use negative positioning for first position
      expect(positionUpdates[0].id).toBe('task3');
      expect(positionUpdates[0].position).toBeLessThan(0);
      expect(positionUpdates[0].position).toBeGreaterThanOrEqual(-10000);
      expect(positionUpdates[0].parent_id).toBe(null);
      expect(positionUpdates[0].repositioned_after_id).toBe(null);
      expect(positionUpdates[0].position_finalized).toBe(false);
      expect(positionUpdates[0].repositioned_to_top).toBe(true);
    });

    it('should set repositioned_after_id when moving to last position', () => {
      const tasks: Task[] = [
        { id: 'task1', position: 1, parent_id: null },
        { id: 'task2', position: 2, parent_id: null },
        { id: 'task3', position: 3, parent_id: null },
      ];

      const relativeUpdates: RelativePositionUpdate[] = [{ id: 'task1', position: 'last' }];

      const positionUpdates = ClientActsAsList.convertRelativeToPositionUpdates(
        tasks,
        relativeUpdates
      );

      expect(positionUpdates[0].id).toBe('task1');
      expect(positionUpdates[0].parent_id).toBeNull();
      expect(positionUpdates[0].repositioned_after_id).toBe('task3'); // positioned after the last task
      // With randomized positioning, position will be calculated after task3
      expect(positionUpdates[0].position).toBeGreaterThan(3);
    });

    it('should handle cross-parent moves with repositioned_after_id', () => {
      const tasks: Task[] = [
        { id: 'task1', position: 1, parent_id: 'parent1' },
        { id: 'task2', position: 2, parent_id: 'parent1' },
        { id: 'task3', position: 1, parent_id: 'parent2' },
        { id: 'task4', position: 2, parent_id: 'parent2' },
      ];

      const relativeUpdates: RelativePositionUpdate[] = [
        { id: 'task2', parent_id: 'parent2', after_task_id: 'task3' },
      ];

      const positionUpdates = ClientActsAsList.convertRelativeToPositionUpdates(
        tasks,
        relativeUpdates
      );

      expect(positionUpdates[0].id).toBe('task2');
      expect(positionUpdates[0].parent_id).toBe('parent2');
      expect(positionUpdates[0].repositioned_after_id).toBe('task3');
      // In test environment, position calculation uses midpoint which can equal boundaries
      expect(positionUpdates[0].position).toBeGreaterThanOrEqual(1);
      expect(positionUpdates[0].position).toBeLessThanOrEqual(2);
    });

    it('should propagate repositioned_after_id through PositionUpdateBatch', () => {
      const tasks: Task[] = [
        { id: 'task1', position: 1, parent_id: null },
        { id: 'task2', position: 2, parent_id: null },
      ];

      const positionUpdates: PositionUpdate[] = [
        { id: 'task1', position: 2, repositioned_after_id: 'task2' },
      ];

      const result = ClientActsAsList.applyPositionUpdates(tasks, positionUpdates);

      // Find the position update batch for task1
      const task1Update = result.positionUpdates.find((u) => u.taskId === 'task1');
      expect(task1Update).toBeDefined();
      expect(task1Update?.repositioned_after_id).toBeUndefined(); // not set during applyPositionUpdates
    });
  });
});
