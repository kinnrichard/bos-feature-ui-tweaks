/**
 * Test Utilities for Polymorphic Tracking System
 * 
 * Shared utilities, mocks, and fixtures for comprehensive testing
 * of the polymorphic tracking system.
 * 
 * Generated: 2025-08-06 Epic-008 Polymorphic Test Utilities
 */

import type { PolymorphicType, PolymorphicConfig, PolymorphicTargetMetadata } from '../types';

/**
 * Test data fixtures for consistent testing
 */
export const TEST_FIXTURES = {
  /**
   * Complete BOS polymorphic configuration
   */
  BOS_CONFIG: {
    notable: ['jobs', 'tasks', 'clients'],
    loggable: [
      'jobs', 'tasks', 'clients', 'users', 'people', 
      'scheduled_date_times', 'people_groups', 
      'people_group_memberships', 'devices'
    ],
    schedulable: ['jobs', 'tasks'],
    target: ['clients', 'people', 'people_groups'],
    parseable: ['jobs', 'tasks']
  } as Record<PolymorphicType, string[]>,

  /**
   * Sample polymorphic configuration
   */
  SAMPLE_CONFIG: (): PolymorphicConfig => ({
    associations: {
      notable: {
        type: 'notable',
        description: 'Notes can be attached to various models',
        validTargets: {
          jobs: createTestMetadata('jobs', 'Job'),
          tasks: createTestMetadata('tasks', 'Task'),
          clients: createTestMetadata('clients', 'Client')
        },
        metadata: createAssociationMetadata()
      },
      loggable: {
        type: 'loggable',
        description: 'Activity logs track changes across models',
        validTargets: {
          jobs: createTestMetadata('jobs', 'Job'),
          tasks: createTestMetadata('tasks', 'Task'),
          users: createTestMetadata('users', 'User')
        },
        metadata: createAssociationMetadata()
      },
      schedulable: {
        type: 'schedulable',
        description: 'Scheduled date times for various models',
        validTargets: {
          jobs: createTestMetadata('jobs', 'Job'),
          tasks: createTestMetadata('tasks', 'Task')
        },
        metadata: createAssociationMetadata()
      },
      target: {
        type: 'target',
        description: 'Job targets for various entity types',
        validTargets: {
          clients: createTestMetadata('clients', 'Client'),
          people: createTestMetadata('people', 'Person'),
          people_groups: createTestMetadata('people_groups', 'PeopleGroup')
        },
        metadata: createAssociationMetadata()
      },
      parseable: {
        type: 'parseable',
        description: 'Parsed emails associated with various models',
        validTargets: {
          jobs: createTestMetadata('jobs', 'Job'),
          tasks: createTestMetadata('tasks', 'Task')
        },
        metadata: createAssociationMetadata()
      }
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      configVersion: '1.0.0',
      totalAssociations: 5,
      totalTargets: 12,
      generatedBy: 'test-utilities'
    }
  }),

  /**
   * Mock database schema
   */
  DATABASE_SCHEMA: {
    tables: [
      'notes', 'activity_logs', 'scheduled_date_times', 'job_targets', 'parsed_emails',
      'jobs', 'tasks', 'clients', 'users', 'people', 'people_groups', 'devices',
      'people_group_memberships'
    ],
    columns: {
      notes: [
        { name: 'id', type: 'uuid', nullable: false, primary: true },
        { name: 'notable_id', type: 'uuid', nullable: true, primary: false },
        { name: 'notable_type', type: 'varchar', nullable: true, primary: false },
        { name: 'content', type: 'text', nullable: true, primary: false }
      ],
      activity_logs: [
        { name: 'id', type: 'uuid', nullable: false, primary: true },
        { name: 'loggable_id', type: 'uuid', nullable: true, primary: false },
        { name: 'loggable_type', type: 'varchar', nullable: true, primary: false },
        { name: 'action', type: 'varchar', nullable: false, primary: false }
      ],
      scheduled_date_times: [
        { name: 'id', type: 'uuid', nullable: false, primary: true },
        { name: 'schedulable_id', type: 'uuid', nullable: true, primary: false },
        { name: 'schedulable_type', type: 'varchar', nullable: true, primary: false },
        { name: 'scheduled_at', type: 'timestamp', nullable: false, primary: false }
      ],
      job_targets: [
        { name: 'id', type: 'uuid', nullable: false, primary: true },
        { name: 'job_id', type: 'uuid', nullable: false, primary: false },
        { name: 'target_id', type: 'uuid', nullable: true, primary: false },
        { name: 'target_type', type: 'varchar', nullable: true, primary: false }
      ],
      parsed_emails: [
        { name: 'id', type: 'uuid', nullable: false, primary: true },
        { name: 'parseable_id', type: 'uuid', nullable: true, primary: false },
        { name: 'parseable_type', type: 'varchar', nullable: true, primary: false },
        { name: 'subject', type: 'varchar', nullable: false, primary: false }
      ]
    }
  }
};

