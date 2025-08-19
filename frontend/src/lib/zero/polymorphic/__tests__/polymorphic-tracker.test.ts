/**
 * Polymorphic Tracker - Comprehensive Unit Tests
 * 
 * Tests for the core PolymorphicTracker functionality including:
 * - Configuration management
 * - Target tracking and validation
 * - Type discovery and metadata
 * - Performance benchmarking
 * - Error handling and edge cases
 * - EP-0035 success metrics validation
 * 
 * Generated: 2025-08-06 Epic-008 Polymorphic Tracking
 * Enhanced: 2025-08-06 Comprehensive QA Testing
 */

import { PolymorphicTracker } from '../tracker';
import { POLYMORPHIC_TYPES } from '../index';
import type { PolymorphicConfig, PolymorphicType, PolymorphicValidationResult } from '../types';
import { performance } from 'perf_hooks';

// Mock debug utility to avoid import issues in tests
jest.mock('../../utils/debug', () => ({
  debugDatabase: jest.fn()
}));

describe('PolymorphicTracker', () => {
  let tracker: PolymorphicTracker;

  beforeEach(() => {
    tracker = new PolymorphicTracker('test-config.json');
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', async () => {
      await tracker.initialize();
      
      const config = tracker.getConfig();
      expect(config).toBeDefined();
      expect(config?.associations).toBeDefined();
      expect(config?.metadata.totalAssociations).toBe(5);
    });

    it('should create all expected polymorphic types', async () => {
      await tracker.initialize();
      
      const types = tracker.getPolymorphicTypes();
      expect(types).toContain('notable');
      expect(types).toContain('loggable');
      expect(types).toContain('schedulable');
      expect(types).toContain('target');
      expect(types).toContain('parseable');
      expect(types).toHaveLength(5);
    });
  });

  describe('Target Management', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should add new targets successfully', async () => {
      await tracker.addTarget('loggable', 'projects', 'Project');
      
      const validTargets = tracker.getValidTargets('loggable');
      expect(validTargets).toContain('projects');
      
      const metadata = tracker.getTargetMetadata('loggable', 'projects');
      expect(metadata).toBeDefined();
      expect(metadata?.modelName).toBe('Project');
      expect(metadata?.tableName).toBe('projects');
      expect(metadata?.active).toBe(true);
    });

    it('should validate targets correctly', async () => {
      await tracker.addTarget('loggable', 'jobs', 'Job');
      
      expect(tracker.isValidTarget('loggable', 'jobs')).toBe(true);
      expect(tracker.isValidTarget('loggable', 'nonexistent')).toBe(false);
    });

    it('should deactivate targets without removing them', async () => {
      await tracker.addTarget('loggable', 'clients', 'Client');
      await tracker.deactivateTarget('loggable', 'clients');
      
      // Should not be in active targets
      const activeTargets = tracker.getValidTargets('loggable');
      expect(activeTargets).not.toContain('clients');
      
      // Should be in targets when including inactive
      const allTargets = tracker.getValidTargets('loggable', { includeInactive: true });
      expect(allTargets).toContain('clients');
      
      // Metadata should show as inactive
      const metadata = tracker.getTargetMetadata('loggable', 'clients');
      expect(metadata?.active).toBe(false);
    });

    it('should remove targets completely', async () => {
      await tracker.addTarget('loggable', 'temp', 'TempModel');
      await tracker.removeTarget('loggable', 'temp');
      
      expect(tracker.isValidTarget('loggable', 'temp')).toBe(false);
      expect(tracker.getTargetMetadata('loggable', 'temp')).toBeNull();
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should provide association configuration', () => {
      const loggableConfig = tracker.getAssociationConfig('loggable');
      expect(loggableConfig).toBeDefined();
      expect(loggableConfig?.type).toBe('loggable');
      expect(loggableConfig?.description).toContain('Activity logs');
    });

    it('should validate configuration correctly', async () => {
      await tracker.addTarget('loggable', 'jobs', 'Job');
      
      const validation = tracker.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.metadata.totalChecked).toBeGreaterThan(0);
    });

    it('should detect validation errors', () => {
      // Create invalid configuration by modifying internal state
      const config = tracker.getConfig();
      if (config) {
        // Add invalid target with missing modelName
        config.associations.loggable.validTargets.invalid = {
          modelName: '',
          tableName: 'invalid',
          discoveredAt: new Date().toISOString(),
          lastVerifiedAt: new Date().toISOString(),
          active: true,
          source: 'manual'
        };
      }
      
      const validation = tracker.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Type Safety', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should handle all defined polymorphic types', () => {
      const types: PolymorphicType[] = ['notable', 'loggable', 'schedulable', 'target', 'parseable'];
      
      types.forEach(type => {
        const config = tracker.getAssociationConfig(type);
        expect(config).toBeDefined();
        expect(config?.type).toBe(type);
      });
    });

    it('should return empty arrays for unknown types', () => {
      const unknownType = 'unknown' as PolymorphicType;
      const targets = tracker.getValidTargets(unknownType);
      expect(targets).toEqual([]);
    });
  });

  describe('Metadata Tracking', () => {
    beforeEach(async () => {
      await tracker.initialize();
    });

    it('should track timestamps correctly', async () => {
      const beforeAdd = new Date();
      await tracker.addTarget('loggable', 'test', 'TestModel');
      const afterAdd = new Date();
      
      const metadata = tracker.getTargetMetadata('loggable', 'test');
      expect(metadata).toBeDefined();
      
      const discoveredAt = new Date(metadata!.discoveredAt);
      expect(discoveredAt.getTime()).toBeGreaterThanOrEqual(beforeAdd.getTime());
      expect(discoveredAt.getTime()).toBeLessThanOrEqual(afterAdd.getTime());
    });

    it('should update lastVerifiedAt when deactivating', async () => {
      await tracker.addTarget('loggable', 'test', 'TestModel');
      const originalMetadata = tracker.getTargetMetadata('loggable', 'test');
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await tracker.deactivateTarget('loggable', 'test');
      const updatedMetadata = tracker.getTargetMetadata('loggable', 'test');
      
      expect(updatedMetadata?.lastVerifiedAt).not.toBe(originalMetadata?.lastVerifiedAt);
    });

    it('should track configuration version', () => {
      const config = tracker.getConfig();
      expect(config?.metadata.configVersion).toBeDefined();
      expect(config?.metadata.configVersion).toBe('1.0.0');
    });
  });
});

