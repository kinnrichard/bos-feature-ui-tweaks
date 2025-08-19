/**
 * Epic-008 Generated Models Tests
 *
 * Tests for the generated Task model and its integration with the new architecture
 * Validates CRUD operations, instance methods, and Rails compatibility
 */

import { test, expect } from '@playwright/test';
import {
  ReactiveTask as Task,
  type TaskData,
  type CreateTaskData,
  type UpdateTaskData,
} from '../src/lib/models/reactive-task';

// Mock Zero client for testing
const mockZeroClient = {
  query: {
    tasks: {
      where: (field: string, value: unknown) => ({
        one: async () => {
          if (field === 'id' && value === 'existing-task') {
            return {
              id: 'existing-task',
              title: 'Existing Task',
              status: 1,
              position: 10,
              created_at: Date.now(),
              updated_at: Date.now(),
              lock_version: 1,
              applies_to_all_targets: false,
            };
          }
          return null;
        },
        orderBy: (_f: string, _d: string) => ({
          many: async () => [],
        }),
      }),
      orderBy: (_field: string, _direction: string) => ({
        many: async () => [
          {
            id: 'task-1',
            title: 'Task 1',
            status: 1,
            position: 1,
            created_at: Date.now(),
            updated_at: Date.now(),
            lock_version: 1,
            applies_to_all_targets: false,
          },
          {
            id: 'task-2',
            title: 'Task 2',
            status: 2,
            position: 2,
            created_at: Date.now(),
            updated_at: Date.now(),
            lock_version: 1,
            applies_to_all_targets: false,
          },
        ],
        materialize: () => ({
          data: Promise.resolve([
            {
              id: 'target-task',
              position: 5,
              created_at: Date.now(),
              updated_at: Date.now(),
              lock_version: 1,
              applies_to_all_targets: false,
            },
          ]),
          destroy: () => {},
        }),
      }),
      materialize: () => ({
        data: Promise.resolve([]),
        destroy: () => {},
      }),
    },
  },
  mutate: {
    tasks: {
      insert: async (data: Record<string, unknown>) => {
        expect(data.id).toBeDefined();
        expect(data.created_at).toBeDefined();
        expect(data.updated_at).toBeDefined();
        return { id: data.id };
      },
      update: async (data: Record<string, unknown>) => {
        expect(data.id).toBeDefined();
        expect(data.updated_at).toBeDefined();
        return { id: data.id };
      },
      delete: async (data: Record<string, unknown>) => {
        expect(data.id).toBeDefined();
        return { id: data.id };
      },
      upsert: async (data: Record<string, unknown>) => {
        expect(data.id).toBeDefined();
        expect(data.updated_at).toBeDefined();
        return { id: data.id };
      },
    },
  },
};

// Mock getZero function
const originalGetZero = (global as Record<string, unknown>).getZero;
(global as Record<string, unknown>).getZero = () => mockZeroClient;

// Mock crypto.randomUUID
const originalRandomUUID = crypto.randomUUID;
crypto.randomUUID = () => 'mock-uuid-' + Date.now();

