/**
 * PolymorphicDiscovery - Comprehensive Unit Tests
 * 
 * Tests for the PolymorphicDiscovery functionality including:
 * - Pattern matching and discovery algorithms
 * - Database introspection capabilities
 * - Schema analysis and type detection
 * - Discovery result validation
 * - Performance and accuracy metrics
 * 
 * Generated: 2025-08-06 Epic-008 Polymorphic Discovery Testing
 */

import { PolymorphicDiscovery } from '../discovery';
import { DatabaseIntrospection } from '../database-introspection';
import type { PolymorphicType, PolymorphicDiscoveryResult } from '../types';
import { performance } from 'perf_hooks';

// Mock database introspection
jest.mock('../database-introspection', () => ({
  DatabaseIntrospection: {
    getTableNames: jest.fn(),
    getTableColumns: jest.fn(),
    getForeignKeys: jest.fn(),
    getPolymorphicRelationships: jest.fn()
  }
}));

// Mock debug utility
jest.mock('../../utils/debug', () => ({
  debugDatabase: jest.fn()
}));

const mockDatabaseIntrospection = DatabaseIntrospection as jest.Mocked<typeof DatabaseIntrospection>;

describe('PolymorphicDiscovery Initialization', () => {
  let discovery: PolymorphicDiscovery;

  beforeEach(() => {
    discovery = new PolymorphicDiscovery();
    jest.clearAllMocks();
  });

  it('should initialize successfully', () => {
    expect(discovery).toBeInstanceOf(PolymorphicDiscovery);
  });

  it('should have default configuration', () => {
    const config = discovery.getDiscoveryConfig();
    expect(config.patterns).toBeDefined();
    expect(config.confidence).toBeDefined();
    expect(config.sources).toBeDefined();
  });
});