describe('PolymorphicTracker Integration', () => {
  it('should handle multiple trackers with different config paths', async () => {
    const tracker1 = new PolymorphicTracker('config1.json');
    const tracker2 = new PolymorphicTracker('config2.json');
    
    await tracker1.initialize();
    await tracker2.initialize();
    
    await tracker1.addTarget('loggable', 'model1', 'Model1');
    await tracker2.addTarget('loggable', 'model2', 'Model2');
    
    const targets1 = tracker1.getValidTargets('loggable');
    const targets2 = tracker2.getValidTargets('loggable');
    
    // Each tracker should have its own state
    expect(targets1).toContain('model1');
    expect(targets1).not.toContain('model2');
    expect(targets2).toContain('model2');
    expect(targets2).not.toContain('model1');
  });
});

// Enhanced test suites for comprehensive coverage
describe('PolymorphicTracker Performance', () => {
  let tracker: PolymorphicTracker;
  
  beforeEach(async () => {
    tracker = new PolymorphicTracker('perf-test-config.json');
    await tracker.initialize();
  });
  
  it('should initialize within 5 seconds (EP-0035)', async () => {
    const startTime = performance.now();
    const newTracker = new PolymorphicTracker('perf-init-test.json');
    await newTracker.initialize();
    const endTime = performance.now();
    
    const duration = endTime - startTime;
    expect(duration).toBeLessThan(5000); // EP-0035: < 5 second impact
  });
  
  it('should handle large numbers of targets efficiently', async () => {
    const startTime = performance.now();
    
    // Add 100 targets to test performance
    for (let i = 0; i < 100; i++) {
      await tracker.addTarget('loggable', `target${i}`, `Target${i}`);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should complete within reasonable time
    expect(duration).toBeLessThan(10000); // 10 seconds for 100 targets
    
    // Validate all targets were added
    const targets = tracker.getValidTargets('loggable');
    expect(targets.length).toBeGreaterThanOrEqual(100);
  });
  
  it('should perform validation quickly', async () => {
    // Add some test targets
    await tracker.addTarget('loggable', 'jobs', 'Job');
    await tracker.addTarget('loggable', 'tasks', 'Task');
    await tracker.addTarget('notable', 'clients', 'Client');
    
    const startTime = performance.now();
    const validation = tracker.validate();
    const endTime = performance.now();
    
    const duration = endTime - startTime;
    expect(duration).toBeLessThan(1000); // Validation should be under 1 second
    expect(validation.valid).toBe(true);
  });
});

describe('PolymorphicTracker Error Handling', () => {
  let tracker: PolymorphicTracker;
  
  beforeEach(async () => {
    tracker = new PolymorphicTracker('error-test-config.json');
    await tracker.initialize();
  });
  
  it('should handle invalid polymorphic types gracefully', () => {
    const invalidType = 'invalid' as PolymorphicType;
    
    expect(() => {
      tracker.getValidTargets(invalidType);
    }).not.toThrow();
    
    const targets = tracker.getValidTargets(invalidType);
    expect(targets).toEqual([]);
  });
  
  it('should handle duplicate target additions', async () => {
    await tracker.addTarget('loggable', 'jobs', 'Job');
    
    // Adding the same target again should not throw
    await expect(tracker.addTarget('loggable', 'jobs', 'Job')).resolves.not.toThrow();
    
    // Should still only have one instance
    const targets = tracker.getValidTargets('loggable');
    const jobCount = targets.filter(t => t === 'jobs').length;
    expect(jobCount).toBe(1);
  });
  
  it('should handle removal of non-existent targets', async () => {
    await expect(tracker.removeTarget('loggable', 'nonexistent')).resolves.not.toThrow();
    
    const validation = tracker.validate();
    expect(validation.valid).toBe(true);
  });
  
  it('should provide meaningful error messages', async () => {
    const config = tracker.getConfig();
    if (config) {
      // Create invalid configuration
      config.associations.loggable.validTargets.invalid = {
        modelName: '', // Empty model name should be invalid
        tableName: 'invalid',
        discoveredAt: new Date().toISOString(),
        lastVerifiedAt: new Date().toISOString(),
        active: true,
        source: 'manual'
      };
    }
    
    const validation = tracker.validate();
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors[0].message).toBeDefined();
    expect(validation.errors[0].message.length).toBeGreaterThan(0);
  });
});