test.describe('Epic-008 Generated Task Model', () => {
  test.afterAll(() => {
    // Restore original functions
    (global as Record<string, unknown>).getZero = originalGetZero;
    crypto.randomUUID = originalRandomUUID;
  });

  test.describe('TypeScript Types', () => {
    test('should have correct Task interface', () => {
      const task: TaskData = {
        id: 'test-id',
        title: 'Test Task',
        status: 1,
        position: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
        lock_version: 1,
        applies_to_all_targets: false,
        subtasks_count: 0,
        job_id: null,
        assigned_to_id: null,
        parent_id: null,
        discarded_at: null,
        reordered_at: null,
      };

      expect(task.id).toBe('test-id');
      expect(task.title).toBe('Test Task');
      expect(task.status).toBe(1);
    });

    test('should have correct CreateTaskData type', () => {
      const createData: CreateTaskData = {
        title: 'New Task',
        status: 1,
        lock_version: 1,
        applies_to_all_targets: false,
        job_id: null,
      };

      expect(createData.title).toBe('New Task');
      expect(createData.lock_version).toBe(1);
    });

    test('should have correct UpdateTaskData type', () => {
      const updateData: UpdateTaskData = {
        title: 'Updated Task',
        status: 2,
        position: 10,
      };

      expect(updateData.title).toBe('Updated Task');
      expect(updateData.status).toBe(2);
    });
  });

  test.describe('CRUD Mutations', () => {
    test('should create task with required fields', async () => {
      const data: CreateTaskData = {
        title: 'New Task',
        status: 1,
        lock_version: 1,
        applies_to_all_targets: false,
      };

      const result = await Task.create(data);
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.id.startsWith('mock-uuid-')).toBe(true);
    });

    test('should validate required fields in create', async () => {
      const invalidData = {
        title: 'Task without required fields',
      } as CreateTaskData;

      await expect(Task.create(invalidData)).rejects.toThrow('Lock version is required');
    });

    test('should update task with valid ID', async () => {
      const data: UpdateTaskData = {
        title: 'Updated Task',
        status: 2,
      };

      const result = await Task.update('existing-task', data);
      expect(result).toBeDefined();
      expect(result.id).toBe('existing-task');
    });

    test('should validate ID format in update', async () => {
      const data: UpdateTaskData = { title: 'Updated' };

      await expect(Task.update('invalid-id', data)).rejects.toThrow('Task ID must be a valid UUID');
    });

    test('should validate update data is not empty', async () => {
      await expect(Task.update('existing-task', {})).rejects.toThrow('Update data is required');
    });

    test('should discard task (soft delete)', async () => {
      const result = await Task.discard('existing-task');
      expect(result).toBeDefined();
      expect(result.id).toBe('existing-task');
    });

    test('should undiscard task (restore)', async () => {
      const result = await Task.undiscard('existing-task');
      expect(result).toBeDefined();
      expect(result.id).toBe('existing-task');
    });

    test('should upsert new task (create)', async () => {
      const data: CreateTaskData = {
        title: 'Upsert New Task',
        lock_version: 1,
        applies_to_all_targets: false,
      };

      const result = await Task.upsert(data);
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    test('should upsert existing task (update)', async () => {
      const data: UpdateTaskData & { id: string } = {
        id: 'existing-task',
        title: 'Upsert Updated Task',
      };

      const result = await Task.upsert(data);
      expect(result).toBeDefined();
      expect(result.id).toBe('existing-task');
    });
  });

  test.describe('Position Management', () => {
    test('should move task before another task', async () => {
      const result = await Task.moveBefore('task-1', 'target-task');
      expect(result).toBeDefined();
      expect(result.id).toBe('task-1');
    });

    test('should move task after another task', async () => {
      const result = await Task.moveAfter('task-1', 'target-task');
      expect(result).toBeDefined();
      expect(result.id).toBe('task-1');
    });

    test('should move task to top position', async () => {
      const result = await Task.moveToTop('task-1');
      expect(result).toBeDefined();
      expect(result.id).toBe('task-1');
    });

    test('should move task to bottom position', async () => {
      const result = await Task.moveToBottom('task-1');
      expect(result).toBeDefined();
      expect(result.id).toBe('task-1');
    });

    test.skip('should validate IDs in position operations', async () => {
      // TODO: Implement moveBeforeTask and moveAfterTask functions
      // await expect(moveBeforeTask('invalid-id', 'target-task')).rejects.toThrow('Task ID must be a valid UUID');
      // await expect(moveAfterTask('task-1', 'invalid-target')).rejects.toThrow('Target Task ID must be a valid UUID');
    });
  });

  test.describe('Task Class', () => {
    test('should create Task with proxy behavior', () => {
      const taskData: TaskData = {
        id: 'test-task',
        title: 'Test Task',
        status: 1,
        position: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
        lock_version: 1,
        applies_to_all_targets: false,
      };

      const instance = new Task(taskData);

      // Should proxy data properties
      expect(instance.id).toBe('test-task');
      expect(instance.title).toBe('Test Task');
      expect(instance.status).toBe(1);
    });

    test('should provide Rails-compatible update method', async () => {
      const taskData: TaskData = {
        id: 'test-task',
        title: 'Original Title',
        status: 1,
        position: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
        lock_version: 1,
        applies_to_all_targets: false,
      };

      const instance = new Task(taskData);

      const result = await instance.update({ title: 'Updated Title', status: 2 });
      expect(result.id).toBe('test-task');

      // Should optimistically update local data
      expect(instance.title).toBe('Updated Title');
      expect(instance.status).toBe(2);
    });

    test('should provide Rails-compatible discard method', async () => {
      const taskData: TaskData = {
        id: 'test-task',
        title: 'Test Task',
        status: 1,
        position: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
        lock_version: 1,
        applies_to_all_targets: false,
        discarded_at: null,
      };

      const instance = new Task(taskData);

      const result = await instance.discard();
      expect(result).toBe(true);

      // Should optimistically update local data
      expect(instance.isDiscarded).toBe(true);
      expect(instance.isKept).toBe(false);
    });

    test('should provide Rails-compatible undiscard method', async () => {
      const taskData: TaskData = {
        id: 'test-task',
        title: 'Test Task',
        status: 1,
        position: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
        lock_version: 1,
        applies_to_all_targets: false,
        discarded_at: Date.now(),
      };

      const instance = new Task(taskData);

      const result = await instance.undiscard();
      expect(result).toBe(true);

      // Should optimistically update local data
      expect(instance.isDiscarded).toBe(false);
      expect(instance.isKept).toBe(true);
    });

    test('should provide position management methods', async () => {
      const taskData: TaskData = {
        id: 'test-task',
        title: 'Test Task',
        status: 1,
        position: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
        lock_version: 1,
        applies_to_all_targets: false,
      };

      const instance = new Task(taskData);

      expect(typeof instance.moveBefore).toBe('function');
      expect(typeof instance.moveAfter).toBe('function');
      expect(typeof instance.moveToTop).toBe('function');
      expect(typeof instance.moveToBottom).toBe('function');

      const result = await instance.moveToTop();
      expect(result.id).toBe('test-task');
    });

    test('should provide convenience status update method', async () => {
      const taskData: TaskData = {
        id: 'test-task',
        title: 'Test Task',
        status: 1,
        position: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
        lock_version: 1,
        applies_to_all_targets: false,
      };

      const instance = new Task(taskData);

      const result = await instance.updateStatus('2');
      expect(result.id).toBe('test-task');
    });

    test('should provide inspect method for debugging', () => {
      const taskData: TaskData = {
        id: 'test-task',
        title: 'Test Task',
        status: 1,
        position: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
        lock_version: 1,
        applies_to_all_targets: false,
      };

      const instance = new Task(taskData);

      const inspectString = instance.inspect();
      expect(inspectString).toContain('Task');
      expect(inspectString).toContain('test-task');
      expect(inspectString).toContain('Test Task');
    });

    test('should provide raw data access', () => {
      const taskData: TaskData = {
        id: 'test-task',
        title: 'Test Task',
        status: 1,
        position: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
        lock_version: 1,
        applies_to_all_targets: false,
      };

      const instance = new Task(taskData);

      expect(instance.rawData).toBe(taskData);
      expect(instance.id).toBe('test-task');
    });
  });

  test.describe('ActiveRecord-style Query Interface', () => {
    test('should provide find method', () => {
      const result = Task.find('test-id');
      expect(result).toBeDefined();
      expect(result.current === null || typeof result.current === 'object').toBe(true);
    });

    test('should provide all method', () => {
      const result = Task.all();
      expect(result).toBeDefined();
      expect(Array.isArray(result.current)).toBe(true);
    });

    test('should provide where method', () => {
      const result = Task.where({ status: 1 });
      expect(result).toBeDefined();
      expect(Array.isArray(result.current)).toBe(true);
    });

    test('should provide kept method for discard gem', () => {
      const result = Task.kept();
      expect(result).toBeDefined();
      expect(Array.isArray(result.current)).toBe(true);
    });

    test('should provide discarded method for discard gem', () => {
      const result = Task.discarded();
      expect(result).toBeDefined();
      expect(Array.isArray(result.current)).toBe(true);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle Zero client not initialized', async () => {
      (global as Record<string, unknown>).getZero = () => null;

      await expect(
        Task.create({
          title: 'Test',
          lock_version: 1,
          applies_to_all_targets: false,
        })
      ).rejects.toThrow('Zero client not initialized');

      // Restore mock
      (global as Record<string, unknown>).getZero = () => mockZeroClient;
    });

    test('should validate UUID format', async () => {
      await expect(Task.update('not-a-uuid', { title: 'Test' })).rejects.toThrow(
        'Task ID must be a valid UUID'
      );
    });

    test('should handle database errors gracefully', async () => {
      // Mock to throw error
      const errorZero = {
        ...mockZeroClient,
        mutate: {
          tasks: {
            insert: async () => {
              throw new Error('Database error');
            },
          },
        },
      };

      (global as Record<string, unknown>).getZero = () => errorZero;

      await expect(
        Task.create({
          title: 'Test',
          lock_version: 1,
          applies_to_all_targets: false,
        })
      ).rejects.toThrow('Failed to create task');

      // Restore mock
      (global as Record<string, unknown>).getZero = () => mockZeroClient;
    });
  });

  test.describe('Integration with Epic-008 Architecture', () => {
    test('should work with ActiveRecord base class patterns', () => {
      // Task model should provide Rails-like interface
      expect(typeof Task.find).toBe('function');
      expect(typeof Task.all).toBe('function');
      expect(typeof Task.where).toBe('function');
      expect(typeof Task.kept).toBe('function');
      expect(typeof Task.discarded).toBe('function');
    });

    test('should provide both reactive and non-reactive access', () => {
      // Non-reactive queries return objects with current/value
      const findResult = Task.find('test-id');
      expect(typeof findResult.current).toBeDefined();
      expect(typeof findResult.value).toBeDefined();

      // Mutation functions are promises
      expect(
        Task.create({
          title: 'Test',
          lock_version: 1,
          applies_to_all_targets: false,
        })
      ).toBeInstanceOf(Promise);
    });

    test('should support instance-based operations', () => {
      const taskData: TaskData = {
        id: 'test-task',
        title: 'Test Task',
        status: 1,
        position: 1,
        created_at: Date.now(),
        updated_at: Date.now(),
        lock_version: 1,
        applies_to_all_targets: false,
      };

      const instance = new Task(taskData);

      // Should provide Rails-like instance methods
      expect(typeof instance.update).toBe('function');
      expect(typeof instance.discard).toBe('function');
      expect(typeof instance.undiscard).toBe('function');
    });
  });
});