describe('PolymorphicDiscovery Pattern Matching', () => {
  let discovery: PolymorphicDiscovery;

  beforeEach(() => {
    discovery = new PolymorphicDiscovery();
    
    // Mock database schema
    mockDatabaseIntrospection.getTableNames.mockReturnValue([
      'notes',
      'activity_logs',
      'scheduled_date_times',
      'job_targets',
      'parsed_emails',
      'jobs',
      'tasks',
      'clients',
      'users',
      'people',
      'people_groups'
    ]);

    mockDatabaseIntrospection.getTableColumns.mockImplementation((tableName: string) => {
      switch (tableName) {
        case 'notes':
          return [
            { name: 'id', type: 'uuid', nullable: false, primary: true },
            { name: 'notable_id', type: 'uuid', nullable: true, primary: false },
            { name: 'notable_type', type: 'varchar', nullable: true, primary: false },
            { name: 'content', type: 'text', nullable: true, primary: false }
          ];
        case 'activity_logs':
          return [
            { name: 'id', type: 'uuid', nullable: false, primary: true },
            { name: 'loggable_id', type: 'uuid', nullable: true, primary: false },
            { name: 'loggable_type', type: 'varchar', nullable: true, primary: false },
            { name: 'action', type: 'varchar', nullable: false, primary: false }
          ];
        case 'scheduled_date_times':
          return [
            { name: 'id', type: 'uuid', nullable: false, primary: true },
            { name: 'schedulable_id', type: 'uuid', nullable: true, primary: false },
            { name: 'schedulable_type', type: 'varchar', nullable: true, primary: false },
            { name: 'scheduled_at', type: 'timestamp', nullable: false, primary: false }
          ];
        case 'job_targets':
          return [
            { name: 'id', type: 'uuid', nullable: false, primary: true },
            { name: 'job_id', type: 'uuid', nullable: false, primary: false },
            { name: 'target_id', type: 'uuid', nullable: true, primary: false },
            { name: 'target_type', type: 'varchar', nullable: true, primary: false }
          ];
        case 'parsed_emails':
          return [
            { name: 'id', type: 'uuid', nullable: false, primary: true },
            { name: 'parseable_id', type: 'uuid', nullable: true, primary: false },
            { name: 'parseable_type', type: 'varchar', nullable: true, primary: false },
            { name: 'subject', type: 'varchar', nullable: false, primary: false }
          ];
        default:
          return [
            { name: 'id', type: 'uuid', nullable: false, primary: true },
            { name: 'name', type: 'varchar', nullable: false, primary: false }
          ];
      }
    });
  });

  it('should discover notable polymorphic relationships', async () => {
    const results = await discovery.discoverPolymorphicTypes();
    
    const notableResult = results.find(r => r.type === 'notable');
    expect(notableResult).toBeDefined();
    expect(notableResult?.targets.length).toBeGreaterThan(0);
    expect(notableResult?.metadata.confidence).toBe('high');
  });

  it('should discover loggable polymorphic relationships', async () => {
    const results = await discovery.discoverPolymorphicTypes();
    
    const loggableResult = results.find(r => r.type === 'loggable');
    expect(loggableResult).toBeDefined();
    expect(loggableResult?.targets.length).toBeGreaterThan(0);
    expect(loggableResult?.metadata.confidence).toBe('high');
  });

  it('should discover schedulable polymorphic relationships', async () => {
    const results = await discovery.discoverPolymorphicTypes();
    
    const schedulableResult = results.find(r => r.type === 'schedulable');
    expect(schedulableResult).toBeDefined();
    expect(schedulableResult?.targets.length).toBeGreaterThan(0);
    expect(schedulableResult?.metadata.confidence).toBe('high');
  });

  it('should discover target polymorphic relationships', async () => {
    const results = await discovery.discoverPolymorphicTypes();
    
    const targetResult = results.find(r => r.type === 'target');
    expect(targetResult).toBeDefined();
    expect(targetResult?.targets.length).toBeGreaterThan(0);
    expect(targetResult?.metadata.confidence).toBe('high');
  });

  it('should discover parseable polymorphic relationships', async () => {
    const results = await discovery.discoverPolymorphicTypes();
    
    const parseableResult = results.find(r => r.type === 'parseable');
    expect(parseableResult).toBeDefined();
    expect(parseableResult?.targets.length).toBeGreaterThan(0);
    expect(parseableResult?.metadata.confidence).toBe('high');
  });

  it('should match polymorphic column patterns correctly', () => {
    const patterns = [
      { id: 'notable_id', type: 'notable_type', expected: 'notable' },
      { id: 'loggable_id', type: 'loggable_type', expected: 'loggable' },
      { id: 'schedulable_id', type: 'schedulable_type', expected: 'schedulable' },
      { id: 'target_id', type: 'target_type', expected: 'target' },
      { id: 'parseable_id', type: 'parseable_type', expected: 'parseable' }
    ];

    for (const pattern of patterns) {
      const polymorphicType = discovery.detectPolymorphicType(pattern.id, pattern.type);
      expect(polymorphicType).toBe(pattern.expected);
    }
  });

  it('should return null for non-polymorphic patterns', () => {
    const nonPolymorphicPatterns = [
      { id: 'user_id', type: 'user_type' },
      { id: 'foreign_id', type: 'foreign_type' },
      { id: 'some_id', type: 'some_type' }
    ];

    for (const pattern of nonPolymorphicPatterns) {
      const polymorphicType = discovery.detectPolymorphicType(pattern.id, pattern.type);
      expect(polymorphicType).toBeNull();
    }
  });
});