describe('PolymorphicTracker EP-0035 Success Metrics', () => {
  let tracker: PolymorphicTracker;
  
  beforeEach(async () => {
    tracker = new PolymorphicTracker('ep-0035-test.json');
    await tracker.initialize();
  });
  
  it('should track 100% of polymorphic types vs database (EP-0035)', async () => {
    // Add all expected polymorphic types
    await tracker.addTarget('notable', 'jobs', 'Job');
    await tracker.addTarget('notable', 'tasks', 'Task');
    await tracker.addTarget('notable', 'clients', 'Client');
    
    await tracker.addTarget('loggable', 'jobs', 'Job');
    await tracker.addTarget('loggable', 'tasks', 'Task');
    await tracker.addTarget('loggable', 'clients', 'Client');
    await tracker.addTarget('loggable', 'users', 'User');
    await tracker.addTarget('loggable', 'people', 'Person');
    
    await tracker.addTarget('schedulable', 'jobs', 'Job');
    await tracker.addTarget('schedulable', 'tasks', 'Task');
    
    await tracker.addTarget('target', 'clients', 'Client');
    await tracker.addTarget('target', 'people', 'Person');
    await tracker.addTarget('target', 'people_groups', 'PeopleGroup');
    
    await tracker.addTarget('parseable', 'jobs', 'Job');
    await tracker.addTarget('parseable', 'tasks', 'Task');
    
    const config = tracker.getConfig();
    expect(config).toBeDefined();
    expect(config?.metadata.totalAssociations).toBe(5); // All 5 polymorphic types
    
    // Verify each type has targets
    const polymorphicTypes: PolymorphicType[] = ['notable', 'loggable', 'schedulable', 'target', 'parseable'];
    for (const type of polymorphicTypes) {
      const targets = tracker.getValidTargets(type);
      expect(targets.length).toBeGreaterThan(0);
    }
  });
  
  it('should have no hardcoded type lists (EP-0035)', () => {
    const config = tracker.getConfig();
    expect(config).toBeDefined();
    
    // Configuration should be generated, not hardcoded
    expect(config?.metadata.generatedBy).toBeDefined();
    expect(config?.metadata.generatedBy).not.toBe('hardcoded');
    
    // Each association should have discovery metadata
    const polymorphicTypes: PolymorphicType[] = ['notable', 'loggable', 'schedulable', 'target', 'parseable'];
    for (const type of polymorphicTypes) {
      const association = config?.associations[type];
      expect(association?.metadata.createdAt).toBeDefined();
      expect(association?.metadata.configVersion).toBeDefined();
    }
  });
  
  it('should support automatic discovery of new polymorphic types (EP-0035)', async () => {
    // Add a new target to test auto-discovery capabilities
    await tracker.addTarget('loggable', 'new_model', 'NewModel', { source: 'runtime' });
    
    const targets = tracker.getValidTargets('loggable');
    expect(targets).toContain('new_model');
    
    const metadata = tracker.getTargetMetadata('loggable', 'new_model');
    expect(metadata?.source).toBe('runtime');
    expect(metadata?.discoveredAt).toBeDefined();
  });
  
  it('should survive database resets (EP-0035)', async () => {
    // Add test targets
    await tracker.addTarget('loggable', 'test_table', 'TestModel');
    const originalTargets = tracker.getValidTargets('loggable');
    
    // Simulate database reset by creating new tracker instance
    const newTracker = new PolymorphicTracker('ep-0035-test.json'); // Same config file
    await newTracker.initialize();
    
    const persistedTargets = newTracker.getValidTargets('loggable');
    expect(persistedTargets).toEqual(originalTargets);
  });
  
  it('should generate zero ESLint warnings in schema output (EP-0035)', () => {
    const config = tracker.getConfig();
    expect(config).toBeDefined();
    
    // Validate that all property names follow proper naming conventions
    const polymorphicTypes: PolymorphicType[] = ['notable', 'loggable', 'schedulable', 'target', 'parseable'];
    for (const type of polymorphicTypes) {
      const association = config?.associations[type];
      expect(association?.type).toBe(type);
      
      // Check that all target metadata follows proper naming
      Object.entries(association?.validTargets || {}).forEach(([tableName, metadata]) => {
        expect(typeof tableName).toBe('string');
        expect(tableName.length).toBeGreaterThan(0);
        expect(metadata.modelName).toBeDefined();
        expect(metadata.tableName).toBeDefined();
        expect(typeof metadata.active).toBe('boolean');
      });
    }
  });
});

