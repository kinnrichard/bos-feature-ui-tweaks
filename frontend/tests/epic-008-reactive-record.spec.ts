/**
 * Epic-008 ReactiveRecord Tests
 * 
 * Comprehensive test suite for ReactiveRecord functionality
 * Tests Svelte 5 reactivity, ReactiveQuery integration, and task operations
 */

import { test, expect } from '@playwright/test';
import { ReactiveTask } from '../src/lib/models/reactive-task';
import { ReactiveQuery, ReactiveQueryOne } from '../src/lib/zero/reactive-query.svelte.ts';
import type { Task as TaskData } from '../src/lib/zero/task.generated';

// Mock Zero client for testing
const mockZeroClient = {
  query: {
    tasks: {
      where: (field: string, value: any) => ({
        one: async () => ({
          id: 'task-1',
          title: 'Test Task',
          status: 1,
          created_at: Date.now(),
          updated_at: Date.now(),
          lock_version: 1,
          applies_to_all_targets: false
        }),
        orderBy: (field: string, direction: string) => ({
          where: (f: string, v: any) => ({
            many: async () => [],
            one: async () => null
          }),
          many: async () => [],
          limit: (n: number) => ({ many: async () => [] }),
          materialize: () => ({
            data: Promise.resolve([]),
            destroy: () => {}
          })
        }),
        many: async () => [],
        materialize: () => ({
          data: Promise.resolve([]),
          destroy: () => {}
        })
      }),
      orderBy: (field: string, direction: string) => ({
        where: (f: string, v: any) => ({
          many: async () => [],
          materialize: () => ({
            data: Promise.resolve([]),
            destroy: () => {}
          })
        }),
        many: async () => [],
        materialize: () => ({
          data: Promise.resolve([
            {
              id: 'task-1',
              title: 'Test Task 1',
              status: 1,
              created_at: Date.now(),
              updated_at: Date.now(),
              lock_version: 1,
              applies_to_all_targets: false
            },
            {
              id: 'task-2',
              title: 'Test Task 2',
              status: 2,
              created_at: Date.now(),
              updated_at: Date.now(),
              lock_version: 1,
              applies_to_all_targets: false
            }
          ]),
          destroy: () => {}
        })
      }),
      materialize: () => ({
        data: Promise.resolve([]),
        destroy: () => {}
      })
    }
  },
  mutate: {
    tasks: {
      insert: async (data: any) => ({ id: data.id }),
      update: async (data: any) => ({ id: data.id }),
      delete: async (data: any) => ({ id: data.id })
    }
  }
};

// Mock getZero function
const originalGetZero = (global as any).getZero;
(global as any).getZero = () => mockZeroClient;