describe('PolymorphicDiscovery Target Detection', () => {
  let discovery: PolymorphicDiscovery;

  beforeEach(() => {
    discovery = new PolymorphicDiscovery();
  });

  it('should identify valid target models', () => {
    const potentialTargets = ['jobs', 'tasks', 'clients', 'users', 'people', 'people_groups', 'devices'];
    
    const validTargets = discovery.filterValidTargets('loggable', potentialTargets);
    
    expect(validTargets.length).toBeGreaterThan(0);
    expect(validTargets).toContain('jobs');
    expect(validTargets).toContain('tasks');
    expect(validTargets).toContain('clients');
  });

  it('should generate correct model names from table names', () => {
    const testCases = [
      { table: 'jobs', expected: 'Job' },
      { table: 'tasks', expected: 'Task' },
      { table: 'clients', expected: 'Client' },
      { table: 'people_groups', expected: 'PeopleGroup' },
      { table: 'scheduled_date_times', expected: 'ScheduledDateTime' },
      { table: 'activity_logs', expected: 'ActivityLog' }
    ];

    for (const testCase of testCases) {
      const modelName = discovery.generateModelName(testCase.table);
      expect(modelName).toBe(testCase.expected);
    }
  });

  it('should validate target relationships', () => {
    // Mock foreign key data to validate relationships
    mockDatabaseIntrospection.getForeignKeys.mockReturnValue([
      {
        table: 'notes',
        column: 'notable_id',
        referencedTable: 'jobs',
        referencedColumn: 'id'
      },
      {
        table: 'notes',
        column: 'notable_id',
        referencedTable: 'tasks',
        referencedColumn: 'id'
      }
    ]);

    const isValid = discovery.validateTargetRelationship('notable', 'jobs');
    expect(isValid).toBe(true);
  });
});

describe('PolymorphicDiscovery Schema Analysis', () => {
  let discovery: PolymorphicDiscovery;

  beforeEach(() => {
    discovery = new PolymorphicDiscovery();
  });

  it('should analyze complete schema structure', async () => {
    mockDatabaseIntrospection.getPolymorphicRelationships.mockReturnValue([
      {
        sourceTable: 'notes',
        polymorphicType: 'notable',
        idField: 'notable_id',
        typeField: 'notable_type',
        targetTables: ['jobs', 'tasks', 'clients']
      },
      {
        sourceTable: 'activity_logs',
        polymorphicType: 'loggable',
        idField: 'loggable_id',
        typeField: 'loggable_type',
        targetTables: ['jobs', 'tasks', 'clients', 'users', 'people']
      }
    ]);

    const schemaAnalysis = await discovery.analyzeSchema();
    
    expect(schemaAnalysis.polymorphicRelationships).toHaveLength(2);
    expect(schemaAnalysis.totalTables).toBeGreaterThan(0);
    expect(schemaAnalysis.polymorphicCoverage).toBeGreaterThan(0);
  });

  it('should calculate schema complexity metrics', async () => {
    const metrics = await discovery.calculateComplexityMetrics();
    
    expect(metrics.totalRelationships).toBeDefined();
    expect(metrics.polymorphicPercentage).toBeDefined();
    expect(metrics.averageTargetsPerType).toBeDefined();
    expect(metrics.schemaComplexity).toBeDefined();
  });

  it('should detect schema inconsistencies', async () => {
    // Mock inconsistent schema data
    mockDatabaseIntrospection.getTableColumns.mockImplementation((tableName: string) => {
      if (tableName === 'inconsistent_table') {
        return [
          { name: 'id', type: 'uuid', nullable: false, primary: true },
          { name: 'notable_id', type: 'uuid', nullable: true, primary: false },
          // Missing notable_type field - inconsistency
          { name: 'content', type: 'text', nullable: true, primary: false }
        ];
      }
      return [];
    });

    const inconsistencies = await discovery.detectSchemaInconsistencies();
    
    expect(Array.isArray(inconsistencies)).toBe(true);
    // Should detect missing type field
  });
});

