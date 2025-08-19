import { describe, expect, test, beforeEach, vi } from 'vitest';
import { 
  taskFilter, 
  shouldShowTask, 
  shouldShowTaskLegacy, 
  getTaskFilterFunction, 
  getFilterSummary,
  taskFilterActions
} from './taskFilter.svelte';

describe('taskFilter.svelte.ts', () => {
  // Reset filter state before each test
  beforeEach(() => {
    taskFilter.selectedStatuses = ['new_task', 'in_progress', 'paused', 'successfully_completed', 'cancelled'];
    taskFilter.showDeleted = false;
    taskFilter.searchQuery = '';
    taskFilter.searchFields = ['title', 'description'];
  });

  // Helper function to create mock tasks
  const createMockTask = (overrides: any = {}) => ({
    id: '1',
    title: 'Test Task',
    description: 'Test Description',
    status: 'new_task',
    discarded_at: null,
    created_at: '2023-01-01T10:00:00Z',
    updated_at: '2023-01-01T10:00:00Z',
    ...overrides
  });

  describe('shouldShowTask', () => {
    describe('deletion filtering', () => {
      test('should show active tasks when showDeleted is false', () => {
        const task = createMockTask({ discarded_at: null });
        taskFilter.showDeleted = false;
        
        expect(shouldShowTask(task)).toBe(true);
      });

      test('should hide deleted tasks when showDeleted is false', () => {
        const task = createMockTask({ discarded_at: '2023-01-01T10:00:00Z' });
        taskFilter.showDeleted = false;
        
        expect(shouldShowTask(task)).toBe(false);
      });

      test('should show only deleted tasks when showDeleted is true', () => {
        const activeTask = createMockTask({ discarded_at: null });
        const deletedTask = createMockTask({ discarded_at: '2023-01-01T10:00:00Z' });
        taskFilter.showDeleted = true;
        
        expect(shouldShowTask(activeTask)).toBe(false);
        expect(shouldShowTask(deletedTask)).toBe(true);
      });

      test('should handle undefined discarded_at', () => {
        const task = createMockTask({ discarded_at: undefined });
        taskFilter.showDeleted = false;
        
        expect(shouldShowTask(task)).toBe(true);
      });

      test('should handle empty string discarded_at', () => {
        const task = createMockTask({ discarded_at: '' });
        taskFilter.showDeleted = false;
        
        expect(shouldShowTask(task)).toBe(true);
      });

      test('should handle truthy discarded_at values', () => {
        const task = createMockTask({ discarded_at: 'some_date' });
        taskFilter.showDeleted = false;
        
        expect(shouldShowTask(task)).toBe(false);
      });
    });

    describe('status filtering', () => {
      test('should show tasks with selected status', () => {
        const task = createMockTask({ status: 'in_progress' });
        taskFilter.selectedStatuses = ['in_progress', 'new_task'];
        
        expect(shouldShowTask(task)).toBe(true);
      });

      test('should hide tasks with unselected status', () => {
        const task = createMockTask({ status: 'completed' });
        taskFilter.selectedStatuses = ['in_progress', 'new_task'];
        
        expect(shouldShowTask(task)).toBe(false);
      });

      test('should show all tasks when no statuses selected', () => {
        const task = createMockTask({ status: 'completed' });
        taskFilter.selectedStatuses = [];
        
        expect(shouldShowTask(task)).toBe(true);
      });

      test('should handle null status', () => {
        const task = createMockTask({ status: null });
        taskFilter.selectedStatuses = ['in_progress'];
        
        expect(shouldShowTask(task)).toBe(false);
      });

      test('should handle undefined status', () => {
        const task = createMockTask({ status: undefined });
        taskFilter.selectedStatuses = ['in_progress'];
        
        expect(shouldShowTask(task)).toBe(false);
      });

      test('should handle empty string status', () => {
        const task = createMockTask({ status: '' });
        taskFilter.selectedStatuses = [''];
        
        expect(shouldShowTask(task)).toBe(true);
      });
    });

    describe('search filtering', () => {
      test('should match title search', () => {
        const task = createMockTask({ title: 'Database Migration Task' });
        taskFilter.searchQuery = 'database';
        
        expect(shouldShowTask(task)).toBe(true);
      });

      test('should match description search', () => {
        const task = createMockTask({ description: 'Migrate user data' });
        taskFilter.searchQuery = 'migrate';
        
        expect(shouldShowTask(task)).toBe(true);
      });

      test('should be case insensitive', () => {
        const task = createMockTask({ title: 'Database Migration Task' });
        taskFilter.searchQuery = 'DATABASE';
        
        expect(shouldShowTask(task)).toBe(true);
      });

      test('should show tasks when search query is empty', () => {
        const task = createMockTask({ title: 'Any Task' });
        taskFilter.searchQuery = '';
        
        expect(shouldShowTask(task)).toBe(true);
      });

      test('should show tasks when search query is whitespace only', () => {
        const task = createMockTask({ title: 'Any Task' });
        taskFilter.searchQuery = '   ';
        
        expect(shouldShowTask(task)).toBe(true);
      });

      test('should hide tasks that do not match search', () => {
        const task = createMockTask({ 
          title: 'Database Task',
          description: 'Some description' 
        });
        taskFilter.searchQuery = 'frontend';
        
        expect(shouldShowTask(task)).toBe(false);
      });

      test('should handle partial matches', () => {
        const task = createMockTask({ title: 'Database Migration Task' });
        taskFilter.searchQuery = 'mig';
        
        expect(shouldShowTask(task)).toBe(true);
      });

      test('should handle null title and description', () => {
        const task = createMockTask({ title: null, description: null });
        taskFilter.searchQuery = 'test';
        
        expect(shouldShowTask(task)).toBe(false);
      });

      test('should handle undefined title and description', () => {
        const task = createMockTask({ title: undefined, description: undefined });
        taskFilter.searchQuery = 'test';
        
        expect(shouldShowTask(task)).toBe(false);
      });

      test('should handle non-string title and description', () => {
        const task = createMockTask({ title: 123, description: ['array'] });
        taskFilter.searchQuery = 'test';
        
        expect(shouldShowTask(task)).toBe(false);
      });

      test('should respect searchFields configuration', () => {
        const task = createMockTask({ 
          title: 'Database Task',
          description: 'Frontend work' 
        });
        taskFilter.searchFields = ['title'];
        taskFilter.searchQuery = 'frontend';
        
        expect(shouldShowTask(task)).toBe(false);
      });

      test('should search in multiple fields', () => {
        const task = createMockTask({ 
          title: 'Database Task',
          description: 'Frontend work' 
        });
        taskFilter.searchFields = ['title', 'description'];
        taskFilter.searchQuery = 'frontend';
        
        expect(shouldShowTask(task)).toBe(true);
      });
    });

    describe('combined filtering', () => {
      test('should apply all filters together', () => {
        const task = createMockTask({ 
          title: 'Database Task',
          status: 'in_progress',
          discarded_at: null
        });
        
        taskFilter.selectedStatuses = ['in_progress'];
        taskFilter.showDeleted = false;
        taskFilter.searchQuery = 'database';
        
        expect(shouldShowTask(task)).toBe(true);
      });

      test('should fail if any filter fails', () => {
        const task = createMockTask({ 
          title: 'Database Task',
          status: 'completed',
          discarded_at: null
        });
        
        taskFilter.selectedStatuses = ['in_progress'];
        taskFilter.showDeleted = false;
        taskFilter.searchQuery = 'database';
        
        expect(shouldShowTask(task)).toBe(false);
      });

      test('should handle edge case: deleted task with matching search and status', () => {
        const task = createMockTask({ 
          title: 'Database Task',
          status: 'in_progress',
          discarded_at: '2023-01-01T10:00:00Z'
        });
        
        taskFilter.selectedStatuses = ['in_progress'];
        taskFilter.showDeleted = false;
        taskFilter.searchQuery = 'database';
        
        expect(shouldShowTask(task)).toBe(false);
      });
    });

    describe('error handling', () => {
      test('should handle null task', () => {
        expect(() => shouldShowTask(null)).toThrow();
      });

      test('should handle undefined task', () => {
        expect(() => shouldShowTask(undefined)).toThrow();
      });

      test('should handle empty task object', () => {
        const task = {};
        taskFilter.selectedStatuses = ['in_progress'];
        taskFilter.searchQuery = 'test';
        
        expect(shouldShowTask(task)).toBe(false);
      });

      test('should handle task with missing fields', () => {
        const task = { id: '1' };
        taskFilter.selectedStatuses = [];
        taskFilter.searchQuery = '';
        
        expect(shouldShowTask(task)).toBe(true);
      });
    });
  });

  describe('shouldShowTaskLegacy', () => {
    test('should show active tasks when showDeleted is false', () => {
      const task = createMockTask({ discarded_at: null });
      expect(shouldShowTaskLegacy(task, ['new_task'], false)).toBe(true);
    });

    test('should hide deleted tasks when showDeleted is false', () => {
      const task = createMockTask({ discarded_at: '2023-01-01T10:00:00Z' });
      expect(shouldShowTaskLegacy(task, ['new_task'], false)).toBe(false);
    });

    test('should show only deleted tasks when showDeleted is true', () => {
      const activeTask = createMockTask({ discarded_at: null });
      const deletedTask = createMockTask({ discarded_at: '2023-01-01T10:00:00Z' });
      
      expect(shouldShowTaskLegacy(activeTask, ['new_task'], true)).toBe(false);
      expect(shouldShowTaskLegacy(deletedTask, ['new_task'], true)).toBe(true);
    });

    test('should show all tasks when no statuses provided', () => {
      const task = createMockTask({ status: 'any_status' });
      expect(shouldShowTaskLegacy(task, [], false)).toBe(true);
    });

    test('should filter by status when statuses provided', () => {
      const task = createMockTask({ status: 'in_progress' });
      expect(shouldShowTaskLegacy(task, ['in_progress'], false)).toBe(true);
      expect(shouldShowTaskLegacy(task, ['new_task'], false)).toBe(false);
    });

    test('should default showDeleted to false', () => {
      const deletedTask = createMockTask({ discarded_at: '2023-01-01T10:00:00Z' });
      expect(shouldShowTaskLegacy(deletedTask, ['new_task'])).toBe(false);
    });
  });

  describe('getTaskFilterFunction', () => {
    test('should return a function that filters tasks', () => {
      const filterFunction = getTaskFilterFunction();
      const task = createMockTask({ status: 'in_progress' });
      
      taskFilter.selectedStatuses = ['in_progress'];
      
      expect(typeof filterFunction).toBe('function');
      expect(filterFunction(task)).toBe(true);
    });

    test('should return different results based on filter state', () => {
      const filterFunction = getTaskFilterFunction();
      const task = createMockTask({ status: 'in_progress' });
      
      taskFilter.selectedStatuses = ['in_progress'];
      expect(filterFunction(task)).toBe(true);
      
      taskFilter.selectedStatuses = ['new_task'];
      expect(filterFunction(task)).toBe(false);
    });
  });

  describe('getFilterSummary', () => {
    test('should return empty array when no filters active', () => {
      taskFilter.selectedStatuses = [];
      taskFilter.showDeleted = false;
      taskFilter.searchQuery = '';
      
      expect(getFilterSummary()).toEqual([]);
    });

    test('should include status filter summary', () => {
      taskFilter.selectedStatuses = ['new_task', 'in_progress'];
      
      const summary = getFilterSummary();
      expect(summary).toContain('Status: 2 selected');
    });

    test('should include search filter summary', () => {
      taskFilter.searchQuery = 'database';
      
      const summary = getFilterSummary();
      expect(summary).toContain('Search: "database"');
    });

    test('should include deleted filter summary', () => {
      taskFilter.showDeleted = true;
      
      const summary = getFilterSummary();
      expect(summary).toContain('Including deleted');
    });

    test('should include all active filters', () => {
      taskFilter.selectedStatuses = ['new_task'];
      taskFilter.showDeleted = true;
      taskFilter.searchQuery = 'test';
      
      const summary = getFilterSummary();
      expect(summary).toHaveLength(3);
      expect(summary).toContain('Status: 1 selected');
      expect(summary).toContain('Search: "test"');
      expect(summary).toContain('Including deleted');
    });

    test('should handle whitespace-only search query', () => {
      taskFilter.searchQuery = '   ';
      
      const summary = getFilterSummary();
      expect(summary).not.toContain('Search:');
    });
  });

  describe('taskFilterActions', () => {
    describe('setStatuses', () => {
      test('should set selected statuses', () => {
        taskFilterActions.setStatuses(['new_task', 'in_progress']);
        
        expect(taskFilter.selectedStatuses).toEqual(['new_task', 'in_progress']);
      });

      test('should replace existing statuses', () => {
        taskFilter.selectedStatuses = ['old_status'];
        taskFilterActions.setStatuses(['new_task']);
        
        expect(taskFilter.selectedStatuses).toEqual(['new_task']);
      });

      test('should handle empty array', () => {
        taskFilterActions.setStatuses([]);
        
        expect(taskFilter.selectedStatuses).toEqual([]);
      });
    });

    describe('setShowDeleted', () => {
      test('should set showDeleted to true', () => {
        taskFilterActions.setShowDeleted(true);
        
        expect(taskFilter.showDeleted).toBe(true);
      });

      test('should set showDeleted to false', () => {
        taskFilter.showDeleted = true;
        taskFilterActions.setShowDeleted(false);
        
        expect(taskFilter.showDeleted).toBe(false);
      });
    });

    describe('clearFilters', () => {
      test('should clear all filters', () => {
        taskFilter.selectedStatuses = ['new_task'];
        taskFilter.showDeleted = true;
        taskFilter.searchQuery = 'test';
        
        taskFilterActions.clearFilters();
        
        expect(taskFilter.selectedStatuses).toEqual([]);
        expect(taskFilter.showDeleted).toBe(false);
        // Note: clearFilters doesn't clear search query
        expect(taskFilter.searchQuery).toBe('test');
      });
    });

    describe('toggleStatus', () => {
      test('should add status when not present', () => {
        taskFilter.selectedStatuses = ['new_task'];
        taskFilterActions.toggleStatus('in_progress');
        
        expect(taskFilter.selectedStatuses).toContain('in_progress');
        expect(taskFilter.selectedStatuses).toHaveLength(2);
      });

      test('should remove status when present', () => {
        taskFilter.selectedStatuses = ['new_task', 'in_progress'];
        taskFilterActions.toggleStatus('new_task');
        
        expect(taskFilter.selectedStatuses).not.toContain('new_task');
        expect(taskFilter.selectedStatuses).toEqual(['in_progress']);
      });

      test('should handle empty status array', () => {
        taskFilter.selectedStatuses = [];
        taskFilterActions.toggleStatus('new_task');
        
        expect(taskFilter.selectedStatuses).toEqual(['new_task']);
      });

      test('should handle duplicate status addition', () => {
        taskFilter.selectedStatuses = ['new_task'];
        taskFilterActions.toggleStatus('new_task');
        taskFilterActions.toggleStatus('new_task');
        
        expect(taskFilter.selectedStatuses).toEqual(['new_task']);
      });
    });

    describe('toggleDeleted', () => {
      test('should toggle from false to true', () => {
        taskFilter.showDeleted = false;
        taskFilterActions.toggleDeleted();
        
        expect(taskFilter.showDeleted).toBe(true);
      });

      test('should toggle from true to false', () => {
        taskFilter.showDeleted = true;
        taskFilterActions.toggleDeleted();
        
        expect(taskFilter.showDeleted).toBe(false);
      });
    });

    describe('setSearchQuery', () => {
      test('should set search query', () => {
        taskFilterActions.setSearchQuery('database');
        
        expect(taskFilter.searchQuery).toBe('database');
      });

      test('should replace existing search query', () => {
        taskFilter.searchQuery = 'old query';
        taskFilterActions.setSearchQuery('new query');
        
        expect(taskFilter.searchQuery).toBe('new query');
      });

      test('should handle empty string', () => {
        taskFilterActions.setSearchQuery('');
        
        expect(taskFilter.searchQuery).toBe('');
      });

      test('should handle whitespace', () => {
        taskFilterActions.setSearchQuery('   spaces   ');
        
        expect(taskFilter.searchQuery).toBe('   spaces   ');
      });
    });

    describe('clearSearch', () => {
      test('should clear search query', () => {
        taskFilter.searchQuery = 'some query';
        taskFilterActions.clearSearch();
        
        expect(taskFilter.searchQuery).toBe('');
      });

      test('should handle already empty search query', () => {
        taskFilter.searchQuery = '';
        taskFilterActions.clearSearch();
        
        expect(taskFilter.searchQuery).toBe('');
      });
    });
  });

  describe('reactive behavior', () => {
    test('should update filter results when taskFilter state changes', () => {
      const task = createMockTask({ status: 'in_progress' });
      
      taskFilter.selectedStatuses = ['in_progress'];
      expect(shouldShowTask(task)).toBe(true);
      
      taskFilter.selectedStatuses = ['new_task'];
      expect(shouldShowTask(task)).toBe(false);
    });

    test('should update filter function results when state changes', () => {
      const filterFunction = getTaskFilterFunction();
      const task = createMockTask({ status: 'in_progress' });
      
      taskFilter.selectedStatuses = ['in_progress'];
      expect(filterFunction(task)).toBe(true);
      
      taskFilter.selectedStatuses = ['new_task'];
      expect(filterFunction(task)).toBe(false);
    });

    test('should update summary when state changes', () => {
      taskFilter.selectedStatuses = [];
      expect(getFilterSummary()).toEqual([]);
      
      taskFilter.selectedStatuses = ['new_task'];
      expect(getFilterSummary()).toContain('Status: 1 selected');
    });
  });

  describe('performance considerations', () => {
    test('should handle large number of search fields', () => {
      const task = createMockTask({ 
        title: 'Database Task',
        description: 'Test description',
        notes: 'Additional notes',
        tags: 'tag1,tag2'
      });
      
      taskFilter.searchFields = ['title', 'description', 'notes', 'tags'] as any;
      taskFilter.searchQuery = 'database';
      
      expect(shouldShowTask(task)).toBe(true);
    });

    test('should handle empty search fields array', () => {
      const task = createMockTask({ title: 'Database Task' });
      taskFilter.searchFields = [];
      taskFilter.searchQuery = 'database';
      
      expect(shouldShowTask(task)).toBe(false);
    });

    test('should handle many selected statuses', () => {
      const task = createMockTask({ status: 'in_progress' });
      const manyStatuses = Array.from({ length: 100 }, (_, i) => `status_${i}`);
      manyStatuses.push('in_progress');
      
      taskFilter.selectedStatuses = manyStatuses;
      
      expect(shouldShowTask(task)).toBe(true);
    });
  });
});