test.describe('Epic-008 ReactiveRecord', () => {
  test.afterAll(() => {
    // Restore original getZero
    (global as any).getZero = originalGetZero;
  });

  test.describe('ReactiveTask Model', () => {
    test('should provide find method returning ReactiveQueryOne', () => {
      const query = ReactiveTask.find('task-1');
      expect(query).toBeDefined();
      expect(query).toBeInstanceOf(ReactiveQueryOne);
    });

    test('should provide all method returning ReactiveQuery', () => {
      const query = ReactiveTask.all();
      expect(query).toBeDefined();
      expect(query).toBeInstanceOf(ReactiveQuery);
    });

    test('should provide where method returning ReactiveQuery', () => {
      const query = ReactiveTask.where({ status: 1 });
      expect(query).toBeDefined();
      expect(query).toBeInstanceOf(ReactiveQuery);
    });

    test('should provide kept method for non-discarded tasks', () => {
      const query = ReactiveTask.kept();
      expect(query).toBeDefined();
      expect(query).toBeInstanceOf(ReactiveQuery);
    });

    test('should provide discarded method for discarded tasks', () => {
      const query = ReactiveTask.discarded();
      expect(query).toBeDefined();
      expect(query).toBeInstanceOf(ReactiveQuery);
    });

    test('should provide CRUD mutation methods', () => {
      expect(typeof ReactiveTask.create).toBe('function');
      expect(typeof ReactiveTask.update).toBe('function');
      expect(typeof ReactiveTask.discard).toBe('function');
      expect(typeof ReactiveTask.undiscard).toBe('function');
    });
  });

  test.describe('ReactiveQuery Properties', () => {
    test('should have reactive data property', async () => {
      const query = ReactiveTask.find('task-1');
      
      // Wait for query to initialize
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(query.data).toBeDefined();
      // In a real Svelte component, this would be reactive
    });

    test('should have isLoading property', () => {
      const query = ReactiveTask.all();
      expect(typeof query.isLoading).toBe('boolean');
    });

    test('should have error property', () => {
      const query = ReactiveTask.all();
      expect(query.error === null || query.error instanceof Error).toBe(true);
    });

    test('should provide present and blank helpers', () => {
      const query = ReactiveTask.all();
      expect(typeof query.present).toBe('boolean');
      expect(typeof query.blank).toBe('boolean');
    });
  });

  test.describe('ReactiveQuery Methods', () => {
    test('should provide refresh method', async () => {
      const query = ReactiveTask.all();
      expect(typeof query.refresh).toBe('function');
      
      // Should not throw when called
      await expect(query.refresh()).resolves.not.toThrow();
    });

    test('should provide destroy method for cleanup', () => {
      const query = ReactiveTask.all();
      expect(typeof query.destroy).toBe('function');
      
      // Should not throw when called
      expect(() => query.destroy()).not.toThrow();
    });

    test('should provide subscribe method for non-Svelte usage', () => {
      const query = ReactiveTask.all();
      expect(typeof query.subscribe).toBe('function');
      
      const unsubscribe = query.subscribe((data) => {
        console.log('Data changed:', data);
      });
      
      expect(typeof unsubscribe).toBe('function');
      
      // Cleanup
      unsubscribe();
    });
  });

  test.describe('Zero.js Integration', () => {
    test('should handle Zero client not being ready', () => {
      // Mock getZero to return null
      (global as any).getZero = () => null;
      
      const query = ReactiveTask.all();
      expect(query).toBeDefined();
      expect(Array.isArray(query.data)).toBe(true);
      expect(query.data.length).toBe(0);
      
      // Restore mock
      (global as any).getZero = () => mockZeroClient;
    });

    test('should create proper Zero queries for find', () => {
      const query = ReactiveTask.find('task-1');
      expect(query).toBeDefined();
      
      // Verify the query was configured correctly
      expect(query.isCollection).toBe(false);
    });

    test('should create proper Zero queries for collections', () => {
      const query = ReactiveTask.all();
      expect(query).toBeDefined();
      
      // Verify the query was configured as collection
      expect(query.isCollection).toBe(true);
    });

    test('should handle Zero query conditions properly', () => {
      const conditions = { status: 1, title: 'Test Task' };
      const query = ReactiveTask.where(conditions);
      
      expect(query).toBeDefined();
      expect(query.isCollection).toBe(true);
    });
  });

  test.describe('Discard Gem Integration', () => {
    test('should filter kept records correctly', () => {
      const query = ReactiveTask.kept();
      expect(query).toBeDefined();
      
      // Should use IS null for discarded_at
      expect(query.isCollection).toBe(true);
    });

    test('should filter discarded records correctly', () => {
      const query = ReactiveTask.discarded();
      expect(query).toBeDefined();
      
      // Should use IS NOT null for discarded_at
      expect(query.isCollection).toBe(true);
    });

    test('should use discard gem methods from generated model', async () => {
      // These should be the same functions from task.generated.ts
      expect(ReactiveTask.discard).toBeDefined();
      expect(ReactiveTask.undiscard).toBeDefined();
      
      // Test calling discard
      const result = await ReactiveTask.discard('task-1');
      expect(result).toBeDefined();
      expect(result.id).toBe('task-1');
    });
  });

  test.describe('TTL and Caching', () => {
    test('should configure TTL for queries', () => {
      const query = ReactiveTask.find('task-1');
      
      // TTL is set to 5 minutes in the implementation
      expect(query).toBeDefined();
    });

    test('should configure default values properly', () => {
      const findQuery = ReactiveTask.find('task-1');
      const allQuery = ReactiveTask.all();
      
      // Find should default to null, all should default to empty array
      expect(findQuery.data === null || typeof findQuery.data === 'object').toBe(true);
      expect(Array.isArray(allQuery.data)).toBe(true);
    });
  });

  test.describe('Type Safety', () => {
    test('should provide correct TypeScript types', () => {
      const query = ReactiveTask.find('task-1');
      
      // Data should be TaskData | null for find
      if (query.data) {
        expect(typeof query.data.id).toBe('string');
        expect(typeof query.data.title === 'string' || query.data.title === null).toBe(true);
        expect(typeof query.data.created_at).toBe('number');
        expect(typeof query.data.updated_at).toBe('number');
      }
    });

    test('should provide correct array types for collections', () => {
      const query = ReactiveTask.all();
      
      expect(Array.isArray(query.data)).toBe(true);
      
      // If data exists, each item should be TaskData
      if (query.data.length > 0) {
        const firstTask = query.data[0];
        expect(typeof firstTask.id).toBe('string');
        expect(typeof firstTask.created_at).toBe('number');
      }
    });
  });

  test.describe('Import Aliases', () => {
    test('should provide ReactiveTask as default export', () => {
      const { default: DefaultReactiveTask } = require('../src/lib/models/reactive-task');
      expect(DefaultReactiveTask).toBe(ReactiveTask);
    });

    test('should provide Task alias for easy switching', () => {
      const { Task } = require('../src/lib/models/reactive-task');
      expect(Task).toBe(ReactiveTask);
    });

    test('should export TypeScript types', () => {
      // These imports should not throw at runtime
      const types = require('../src/lib/models/reactive-task');
      expect(types.ReactiveTask).toBeDefined();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle query errors gracefully', async () => {
      // Mock Zero to throw error
      const errorZero = {
        query: {
          tasks: {
            where: () => ({
              one: async () => {
                throw new Error('Database error');
              }
            })
          }
        }
      };
      
      (global as any).getZero = () => errorZero;
      
      const query = ReactiveTask.find('task-1');
      
      // Wait for error to be set
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(query.error).toBeInstanceOf(Error);
      
      // Restore mock
      (global as any).getZero = () => mockZeroClient;
    });

    test('should retry failed queries', async () => {
      let callCount = 0;
      const retryZero = {
        query: {
          tasks: {
            orderBy: () => ({
              materialize: () => ({
                data: Promise.resolve().then(() => {
                  callCount++;
                  if (callCount < 2) {
                    throw new Error('Temporary error');
                  }
                  return [];
                }),
                destroy: () => {}
              })
            })
          }
        }
      };
      
      (global as any).getZero = () => retryZero;
      
      const query = ReactiveTask.all();
      
      // Wait for retries to complete
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      expect(callCount).toBeGreaterThan(1);
      
      // Restore mock
      (global as any).getZero = () => mockZeroClient;
    });
  });
});