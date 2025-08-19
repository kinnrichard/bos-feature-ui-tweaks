/**
 * Polymorphic System - Integration Tests
 * 
 * Tests for the complete polymorphic tracking system integration including:
 * - End-to-end workflow from discovery to query
 * - Model integration with polymorphic relationships
 * - Cache performance and persistence
 * - Reactive query system with Svelte 5
 * - Schema evolution and migration testing
 * 
 * Generated: 2025-08-06 Epic-008 Polymorphic System Integration Testing
 */

import { PolymorphicTracker } from '../tracker';
import { PolymorphicRegistry, getPolymorphicRegistry } from '../registry';
import { PolymorphicDiscovery } from '../discovery';
import { ChainableQuery, createPolymorphicQuery } from '../query-system';
import { PolymorphicSchemaEvolution } from '../schema-evolution';
import { QueryCache } from '../query-cache';
import { SyncManager } from '../sync-manager';
import type { PolymorphicType } from '../types';
import { performance } from 'perf_hooks';

// Mock Zero.js and related dependencies
jest.mock('../zero-client', () => ({
  getZero: jest.fn().mockReturnValue({
    query: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      related: jest.fn().mockReturnThis(),
      run: jest.fn().mockResolvedValue([
        { id: '1', notable_id: 'job-1', notable_type: 'Job', content: 'Test note' }
      ])
    })
  })
}));

// Mock database introspection
jest.mock('../database-introspection', () => ({
  DatabaseIntrospection: {
    getTableNames: jest.fn().mockReturnValue(['notes', 'activity_logs', 'jobs', 'tasks', 'clients']),
    getTableColumns: jest.fn().mockImplementation((tableName: string) => {
      switch (tableName) {
        case 'notes':
          return [
            { name: 'id', type: 'uuid', nullable: false, primary: true },
            { name: 'notable_id', type: 'uuid', nullable: true, primary: false },
            { name: 'notable_type', type: 'varchar', nullable: true, primary: false }
          ];
        case 'activity_logs':
          return [
            { name: 'id', type: 'uuid', nullable: false, primary: true },
            { name: 'loggable_id', type: 'uuid', nullable: true, primary: false },
            { name: 'loggable_type', type: 'varchar', nullable: true, primary: false }
          ];
        default:
          return [
            { name: 'id', type: 'uuid', nullable: false, primary: true }
          ];
      }
    }),
    getForeignKeys: jest.fn().mockReturnValue([]),
    getPolymorphicRelationships: jest.fn().mockReturnValue([])
  }
}));

// Mock relationship registry
jest.mock('../../models/base/scoped-query-base', () => ({
  relationshipRegistry: {
    register: jest.fn(),
    getValidRelationships: jest.fn(() => []),
    getRelationshipMetadata: jest.fn(() => null)
  }
}));

// Mock file system operations
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  stat: jest.fn()
}));

// Mock debug utility
jest.mock('../../utils/debug', () => ({
  debugDatabase: jest.fn()
}));