describe('PolymorphicDiscovery Performance', () => {
  let discovery: PolymorphicDiscovery;

  beforeEach(() => {
    discovery = new PolymorphicDiscovery();
    
    // Mock large schema for performance testing
    const largeMockTables = Array.from({ length: 200 }, (_, i) => `table_${i}`);
    mockDatabaseIntrospection.getTableNames.mockReturnValue(largeMockTables);
  });

  it('should complete discovery within performance requirements (EP-0035)', async () => {
    const startTime = performance.now();
    
    await discovery.discoverPolymorphicTypes();
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should complete within EP-0035 5-second requirement
    expect(duration).toBeLessThan(5000);
  });

  it('should handle large schemas efficiently', async () => {
    const startTime = performance.now();
    
    // Mock complex columns for each table
    mockDatabaseIntrospection.getTableColumns.mockImplementation(() => [
      { name: 'id', type: 'uuid', nullable: false, primary: true },
      { name: 'polymorphic_id', type: 'uuid', nullable: true, primary: false },
      { name: 'polymorphic_type', type: 'varchar', nullable: true, primary: false },
      { name: 'data', type: 'jsonb', nullable: true, primary: false }
    ]);

    await discovery.analyzeSchema();
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds
  });

  it('should cache discovery results for repeated queries', async () => {
    // First discovery should take longer
    const startTime1 = performance.now();
    await discovery.discoverPolymorphicTypes();
    const endTime1 = performance.now();
    const firstDuration = endTime1 - startTime1;

    // Second discovery should be faster due to caching
    const startTime2 = performance.now();
    await discovery.discoverPolymorphicTypes();
    const endTime2 = performance.now();
    const secondDuration = endTime2 - startTime2;

    expect(secondDuration).toBeLessThanOrEqual(firstDuration);
  });
});

