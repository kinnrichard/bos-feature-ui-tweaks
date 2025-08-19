import { describe, it, expect } from 'vitest';
import { calculatePosition } from '$lib/shared/utils/positioning-v2';

describe('Task Position Calculator - Integration Tests', () => {
  describe('Inline Task Creation Scenarios', () => {
    it('should calculate correct position when inserting between two tasks', () => {
      const tasks = [
        { id: '1', position: 10000 },
        { id: '2', position: 20000 },
        { id: '3', position: 30000 }
      ];
      
      // Inserting after task 1, before task 2
      const afterTask = tasks[0];
      const nextTask = tasks[1];
      const position = calculatePosition(afterTask.position, nextTask.position);
      
      // Should be between tasks and within randomized range
      expect(position).toBeGreaterThan(afterTask.position);
      expect(position).toBeLessThan(nextTask.position);
      // Gap is 10000, with 50% range should be between 12500 and 17500
      expect(position).toBeGreaterThanOrEqual(12500);
      expect(position).toBeLessThanOrEqual(17500);
    });

    it('should handle inserting at the end of a list', () => {
      const tasks = [
        { id: '1', position: 10000 },
        { id: '2', position: 20000 },
        { id: '3', position: 30000 }
      ];
      
      // Inserting after last task
      const lastTask = tasks[tasks.length - 1];
      const position = calculatePosition(lastTask.position, null);
      
      // Should be after last task with randomized spacing
      expect(position).toBeGreaterThan(lastTask.position);
      // With default spacing 10000 and 50% randomization, range is 37500 to 42500
      expect(position).toBeGreaterThanOrEqual(37500);
      expect(position).toBeLessThanOrEqual(42500);
    });

    it('should handle multiple insertions between same tasks', () => {
      // Start with two tasks
      let tasks = [
        { id: '1', position: 10000 },
        { id: '2', position: 20000 }
      ];
      
      // First insertion - should be between 12500 and 17500
      const pos1 = calculatePosition(10000, 20000);
      expect(pos1).toBeGreaterThan(10000);
      expect(pos1).toBeLessThan(20000);
      expect(pos1).toBeGreaterThanOrEqual(12500);
      expect(pos1).toBeLessThanOrEqual(17500);
      tasks.splice(1, 0, { id: 'new1', position: pos1 });
      
      // Second insertion between task 1 and new1
      const pos2 = calculatePosition(10000, pos1);
      expect(pos2).toBeGreaterThan(10000);
      expect(pos2).toBeLessThan(pos1);
      tasks.splice(1, 0, { id: 'new2', position: pos2 });
      
      // Third insertion between task 1 and new2 (use actual pos2 value)
      const pos3 = calculatePosition(10000, pos2);
      
      // All positions should be unique and maintain order
      expect(pos3).toBeGreaterThan(10000);
      expect(pos3).toBeLessThan(pos2);
      expect(pos2).toBeLessThan(pos1);
      expect(pos1).toBeLessThan(20000);
    });

    it('should handle subtask insertion with parent scope', () => {
      const tasks = [
        { id: '1', position: 10000, parent_id: null },
        { id: '2', position: 20000, parent_id: null },
        { id: '3', position: 10000, parent_id: '2' },
        { id: '4', position: 20000, parent_id: '2' },
        { id: '5', position: 30000, parent_id: '2' }
      ];
      
      // Get only subtasks of task 2
      const subtasks = tasks.filter(t => t.parent_id === '2')
                           .sort((a, b) => a.position - b.position);
      
      // Insert between first and second subtask
      const position = calculatePosition(subtasks[0].position, subtasks[1].position);
      
      // Should be between subtasks with randomized positioning
      expect(position).toBeGreaterThan(subtasks[0].position);
      expect(position).toBeLessThan(subtasks[1].position);
      // Gap is 10000, with 50% range should be between 12500 and 17500
      expect(position).toBeGreaterThanOrEqual(12500);
      expect(position).toBeLessThanOrEqual(17500);
    });
  });

  describe('Bottom Task Creation Scenarios', () => {
    it('should add task at end of root level', () => {
      const tasks = [
        { id: '1', position: 10000, parent_id: null },
        { id: '2', position: 20000, parent_id: null },
        { id: '3', position: 10000, parent_id: '2' }
      ];
      
      // Get only root tasks
      const rootTasks = tasks.filter(t => !t.parent_id)
                            .sort((a, b) => a.position - b.position);
      
      const lastTask = rootTasks[rootTasks.length - 1];
      const position = calculatePosition(lastTask.position, null);
      
      // Should be after last task with randomized spacing
      expect(position).toBeGreaterThan(lastTask.position);
      // With default spacing 10000 and 50% randomization, range is 27500 to 32500
      expect(position).toBeGreaterThanOrEqual(27500);
      expect(position).toBeLessThanOrEqual(32500);
    });

    it('should handle first task in empty job', () => {
      const position = calculatePosition(null, null);
      
      expect(position).toBe(10000); // Default initial position
    });
  });

  describe('Edge Cases and Precision', () => {
    it('should handle many insertions between same positions', () => {
      let prevPos = 10000;
      let nextPos = 20000;
      const positions: number[] = [];
      
      // Simulate insertions between same two positions
      for (let i = 0; i < 10; i++) {
        const pos = calculatePosition(prevPos, nextPos);
        positions.push(pos);
        nextPos = pos; // Next insertion will be between prevPos and this new position
      }
      
      // All positions should be unique (though integers may eventually collide)
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBe(positions.length);
      
      // All should be between original bounds
      positions.forEach(pos => {
        expect(pos).toBeGreaterThan(10000);
        expect(pos).toBeLessThan(20000);
      });
      
      // Should be in descending order (since we're always inserting at the beginning)
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeLessThan(positions[i - 1]);
      }
    });

    it('should eventually reach same position with many subdivisions', () => {
      // This demonstrates the limitation of integer positioning
      let pos1 = 10000;
      let pos2 = 10001; // Only 1 apart
      
      const position = calculatePosition(pos1, pos2);
      expect(position).toBe(10000); // Math.floor((10000 + 10001) / 2) = 10000
      
      // This is where secondary sort by created_at becomes important
    });
  });

  describe('Zero.js Sync Compatibility', () => {
    it('should produce positions suitable for Zero.js sync', () => {
      // Positions should be integers that can be accurately represented in JSON
      const position = calculatePosition(10000, 20000);
      
      // Convert to JSON and back
      const jsonStr = JSON.stringify({ position });
      const parsed = JSON.parse(jsonStr);
      
      expect(parsed.position).toBe(position);
      expect(typeof parsed.position).toBe('number');
    });

    it('should handle concurrent offline insertions', () => {
      // Simulate two users inserting at the same position offline
      const user1Position = calculatePosition(10000, 20000);
      const user2Position = calculatePosition(10000, 20000);
      
      // With randomization, users are less likely to get identical positions
      expect(user1Position).toBeGreaterThan(10000);
      expect(user1Position).toBeLessThan(20000);
      expect(user2Position).toBeGreaterThan(10000);
      expect(user2Position).toBeLessThan(20000);
      
      // Both should be in the randomized range (12500-17500)
      expect(user1Position).toBeGreaterThanOrEqual(12500);
      expect(user1Position).toBeLessThanOrEqual(17500);
      expect(user2Position).toBeGreaterThanOrEqual(12500);
      expect(user2Position).toBeLessThanOrEqual(17500);
      
      // In real usage, tasks would still be ordered by position, then created_at
      // to handle any remaining duplicate positions gracefully
    });
  });
});