/**
 * Mock factory functions
 */
export const MOCK_FACTORIES = {
  /**
   * Create mock Zero.js query object
   */
  createMockZeroQuery: (mockData: any[] = []) => ({
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    related: jest.fn().mockReturnThis(),
    run: jest.fn().mockResolvedValue(mockData)
  }),

  /**
   * Create mock database introspection
   */
  createMockDatabaseIntrospection: () => ({
    getTableNames: jest.fn().mockReturnValue(TEST_FIXTURES.DATABASE_SCHEMA.tables),
    getTableColumns: jest.fn().mockImplementation((tableName: string) => {
      return TEST_FIXTURES.DATABASE_SCHEMA.columns[tableName as keyof typeof TEST_FIXTURES.DATABASE_SCHEMA.columns] || [
        { name: 'id', type: 'uuid', nullable: false, primary: true }
      ];
    }),
    getForeignKeys: jest.fn().mockReturnValue([]),
    getPolymorphicRelationships: jest.fn().mockReturnValue([])
  }),

  /**
   * Create mock relationship registry
   */
  createMockRelationshipRegistry: () => ({
    register: jest.fn(),
    getValidRelationships: jest.fn(() => []),
    getRelationshipMetadata: jest.fn(() => null)
  })
};

/**
 * Performance testing utilities
 */
export class TestPerformanceProfiler {
  private measurements: Array<{
    name: string;
    duration: number;
    timestamp: number;
  }> = [];

  async measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await operation();
    const end = performance.now();
    
    this.measurements.push({
      name,
      duration: end - start,
      timestamp: Date.now()
    });
    
    return result;
  }

  getMeasurements() {
    return [...this.measurements];
  }

  getAverageDuration(name: string): number {
    const matching = this.measurements.filter(m => m.name === name);
    if (matching.length === 0) return 0;
    
    const total = matching.reduce((sum, m) => sum + m.duration, 0);
    return total / matching.length;
  }

  clear() {
    this.measurements = [];
  }
}

/**
 * Test data generators
 */
export class TestDataGenerator {
  /**
   * Generate test polymorphic targets
   */
  static generateTargets(type: PolymorphicType, count: number = 10): Array<{
    tableName: string;
    modelName: string;
  }> {
    return Array.from({ length: count }, (_, i) => ({
      tableName: `test_${type}_table_${i}`,
      modelName: `Test${type.charAt(0).toUpperCase() + type.slice(1)}Model${i}`
    }));
  }

  /**
   * Generate performance test dataset
   */
  static generatePerformanceDataset(scale: 'small' | 'medium' | 'large' = 'medium'): Record<PolymorphicType, string[]> {
    const scales = {
      small: 5,
      medium: 50,
      large: 200
    };
    
    const count = scales[scale];
    const dataset: Record<PolymorphicType, string[]> = {} as any;
    
    const polymorphicTypes: PolymorphicType[] = ['notable', 'loggable', 'schedulable', 'target', 'parseable'];
    
    for (const type of polymorphicTypes) {
      dataset[type] = Array.from({ length: count }, (_, i) => `${type}_table_${i}`);
    }
    
    return dataset;
  }

  /**
   * Generate mock discovery results
   */
  static generateDiscoveryResults(): Array<{
    type: PolymorphicType;
    targets: Array<{
      modelName: string;
      tableName: string;
      source: string;
      relationshipName?: string;
    }>;
    metadata: {
      discoveredAt: string;
      source: string;
      confidence: 'high' | 'medium' | 'low';
    };
  }> {
    return Object.entries(TEST_FIXTURES.BOS_CONFIG).map(([type, targets]) => ({
      type: type as PolymorphicType,
      targets: targets.map(tableName => ({
        modelName: tableName.charAt(0).toUpperCase() + tableName.slice(1).replace(/_(.)/g, (_, char) => char.toUpperCase()),
        tableName,
        source: 'automated-discovery',
        relationshipName: `${type}${tableName.charAt(0).toUpperCase() + tableName.slice(1)}`
      })),
      metadata: {
        discoveredAt: new Date().toISOString(),
        source: 'test-generator',
        confidence: 'high' as const
      }
    }));
  }
}

/**
 * Assertion helpers
 */
export class TestAssertions {
  /**
   * Assert EP-0035 performance requirements
   */
  static assertPerformanceRequirements(duration: number, operation: string) {
    expect(duration).toBeLessThan(5000); // EP-0035: < 5 second impact
    console.log(`✅ ${operation} completed in ${duration.toFixed(2)}ms (under 5s requirement)`);
  }

