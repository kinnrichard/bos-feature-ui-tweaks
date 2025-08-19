# Polymorphic Tracking System API Reference

## Overview

The Polymorphic Tracking System provides a comprehensive API for managing dynamic polymorphic relationships in the BOS frontend application. This system replaces hardcoded polymorphic relationships with a configurable, type-safe solution.

## Table of Contents

- [Core Classes](#core-classes)
- [Initialization](#initialization)
- [Configuration Management](#configuration-management)
- [Discovery System](#discovery-system)
- [Registry Integration](#registry-integration)
- [Query System](#query-system)
- [Type Definitions](#type-definitions)
- [Utility Functions](#utility-functions)
- [Error Handling](#error-handling)

## Core Classes

### PolymorphicTracker

Main class for managing polymorphic relationships and configuration.

#### Constructor
```typescript
new PolymorphicTracker(options?: {
  configPath?: string;
  autoSave?: boolean;
  validateOnLoad?: boolean;
})
```

#### Methods

##### `getConfig(): PolymorphicConfig | null`
Returns the current polymorphic configuration.

```typescript
const tracker = getPolymorphicTracker();
const config = tracker.getConfig();
```

##### `getValidTargets(type: PolymorphicType): string[]`
Returns valid target model names for a polymorphic type.

```typescript
const validTargets = tracker.getValidTargets('loggable');
// Returns: ['jobs', 'tasks', 'clients', 'users', 'people']
```

##### `isValidTarget(type: PolymorphicType, target: string): boolean`
Validates if a target is valid for a polymorphic type.

```typescript
const isValid = tracker.isValidTarget('notable', 'jobs');
// Returns: true
```

##### `addTarget(type: PolymorphicType, tableName: string, modelName: string, metadata: object): Promise<void>`
Adds a new valid target for a polymorphic type.

```typescript
await tracker.addTarget('loggable', 'projects', 'Project', {
  source: 'manual',
  description: 'Projects can be logged'
});
```

##### `removeTarget(type: PolymorphicType, tableName: string): Promise<void>`
Removes a target from a polymorphic type.

```typescript
await tracker.removeTarget('loggable', 'old_model');
```

##### `deactivateTarget(type: PolymorphicType, tableName: string): Promise<void>`
Deactivates a target without removing it.

```typescript
await tracker.deactivateTarget('notable', 'deprecated_model');
```

##### `loadConfig(configPath?: string): Promise<void>`
Loads configuration from JSON file or discovers from schema.

```typescript
await tracker.loadConfig('./custom-config.json');
```

##### `saveConfig(configPath?: string): Promise<void>`
Saves current configuration to JSON file.

```typescript
await tracker.saveConfig('./exported-config.json');
```

##### `validate(): PolymorphicValidationResult`
Validates the current configuration.

```typescript
const result = tracker.validate();
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

### PolymorphicRegistry

Integration with the existing RelationshipRegistry system.

#### Methods

##### `registerPolymorphicTargetRelationships(tableName: string, polymorphicType: PolymorphicType, idField: string, typeField: string): void`
Registers polymorphic relationships for a table.

```typescript
const registry = getPolymorphicRegistry();
registry.registerPolymorphicTargetRelationships(
  'activity_logs',
  'loggable',
  'loggable_id',
  'loggable_type'
);
```

##### `getPolymorphicRelationships(tableName: string): PolymorphicRelationshipMetadata[]`
Gets polymorphic relationships for a table.

```typescript
const relationships = registry.getPolymorphicRelationships('activity_logs');
```

### PolymorphicDiscovery

Automatic discovery of polymorphic patterns from existing schema.

#### Methods

##### `discoverFromHardcodedSchema(): Promise<PolymorphicDiscoveryResult[]>`
Discovers polymorphic relationships from hardcoded schema.

```typescript
const discovery = createPolymorphicDiscovery();
const results = await discovery.discoverFromHardcodedSchema();
```

##### `analyzeRelationshipNames(tableName: string): PolymorphicDiscoveryResult[]`
Analyzes relationship names to discover polymorphic patterns.

```typescript
const patterns = discovery.analyzeRelationshipNames('activity_logs');
```

## Initialization

### System Initialization

Initialize the complete polymorphic tracking system:

```typescript
import { initializePolymorphicSystem } from '@/lib/zero/polymorphic';

// Initialize the system
await initializePolymorphicSystem();
```

### Individual Component Initialization

Initialize specific components:

```typescript
import { 
  initializePolymorphicTracking, 
  initializePolymorphicRegistry 
} from '@/lib/zero/polymorphic';

// Initialize just the tracker
await initializePolymorphicTracking();

// Initialize just the registry
await initializePolymorphicRegistry();
```

### Health Check

Validate system health after initialization:

```typescript
import { validatePolymorphicSystem } from '@/lib/zero/polymorphic';

const health = await validatePolymorphicSystem();
if (!health.healthy) {
  console.error('System errors:', health.errors);
  console.warn('System warnings:', health.warnings);
}
```

## Configuration Management

### Configuration Format

The system uses JSON configuration with this structure:

```typescript
interface PolymorphicConfig {
  associations: Record<PolymorphicType, PolymorphicAssociationConfig>;
  metadata: {
    createdAt: string;
    updatedAt: string;
    configVersion: string;
    totalAssociations: number;
    totalTargets: number;
    generatedBy: string;
  };
}
```

### Loading Configuration

```typescript
import { getPolymorphicTracker } from '@/lib/zero/polymorphic';

const tracker = getPolymorphicTracker();

// Load from default location
await tracker.loadConfig();

// Load from specific file
await tracker.loadConfig('./custom-config.json');

// Load with validation
await tracker.loadConfig('./config.json', { validate: true });
```

### Creating Configuration

```typescript
import { ConfigUtils } from '@/lib/zero/polymorphic';

// Create empty configuration
const config = ConfigUtils.createDefaultConfig();

// Create from discovery results
const discoveryResults = await discovery.discoverFromHardcodedSchema();
const config = ConfigUtils.createConfigFromDiscovery(discoveryResults);
```

### Configuration Validation

```typescript
import { PolymorphicValidator } from '@/lib/zero/polymorphic';

const validator = new PolymorphicValidator();
const result = validator.validateConfig(config);

if (!result.valid) {
  result.errors.forEach(error => {
    console.error(`${error.type}: ${error.message}`);
  });
}
```

## Discovery System

### Auto-Discovery

Automatically discover polymorphic relationships from existing code:

```typescript
import { autoDiscoverAndConfigure } from '@/lib/zero/polymorphic';

// Discover and apply configuration
await autoDiscoverAndConfigure({
  autoDiscover: true,
  source: 'auto-discovery',
  validateTargets: true
});
```

### Manual Discovery

Run discovery manually for specific analysis:

```typescript
import { discoverPolymorphicRelationships } from '@/lib/zero/polymorphic';

// Discover all patterns
const results = await discoverPolymorphicRelationships();

// Analyze results
results.forEach(result => {
  console.log(`Found ${result.type} with ${result.targets.length} targets`);
  result.targets.forEach(target => {
    console.log(`  - ${target.modelName} (${target.source})`);
  });
});
```

### Pattern Analysis

Get polymorphic patterns from schema:

```typescript
import { getPolymorphicPatterns } from '@/lib/zero/polymorphic';

const patterns = await getPolymorphicPatterns();
patterns.forEach(pattern => {
  console.log(`Pattern: ${pattern.type}`);
  console.log(`Fields: ${pattern.idField}, ${pattern.typeField}`);
  console.log(`Targets: ${pattern.targets.join(', ')}`);
});
```

## Registry Integration

### Model Registration

Register models with polymorphic relationships:

```typescript
import { registerModelRelationshipsWithPolymorphic } from '@/lib/zero/polymorphic';

// Register with polymorphic relationships
registerModelRelationshipsWithPolymorphic('activity_logs', {
  user: { type: 'belongsTo', model: 'User' },
  loggable: {
    type: 'belongsTo',
    model: 'Polymorphic',
    polymorphic: true,
    polymorphicType: 'loggable',
    polymorphicIdField: 'loggable_id',
    polymorphicTypeField: 'loggable_type',
    validTargets: ['jobs', 'tasks', 'clients']
  }
});
```

### Zero.js Integration

Generate Zero.js relationships from configuration:

```typescript
import { IntegrationUtils } from '@/lib/zero/polymorphic';

// Generate relationships for a polymorphic type
const relationships = IntegrationUtils.generateZeroJsRelationships(
  'loggable',
  'activity_logs'
);

// Use in schema definition
const activity_logsRelationships = relationships(activity_logs, ({ one }) => ({
  user: one({
    sourceField: ['user_id'],
    destField: ['id'],
    destSchema: users,
  }),
  ...relationships // Polymorphic relationships
}));
```

## Query System

### Basic Queries

Create polymorphic queries:

```typescript
import { 
  createPolymorphicQuery,
  createLoggableQuery,
  createNotableQuery 
} from '@/lib/zero/polymorphic';

// Generic polymorphic query
const query = createPolymorphicQuery('loggable', {
  includeInactive: false,
  eagerLoad: ['user']
});

// Specific type queries
const loggableQuery = createLoggableQuery({
  targetTypes: ['jobs', 'tasks'],
  conditions: { user_id: '123' }
});

const notableQuery = createNotableQuery({
  targetTypes: ['clients'],
  orderBy: 'created_at'
});
```

### Query Builder

Advanced query construction:

```typescript
import { PolymorphicQueryBuilder } from '@/lib/zero/polymorphic';

const builder = new PolymorphicQueryBuilder('loggable');
const query = builder
  .forTargets(['jobs', 'tasks'])
  .withConditions({ active: true })
  .withEagerLoading(['user', 'loggableJob'])
  .withCaching({ ttl: 300 })
  .build();

const results = await query.execute();
```

### Reactive Queries

Create reactive queries for real-time updates:

```typescript
import { createReactivePolymorphicQuery } from '@/lib/zero/polymorphic';

const reactiveQuery = createReactivePolymorphicQuery('loggable', {
  targetTypes: ['jobs'],
  autoRefresh: true,
  refreshInterval: 30000
});

// Subscribe to updates
reactiveQuery.subscribe(results => {
  console.log('Updated results:', results);
});

// Cleanup when done
reactiveQuery.cleanup();
```

### Query Caching

Enable caching for improved performance:

```typescript
import { 
  executeCachedQuery,
  warmPolymorphicCache 
} from '@/lib/zero/polymorphic';

// Execute with caching
const results = await executeCachedQuery('loggable', {
  targetTypes: ['jobs', 'tasks'],
  cacheKey: 'user-activities',
  ttl: 600
});

// Warm cache for common queries
await warmPolymorphicCache([
  { type: 'loggable', targetTypes: ['jobs'] },
  { type: 'notable', targetTypes: ['clients'] }
]);
```

## Type Definitions

### Core Types

```typescript
// Polymorphic types in the system
type PolymorphicType = 
  | 'notable'     // notes -> jobs, tasks, clients
  | 'loggable'    // activity_logs -> jobs, tasks, clients, users, people
  | 'schedulable' // scheduled_date_times -> jobs, tasks
  | 'target'      // job_targets -> clients, people, people_groups
  | 'parseable';  // parsed_emails -> jobs, tasks

// Target metadata
interface PolymorphicTargetMetadata {
  modelName: string;
  tableName: string;
  discoveredAt: string;
  lastVerifiedAt: string;
  active: boolean;
  source: 'generated-schema' | 'manual' | 'runtime';
}

// Association configuration
interface PolymorphicAssociationConfig {
  type: PolymorphicType;
  description: string;
  validTargets: Record<string, PolymorphicTargetMetadata>;
  metadata: {
    createdAt: string;
    updatedAt: string;
    configVersion: string;
    generatedBy: string;
  };
}
```

### Query Types

```typescript
// Query options
interface PolymorphicQueryOptions {
  targetTypes?: string[];
  conditions?: Record<string, any>;
  orderBy?: string | string[];
  limit?: number;
  offset?: number;
  eagerLoad?: string[];
  caching?: {
    enabled: boolean;
    ttl?: number;
    key?: string;
  };
}

// Query results
interface PolymorphicQueryResult<T = any> {
  data: T[];
  metadata: {
    total: number;
    targetCounts: Record<string, number>;
    executionTime: number;
    fromCache: boolean;
  };
}
```

### Validation Types

```typescript
// Validation result
interface PolymorphicValidationResult {
  valid: boolean;
  errors: Array<{
    type: PolymorphicType;
    target?: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  warnings: Array<{
    type: PolymorphicType;
    target?: string;
    message: string;
  }>;
  metadata: {
    validatedAt: string;
    validatedBy: string;
    totalChecked: number;
    passedChecks: number;
    failedChecks: number;
  };
}
```

## Utility Functions

### Type Conversion

```typescript
import { TypeConverter } from '@/lib/zero/polymorphic';

// Convert between naming conventions
const pascalCase = TypeConverter.snakeToPascal('job_target'); // 'JobTarget'
const snakeCase = TypeConverter.pascalToSnake('JobTarget');   // 'job_target'
const tableCase = TypeConverter.pascalToTable('JobTarget');   // 'job_targets'
```

### Relationship Naming

```typescript
import { RelationshipNamer } from '@/lib/zero/polymorphic';

// Generate relationship names
const name = RelationshipNamer.createPolymorphicRelationshipName('loggable', 'jobs');
// Returns: 'loggableJob'

const reverse = RelationshipNamer.createReverseRelationshipName('activity_logs', 'loggable');
// Returns: 'activityLogsAsLoggable'
```

### Validation Utilities

```typescript
import { 
  validatePolymorphicTarget,
  isPolymorphicRelationshipName 
} from '@/lib/zero/polymorphic';

// Validate targets
const isValid = validatePolymorphicTarget('loggable', 'jobs'); // true

// Check relationship names
const isPolymorphic = isPolymorphicRelationshipName('loggableJob'); // true
const isNormal = isPolymorphicRelationshipName('user'); // false
```

## Error Handling

### Error Types

The system defines several error types for different failure scenarios:

```typescript
// Configuration errors
class PolymorphicConfigError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PolymorphicConfigError';
  }
}

// Validation errors
class PolymorphicValidationError extends Error {
  constructor(message: string, public validationResult: PolymorphicValidationResult) {
    super(message);
    this.name = 'PolymorphicValidationError';
  }
}

// Discovery errors
class PolymorphicDiscoveryError extends Error {
  constructor(message: string, public discoveryContext: any) {
    super(message);
    this.name = 'PolymorphicDiscoveryError';
  }
}
```

### Error Handling Patterns

```typescript
import { 
  getPolymorphicTracker,
  PolymorphicConfigError,
  PolymorphicValidationError 
} from '@/lib/zero/polymorphic';

try {
  const tracker = getPolymorphicTracker();
  await tracker.loadConfig('./config.json');
} catch (error) {
  if (error instanceof PolymorphicConfigError) {
    console.error('Configuration error:', error.message);
    console.error('Error code:', error.code);
  } else if (error instanceof PolymorphicValidationError) {
    console.error('Validation failed:', error.validationResult.errors);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Debug Logging

Enable debug logging for troubleshooting:

```typescript
import { polymorphicDebugLogger } from '@/lib/zero/polymorphic';

// Enable debug logging
polymorphicDebugLogger.enabled = true;

// Log custom messages
polymorphicDebugLogger('Custom debug message');
polymorphicDebugLogger.error('Error message', { context: 'initialization' });
```

## Performance Considerations

### Caching

The system includes built-in caching for configuration and query results:

```typescript
// Configuration is cached in memory after first load
const tracker = getPolymorphicTracker();
const config = tracker.getConfig(); // Cached after first call

// Query results can be cached
const cachedResults = await executeCachedQuery('loggable', {
  cacheKey: 'common-query',
  ttl: 300 // 5 minutes
});
```

### Lazy Loading

Components are lazy-loaded to reduce initial bundle size:

```typescript
// Discovery utilities are loaded on demand
const { PolymorphicDiscovery } = await import('@/lib/zero/polymorphic/discovery');

// Query utilities are loaded when needed
const { PolymorphicQueryBuilder } = await import('@/lib/zero/polymorphic/query-builder');
```

### Memory Management

```typescript
// Cleanup reactive queries when components unmount
const reactiveQuery = createReactivePolymorphicQuery('loggable', options);

// Remember to cleanup
onDestroy(() => {
  reactiveQuery.cleanup();
});
```