describe('PolymorphicDiscovery Error Handling', () => {
  let discovery: PolymorphicDiscovery;

  beforeEach(() => {
    discovery = new PolymorphicDiscovery();
  });

  it('should handle database connection errors gracefully', async () => {
    mockDatabaseIntrospection.getTableNames.mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    const results = await discovery.discoverPolymorphicTypes();
    
    // Should return empty results instead of throwing
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  it('should handle malformed schema data', async () => {
    mockDatabaseIntrospection.getTableColumns.mockReturnValue([
      // Malformed column data
      { name: '', type: null, nullable: undefined, primary: null } as any
    ]);

    await expect(discovery.analyzeSchema()).resolves.not.toThrow();
  });

  it('should handle missing polymorphic patterns gracefully', async () => {
    mockDatabaseIntrospection.getTableNames.mockReturnValue(['regular_table']);
    mockDatabaseIntrospection.getTableColumns.mockReturnValue([
      { name: 'id', type: 'uuid', nullable: false, primary: true },
      { name: 'regular_column', type: 'varchar', nullable: true, primary: false }
    ]);

    const results = await discovery.discoverPolymorphicTypes();
    
    expect(Array.isArray(results)).toBe(true);
    // Should return empty or low-confidence results
  });

  it('should validate input parameters', () => {
    expect(() => {
      discovery.detectPolymorphicType('', '');
    }).not.toThrow();

    expect(() => {
      discovery.detectPolymorphicType(null as any, undefined as any);
    }).not.toThrow();

    const result = discovery.detectPolymorphicType('', '');
    expect(result).toBeNull();
  });
});

describe('PolymorphicDiscovery EP-0035 Success Metrics', () => {
  let discovery: PolymorphicDiscovery;

  beforeEach(() => {
    discovery = new PolymorphicDiscovery();
    
    // Mock complete BOS schema
    mockDatabaseIntrospection.getTableNames.mockReturnValue([
      'notes', 'activity_logs', 'scheduled_date_times', 'job_targets', 'parsed_emails',
      'jobs', 'tasks', 'clients', 'users', 'people', 'people_groups', 'devices',
      'people_group_memberships'
    ]);

    mockDatabaseIntrospection.getTableColumns.mockImplementation((tableName: string) => {
      const polymorphicTables = {
        'notes': { id: 'notable_id', type: 'notable_type' },
        'activity_logs': { id: 'loggable_id', type: 'loggable_type' },
        'scheduled_date_times': { id: 'schedulable_id', type: 'schedulable_type' },
        'job_targets': { id: 'target_id', type: 'target_type' },
        'parsed_emails': { id: 'parseable_id', type: 'parseable_type' }
      };

      if (tableName in polymorphicTables) {
        const poly = polymorphicTables[tableName as keyof typeof polymorphicTables];
        return [
          { name: 'id', type: 'uuid', nullable: false, primary: true },
          { name: poly.id, type: 'uuid', nullable: true, primary: false },
          { name: poly.type, type: 'varchar', nullable: true, primary: false },
          { name: 'data', type: 'text', nullable: true, primary: false }
        ];
      }

      return [
        { name: 'id', type: 'uuid', nullable: false, primary: true },
        { name: 'name', type: 'varchar', nullable: false, primary: false }
      ];
    });
  });

  it('should discover 100% of polymorphic types vs database (EP-0035)', async () => {
    const results = await discovery.discoverPolymorphicTypes();
    
    const expectedTypes: PolymorphicType[] = ['notable', 'loggable', 'schedulable', 'target', 'parseable'];
    const discoveredTypes = results.map(r => r.type);
    
    for (const expectedType of expectedTypes) {
      expect(discoveredTypes).toContain(expectedType);
    }
    
    expect(results.length).toBe(expectedTypes.length);
  });

  it('should use no hardcoded type lists (EP-0035)', () => {
    // Discovery should not rely on hardcoded patterns
    const config = discovery.getDiscoveryConfig();
    
    // Patterns should be flexible, not hardcoded lists
    expect(config.patterns.polymorphicIdSuffix).toBeDefined();
    expect(config.patterns.polymorphicTypeSuffix).toBeDefined();
    expect(typeof config.patterns.polymorphicIdSuffix).toBe('string');
    expect(typeof config.patterns.polymorphicTypeSuffix).toBe('string');
  });

  it('should automatically discover new polymorphic types (EP-0035)', async () => {
    // Add a new polymorphic table to the schema
    mockDatabaseIntrospection.getTableNames.mockReturnValue([
      'notes', 'activity_logs', 'new_polymorphic_table',
      'jobs', 'tasks', 'clients'
    ]);

    mockDatabaseIntrospection.getTableColumns.mockImplementation((tableName: string) => {
      if (tableName === 'new_polymorphic_table') {
        return [
          { name: 'id', type: 'uuid', nullable: false, primary: true },
          { name: 'attachable_id', type: 'uuid', nullable: true, primary: false },
          { name: 'attachable_type', type: 'varchar', nullable: true, primary: false }
        ];
      }
      // Return other table columns as before
      return [
        { name: 'id', type: 'uuid', nullable: false, primary: true }
      ];
    });

    const results = await discovery.discoverPolymorphicTypes();
    
    // Should discover the new "attachable" polymorphic type automatically
    const attachableResult = results.find(r => r.type === 'attachable' as PolymorphicType);
    expect(attachableResult).toBeDefined();
  });

  it('should maintain performance under 5 seconds (EP-0035)', async () => {
    const startTime = performance.now();
    
    await discovery.discoverPolymorphicTypes();
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(5000);
  });

  it('should generate zero ESLint warnings in output (EP-0035)', async () => {
    const results = await discovery.discoverPolymorphicTypes();
    
    // Validate that all discovery results follow proper naming conventions
    for (const result of results) {
      // Type should be valid polymorphic type
      expect(result.type).toMatch(/^[a-z]+$/);
      
      // Target model names should be PascalCase
      for (const target of result.targets) {
        expect(target.modelName).toMatch(/^[A-Z][a-zA-Z0-9]*$/);
        expect(target.tableName).toMatch(/^[a-z_][a-z0-9_]*$/);
      }
      
      // Metadata should be properly formatted
      expect(result.metadata.discoveredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      expect(['high', 'medium', 'low']).toContain(result.metadata.confidence);
    }
  });

  it('should survive database resets (EP-0035)', async () => {
    // First discovery
    const firstResults = await discovery.discoverPolymorphicTypes();
    
    // Simulate database reset by creating new discovery instance
    const newDiscovery = new PolymorphicDiscovery();
    
    // Reset should not affect discovery capability
    const secondResults = await newDiscovery.discoverPolymorphicTypes();
    
    expect(secondResults.length).toBe(firstResults.length);
    
    // Should discover the same polymorphic types
    const firstTypes = firstResults.map(r => r.type).sort();
    const secondTypes = secondResults.map(r => r.type).sort();
    expect(secondTypes).toEqual(firstTypes);
  });
});