  /**
   * Assert polymorphic configuration completeness
   */
  static assertConfigurationCompleteness(config: PolymorphicConfig | null) {
    expect(config).toBeDefined();
    expect(config?.metadata.totalAssociations).toBe(5); // All BOS polymorphic types
    
    const polymorphicTypes: PolymorphicType[] = ['notable', 'loggable', 'schedulable', 'target', 'parseable'];
    
    for (const type of polymorphicTypes) {
      expect(config?.associations[type]).toBeDefined();
      expect(config?.associations[type].validTargets).toBeDefined();
      expect(Object.keys(config?.associations[type].validTargets || {}).length).toBeGreaterThan(0);
    }
  }

  /**
   * Assert ESLint compliance
   */
  static assertESLintCompliance(generatedCode: string) {
    // Check naming conventions
    expect(generatedCode).not.toMatch(/var\s+/); // Should use const/let
    expect(generatedCode).not.toMatch(/;\s*$/m); // Should end with semicolons
    expect(generatedCode).not.toMatch(/\s+$/m); // Should not have trailing whitespace
    
    // Check for common issues
    expect(generatedCode).not.toMatch(/console\.log/); // Should not have debug logs
    expect(generatedCode).not.toMatch(/debugger/); // Should not have debugger statements
  }
}

/**
 * Helper functions
 */
function createTestMetadata(tableName: string, modelName: string): PolymorphicTargetMetadata {
  return {
    modelName,
    tableName,
    discoveredAt: new Date().toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    active: true,
    source: 'test-fixture'
  };
}

function createAssociationMetadata() {
  return {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    configVersion: '1.0.0',
    generatedBy: 'test-utilities'
  };
}

/**
 * Setup and teardown helpers
 */
export class TestSetup {
  /**
   * Setup complete BOS polymorphic configuration for testing
   */
  static async setupBOSConfiguration(tracker: any): Promise<void> {
    for (const [type, targets] of Object.entries(TEST_FIXTURES.BOS_CONFIG)) {
      for (const tableName of targets) {
        const modelName = tableName.charAt(0).toUpperCase() + tableName.slice(1).replace(/_(.)/g, (_, char) => char.toUpperCase());
        await tracker.addTarget(type as PolymorphicType, tableName, modelName);
      }
    }
  }

  /**
   * Setup mock environment for testing
   */
  static setupMockEnvironment() {
    // Mock Zero.js client
    jest.doMock('../zero-client', () => ({
      getZero: jest.fn().mockReturnValue({
        query: jest.fn().mockReturnValue(MOCK_FACTORIES.createMockZeroQuery())
      })
    }));

    // Mock database introspection
    jest.doMock('../database-introspection', () => ({
      DatabaseIntrospection: MOCK_FACTORIES.createMockDatabaseIntrospection()
    }));

    // Mock relationship registry
    jest.doMock('../../models/base/scoped-query-base', () => ({
      relationshipRegistry: MOCK_FACTORIES.createMockRelationshipRegistry()
    }));

    // Mock debug utility
    jest.doMock('../../utils/debug', () => ({
      debugDatabase: jest.fn()
    }));

    // Mock file system
    jest.doMock('fs/promises', () => ({
      readFile: jest.fn(),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      stat: jest.fn()
    }));
  }

  /**
   * Cleanup test environment
   */
  static cleanup() {
    jest.clearAllMocks();
    jest.resetModules();
  }
}

/**
 * Test validation helpers
 */
export class TestValidators {
  /**
   * Validate polymorphic type structure
   */
  static validatePolymorphicType(type: any): boolean {
    return (
      typeof type === 'string' &&
      ['notable', 'loggable', 'schedulable', 'target', 'parseable'].includes(type)
    );
  }

  /**
   * Validate target metadata structure
   */
  static validateTargetMetadata(metadata: any): boolean {
    return (
      typeof metadata === 'object' &&
      typeof metadata.modelName === 'string' &&
      typeof metadata.tableName === 'string' &&
      typeof metadata.discoveredAt === 'string' &&
      typeof metadata.lastVerifiedAt === 'string' &&
      typeof metadata.active === 'boolean' &&
      ['generated-schema', 'manual', 'runtime', 'test-fixture'].includes(metadata.source)
    );
  }

  /**
   * Validate query metadata structure
   */
  static validateQueryMetadata(metadata: any): boolean {
    return (
      typeof metadata === 'object' &&
      Array.isArray(metadata.validTargets) &&
      typeof metadata.conditions === 'object' &&
      typeof metadata.eagerLoading === 'object'
    );
  }
}

// Export everything for easy imports
export {
  createTestMetadata,
  createAssociationMetadata
};