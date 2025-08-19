/**
 * Unit tests for ReactiveRecord v2 Factory Functions
 *
 * Tests the factory pattern implementation for creating enhanced ReactiveRecord
 * instances with coordinator integration and backward compatibility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ReactiveRecordFactory,
  EnhancedReactiveRecord,
  EnhancedReactiveScopedQuery,
  createEnhancedReactiveRecord,
  upgradeReactiveRecord,
  FactoryDevUtils,
} from '../../src/lib/reactive/factory';

// Mock the integration module
vi.mock('../../src/lib/reactive/integration', () => ({
  ReactiveQueryFactory: {
    create: vi.fn((query, config) => ({
      ...query,
      coordinator: { visualState: { state: 'ready' } },
      getVisualState: () => ({ state: 'ready' }),
      config,
    })),
    createForNavigation: vi.fn((query) => ({
      ...query,
      coordinator: { visualState: { state: 'ready' } },
      navigationOptimized: true,
    })),
    createForInitialLoad: vi.fn((query) => ({
      ...query,
      coordinator: { visualState: { state: 'ready' } },
      initialLoadOptimized: true,
    })),
  },
  withCoordinator: vi.fn(),
}));

// Mock base ReactiveRecord
class MockReactiveRecord {
  constructor(public config: any) {}

  find(id: string, options?: any) {
    return { data: `record-${id}`, isLoading: false, error: null };
  }

  findBy(conditions: any, options?: any) {
    return { data: conditions, isLoading: false, error: null };
  }

  all() {
    return new MockScopedQuery();
  }

  where(conditions: any) {
    return new MockScopedQuery(conditions);
  }

  kept() {
    return new MockScopedQuery({ discarded_at: null });
  }

  discarded() {
    return new MockScopedQuery({ discarded_at: { not: null } });
  }

  withDiscarded() {
    return new MockScopedQuery();
  }

  includes(...relationships: string[]) {
    return new MockScopedQuery({ includes: relationships });
  }
}

class MockScopedQuery {
  constructor(private conditions: any = {}) {}

  includes(...relationships: string[]) {
    return new MockScopedQuery({ ...this.conditions, includes: relationships });
  }

  where(conditions: any) {
    return new MockScopedQuery({ ...this.conditions, ...conditions });
  }

  orderBy(field: string, direction = 'asc') {
    return new MockScopedQuery({ ...this.conditions, orderBy: { field, direction } });
  }

  limit(count: number) {
    return new MockScopedQuery({ ...this.conditions, limit: count });
  }

  offset(count: number) {
    return new MockScopedQuery({ ...this.conditions, offset: count });
  }

  withDiscarded() {
    return new MockScopedQuery({ ...this.conditions, withDiscarded: true });
  }

  discarded() {
    return new MockScopedQuery({ ...this.conditions, onlyDiscarded: true });
  }

  kept() {
    return new MockScopedQuery({ ...this.conditions, onlyKept: true });
  }

  // Terminal methods
  all(options?: any) {
    return { data: [this.conditions], isLoading: false, error: null, options };
  }

  first(options?: any) {
    return { data: this.conditions, isLoading: false, error: null, options };
  }

  last(options?: any) {
    return { data: this.conditions, isLoading: false, error: null, options };
  }

  find(id: string, options?: any) {
    return { data: { ...this.conditions, id }, isLoading: false, error: null, options };
  }

  count(options?: any) {
    return { data: 1, isLoading: false, error: null, options };
  }

  exists(options?: any) {
    return { data: true, isLoading: false, error: null, options };
  }
}

describe('ReactiveRecordFactory', () => {
  const testConfig = {
    tableName: 'test_table',
    className: 'TestModel',
    primaryKey: 'id',
    supportsDiscard: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create()', () => {
    it('should create an enhanced ReactiveRecord instance', () => {
      const record = ReactiveRecordFactory.create(testConfig);

      expect(record).toBeInstanceOf(EnhancedReactiveRecord);
      expect(record.config).toEqual(testConfig);
    });

    it('should enhance all query methods with coordinator', () => {
      const record = ReactiveRecordFactory.create(testConfig);

      const findResult = record.find('123');
      const findByResult = record.findBy({ name: 'test' });

      expect(findResult).toHaveProperty('coordinator');
      expect(findByResult).toHaveProperty('coordinator');
    });

    it('should return enhanced scoped queries from chainable methods', () => {
      const record = ReactiveRecordFactory.create(testConfig);

      const scopedQuery = record.where({ status: 'active' });
      expect(scopedQuery).toBeInstanceOf(EnhancedReactiveScopedQuery);

      const allQuery = scopedQuery.all();
      expect(allQuery).toHaveProperty('coordinator');
    });
  });

  describe('createForNavigation()', () => {
    it('should create navigation-optimized record', () => {
      const record = ReactiveRecordFactory.createForNavigation(testConfig);

      expect(record).toBeInstanceOf(EnhancedReactiveRecord);

      const query = record.find('123');
      expect(query).toHaveProperty('navigationOptimized', true);
    });

    it('should apply navigation settings to scoped queries', () => {
      const record = ReactiveRecordFactory.createForNavigation(testConfig);

      const scopedQuery = record.where({ status: 'active' });
      const terminalQuery = scopedQuery.first();

      expect(terminalQuery).toHaveProperty('navigationOptimized', true);
    });
  });

  describe('createForInitialLoad()', () => {
    it('should create initial-load-optimized record', () => {
      const record = ReactiveRecordFactory.createForInitialLoad(testConfig);

      expect(record).toBeInstanceOf(EnhancedReactiveRecord);

      const query = record.find('123');
      expect(query).toHaveProperty('initialLoadOptimized', true);
    });

    it('should apply initial load settings to scoped queries', () => {
      const record = ReactiveRecordFactory.createForInitialLoad(testConfig);

      const scopedQuery = record.kept();
      const terminalQuery = scopedQuery.all();

      expect(terminalQuery).toHaveProperty('initialLoadOptimized', true);
    });
  });

  describe('migrate()', () => {
    it('should migrate existing ReactiveRecord instance', () => {
      const existingRecord = new MockReactiveRecord(testConfig);
      const migratedRecord = ReactiveRecordFactory.migrate(existingRecord);

      expect(migratedRecord).toBeInstanceOf(EnhancedReactiveRecord);
    });

    it('should handle records without config', () => {
      const existingRecord = new MockReactiveRecord(null);
      const migratedRecord = ReactiveRecordFactory.migrate(existingRecord);

      expect(migratedRecord).toBeInstanceOf(EnhancedReactiveRecord);
    });
  });
});

describe('EnhancedReactiveRecord', () => {
  let record: EnhancedReactiveRecord<any>;

  beforeEach(() => {
    record = new EnhancedReactiveRecord({
      tableName: 'test_table',
      className: 'TestModel',
    });
  });

  it('should provide all standard ActiveRecord methods', () => {
    expect(typeof record.find).toBe('function');
    expect(typeof record.findBy).toBe('function');
    expect(typeof record.all).toBe('function');
    expect(typeof record.where).toBe('function');
    expect(typeof record.kept).toBe('function');
    expect(typeof record.discarded).toBe('function');
    expect(typeof record.withDiscarded).toBe('function');
    expect(typeof record.includes).toBe('function');
  });

  it('should return enhanced queries from find methods', () => {
    const findQuery = record.find('123');
    const findByQuery = record.findBy({ name: 'test' });

    expect(findQuery).toHaveProperty('coordinator');
    expect(findByQuery).toHaveProperty('coordinator');
  });

  it('should return enhanced scoped queries from collection methods', () => {
    const allQuery = record.all();
    const whereQuery = record.where({ status: 'active' });
    const keptQuery = record.kept();

    expect(allQuery).toBeInstanceOf(EnhancedReactiveScopedQuery);
    expect(whereQuery).toBeInstanceOf(EnhancedReactiveScopedQuery);
    expect(keptQuery).toBeInstanceOf(EnhancedReactiveScopedQuery);
  });
});

describe('EnhancedReactiveScopedQuery', () => {
  let baseQuery: MockScopedQuery;
  let enhancedQuery: EnhancedReactiveScopedQuery<any>;

  beforeEach(() => {
    baseQuery = new MockScopedQuery();
    enhancedQuery = new EnhancedReactiveScopedQuery(baseQuery);
  });

  describe('chainable methods', () => {
    it('should return enhanced scoped queries for chaining', () => {
      const chained = enhancedQuery
        .where({ status: 'active' })
        .includes('user', 'comments')
        .orderBy('created_at', 'desc')
        .limit(10);

      expect(chained).toBeInstanceOf(EnhancedReactiveScopedQuery);
    });

    it('should support all scoping methods', () => {
      expect(typeof enhancedQuery.includes).toBe('function');
      expect(typeof enhancedQuery.where).toBe('function');
      expect(typeof enhancedQuery.orderBy).toBe('function');
      expect(typeof enhancedQuery.limit).toBe('function');
      expect(typeof enhancedQuery.offset).toBe('function');
      expect(typeof enhancedQuery.withDiscarded).toBe('function');
      expect(typeof enhancedQuery.discarded).toBe('function');
      expect(typeof enhancedQuery.kept).toBe('function');
    });
  });

  describe('terminal methods', () => {
    it('should return enhanced queries from terminal methods', () => {
      const allQuery = enhancedQuery.all();
      const firstQuery = enhancedQuery.first();
      const countQuery = enhancedQuery.count();

      expect(allQuery).toHaveProperty('coordinator');
      expect(firstQuery).toHaveProperty('coordinator');
      expect(countQuery).toHaveProperty('coordinator');
    });

    it('should support all terminal methods', () => {
      expect(typeof enhancedQuery.all).toBe('function');
      expect(typeof enhancedQuery.first).toBe('function');
      expect(typeof enhancedQuery.last).toBe('function');
      expect(typeof enhancedQuery.find).toBe('function');
      expect(typeof enhancedQuery.count).toBe('function');
      expect(typeof enhancedQuery.exists).toBe('function');
    });

    it('should pass options to terminal methods', () => {
      const options = { debug: true, ttl: '30m' };
      const query = enhancedQuery.all(options);

      expect(query.options).toEqual(options);
    });
  });
});

describe('FactoryDevUtils', () => {
  const testConfig = {
    tableName: 'debug_table',
    className: 'DebugModel',
  };

  describe('createDebugRecord()', () => {
    it('should create record with debug configuration', () => {
      const debugRecord = FactoryDevUtils.createDebugRecord(testConfig);

      expect(debugRecord).toBeInstanceOf(EnhancedReactiveRecord);
      expect(debugRecord.config.defaultTtl).toBe('1h');
    });

    it('should log creation message', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      FactoryDevUtils.createDebugRecord(testConfig);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ReactiveRecord v2]',
        'Debug ReactiveRecord created',
        expect.objectContaining({
          tableName: testConfig.tableName,
          className: testConfig.className,
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('monitorRecord()', () => {
    it('should wrap record with monitoring proxy', () => {
      const record = ReactiveRecordFactory.create(testConfig);
      const monitoredRecord = FactoryDevUtils.monitorRecord(record);

      expect(monitoredRecord).toBeDefined();
      expect(typeof monitoredRecord.find).toBe('function');
    });

    it('should log method calls', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const record = ReactiveRecordFactory.create(testConfig);
      const monitoredRecord = FactoryDevUtils.monitorRecord(record);

      monitoredRecord.find('123');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ReactiveRecord v2]',
        'ReactiveRecord method called: find',
        expect.objectContaining({ args: ['123'] })
      );

      consoleSpy.mockRestore();
    });
  });
});

describe('Factory backward compatibility', () => {
  it('should maintain existing API surface', () => {
    const record = ReactiveRecordFactory.create({
      tableName: 'legacy_table',
      className: 'LegacyModel',
    });

    // Should support chaining just like original ReactiveRecord
    const query = record
      .kept()
      .where({ status: 'active' })
      .includes('user')
      .orderBy('created_at', 'desc')
      .limit(5)
      .all();

    expect(query).toHaveProperty('coordinator');
    expect(query.data).toEqual([expect.any(Object)]);
  });

  it('should preserve query options through the chain', () => {
    const record = ReactiveRecordFactory.create({
      tableName: 'options_table',
      className: 'OptionsModel',
    });

    const options = { debug: true, ttl: '2h' };
    const query = record.where({ active: true }).first(options);

    expect(query.options).toEqual(options);
  });
});
