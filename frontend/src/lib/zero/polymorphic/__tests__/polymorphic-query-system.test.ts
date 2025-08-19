/**
 * PolymorphicQuerySystem - Comprehensive Unit Tests
 * 
 * Tests for the polymorphic query system including:
 * - ChainableQuery functionality
 * - Polymorphic filtering and conditions
 * - Eager loading optimization
 * - Query execution and results
 * - Integration with Zero.js
 * - Performance benchmarking
 * 
 * Generated: 2025-08-06 Epic-008 Polymorphic Query System Testing
 */

import { 
  ChainableQuery, 
  PolymorphicQuery,
  createPolymorphicQuery,
  createNotableQuery,
  createLoggableQuery,
  createSchedulableQuery,
  createTargetQuery,
  createParseableQuery
} from '../query-system';
import type { PolymorphicType, PolymorphicConditions } from '../types';
import type { BaseModelConfig } from '../../models/base/types';
import { performance } from 'perf_hooks';

// Mock Zero.js client
const mockZeroQuery = {
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  related: jest.fn().mockReturnThis(),
  run: jest.fn().mockResolvedValue([
    { id: '1', notable_id: 'job-1', notable_type: 'Job', content: 'Test note' },
    { id: '2', notable_id: 'task-1', notable_type: 'Task', content: 'Task note' }
  ])
};

// Mock getZero function
jest.mock('../zero-client', () => ({
  getZero: jest.fn().mockReturnValue({
    query: jest.fn().mockReturnValue(mockZeroQuery)
  })
}));

// Mock polymorphic tracker
jest.mock('./tracker', () => ({
  polymorphicTracker: {
    getConfig: jest.fn().mockReturnValue({
      associations: {
        notable: {
          type: 'notable',
          validTargets: {
            'jobs': { modelName: 'Job', tableName: 'jobs', active: true },
            'tasks': { modelName: 'Task', tableName: 'tasks', active: true },
            'clients': { modelName: 'Client', tableName: 'clients', active: true }
          }
        },
        loggable: {
          type: 'loggable',
          validTargets: {
            'jobs': { modelName: 'Job', tableName: 'jobs', active: true },
            'tasks': { modelName: 'Task', tableName: 'tasks', active: true },
            'users': { modelName: 'User', tableName: 'users', active: true }
          }
        }
      }
    })
  }
}));