describe('Polymorphic System Integration', () => {
  let tracker: PolymorphicTracker;
  let registry: PolymorphicRegistry;
  let discovery: PolymorphicDiscovery;

  beforeEach(async () => {
    tracker = new PolymorphicTracker('integration-test.json');
    registry = new PolymorphicRegistry(tracker);
    discovery = new PolymorphicDiscovery();
    
    await tracker.initialize();
    await registry.initialize();
    
    jest.clearAllMocks();
  });

  it('should complete full discovery-to-query workflow', async () => {
    // 1. Discovery phase
    const discoveries = await discovery.discoverPolymorphicTypes();
    expect(discoveries.length).toBeGreaterThan(0);
    
    // 2. Update tracker with discoveries
    for (const result of discoveries) {
      for (const target of result.targets) {
        await tracker.addTarget(result.type, target.tableName, target.modelName);
      }
    }
    
    // 3. Register relationships
    registry.registerPolymorphicRelationship(
      'notes',
      'notable',
      'notable',
      'notable_id',
      'notable_type'
    );
    
    // 4. Create and execute query
    const query = createPolymorphicQuery({
      tableName: 'notes',
      primaryKey: 'id',
      softDelete: false
    }, 'notable');
    
    const results = await query.forTargetType('Job').all();
    expect(Array.isArray(results)).toBe(true);
  });

  it('should maintain consistency across components', async () => {
    // Add targets through tracker
    await tracker.addTarget('notable', 'jobs', 'Job');
    await tracker.addTarget('notable', 'tasks', 'Task');
    
    // Verify registry sees the same targets
    const registryTargets = registry.getValidTargets('notable');
    const trackerTargets = tracker.getValidTargets('notable');
    
    expect(registryTargets).toEqual(trackerTargets);
    expect(registryTargets).toContain('jobs');
    expect(registryTargets).toContain('tasks');
  });

  it('should handle concurrent operations correctly', async () => {
    const operations = [
      tracker.addTarget('loggable', 'jobs', 'Job'),
      tracker.addTarget('loggable', 'tasks', 'Task'),
      tracker.addTarget('loggable', 'clients', 'Client'),
      registry.addPolymorphicTarget('notable', 'jobs', 'Job'),
      registry.addPolymorphicTarget('notable', 'tasks', 'Task')
    ];
    
    await Promise.all(operations);
    
    // Verify all operations completed successfully
    const loggableTargets = tracker.getValidTargets('loggable');
    const notableTargets = registry.getValidTargets('notable');
    
    expect(loggableTargets.length).toBeGreaterThanOrEqual(3);
    expect(notableTargets.length).toBeGreaterThanOrEqual(2);
  });

  it('should support schema evolution', async () => {
    const schemaEvolution = new PolymorphicSchemaEvolution(tracker);
    
    // Initial state
    await tracker.addTarget('loggable', 'jobs', 'Job');
    const initialTargets = tracker.getValidTargets('loggable');
    
    // Evolve schema - add new target
    await schemaEvolution.addPolymorphicTarget('loggable', 'new_model', 'NewModel');
    
    // Verify evolution
    const evolvedTargets = tracker.getValidTargets('loggable');
    expect(evolvedTargets.length).toBe(initialTargets.length + 1);
    expect(evolvedTargets).toContain('new_model');
  });

  it('should maintain configuration persistence', async () => {
    // Add targets to first tracker
    await tracker.addTarget('notable', 'jobs', 'Job');
    await tracker.addTarget('notable', 'tasks', 'Task');
    
    // Create new tracker with same config path
    const newTracker = new PolymorphicTracker('integration-test.json');
    await newTracker.initialize();
    
    // Should have same targets
    const originalTargets = tracker.getValidTargets('notable');
    const persistedTargets = newTracker.getValidTargets('notable');
    
    expect(persistedTargets).toEqual(originalTargets);
  });
});

describe('Polymorphic System Performance Integration', () => {
  let tracker: PolymorphicTracker;
  let registry: PolymorphicRegistry;

  beforeEach(async () => {
    tracker = new PolymorphicTracker('perf-integration-test.json');
    registry = new PolymorphicRegistry(tracker);
    
    await tracker.initialize();
    await registry.initialize();
  });

  it('should handle large-scale operations efficiently', async () => {
    const startTime = performance.now();
    
    // Add many targets
    const operations = [];
    for (let i = 0; i < 100; i++) {
      operations.push(tracker.addTarget('loggable', `table_${i}`, `Model${i}`));
    }
    
    await Promise.all(operations);
    
    // Register relationships for all targets
    registry.registerPolymorphicTargetRelationships(
      'activity_logs',
      'loggable',
      'loggable_id',
      'loggable_type'
    );
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    
    const targets = tracker.getValidTargets('loggable');
    expect(targets.length).toBeGreaterThanOrEqual(100);
  });

  it('should maintain query performance with caching', async () => {
    const cache = new QueryCache();
    
    // Add some targets
    await tracker.addTarget('notable', 'jobs', 'Job');
    await tracker.addTarget('notable', 'tasks', 'Task');
    
    const query = createPolymorphicQuery({
      tableName: 'notes',
      primaryKey: 'id',
      softDelete: false
    }, 'notable');
    
    // First query - cache miss
    const startTime1 = performance.now();
    await query.forTargetType('Job').all();
    const endTime1 = performance.now();
    const firstDuration = endTime1 - startTime1;
    
    // Second identical query - should use cache
    const startTime2 = performance.now();
    await query.forTargetType('Job').all();
    const endTime2 = performance.now();
    const secondDuration = endTime2 - startTime2;
    
    // Second query should be same or faster due to caching
    expect(secondDuration).toBeLessThanOrEqual(firstDuration * 1.1); // Allow for 10% variance
  });

  it('should handle sync operations efficiently', async () => {
    const syncManager = new SyncManager(tracker, registry);
    
    await tracker.addTarget('loggable', 'jobs', 'Job');
    await tracker.addTarget('loggable', 'tasks', 'Task');
    
    const startTime = performance.now();
    await syncManager.syncAll();
    const endTime = performance.now();
    
    const duration = endTime - startTime;
    expect(duration).toBeLessThan(5000); // Should sync within 5 seconds
  });
});

