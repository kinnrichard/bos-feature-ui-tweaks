# Performance Optimization Guide

## Overview

This guide provides comprehensive strategies for optimizing the performance of the Polymorphic Tracking System. It covers caching, query optimization, memory management, and monitoring techniques.

## Table of Contents

- [Performance Fundamentals](#performance-fundamentals)
- [Query Optimization](#query-optimization)
- [Caching Strategies](#caching-strategies)
- [Memory Management](#memory-management)
- [Database Optimization](#database-optimization)
- [Monitoring and Metrics](#monitoring-and-metrics)
- [Best Practices](#best-practices)
- [Performance Testing](#performance-testing)

## Performance Fundamentals

### Key Performance Metrics

The system tracks several key performance indicators:

1. **Query Execution Time**: Time to execute polymorphic queries
2. **Cache Hit Rate**: Percentage of queries served from cache
3. **Memory Usage**: System memory consumption
4. **Throughput**: Queries per second capacity
5. **Error Rate**: Percentage of failed queries

### Performance Targets

Recommended performance targets for the polymorphic system:

- **Query Execution Time**: < 500ms for simple queries, < 2s for complex queries
- **Cache Hit Rate**: > 70% for production workloads
- **Memory Usage**: < 100MB for typical applications
- **Error Rate**: < 1% under normal conditions

## Query Optimization

### 1. Query Structure Optimization

#### Use Specific Target Types

```typescript
// ❌ Bad: Querying all target types
const query = createLoggableQuery({
  targetTypes: ['jobs', 'tasks', 'clients', 'users', 'people', 'devices'],
  limit: 10
});

// ✅ Good: Query only needed target types
const query = createLoggableQuery({
  targetTypes: ['jobs', 'tasks'], // Only what you need
  limit: 10
});
```

#### Optimize Query Conditions

```typescript
// ❌ Bad: Broad date ranges and complex conditions
const query = createLoggableQuery({
  targetTypes: ['jobs'],
  conditions: {
    created_at: { gte: '2020-01-01' }, // Too broad
    or: [
      { action: { contains: 'update' } },
      { details: { contains: 'status' } }
    ] // Complex text searches
  }
});

// ✅ Good: Specific conditions with indexes
const query = createLoggableQuery({
  targetTypes: ['jobs'],
  conditions: {
    created_at: { gte: '2025-08-01' }, // Recent data only
    action: { in: ['created', 'updated', 'completed'] }, // Specific values
    loggable_id: entityId // Use indexed fields
  }
});
```

#### Limit Result Sets

```typescript
// ❌ Bad: Unlimited results
const query = createLoggableQuery({
  targetTypes: ['jobs']
  // No limit - could return thousands of records
});

// ✅ Good: Reasonable limits with pagination
const query = createLoggableQuery({
  targetTypes: ['jobs'],
  limit: 50, // Reasonable page size
  offset: page * 50 // Pagination support
});
```

### 2. Eager Loading Optimization

#### Minimize Eager Loading

```typescript
// ❌ Bad: Loading everything
const query = createLoggableQuery({
  targetTypes: ['jobs'],
  eagerLoad: [
    'user', 'loggableJob', 'loggableTask', 'loggableClient',
    'loggableUser', 'loggablePerson', 'metadata'
  ] // Too much data
});

// ✅ Good: Load only what's needed
const query = createLoggableQuery({
  targetTypes: ['jobs'],
  eagerLoad: ['user'] // Just the essential relationship
});
```

#### Conditional Eager Loading

```typescript
// Load different relationships based on context
function createOptimizedActivityQuery(context: 'list' | 'detail') {
  const baseOptions = {
    targetTypes: ['jobs', 'tasks'],
    orderBy: 'created_at DESC',
    limit: context === 'list' ? 20 : 5
  };

  if (context === 'list') {
    // Minimal data for list view
    return createLoggableQuery({
      ...baseOptions,
      eagerLoad: ['user'] // Just user for list
    });
  } else {
    // Full data for detail view
    return createLoggableQuery({
      ...baseOptions,
      eagerLoad: ['user', 'loggableJob', 'loggableTask'] // More complete data
    });
  }
}
```

### 3. Query Builder Optimization

#### Use the Query Builder for Complex Queries

```typescript
import { PolymorphicQueryBuilder } from '@/lib/zero/polymorphic';

// Optimized complex query
const optimizedQuery = new PolymorphicQueryBuilder('loggable')
  .forTargets(['jobs']) // Single target type first
  .withConditions({
    created_at: { gte: getRecentDate(7) },
    action: { in: ['status_changed', 'completed'] }
  })
  .withOrderBy('created_at DESC')
  .withLimit(25)
  .withCaching({ ttl: 300, key: 'recent-job-activity' })
  .build();
```

#### Optimize Query Plans

```typescript
export class OptimizedPolymorphicQueryBuilder extends PolymorphicQueryBuilder {
  protected optimizeQuery(): PolymorphicQueryOptions {
    const options = super.optimizeQuery();
    
    // Apply performance optimizations
    return {
      ...options,
      // Add query hints for database optimization
      hints: {
        useIndex: this.determineOptimalIndex(options),
        preferredJoinOrder: this.optimizeJoinOrder(options.targetTypes),
        estimatedRows: this.estimateResultSize(options)
      }
    };
  }

  private determineOptimalIndex(options: PolymorphicQueryOptions): string | undefined {
    const conditions = options.conditions || {};
    
    // Prefer time-based indexes for date queries
    if (conditions.created_at || conditions.updated_at) {
      return 'time_index';
    }
    
    // Prefer entity indexes for specific entity queries
    if (conditions.loggable_id && conditions.loggable_type) {
      return 'entity_index';
    }
    
    return undefined;
  }

  private optimizeJoinOrder(targetTypes?: string[]): string[] | undefined {
    if (!targetTypes || targetTypes.length <= 1) return undefined;
    
    // Order by expected result size (smaller tables first)
    const sizeHints = {
      'users': 100,
      'people': 500,
      'clients': 1000,
      'tasks': 5000,
      'jobs': 10000
    };
    
    return [...targetTypes].sort((a, b) => 
      (sizeHints[a] || 9999) - (sizeHints[b] || 9999)
    );
  }
}
```

## Caching Strategies

### 1. Multi-Level Caching

#### Query Result Caching

```typescript
import { executeCachedQuery, PolymorphicQueryCache } from '@/lib/zero/polymorphic';

// Configure cache with different TTL strategies
const cacheConfig = {
  hot: { ttl: 60 },      // 1 minute for frequently accessed data
  warm: { ttl: 300 },    // 5 minutes for moderately accessed data
  cold: { ttl: 1800 }    // 30 minutes for rarely accessed data
};

// Implement cache tier selection
function selectCacheTier(queryOptions: PolymorphicQueryOptions): 'hot' | 'warm' | 'cold' {
  // Hot cache for small, specific queries
  if (queryOptions.limit && queryOptions.limit <= 10 && queryOptions.conditions) {
    return 'hot';
  }
  
  // Warm cache for medium queries with conditions
  if (queryOptions.conditions && Object.keys(queryOptions.conditions).length > 0) {
    return 'warm';
  }
  
  // Cold cache for large or general queries
  return 'cold';
}

// Use tiered caching
async function executeTieredCachedQuery(type: PolymorphicType, options: PolymorphicQueryOptions) {
  const tier = selectCacheTier(options);
  const config = cacheConfig[tier];
  
  return executeCachedQuery(type, {
    ...options,
    caching: { 
      enabled: true, 
      ttl: config.ttl,
      key: generateOptimalCacheKey(type, options, tier)
    }
  });
}
```

#### Configuration Caching

```typescript
export class CachedPolymorphicTracker extends PolymorphicTracker {
  private configCache = new Map<string, { config: PolymorphicConfig; timestamp: number }>();
  private readonly CONFIG_CACHE_TTL = 300000; // 5 minutes

  async loadConfig(configPath?: string): Promise<void> {
    const cacheKey = configPath || 'default';
    const cached = this.configCache.get(cacheKey);
    
    // Check if cached config is still valid
    if (cached && (Date.now() - cached.timestamp) < this.CONFIG_CACHE_TTL) {
      this.setConfig(cached.config);
      return;
    }
    
    // Load from source
    await super.loadConfig(configPath);
    
    // Cache the loaded config
    const config = this.getConfig();
    if (config) {
      this.configCache.set(cacheKey, {
        config,
        timestamp: Date.now()
      });
    }
  }
}
```

### 2. Smart Cache Invalidation

```typescript
export class SmartCacheManager {
  private cacheInvalidationRules = new Map<string, CacheInvalidationRule[]>();

  constructor() {
    this.setupInvalidationRules();
  }

  private setupInvalidationRules(): void {
    // Invalidate activity logs when jobs are updated
    this.addRule('job_updated', [
      { pattern: 'loggable-jobs-*', reason: 'Job data changed' },
      { pattern: 'activity-summary-Job-*', reason: 'Job activity summary outdated' }
    ]);

    // Invalidate notes when entities are updated
    this.addRule('entity_updated', [
      { pattern: 'notable-*', reason: 'Entity notes may be affected' }
    ]);
  }

  addRule(event: string, patterns: CacheInvalidationRule[]): void {
    this.cacheInvalidationRules.set(event, patterns);
  }

  async onEntityUpdate(entityType: string, entityId: string): Promise<void> {
    const event = `${entityType.toLowerCase()}_updated`;
    const rules = this.cacheInvalidationRules.get(event);
    
    if (rules) {
      for (const rule of rules) {
        const pattern = rule.pattern.replace('*', `${entityType}-${entityId}`);
        await this.invalidateCachePattern(pattern);
      }
    }
  }

  private async invalidateCachePattern(pattern: string): Promise<void> {
    // Implementation depends on your cache system
    await polymorphicQueryCache.invalidatePattern(pattern);
  }
}

interface CacheInvalidationRule {
  pattern: string;
  reason: string;
}
```

### 3. Cache Warming Strategies

```typescript
export class CacheWarmingService {
  async warmCommonQueries(): Promise<void> {
    const commonQueries = [
      // Recent activity logs
      {
        type: 'loggable' as PolymorphicType,
        options: {
          targetTypes: ['jobs', 'tasks'],
          conditions: { created_at: { gte: this.getRecentDate(1) } },
          limit: 50
        },
        cacheKey: 'recent-activity-today'
      },
      
      // Job notes
      {
        type: 'notable' as PolymorphicType,
        options: {
          targetTypes: ['jobs'],
          orderBy: 'created_at DESC',
          limit: 20
        },
        cacheKey: 'recent-job-notes'
      },
      
      // Today's schedules
      {
        type: 'schedulable' as PolymorphicType,
        options: {
          targetTypes: ['jobs', 'tasks'],
          conditions: {
            scheduled_at: {
              gte: this.getStartOfDay(),
              lte: this.getEndOfDay()
            }
          }
        },
        cacheKey: 'todays-schedule'
      }
    ];

    // Warm caches in parallel
    await Promise.all(
      commonQueries.map(query => 
        executeCachedQuery(query.type, {
          ...query.options,
          caching: { enabled: true, ttl: 300, key: query.cacheKey }
        })
      )
    );
  }

  // Schedule cache warming
  startScheduledWarming(): void {
    // Warm cache every 5 minutes
    setInterval(() => this.warmCommonQueries(), 5 * 60 * 1000);
    
    // Warm cache on app startup
    this.warmCommonQueries();
  }

  private getRecentDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }

  private getStartOfDay(): string {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }

  private getEndOfDay(): string {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  }
}
```

## Memory Management

### 1. Query Result Size Management

```typescript
export class MemoryEfficientQueryManager {
  private readonly MAX_RESULT_SIZE = 1000; // Maximum results per query
  private readonly LARGE_QUERY_THRESHOLD = 100; // When to use streaming

  async executeQuery(query: PolymorphicQuery): Promise<PolymorphicQueryResult> {
    const estimatedSize = this.estimateResultSize(query.options);
    
    if (estimatedSize > this.LARGE_QUERY_THRESHOLD) {
      return this.executeStreamingQuery(query);
    } else {
      return query.execute();
    }
  }

  private async executeStreamingQuery(query: PolymorphicQuery): Promise<PolymorphicQueryResult> {
    const batchSize = 50;
    let offset = 0;
    let allResults: any[] = [];
    let hasMore = true;

    while (hasMore && allResults.length < this.MAX_RESULT_SIZE) {
      const batchQuery = new PolymorphicQuery(query.type, {
        ...query.options,
        limit: batchSize,
        offset: offset
      });

      const batch = await batchQuery.execute();
      allResults = allResults.concat(batch.data);
      
      hasMore = batch.data.length === batchSize;
      offset += batchSize;
    }

    return {
      data: allResults,
      metadata: {
        total: allResults.length,
        targetCounts: this.calculateTargetCounts(allResults),
        executionTime: 0, // Calculated elsewhere
        fromCache: false
      }
    };
  }

  private estimateResultSize(options: PolymorphicQueryOptions): number {
    // Estimation based on conditions and target types
    let estimate = 100; // Base estimate

    if (options.targetTypes) {
      estimate *= options.targetTypes.length;
    }

    if (!options.conditions || Object.keys(options.conditions).length === 0) {
      estimate *= 10; // Unconditioned queries are larger
    }

    if (options.limit) {
      estimate = Math.min(estimate, options.limit);
    }

    return estimate;
  }
}
```

### 2. Reactive Query Memory Management

```typescript
export class MemoryManagedReactiveQuery extends ReactivePolymorphicQuery {
  private readonly MAX_SUBSCRIBERS = 10;
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute
  private cleanupTimer?: NodeJS.Timeout;

  constructor(type: PolymorphicType, options: ReactiveQueryOptions) {
    super(type, options);
    this.startCleanupTimer();
  }

  subscribe(callback: (result: PolymorphicQueryResult) => void): () => void {
    if (this.subscribers.size >= this.MAX_SUBSCRIBERS) {
      console.warn('Maximum subscribers reached for reactive query');
      // Remove oldest subscriber
      const oldestSubscriber = this.subscribers.values().next().value;
      this.unsubscribe(oldestSubscriber);
    }

    return super.subscribe(callback);
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performMemoryCleanup();
    }, this.CLEANUP_INTERVAL);
  }

  private performMemoryCleanup(): void {
    // Clear old cached results
    if (this.cachedResult && this.shouldClearCache()) {
      this.cachedResult = null;
    }

    // Clean up inactive subscribers
    this.removeInactiveSubscribers();
  }

  private shouldClearCache(): boolean {
    if (!this.lastFetch) return true;
    
    const cacheAge = Date.now() - this.lastFetch;
    return cacheAge > (this.options.refreshInterval || 30000) * 2;
  }

  cleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    super.cleanup();
  }
}
```

### 3. Configuration Memory Optimization

```typescript
export class MemoryOptimizedConfig {
  private static readonly INACTIVE_TARGET_CLEANUP_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

  static optimizeConfig(config: PolymorphicConfig): PolymorphicConfig {
    const optimized: PolymorphicConfig = {
      ...config,
      associations: {}
    };

    Object.entries(config.associations).forEach(([type, association]) => {
      optimized.associations[type] = {
        ...association,
        validTargets: this.cleanupInactiveTargets(association.validTargets)
      };
    });

    return optimized;
  }

  private static cleanupInactiveTargets(
    targets: Record<string, PolymorphicTargetMetadata>
  ): Record<string, PolymorphicTargetMetadata> {
    const cutoffDate = new Date(Date.now() - this.INACTIVE_TARGET_CLEANUP_AGE);
    const cleaned: Record<string, PolymorphicTargetMetadata> = {};

    Object.entries(targets).forEach(([name, metadata]) => {
      // Keep active targets and recently verified inactive targets
      const lastVerified = new Date(metadata.lastVerifiedAt);
      
      if (metadata.active || lastVerified > cutoffDate) {
        cleaned[name] = metadata;
      }
    });

    return cleaned;
  }
}
```

## Database Optimization

### 1. Index Recommendations

Based on polymorphic query patterns, these database indexes are recommended:

```sql
-- Primary polymorphic indexes
CREATE INDEX idx_activity_logs_polymorphic ON activity_logs(loggable_type, loggable_id);
CREATE INDEX idx_notes_polymorphic ON notes(notable_type, notable_id);
CREATE INDEX idx_scheduled_date_times_polymorphic ON scheduled_date_times(schedulable_type, schedulable_id);
CREATE INDEX idx_job_targets_polymorphic ON job_targets(target_type, target_id);
CREATE INDEX idx_parsed_emails_polymorphic ON parsed_emails(parseable_type, parseable_id);

-- Time-based indexes for common queries
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX idx_scheduled_date_times_scheduled_at ON scheduled_date_times(scheduled_at);

-- Composite indexes for common query patterns
CREATE INDEX idx_activity_logs_user_time ON activity_logs(user_id, created_at DESC);
CREATE INDEX idx_activity_logs_action_time ON activity_logs(action, created_at DESC);

-- Partial indexes for active records only (PostgreSQL)
CREATE INDEX idx_activity_logs_active_recent ON activity_logs(loggable_type, loggable_id, created_at) 
WHERE created_at > NOW() - INTERVAL '30 days';
```

### 2. Query Optimization Hints

```typescript
export class DatabaseOptimizedQuery extends PolymorphicQuery {
  protected generateDatabaseHints(): QueryHints {
    const hints: QueryHints = {};

    // Suggest index usage based on query patterns
    const conditions = this.options.conditions || {};

    if (conditions.created_at || conditions.updated_at) {
      hints.preferredIndex = 'time_index';
      hints.orderOptimization = 'index_scan';
    }

    if (conditions.loggable_id && conditions.loggable_type) {
      hints.preferredIndex = 'polymorphic_index';
      hints.joinStrategy = 'nested_loop';
    }

    // Estimate query cost
    hints.estimatedCost = this.estimateQueryCost();
    
    return hints;
  }

  private estimateQueryCost(): 'low' | 'medium' | 'high' {
    const conditions = this.options.conditions || {};
    const hasTimeCondition = conditions.created_at || conditions.updated_at;
    const hasEntityCondition = conditions.loggable_id || conditions.notable_id;
    const targetCount = this.options.targetTypes?.length || 1;
    const limit = this.options.limit;

    // Low cost: specific entity with time bounds
    if (hasEntityCondition && hasTimeCondition && limit && limit <= 50) {
      return 'low';
    }

    // High cost: no conditions or many target types
    if (!hasEntityCondition && !hasTimeCondition || targetCount > 3) {
      return 'high';
    }

    return 'medium';
  }
}

interface QueryHints {
  preferredIndex?: string;
  joinStrategy?: 'nested_loop' | 'hash_join' | 'merge_join';
  orderOptimization?: 'index_scan' | 'sort';
  estimatedCost?: 'low' | 'medium' | 'high';
}
```

## Monitoring and Metrics

### 1. Performance Monitoring

```typescript
export class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric[]>();
  private alerts: PerformanceAlert[] = [];

  recordQuery(type: PolymorphicType, executionTime: number, options: PolymorphicQueryOptions): void {
    const metric: PerformanceMetric = {
      type,
      executionTime,
      timestamp: Date.now(),
      targetTypes: options.targetTypes || [],
      hasConditions: !!options.conditions,
      fromCache: false // Set by caller
    };

    this.addMetric(type, metric);
    this.checkPerformanceThresholds(metric);
  }

  private addMetric(type: PolymorphicType, metric: PerformanceMetric): void {
    if (!this.metrics.has(type)) {
      this.metrics.set(type, []);
    }

    const typeMetrics = this.metrics.get(type)!;
    typeMetrics.push(metric);

    // Keep only recent metrics (last 1000 or 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const filtered = typeMetrics.filter(m => m.timestamp > oneHourAgo).slice(-1000);
    this.metrics.set(type, filtered);
  }

  private checkPerformanceThresholds(metric: PerformanceMetric): void {
    // Alert on slow queries
    if (metric.executionTime > 5000) { // 5 seconds
      this.alerts.push({
        type: 'slow_query',
        severity: 'critical',
        message: `Very slow query detected: ${metric.executionTime}ms`,
        metric,
        timestamp: Date.now()
      });
    } else if (metric.executionTime > 2000) { // 2 seconds
      this.alerts.push({
        type: 'slow_query',
        severity: 'warning',
        message: `Slow query detected: ${metric.executionTime}ms`,
        metric,
        timestamp: Date.now()
      });
    }
  }

  getPerformanceReport(): PerformanceReport {
    const report: PerformanceReport = {
      summary: {
        totalQueries: 0,
        averageExecutionTime: 0,
        slowQueries: 0,
        errorRate: 0
      },
      byType: {},
      recentAlerts: this.alerts.slice(-10),
      recommendations: []
    };

    // Calculate metrics by type
    this.metrics.forEach((metrics, type) => {
      const typeReport = this.calculateTypeMetrics(metrics);
      report.byType[type] = typeReport;
      report.summary.totalQueries += typeReport.queryCount;
    });

    // Calculate overall averages
    if (report.summary.totalQueries > 0) {
      const totalTime = Object.values(report.byType)
        .reduce((sum, type) => sum + (type.averageTime * type.queryCount), 0);
      report.summary.averageExecutionTime = totalTime / report.summary.totalQueries;
    }

    // Generate recommendations
    report.recommendations = this.generateRecommendations(report);

    return report;
  }

  private calculateTypeMetrics(metrics: PerformanceMetric[]): TypeMetrics {
    return {
      queryCount: metrics.length,
      averageTime: metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length,
      slowQueryCount: metrics.filter(m => m.executionTime > 2000).length,
      cacheHitRate: metrics.filter(m => m.fromCache).length / metrics.length,
      recentTrend: this.calculateTrend(metrics)
    };
  }

  private generateRecommendations(report: PerformanceReport): string[] {
    const recommendations: string[] = [];

    // Check for slow queries
    const slowQueryRate = report.summary.slowQueries / report.summary.totalQueries;
    if (slowQueryRate > 0.1) {
      recommendations.push('High slow query rate detected - consider query optimization');
    }

    // Check cache hit rates
    Object.entries(report.byType).forEach(([type, metrics]) => {
      if (metrics.cacheHitRate < 0.5) {
        recommendations.push(`Low cache hit rate for ${type} queries - increase TTL or improve cache keys`);
      }
    });

    return recommendations;
  }
}

interface PerformanceMetric {
  type: PolymorphicType;
  executionTime: number;
  timestamp: number;
  targetTypes: string[];
  hasConditions: boolean;
  fromCache: boolean;
}

interface PerformanceAlert {
  type: string;
  severity: 'warning' | 'critical';
  message: string;
  metric: PerformanceMetric;
  timestamp: number;
}
```

### 2. Real-time Performance Dashboard

```typescript
export class PerformanceDashboard {
  private monitor: PerformanceMonitor;
  private updateInterval: NodeJS.Timeout;

  constructor(monitor: PerformanceMonitor) {
    this.monitor = monitor;
    this.startRealTimeUpdates();
  }

  private startRealTimeUpdates(): void {
    this.updateInterval = setInterval(() => {
      this.updateDashboard();
    }, 5000); // Update every 5 seconds
  }

  private updateDashboard(): void {
    const report = this.monitor.getPerformanceReport();
    
    console.clear();
    console.log('🚀 Polymorphic System Performance Dashboard');
    console.log('==========================================');
    
    // Summary
    console.log(`📊 Total Queries: ${report.summary.totalQueries}`);
    console.log(`⏱️  Average Time: ${report.summary.averageExecutionTime.toFixed(2)}ms`);
    console.log(`🐌 Slow Queries: ${report.summary.slowQueries}`);
    
    // By type breakdown
    console.log('\n📈 Performance by Type:');
    Object.entries(report.byType).forEach(([type, metrics]) => {
      console.log(`  ${type}:`);
      console.log(`    Queries: ${metrics.queryCount}`);
      console.log(`    Avg Time: ${metrics.averageTime.toFixed(2)}ms`);
      console.log(`    Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
      console.log(`    Trend: ${metrics.recentTrend}`);
    });

    // Recent alerts
    if (report.recentAlerts.length > 0) {
      console.log('\n🚨 Recent Alerts:');
      report.recentAlerts.slice(-3).forEach(alert => {
        const icon = alert.severity === 'critical' ? '🔴' : '🟡';
        console.log(`  ${icon} ${alert.message}`);
      });
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }
  }

  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}
```

## Best Practices

### 1. Query Design Best Practices

1. **Use specific target types**: Only query the entity types you need
2. **Add meaningful conditions**: Avoid broad, unconditioned queries
3. **Implement pagination**: Use reasonable limits and offsets
4. **Optimize eager loading**: Load only necessary relationships
5. **Use appropriate cache TTL**: Balance freshness with performance

### 2. Caching Best Practices

1. **Layer your caches**: Use different TTLs for different query types
2. **Generate consistent cache keys**: Ensure reliable cache hits
3. **Implement smart invalidation**: Clear cache when underlying data changes
4. **Monitor cache performance**: Track hit rates and adjust strategy
5. **Warm critical caches**: Pre-load commonly accessed data

### 3. Memory Management Best Practices

1. **Clean up reactive queries**: Always call cleanup() when done
2. **Limit result set sizes**: Use reasonable query limits
3. **Implement pagination**: Don't load large datasets at once
4. **Monitor memory usage**: Track and alert on memory growth
5. **Clean up inactive resources**: Remove unused configurations and caches

## Performance Testing

### 1. Load Testing

```typescript
export class PerformanceTestSuite {
  async runLoadTest(): Promise<void> {
    console.log('🚀 Starting polymorphic system load test...');

    const testCases = [
      { name: 'Simple Loggable Query', test: () => this.testSimpleQuery() },
      { name: 'Complex Multi-Target Query', test: () => this.testComplexQuery() },
      { name: 'Cached Query Performance', test: () => this.testCachedQuery() },
      { name: 'Concurrent Queries', test: () => this.testConcurrentQueries() }
    ];

    for (const testCase of testCases) {
      await this.runTestCase(testCase);
    }
  }

  private async runTestCase(testCase: { name: string; test: () => Promise<void> }): Promise<void> {
    console.log(`\n📋 Running: ${testCase.name}`);
    
    const iterations = 100;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await testCase.test();
      const end = performance.now();
      times.push(end - start);
    }

    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log(`  ✅ Completed ${iterations} iterations`);
    console.log(`  📊 Average: ${avgTime.toFixed(2)}ms`);
    console.log(`  📊 Min: ${minTime.toFixed(2)}ms`);
    console.log(`  📊 Max: ${maxTime.toFixed(2)}ms`);
    
    if (avgTime > 1000) {
      console.warn(`  ⚠️  Average time exceeds 1000ms threshold`);
    }
  }

  private async testSimpleQuery(): Promise<void> {
    const query = createLoggableQuery({
      targetTypes: ['jobs'],
      limit: 10
    });
    await query.execute();
  }

  private async testComplexQuery(): Promise<void> {
    const query = createLoggableQuery({
      targetTypes: ['jobs', 'tasks', 'clients'],
      conditions: {
        created_at: { gte: '2025-08-01' },
        action: { in: ['created', 'updated'] }
      },
      eagerLoad: ['user'],
      limit: 50
    });
    await query.execute();
  }

  private async testCachedQuery(): Promise<void> {
    const result = await executeCachedQuery('loggable', {
      targetTypes: ['jobs'],
      limit: 10,
      cacheKey: 'performance-test',
      ttl: 300
    });
  }

  private async testConcurrentQueries(): Promise<void> {
    const queries = Array(10).fill(null).map(() => 
      createLoggableQuery({
        targetTypes: ['jobs'],
        limit: 5
      }).execute()
    );

    await Promise.all(queries);
  }
}

// Run performance tests
const testSuite = new PerformanceTestSuite();
await testSuite.runLoadTest();
```

### 2. Memory Usage Testing

```typescript
export class MemoryTestSuite {
  async runMemoryTests(): Promise<void> {
    console.log('🧠 Starting memory usage tests...');

    await this.testReactiveQueryMemory();
    await this.testCacheMemoryUsage();
    await this.testConfigMemoryOptimization();
  }

  private async testReactiveQueryMemory(): Promise<void> {
    console.log('\n📡 Testing reactive query memory usage...');

    const initialMemory = process.memoryUsage();
    const queries: ReactivePolymorphicQuery[] = [];

    // Create multiple reactive queries
    for (let i = 0; i < 50; i++) {
      const query = createReactiveLoggableQuery({
        targetTypes: ['jobs'],
        autoRefresh: true
      });
      queries.push(query);
    }

    const peakMemory = process.memoryUsage();
    
    // Cleanup all queries
    queries.forEach(query => query.cleanup());
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage();

    console.log(`  Initial Memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
    console.log(`  Peak Memory: ${Math.round(peakMemory.heapUsed / 1024 / 1024)}MB`);
    console.log(`  Final Memory: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
    console.log(`  Memory Growth: ${Math.round((peakMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024)}MB`);
    console.log(`  Memory Cleanup: ${Math.round((peakMemory.heapUsed - finalMemory.heapUsed) / 1024 / 1024)}MB`);
  }

  private async testCacheMemoryUsage(): Promise<void> {
    console.log('\n💾 Testing cache memory usage...');

    const initialMemory = process.memoryUsage();

    // Fill cache with test data
    for (let i = 0; i < 1000; i++) {
      await executeCachedQuery('loggable', {
        targetTypes: ['jobs'],
        conditions: { id: i.toString() },
        cacheKey: `memory-test-${i}`,
        ttl: 300
      });
    }

    const cacheMemory = process.memoryUsage();

    // Clear cache
    polymorphicQueryCache.clear();

    const clearedMemory = process.memoryUsage();

    console.log(`  Initial Memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
    console.log(`  Cache Memory: ${Math.round(cacheMemory.heapUsed / 1024 / 1024)}MB`);
    console.log(`  Cleared Memory: ${Math.round(clearedMemory.heapUsed / 1024 / 1024)}MB`);
    console.log(`  Cache Overhead: ${Math.round((cacheMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024)}MB`);
  }
}
```

This comprehensive performance guide provides strategies and tools for optimizing the Polymorphic Tracking System across all performance dimensions. Regular monitoring and optimization using these techniques will ensure the system performs well under production loads.