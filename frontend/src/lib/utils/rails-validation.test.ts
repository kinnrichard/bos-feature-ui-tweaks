/**
 * Tests to validate TypeScript logic against actual Rails acts_as_list behavior
 */

import { describe, it, expect } from 'vitest';
import { calculatePositionFromTarget } from './position-calculator';
import { ClientActsAsList } from './client-acts-as-list';
import type { Task, DropZoneInfo } from './position-calculator';
import { debugValidation } from './debug';

// Import actual Rails behavior from fixtures
import singleTaskFixture from './test-fixtures/single_task_move.json';
import multiTaskFixture from './test-fixtures/multi_task_move.json';
import threeTaskFixture from './test-fixtures/three_task_move.json';

describe('Rails Validation Tests', () => {
  describe('Single Task Move', () => {
    it('should match Rails behavior for single task move', () => {
      const railsResult = singleTaskFixture.test_result;

      // Create tasks matching Rails test
      const tasks: Task[] = Object.entries(railsResult.initial_positions).map(([id, position]) => ({
        id: `task${id}`,
        position: position as number,
        parent_id: 'test_parent',
      }));

      // Apply the same operation using our TypeScript logic
      const positionUpdates = [
        {
          id: 'task3',
          position: railsResult.operation.to_position,
          parent_id: 'test_parent',
        },
      ];

      const result = ClientActsAsList.applyPositionUpdates(tasks, positionUpdates);

      // Check that our simulation matches Rails results
      const finalPositions = new Map(result.updatedTasks.map((t) => [t.id, t.position]));

      Object.entries(railsResult.final_positions).forEach(([taskId, expectedPosition]) => {
        const actualPosition = finalPositions.get(`task${taskId}`);
        expect(
          actualPosition,
          `Task ${taskId} should be at position ${expectedPosition}, got ${actualPosition}`
        ).toBe(expectedPosition);
      });

      debugValidation('✓ Single task move matches Rails behavior');
    });
  });

  describe('Multi Task Move', () => {
    it('should match Rails behavior for multi task move', () => {
      const railsResult = multiTaskFixture.test_result;

      // Create tasks matching Rails test
      const tasks: Task[] = Object.entries(railsResult.initial_positions).map(([id, position]) => ({
        id: `task${id}`,
        position: position as number,
        parent_id: 'test_parent',
      }));

      // Apply the operations sequentially as Rails does
      const operations = railsResult.operations;

      let currentTasks = tasks;
      operations.forEach((op: { task: string | number; to_position: number }) => {
        const positionUpdate = [
          {
            id: `task${op.task}`,
            position: op.to_position,
            parent_id: 'test_parent',
          },
        ];

        const result = ClientActsAsList.applyPositionUpdates(currentTasks, positionUpdate);
        currentTasks = result.updatedTasks;
      });

      // Check final positions match Rails
      const finalPositions = new Map(currentTasks.map((t) => [t.id, t.position]));

      Object.entries(railsResult.final_positions).forEach(([taskId, expectedPosition]) => {
        const actualPosition = finalPositions.get(`task${taskId}`);
        expect(
          actualPosition,
          `Task ${taskId} should be at position ${expectedPosition}, got ${actualPosition}`
        ).toBe(expectedPosition);
      });

      debugValidation('✓ Multi task move matches Rails behavior');
    });
  });

  describe('Three Task Move', () => {
    it('should match Rails behavior for three task move', () => {
      const railsResult = threeTaskFixture.test_result;

      // Create tasks matching Rails test
      const tasks: Task[] = Object.entries(railsResult.initial_positions).map(([id, position]) => ({
        id: `task${id}`,
        position: position as number,
        parent_id: 'test_parent',
      }));

      // Apply operations sequentially
      const operations = railsResult.operations;

      let currentTasks = tasks;
      operations.forEach((op: { task: string | number; to_position: number }) => {
        const positionUpdate = [
          {
            id: `task${op.task}`,
            position: op.to_position,
            parent_id: 'test_parent',
          },
        ];

        const result = ClientActsAsList.applyPositionUpdates(currentTasks, positionUpdate);
        currentTasks = result.updatedTasks;
      });

      // Check final positions match Rails
      const finalPositions = new Map(currentTasks.map((t) => [t.id, t.position]));

      Object.entries(railsResult.final_positions).forEach(([taskId, expectedPosition]) => {
        const actualPosition = finalPositions.get(`task${taskId}`);
        expect(
          actualPosition,
          `Task ${taskId} should be at position ${expectedPosition}, got ${actualPosition}`
        ).toBe(expectedPosition);
      });

      debugValidation('✓ Three task move matches Rails behavior');
    });
  });

  describe('Position Calculator Rails Validation', () => {
    it('should calculate positions that Rails would accept', () => {
      // Test the user's original bug scenario
      const tasks: Task[] = [
        { id: 'task3', position: 3, parent_id: 'parent1' },
        { id: 'task4', position: 4, parent_id: 'parent1' },
        { id: 'task5', position: 5, parent_id: 'parent1' },
        { id: 'task6', position: 6, parent_id: 'parent1' },
        { id: 'task7', position: 7, parent_id: 'parent1' },
        { id: 'task8', position: 8, parent_id: 'parent1' },
        { id: 'task9', position: 9, parent_id: 'parent1' },
      ];

      const dropZone: DropZoneInfo = {
        mode: 'reorder',
        position: 'above',
        targetTaskId: 'task9',
      };

      const result = calculatePositionFromTarget(tasks, dropZone, 'parent1', ['task3']);

      // Based on Rails fixture: moving to position 9 should work
      expect(result.calculatedPosition).toBe(9);

      // Verify this would produce correct Rails behavior
      const simulatedResult = ClientActsAsList.applyPositionUpdates(tasks, [
        {
          id: 'task3',
          position: result.calculatedPosition,
          parent_id: 'parent1',
        },
      ]);

      // Task 3 should end up at position 9 (Rails behavior)
      const task3FinalPosition = simulatedResult.updatedTasks.find(
        (t) => t.id === 'task3'
      )?.position;
      expect(task3FinalPosition).toBe(9);

      // Task 9 should be shifted to position 8
      const task9FinalPosition = simulatedResult.updatedTasks.find(
        (t) => t.id === 'task9'
      )?.position;
      expect(task9FinalPosition).toBe(8);

      debugValidation('✓ Position calculator produces Rails-compatible positions');
    });
  });
});
