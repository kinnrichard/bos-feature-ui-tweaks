# Developer Guide

## Overview

This guide provides comprehensive information for developers who need to extend, modify, or contribute to the Polymorphic Tracking System. It covers the internal architecture, extension points, and best practices for system development.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Core Components](#core-components)
- [Extension Points](#extension-points)
- [Adding New Polymorphic Types](#adding-new-polymorphic-types)
- [Custom Query Builders](#custom-query-builders)
- [Plugin System](#plugin-system)
- [Testing Guidelines](#testing-guidelines)
- [Performance Optimization](#performance-optimization)
- [Debugging and Monitoring](#debugging-and-monitoring)

## Architecture Overview

### System Design Principles

The Polymorphic Tracking System follows these key design principles:

1. **Separation of Concerns**: Clear separation between configuration, discovery, querying, and integration
2. **Extensibility**: Plugin architecture allows for custom behaviors without modifying core code
3. **Type Safety**: Full TypeScript support with compile-time validation
4. **Performance**: Built-in caching and optimization strategies
5. **Integration**: Seamless integration with existing Zero.js and RelationshipRegistry systems

### Component Dependencies

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Configuration  │    │    Discovery    │    │    Registry     │
│     System      │    │     System      │    │  Integration    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Query System   │
                    │   (Core API)    │
                    └─────────────────┘
                             │
                    ┌─────────────────┐
                    │   Utilities &   │
                    │    Helpers      │
                    └─────────────────┘
```

### File Organization

```
src/lib/zero/polymorphic/
├── core/                       # Core system components
│   ├── tracker.ts             # PolymorphicTracker class
│   ├── registry.ts            # Registry integration
│   └── config-manager.ts      # Configuration management
├── discovery/                  # Auto-discovery system
│   ├── discovery.ts           # Main discovery logic
│   ├── pattern-matcher.ts     # Pattern matching algorithms
│   └── schema-analyzer.ts     # Schema analysis utilities
├── query/                      # Query system
│   ├── query-system.ts        # Base query classes
│   ├── query-builder.ts       # Advanced query building
│   ├── query-cache.ts         # Caching layer
│   └── reactive-queries.ts    # Reactive query system
├── integration/                # Integration utilities
│   ├── model-integration.ts   # Model system integration
│   ├── schema-generator.ts    # Schema generation
│   └── migration.ts           # Migration utilities
├── plugins/                    # Plugin system
│   ├── plugin-manager.ts      # Plugin management
│   └── hooks/                 # Plugin hooks
├── utils/                      # Utility functions
│   ├── type-converter.ts      # Type conversion utilities
│   ├── validator.ts           # Validation utilities
│   └── debug.ts               # Debugging utilities
├── types.ts                   # TypeScript definitions
├── index.ts                   # Main entry point
└── docs/                      # Documentation
```

## Core Components

### PolymorphicTracker

The main orchestrator class that manages configuration and provides the primary API.

```typescript
// src/lib/zero/polymorphic/core/tracker.ts
export class PolymorphicTracker {
  private config: PolymorphicConfig | null = null;
  private configPath?: string;
  private autoSave: boolean;
  private pluginManager: PluginManager;

  constructor(options: PolymorphicTrackerOptions = {}) {
    this.configPath = options.configPath;
    this.autoSave = options.autoSave ?? true;
    this.pluginManager = new PluginManager(this);
  }

  // Core methods for configuration management
  async loadConfig(configPath?: string): Promise<void> {
    // Implementation details...
  }

  async saveConfig(configPath?: string): Promise<void> {
    // Implementation details...
  }

  // Methods for target management
  async addTarget(type: PolymorphicType, tableName: string, modelName: string, metadata: any): Promise<void> {
    // Validate and add target
    await this.pluginManager.executeHook('beforeAddTarget', { type, tableName, modelName, metadata });
    
    // Core logic...
    
    await this.pluginManager.executeHook('afterAddTarget', { type, tableName, modelName, metadata });
  }

  // Plugin integration
  use(plugin: PolymorphicPlugin): void {
    this.pluginManager.register(plugin);
  }
}
```

### PolymorphicRegistry

Integrates with the existing RelationshipRegistry system.

```typescript
// src/lib/zero/polymorphic/core/registry.ts
export class PolymorphicRegistry extends RelationshipRegistry {
  private tracker: PolymorphicTracker;
  private polymorphicRelationships: Map<string, PolymorphicRelationshipMetadata[]>;

  constructor(tracker: PolymorphicTracker) {
    super();
    this.tracker = tracker;
    this.polymorphicRelationships = new Map();
  }

  registerPolymorphicTargetRelationships(
    tableName: string,
    polymorphicType: PolymorphicType,
    idField: string,
    typeField: string
  ): void {
    const validTargets = this.tracker.getValidTargets(polymorphicType);
    
    validTargets.forEach(target => {
      const relationshipName = RelationshipNamer.createPolymorphicRelationshipName(
        polymorphicType,
        target
      );
      
      this.registerRelationship(tableName, relationshipName, {
        type: 'belongsTo',
        model: this.getModelNameForTarget(target),
        polymorphic: true,
        polymorphicType,
        sourceField: idField,
        targetField: 'id',
        conditionalField: typeField,
        conditionalValue: this.getModelNameForTarget(target)
      });
    });
  }

  private getModelNameForTarget(target: string): string {
    return TypeConverter.snakeToPascal(target.replace(/s$/, ''));
  }
}
```

### Query System Architecture

The query system provides multiple layers of functionality:

```typescript
// src/lib/zero/polymorphic/query/query-system.ts
export abstract class BasePolymorphicQuery<T = any> {
  protected type: PolymorphicType;
  protected options: PolymorphicQueryOptions;
  protected cache?: PolymorphicQueryCache;

  constructor(type: PolymorphicType, options: PolymorphicQueryOptions = {}) {
    this.type = type;
    this.options = options;
    
    if (options.caching?.enabled) {
      this.cache = new PolymorphicQueryCache(options.caching);
    }
  }

  abstract execute(): Promise<PolymorphicQueryResult<T>>;

  // Hook methods for extensions
  protected async beforeExecute(): Promise<void> {
    // Override in subclasses
  }

  protected async afterExecute(result: PolymorphicQueryResult<T>): Promise<void> {
    // Override in subclasses
  }
}

export class PolymorphicQuery<T = any> extends BasePolymorphicQuery<T> {
  async execute(): Promise<PolymorphicQueryResult<T>> {
    await this.beforeExecute();

    let result: PolymorphicQueryResult<T>;

    if (this.cache) {
      result = await this.executeWithCache();
    } else {
      result = await this.executeWithoutCache();
    }

    await this.afterExecute(result);
    return result;
  }

  private async executeWithCache(): Promise<PolymorphicQueryResult<T>> {
    const cacheKey = this.generateCacheKey();
    
    const cached = await this.cache!.get(cacheKey);
    if (cached) {
      return { ...cached, metadata: { ...cached.metadata, fromCache: true } };
    }

    const result = await this.executeWithoutCache();
    await this.cache!.set(cacheKey, result);
    
    return result;
  }

  private generateCacheKey(): string {
    return `${this.type}-${JSON.stringify(this.options)}`;
  }
}
```

## Extension Points

### Plugin System

The system provides hooks for extending functionality without modifying core code:

```typescript
// src/lib/zero/polymorphic/plugins/plugin-manager.ts
export interface PolymorphicPlugin {
  name: string;
  version: string;
  hooks: {
    [hookName: string]: (...args: any[]) => Promise<void> | void;
  };
}

export class PluginManager {
  private plugins: Map<string, PolymorphicPlugin> = new Map();
  private tracker: PolymorphicTracker;

  constructor(tracker: PolymorphicTracker) {
    this.tracker = tracker;
  }

  register(plugin: PolymorphicPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  async executeHook(hookName: string, ...args: any[]): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks[hookName]) {
        await plugin.hooks[hookName](...args);
      }
    }
  }
}

// Available hooks:
// - beforeLoadConfig
// - afterLoadConfig
// - beforeSaveConfig
// - afterSaveConfig
// - beforeAddTarget
// - afterAddTarget
// - beforeRemoveTarget
// - afterRemoveTarget
// - beforeQueryExecute
// - afterQueryExecute
// - beforeDiscovery
// - afterDiscovery
```

### Example Plugin: Audit Trail

```typescript
// src/lib/zero/polymorphic/plugins/audit-trail-plugin.ts
export class AuditTrailPlugin implements PolymorphicPlugin {
  name = 'audit-trail';
  version = '1.0.0';

  private auditLog: AuditEntry[] = [];

  hooks = {
    afterAddTarget: async (data: {
      type: PolymorphicType;
      tableName: string;
      modelName: string;
      metadata: any;
    }) => {
      this.auditLog.push({
        action: 'add_target',
        timestamp: new Date().toISOString(),
        data: {
          polymorphicType: data.type,
          target: data.tableName,
          modelName: data.modelName
        }
      });
    },

    afterRemoveTarget: async (data: {
      type: PolymorphicType;
      tableName: string;
    }) => {
      this.auditLog.push({
        action: 'remove_target',
        timestamp: new Date().toISOString(),
        data: {
          polymorphicType: data.type,
          target: data.tableName
        }
      });
    }
  };

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }

  clearAuditLog(): void {
    this.auditLog = [];
  }
}

interface AuditEntry {
  action: string;
  timestamp: string;
  data: any;
}

// Usage:
const tracker = new PolymorphicTracker();
tracker.use(new AuditTrailPlugin());
```

### Custom Query Extensions

Extend the query system with custom functionality:

```typescript
// src/lib/zero/polymorphic/query/extensions/analytics-query.ts
export class AnalyticsPolymorphicQuery extends PolymorphicQuery {
  private analytics: AnalyticsCollector;

  constructor(type: PolymorphicType, options: PolymorphicQueryOptions, analytics: AnalyticsCollector) {
    super(type, options);
    this.analytics = analytics;
  }

  protected async beforeExecute(): Promise<void> {
    await super.beforeExecute();
    
    this.analytics.trackEvent('polymorphic_query_start', {
      type: this.type,
      targetTypes: this.options.targetTypes,
      hasConditions: !!this.options.conditions
    });
  }

  protected async afterExecute(result: PolymorphicQueryResult<any>): Promise<void> {
    await super.afterExecute(result);
    
    this.analytics.trackEvent('polymorphic_query_complete', {
      type: this.type,
      resultCount: result.data.length,
      executionTime: result.metadata.executionTime,
      fromCache: result.metadata.fromCache
    });
  }
}

// Factory function for analytics queries
export function createAnalyticsPolymorphicQuery(
  type: PolymorphicType,
  options: PolymorphicQueryOptions,
  analytics: AnalyticsCollector
): AnalyticsPolymorphicQuery {
  return new AnalyticsPolymorphicQuery(type, options, analytics);
}
```

## Adding New Polymorphic Types

### Step 1: Update Type Definitions

```typescript
// src/lib/zero/polymorphic/types.ts
export type PolymorphicType = 
  | 'notable'
  | 'loggable'
  | 'schedulable'
  | 'target'
  | 'parseable'
  | 'trackable'    // New type
  | 'assignable';  // New type

// Add field patterns for new types
export const POLYMORPHIC_FIELDS = {
  // ... existing fields
  trackable: { id: 'trackable_id', type: 'trackable_type' },
  assignable: { id: 'assignable_id', type: 'assignable_type' }
} as const;
```

### Step 2: Add Discovery Patterns

```typescript
// src/lib/zero/polymorphic/discovery/pattern-matcher.ts
export class PatternMatcher {
  private static readonly POLYMORPHIC_PATTERNS = [
    // ... existing patterns
    {
      type: 'trackable',
      idPattern: /trackable_id/,
      typePattern: /trackable_type/,
      relationshipPattern: /^trackable[A-Z][a-zA-Z]*$/
    },
    {
      type: 'assignable',
      idPattern: /assignable_id/,
      typePattern: /assignable_type/,
      relationshipPattern: /^assignable[A-Z][a-zA-Z]*$/
    }
  ];
}
```

### Step 3: Create Type-Specific Query Builder

```typescript
// src/lib/zero/polymorphic/query/builders/trackable-query.ts
export class TrackableQuery extends PolymorphicQuery {
  constructor(options: PolymorphicQueryOptions = {}) {
    super('trackable', {
      ...options,
      // Add trackable-specific defaults
      eagerLoad: options.eagerLoad || ['user', 'trackable_source']
    });
  }

  // Trackable-specific methods
  withTrackingSource(source: string): this {
    this.options.conditions = {
      ...this.options.conditions,
      tracking_source: source
    };
    return this;
  }

  byDateRange(startDate: string, endDate: string): this {
    this.options.conditions = {
      ...this.options.conditions,
      tracked_at: {
        gte: startDate,
        lte: endDate
      }
    };
    return this;
  }
}

// Factory function
export function createTrackableQuery(options?: PolymorphicQueryOptions): TrackableQuery {
  return new TrackableQuery(options);
}
```

### Step 4: Add to Main Export

```typescript
// src/lib/zero/polymorphic/index.ts
export {
  createTrackableQuery,
  TrackableQuery
} from './query/builders/trackable-query';

export const POLYMORPHIC_TYPES = {
  // ... existing types
  TRACKABLE: 'trackable' as const,
  ASSIGNABLE: 'assignable' as const
} as const;
```

### Step 5: Update Configuration Templates

```typescript
// src/lib/zero/polymorphic/config-templates.ts
export const EXTENDED_BOS_CONFIG = {
  associations: {
    // ... existing associations
    trackable: {
      type: 'trackable',
      description: 'Track various entity interactions and events',
      validTargets: {
        users: { modelName: 'User', tableName: 'users', source: 'standard', active: true },
        sessions: { modelName: 'Session', tableName: 'sessions', source: 'standard', active: true }
      }
    },
    assignable: {
      type: 'assignable',
      description: 'Assign resources to various entities',
      validTargets: {
        users: { modelName: 'User', tableName: 'users', source: 'standard', active: true },
        teams: { modelName: 'Team', tableName: 'teams', source: 'standard', active: true }
      }
    }
  }
};
```

## Custom Query Builders

### Creating Domain-Specific Query Builders

```typescript
// src/lib/zero/polymorphic/query/builders/job-activity-query.ts
export class JobActivityQueryBuilder extends PolymorphicQueryBuilder {
  private jobId?: string;
  private activityTypes?: string[];
  private dateRange?: { start: string; end: string };

  constructor() {
    super('loggable');
    this.forTargets(['jobs']); // Restrict to jobs only
  }

  forJob(jobId: string): this {
    this.jobId = jobId;
    return this.withConditions({
      loggable_id: jobId,
      loggable_type: 'Job'
    });
  }

  withActivityTypes(types: string[]): this {
    this.activityTypes = types;
    return this.withConditions({
      action: { in: types }
    });
  }

  inDateRange(start: string, end: string): this {
    this.dateRange = { start, end };
    return this.withConditions({
      created_at: {
        gte: start,
        lte: end
      }
    });
  }

  // Custom aggregation methods
  async getActivitySummary(): Promise<{
    totalActivities: number;
    byType: Record<string, number>;
    byDay: Record<string, number>;
  }> {
    const query = this.build();
    const results = await query.execute();

    const summary = {
      totalActivities: results.data.length,
      byType: {} as Record<string, number>,
      byDay: {} as Record<string, number>
    };

    results.data.forEach((activity: any) => {
      // Count by activity type
      summary.byType[activity.action] = (summary.byType[activity.action] || 0) + 1;

      // Count by day
      const day = activity.created_at.split('T')[0];
      summary.byDay[day] = (summary.byDay[day] || 0) + 1;
    });

    return summary;
  }

  async getTimelineData(): Promise<Array<{
    date: string;
    activities: any[];
    count: number;
  }>> {
    const query = this
      .withOrderBy('created_at DESC')
      .withEagerLoading(['user'])
      .build();
    
    const results = await query.execute();
    const timelineMap = new Map<string, any[]>();

    results.data.forEach((activity: any) => {
      const date = activity.created_at.split('T')[0];
      if (!timelineMap.has(date)) {
        timelineMap.set(date, []);
      }
      timelineMap.get(date)!.push(activity);
    });

    return Array.from(timelineMap.entries())
      .map(([date, activities]) => ({
        date,
        activities,
        count: activities.length
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
}

// Usage:
const jobActivityQuery = new JobActivityQueryBuilder()
  .forJob('job-123')
  .withActivityTypes(['status_changed', 'assigned', 'completed'])
  .inDateRange('2025-08-01', '2025-08-07')
  .withCaching({ ttl: 300 });

const summary = await jobActivityQuery.getActivitySummary();
const timeline = await jobActivityQuery.getTimelineData();
```

### Custom Aggregation Queries

```typescript
// src/lib/zero/polymorphic/query/aggregation/polymorphic-aggregator.ts
export class PolymorphicAggregator {
  constructor(private type: PolymorphicType) {}

  async getTrendData(options: {
    targetTypes: string[];
    dateRange: { start: string; end: string };
    groupBy: 'day' | 'week' | 'month';
    aggregateBy?: string;
  }): Promise<TrendDataPoint[]> {
    const query = createPolymorphicQuery(this.type, {
      targetTypes: options.targetTypes,
      conditions: {
        created_at: {
          gte: options.dateRange.start,
          lte: options.dateRange.end
        }
      }
    });

    const results = await query.execute();
    return this.groupByTime(results.data, options.groupBy, options.aggregateBy);
  }

  async getDistributionData(options: {
    targetTypes: string[];
    groupBy: string;
    limit?: number;
  }): Promise<DistributionDataPoint[]> {
    const query = createPolymorphicQuery(this.type, {
      targetTypes: options.targetTypes,
      limit: options.limit || 1000
    });

    const results = await query.execute();
    return this.groupByField(results.data, options.groupBy);
  }

  private groupByTime(data: any[], groupBy: 'day' | 'week' | 'month', aggregateBy?: string): TrendDataPoint[] {
    const groups = new Map<string, any[]>();

    data.forEach(item => {
      const date = new Date(item.created_at);
      let groupKey: string;

      switch (groupBy) {
        case 'day':
          groupKey = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          groupKey = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(item);
    });

    return Array.from(groups.entries())
      .map(([date, items]) => ({
        date,
        count: items.length,
        value: aggregateBy ? this.aggregateField(items, aggregateBy) : items.length,
        items: items.slice(0, 5) // Include sample items
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private groupByField(data: any[], field: string): DistributionDataPoint[] {
    const groups = new Map<string, number>();

    data.forEach(item => {
      const value = String(item[field] || 'Unknown');
      groups.set(value, (groups.get(value) || 0) + 1);
    });

    return Array.from(groups.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }

  private aggregateField(items: any[], field: string): number {
    const values = items.map(item => Number(item[field]) || 0);
    return values.reduce((sum, value) => sum + value, 0);
  }
}

interface TrendDataPoint {
  date: string;
  count: number;
  value: number;
  items: any[];
}

interface DistributionDataPoint {
  label: string;
  count: number;
}

// Usage:
const loggableAggregator = new PolymorphicAggregator('loggable');

const trendData = await loggableAggregator.getTrendData({
  targetTypes: ['jobs', 'tasks'],
  dateRange: { start: '2025-07-01', end: '2025-08-01' },
  groupBy: 'day'
});

const distributionData = await loggableAggregator.getDistributionData({
  targetTypes: ['jobs'],
  groupBy: 'action',
  limit: 1000
});
```

## Testing Guidelines

### Unit Testing Strategy

```typescript
// src/lib/zero/polymorphic/__tests__/tracker.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PolymorphicTracker } from '../tracker';
import { PolymorphicConfig } from '../types';

describe('PolymorphicTracker', () => {
  let tracker: PolymorphicTracker;
  let mockConfig: PolymorphicConfig;

  beforeEach(() => {
    tracker = new PolymorphicTracker({ autoSave: false });
    mockConfig = createMockConfig();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('configuration management', () => {
    it('should load configuration from JSON', async () => {
      vi.spyOn(tracker, 'loadConfigFromFile').mockResolvedValue(mockConfig);
      
      await tracker.loadConfig('./test-config.json');
      
      expect(tracker.getConfig()).toEqual(mockConfig);
    });

    it('should validate configuration on load', async () => {
      const invalidConfig = { ...mockConfig, associations: {} };
      vi.spyOn(tracker, 'loadConfigFromFile').mockResolvedValue(invalidConfig);
      
      await expect(tracker.loadConfig('./invalid-config.json')).rejects.toThrow();
    });

    it('should save configuration to JSON', async () => {
      const saveSpy = vi.spyOn(tracker, 'saveConfigToFile').mockResolvedValue();
      tracker.setConfig(mockConfig);
      
      await tracker.saveConfig('./output-config.json');
      
      expect(saveSpy).toHaveBeenCalledWith('./output-config.json', mockConfig);
    });
  });

  describe('target management', () => {
    beforeEach(() => {
      tracker.setConfig(mockConfig);
    });

    it('should add valid targets', async () => {
      await tracker.addTarget('loggable', 'new_model', 'NewModel', {
        source: 'test'
      });

      const targets = tracker.getValidTargets('loggable');
      expect(targets).toContain('new_model');
    });

    it('should validate target before adding', async () => {
      // Test invalid polymorphic type
      await expect(
        tracker.addTarget('invalid_type' as any, 'model', 'Model', { source: 'test' })
      ).rejects.toThrow();
    });

    it('should remove targets', async () => {
      await tracker.removeTarget('loggable', 'jobs');
      
      const targets = tracker.getValidTargets('loggable');
      expect(targets).not.toContain('jobs');
    });
  });

  describe('validation', () => {
    it('should validate correct configuration', () => {
      tracker.setConfig(mockConfig);
      
      const result = tracker.validate();
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect validation errors', () => {
      const invalidConfig = {
        ...mockConfig,
        associations: {
          ...mockConfig.associations,
          loggable: {
            ...mockConfig.associations.loggable,
            validTargets: {} // Empty targets should be invalid
          }
        }
      };
      
      tracker.setConfig(invalidConfig);
      const result = tracker.validate();
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

function createMockConfig(): PolymorphicConfig {
  return {
    associations: {
      loggable: {
        type: 'loggable',
        description: 'Test loggable association',
        validTargets: {
          jobs: {
            modelName: 'Job',
            tableName: 'jobs',
            discoveredAt: '2025-08-06T00:00:00.000Z',
            lastVerifiedAt: '2025-08-06T00:00:00.000Z',
            active: true,
            source: 'test'
          }
        },
        metadata: {
          createdAt: '2025-08-06T00:00:00.000Z',
          updatedAt: '2025-08-06T00:00:00.000Z',
          configVersion: '1.0.0',
          generatedBy: 'test'
        }
      }
    } as any,
    metadata: {
      createdAt: '2025-08-06T00:00:00.000Z',
      updatedAt: '2025-08-06T00:00:00.000Z',
      configVersion: '1.0.0',
      totalAssociations: 1,
      totalTargets: 1,
      generatedBy: 'test'
    }
  };
}
```

### Integration Testing

```typescript
// src/lib/zero/polymorphic/__tests__/integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
  initializePolymorphicSystem,
  getPolymorphicTracker,
  createLoggableQuery 
} from '../index';

describe('Polymorphic System Integration', () => {
  beforeAll(async () => {
    await initializePolymorphicSystem();
  });

  it('should initialize system components', () => {
    const tracker = getPolymorphicTracker();
    expect(tracker).toBeDefined();
    expect(tracker.getConfig()).toBeTruthy();
  });

  it('should execute queries successfully', async () => {
    const query = createLoggableQuery({
      targetTypes: ['jobs'],
      limit: 5
    });

    const result = await query.execute();
    
    expect(result).toBeDefined();
    expect(result.data).toBeInstanceOf(Array);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.total).toBeGreaterThanOrEqual(0);
  });

  it('should handle caching correctly', async () => {
    const query1 = createLoggableQuery({
      targetTypes: ['jobs'],
      caching: { enabled: true, ttl: 300 },
      cacheKey: 'integration-test'
    });

    // First query (cache miss)
    const result1 = await query1.execute();
    expect(result1.metadata.fromCache).toBeFalsy();

    // Second query (cache hit)
    const query2 = createLoggableQuery({
      targetTypes: ['jobs'],
      caching: { enabled: true, ttl: 300 },
      cacheKey: 'integration-test'
    });
    
    const result2 = await query2.execute();
    expect(result2.metadata.fromCache).toBe(true);
  });
});
```

### Test Utilities

```typescript
// src/lib/zero/polymorphic/__tests__/test-utilities.ts
export class PolymorphicTestUtils {
  static createMockTracker(config?: Partial<PolymorphicConfig>): PolymorphicTracker {
    const tracker = new PolymorphicTracker({ autoSave: false });
    
    if (config) {
      tracker.setConfig(this.createMockConfig(config));
    }
    
    return tracker;
  }

  static createMockConfig(overrides?: Partial<PolymorphicConfig>): PolymorphicConfig {
    return {
      associations: {
        loggable: {
          type: 'loggable',
          description: 'Mock loggable association',
          validTargets: {
            jobs: this.createMockTarget('Job', 'jobs'),
            tasks: this.createMockTarget('Task', 'tasks')
          },
          metadata: this.createMockMetadata()
        },
        notable: {
          type: 'notable',
          description: 'Mock notable association',
          validTargets: {
            jobs: this.createMockTarget('Job', 'jobs'),
            clients: this.createMockTarget('Client', 'clients')
          },
          metadata: this.createMockMetadata()
        }
      } as any,
      metadata: {
        createdAt: '2025-08-06T00:00:00.000Z',
        updatedAt: '2025-08-06T00:00:00.000Z',
        configVersion: '1.0.0',
        totalAssociations: 2,
        totalTargets: 3,
        generatedBy: 'test-utils'
      },
      ...overrides
    };
  }

  static createMockTarget(modelName: string, tableName: string): PolymorphicTargetMetadata {
    return {
      modelName,
      tableName,
      discoveredAt: '2025-08-06T00:00:00.000Z',
      lastVerifiedAt: '2025-08-06T00:00:00.000Z',
      active: true,
      source: 'test'
    };
  }

  static createMockMetadata(): any {
    return {
      createdAt: '2025-08-06T00:00:00.000Z',
      updatedAt: '2025-08-06T00:00:00.000Z',
      configVersion: '1.0.0',
      generatedBy: 'test-utils'
    };
  }

  static async waitForQueries(queries: Array<Promise<any>>, timeout = 5000): Promise<any[]> {
    return Promise.race([
      Promise.all(queries),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), timeout)
      )
    ]) as Promise<any[]>;
  }
}
```

## Performance Optimization

### Caching Strategy

```typescript
// src/lib/zero/polymorphic/performance/cache-strategy.ts
export class PolymorphicCacheStrategy {
  private static readonly CACHE_TIERS = {
    HOT: { ttl: 60, priority: 'high' },      // 1 minute
    WARM: { ttl: 300, priority: 'medium' },  // 5 minutes
    COLD: { ttl: 1800, priority: 'low' }     // 30 minutes
  };

  static determineCacheTier(queryOptions: PolymorphicQueryOptions): typeof PolymorphicCacheStrategy.CACHE_TIERS[keyof typeof PolymorphicCacheStrategy.CACHE_TIERS] {
    // Hot tier for small, frequently accessed queries
    if (queryOptions.limit && queryOptions.limit <= 10) {
      return this.CACHE_TIERS.HOT;
    }

    // Warm tier for medium-sized queries with conditions
    if (queryOptions.conditions && Object.keys(queryOptions.conditions).length > 0) {
      return this.CACHE_TIERS.WARM;
    }

    // Cold tier for large or complex queries
    return this.CACHE_TIERS.COLD;
  }

  static optimizeQueryForCache(options: PolymorphicQueryOptions): PolymorphicQueryOptions {
    return {
      ...options,
      // Normalize conditions for better cache hits
      conditions: this.normalizeConditions(options.conditions),
      // Sort arrays for consistent cache keys
      targetTypes: options.targetTypes?.sort(),
      eagerLoad: options.eagerLoad?.sort()
    };
  }

  private static normalizeConditions(conditions?: any): any {
    if (!conditions) return conditions;

    // Sort object keys for consistent serialization
    const sorted: any = {};
    Object.keys(conditions).sort().forEach(key => {
      sorted[key] = conditions[key];
    });

    return sorted;
  }
}
```

### Query Optimization

```typescript
// src/lib/zero/polymorphic/performance/query-optimizer.ts
export class PolymorphicQueryOptimizer {
  static optimizeQuery(options: PolymorphicQueryOptions): PolymorphicQueryOptions {
    const optimized = { ...options };

    // Optimize target types
    optimized.targetTypes = this.optimizeTargetTypes(options.targetTypes);

    // Optimize eager loading
    optimized.eagerLoad = this.optimizeEagerLoading(options.eagerLoad);

    // Optimize conditions
    optimized.conditions = this.optimizeConditions(options.conditions);

    // Add query hints
    optimized.hints = this.generateQueryHints(optimized);

    return optimized;
  }

  private static optimizeTargetTypes(targetTypes?: string[]): string[] | undefined {
    if (!targetTypes || targetTypes.length === 0) return targetTypes;

    // Remove duplicate target types
    const unique = [...new Set(targetTypes)];

    // Order by expected result size (smaller first for better performance)
    const sizeHints: Record<string, number> = {
      'users': 1,
      'people': 2,
      'clients': 3,
      'tasks': 4,
      'jobs': 5
    };

    return unique.sort((a, b) => (sizeHints[a] || 999) - (sizeHints[b] || 999));
  }

  private static optimizeEagerLoading(eagerLoad?: string[]): string[] | undefined {
    if (!eagerLoad || eagerLoad.length === 0) return eagerLoad;

    // Remove duplicate relationships
    const unique = [...new Set(eagerLoad)];

    // Prioritize lightweight relationships first
    const weightHints: Record<string, number> = {
      'user': 1,
      'status': 2,
      'client': 3,
      'job': 4,
      'task': 5
    };

    return unique.sort((a, b) => {
      const weightA = weightHints[a] || 999;
      const weightB = weightHints[b] || 999;
      return weightA - weightB;
    });
  }

  private static optimizeConditions(conditions?: any): any {
    if (!conditions) return conditions;

    const optimized: any = {};

    // Process each condition
    Object.entries(conditions).forEach(([key, value]) => {
      if (key === 'id' && Array.isArray(value)) {
        // Optimize ID array conditions
        optimized[key] = { in: [...new Set(value)].slice(0, 1000) }; // Limit and dedupe
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Optimize range conditions
        optimized[key] = this.optimizeRangeCondition(value);
      } else {
        optimized[key] = value;
      }
    });

    return optimized;
  }

  private static optimizeRangeCondition(condition: any): any {
    // For date ranges, ensure proper indexing hints
    if (condition.gte && condition.lte) {
      return {
        ...condition,
        _hint: 'use_range_index'
      };
    }

    return condition;
  }

  private static generateQueryHints(options: PolymorphicQueryOptions): any {
    const hints: any = {};

    // Add pagination hints for large result sets
    if (!options.limit || options.limit > 100) {
      hints.pagination_recommended = true;
    }

    // Add index hints based on conditions
    if (options.conditions) {
      const conditionKeys = Object.keys(options.conditions);
      if (conditionKeys.includes('created_at') || conditionKeys.includes('updated_at')) {
        hints.use_time_index = true;
      }
    }

    return hints;
  }
}
```

## Debugging and Monitoring

### Debug System Integration

```typescript
// src/lib/zero/polymorphic/debug/polymorphic-debug.ts
export class PolymorphicDebugger {
  private static instance?: PolymorphicDebugger;
  private debugEnabled = false;
  private metrics: PolymorphicMetrics;

  constructor() {
    this.metrics = new PolymorphicMetrics();
  }

  static getInstance(): PolymorphicDebugger {
    if (!this.instance) {
      this.instance = new PolymorphicDebugger();
    }
    return this.instance;
  }

  enable(): void {
    this.debugEnabled = true;
  }

  disable(): void {
    this.debugEnabled = false;
  }

  log(message: string, data?: any): void {
    if (!this.debugEnabled) return;

    console.log(`[PolymorphicSystem] ${message}`, data);
  }

  logQuery(type: PolymorphicType, options: PolymorphicQueryOptions, executionTime: number): void {
    if (!this.debugEnabled) return;

    this.metrics.recordQuery(type, executionTime);

    console.log(`[PolymorphicQuery] ${type} query executed`, {
      type,
      targetTypes: options.targetTypes,
      executionTime: `${executionTime}ms`,
      conditions: options.conditions,
      cached: options.caching?.enabled
    });
  }

  logError(error: Error, context?: any): void {
    console.error(`[PolymorphicSystem] Error:`, error.message, {
      stack: error.stack,
      context
    });
  }

  getMetrics(): PolymorphicMetrics {
    return this.metrics;
  }

  generateReport(): PolymorphicDebugReport {
    return {
      metrics: this.metrics.getSnapshot(),
      systemHealth: this.checkSystemHealth(),
      recommendations: this.generateRecommendations()
    };
  }

  private checkSystemHealth(): SystemHealthStatus {
    const metrics = this.metrics.getSnapshot();
    
    return {
      status: metrics.averageQueryTime < 1000 ? 'healthy' : 'warning',
      issues: this.detectIssues(metrics),
      uptime: Date.now() - metrics.systemStartTime
    };
  }

  private detectIssues(metrics: PolymorphicMetricsSnapshot): string[] {
    const issues: string[] = [];

    if (metrics.averageQueryTime > 2000) {
      issues.push('High average query time detected');
    }

    if (metrics.errorRate > 0.05) {
      issues.push('High error rate detected');
    }

    if (metrics.cacheHitRate < 0.5) {
      issues.push('Low cache hit rate detected');
    }

    return issues;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.metrics.getSnapshot();

    if (metrics.cacheHitRate < 0.7) {
      recommendations.push('Consider increasing cache TTL or improving query patterns');
    }

    if (metrics.averageQueryTime > 1000) {
      recommendations.push('Consider adding database indexes or optimizing query conditions');
    }

    return recommendations;
  }
}

class PolymorphicMetrics {
  private queryTimes: number[] = [];
  private queryCounts: Map<PolymorphicType, number> = new Map();
  private errorCount = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private systemStartTime = Date.now();

  recordQuery(type: PolymorphicType, executionTime: number): void {
    this.queryTimes.push(executionTime);
    this.queryCounts.set(type, (this.queryCounts.get(type) || 0) + 1);

    // Keep only recent query times for moving averages
    if (this.queryTimes.length > 1000) {
      this.queryTimes = this.queryTimes.slice(-1000);
    }
  }

  recordError(): void {
    this.errorCount++;
  }

  recordCacheHit(): void {
    this.cacheHits++;
  }

  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  getSnapshot(): PolymorphicMetricsSnapshot {
    const totalQueries = this.queryTimes.length;
    const totalCacheRequests = this.cacheHits + this.cacheMisses;

    return {
      totalQueries,
      averageQueryTime: totalQueries > 0 ? this.queryTimes.reduce((a, b) => a + b, 0) / totalQueries : 0,
      queriesByType: Object.fromEntries(this.queryCounts),
      errorCount: this.errorCount,
      errorRate: totalQueries > 0 ? this.errorCount / totalQueries : 0,
      cacheHitRate: totalCacheRequests > 0 ? this.cacheHits / totalCacheRequests : 0,
      systemStartTime: this.systemStartTime
    };
  }
}

interface PolymorphicMetricsSnapshot {
  totalQueries: number;
  averageQueryTime: number;
  queriesByType: Record<string, number>;
  errorCount: number;
  errorRate: number;
  cacheHitRate: number;
  systemStartTime: number;
}

interface SystemHealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  uptime: number;
}

interface PolymorphicDebugReport {
  metrics: PolymorphicMetricsSnapshot;
  systemHealth: SystemHealthStatus;
  recommendations: string[];
}

// Global debug instance
export const polymorphicDebugger = PolymorphicDebugger.getInstance();

// Enable debugging in development
if (process.env.NODE_ENV === 'development') {
  polymorphicDebugger.enable();
}
```

### Monitoring Dashboard

```typescript
// src/lib/zero/polymorphic/monitoring/dashboard.ts
export class PolymorphicMonitoringDashboard {
  private metrics: PolymorphicMetrics;
  private alerts: PolymorphicAlert[] = [];

  constructor() {
    this.metrics = polymorphicDebugger.getMetrics();
    this.setupAlerts();
  }

  private setupAlerts(): void {
    // Alert for high query times
    this.addAlert({
      name: 'High Query Time',
      condition: (metrics) => metrics.averageQueryTime > 2000,
      severity: 'warning',
      message: 'Average query time is above 2 seconds'
    });

    // Alert for high error rate
    this.addAlert({
      name: 'High Error Rate',
      condition: (metrics) => metrics.errorRate > 0.1,
      severity: 'critical',
      message: 'Error rate is above 10%'
    });

    // Alert for low cache hit rate
    this.addAlert({
      name: 'Low Cache Hit Rate',
      condition: (metrics) => metrics.cacheHitRate < 0.5,
      severity: 'warning',
      message: 'Cache hit rate is below 50%'
    });
  }

  private addAlert(alert: PolymorphicAlert): void {
    this.alerts.push(alert);
  }

  getDashboardData(): PolymorphicDashboardData {
    const metricsSnapshot = this.metrics.getSnapshot();
    const activeAlerts = this.checkAlerts(metricsSnapshot);

    return {
      metrics: metricsSnapshot,
      alerts: activeAlerts,
      systemStatus: this.getSystemStatus(activeAlerts),
      recommendations: this.generateRecommendations(metricsSnapshot)
    };
  }

  private checkAlerts(metrics: PolymorphicMetricsSnapshot): PolymorphicActiveAlert[] {
    return this.alerts
      .filter(alert => alert.condition(metrics))
      .map(alert => ({
        ...alert,
        triggeredAt: new Date().toISOString(),
        currentValue: this.getCurrentValue(alert, metrics)
      }));
  }

  private getCurrentValue(alert: PolymorphicAlert, metrics: PolymorphicMetricsSnapshot): string {
    switch (alert.name) {
      case 'High Query Time':
        return `${metrics.averageQueryTime.toFixed(2)}ms`;
      case 'High Error Rate':
        return `${(metrics.errorRate * 100).toFixed(2)}%`;
      case 'Low Cache Hit Rate':
        return `${(metrics.cacheHitRate * 100).toFixed(2)}%`;
      default:
        return 'N/A';
    }
  }

  private getSystemStatus(alerts: PolymorphicActiveAlert[]): SystemStatus {
    if (alerts.some(alert => alert.severity === 'critical')) {
      return 'critical';
    } else if (alerts.some(alert => alert.severity === 'warning')) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  private generateRecommendations(metrics: PolymorphicMetricsSnapshot): string[] {
    const recommendations: string[] = [];

    if (metrics.averageQueryTime > 1000) {
      recommendations.push('Consider optimizing query conditions or adding database indexes');
    }

    if (metrics.cacheHitRate < 0.7) {
      recommendations.push('Review caching strategy and increase TTL for stable queries');
    }

    if (metrics.errorRate > 0.05) {
      recommendations.push('Investigate and fix recurring error patterns');
    }

    return recommendations;
  }
}

interface PolymorphicAlert {
  name: string;
  condition: (metrics: PolymorphicMetricsSnapshot) => boolean;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

interface PolymorphicActiveAlert extends PolymorphicAlert {
  triggeredAt: string;
  currentValue: string;
}

interface PolymorphicDashboardData {
  metrics: PolymorphicMetricsSnapshot;
  alerts: PolymorphicActiveAlert[];
  systemStatus: SystemStatus;
  recommendations: string[];
}

type SystemStatus = 'healthy' | 'warning' | 'critical';
```

This comprehensive developer guide provides the foundation for extending and maintaining the Polymorphic Tracking System. It covers all the essential aspects of the system architecture, extension points, and best practices for development and debugging.