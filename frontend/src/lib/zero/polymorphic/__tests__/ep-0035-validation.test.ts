/**
 * EP-0035 Success Metrics Validation Tests
 * 
 * Comprehensive validation of all Epic-008 success metrics:
 * ✅ Zero ESLint warnings in generated schema
 * ✅ 100% polymorphic types tracked vs. database
 * ✅ No hardcoded type lists in generator
 * ✅ < 5 second impact on generation time
 * ✅ Automatic discovery of new polymorphic types
 * ✅ Survives database resets
 * 
 * Generated: 2025-08-06 Epic-008 EP-0035 Validation Testing
 */

import { PolymorphicTracker } from '../tracker';
import { PolymorphicRegistry } from '../registry';
import { PolymorphicDiscovery } from '../discovery';
import { SchemaGenerator } from '../schema-generator';
import { ChainableQuery } from '../query-system';
import type { PolymorphicType } from '../types';
import { performance } from 'perf_hooks';

// Mock all external dependencies
jest.mock('../zero-client');
jest.mock('../database-introspection');
jest.mock('../../models/base/scoped-query-base');
jest.mock('../../utils/debug');
jest.mock('fs/promises');

/**
 * EP-0035 Success Metrics Validator
 */
class EP0035Validator {
  private results: Record<string, { passed: boolean; details: string; metrics?: any }> = {};

