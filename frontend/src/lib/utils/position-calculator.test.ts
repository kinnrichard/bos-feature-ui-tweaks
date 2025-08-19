/**
 * Comprehensive tests for position calculation logic
 * Based on real user bug reports and edge cases
 */

import { describe, it, expect } from 'vitest';
import { calculatePositionFromTarget } from './position-calculator';
import type { Task, DropZoneInfo } from './position-calculator';

// Test data from user logs
const createTestTasks = (): Task[] => [
  {
    id: 'aa199df2-ad07-4141-9ca3-24350ae10f66',
    position: 3,
    parent_id: '0868e68c-0560-49e4-8023-8da58258a0fb',
  },
  {
    id: '573af5c6-7cd6-41e2-9207-e4e4354b3a53',
    position: 4,
    parent_id: '0868e68c-0560-49e4-8023-8da58258a0fb',
  },
  {
    id: '0d6d43c1-90a3-4fc3-a9ae-7658f797f333',
    position: 5,
    parent_id: '0868e68c-0560-49e4-8023-8da58258a0fb',
  },
  {
    id: 'd4754ddf-471b-41a4-948a-01423c144469',
    position: 6,
    parent_id: '0868e68c-0560-49e4-8023-8da58258a0fb',
  },
  {
    id: 'c180c0ed-3a1b-46c4-b3cd-deb96de1e930',
    position: 7,
    parent_id: '0868e68c-0560-49e4-8023-8da58258a0fb',
  },
  {
    id: 'f6d7132a-6060-4c15-946e-b2701f21d1f9',
    position: 8,
    parent_id: '0868e68c-0560-49e4-8023-8da58258a0fb',
  },
  {
    id: '413d84d5-93e4-4daf-b648-eaee8c776d39',
    position: 9,
    parent_id: '0868e68c-0560-49e4-8023-8da58258a0fb',
  },
  {
    id: '0bd45386-d4ef-4531-9f45-1fce59b379e1',
    position: 10,
    parent_id: '0868e68c-0560-49e4-8023-8da58258a0fb',
  },
  {
    id: 'f07927d6-87f3-4cc0-ab0e-099cf4744fc2',
    position: 11,
    parent_id: '0868e68c-0560-49e4-8023-8da58258a0fb',
  },
];

