# Troubleshooting Guide

## Overview

This guide provides solutions to common issues encountered when using the Polymorphic Tracking System. It includes diagnostic steps, error explanations, and resolution strategies.

## Table of Contents

- [Common Issues](#common-issues)
- [System Initialization Problems](#system-initialization-problems)
- [Configuration Issues](#configuration-issues)
- [Query Problems](#query-problems)
- [Performance Issues](#performance-issues)
- [Integration Problems](#integration-problems)
- [Development Issues](#development-issues)
- [Diagnostic Tools](#diagnostic-tools)

## Common Issues

### Issue: "PolymorphicTracker not initialized"

**Error Message:**
```
Error: PolymorphicTracker not initialized. Call initializePolymorphicSystem() first.
```

**Cause:** The polymorphic system hasn't been initialized before attempting to use it.

**Solution:**
1. Ensure system initialization in your app startup:

```typescript
// src/app.ts or main initialization file
import { initializePolymorphicSystem } from '@/lib/zero/polymorphic';

async function initializeApp() {
  try {
    await initializePolymorphicSystem();
    console.log('✅ Polymorphic system initialized');
  } catch (error) {
    console.error('❌ Failed to initialize polymorphic system:', error);
    throw error;
  }
}

// Call before using any polymorphic features
await initializeApp();
```

2. If using in tests, initialize in test setup:

```typescript
// test-setup.ts
import { beforeAll } from 'vitest';
import { initializePolymorphicSystem } from '@/lib/zero/polymorphic';

beforeAll(async () => {
  await initializePolymorphicSystem();
});
```

**Prevention:** Always call `initializePolymorphicSystem()` early in your application lifecycle.

---

### Issue: "Invalid polymorphic type"

**Error Message:**
```
Error: Invalid polymorphic type: 'unknown_type'. Valid types are: notable, loggable, schedulable, target, parseable
```

**Cause:** Attempting to use a polymorphic type that doesn't exist in the configuration.

**Solution:**
1. Check available types:

```typescript
import { getPolymorphicTracker } from '@/lib/zero/polymorphic';

const tracker = getPolymorphicTracker();
const config = tracker.getConfig();

if (config) {
  console.log('Available types:', Object.keys(config.associations));
} else {
  console.log('No configuration loaded');
}
```

2. Add the missing type to your configuration:

```typescript
await tracker.addTarget('new_type' as any, 'target_table', 'TargetModel', {
  source: 'manual'
});
```

3. Or use an existing valid type:

```typescript
// Instead of 'unknown_type', use:
const query = createLoggableQuery({ targetTypes: ['jobs'] });
```

**Prevention:** Use the `POLYMORPHIC_TYPES` constants and validate types before use.

---

### Issue: "Target not found for polymorphic type"

**Error Message:**
```
Error: Target 'projects' not found for polymorphic type 'loggable'
```

**Cause:** Attempting to query a target that isn't configured for the specified polymorphic type.

**Solution:**
1. Check valid targets for the type:

```typescript
const tracker = getPolymorphicTracker();
const validTargets = tracker.getValidTargets('loggable');
console.log('Valid loggable targets:', validTargets);
```

2. Add the missing target:

```typescript
await tracker.addTarget('loggable', 'projects', 'Project', {
  source: 'manual',
  description: 'Projects can be logged'
});
```

3. Use only valid targets in queries:

```typescript
// Check before using
if (tracker.isValidTarget('loggable', 'projects')) {
  const query = createLoggableQuery({ targetTypes: ['projects'] });
} else {
  console.warn('Projects cannot be used as loggable targets');
}
```

**Prevention:** Always validate targets before using them in queries.

---

### Issue: "Relationship not found"

**Error Message:**
```
Error: Relationship 'loggableProject' not found in schema
```

**Cause:** The polymorphic relationships haven't been properly registered with the schema system.

**Solution:**
1. Ensure model relationships are registered:

```typescript
import { registerModelRelationshipsWithPolymorphic } from '@/lib/zero/polymorphic';

// Register polymorphic relationships for activity_logs
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

2. Check relationship name generation:

```typescript
import { createPolymorphicIncludes } from '@/lib/zero/polymorphic';

const helpers = createPolymorphicIncludes('activity_logs');
const relationshipName = helpers.includePolymorphicBelongsTo('loggable', 'projects');
console.log('Expected relationship name:', relationshipName);
```

3. Update your schema to include dynamic relationships:

```typescript
// In generated-schema.ts
import { IntegrationUtils } from '@/lib/zero/polymorphic';

const activity_logsRelationships = relationships(activity_logs, ({ one }) => ({
  user: one({
    sourceField: ['user_id'],
    destField: ['id'],
    destSchema: users,
  }),
  // Add dynamic polymorphic relationships
  ...IntegrationUtils.generateZeroJsRelationships('loggable', 'activity_logs')
}));
```

**Prevention:** Complete the schema migration as outlined in the [Migration Guide](./MIGRATION_GUIDE.md).

## System Initialization Problems

### Issue: System fails to initialize

**Error Message:**
```
Error: Failed to initialize polymorphic system: Configuration validation failed
```

**Diagnosis Steps:**

1. **Check configuration validation:**

```typescript
import { validatePolymorphicSystem } from '@/lib/zero/polymorphic';

async function diagnoseInitialization() {
  try {
    const health = await validatePolymorphicSystem();
    if (!health.healthy) {
      console.error('Validation errors:', health.errors);
      console.warn('Validation warnings:', health.warnings);
    }
  } catch (error) {
    console.error('Initialization failed:', error);
  }
}

diagnoseInitialization();
```

2. **Check for configuration file issues:**

```typescript
import { getPolymorphicTracker } from '@/lib/zero/polymorphic';

async function checkConfig() {
  const tracker = getPolymorphicTracker();
  
  try {
    await tracker.loadConfig();
    console.log('✅ Configuration loaded successfully');
  } catch (error) {
    console.error('❌ Configuration load failed:', error);
    
    // Try auto-discovery as fallback
    try {
      await autoDiscoverAndConfigure({ autoDiscover: true });
      console.log('✅ Auto-discovery completed');
    } catch (discoveryError) {
      console.error('❌ Auto-discovery failed:', discoveryError);
    }
  }
}
```

3. **Check dependencies:**

```typescript
// Verify Zero.js is properly initialized
import { zero } from '@/lib/zero';

if (!zero) {
  console.error('Zero.js not initialized - initialize Zero.js before polymorphic system');
}
```

**Common Solutions:**

- **Invalid configuration file:** Remove or fix the configuration file and let the system auto-discover
- **Missing dependencies:** Ensure Zero.js and other dependencies are initialized first
- **Permission issues:** Check file permissions for configuration files

---

### Issue: Auto-discovery fails

**Error Message:**
```
Error: Auto-discovery failed: Cannot read schema file
```

**Diagnosis Steps:**

1. **Check schema file access:**

```typescript
import fs from 'fs';
import path from 'path';

const schemaPath = path.join(process.cwd(), 'src/lib/zero/generated-schema.ts');

try {
  if (fs.existsSync(schemaPath)) {
    console.log('✅ Schema file exists');
    const content = fs.readFileSync(schemaPath, 'utf-8');
    console.log(`Schema file size: ${content.length} characters`);
  } else {
    console.error('❌ Schema file not found at:', schemaPath);
  }
} catch (error) {
  console.error('❌ Cannot access schema file:', error.message);
}
```

2. **Manual discovery test:**

```typescript
import { discoverPolymorphicRelationships } from '@/lib/zero/polymorphic';

async function testDiscovery() {
  try {
    const results = await discoverPolymorphicRelationships();
    console.log(`✅ Discovered ${results.length} polymorphic patterns`);
    results.forEach(result => {
      console.log(`  - ${result.type}: ${result.targets.length} targets`);
    });
  } catch (error) {
    console.error('❌ Discovery failed:', error);
  }
}
```

**Common Solutions:**

- **Schema file missing:** Ensure `generated-schema.ts` exists and is properly generated
- **Malformed schema:** Check for syntax errors in the schema file
- **Access permissions:** Verify read permissions for the schema file

## Configuration Issues

### Issue: Configuration validation errors

**Error Message:**
```
Configuration validation failed: Missing required field 'validTargets' in association 'loggable'
```

**Diagnosis:**

```typescript
import { getPolymorphicTracker, PolymorphicValidator } from '@/lib/zero/polymorphic';

function diagnoseConfig() {
  const tracker = getPolymorphicTracker();
  const config = tracker.getConfig();
  
  if (!config) {
    console.error('❌ No configuration loaded');
    return;
  }

  const validator = new PolymorphicValidator();
  const result = validator.validateConfig(config);
  
  console.log('Configuration validation results:');
  console.log(`Valid: ${result.valid}`);
  console.log(`Errors: ${result.errors.length}`);
  console.log(`Warnings: ${result.warnings.length}`);
  
  result.errors.forEach(error => {
    console.error(`❌ ${error.type}: ${error.message}`);
  });
  
  result.warnings.forEach(warning => {
    console.warn(`⚠️ ${warning.type}: ${warning.message}`);
  });
}
```

**Common Fixes:**

1. **Missing validTargets:** Ensure each association has at least one valid target:

```typescript
const config = tracker.getConfig();
if (config) {
  Object.entries(config.associations).forEach(([type, association]) => {
    if (!association.validTargets || Object.keys(association.validTargets).length === 0) {
      console.error(`❌ Association '${type}' has no valid targets`);
      // Add a valid target
      tracker.addTarget(type as any, 'default_table', 'DefaultModel', {
        source: 'manual'
      });
    }
  });
}
```

2. **Invalid metadata:** Fix metadata format:

```typescript
const config = tracker.getConfig();
if (config && !config.metadata.configVersion) {
  config.metadata.configVersion = '1.0.0';
  config.metadata.updatedAt = new Date().toISOString();
  await tracker.saveConfig();
}
```

---

### Issue: Configuration merge conflicts

**Error Message:**
```
Error: Configuration merge conflict: Duplicate target 'jobs' for type 'loggable'
```

**Solution:**

```typescript
import { ConfigUtils } from '@/lib/zero/polymorphic';

async function resolveConfigConflict() {
  const tracker = getPolymorphicTracker();
  const config = tracker.getConfig();
  
  if (config) {
    // Remove conflicting entries
    const resolved = ConfigUtils.resolveConflicts(config, {
      strategy: 'merge', // 'merge' | 'replace' | 'ignore'
      onConflict: (type, target, existing, incoming) => {
        console.log(`Resolving conflict for ${type}.${target}`);
        // Keep the most recent entry
        return existing.lastVerifiedAt > incoming.lastVerifiedAt ? existing : incoming;
      }
    });
    
    tracker.setConfig(resolved);
    await tracker.saveConfig();
  }
}
```

## Query Problems

### Issue: Queries return empty results

**Error Message:** No error, but queries consistently return empty arrays.

**Diagnosis Steps:**

1. **Check if targets exist in database:**

```typescript
async function checkDataExists() {
  // Using raw Zero.js query to check data
  const jobs = await zero.query.jobs.findMany({ take: 5 });
  console.log(`Found ${jobs.length} jobs in database`);
  
  const activityLogs = await zero.query.activity_logs.findMany({ take: 5 });
  console.log(`Found ${activityLogs.length} activity logs in database`);
}
```

2. **Check query conditions:**

```typescript
import { createLoggableQuery } from '@/lib/zero/polymorphic';

async function debugQuery() {
  const query = createLoggableQuery({
    targetTypes: ['jobs'],
    conditions: {
      // Remove conditions temporarily to test
    },
    limit: 10
  });
  
  console.log('Query options:', query.options);
  
  const result = await query.execute();
  console.log('Query result:', {
    dataLength: result.data.length,
    total: result.metadata.total,
    targetCounts: result.metadata.targetCounts
  });
}
```

3. **Check relationship registration:**

```typescript
import { getPolymorphicRegistry } from '@/lib/zero/polymorphic';

function checkRelationships() {
  const registry = getPolymorphicRegistry();
  const relationships = registry.getPolymorphicRelationships('activity_logs');
  
  console.log('Registered polymorphic relationships:');
  relationships.forEach(rel => {
    console.log(`  - ${rel.relationshipName}: ${rel.targetModel}`);
  });
}
```

**Common Solutions:**

- **No data in database:** Add test data or check database connection
- **Wrong conditions:** Simplify or remove query conditions
- **Missing relationships:** Complete relationship registration
- **Inactive targets:** Check if targets are marked as active

---

### Issue: Slow query performance

**Error Message:** Queries take longer than expected to execute.

**Diagnosis:**

```typescript
async function profileQuery() {
  const start = performance.now();
  
  const query = createLoggableQuery({
    targetTypes: ['jobs', 'tasks', 'clients'],
    conditions: { created_at: { gte: '2025-01-01' } },
    limit: 100
  });
  
  const result = await query.execute();
  const end = performance.now();
  
  console.log('Query Performance:');
  console.log(`  Execution time: ${end - start}ms`);
  console.log(`  Results: ${result.data.length}`);
  console.log(`  From cache: ${result.metadata.fromCache}`);
  
  if (end - start > 1000) {
    console.warn('⚠️ Slow query detected');
  }
}
```

**Optimization Solutions:**

1. **Enable caching:**

```typescript
const query = createLoggableQuery({
  targetTypes: ['jobs'],
  caching: { enabled: true, ttl: 300 },
  cacheKey: 'recent-job-logs'
});
```

2. **Optimize query conditions:**

```typescript
// Instead of broad date ranges
const query = createLoggableQuery({
  conditions: {
    created_at: { gte: '2025-01-01' } // Very broad
  }
});

// Use more specific conditions
const query = createLoggableQuery({
  conditions: {
    created_at: { gte: '2025-08-01' }, // Last week only
    action: { in: ['created', 'updated'] } // Specific actions
  },
  limit: 50 // Reasonable limit
});
```

3. **Reduce eager loading:**

```typescript
// Instead of loading everything
const query = createLoggableQuery({
  eagerLoad: ['user', 'loggableJob', 'loggableTask', 'loggableClient'] // Too much
});

// Load only what you need
const query = createLoggableQuery({
  eagerLoad: ['user'] // Just the user
});
```

---

### Issue: Cache not working

**Error Message:** Queries always show `fromCache: false` even with caching enabled.

**Diagnosis:**

```typescript
import { polymorphicQueryCache } from '@/lib/zero/polymorphic';

async function diagnoseCaching() {
  // Check cache configuration
  const cacheConfig = polymorphicQueryCache.getConfig();
  console.log('Cache configuration:', cacheConfig);
  
  // Test cache manually
  const testKey = 'cache-test';
  const testData = { test: 'data' };
  
  await polymorphicQueryCache.set(testKey, testData, 300);
  const retrieved = await polymorphicQueryCache.get(testKey);
  
  if (retrieved) {
    console.log('✅ Cache is working');
  } else {
    console.error('❌ Cache is not working');
  }
  
  // Check cache stats
  const stats = polymorphicQueryCache.getStats();
  console.log('Cache stats:', stats);
}
```

**Solutions:**

1. **Ensure consistent cache keys:**

```typescript
// Use consistent options for same logical query
const query1 = createLoggableQuery({
  targetTypes: ['jobs'],
  conditions: { action: 'created' },
  cacheKey: 'job-created-logs'
});

const query2 = createLoggableQuery({
  targetTypes: ['jobs'], // Same order
  conditions: { action: 'created' }, // Same format
  cacheKey: 'job-created-logs' // Same key
});
```

2. **Check TTL settings:**

```typescript
const query = createLoggableQuery({
  caching: { 
    enabled: true, 
    ttl: 300 // 5 minutes - not too short
  }
});
```

## Performance Issues

### Issue: High memory usage

**Symptoms:** Application memory usage grows over time, potentially causing crashes.

**Diagnosis:**

```typescript
import { polymorphicDebugger } from '@/lib/zero/polymorphic';

function monitorMemory() {
  const metrics = polymorphicDebugger.getMetrics().getSnapshot();
  const memUsage = process.memoryUsage();
  
  console.log('Memory Usage:');
  console.log(`  RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
  console.log(`  Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
  console.log(`  External: ${Math.round(memUsage.external / 1024 / 1024)}MB`);
  
  console.log('Polymorphic System:');
  console.log(`  Total queries: ${metrics.totalQueries}`);
  console.log(`  Cache hit rate: ${Math.round(metrics.cacheHitRate * 100)}%`);
}

// Monitor every minute
setInterval(monitorMemory, 60000);
```

**Solutions:**

1. **Clean up reactive queries:**

```typescript
// In Svelte components
import { onDestroy } from 'svelte';

const reactiveQuery = createReactiveLoggableQuery(options);

onDestroy(() => {
  reactiveQuery.cleanup(); // Important: cleanup when component unmounts
});
```

2. **Limit cache size:**

```typescript
import { polymorphicQueryCache } from '@/lib/zero/polymorphic';

// Configure cache limits
polymorphicQueryCache.configure({
  maxSize: 1000, // Limit number of cached entries
  maxMemory: 100 * 1024 * 1024, // 100MB limit
  pruneInterval: 300000 // Prune every 5 minutes
});
```

3. **Use pagination for large datasets:**

```typescript
// Instead of loading everything
const allLogs = await createLoggableQuery({ 
  targetTypes: ['jobs'] // Could be thousands
}).execute();

// Load in pages
async function loadLogsPaginated() {
  const pageSize = 50;
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const page = await createLoggableQuery({
      targetTypes: ['jobs'],
      limit: pageSize,
      offset: offset
    }).execute();
    
    // Process page
    processLogsPage(page.data);
    
    hasMore = page.data.length === pageSize;
    offset += pageSize;
  }
}
```

## Integration Problems

### Issue: Svelte reactivity not updating

**Symptoms:** UI doesn't update when polymorphic data changes.

**Solution:**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createReactiveLoggableQuery } from '@/lib/zero/polymorphic';
  
  export let entityId: string;
  
  let logs = [];
  let loading = true;
  let error = null;
  
  // Create reactive query
  const reactiveQuery = createReactiveLoggableQuery({
    targetTypes: ['jobs'],
    conditions: { loggable_id: entityId },
    autoRefresh: true,
    refreshInterval: 30000
  });
  
  // Subscribe to updates - this creates reactivity
  const unsubscribe = reactiveQuery.subscribe((result) => {
    logs = result.data; // This triggers Svelte reactivity
    loading = false;
    error = null;
  });
  
  // Handle errors
  reactiveQuery.onError((err) => {
    error = err.message;
    loading = false;
  });
  
  onDestroy(() => {
    unsubscribe();
    reactiveQuery.cleanup();
  });
</script>

{#if loading}
  Loading...
{:else if error}
  Error: {error}
{:else}
  {#each logs as log}
    <!-- UI will update automatically when logs change -->
    <div>{log.action} at {log.created_at}</div>
  {/each}
{/if}
```

---

### Issue: TypeScript compilation errors

**Error Messages:** Various TypeScript errors related to polymorphic types.

**Solutions:**

1. **Ensure types are imported:**

```typescript
import type { 
  PolymorphicType,
  PolymorphicQueryOptions,
  PolymorphicQueryResult 
} from '@/lib/zero/polymorphic';
```

2. **Use type assertions when necessary:**

```typescript
// If TypeScript can't infer the type
const query = createPolymorphicQuery('loggable' as PolymorphicType, options);

// Or use the specific query builders
const query = createLoggableQuery(options); // Type-safe
```

3. **Update tsconfig.json if needed:**

```json
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  }
}
```

## Development Issues

### Issue: Tests failing

**Common test failures and solutions:**

1. **System not initialized in tests:**

```typescript
// test-setup.ts
import { beforeAll, afterAll } from 'vitest';
import { initializePolymorphicSystem } from '@/lib/zero/polymorphic';

beforeAll(async () => {
  await initializePolymorphicSystem();
});
```

2. **Mock data not working:**

```typescript
// Use test utilities
import { PolymorphicTestUtils } from '@/lib/zero/polymorphic/__tests__/test-utilities';

const mockTracker = PolymorphicTestUtils.createMockTracker({
  associations: {
    loggable: {
      validTargets: {
        jobs: PolymorphicTestUtils.createMockTarget('Job', 'jobs')
      }
    }
  }
});
```

3. **Async test issues:**

```typescript
// Ensure proper async handling
it('should execute query', async () => {
  const query = createLoggableQuery({ targetTypes: ['jobs'] });
  
  // Await the promise
  const result = await query.execute();
  
  expect(result.data).toBeDefined();
});
```

## Diagnostic Tools

### System Health Check

```typescript
// src/lib/zero/polymorphic/diagnostics/health-check.ts
export async function runFullDiagnostics(): Promise<DiagnosticReport> {
  const report: DiagnosticReport = {
    timestamp: new Date().toISOString(),
    systemHealth: 'unknown',
    issues: [],
    recommendations: [],
    details: {}
  };

  try {
    // 1. Check system initialization
    const tracker = getPolymorphicTracker();
    if (!tracker) {
      report.issues.push('System not initialized');
      report.systemHealth = 'critical';
      return report;
    }

    // 2. Check configuration
    const config = tracker.getConfig();
    if (!config) {
      report.issues.push('No configuration loaded');
      report.systemHealth = 'critical';
    } else {
      const validation = tracker.validate();
      if (!validation.valid) {
        report.issues.push(`Configuration validation failed: ${validation.errors.length} errors`);
        report.details.configErrors = validation.errors;
      }
    }

    // 3. Check query system
    const testResult = await testQuerySystem();
    if (!testResult.success) {
      report.issues.push(`Query system issues: ${testResult.error}`);
    }

    // 4. Check cache system  
    const cacheResult = await testCacheSystem();
    if (!cacheResult.working) {
      report.issues.push('Cache system not working');
      report.recommendations.push('Check cache configuration');
    }

    // 5. Performance metrics
    const metrics = polymorphicDebugger.getMetrics().getSnapshot();
    if (metrics.averageQueryTime > 2000) {
      report.issues.push('High average query time');
      report.recommendations.push('Optimize queries or add database indexes');
    }

    // Determine overall health
    if (report.issues.length === 0) {
      report.systemHealth = 'healthy';
    } else if (report.issues.some(issue => issue.includes('critical'))) {
      report.systemHealth = 'critical';
    } else {
      report.systemHealth = 'warning';
    }

  } catch (error) {
    report.issues.push(`Diagnostic error: ${error.message}`);
    report.systemHealth = 'critical';
  }

  return report;
}

async function testQuerySystem(): Promise<{ success: boolean; error?: string }> {
  try {
    const query = createLoggableQuery({
      targetTypes: ['jobs'],
      limit: 1
    });
    
    await query.execute();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testCacheSystem(): Promise<{ working: boolean }> {
  try {
    const testKey = 'diagnostic-test';
    const testData = { test: true };
    
    await polymorphicQueryCache.set(testKey, testData, 60);
    const retrieved = await polymorphicQueryCache.get(testKey);
    
    return { working: !!retrieved };
  } catch (error) {
    return { working: false };
  }
}

interface DiagnosticReport {
  timestamp: string;
  systemHealth: 'healthy' | 'warning' | 'critical' | 'unknown';
  issues: string[];
  recommendations: string[];
  details: Record<string, any>;
}
```

### Debug Information Collection

```typescript
// src/lib/zero/polymorphic/diagnostics/debug-info.ts
export function collectDebugInfo(): DebugInfo {
  const tracker = getPolymorphicTracker();
  const config = tracker?.getConfig();
  const metrics = polymorphicDebugger.getMetrics().getSnapshot();

  return {
    system: {
      nodeVersion: process.version,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    },
    polymorphicSystem: {
      initialized: !!tracker,
      configLoaded: !!config,
      configVersion: config?.metadata?.configVersion,
      totalAssociations: config?.metadata?.totalAssociations || 0,
      totalTargets: config?.metadata?.totalTargets || 0
    },
    performance: {
      totalQueries: metrics.totalQueries,
      averageQueryTime: metrics.averageQueryTime,
      errorRate: metrics.errorRate,
      cacheHitRate: metrics.cacheHitRate
    },
    configuration: config ? {
      associations: Object.keys(config.associations),
      targetsByType: Object.fromEntries(
        Object.entries(config.associations).map(([type, assoc]) => [
          type,
          Object.keys(assoc.validTargets)
        ])
      )
    } : null
  };
}

interface DebugInfo {
  system: {
    nodeVersion: string;
    environment: string;
    timestamp: string;
  };
  polymorphicSystem: {
    initialized: boolean;
    configLoaded: boolean;
    configVersion?: string;
    totalAssociations: number;
    totalTargets: number;
  };
  performance: {
    totalQueries: number;
    averageQueryTime: number;
    errorRate: number;
    cacheHitRate: number;
  };
  configuration: {
    associations: string[];
    targetsByType: Record<string, string[]>;
  } | null;
}

// Usage in support requests
export function generateSupportReport(): string {
  const debugInfo = collectDebugInfo();
  
  return `
=== Polymorphic System Debug Report ===
Timestamp: ${debugInfo.system.timestamp}
Node Version: ${debugInfo.system.nodeVersion}
Environment: ${debugInfo.system.environment}

=== System Status ===
Initialized: ${debugInfo.polymorphicSystem.initialized}
Config Loaded: ${debugInfo.polymorphicSystem.configLoaded}
Config Version: ${debugInfo.polymorphicSystem.configVersion || 'N/A'}
Total Associations: ${debugInfo.polymorphicSystem.totalAssociations}
Total Targets: ${debugInfo.polymorphicSystem.totalTargets}

=== Performance Metrics ===
Total Queries: ${debugInfo.performance.totalQueries}
Average Query Time: ${debugInfo.performance.averageQueryTime}ms
Error Rate: ${(debugInfo.performance.errorRate * 100).toFixed(2)}%
Cache Hit Rate: ${(debugInfo.performance.cacheHitRate * 100).toFixed(2)}%

=== Configuration ===
${debugInfo.configuration ? 
  Object.entries(debugInfo.configuration.targetsByType)
    .map(([type, targets]) => `${type}: [${targets.join(', ')}]`)
    .join('\n') 
  : 'No configuration loaded'}
`;
}
```

### Quick Diagnostic Commands

Create these utility commands for quick diagnostics:

```typescript
// Add to your package.json scripts or create CLI commands
export const diagnosticCommands = {
  // Quick health check
  async health() {
    const report = await runFullDiagnostics();
    console.log(`System Health: ${report.systemHealth}`);
    if (report.issues.length > 0) {
      console.log('Issues:');
      report.issues.forEach(issue => console.log(`  ❌ ${issue}`));
    }
    if (report.recommendations.length > 0) {
      console.log('Recommendations:');
      report.recommendations.forEach(rec => console.log(`  💡 ${rec}`));
    }
  },

  // Configuration info
  async config() {
    const tracker = getPolymorphicTracker();
    const config = tracker?.getConfig();
    
    if (!config) {
      console.log('❌ No configuration loaded');
      return;
    }
    
    console.log('Configuration Summary:');
    console.log(`  Associations: ${Object.keys(config.associations).length}`);
    console.log(`  Total Targets: ${config.metadata.totalTargets}`);
    console.log(`  Config Version: ${config.metadata.configVersion}`);
    
    Object.entries(config.associations).forEach(([type, assoc]) => {
      console.log(`  ${type}: ${Object.keys(assoc.validTargets).length} targets`);
    });
  },

  // Performance metrics
  async perf() {
    const metrics = polymorphicDebugger.getMetrics().getSnapshot();
    
    console.log('Performance Metrics:');
    console.log(`  Total Queries: ${metrics.totalQueries}`);
    console.log(`  Average Query Time: ${metrics.averageQueryTime.toFixed(2)}ms`);
    console.log(`  Error Rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
    console.log(`  Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(2)}%`);
  },

  // Generate support report
  async support() {
    const report = generateSupportReport();
    console.log(report);
  }
};

// Usage:
// await diagnosticCommands.health();
// await diagnosticCommands.config();
// await diagnosticCommands.perf();
// await diagnosticCommands.support();
```

This comprehensive troubleshooting guide should help developers quickly identify and resolve common issues with the Polymorphic Tracking System. The diagnostic tools provide automated ways to check system health and generate detailed reports for support purposes.