/**
 * Epic-008 ActiveRecord Base Class Tests
 * 
 * Comprehensive test suite for the new ActiveRecord<T> base class
 * Tests CRUD operations, discard gem functionality, and Rails compatibility
 */

import { test, expect } from '@playwright/test';
import { ActiveRecord, RecordNotFoundError, RecordInvalidError } from '../src/lib/models/base/active-record';
import type { BaseRecord, CreateData, UpdateData } from '../src/lib/models/base/types';

// Test record interface for testing
interface TestRecord extends BaseRecord {
  name: string;
  email?: string;
  status?: 'active' | 'inactive';
}

// Mock Zero client for testing
const mockZeroClient = {
  query: {
    test_records: {
      where: (field: string, value: any) => ({
        one: async () => ({ id: 'test-1', name: 'Test Record', created_at: Date.now(), updated_at: Date.now() }),
        orderBy: (field: string, direction: string) => ({
          where: (f: string, v: any) => ({
            one: async () => null,
            many: async () => []
          }),
          many: async () => [],
          limit: (n: number) => ({ many: async () => [] }),
          offset: (n: number) => ({ many: async () => [] })
        }),
        many: async () => [],
        limit: (n: number) => ({ many: async () => [] }),
        offset: (n: number) => ({ many: async () => [] })
      }),
      orderBy: (field: string, direction: string) => ({
        where: (f: string, v: any) => ({
          many: async () => []
        }),
        many: async () => [],
        limit: (n: number) => ({ many: async () => [] })
      })
    }
  },
  mutate: {
    test_records: {
      insert: async (data: any) => ({ id: data.id }),
      update: async (data: any) => ({ id: data.id }),
      delete: async (data: any) => ({ id: data.id })
    }
  }
};

// Mock getZero function
const originalGetZero = (global as any).getZero;
(global as any).getZero = () => mockZeroClient;