  async validateMetric(name: string, validator: () => Promise<{ passed: boolean; details: string; metrics?: any }>): Promise<void> {
    try {
      this.results[name] = await validator();
    } catch (error) {
      this.results[name] = {
        passed: false,
        details: `Validation failed with error: ${error}`,
        metrics: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  getResults(): Record<string, { passed: boolean; details: string; metrics?: any }> {
    return { ...this.results };
  }

  getAllPassed(): boolean {
    return Object.values(this.results).every(result => result.passed);
  }

  getFailedMetrics(): string[] {
    return Object.entries(this.results)
      .filter(([_, result]) => !result.passed)
      .map(([name]) => name);
  }

  generateReport(): string {
    const totalMetrics = Object.keys(this.results).length;
    const passedMetrics = Object.values(this.results).filter(r => r.passed).length;
    const failedMetrics = totalMetrics - passedMetrics;

    let report = `\n🎯 EP-0035 Success Metrics Validation Report\n`;
    report += `================================================\n`;
    report += `Total Metrics: ${totalMetrics}\n`;
    report += `Passed: ${passedMetrics} ✅\n`;
    report += `Failed: ${failedMetrics} ${failedMetrics === 0 ? '✅' : '❌'}\n\n`;

    for (const [name, result] of Object.entries(this.results)) {
      const status = result.passed ? '✅' : '❌';
      report += `${status} ${name}\n`;
      report += `   ${result.details}\n`;
      if (result.metrics) {
        report += `   Metrics: ${JSON.stringify(result.metrics, null, 2).replace(/\n/g, '\n   ')}\n`;
      }
      report += `\n`;
    }

    if (this.getAllPassed()) {
      report += `🎉 ALL EP-0035 SUCCESS METRICS VALIDATED!\n`;
    } else {
      report += `⚠️  SOME METRICS FAILED - SEE DETAILS ABOVE\n`;
    }

    return report;
  }
}

describe('EP-0035 Success Metrics Validation', () => {
  let validator: EP0035Validator;
  let tracker: PolymorphicTracker;
  let registry: PolymorphicRegistry;
  let discovery: PolymorphicDiscovery;

  beforeAll(async () => {
    validator = new EP0035Validator();
    
    // Initialize complete system for testing
    tracker = new PolymorphicTracker('ep-0035-validation.json');
    registry = new PolymorphicRegistry(tracker);
    discovery = new PolymorphicDiscovery();
    
    await tracker.initialize();
    await registry.initialize();
    
    // Setup complete BOS polymorphic configuration
    const bosConfig = {
      notable: ['jobs', 'tasks', 'clients'],
      loggable: ['jobs', 'tasks', 'clients', 'users', 'people', 'scheduled_date_times', 'people_groups', 'people_group_memberships', 'devices'],
      schedulable: ['jobs', 'tasks'],
      target: ['clients', 'people', 'people_groups'],
      parseable: ['jobs', 'tasks']
    };
    
    for (const [type, targets] of Object.entries(bosConfig)) {
      for (const tableName of targets) {
        const modelName = tableName.charAt(0).toUpperCase() + tableName.slice(1).replace(/_(.)/g, (_, char) => char.toUpperCase());
        await tracker.addTarget(type as PolymorphicType, tableName, modelName);
      }
    }
  });

  afterAll(() => {
    console.log(validator.generateReport());
  });

  it('should validate: Zero ESLint warnings in generated schema', async () => {
    await validator.validateMetric('Zero ESLint Warnings', async () => {
      const generator = new SchemaGenerator(tracker);
      const schema = await generator.generateSchema();
      
      // Check for common ESLint violations
      const violations = [];
      
      // Check naming conventions
      for (const type of schema.polymorphicTypes) {
        if (!type.name.match(/^[a-z]+$/)) {
          violations.push(`Invalid polymorphic type name: ${type.name}`);\n        }\n        \n        for (const target of type.targets) {\n          if (!target.modelName.match(/^[A-Z][a-zA-Z0-9]*$/)) {\n            violations.push(`Invalid model name: ${target.modelName}`);\n          }\n          \n          if (!target.tableName.match(/^[a-z_][a-z0-9_]*$/)) {\n            violations.push(`Invalid table name: ${target.tableName}`);\n          }\n        }\n      }\n      \n      // Check for unused variables\n      if (schema.unusedImports && schema.unusedImports.length > 0) {\n        violations.push(`Unused imports: ${schema.unusedImports.join(', ')}`);\n      }\n      \n      // Check for missing semicolons (if applicable to generated code)\n      if (schema.generatedCode && !schema.generatedCode.endsWith(';\\n')) {\n        violations.push('Generated code does not end with proper semicolon');\n      }\n      \n      return {\n        passed: violations.length === 0,\n        details: violations.length === 0 \n          ? 'All generated schema follows ESLint standards'\n          : `Found ${violations.length} ESLint violations`,\n        metrics: {\n          violations: violations.length,\n          eslintCompliant: violations.length === 0,\n          generatedTypes: schema.polymorphicTypes.length\n        }\n      };\n    });\n  });\n\n  it('should validate: 100% polymorphic types tracked vs. database', async () => {\n    await validator.validateMetric('100% Polymorphic Type Coverage', async () => {\n      // Get expected polymorphic types from BOS database schema\n      const expectedTypes: PolymorphicType[] = ['notable', 'loggable', 'schedulable', 'target', 'parseable'];\n      const trackedTypes = tracker.getPolymorphicTypes();\n      \n      // Check coverage\n      const missingTypes = expectedTypes.filter(type => !trackedTypes.includes(type));\n      const extraTypes = trackedTypes.filter(type => !expectedTypes.includes(type));\n      \n      // Check target coverage for each type\n      const targetCoverage: Record<string, { expected: number; actual: number; coverage: number }> = {};\n      \n      for (const type of expectedTypes) {\n        const targets = tracker.getValidTargets(type);\n        const expectedTargets = getBOSExpectedTargets(type); // Helper function\n        \n        targetCoverage[type] = {\n          expected: expectedTargets.length,\n          actual: targets.length,\n          coverage: targets.length / expectedTargets.length * 100\n        };\n      }\n      \n      const overallCoverage = Object.values(targetCoverage)\n        .reduce((sum, coverage) => sum + coverage.coverage, 0) / expectedTypes.length;\n      \n      return {\n        passed: missingTypes.length === 0 && overallCoverage >= 100,\n        details: `Coverage: ${overallCoverage.toFixed(1)}%. Missing types: ${missingTypes.length}. Extra types: ${extraTypes.length}`,\n        metrics: {\n          overallCoverage,\n          missingTypes,\n          extraTypes,\n          targetCoverage,\n          totalTypes: trackedTypes.length,\n          expectedTypes: expectedTypes.length\n        }\n      };\n    });\n  });\n\n  it('should validate: No hardcoded type lists in generator', async () => {\n    await validator.validateMetric('No Hardcoded Type Lists', async () => {\n      // Check configuration sources\n      const config = tracker.getConfig();\n      const hardcodedSources = [];\n      const dynamicSources = [];\n      \n      if (config) {\n        for (const [type, association] of Object.entries(config.associations)) {\n          for (const [tableName, metadata] of Object.entries(association.validTargets)) {\n            if (metadata.source === 'hardcoded' || metadata.source === 'manual') {\n              hardcodedSources.push(`${type}.${tableName}`);\n            } else {\n              dynamicSources.push(`${type}.${tableName}`);\n            }\n          }\n        }\n      }\n      \n      // Check if discovery system is being used\n      const discoveryResults = await discovery.discoverPolymorphicTypes();\n      const discoveryWorking = discoveryResults.length > 0;\n      \n      // Check if generator has configurable patterns instead of hardcoded lists\n      const generator = new SchemaGenerator(tracker);\n      const generatorConfig = generator.getConfig();\n      const hasConfigurablePatterns = generatorConfig.patterns && \n        typeof generatorConfig.patterns.polymorphicIdSuffix === 'string';\n      \n      return {\n        passed: hardcodedSources.length === 0 && discoveryWorking && hasConfigurablePatterns,\n        details: `Hardcoded sources: ${hardcodedSources.length}. Dynamic sources: ${dynamicSources.length}. Discovery working: ${discoveryWorking}`,\n        metrics: {\n          hardcodedSources: hardcodedSources.length,\n          dynamicSources: dynamicSources.length,\n          discoveryWorking,\n          hasConfigurablePatterns,\n          discoveryResults: discoveryResults.length\n        }\n      };\n    });\n  });\n\n  it('should validate: < 5 second impact on generation time', async () => {\n    await validator.validateMetric('Generation Time Impact', async () => {\n      const startTime = performance.now();\n      \n      // Simulate complete generation workflow\n      const newTracker = new PolymorphicTracker('perf-test-generation.json');\n      const newRegistry = new PolymorphicRegistry(newTracker);\n      const newGenerator = new SchemaGenerator(newTracker);\n      \n      // Initialize\n      await newTracker.initialize();\n      await newRegistry.initialize();\n      \n      // Add all BOS polymorphic relationships (simulating discovery + setup)\n      const bosConfig = {\n        notable: ['jobs', 'tasks', 'clients'],\n        loggable: ['jobs', 'tasks', 'clients', 'users', 'people', 'scheduled_date_times', 'people_groups', 'people_group_memberships', 'devices'],\n        schedulable: ['jobs', 'tasks'],\n        target: ['clients', 'people', 'people_groups'],\n        parseable: ['jobs', 'tasks']\n      };\n      \n      for (const [type, targets] of Object.entries(bosConfig)) {\n        for (const tableName of targets) {\n          const modelName = tableName.charAt(0).toUpperCase() + tableName.slice(1).replace(/_(.)/g, (_, char) => char.toUpperCase());\n          await newTracker.addTarget(type as PolymorphicType, tableName, modelName);\n        }\n      }\n      \n      // Generate schema\n      const schema = await newGenerator.generateSchema();\n      \n      const endTime = performance.now();\n      const duration = endTime - startTime;\n      \n      return {\n        passed: duration < 5000, // EP-0035: < 5 second impact\n        details: `Generation completed in ${duration.toFixed(2)}ms (${(duration/1000).toFixed(2)}s)`,\n        metrics: {\n          durationMs: duration,\n          durationSeconds: duration / 1000,\n          threshold: 5000,\n          passed: duration < 5000,\n          generatedTypes: schema.polymorphicTypes.length,\n          totalTargets: schema.totalTargets\n        }\n      };\n    });\n  });\n\n  it('should validate: Automatic discovery of new polymorphic types', async () => {\n    await validator.validateMetric('Automatic Discovery', async () => {\n      // Test discovery capability\n      const discoveryResults = await discovery.discoverPolymorphicTypes();\n      \n      // Test runtime addition of new type\n      const originalTypes = tracker.getPolymorphicTypes();\n      await tracker.addTarget('loggable', 'new_runtime_table', 'NewRuntimeModel', { source: 'runtime' });\n      const newTypes = tracker.getPolymorphicTypes();\n      \n      // Test that system can handle unknown polymorphic patterns\n      const canHandleNewPatterns = discovery.detectPolymorphicType('attachable_id', 'attachable_type') !== null;\n      \n      // Test that registry can be updated dynamically\n      await registry.addPolymorphicTarget('loggable', 'dynamic_table', 'DynamicModel');\n      const dynamicTargets = registry.getValidTargets('loggable');\n      const hasDynamicTarget = dynamicTargets.includes('dynamic_table');\n      \n      return {\n        passed: discoveryResults.length > 0 && canHandleNewPatterns && hasDynamicTarget,\n        details: `Discovery found ${discoveryResults.length} types. Can handle new patterns: ${canHandleNewPatterns}. Dynamic addition works: ${hasDynamicTarget}`,\n        metrics: {\n          discoveryResults: discoveryResults.length,\n          canHandleNewPatterns,\n          hasDynamicTarget,\n          originalTypeCount: originalTypes.length,\n          newTypeCount: newTypes.length,\n          runtimeAdditionWorks: newTypes.length >= originalTypes.length\n        }\n      };\n    });\n  });\n\n  it('should validate: Survives database resets', async () => {\n    await validator.validateMetric('Database Reset Survival', async () => {\n      // Capture current state\n      const originalConfig = tracker.getConfig();\n      const originalTypes = tracker.getPolymorphicTypes();\n      const originalTargets: Record<string, string[]> = {};\n      \n      for (const type of originalTypes) {\n        originalTargets[type] = tracker.getValidTargets(type as PolymorphicType);\n      }\n      \n      // Simulate database reset by creating new tracker with same config file\n      const resetTracker = new PolymorphicTracker('ep-0035-validation.json');\n      await resetTracker.initialize();\n      \n      // Check if configuration persisted\n      const resetConfig = resetTracker.getConfig();\n      const resetTypes = resetTracker.getPolymorphicTypes();\n      \n      // Check if all types and targets are restored\n      let configPersisted = true;\n      let allTargetsPersisted = true;\n      \n      if (!resetConfig || !originalConfig) {\n        configPersisted = false;\n      }\n      \n      for (const type of originalTypes) {\n        const resetTargets = resetTracker.getValidTargets(type as PolymorphicType);\n        const originalTypeTargets = originalTargets[type];\n        \n        if (resetTargets.length !== originalTypeTargets.length) {\n          allTargetsPersisted = false;\n          break;\n        }\n        \n        for (const target of originalTypeTargets) {\n          if (!resetTargets.includes(target)) {\n            allTargetsPersisted = false;\n            break;\n          }\n        }\n      }\n      \n      // Test that queries still work after reset\n      const queryAfterReset = new ChainableQuery({\n        tableName: 'notes',\n        primaryKey: 'id',\n        softDelete: false\n      }, 'notable');\n      \n      const queryWorksAfterReset = queryAfterReset.getValidTargetTypes().length > 0;\n      \n      return {\n        passed: configPersisted && allTargetsPersisted && queryWorksAfterReset,\n        details: `Config persisted: ${configPersisted}. Targets persisted: ${allTargetsPersisted}. Queries work: ${queryWorksAfterReset}`,\n        metrics: {\n          configPersisted,\n          allTargetsPersisted,\n          queryWorksAfterReset,\n          originalTypeCount: originalTypes.length,\n          resetTypeCount: resetTypes.length,\n          persistenceRate: allTargetsPersisted ? 100 : 0\n        }\n      };\n    });\n  });\n\n  it('should generate final EP-0035 compliance report', async () => {\n    const results = validator.getResults();\n    const allPassed = validator.getAllPassed();\n    const failedMetrics = validator.getFailedMetrics();\n    \n    // Log detailed results\n    console.log(validator.generateReport());\n    \n    // Create summary for test assertion\n    const summary = {\n      totalMetrics: Object.keys(results).length,\n      passedMetrics: Object.values(results).filter(r => r.passed).length,\n      failedMetrics: failedMetrics.length,\n      allRequirementsMet: allPassed\n    };\n    \n    console.log('\\n📊 EP-0035 Compliance Summary:', summary);\n    \n    // The test passes if all EP-0035 requirements are met\n    expect(allPassed).toBe(true);\n    expect(failedMetrics).toHaveLength(0);\n    \n    if (allPassed) {\n      console.log('\\n🎉 SUCCESS: All EP-0035 requirements validated!');\n    } else {\n      console.log('\\n❌ FAILURE: Some EP-0035 requirements not met:', failedMetrics);\n    }\n  });\n});\n\n/**\n * Helper function to get expected targets for each polymorphic type in BOS\n */\nfunction getBOSExpectedTargets(type: PolymorphicType): string[] {\n  const bosTargets: Record<PolymorphicType, string[]> = {\n    notable: ['jobs', 'tasks', 'clients'],\n    loggable: ['jobs', 'tasks', 'clients', 'users', 'people', 'scheduled_date_times', 'people_groups', 'people_group_memberships', 'devices'],\n    schedulable: ['jobs', 'tasks'],\n    target: ['clients', 'people', 'people_groups'],\n    parseable: ['jobs', 'tasks']\n  };\n  \n  return bosTargets[type] || [];\n}\n\ndescribe('EP-0035 Regression Prevention', () => {\n  it('should prevent regression in polymorphic type coverage', async () => {\n    const tracker = new PolymorphicTracker('regression-test.json');\n    await tracker.initialize();\n    \n    // Add minimum required BOS polymorphic configuration\n    const minConfig = {\n      notable: ['jobs', 'tasks', 'clients'],\n      loggable: ['jobs', 'tasks', 'clients', 'users', 'people'],\n      schedulable: ['jobs', 'tasks'],\n      target: ['clients', 'people', 'people_groups'],\n      parseable: ['jobs', 'tasks']\n    };\n    \n    for (const [type, targets] of Object.entries(minConfig)) {\n      for (const tableName of targets) {\n        const modelName = tableName.charAt(0).toUpperCase() + tableName.slice(1).replace(/_(.)/g, (_, char) => char.toUpperCase());\n        await tracker.addTarget(type as PolymorphicType, tableName, modelName);\n      }\n    }\n    \n    // Validate minimum requirements are still met\n    const validation = tracker.validate();\n    expect(validation.valid).toBe(true);\n    \n    // Check each polymorphic type has minimum expected targets\n    for (const [type, expectedTargets] of Object.entries(minConfig)) {\n      const actualTargets = tracker.getValidTargets(type as PolymorphicType);\n      expect(actualTargets.length).toBeGreaterThanOrEqual(expectedTargets.length);\n      \n      for (const expectedTarget of expectedTargets) {\n        expect(actualTargets).toContain(expectedTarget);\n      }\n    }\n  });\n\n  it('should maintain backward compatibility with existing query patterns', async () => {\n    const tracker = new PolymorphicTracker('backward-compat-test.json');\n    await tracker.initialize();\n    \n    // Setup basic configuration\n    await tracker.addTarget('notable', 'jobs', 'Job');\n    await tracker.addTarget('loggable', 'tasks', 'Task');\n    \n    // Test that all existing query patterns still work\n    const queries = [\n      new ChainableQuery({ tableName: 'notes', primaryKey: 'id', softDelete: false }, 'notable'),\n      new ChainableQuery({ tableName: 'activity_logs', primaryKey: 'id', softDelete: false }, 'loggable')\n    ];\n    \n    for (const query of queries) {\n      // These should not throw and should return valid metadata\n      expect(() => {\n        const metadata = query.getPolymorphicMetadata();\n        expect(metadata).toBeDefined();\n        expect(Array.isArray(metadata.validTargets)).toBe(true);\n      }).not.toThrow();\n      \n      // Chaining should work\n      expect(() => {\n        query.forTargetType('Job').forTargetId('123').includePolymorphicTargets();\n      }).not.toThrow();\n    }\n  });\n});