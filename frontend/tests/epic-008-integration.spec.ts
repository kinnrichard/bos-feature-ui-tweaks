/**
 * Epic-008 Integration Tests
 *
 * End-to-end integration tests for the new ActiveRecord/ReactiveRecord architecture
 * Tests Zero.js client integration, Svelte 5 reactivity, and performance
 */

import { test, expect } from '@playwright/test';
import { ReactiveTask } from '../src/lib/models/reactive-task';
import { Task } from '../src/lib/models/task';

// Enhanced mock for integration testing
let mockDatabase: Record<string, unknown>[] = [];
let queryCallCount = 0;
let mutationCallCount = 0;

const integrationMockZero = {
  query: {
    tasks: {
      where: (field: string, value: unknown) => {
        queryCallCount++;
        return {
          one: async () => {
            const result = mockDatabase.find((item) => item[field] === value);
            return result || null;
          },
          orderBy: (orderField: string, direction: string) => ({
            where: (f: string, v: unknown) => ({
              many: async () => mockDatabase.filter((item) => item[f] === v),
              one: async () => mockDatabase.find((item) => item[f] === v) || null,
            }),
            many: async () =>
              [...mockDatabase].sort((a, b) => {
                if (direction === 'desc') {
                  return b[orderField] - a[orderField];
                }
                return a[orderField] - b[orderField];
              }),
            limit: (n: number) => ({
              many: async () => mockDatabase.slice(0, n),
            }),
            materialize: () => ({
              data: Promise.resolve([...mockDatabase]),
              destroy: () => {},
            }),
          }),
          many: async () => mockDatabase.filter((item) => item[field] === value),
          materialize: () => ({
            data: Promise.resolve(mockDatabase.filter((item) => item[field] === value)),
            destroy: () => {},
          }),
        };
      },
      orderBy: (field: string, direction: string) => ({
        where: (f: string, v: unknown) => ({
          many: async () =>
            mockDatabase.filter((item) => {
              if (f === 'discarded_at' && v === null) {
                return !item.discarded_at;
              }
              if (f === 'discarded_at' && v !== null) {
                return !!item.discarded_at;
              }
              return item[f] === v;
            }),
          materialize: () => ({
            data: Promise.resolve(mockDatabase.filter((item) => item[f] === v)),
            destroy: () => {},
          }),
        }),
        many: async () =>
          [...mockDatabase].sort((a, b) => {
            if (direction === 'desc') {
              return b[field] - a[field];
            }
            return a[field] - b[field];
          }),
        materialize: () => ({
          data: Promise.resolve(
            [...mockDatabase].sort((a, b) => {
              if (direction === 'desc') {
                return b[field] - a[field];
              }
              return a[field] - b[field];
            })
          ),
          destroy: () => {},
        }),
      }),
      materialize: () => ({
        data: Promise.resolve([...mockDatabase]),
        destroy: () => {},
      }),
    },
  },
  mutate: {
    tasks: {
      insert: async (data: Record<string, unknown>) => {
        mutationCallCount++;
        mockDatabase.push({ ...data });
        return { id: data.id };
      },
      update: async (data: Record<string, unknown>) => {
        mutationCallCount++;
        const index = mockDatabase.findIndex((item) => item.id === data.id);
        if (index >= 0) {
          mockDatabase[index] = { ...mockDatabase[index], ...data };
        }
        return { id: data.id };
      },
      delete: async (data: Record<string, unknown>) => {
        mutationCallCount++;
        mockDatabase = mockDatabase.filter((item) => item.id !== data.id);
        return { id: data.id };
      },
      upsert: async (data: Record<string, unknown>) => {
        mutationCallCount++;
        const index = mockDatabase.findIndex((item) => item.id === data.id);
        if (index >= 0) {
          mockDatabase[index] = { ...mockDatabase[index], ...data };
        } else {
          mockDatabase.push({ ...data });
        }
        return { id: data.id };
      },
    },
  },
};

// Mock getZero function
const originalGetZero = (global as Record<string, unknown>).getZero;
(global as Record<string, unknown>).getZero = () => integrationMockZero;

// Mock crypto.randomUUID
const originalRandomUUID = crypto.randomUUID;
let uuidCounter = 0;
crypto.randomUUID = () => `test-task-${++uuidCounter}`;