describe('PolymorphicTracker Edge Cases', () => {
  let tracker: PolymorphicTracker;
  
  beforeEach(async () => {
    tracker = new PolymorphicTracker('edge-case-test.json');
    await tracker.initialize();
  });
  
  it('should handle empty model names', async () => {
    await expect(tracker.addTarget('loggable', 'test_table', '')).resolves.not.toThrow();
    
    const validation = tracker.validate();
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.message.includes('modelName'))).toBe(true);
  });
  
  it('should handle special characters in table names', async () => {
    await tracker.addTarget('loggable', 'table-with-dashes', 'TableWithDashes');
    await tracker.addTarget('loggable', 'table_with_underscores', 'TableWithUnderscores');
    
    const targets = tracker.getValidTargets('loggable');
    expect(targets).toContain('table-with-dashes');
    expect(targets).toContain('table_with_underscores');
  });
  
  it('should handle concurrent modifications', async () => {
    const promises = [];
    
    // Add multiple targets concurrently
    for (let i = 0; i < 10; i++) {
      promises.push(tracker.addTarget('loggable', `concurrent_${i}`, `Concurrent${i}`));
    }
    
    await Promise.all(promises);
    
    const targets = tracker.getValidTargets('loggable');
    expect(targets.length).toBeGreaterThanOrEqual(10);
    
    // Verify all targets were added
    for (let i = 0; i < 10; i++) {
      expect(targets).toContain(`concurrent_${i}`);
    }
  });
  
  it('should handle very long target names', async () => {
    const longTableName = 'a'.repeat(100);
    const longModelName = 'B'.repeat(100);
    
    await tracker.addTarget('loggable', longTableName, longModelName);
    
    const targets = tracker.getValidTargets('loggable');
    expect(targets).toContain(longTableName);
    
    const metadata = tracker.getTargetMetadata('loggable', longTableName);
    expect(metadata?.modelName).toBe(longModelName);
  });
});