describe('calculatePositionFromTarget', () => {
  describe('User Bug Report Scenarios', () => {
    it('should match server behavior for single task "above" positioning', () => {
      // User scenario: Single task aa199df2 dropped "above" 413d84d5
      // Server result: aa199df2 at position 7, 413d84d5 at position 8
      const tasks = createTestTasks();
      const dropZone: DropZoneInfo = {
        mode: 'reorder',
        position: 'above',
        targetTaskId: '413d84d5-93e4-4daf-b648-eaee8c776d39',
      };
      const parentId = '0868e68c-0560-49e4-8023-8da58258a0fb';
      const draggedTaskIds = ['aa199df2-ad07-4141-9ca3-24350ae10f66'];

      const result = calculatePositionFromTarget(tasks, dropZone, parentId, draggedTaskIds);

      // Note: This test was based on incorrect assumptions about Rails behavior
      // The actual Rails behavior is tested in rails-validation.test.ts

      // Expected: Position should be 7 to match server result
      expect(result.calculatedPosition).toBe(7);
      expect(result.reasoning.isWithinScopeMove).toBe(true);
      expect(result.reasoning.gapsBeforeTarget).toBe(1);
      expect(result.reasoning.adjustmentApplied).toBe(true);
    });

    it('should handle multi-task "above" positioning correctly', () => {
      // User scenario: Two tasks (aa199df2, 573af5c6) dropped "above" 413d84d5
      // Server result: aa199df2 at position 7, 573af5c6 at position 9, 413d84d5 at position 8
      const tasks = createTestTasks();
      const dropZone: DropZoneInfo = {
        mode: 'reorder',
        position: 'above',
        targetTaskId: '413d84d5-93e4-4daf-b648-eaee8c776d39',
      };
      const parentId = '0868e68c-0560-49e4-8023-8da58258a0fb';
      const draggedTaskIds = [
        'aa199df2-ad07-4141-9ca3-24350ae10f66',
        '573af5c6-7cd6-41e2-9207-e4e4354b3a53',
      ];

      const result = calculatePositionFromTarget(tasks, dropZone, parentId, draggedTaskIds);

      // Expected: Position should be 7 (for first task in multi-select)
      expect(result.calculatedPosition).toBe(7);
      expect(result.reasoning.isWithinScopeMove).toBe(true);
      expect(result.reasoning.gapsBeforeTarget).toBe(2); // Two tasks before target
      expect(result.reasoning.adjustmentApplied).toBe(true);
    });

    it('should handle three-task selection edge case', () => {
      // Simulate user's "off-by-2" error scenario with 3 tasks selected
      const tasks = createTestTasks();
      const dropZone: DropZoneInfo = {
        mode: 'reorder',
        position: 'above',
        targetTaskId: 'f6d7132a-6060-4c15-946e-b2701f21d1f9', // Position 8
      };
      const parentId = '0868e68c-0560-49e4-8023-8da58258a0fb';
      const draggedTaskIds = [
        'aa199df2-ad07-4141-9ca3-24350ae10f66', // Position 3
        '573af5c6-7cd6-41e2-9207-e4e4354b3a53', // Position 4
        '0d6d43c1-90a3-4fc3-a9ae-7658f797f333', // Position 5
      ];

      const result = calculatePositionFromTarget(tasks, dropZone, parentId, draggedTaskIds);

      // Expected: Should account for all 3 gaps before target
      expect(result.calculatedPosition).toBe(5); // 8 - 3 gaps = 5
      expect(result.reasoning.gapsBeforeTarget).toBe(3);
      expect(result.reasoning.adjustmentApplied).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle dropping above first task', () => {
      const tasks = createTestTasks();
      const dropZone: DropZoneInfo = {
        mode: 'reorder',
        position: 'above',
        targetTaskId: 'aa199df2-ad07-4141-9ca3-24350ae10f66', // First task
      };
      const parentId = '0868e68c-0560-49e4-8023-8da58258a0fb';
      const draggedTaskIds = ['f07927d6-87f3-4cc0-ab0e-099cf4744fc2']; // Last task

      const result = calculatePositionFromTarget(tasks, dropZone, parentId, draggedTaskIds);

      expect(result.calculatedPosition).toBe(3); // Above first task
      expect(result.reasoning.insertionType).toBe('before-first');
    });

    it('should handle dropping below last task', () => {
      const tasks = createTestTasks();
      const dropZone: DropZoneInfo = {
        mode: 'reorder',
        position: 'below',
        targetTaskId: 'f07927d6-87f3-4cc0-ab0e-099cf4744fc2', // Last task
      };
      const parentId = '0868e68c-0560-49e4-8023-8da58258a0fb';
      const draggedTaskIds = ['aa199df2-ad07-4141-9ca3-24350ae10f66']; // First task

      const result = calculatePositionFromTarget(tasks, dropZone, parentId, draggedTaskIds);

      expect(result.calculatedPosition).toBe(11); // Below last task (no gap adjustment for moving up)
      expect(result.reasoning.insertionType).toBe('at-end');
      expect(result.reasoning.adjustmentApplied).toBe(false);
    });

    it('should handle cross-parent moves', () => {
      const tasks: Task[] = [
        { id: 'task1', position: 1, parent_id: 'parent1' },
        { id: 'task2', position: 2, parent_id: 'parent1' },
        { id: 'task3', position: 1, parent_id: 'parent2' },
        { id: 'task4', position: 2, parent_id: 'parent2' },
      ];
      const dropZone: DropZoneInfo = {
        mode: 'reorder',
        position: 'above',
        targetTaskId: 'task3', // In parent2
      };
      const parentId = 'parent1'; // Dropping into parent1
      const draggedTaskIds = ['task4']; // From parent2

      const result = calculatePositionFromTarget(tasks, dropZone, parentId, draggedTaskIds);

      expect(result.reasoning.insertionType).toBe('cross-parent');
      expect(result.reasoning.isWithinScopeMove).toBe(false);
    });

    it('should handle nesting mode', () => {
      const tasks = createTestTasks();
      const dropZone: DropZoneInfo = {
        mode: 'nest',
        targetTaskId: '413d84d5-93e4-4daf-b648-eaee8c776d39',
      };
      const parentId = '413d84d5-93e4-4daf-b648-eaee8c776d39'; // Nesting under target
      const draggedTaskIds = ['aa199df2-ad07-4141-9ca3-24350ae10f66'];

      const result = calculatePositionFromTarget(tasks, dropZone, parentId, draggedTaskIds);

      expect(result.calculatedPosition).toBe(1); // First child
      expect(result.reasoning.insertionType).toBe('nest-end');
    });

    it('should handle missing target task gracefully', () => {
      const tasks = createTestTasks();
      const dropZone: DropZoneInfo = {
        mode: 'reorder',
        position: 'above',
        targetTaskId: 'non-existent-task',
      };
      const parentId = '0868e68c-0560-49e4-8023-8da58258a0fb';
      const draggedTaskIds = ['aa199df2-ad07-4141-9ca3-24350ae10f66'];

      const result = calculatePositionFromTarget(tasks, dropZone, parentId, draggedTaskIds);

      expect(result.calculatedPosition).toBe(1);
      expect(result.reasoning.insertionType).toBe('target-not-found');
    });

    it('should handle null drop zone', () => {
      const tasks = createTestTasks();
      const dropZone = null;
      const parentId = '0868e68c-0560-49e4-8023-8da58258a0fb';
      const draggedTaskIds = ['aa199df2-ad07-4141-9ca3-24350ae10f66'];

      const result = calculatePositionFromTarget(tasks, dropZone, parentId, draggedTaskIds);

      expect(result.calculatedPosition).toBe(1);
      expect(result.reasoning.insertionType).toBe('default');
    });
  });

  describe('Position Calculation Logic', () => {
    it('should not apply gap adjustment for moving up', () => {
      const tasks = createTestTasks();
      const dropZone: DropZoneInfo = {
        mode: 'reorder',
        position: 'above',
        targetTaskId: 'aa199df2-ad07-4141-9ca3-24350ae10f66', // Position 3
      };
      const parentId = '0868e68c-0560-49e4-8023-8da58258a0fb';
      const draggedTaskIds = ['f07927d6-87f3-4cc0-ab0e-099cf4744fc2']; // Position 11, moving up

      const result = calculatePositionFromTarget(tasks, dropZone, parentId, draggedTaskIds);

      expect(result.reasoning.gapsBeforeTarget).toBe(0); // No gaps before target
      expect(result.reasoning.adjustmentApplied).toBe(false);
    });

    it('should apply correct gap adjustment for moving down', () => {
      const tasks = createTestTasks();
      const dropZone: DropZoneInfo = {
        mode: 'reorder',
        position: 'above',
        targetTaskId: 'f07927d6-87f3-4cc0-ab0e-099cf4744fc2', // Position 11
      };
      const parentId = '0868e68c-0560-49e4-8023-8da58258a0fb';
      const draggedTaskIds = [
        'aa199df2-ad07-4141-9ca3-24350ae10f66', // Position 3
        '573af5c6-7cd6-41e2-9207-e4e4354b3a53', // Position 4
      ]; // Both moving down

      const result = calculatePositionFromTarget(tasks, dropZone, parentId, draggedTaskIds);

      expect(result.reasoning.gapsBeforeTarget).toBe(2); // Two gaps before target
      expect(result.calculatedPosition).toBe(9); // 11 - 2 = 9
      expect(result.reasoning.adjustmentApplied).toBe(true);
    });
  });
});