test.describe('Epic-008 Integration Tests', () => {
  test.beforeEach(() => {
    // Reset state for each test
    mockDatabase = [];
    queryCallCount = 0;
    mutationCallCount = 0;
    uuidCounter = 0;
  });

  test.afterAll(() => {
    // Restore original functions
    (global as Record<string, unknown>).getZero = originalGetZero;
    crypto.randomUUID = originalRandomUUID;
  });

  test.describe('End-to-End CRUD Operations', () => {
    test('should create, read, update, and delete tasks', async () => {
      // Create a task
      const createResult = await Task.create({
        title: 'Integration Test Task',
        status: 1,
        lock_version: 1,
        applies_to_all_targets: false,
      });

      expect(createResult.id).toBe('test-task-1');
      expect(mockDatabase.length).toBe(1);
      expect(mutationCallCount).toBe(1);

      // Read the task using ActiveRecord-style query
      const findResult = Task.find('test-task-1');
      await new Promise((resolve) => setTimeout(resolve, 150)); // Wait for query

      expect(findResult.current).toBeDefined();
      expect(findResult.current?.title).toBe('Integration Test Task');
      expect(queryCallCount).toBeGreaterThan(0);

      // Update the task
      const updateResult = await Task.update('test-task-1', {
        title: 'Updated Integration Task',
        status: 2,
      });

      expect(updateResult.id).toBe('test-task-1');
      expect(mockDatabase[0].title).toBe('Updated Integration Task');
      expect(mockDatabase[0].status).toBe(2);
      expect(mutationCallCount).toBe(2);

      // Soft delete (discard) the task
      const discardResult = await Task.discard('test-task-1');
      expect(discardResult.id).toBe('test-task-1');
      expect(mockDatabase[0].discarded_at).toBeDefined();
      expect(mutationCallCount).toBe(3);
    });

    test('should handle multiple tasks with filtering', async () => {
      // Create multiple tasks
      await Task.create({
        title: 'Active Task 1',
        status: 1,
        lock_version: 1,
        applies_to_all_targets: false,
      });

      await Task.create({
        title: 'Active Task 2',
        status: 1,
        lock_version: 1,
        applies_to_all_targets: false,
      });

      await Task.create({
        title: 'Completed Task',
        status: 3,
        lock_version: 1,
        applies_to_all_targets: false,
      });

      expect(mockDatabase.length).toBe(3);

      // Test where query
      const activeTasksResult = Task.where({ status: 1 });
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(Array.isArray(activeTasksResult.current)).toBe(true);
      expect(activeTasksResult.current.length).toBe(2);

      // Test all query
      const allTasksResult = Task.all();
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(allTasksResult.current.length).toBe(3);
    });
  });

  test.describe('Reactive vs Non-Reactive Comparison', () => {
    test('should provide same data through both interfaces', async () => {
      // Create test data
      await Task.create({
        title: 'Reactive Test Task',
        status: 1,
        lock_version: 1,
        applies_to_all_targets: false,
      });

      // Query through non-reactive interface
      const nonReactiveResult = Task.find('test-task-1');
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Query through reactive interface
      const reactiveResult = ReactiveTask.find('test-task-1');
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Both should return the same data
      expect(nonReactiveResult.current?.id).toBe('test-task-1');
      expect(reactiveResult.data?.id).toBe('test-task-1');
      expect(nonReactiveResult.current?.title).toBe(reactiveResult.data?.title);
    });

    test('should handle updates in both interfaces', async () => {
      // Create and update through non-reactive interface
      await Task.create({
        title: 'Original Title',
        status: 1,
        lock_version: 1,
        applies_to_all_targets: false,
      });

      await Task.update('test-task-1', { title: 'Updated Title' });

      // Verify through both interfaces
      const nonReactiveResult = Task.find('test-task-1');
      const reactiveResult = ReactiveTask.find('test-task-1');

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(nonReactiveResult.current?.title).toBe('Updated Title');
      expect(reactiveResult.data?.title).toBe('Updated Title');
    });
  });

  test.describe('Discard Gem Integration', () => {
    test('should properly filter kept and discarded records', async () => {
      // Create some tasks
      await Task.create({
        title: 'Kept Task 1',
        status: 1,
        lock_version: 1,
        applies_to_all_targets: false,
      });

      await Task.create({
        title: 'Kept Task 2',
        status: 1,
        lock_version: 1,
        applies_to_all_targets: false,
      });

      await Task.create({
        title: 'To Be Discarded',
        status: 1,
        lock_version: 1,
        applies_to_all_targets: false,
      });

      // Discard one task
      await Task.discard('test-task-3');

      // Test kept() scope
      const keptTasks = Task.kept();
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(keptTasks.current.length).toBe(2);
      expect(keptTasks.current.every((task) => !task.discarded_at)).toBe(true);

      // Test discarded() scope
      const discardedTasks = Task.discarded();
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(discardedTasks.current.length).toBe(1);
      expect(discardedTasks.current[0].title).toBe('To Be Discarded');

      // Test reactive interface for kept tasks
      const reactiveKept = ReactiveTask.kept();
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(reactiveKept.data.length).toBe(2);
    });

    test('should handle undiscard operations', async () => {
      // Create and discard a task
      await Task.create({
        title: 'Discard Test Task',
        status: 1,
        lock_version: 1,
        applies_to_all_targets: false,
      });

      await Task.discard('test-task-1');

      // Verify it's in discarded scope
      const discardedTasks = Task.discarded();
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(discardedTasks.current.length).toBe(1);

      // Undiscard the task
      await Task.undiscard('test-task-1');

      // Verify it's back in kept scope
      const keptTasks = Task.kept();
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(keptTasks.current.length).toBe(1);
      expect(keptTasks.current[0].discarded_at).toBeNull();
    });
  });

  test.describe('Performance Comparison', () => {
    test('should track query and mutation performance', async () => {
      const startTime = Date.now();

      // Create multiple tasks
      for (let i = 0; i < 10; i++) {
        await Task.create({
          title: `Performance Task ${i}`,
          status: 1,
          lock_version: 1,
          applies_to_all_targets: false,
        });
      }

      const createTime = Date.now() - startTime;

      // Query all tasks
      const queryStartTime = Date.now();
      const allTasks = Task.all();
      await new Promise((resolve) => setTimeout(resolve, 150));
      const queryTime = Date.now() - queryStartTime;

      // Performance assertions
      expect(createTime).toBeLessThan(1000); // Should create 10 tasks in under 1 second
      expect(queryTime).toBeLessThan(500); // Should query in under 500ms
      expect(mutationCallCount).toBe(10);
      expect(queryCallCount).toBeGreaterThan(0);
      expect(allTasks.current.length).toBe(10);
    });

    test('should handle concurrent operations efficiently', async () => {
      // Create tasks concurrently
      const createPromises = Array.from({ length: 5 }, (_, i) =>
        Task.create({
          title: `Concurrent Task ${i}`,
          status: 1,
          lock_version: 1,
          applies_to_all_targets: false,
        })
      );

      const results = await Promise.all(createPromises);

      expect(results.length).toBe(5);
      expect(mockDatabase.length).toBe(5);
      expect(mutationCallCount).toBe(5);

      // Query concurrently
      const queryPromises = results.map((result) => {
        const query = Task.find(result.id);
        return new Promise((resolve) => {
          setTimeout(() => resolve(query.current), 150);
        });
      });

      const queryResults = await Promise.all(queryPromises);
      expect(queryResults.filter((result) => result !== null).length).toBe(5);
    });
  });

  test.describe('Type Safety Integration', () => {
    test('should maintain type safety across interfaces', async () => {
      // Create task with proper typing
      const createData = {
        title: 'Type Safety Test',
        status: 1 as const,
        lock_version: 1,
        applies_to_all_targets: false,
      };

      const result = await Task.create(createData);
      expect(typeof result.id).toBe('string');

      // Query with type safety
      const findResult = Task.find(result.id);
      await new Promise((resolve) => setTimeout(resolve, 150));

      if (findResult.current) {
        expect(typeof findResult.current.id).toBe('string');
        expect(typeof findResult.current.title).toBe('string');
        expect(typeof findResult.current.status).toBe('number');
        expect(typeof findResult.current.created_at).toBe('number');
        expect(typeof findResult.current.updated_at).toBe('number');
      }

      // Reactive query with type safety
      const reactiveResult = ReactiveTask.find(result.id);
      await new Promise((resolve) => setTimeout(resolve, 150));

      if (reactiveResult.data) {
        expect(typeof reactiveResult.data.id).toBe('string');
        expect(typeof reactiveResult.data.title).toBe('string');
        expect(typeof reactiveResult.data.status).toBe('number');
      }
    });
  });

  test.describe('Error Handling Integration', () => {
    test('should handle database errors across all interfaces', async () => {
      // Mock database error
      const originalInsert = integrationMockZero.mutate.tasks.insert;
      integrationMockZero.mutate.tasks.insert = async () => {
        throw new Error('Database connection error');
      };

      // Test error handling in create
      await expect(
        Task.create({
          title: 'Error Test',
          lock_version: 1,
          applies_to_all_targets: false,
        })
      ).rejects.toThrow('Failed to create task');

      // Restore original function
      integrationMockZero.mutate.tasks.insert = originalInsert;
    });

    test('should handle query errors gracefully', async () => {
      // Mock query error
      const originalWhere = integrationMockZero.query.tasks.where;
      integrationMockZero.query.tasks.where = () => ({
        one: async () => {
          throw new Error('Query error');
        },
      });

      // Test error handling in reactive query
      const reactiveResult = ReactiveTask.find('error-test');
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(reactiveResult.error).toBeInstanceOf(Error);

      // Restore original function
      integrationMockZero.query.tasks.where = originalWhere;
    });
  });

  test.describe('Migration Compatibility', () => {
    test('should work with existing data patterns', async () => {
      // Simulate existing data in old format
      mockDatabase.push({
        id: 'legacy-task-1',
        title: 'Legacy Task',
        status: 1,
        created_at: Date.now() - 86400000, // 1 day ago
        updated_at: Date.now() - 3600000, // 1 hour ago
        lock_version: 1,
        applies_to_all_targets: false,
      });

      // Should be able to query legacy data
      const legacyResult = Task.find('legacy-task-1');
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(legacyResult.current).toBeDefined();
      expect(legacyResult.current?.title).toBe('Legacy Task');

      // Should be able to update legacy data
      await Task.update('legacy-task-1', { title: 'Updated Legacy Task' });

      const updatedResult = Task.find('legacy-task-1');
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(updatedResult.current?.title).toBe('Updated Legacy Task');
    });
  });
});