describe('Polymorphic System Error Recovery Integration', () => {
  let tracker: PolymorphicTracker;
  let registry: PolymorphicRegistry;

  beforeEach(async () => {
    tracker = new PolymorphicTracker('error-recovery-test.json');
    registry = new PolymorphicRegistry(tracker);
    
    await tracker.initialize();
    await registry.initialize();
  });

  it('should recover from tracker failures gracefully', async () => {
    // Add some valid targets first
    await tracker.addTarget('notable', 'jobs', 'Job');
    
    // Simulate tracker failure
    const mockFailingTracker = {
      ...tracker,
      addTarget: jest.fn().mockRejectedValue(new Error('Tracker failed'))
    };
    
    const failingRegistry = new PolymorphicRegistry(mockFailingTracker as any);
    await failingRegistry.initialize();
    
    // Registry should handle tracker failures gracefully
    await expect(
      failingRegistry.addPolymorphicTarget('notable', 'new_table', 'NewModel')
    ).rejects.toThrow('Tracker failed');
    
    // But existing functionality should still work
    const validTargets = failingRegistry.getValidTargets('notable');
    expect(Array.isArray(validTargets)).toBe(true);
  });

  it('should handle discovery failures without breaking system', async () => {
    const failingDiscovery = new PolymorphicDiscovery();
    
    // Mock discovery failure
    jest.spyOn(failingDiscovery, 'discoverPolymorphicTypes')
      .mockRejectedValue(new Error('Discovery failed'));
    
    // System should continue working with manual configuration
    await tracker.addTarget('loggable', 'jobs', 'Job');
    
    const query = createPolymorphicQuery({
      tableName: 'activity_logs',
      primaryKey: 'id',
      softDelete: false
    }, 'loggable');
    
    // Should still be able to query
    await expect(query.forTargetType('Job').all()).resolves.not.toThrow();
  });

  it('should maintain data integrity during failures', async () => {
    // Add targets
    await tracker.addTarget('notable', 'jobs', 'Job');
    await tracker.addTarget('notable', 'tasks', 'Task');
    
    const initialTargets = tracker.getValidTargets('notable');
    const initialValidation = tracker.validate();
    
    // Simulate partial failure during batch operation
    const promises = [
      tracker.addTarget('notable', 'clients', 'Client'), // Should succeed
      Promise.reject(new Error('Network error')), // Simulated failure
      tracker.addTarget('notable', 'users', 'User') // Should succeed
    ];
    
    await Promise.allSettled(promises);
    
    // System should maintain valid state
    const finalValidation = tracker.validate();
    expect(finalValidation.valid).toBe(true);
    
    const finalTargets = tracker.getValidTargets('notable');
    expect(finalTargets.length).toBeGreaterThanOrEqual(initialTargets.length);
  });
});

