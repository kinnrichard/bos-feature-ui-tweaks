# Migration Guide: From Hardcoded to Dynamic Polymorphic Relationships

## Overview

This guide provides step-by-step instructions for migrating from hardcoded polymorphic relationships to the dynamic polymorphic tracking system in the BOS frontend application.

## Table of Contents

- [Before You Begin](#before-you-begin)
- [Phase 1: System Setup](#phase-1-system-setup)
- [Phase 2: Configuration Discovery](#phase-2-configuration-discovery)
- [Phase 3: Schema Migration](#phase-3-schema-migration)
- [Phase 4: Model Updates](#phase-4-model-updates)
- [Phase 5: Testing & Validation](#phase-5-testing--validation)
- [Rollback Strategy](#rollback-strategy)
- [Troubleshooting](#troubleshooting)

## Before You Begin

### Prerequisites

- Understanding of polymorphic relationships in Rails/Zero.js
- Familiarity with the existing BOS schema structure
- Access to the development environment
- Backup of current schema and model files

### Current State Analysis

Before migration, understand your current polymorphic relationships:

```typescript
// Example: Current hardcoded relationships in generated-schema.ts
const activity_logsRelationships = relationships(activity_logs, ({ one }) => ({
  // Regular relationships
  user: one({
    sourceField: ['user_id'],
    destField: ['id'],
    destSchema: users,
  }),
  
  // Hardcoded polymorphic relationships
  loggableJob: one({
    sourceField: ['loggable_id'],
    destField: ['id'],
    destSchema: jobs,
  }),
  loggableTask: one({
    sourceField: ['loggable_id'],
    destField: ['id'],
    destSchema: tasks,
  }),
  loggableClient: one({
    sourceField: ['loggable_id'],
    destField: ['id'],
    destSchema: clients,
  }),
  loggablePerson: one({
    sourceField: ['loggable_id'],
    destField: ['id'],
    destSchema: people,
  }),
  // ... more hardcoded relationships
}));
```

### Identified Polymorphic Types

The system has identified these polymorphic relationships in the BOS codebase:

1. **notable** - Notes belong to jobs, tasks, clients
   - Fields: `notable_id`, `notable_type`
   - Current targets: jobs, tasks, clients

2. **loggable** - Activity logs track changes to multiple models  
   - Fields: `loggable_id`, `loggable_type`
   - Current targets: jobs, tasks, clients, users, people, scheduled_date_times, people_groups, people_group_memberships, devices

3. **schedulable** - Scheduled date times belong to jobs, tasks
   - Fields: `schedulable_id`, `schedulable_type`
   - Current targets: jobs, tasks

4. **target** - Job targets reference clients, people, people groups
   - Fields: `target_id`, `target_type`
   - Current targets: clients, people, people_groups

5. **parseable** - Parsed emails belong to jobs, tasks
   - Fields: `parseable_id`, `parseable_type`
   - Current targets: jobs, tasks

## Phase 1: System Setup

### Step 1.1: Install the Polymorphic System

The polymorphic system is already integrated into the codebase at `src/lib/zero/polymorphic/`.

### Step 1.2: Initialize the System

Add system initialization to your app startup:

```typescript
// src/lib/zero/index.ts or app initialization file
import { initializePolymorphicSystem } from './polymorphic';

export async function initializeZeroWithPolymorphic() {
  // Existing Zero.js initialization
  // ...
  
  // Initialize polymorphic system
  await initializePolymorphicSystem();
  
  console.log('✅ Zero.js with polymorphic tracking initialized');
}
```

### Step 1.3: Verify Installation

Create a test script to verify the system works:

```typescript
// test-polymorphic-setup.ts
import { 
  getPolymorphicTracker,
  validatePolymorphicSystem 
} from '@/lib/zero/polymorphic';

async function testSetup() {
  try {
    // Test tracker access
    const tracker = getPolymorphicTracker();
    console.log('✅ Tracker accessible');
    
    // Test system health
    const health = await validatePolymorphicSystem();
    if (health.healthy) {
      console.log('✅ System healthy');
    } else {
      console.error('❌ System issues:', health.errors);
    }
    
    // Test basic functionality
    const validTargets = tracker.getValidTargets('loggable');
    console.log('✅ Valid loggable targets:', validTargets);
    
  } catch (error) {
    console.error('❌ Setup test failed:', error);
  }
}

testSetup();
```

## Phase 2: Configuration Discovery

### Step 2.1: Run Auto-Discovery

Discover existing polymorphic patterns from your hardcoded schema:

```typescript
// scripts/discover-polymorphic.ts
import { 
  autoDiscoverAndConfigure,
  getPolymorphicSystemSummary 
} from '@/lib/zero/polymorphic';

async function discoverExistingPatterns() {
  console.log('🔍 Starting auto-discovery...');
  
  try {
    // Run discovery
    await autoDiscoverAndConfigure({
      autoDiscover: true,
      source: 'migration-discovery',
      validateTargets: true
    });
    
    // Get summary
    const summary = await getPolymorphicSystemSummary();
    console.log('📊 Discovery Summary:');
    console.log(`  - Associations: ${summary.associations}`);
    console.log(`  - Total targets: ${summary.targets}`);
    console.log(`  - Active targets: ${summary.activeTargets}`);
    
    console.log('✅ Auto-discovery completed');
    
  } catch (error) {
    console.error('❌ Discovery failed:', error);
  }
}

discoverExistingPatterns();
```

### Step 2.2: Review Discovered Configuration

Check what was discovered:

```typescript
// scripts/review-discovery.ts
import { 
  getPolymorphicTracker,
  discoverPolymorphicRelationships 
} from '@/lib/zero/polymorphic';

async function reviewDiscovery() {
  const tracker = getPolymorphicTracker();
  const config = tracker.getConfig();
  
  if (!config) {
    console.error('❌ No configuration found');
    return;
  }
  
  console.log('📋 Discovered Polymorphic Types:');
  
  Object.entries(config.associations).forEach(([type, association]) => {
    console.log(`\n🔗 ${type}:`);
    console.log(`   Description: ${association.description}`);
    console.log(`   Targets: ${Object.keys(association.validTargets).join(', ')}`);
    
    Object.entries(association.validTargets).forEach(([target, metadata]) => {
      console.log(`   - ${target}: ${metadata.modelName} (${metadata.source})`);
    });
  });
  
  // Get detailed discovery results
  const discoveryResults = await discoverPolymorphicRelationships();
  console.log(`\n📈 Discovery Statistics:`);
  console.log(`   - Total patterns found: ${discoveryResults.length}`);
  
  discoveryResults.forEach(result => {
    console.log(`   - ${result.type}: ${result.targets.length} targets (confidence: ${result.metadata.confidence})`);
  });
}

reviewDiscovery();
```

### Step 2.3: Validate Configuration

Ensure the discovered configuration is correct:

```typescript
// scripts/validate-discovery.ts
import { getPolymorphicTracker } from '@/lib/zero/polymorphic';

async function validateDiscoveredConfig() {
  const tracker = getPolymorphicTracker();
  const validationResult = tracker.validate();
  
  console.log('🔍 Configuration Validation:');
  console.log(`   Status: ${validationResult.valid ? '✅ Valid' : '❌ Invalid'}`);
  console.log(`   Checks: ${validationResult.metadata.passedChecks}/${validationResult.metadata.totalChecked} passed`);
  
  if (validationResult.errors.length > 0) {
    console.log('\n❌ Validation Errors:');
    validationResult.errors.forEach(error => {
      console.log(`   - ${error.type}: ${error.message}`);
    });
  }
  
  if (validationResult.warnings.length > 0) {
    console.log('\n⚠️  Validation Warnings:');
    validationResult.warnings.forEach(warning => {
      console.log(`   - ${warning.type}: ${warning.message}`);
    });
  }
  
  return validationResult.valid;
}

validateDiscoveredConfig();
```

## Phase 3: Schema Migration

### Step 3.1: Create Migration Script

Create a script to migrate your Zero.js schema:

```typescript
// scripts/migrate-schema.ts
import { IntegrationUtils } from '@/lib/zero/polymorphic';
import fs from 'fs';
import path from 'path';

async function migrateSchema() {
  console.log('🔄 Starting schema migration...');
  
  // Read current schema file
  const schemaPath = path.join(process.cwd(), 'src/lib/zero/generated-schema.ts');
  const currentSchema = fs.readFileSync(schemaPath, 'utf-8');
  
  // Backup current schema
  const backupPath = path.join(process.cwd(), 'src/lib/zero/generated-schema.backup.ts');
  fs.writeFileSync(backupPath, currentSchema);
  console.log(`✅ Schema backed up to: ${backupPath}`);
  
  // Generate new relationships for each polymorphic type
  const polymorphicTypes = ['notable', 'loggable', 'schedulable', 'target', 'parseable'];
  const replacements: Record<string, string> = {};
  
  for (const type of polymorphicTypes) {
    const relationships = IntegrationUtils.generateZeroJsRelationships(type, getTableForType(type));
    replacements[type] = generateReplacementCode(type, relationships);
  }
  
  // Apply replacements to schema
  let newSchema = currentSchema;
  Object.entries(replacements).forEach(([type, replacement]) => {
    newSchema = applySchemaReplacement(newSchema, type, replacement);
  });
  
  // Write new schema
  fs.writeFileSync(schemaPath, newSchema);
  console.log('✅ Schema migration completed');
  
  return { backupPath, replacements };
}

function getTableForType(type: string): string {
  const tableMap = {
    'notable': 'notes',
    'loggable': 'activity_logs', 
    'schedulable': 'scheduled_date_times',
    'target': 'job_targets',
    'parseable': 'parsed_emails'
  };
  return tableMap[type] || 'unknown';
}

function generateReplacementCode(type: string, relationships: any): string {
  return `
  // Dynamic ${type} relationships (generated by polymorphic system)
  ...IntegrationUtils.generateZeroJsRelationships('${type}', '${getTableForType(type)}')`;
}

function applySchemaReplacement(schema: string, type: string, replacement: string): string {
  // Find and replace hardcoded relationships for this type
  // This is a simplified version - you may need more sophisticated regex
  const pattern = new RegExp(`// ${type} relationships[\\s\\S]*?(?=\\n\\s*//|\\n\\s*\\}|$)`, 'g');
  return schema.replace(pattern, replacement);
}

migrateSchema();
```

### Step 3.2: Test Schema Changes

Create tests to ensure the migration worked:

```typescript
// tests/schema-migration.test.ts
import { describe, it, expect } from 'vitest';
import { IntegrationUtils } from '@/lib/zero/polymorphic';

describe('Schema Migration', () => {
  it('should generate correct loggable relationships', () => {
    const relationships = IntegrationUtils.generateZeroJsRelationships('loggable', 'activity_logs');
    
    expect(relationships).toHaveProperty('loggableJob');
    expect(relationships).toHaveProperty('loggableTask');
    expect(relationships).toHaveProperty('loggableClient');
    
    // Verify relationship structure
    expect(relationships.loggableJob).toEqual({
      sourceField: ['loggable_id'],
      destField: ['id'],
      destSchema: expect.any(Object)
    });
  });
  
  it('should handle all polymorphic types', () => {
    const types = ['notable', 'loggable', 'schedulable', 'target', 'parseable'];
    
    types.forEach(type => {
      const tableName = getTableForType(type);
      const relationships = IntegrationUtils.generateZeroJsRelationships(type, tableName);
      expect(Object.keys(relationships).length).toBeGreaterThan(0);
    });
  });
});
```

### Step 3.3: Incremental Migration

For safer migration, consider migrating one polymorphic type at a time:

```typescript
// scripts/incremental-migrate.ts
async function migratePolymorphicType(type: string) {
  console.log(`🔄 Migrating ${type} relationships...`);
  
  try {
    // Generate relationships for this type only
    const tableName = getTableForType(type);
    const relationships = IntegrationUtils.generateZeroJsRelationships(type, tableName);
    
    console.log(`✅ Generated ${Object.keys(relationships).length} relationships for ${type}`);
    
    // Update schema for this type only
    await updateSchemaForType(type, relationships);
    
    // Test the changes
    await testPolymorphicType(type);
    
    console.log(`✅ ${type} migration completed`);
    
  } catch (error) {
    console.error(`❌ Failed to migrate ${type}:`, error);
    throw error;
  }
}

// Migrate one type at a time
async function incrementalMigration() {
  const types = ['notable', 'loggable', 'schedulable', 'target', 'parseable'];
  
  for (const type of types) {
    console.log(`\n--- Migrating ${type} ---`);
    await migratePolymorphicType(type);
    
    // Wait for confirmation before proceeding
    const proceed = await askForConfirmation(`Continue with next type?`);
    if (!proceed) {
      console.log('Migration paused');
      break;
    }
  }
}

incrementalMigration();
```

## Phase 4: Model Updates

### Step 4.1: Update Model Registrations

Update your model files to use the polymorphic system:

```typescript
// src/lib/models/activity-log.ts - BEFORE
import { registerModelRelationships } from '@/lib/zero';

registerModelRelationships('activity_logs', {
  user: { type: 'belongsTo', model: 'User' },
  // Hardcoded polymorphic relationships removed
  // loggableJob: { type: 'belongsTo', model: 'Job' },
  // loggableTask: { type: 'belongsTo', model: 'Task' },
  // ... many more hardcoded relationships
});
```

```typescript
// src/lib/models/activity-log.ts - AFTER
import { registerModelRelationshipsWithPolymorphic } from '@/lib/zero/polymorphic';

registerModelRelationshipsWithPolymorphic('activity_logs', {
  user: { type: 'belongsTo', model: 'User' },
  loggable: {
    type: 'belongsTo',
    model: 'Polymorphic',
    polymorphic: true,
    polymorphicType: 'loggable',
    polymorphicIdField: 'loggable_id',
    polymorphicTypeField: 'loggable_type'
  }
});
```

### Step 4.2: Update Model Classes

Add polymorphic helpers to model classes:

```typescript
// src/lib/models/activity-log.ts
import { createPolymorphicIncludes } from '@/lib/zero/polymorphic';

export class ActivityLog extends ActiveRecord {
  // ... existing model code ...
  
  // Add polymorphic helpers
  static get polymorphicHelpers() {
    return createPolymorphicIncludes('activity_logs');
  }
  
  // Helper method to get loggable targets
  static getLoggableTypes() {
    return this.polymorphicHelpers.getPolymorphicTypes('loggable');
  }
  
  // Helper method to check valid loggable type
  static isValidLoggableType(type: string) {
    return this.polymorphicHelpers.isValidPolymorphicRelationship('loggable', type);
  }
  
  // Get the actual loggable object
  async getLoggableObject() {
    const type = this.loggable_type?.toLowerCase();
    if (!type || !this.loggable_id) return null;
    
    const relationshipName = this.constructor.polymorphicHelpers
      .includePolymorphicBelongsTo('loggable', type);
    
    return this[relationshipName];
  }
}
```

### Step 4.3: Update Queries and Includes

Update code that uses polymorphic relationships:

```typescript
// BEFORE: Hardcoded includes
const activityLogs = await ActivityLog
  .includes('loggableJob', 'loggableTask', 'loggableClient', 'loggableUser', 'loggablePerson')
  .where({ user_id: userId })
  .all();

// AFTER: Dynamic includes using polymorphic system
import { createLoggableQuery } from '@/lib/zero/polymorphic';

const activityLogs = await createLoggableQuery({
  conditions: { user_id: userId },
  eagerLoad: ['user'], // Non-polymorphic relationships
  targetTypes: ['jobs', 'tasks', 'clients', 'users', 'people'] // Polymorphic targets
}).execute();
```

Or using the traditional approach with dynamic includes:

```typescript
// AFTER: Using polymorphic helpers
const helpers = ActivityLog.polymorphicHelpers;
const loggableTypes = helpers.getPolymorphicTypes('loggable');
const includeRelationships = loggableTypes.map(type => 
  helpers.includePolymorphicBelongsTo('loggable', type)
);

const activityLogs = await ActivityLog
  .includes(...includeRelationships, 'user')
  .where({ user_id: userId })
  .all();
```

## Phase 5: Testing & Validation

### Step 5.1: Create Migration Tests

```typescript
// tests/migration-validation.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { 
  getPolymorphicTracker,
  validatePolymorphicSystem,
  createLoggableQuery 
} from '@/lib/zero/polymorphic';

describe('Migration Validation', () => {
  beforeAll(async () => {
    await initializePolymorphicSystem();
  });
  
  it('should have healthy polymorphic system', async () => {
    const health = await validatePolymorphicSystem();
    expect(health.healthy).toBe(true);
    expect(health.errors).toHaveLength(0);
  });
  
  it('should maintain all polymorphic types', () => {
    const tracker = getPolymorphicTracker();
    
    expect(tracker.isValidTarget('loggable', 'jobs')).toBe(true);
    expect(tracker.isValidTarget('loggable', 'tasks')).toBe(true);
    expect(tracker.isValidTarget('loggable', 'clients')).toBe(true);
    expect(tracker.isValidTarget('notable', 'jobs')).toBe(true);
    expect(tracker.isValidTarget('notable', 'tasks')).toBe(true);
  });
  
  it('should generate correct relationship names', () => {
    const helpers = createPolymorphicIncludes('activity_logs');
    
    const jobRelationship = helpers.includePolymorphicBelongsTo('loggable', 'jobs');
    expect(jobRelationship).toBe('loggableJob');
    
    const taskRelationship = helpers.includePolymorphicBelongsTo('loggable', 'tasks');
    expect(taskRelationship).toBe('loggableTask');
  });
});
```

### Step 5.2: Test Existing Functionality

Ensure existing features still work:

```typescript
// tests/existing-functionality.test.ts
import { describe, it, expect } from 'vitest';

describe('Existing Functionality', () => {
  it('should load activity logs with polymorphic relationships', async () => {
    const query = createLoggableQuery({
      targetTypes: ['jobs', 'tasks'],
      limit: 10
    });
    
    const results = await query.execute();
    
    expect(results.data).toBeDefined();
    expect(results.metadata.total).toBeGreaterThanOrEqual(0);
    expect(results.metadata.targetCounts).toBeDefined();
  });
  
  it('should handle notes with notable relationships', async () => {
    const query = createNotableQuery({
      targetTypes: ['jobs', 'clients'],
      conditions: { active: true }
    });
    
    const results = await query.execute();
    
    expect(results.data).toBeDefined();
    // Test that relationships are properly loaded
  });
});
```

### Step 5.3: Performance Testing

Compare performance before and after migration:

```typescript
// tests/performance-comparison.test.ts
import { describe, it, expect } from 'vitest';

describe('Performance Comparison', () => {
  it('should not significantly impact query performance', async () => {
    const start = performance.now();
    
    const results = await createLoggableQuery({
      targetTypes: ['jobs', 'tasks', 'clients'],
      limit: 100
    }).execute();
    
    const end = performance.now();
    const executionTime = end - start;
    
    expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    expect(results.metadata.executionTime).toBeDefined();
  });
  
  it('should benefit from caching', async () => {
    // First query (cache miss)
    const start1 = performance.now();
    const results1 = await executeCachedQuery('loggable', {
      targetTypes: ['jobs'],
      cacheKey: 'perf-test'
    });
    const time1 = performance.now() - start1;
    
    // Second query (cache hit)
    const start2 = performance.now();
    const results2 = await executeCachedQuery('loggable', {
      targetTypes: ['jobs'],
      cacheKey: 'perf-test'
    });
    const time2 = performance.now() - start2;
    
    expect(results2.metadata.fromCache).toBe(true);
    expect(time2).toBeLessThan(time1); // Should be faster due to caching
  });
});
```

## Rollback Strategy

### Automatic Rollback

```typescript
// scripts/rollback-migration.ts
import fs from 'fs';
import path from 'path';

async function rollbackMigration() {
  console.log('🔄 Rolling back migration...');
  
  try {
    // Restore schema backup
    const schemaPath = path.join(process.cwd(), 'src/lib/zero/generated-schema.ts');
    const backupPath = path.join(process.cwd(), 'src/lib/zero/generated-schema.backup.ts');
    
    if (fs.existsSync(backupPath)) {
      const backupContent = fs.readFileSync(backupPath, 'utf-8');
      fs.writeFileSync(schemaPath, backupContent);
      console.log('✅ Schema restored from backup');
    } else {
      console.error('❌ No backup file found');
      return false;
    }
    
    // Restore model files if needed
    await restoreModelFiles();
    
    console.log('✅ Migration rollback completed');
    return true;
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    return false;
  }
}

async function restoreModelFiles() {
  // Implement restoration of model files if you made changes
  console.log('📁 Restoring model files...');
  // ... restoration logic
}

rollbackMigration();
```

### Manual Rollback Steps

If automatic rollback fails:

1. **Restore Schema**: Copy `generated-schema.backup.ts` back to `generated-schema.ts`
2. **Revert Model Changes**: Restore hardcoded relationship registrations
3. **Remove Polymorphic Imports**: Remove polymorphic system imports
4. **Clear Cache**: Clear any cached polymorphic configuration
5. **Restart Application**: Restart to clear in-memory state

## Troubleshooting

### Common Issues

#### Issue: "PolymorphicTracker not initialized"

**Solution**: Ensure system initialization in app startup:

```typescript
import { initializePolymorphicSystem } from '@/lib/zero/polymorphic';

// Add to app initialization
await initializePolymorphicSystem();
```

#### Issue: "Invalid polymorphic target"

**Solution**: Check configuration and add missing targets:

```typescript
const tracker = getPolymorphicTracker();
await tracker.addTarget('loggable', 'missing_table', 'MissingModel', {
  source: 'manual'
});
```

#### Issue: "Relationship not found"

**Solution**: Verify relationship name generation:

```typescript
import { createPolymorphicIncludes } from '@/lib/zero/polymorphic';

const helpers = createPolymorphicIncludes('activity_logs');
const relationshipName = helpers.includePolymorphicBelongsTo('loggable', 'jobs');
console.log('Expected relationship name:', relationshipName);
```

#### Issue: Performance degradation

**Solution**: Enable caching and optimize queries:

```typescript
import { executeCachedQuery, warmPolymorphicCache } from '@/lib/zero/polymorphic';

// Warm cache for common queries
await warmPolymorphicCache([
  { type: 'loggable', targetTypes: ['jobs', 'tasks'] }
]);

// Use cached queries
const results = await executeCachedQuery('loggable', {
  targetTypes: ['jobs'],
  cacheKey: 'common-jobs-query',
  ttl: 300
});
```

### Debug Information

Enable debug logging for troubleshooting:

```typescript
import { polymorphicDebugLogger } from '@/lib/zero/polymorphic';

// Enable debug logging
polymorphicDebugLogger.enabled = true;

// This will now log debug information
const tracker = getPolymorphicTracker();
await tracker.loadConfig(); // Debug logs will show what's happening
```

### Validation Scripts

Run validation scripts to identify issues:

```typescript
// scripts/diagnose-issues.ts
import { 
  validatePolymorphicSystem,
  getPolymorphicSystemSummary,
  getPolymorphicTracker 
} from '@/lib/zero/polymorphic';

async function diagnoseIssues() {
  console.log('🔍 Diagnosing polymorphic system...');
  
  // Check system health
  const health = await validatePolymorphicSystem();
  console.log('System Health:', health.healthy ? '✅' : '❌');
  
  if (!health.healthy) {
    console.log('Errors:', health.errors);
    console.log('Warnings:', health.warnings);
  }
  
  // Check configuration
  const tracker = getPolymorphicTracker();
  const config = tracker.getConfig();
  
  if (!config) {
    console.log('❌ No configuration loaded');
  } else {
    const summary = await getPolymorphicSystemSummary();
    console.log('Configuration Summary:', summary);
  }
  
  // Test each polymorphic type
  const types = ['notable', 'loggable', 'schedulable', 'target', 'parseable'];
  
  for (const type of types) {
    try {
      const targets = tracker.getValidTargets(type);
      console.log(`✅ ${type}: ${targets.length} targets`);
    } catch (error) {
      console.log(`❌ ${type}: Error getting targets -`, error.message);
    }
  }
}

diagnoseIssues();
```

## Post-Migration Checklist

- [ ] All polymorphic types are properly configured
- [ ] Schema migration completed successfully
- [ ] Model registrations updated
- [ ] Existing functionality tested and working
- [ ] Performance meets expectations
- [ ] Debug logging disabled in production
- [ ] Backup files archived
- [ ] Documentation updated
- [ ] Team trained on new system

## Next Steps

After successful migration:

1. **Monitor Performance**: Keep an eye on query performance and cache hit rates
2. **Add New Targets**: Use the system to easily add new polymorphic targets
3. **Optimize Queries**: Use advanced query features like reactive queries
4. **Extend System**: Consider additional polymorphic types as your schema evolves

## Support

For additional help with migration:

1. Check the [API documentation](./API.md)
2. Review [configuration examples](./CONFIGURATION.md)
3. Run diagnostic scripts provided in this guide
4. Enable debug logging for detailed troubleshooting information