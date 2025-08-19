import { describe, it, expect } from 'vitest';
import { compareTasksForSort, sortTasks, sortTasksInPlace, getTaskSortFields } from './task-sorting';

describe('task-sorting', () => {
  describe('compareTasksForSort', () => {
    it('should sort by position when positions differ', () => {
      const task1 = { position: 10000, created_at: 1000 };
      const task2 = { position: 20000, created_at: 500 };
      
      expect(compareTasksForSort(task1, task2)).toBeLessThan(0);
      expect(compareTasksForSort(task2, task1)).toBeGreaterThan(0);
    });
    
    it('should sort by created_at when positions are equal', () => {
      const task1 = { position: 10000, created_at: 1000 };
      const task2 = { position: 10000, created_at: 2000 };
      
      expect(compareTasksForSort(task1, task2)).toBeLessThan(0);
      expect(compareTasksForSort(task2, task1)).toBeGreaterThan(0);
    });
    
    it('should return 0 when both position and created_at are equal', () => {
      const task1 = { position: 10000, created_at: 1000 };
      const task2 = { position: 10000, created_at: 1000 };
      
      expect(compareTasksForSort(task1, task2)).toBe(0);
    });
    
    it('should handle null/undefined positions', () => {
      const task1 = { position: null, created_at: 1000 };
      const task2 = { position: 10000, created_at: 1000 };
      const task3 = { position: undefined, created_at: 1000 };
      
      // null/undefined positions should be treated as 0
      expect(compareTasksForSort(task1, task2)).toBeLessThan(0);
      expect(compareTasksForSort(task3, task2)).toBeLessThan(0);
    });
    
    it('should handle null/undefined created_at', () => {
      const task1 = { position: 10000, created_at: null };
      const task2 = { position: 10000, created_at: 1000 };
      const task3 = { position: 10000, created_at: undefined };
      
      // null/undefined created_at should be treated as 0
      expect(compareTasksForSort(task1, task2)).toBeLessThan(0);
      expect(compareTasksForSort(task3, task2)).toBeLessThan(0);
    });
    
    it('should handle Date objects for created_at', () => {
      const task1 = { position: 10000, created_at: new Date('2024-01-01') };
      const task2 = { position: 10000, created_at: new Date('2024-01-02') };
      
      expect(compareTasksForSort(task1, task2)).toBeLessThan(0);
    });
    
    it('should handle string dates for created_at', () => {
      const task1 = { position: 10000, created_at: '2024-01-01T00:00:00Z' };
      const task2 = { position: 10000, created_at: '2024-01-02T00:00:00Z' };
      
      expect(compareTasksForSort(task1, task2)).toBeLessThan(0);
    });
  });
  
  describe('sortTasks', () => {
    it('should sort array of tasks without mutating original', () => {
      const tasks = [
        { id: '1', position: 30000, created_at: 1000 },
        { id: '2', position: 10000, created_at: 2000 },
        { id: '3', position: 20000, created_at: 3000 },
        { id: '4', position: 10000, created_at: 1000 }
      ];
      
      const sorted = sortTasks(tasks);
      
      // Check that original is not mutated
      expect(tasks[0].id).toBe('1');
      
      // Check sorted order
      expect(sorted[0].id).toBe('4'); // position 10000, created_at 1000
      expect(sorted[1].id).toBe('2'); // position 10000, created_at 2000
      expect(sorted[2].id).toBe('3'); // position 20000
      expect(sorted[3].id).toBe('1'); // position 30000
    });
    
    it('should handle empty array', () => {
      const tasks: any[] = [];
      const sorted = sortTasks(tasks);
      expect(sorted).toEqual([]);
    });
  });
  
  describe('sortTasksInPlace', () => {
    it('should sort array of tasks in place', () => {
      const tasks = [
        { id: '1', position: 30000, created_at: 1000 },
        { id: '2', position: 10000, created_at: 2000 },
        { id: '3', position: 20000, created_at: 3000 },
        { id: '4', position: 10000, created_at: 1000 }
      ];
      
      const result = sortTasksInPlace(tasks);
      
      // Check that original is mutated
      expect(tasks[0].id).toBe('4');
      expect(result).toBe(tasks); // Should return the same array
    });
  });
  
  describe('getTaskSortFields', () => {
    it('should return correct field order for Zero.js', () => {
      const fields = getTaskSortFields();
      expect(fields).toEqual(['position', 'created_at']);
    });
  });
  
  describe('edge cases', () => {
    it('should handle tasks with same position inserted at different times', () => {
      // Simulating two offline clients inserting at same position
      const tasks = [
        { id: '1', position: 10000, created_at: 1000 },
        { id: '2', position: 15000, created_at: 2000 }, // Client A inserts between 1 and 3
        { id: '3', position: 20000, created_at: 3000 },
        { id: '4', position: 15000, created_at: 2500 }  // Client B also inserts between 1 and 3
      ];
      
      const sorted = sortTasks(tasks);
      
      expect(sorted[0].id).toBe('1'); // position 10000
      expect(sorted[1].id).toBe('2'); // position 15000, created earlier
      expect(sorted[2].id).toBe('4'); // position 15000, created later
      expect(sorted[3].id).toBe('3'); // position 20000
    });
    
    it('should provide stable sort for equal items', () => {
      const tasks = [
        { id: '1', position: 10000, created_at: 1000 },
        { id: '2', position: 10000, created_at: 1000 },
        { id: '3', position: 10000, created_at: 1000 }
      ];
      
      const sorted = sortTasks(tasks);
      
      // When all sort keys are equal, relative order should be preserved
      expect(sorted.map(t => t.id)).toEqual(['1', '2', '3']);
    });
  });
});