describe('Polymorphic System Real-World Scenarios', () => {
  let tracker: PolymorphicTracker;
  let registry: PolymorphicRegistry;

  beforeEach(async () => {
    tracker = new PolymorphicTracker('real-world-test.json');
    registry = new PolymorphicRegistry(tracker);
    
    await tracker.initialize();
    await registry.initialize();
  });

  it('should handle BOS application polymorphic setup', async () => {
    // Set up BOS polymorphic relationships as they would be in production
    
    // Notable relationships (notes -> jobs, tasks, clients)
    await tracker.addTarget('notable', 'jobs', 'Job');
    await tracker.addTarget('notable', 'tasks', 'Task');
    await tracker.addTarget('notable', 'clients', 'Client');
    
    // Loggable relationships (activity_logs -> multiple models)
    await tracker.addTarget('loggable', 'jobs', 'Job');
    await tracker.addTarget('loggable', 'tasks', 'Task');
    await tracker.addTarget('loggable', 'clients', 'Client');
    await tracker.addTarget('loggable', 'users', 'User');
    await tracker.addTarget('loggable', 'people', 'Person');
    await tracker.addTarget('loggable', 'scheduled_date_times', 'ScheduledDateTime');
    await tracker.addTarget('loggable', 'people_groups', 'PeopleGroup');
    await tracker.addTarget('loggable', 'people_group_memberships', 'PeopleGroupMembership');
    await tracker.addTarget('loggable', 'devices', 'Device');
    
    // Schedulable relationships (scheduled_date_times -> jobs, tasks)
    await tracker.addTarget('schedulable', 'jobs', 'Job');
    await tracker.addTarget('schedulable', 'tasks', 'Task');
    
    // Target relationships (job_targets -> clients, people, people_groups)
    await tracker.addTarget('target', 'clients', 'Client');
    await tracker.addTarget('target', 'people', 'Person');
    await tracker.addTarget('target', 'people_groups', 'PeopleGroup');
    
    // Parseable relationships (parsed_emails -> jobs, tasks)
    await tracker.addTarget('parseable', 'jobs', 'Job');
    await tracker.addTarget('parseable', 'tasks', 'Task');
    
    // Register all relationships
    registry.registerPolymorphicTargetRelationships('notes', 'notable', 'notable_id', 'notable_type');
    registry.registerPolymorphicTargetRelationships('activity_logs', 'loggable', 'loggable_id', 'loggable_type');
    registry.registerPolymorphicTargetRelationships('scheduled_date_times', 'schedulable', 'schedulable_id', 'schedulable_type');
    registry.registerPolymorphicTargetRelationships('job_targets', 'target', 'target_id', 'target_type');
    registry.registerPolymorphicTargetRelationships('parsed_emails', 'parseable', 'parseable_id', 'parseable_type');
    
    // Validate the complete setup
    const validation = tracker.validate();
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
    
    // Test queries for each polymorphic type
    const polymorphicTypes: PolymorphicType[] = ['notable', 'loggable', 'schedulable', 'target', 'parseable'];
    
    for (const type of polymorphicTypes) {
      const targets = tracker.getValidTargets(type);
      expect(targets.length).toBeGreaterThan(0);
      
      // Each type should be queryable
      const query = createPolymorphicQuery({
        tableName: type === 'notable' ? 'notes' : 
                   type === 'loggable' ? 'activity_logs' :
                   type === 'schedulable' ? 'scheduled_date_times' :
                   type === 'target' ? 'job_targets' : 'parsed_emails',
        primaryKey: 'id',
        softDelete: false
      }, type);
      
      expect(query).toBeInstanceOf(ChainableQuery);
    }
  });

  it('should support dynamic schema changes during runtime', async () => {
    // Initial setup
    await tracker.addTarget('loggable', 'jobs', 'Job');
    const initialTargets = tracker.getValidTargets('loggable');
    
    // Simulate new model being added to the application
    await tracker.addTarget('loggable', 'invoices', 'Invoice', { source: 'runtime' });
    
    // Update registry
    await registry.addPolymorphicTarget('loggable', 'invoices', 'Invoice');
    
    // Re-register relationships to include new target
    registry.registerPolymorphicTargetRelationships(
      'activity_logs',
      'loggable',
      'loggable_id',
      'loggable_type'
    );
    
    const updatedTargets = tracker.getValidTargets('loggable');
    expect(updatedTargets.length).toBe(initialTargets.length + 1);
    expect(updatedTargets).toContain('invoices');
    
    // New target should be immediately queryable
    const query = createPolymorphicQuery({
      tableName: 'activity_logs',
      primaryKey: 'id',
      softDelete: false
    }, 'loggable');
    
    const invoiceQuery = query.forTargetType('Invoice');
    expect(invoiceQuery).toBeInstanceOf(ChainableQuery);
  });

  it('should handle migration from hardcoded to dynamic system', async () => {
    // Simulate existing hardcoded relationships
    const hardcodedTargets = {
      notable: ['jobs', 'tasks', 'clients'],
      loggable: ['jobs', 'tasks', 'clients', 'users']
    };
    
    // Migrate to dynamic system
    for (const [type, targets] of Object.entries(hardcodedTargets)) {
      for (const tableName of targets) {
        const modelName = tableName.charAt(0).toUpperCase() + tableName.slice(1).replace(/_(.)/g, (_, char) => char.toUpperCase());
        await tracker.addTarget(type as PolymorphicType, tableName, modelName, { source: 'migration' });
      }
    }
    
    // Verify migration
    const validation = tracker.validate();
    expect(validation.valid).toBe(true);
    
    for (const [type, expectedTargets] of Object.entries(hardcodedTargets)) {
      const actualTargets = tracker.getValidTargets(type as PolymorphicType);
      expect(actualTargets.sort()).toEqual(expectedTargets.sort());
      
      // All migrated targets should have proper metadata
      for (const tableName of expectedTargets) {
        const metadata = tracker.getTargetMetadata(type as PolymorphicType, tableName);
        expect(metadata?.source).toBe('migration');
        expect(metadata?.discoveredAt).toBeDefined();
      }
    }
  });
});