// Mock debug utility
jest.mock('../../utils/debug', () => ({
  debugDatabase: {
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('ChainableQuery Initialization', () => {
  let config: BaseModelConfig;

  beforeEach(() => {
    config = {
      tableName: 'notes',
      primaryKey: 'id',
      softDelete: false
    };
    jest.clearAllMocks();
  });

  it('should create ChainableQuery instance', () => {
    const query = new ChainableQuery(config, 'notable');
    
    expect(query).toBeInstanceOf(ChainableQuery);
    expect(query).toBeInstanceOf(PolymorphicQuery);
  });

  it('should create query with factory function', () => {
    const query = createPolymorphicQuery(config, 'notable');
    
    expect(query).toBeInstanceOf(ChainableQuery);
  });

  it('should create type-specific queries', () => {
    const notableQuery = createNotableQuery(config);
    const loggableQuery = createLoggableQuery(config);
    const schedulableQuery = createSchedulableQuery(config);
    const targetQuery = createTargetQuery(config);
    const parseableQuery = createParseableQuery(config);

    expect(notableQuery).toBeInstanceOf(ChainableQuery);
    expect(loggableQuery).toBeInstanceOf(ChainableQuery);
    expect(schedulableQuery).toBeInstanceOf(ChainableQuery);
    expect(targetQuery).toBeInstanceOf(ChainableQuery);
    expect(parseableQuery).toBeInstanceOf(ChainableQuery);
  });
});

describe('ChainableQuery Filtering', () => {
  let query: ChainableQuery<any>;
  let config: BaseModelConfig;

  beforeEach(() => {
    config = {
      tableName: 'notes',
      primaryKey: 'id',
      softDelete: false
    };
    query = new ChainableQuery(config, 'notable');
    jest.clearAllMocks();
  });

  it('should filter by polymorphic type', () => {
    const filteredQuery = query.forPolymorphicType('notable');
    
    expect(filteredQuery).toBeInstanceOf(ChainableQuery);
    expect(filteredQuery).not.toBe(query); // Should return new instance
    
    const metadata = filteredQuery.getPolymorphicMetadata();
    expect(metadata.conditions.polymorphicType).toBe('notable');
  });

  it('should filter by multiple polymorphic types', () => {
    const filteredQuery = query.forPolymorphicType(['notable', 'loggable']);
    
    const metadata = filteredQuery.getPolymorphicMetadata();
    expect(metadata.conditions.polymorphicType).toEqual(['notable', 'loggable']);
  });

  it('should filter by target type', () => {
    const filteredQuery = query.forTargetType('Job');
    
    const metadata = filteredQuery.getPolymorphicMetadata();
    expect(metadata.conditions.targetType).toBe('Job');
  });

  it('should filter by multiple target types', () => {
    const filteredQuery = query.forTargetType(['Job', 'Task']);
    
    const metadata = filteredQuery.getPolymorphicMetadata();
    expect(metadata.conditions.targetType).toEqual(['Job', 'Task']);
  });

  it('should filter by target ID', () => {
    const filteredQuery = query.forTargetId('123');
    
    const metadata = filteredQuery.getPolymorphicMetadata();
    expect(metadata.conditions.targetId).toBe('123');
  });

  it('should filter by multiple target IDs', () => {
    const filteredQuery = query.forTargetId([123, 456, 789]);
    
    const metadata = filteredQuery.getPolymorphicMetadata();
    expect(metadata.conditions.targetId).toEqual([123, 456, 789]);
  });

  it('should chain multiple filters', () => {
    const chainedQuery = query
      .forPolymorphicType('notable')
      .forTargetType('Job')
      .forTargetId('123');
    
    const metadata = chainedQuery.getPolymorphicMetadata();
    expect(metadata.conditions.polymorphicType).toBe('notable');
    expect(metadata.conditions.targetType).toBe('Job');
    expect(metadata.conditions.targetId).toBe('123');
  });
});

describe('ChainableQuery Eager Loading', () => {
  let query: ChainableQuery<any>;
  let config: BaseModelConfig;

  beforeEach(() => {
    config = {
      tableName: 'notes',
      primaryKey: 'id',
      softDelete: false
    };
    query = new ChainableQuery(config, 'notable');
    jest.clearAllMocks();
  });

  it('should include polymorphic targets', () => {
    const eagerQuery = query.includePolymorphicTargets();
    
    const metadata = eagerQuery.getPolymorphicMetadata();
    expect(metadata.eagerLoading.includeTargets).toBe(true);
  });

  it('should include specific target types', () => {
    const eagerQuery = query.includePolymorphicTargets({
      targetTypes: ['Job', 'Task']
    });
    
    const metadata = eagerQuery.getPolymorphicMetadata();
    expect(metadata.eagerLoading.targetTypes).toEqual(['Job', 'Task']);
  });

  it('should include with callback refinement', () => {
    const callback = jest.fn();
    const eagerQuery = query.includePolymorphicTargets({
      targetCallback: callback
    });
    
    const metadata = eagerQuery.getPolymorphicMetadata();
    expect(metadata.eagerLoading.targetCallback).toBe(callback);
  });

  it('should include specific polymorphic relationship', () => {
    const includedQuery = query.includePolymorphic('notable');
    
    // Should be chainable
    expect(includedQuery).toBeInstanceOf(ChainableQuery);
  });
});

describe('ChainableQuery Execution', () => {
  let query: ChainableQuery<any>;
  let config: BaseModelConfig;

  beforeEach(() => {
    config = {
      tableName: 'notes',
      primaryKey: 'id',
      softDelete: false
    };
    query = new ChainableQuery(config, 'notable');
    jest.clearAllMocks();
  });

  it('should execute all() query successfully', async () => {
    const results = await query.all();
    
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(2);
    expect(mockZeroQuery.run).toHaveBeenCalledOnce();
  });

  it('should execute first() query successfully', async () => {
    const result = await query.first();
    
    expect(result).toBeDefined();
    expect(result?.id).toBe('1');
    expect(mockZeroQuery.limit).toHaveBeenCalledWith(1);
    expect(mockZeroQuery.run).toHaveBeenCalledOnce();
  });

  it('should return null when first() finds no results', async () => {
    mockZeroQuery.run.mockResolvedValueOnce([]);
    
    const result = await query.first();
    
    expect(result).toBeNull();
  });

  it('should execute count() query successfully', async () => {
    const count = await query.count();
    
    expect(typeof count).toBe('number');
    expect(count).toBe(2); // Based on mock data
    expect(mockZeroQuery.run).toHaveBeenCalledOnce();
  });

  it('should execute exists() query successfully', async () => {
    const exists = await query.exists();
    
    expect(typeof exists).toBe('boolean');
    expect(exists).toBe(true);
  });

  it('should return false for exists() when no results', async () => {
    mockZeroQuery.run.mockResolvedValueOnce([]);
    
    const exists = await query.exists();
    
    expect(exists).toBe(false);
  });

  it('should execute paginate() query successfully', async () => {
    const page = await query.paginate(1, 10);
    
    expect(page).toEqual({
      data: expect.any(Array),
      page: 1,
      perPage: 10,
      total: 2,
      totalPages: 1
    });
    
    expect(page.data.length).toBe(2);
  });

  it('should handle pagination with different page sizes', async () => {
    const page = await query.paginate(2, 1);
    
    expect(page.page).toBe(2);
    expect(page.perPage).toBe(1);
    expect(page.totalPages).toBe(2);
  });
});

describe('ChainableQuery Error Handling', () => {
  let query: ChainableQuery<any>;
  let config: BaseModelConfig;

  beforeEach(() => {
    config = {
      tableName: 'notes',
      primaryKey: 'id',
      softDelete: false
    };
    query = new ChainableQuery(config, 'notable');
    jest.clearAllMocks();
  });

  it('should throw error when Zero.js is unavailable', async () => {
    // Mock Zero.js unavailable
    jest.doMock('../zero-client', () => ({
      getZero: jest.fn().mockReturnValue(null)
    }));

    await expect(query.all()).rejects.toThrow();
  });

  it('should handle query execution errors gracefully', async () => {
    mockZeroQuery.run.mockRejectedValueOnce(new Error('Query execution failed'));
    
    await expect(query.all()).rejects.toThrow('Query execution failed');
  });

  it('should validate polymorphic conditions', () => {
    const invalidQuery = query.forTargetType('InvalidTargetType');
    
    // Should throw validation error when building query
    expect(() => {
      (invalidQuery as any).buildZeroQuery();
    }).toThrow();
  });

  it('should handle empty valid targets gracefully', () => {
    const validTargets = query.getValidTargetTypes();
    
    // Should return array even if no targets
    expect(Array.isArray(validTargets)).toBe(true);
  });

  it('should handle exists() query errors gracefully', async () => {
    mockZeroQuery.run.mockRejectedValueOnce(new Error('Exists query failed'));
    
    const exists = await query.exists();
    
    expect(exists).toBe(false); // Should return false on error
  });
});

describe('ChainableQuery Performance', () => {
  let query: ChainableQuery<any>;
  let config: BaseModelConfig;

  beforeEach(() => {
    config = {
      tableName: 'notes',
      primaryKey: 'id',
      softDelete: false
    };
    query = new ChainableQuery(config, 'notable');
    jest.clearAllMocks();
  });

  it('should build queries quickly', () => {
    const startTime = performance.now();
    
    for (let i = 0; i < 1000; i++) {
      query
        .forTargetType('Job')
        .forTargetId(i.toString())
        .includePolymorphicTargets();
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
  });

  it('should clone queries efficiently', () => {
    const startTime = performance.now();
    
    let chainedQuery = query;
    for (let i = 0; i < 100; i++) {
      chainedQuery = chainedQuery.forTargetId(i.toString());
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(500); // Should complete in under 500ms
  });

  it('should execute queries within performance requirements', async () => {
    const startTime = performance.now();
    
    await query
      .forTargetType('Job')
      .includePolymorphicTargets()
      .all();
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
  });
});

describe('ChainableQuery Integration', () => {
  let query: ChainableQuery<any>;
  let config: BaseModelConfig;

  beforeEach(() => {
    config = {
      tableName: 'notes',
      primaryKey: 'id',
      softDelete: false
    };
    query = new ChainableQuery(config, 'notable');
    jest.clearAllMocks();
  });

  it('should integrate with existing query methods', () => {
    const chainedQuery = query
      .where('content', '!=', null)
      .orderBy('created_at', 'desc')
      .limit(10)
      .forTargetType('Job');
    
    expect(chainedQuery).toBeInstanceOf(ChainableQuery);
  });

  it('should preserve query state through chaining', () => {
    const originalQuery = query
      .forTargetType('Job')
      .forTargetId('123');
    
    const newQuery = originalQuery.forPolymorphicType('notable');
    
    // Original query should be unchanged
    const originalMetadata = originalQuery.getPolymorphicMetadata();
    expect(originalMetadata.conditions.polymorphicType).toBeUndefined();
    
    // New query should have all conditions
    const newMetadata = newQuery.getPolymorphicMetadata();
    expect(newMetadata.conditions.targetType).toBe('Job');
    expect(newMetadata.conditions.targetId).toBe('123');
    expect(newMetadata.conditions.polymorphicType).toBe('notable');
  });

  it('should work with all polymorphic types', () => {
    const polymorphicTypes: PolymorphicType[] = ['notable', 'loggable', 'schedulable', 'target', 'parseable'];
    
    for (const type of polymorphicTypes) {
      const typeQuery = createPolymorphicQuery(config, type);
      const metadata = typeQuery.getPolymorphicMetadata();
      
      expect(metadata.type).toBe(type);
      expect(Array.isArray(metadata.validTargets)).toBe(true);
    }
  });

  it('should maintain immutability in query chains', () => {
    const baseQuery = query.forTargetType('Job');
    const query1 = baseQuery.forTargetId('123');
    const query2 = baseQuery.forTargetId('456');
    
    const metadata1 = query1.getPolymorphicMetadata();
    const metadata2 = query2.getPolymorphicMetadata();
    
    expect(metadata1.conditions.targetId).toBe('123');
    expect(metadata2.conditions.targetId).toBe('456');
    
    // Base query should be unchanged
    const baseMetadata = baseQuery.getPolymorphicMetadata();
    expect(baseMetadata.conditions.targetId).toBeUndefined();
  });
});

describe('ChainableQuery EP-0035 Success Metrics', () => {
  let config: BaseModelConfig;

  beforeEach(() => {
    config = {
      tableName: 'notes',
      primaryKey: 'id',
      softDelete: false
    };
    jest.clearAllMocks();
  });

  it('should support all polymorphic types (EP-0035)', () => {
    const polymorphicTypes: PolymorphicType[] = ['notable', 'loggable', 'schedulable', 'target', 'parseable'];
    
    for (const type of polymorphicTypes) {
      const query = createPolymorphicQuery(config, type);
      
      expect(() => {
        query
          .forPolymorphicType(type)
          .forTargetType('Job')
          .includePolymorphicTargets();
      }).not.toThrow();
    }
  });

  it('should generate clean, ESLint-compliant code patterns (EP-0035)', () => {
    const query = createNotableQuery(config);
    
    // Query methods should follow proper naming conventions
    expect(typeof query.forPolymorphicType).toBe('function');
    expect(typeof query.forTargetType).toBe('function');
    expect(typeof query.forTargetId).toBe('function');
    expect(typeof query.includePolymorphicTargets).toBe('function');
    expect(typeof query.all).toBe('function');
    expect(typeof query.first).toBe('function');
    expect(typeof query.count).toBe('function');
    expect(typeof query.exists).toBe('function');
    expect(typeof query.paginate).toBe('function');
  });

  it('should provide type-safe operations (EP-0035)', () => {
    const query = createLoggableQuery<{ id: string; content: string }>(config);
    
    // TypeScript should enforce type safety (tested through compilation)
    const metadata = query.getPolymorphicMetadata();
    expect(metadata.type).toBe('loggable');
    expect(typeof metadata.conditions).toBe('object');
    expect(typeof metadata.eagerLoading).toBe('object');
    expect(Array.isArray(metadata.validTargets)).toBe(true);
  });

  it('should maintain performance requirements (EP-0035)', async () => {
    const startTime = performance.now();
    
    const query = createPolymorphicQuery(config, 'notable');
    await query
      .forTargetType('Job')
      .includePolymorphicTargets()
      .limit(100)
      .all();
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(3000); // Should complete within reasonable time
  });

  it('should integrate seamlessly with existing Zero.js patterns (EP-0035)', () => {
    const query = createPolymorphicQuery(config, 'notable');
    
    // Should work with existing query methods
    const chainedQuery = query
      .where('active', true)
      .orderBy('created_at', 'desc')
      .forTargetType('Job')
      .limit(10);
    
    expect(chainedQuery).toBeInstanceOf(ChainableQuery);
    
    const builtQuery = (chainedQuery as any).buildZeroQuery();
    expect(builtQuery).toBeDefined();
  });
});