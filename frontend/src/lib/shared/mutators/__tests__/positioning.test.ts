import { describe, expect, it, beforeEach } from 'vitest';
import {
  createPositioningMutator,
  taskPositioningMutator,
  genericPositioningMutator,
  PositionManager,
  TaskPositionManager,
  clearPositionCache,
  type Positionable
} from '../positioning';
import type { MutatorContext } from '../base-mutator';

describe('Positioning Mutator', () => {
  let mockContext: MutatorContext;

  beforeEach(() => {
    mockContext = {
      tx: {} as any,
      user: { id: 'user-123' },
      offline: false,
      action: 'create'
    };
    
    // Clear all position cache entries before each test
    clearPositionCache();
  });

  describe('createPositioningMutator', () => {
    it('assigns position to new records', () => {
      const mutator = createPositioningMutator('test_table');
      const data: Positionable = { name: 'Test Record' };

      const result = mutator(data, mockContext);

      expect(result).toHaveProperty('position');
      expect(typeof result.position).toBe('number');
      expect(result.position).toBeGreaterThan(0);
    });

    it('preserves manually set position when allowed', () => {
      const mutator = createPositioningMutator('test_table', {
        allowManualPositioning: true
      });
      const data: Positionable = { name: 'Test Record', position: 5 };

      const result = mutator(data, mockContext);

      expect(result.position).toBe(5);
    });

    it('removes manually set position when not allowed', () => {
      const mutator = createPositioningMutator('test_table', {
        allowManualPositioning: false
      });
      const data: Positionable = { name: 'Test Record', position: 5 };

      const result = mutator(data, mockContext);

      expect(result.position).not.toBe(5);
      expect(result.position).toBeGreaterThan(0);
    });

    it('uses custom position field name', () => {
      const mutator = createPositioningMutator('test_table', {
        positionField: 'sort_order'
      });
      const data = { name: 'Test Record' };

      const result = mutator(data, mockContext);

      expect(result).toHaveProperty('sort_order');
      expect(result.sort_order).toBeGreaterThan(0);
    });

    it('handles offline positioning with cache', () => {
      const mutator = createPositioningMutator('test_table');
      const offlineContext = { ...mockContext, offline: true };
      
      const data1 = { name: 'Record 1' };
      const data2 = { name: 'Record 2' };

      const result1 = mutator(data1, offlineContext);
      const result2 = mutator(data2, offlineContext);

      expect(result1.position).toBe(1);
      expect(result2.position).toBe(2);
    });

    it('skips positioning for updates without position field', () => {
      const mutator = createPositioningMutator('test_table');
      const updateContext = { ...mockContext, action: 'update' as const };
      const data = { name: 'Updated Name' };

      const result = mutator(data, updateContext);

      expect(result).not.toHaveProperty('position');
      expect(result).toEqual(data);
    });

    it('assigns position for updates that include position field', () => {
      const mutator = createPositioningMutator('test_table');
      const updateContext = { ...mockContext, action: 'update' as const };
      const data: Positionable = { name: 'Updated Name', position: undefined };

      const result = mutator(data, updateContext);

      expect(result).toHaveProperty('position');
      expect(result.position).toBeGreaterThan(0);
    });
  });

  describe('Scoped Positioning', () => {
    it('handles scoped positioning correctly', () => {
      const mutator = createPositioningMutator('tasks', {
        scopeFields: ['job_id']
      });
      const offlineContext = { ...mockContext, offline: true };
      
      const taskA1 = { name: 'Task A1', job_id: 'job-a' };
      const taskA2 = { name: 'Task A2', job_id: 'job-a' };
      const taskB1 = { name: 'Task B1', job_id: 'job-b' };

      const resultA1 = mutator(taskA1, offlineContext);
      const resultA2 = mutator(taskA2, offlineContext);
      const resultB1 = mutator(taskB1, offlineContext);

      // Same scope should increment
      expect(resultA1.position).toBe(1);
      expect(resultA2.position).toBe(2);
      
      // Different scope should start fresh
      expect(resultB1.position).toBe(1);
    });
  });

  describe('taskPositioningMutator', () => {
    it('is configured for task-specific positioning', () => {
      const offlineContext = { ...mockContext, offline: true };
      
      const task1 = { title: 'Task 1', job_id: 'job-1' };
      const task2 = { title: 'Task 2', job_id: 'job-1' };
      const task3 = { title: 'Task 3', job_id: 'job-2' };

      const result1 = taskPositioningMutator(task1, offlineContext);
      const result2 = taskPositioningMutator(task2, offlineContext);
      const result3 = taskPositioningMutator(task3, offlineContext);

      expect(result1.position).toBe(1);
      expect(result2.position).toBe(2);
      expect(result3.position).toBe(1); // Different job, resets
    });
  });

  describe('genericPositioningMutator', () => {
    it('handles generic positioning without scope', () => {
      const offlineContext = { ...mockContext, offline: true };
      
      const data1 = { name: 'Item 1' };
      const data2 = { name: 'Item 2' };

      const result1 = genericPositioningMutator(data1, offlineContext);
      const result2 = genericPositioningMutator(data2, offlineContext);

      expect(result1.position).toBe(1);
      expect(result2.position).toBe(2);
    });
  });

  describe('PositionManager', () => {
    let manager: PositionManager;

    beforeEach(() => {
      manager = new PositionManager('test_table');
    });

    it('creates move_to update data', () => {
      const result = manager.moveTo(5);
      expect(result).toEqual({ position: 5 });
    });

    it('creates move_to_top update data', () => {
      const result = manager.moveToTop();
      expect(result).toEqual({ position: 1 });
    });

    it('creates move_to_bottom update data', () => {
      const result = manager.moveToBottom();
      expect(result.position).toBeGreaterThan(1000000);
    });

    it('creates move_higher update data', () => {
      const result = manager.moveHigher(5);
      expect(result).toEqual({ position: 4 });
    });

    it('creates move_higher update data (min 1)', () => {
      const result = manager.moveHigher(1);
      expect(result).toEqual({ position: 1 });
    });

    it('creates move_lower update data', () => {
      const result = manager.moveLower(5);
      expect(result).toEqual({ position: 6 });
    });

    it('uses custom position field', () => {
      const customManager = new PositionManager('test_table', {
        positionField: 'sort_order'
      });
      const result = customManager.moveTo(3);
      expect(result).toEqual({ sort_order: 3 });
    });
  });

  describe('TaskPositionManager', () => {
    it('is preconfigured for tasks', () => {
      const result = TaskPositionManager.moveTo(3);
      expect(result).toEqual({ position: 3 });
    });
  });

  describe('clearPositionCache', () => {
    it('clears position cache for offline scenarios', () => {
      const mutator = createPositioningMutator('test_table');
      const offlineContext = { ...mockContext, offline: true };
      
      // Create some positions to cache
      mutator({ name: 'Test 1' }, offlineContext);
      mutator({ name: 'Test 2' }, offlineContext);
      
      // Clear cache
      clearPositionCache('test_table');
      
      // Next position should start from 1 again
      const result = mutator({ name: 'Test 3' }, offlineContext);
      expect(result.position).toBe(1);
    });

    it('handles scoped cache clearing', () => {
      const mutator = createPositioningMutator('tasks', { scopeFields: ['job_id'] });
      const offlineContext = { ...mockContext, offline: true };
      
      // Create positions in different scopes
      mutator({ name: 'Task A1', job_id: 'job-a' }, offlineContext);
      mutator({ name: 'Task B1', job_id: 'job-b' }, offlineContext);
      
      // Clear specific scope
      clearPositionCache('tasks', { job_id: 'job-a' }, ['job_id']);
      
      // job-a scope should reset, job-b should continue
      const resultA = mutator({ name: 'Task A2', job_id: 'job-a' }, offlineContext);
      const resultB = mutator({ name: 'Task B2', job_id: 'job-b' }, offlineContext);
      
      expect(resultA.position).toBe(1);
      expect(resultB.position).toBe(2);
    });
  });
});