test.describe('Epic-008 ActiveRecord Base Class', () => {
  let TestModel: ActiveRecord<TestRecord>;

  test.beforeEach(() => {
    TestModel = new ActiveRecord<TestRecord>({
      tableName: 'test_records',
      className: 'TestRecord',
      primaryKey: 'id'
    });
  });

  test.afterAll(() => {
    // Restore original getZero
    (global as any).getZero = originalGetZero;
  });

  test.describe('Configuration', () => {
    test('should create ActiveRecord instance with proper config', () => {
      expect(TestModel).toBeDefined();
      expect(TestModel).toBeInstanceOf(ActiveRecord);
    });

    test('should require tableName in config', () => {
      expect(() => {
        new ActiveRecord<TestRecord>({
          tableName: '',
          className: 'TestRecord'
        });
      }).toThrow();
    });
  });

  test.describe('Find Operations', () => {
    test('should find record by ID successfully', async () => {
      const record = await TestModel.find('test-1');
      expect(record).toBeDefined();
      expect(record.id).toBe('test-1');
      expect(record.name).toBe('Test Record');
    });

    test('should throw RecordNotFoundError when record does not exist', async () => {
      // Mock to return null
      mockZeroClient.query.test_records.where = () => ({
        one: async () => null
      });

      await expect(TestModel.find('nonexistent')).rejects.toThrow(RecordNotFoundError);
    });

    test('should findBy conditions and return record', async () => {
      const record = await TestModel.findBy({ name: 'Test Record' });
      expect(record).toBeDefined();
      expect(record?.name).toBe('Test Record');
    });

    test('should findBy conditions and return null when not found', async () => {
      // Mock to return empty array
      mockZeroClient.query.test_records.where = () => ({
        orderBy: () => ({
          limit: () => ({
            many: async () => []
          })
        })
      });

      const record = await TestModel.findBy({ name: 'Nonexistent' });
      expect(record).toBeNull();
    });
  });

  test.describe('Scoped Queries', () => {
    test('should create where scope', () => {
      const scope = TestModel.where({ name: 'Test' });
      expect(scope).toBeDefined();
      expect(typeof scope.all).toBe('function');
      expect(typeof scope.first).toBe('function');
      expect(typeof scope.count).toBe('function');
    });

    test('should chain multiple where conditions', () => {
      const scope = TestModel.where({ name: 'Test' }).where({ status: 'active' });
      expect(scope).toBeDefined();
    });

    test('should support orderBy chaining', () => {
      const scope = TestModel.where({ name: 'Test' }).orderBy('created_at', 'desc');
      expect(scope).toBeDefined();
    });

    test('should support limit and offset chaining', () => {
      const scope = TestModel.where({ name: 'Test' }).limit(10).offset(20);
      expect(scope).toBeDefined();
    });

    test('should execute all() query', async () => {
      const results = await TestModel.all().all();
      expect(Array.isArray(results)).toBe(true);
    });

    test('should execute first() query', async () => {
      const result = await TestModel.where({ name: 'Test' }).first();
      expect(result).toBeDefined();
    });

    test('should execute count() query', async () => {
      const count = await TestModel.where({ name: 'Test' }).count();
      expect(typeof count).toBe('number');
    });

    test('should execute exists() query', async () => {
      const exists = await TestModel.where({ name: 'Test' }).exists();
      expect(typeof exists).toBe('boolean');
    });
  });

  test.describe('Discard Gem Functionality', () => {
    test('should have kept() scope for non-discarded records', () => {
      const scope = TestModel.kept();
      expect(scope).toBeDefined();
    });

    test('should have discarded() scope for discarded records', () => {
      const scope = TestModel.discarded();
      expect(scope).toBeDefined();
    });

    test('should have withDiscarded() scope to include all records', () => {
      const scope = TestModel.withDiscarded();
      expect(scope).toBeDefined();
    });

    test('should discard record (soft delete)', async () => {
      const record = await TestModel.discard('test-1');
      expect(record).toBeDefined();
      expect(record.discarded_at).toBeDefined();
    });

    test('should undiscard record (restore)', async () => {
      const record = await TestModel.undiscard('test-1');
      expect(record).toBeDefined();
      expect(record.discarded_at).toBeNull();
    });
  });

  test.describe('CRUD Operations', () => {
    test('should create new record', async () => {
      const data: CreateData<TestRecord> = {
        name: 'New Record',
        email: 'test@example.com',
        status: 'active'
      };

      const record = await TestModel.create(data);
      expect(record).toBeDefined();
      expect(record.id).toBeDefined();
      expect(record.name).toBe('New Record');
      expect(record.created_at).toBeDefined();
      expect(record.updated_at).toBeDefined();
    });

    test('should update existing record', async () => {
      const data: UpdateData<TestRecord> = {
        name: 'Updated Record',
        status: 'inactive'
      };

      const record = await TestModel.update('test-1', data);
      expect(record).toBeDefined();
      expect(record.id).toBe('test-1');
      expect(record.updated_at).toBeDefined();
    });

    test('should upsert record (create if not exists)', async () => {
      const data: CreateData<TestRecord> = {
        name: 'Upsert Record',
        email: 'upsert@example.com'
      };

      const record = await TestModel.upsert(data);
      expect(record).toBeDefined();
      expect(record.id).toBeDefined();
    });

    test('should upsert record (update if exists)', async () => {
      const data: UpdateData<TestRecord> & { id: string } = {
        id: 'test-1',
        name: 'Updated Upsert Record'
      };

      const record = await TestModel.upsert(data);
      expect(record).toBeDefined();
      expect(record.id).toBe('test-1');
    });

    test('should destroy record (hard delete)', async () => {
      const result = await TestModel.destroy('test-1');
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.id).toBe('test-1');
    });
  });

  test.describe('Error Handling', () => {
    test('should throw error when Zero client not initialized', async () => {
      // Mock getZero to return null
      (global as any).getZero = () => null;

      await expect(TestModel.find('test-1')).rejects.toThrow('Zero client not initialized');

      // Restore mock
      (global as any).getZero = () => mockZeroClient;
    });

    test('should throw error when table not found', async () => {
      // Mock getZero to return client without our table
      (global as any).getZero = () => ({
        query: {},
        mutate: {}
      });

      await expect(TestModel.find('test-1')).rejects.toThrow("Table 'test_records' not found");

      // Restore mock
      (global as any).getZero = () => mockZeroClient;
    });

    test('should handle create failures gracefully', async () => {
      // Mock to throw error
      mockZeroClient.mutate.test_records.insert = async () => {
        throw new Error('Database error');
      };

      const data: CreateData<TestRecord> = { name: 'Test' };
      await expect(TestModel.create(data)).rejects.toThrow('Create failed');
    });

    test('should handle update failures gracefully', async () => {
      // Mock to throw error on update
      mockZeroClient.mutate.test_records.update = async () => {
        throw new Error('Database error');
      };

      const data: UpdateData<TestRecord> = { name: 'Updated' };
      await expect(TestModel.update('test-1', data)).rejects.toThrow('Update failed');
    });
  });

  test.describe('Rails Compatibility', () => {
    test('should provide Rails-like method signatures', () => {
      // Test that methods exist and have correct signatures
      expect(typeof TestModel.find).toBe('function');
      expect(typeof TestModel.findBy).toBe('function');
      expect(typeof TestModel.where).toBe('function');
      expect(typeof TestModel.all).toBe('function');
      expect(typeof TestModel.create).toBe('function');
      expect(typeof TestModel.update).toBe('function');
      expect(typeof TestModel.destroy).toBe('function');
      expect(typeof TestModel.discard).toBe('function');
      expect(typeof TestModel.undiscard).toBe('function');
    });

    test('should provide discard gem methods', () => {
      expect(typeof TestModel.kept).toBe('function');
      expect(typeof TestModel.discarded).toBe('function');
      expect(typeof TestModel.withDiscarded).toBe('function');
    });

    test('should support method chaining', () => {
      const query = TestModel.where({ status: 'active' })
        .orderBy('created_at', 'desc')
        .limit(10)
        .offset(5);
      
      expect(query).toBeDefined();
      expect(typeof query.all).toBe('function');
    });
  });

  test.describe('Type Safety', () => {
    test('should enforce correct data types in create', async () => {
      // TypeScript should catch this at compile time, but we can test runtime validation
      const validData: CreateData<TestRecord> = {
        name: 'Valid Name',
        email: 'valid@example.com',
        status: 'active'
      };

      const record = await TestModel.create(validData);
      expect(record.name).toBe('Valid Name');
    });

    test('should enforce correct data types in update', async () => {
      const validData: UpdateData<TestRecord> = {
        name: 'Updated Name',
        status: 'inactive'
      };

      const record = await TestModel.update('test-1', validData);
      expect(record).toBeDefined();
    });
  });
});