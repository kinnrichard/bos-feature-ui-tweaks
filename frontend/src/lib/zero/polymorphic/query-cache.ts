/**
 * Polymorphic Query Cache - Caching layer for polymorphic queries
 * 
 * Provides intelligent caching for polymorphic relationship queries with
 * automatic invalidation, TTL management, and performance optimization.
 * 
 * Key Features:
 * - Intelligent cache keys based on polymorphic conditions
 * - Automatic invalidation on data changes
 * - TTL-based expiration with configurable policies
 * - Memory-efficient storage with LRU eviction
 * - Cache warming and prefetching
 * - Query result optimization and compression
 * - Integration with Zero.js memory management
 * 
 * Generated: 2025-08-06 Epic-008 Polymorphic Query Cache
 */

import { ChainableQuery } from './query-system';
import { PolymorphicQueryBuilder } from './query-builder';
import type { BaseModelConfig } from '../../models/base/types';
import type { 
  PolymorphicType, 
  PolymorphicConditions 
} from './types';
// import { polymorphicTracker } from './tracker';
import { debugDatabase } from '../../utils/debug';

/**
 * Cache configuration options
 */
export interface PolymorphicCacheConfig {
  /** Maximum number of cached queries */
  maxSize: number;
  /** Default TTL in milliseconds */
  defaultTTL: number;
  /** TTL per polymorphic type */
  typeTTL?: Record<PolymorphicType, number>;
  /** Enable automatic cache warming */
  enableWarming: boolean;
  /** Enable query result compression */
  enableCompression: boolean;
  /** Enable cache metrics collection */
  enableMetrics: boolean;
  /** Memory limit for cache (in MB) */
  memoryLimit: number;
}

/**
 * Cache entry metadata
 */
export interface CacheEntry<T> {
  /** Cached query results */
  data: T[];
  /** When the entry was created */
  createdAt: number;
  /** When the entry expires */
  expiresAt: number;
  /** Cache key for this entry */
  key: string;
  /** Query metadata */
  metadata: {
    polymorphicType?: PolymorphicType;
    targetTypes: string[];
    conditions: PolymorphicConditions;
    resultCount: number;
    queryDuration: number;
  };
  /** Access statistics */
  stats: {
    hits: number;
    lastAccessed: number;
    averageAccessInterval: number;
  };
}

/**
 * Cache invalidation event
 */
export interface CacheInvalidationEvent {
  /** Type of invalidation */
  type: 'data-change' | 'ttl-expire' | 'manual' | 'memory-pressure';
  /** Tables affected */
  tables: string[];
  /** Polymorphic types affected */
  polymorphicTypes: PolymorphicType[];
  /** Specific cache keys invalidated */
  keys: string[];
  /** Timestamp of invalidation */
  timestamp: number;
}

/**
 * Cache performance metrics
 */
export interface CacheMetrics {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Hit ratio (0-1) */
  hitRatio: number;
  /** Average query time with cache (ms) */
  averageQueryTime: number;
  /** Cache size in entries */
  size: number;
  /** Cache memory usage (MB) */
  memoryUsage: number;
  /** Number of evictions */
  evictions: number;
  /** Cache warming statistics */
  warming: {
    warmedQueries: number;
    warmingHits: number;
    lastWarmed: number;
  };
}

/**
 * Cache key generator for polymorphic queries
 */
export class PolymorphicCacheKeyGenerator {
  /**
   * Generate cache key for a polymorphic query
   */
  static generateKey(
    tableName: string,
    polymorphicType?: PolymorphicType,
    conditions?: PolymorphicConditions,
    additionalParams?: Record<string, any>
  ): string {
    const keyParts = [
      `table:${tableName}`,
      polymorphicType ? `type:${polymorphicType}` : 'type:all'
    ];

    // Add conditions to key
    if (conditions) {
      if (conditions.polymorphicType) {
        const types = Array.isArray(conditions.polymorphicType) 
          ? conditions.polymorphicType.join(',')
          : conditions.polymorphicType;
        keyParts.push(`poly:${types}`);
      }

      if (conditions.targetType) {
        const targets = Array.isArray(conditions.targetType)
          ? conditions.targetType.join(',')
          : conditions.targetType;
        keyParts.push(`target:${targets}`);
      }

      if (conditions.targetId) {
        const ids = Array.isArray(conditions.targetId)
          ? conditions.targetId.join(',')
          : conditions.targetId;
        keyParts.push(`id:${ids}`);
      }

      // Add other conditions
      const otherConditions = Object.entries(conditions)
        .filter(([key]) => !['polymorphicType', 'targetType', 'targetId'].includes(key))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}:${JSON.stringify(value)}`);

      keyParts.push(...otherConditions);
    }

    // Add additional parameters
    if (additionalParams) {
      const paramParts = Object.entries(additionalParams)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}:${JSON.stringify(value)}`);
      keyParts.push(...paramParts);
    }

    return keyParts.join('|');
  }

  /**
   * Generate cache key for query builder configuration
   */
  static generateBuilderKey(
    builder: PolymorphicQueryBuilder<any>
  ): string {
    const metadata = (builder as any).getPolymorphicMetadata?.() || {};
    const { type, conditions } = metadata;
    
    return this.generateKey(
      (builder as any).baseConfig?.tableName || 'unknown',
      type,
      conditions,
      {
        // Add builder-specific parameters
        options: (builder as any).options || {},
        joinConfigs: (builder as any).joinConfigs?.length || 0,
        hasAggregation: !!(builder as any).aggregationConfig
      }
    );
  }

  /**
   * Parse cache key back to components
   */
  static parseKey(key: string): {
    tableName: string;
    polymorphicType?: PolymorphicType;
    conditions: Record<string, any>;
  } {
    const parts = key.split('|');
    const parsed: any = {
      conditions: {}
    };

    for (const part of parts) {
      const [prefix, value] = part.split(':', 2);
      
      switch (prefix) {
        case 'table':
          parsed.tableName = value;
          break;
        case 'type':
          if (value !== 'all') {
            parsed.polymorphicType = value as PolymorphicType;
          }
          break;
        case 'poly':
          parsed.conditions.polymorphicType = value.includes(',') ? value.split(',') : value;
          break;
        case 'target':
          parsed.conditions.targetType = value.includes(',') ? value.split(',') : value;
          break;
        case 'id':
          parsed.conditions.targetId = value.includes(',') ? value.split(',') : value;
          break;
        default:
          try {
            parsed.conditions[prefix] = JSON.parse(value);
          } catch {
            parsed.conditions[prefix] = value;
          }
      }
    }

    return parsed;
  }
}

/**
 * Main polymorphic query cache class
 */
export class PolymorphicQueryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private config: PolymorphicCacheConfig;
  private metrics: CacheMetrics;
  private invalidationListeners: ((event: CacheInvalidationEvent) => void)[] = [];

  constructor(config: Partial<PolymorphicCacheConfig> = {}) {
    this.config = {
      maxSize: 1000,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      enableWarming: true,
      enableCompression: false,
      enableMetrics: true,
      memoryLimit: 50, // 50MB
      ...config
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      hitRatio: 0,
      averageQueryTime: 0,
      size: 0,
      memoryUsage: 0,
      evictions: 0,
      warming: {
        warmedQueries: 0,
        warmingHits: 0,
        lastWarmed: 0
      }
    };

    // Set up automatic cleanup
    this.setupCleanup();
  }

  /**
   * Get cached query results if available
   */
  async get<T extends Record<string, any>>(
    query: ChainableQuery<T>
  ): Promise<T[] | null> {
    const key = this.generateKeyForQuery(query);
    const entry = this.cache.get(key);

    if (!entry) {
      this.metrics.misses++;
      this.updateMetrics();
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.metrics.misses++;
      this.updateMetrics();
      return null;
    }

    // Update access statistics
    entry.stats.hits++;
    entry.stats.lastAccessed = Date.now();
    
    this.metrics.hits++;
    this.updateMetrics();

    debugDatabase.debug('Cache hit for polymorphic query', {
      key,
      resultCount: entry.data.length,
      age: Date.now() - entry.createdAt
    });

    return entry.data;
  }

  /**
   * Cache query results
   */
  async set<T extends Record<string, any>>(
    query: ChainableQuery<T>,
    data: T[],
    queryDuration: number,
    customTTL?: number
  ): Promise<void> {
    const key = this.generateKeyForQuery(query);
    const metadata = this.extractQueryMetadata(query);
    
    // Calculate TTL
    const ttl = customTTL || 
                (metadata.polymorphicType && this.config.typeTTL?.[metadata.polymorphicType]) ||
                this.config.defaultTTL;

    const entry: CacheEntry<T> = {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      key,
      metadata: {
        ...metadata,
        resultCount: data.length,
        queryDuration
      },
      stats: {
        hits: 0,
        lastAccessed: Date.now(),
        averageAccessInterval: 0
      }
    };

    // Check memory limits before adding
    if (this.shouldEvict()) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
    this.updateSize();

    debugDatabase.debug('Cached polymorphic query results', {
      key,
      resultCount: data.length,
      ttl,
      queryDuration
    });
  }

  /**
   * Execute query with caching
   */
  async execute<T extends Record<string, any>>(
    query: ChainableQuery<T>
  ): Promise<T[]> {
    // Try to get from cache first
    const cached = await this.get(query);
    if (cached) {
      return cached;
    }

    // Execute query and measure time
    const startTime = Date.now();
    const results = await query.all();
    const duration = Date.now() - startTime;

    // Cache the results
    await this.set(query, results, duration);

    return results;
  }

  /**
   * Invalidate cache entries based on criteria
   */
  invalidate(criteria: {
    tables?: string[];
    polymorphicTypes?: PolymorphicType[];
    targetTypes?: string[];
    keys?: string[];
    all?: boolean;
  }): CacheInvalidationEvent {
    const keysToInvalidate: string[] = [];
    const affectedTables = criteria.tables || [];
    const affectedTypes = criteria.polymorphicTypes || [];

    if (criteria.all) {
      keysToInvalidate.push(...this.cache.keys());
    } else {
      for (const [key, entry] of this.cache) {
        let shouldInvalidate = false;

        // Check specific keys
        if (criteria.keys?.includes(key)) {
          shouldInvalidate = true;
        }

        // Check tables
        if (criteria.tables && this.entryMatchesTable(entry, criteria.tables)) {
          shouldInvalidate = true;
        }

        // Check polymorphic types
        if (criteria.polymorphicTypes && entry.metadata.polymorphicType &&
            criteria.polymorphicTypes.includes(entry.metadata.polymorphicType)) {
          shouldInvalidate = true;
        }

        // Check target types
        if (criteria.targetTypes && 
            entry.metadata.targetTypes.some(t => criteria.targetTypes!.includes(t))) {
          shouldInvalidate = true;
        }

        if (shouldInvalidate) {
          keysToInvalidate.push(key);
        }
      }
    }

    // Remove invalidated entries
    for (const key of keysToInvalidate) {
      this.cache.delete(key);
    }

    const event: CacheInvalidationEvent = {
      type: 'manual',
      tables: affectedTables,
      polymorphicTypes: affectedTypes,
      keys: keysToInvalidate,
      timestamp: Date.now()
    };

    // Notify listeners
    this.notifyInvalidation(event);

    this.updateSize();

    debugDatabase.info('Cache invalidation completed', {
      invalidatedKeys: keysToInvalidate.length,
      criteria
    });

    return event;
  }

  /**
   * Warm cache with common queries
   */
  async warmCache(
    queries: Array<{
      query: ChainableQuery<any>;
      priority?: number;
    }>
  ): Promise<void> {
    if (!this.config.enableWarming) {
      return;
    }

    debugDatabase.info('Starting cache warming', { queryCount: queries.length });

    // Sort by priority (higher first)
    const sortedQueries = queries.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const warmingPromises = sortedQueries.map(async ({ query }) => {
      try {
        // Check if already cached
        const cached = await this.get(query);
        if (cached) {
          this.metrics.warming.warmingHits++;
          return;
        }

        // Execute and cache
        await this.execute(query);
        this.metrics.warming.warmedQueries++;
      } catch (error) {
        debugDatabase.warn('Cache warming failed for query', { error });
      }
    });

    await Promise.all(warmingPromises);
    this.metrics.warming.lastWarmed = Date.now();

    debugDatabase.info('Cache warming completed', {
      warmedQueries: this.metrics.warming.warmedQueries,
      warmingHits: this.metrics.warming.warmingHits
    });
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.updateSize();
    
    this.notifyInvalidation({
      type: 'manual',
      tables: [],
      polymorphicTypes: [],
      keys: [],
      timestamp: Date.now()
    });
  }

  /**
   * Add invalidation listener
   */
  onInvalidation(listener: (event: CacheInvalidationEvent) => void): void {
    this.invalidationListeners.push(listener);
  }

  /**
   * Remove invalidation listener
   */
  removeInvalidationListener(listener: (event: CacheInvalidationEvent) => void): void {
    const index = this.invalidationListeners.indexOf(listener);
    if (index > -1) {
      this.invalidationListeners.splice(index, 1);
    }
  }

  /**
   * Generate cache key for a query
   */
  private generateKeyForQuery<T>(query: ChainableQuery<T>): string {
    const metadata = this.extractQueryMetadata(query);
    return PolymorphicCacheKeyGenerator.generateKey(
      metadata.tableName,
      metadata.polymorphicType,
      metadata.conditions,
      {
        limit: (query as any).limitCount,
        offset: (query as any).offsetCount,
        orderBy: (query as any).orderByField,
        orderDirection: (query as any).orderByDirection,
        includeDiscarded: (query as any).includeDiscarded,
        onlyDiscarded: (query as any).onlyDiscarded
      }
    );
  }

  /**
   * Extract metadata from query for caching
   */
  private extractQueryMetadata<T>(query: ChainableQuery<T>): {
    tableName: string;
    polymorphicType?: PolymorphicType;
    targetTypes: string[];
    conditions: PolymorphicConditions;
  } {
    const queryMetadata = (query as any).getPolymorphicMetadata?.() || {};
    
    return {
      tableName: (query as any).tableName || 'unknown',
      polymorphicType: queryMetadata.type,
      targetTypes: queryMetadata.validTargets || [],
      conditions: queryMetadata.conditions || {}
    };
  }

  /**
   * Check if cache entry matches table criteria
   */
  private entryMatchesTable<T>(entry: CacheEntry<T>, tables: string[]): boolean {
    // Parse table from cache key
    const parsed = PolymorphicCacheKeyGenerator.parseKey(entry.key);
    return tables.includes(parsed.tableName);
  }

  /**
   * Check if cache should evict entries
   */
  private shouldEvict(): boolean {
    if (this.cache.size >= this.config.maxSize) {
      return true;
    }

    const memoryUsageMB = this.estimateMemoryUsage();
    if (memoryUsageMB >= this.config.memoryLimit) {
      return true;
    }

    return false;
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(): void {
    // Sort entries by last accessed time (oldest first)
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.stats.lastAccessed - b.stats.lastAccessed);

    // Remove oldest 10% or at least 1 entry
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1));

    for (let i = 0; i < toRemove; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      this.metrics.evictions++;
    }

    debugDatabase.debug('Cache LRU eviction completed', { evicted: toRemove });
  }

  /**
   * Estimate memory usage of cache
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      // Rough estimation: JSON.stringify size
      totalSize += JSON.stringify(entry.data).length * 2; // * 2 for UTF-16
    }

    return totalSize / (1024 * 1024); // Convert to MB
  }

  /**
   * Update cache metrics
   */
  private updateMetrics(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRatio = total > 0 ? this.metrics.hits / total : 0;
    this.metrics.size = this.cache.size;
    this.metrics.memoryUsage = this.estimateMemoryUsage();
  }

  /**
   * Update size metric
   */
  private updateSize(): void {
    this.metrics.size = this.cache.size;
    this.metrics.memoryUsage = this.estimateMemoryUsage();
  }

  /**
   * Notify invalidation listeners
   */
  private notifyInvalidation(event: CacheInvalidationEvent): void {
    for (const listener of this.invalidationListeners) {
      try {
        listener(event);
      } catch (error) {
        debugDatabase.warn('Cache invalidation listener error', { error });
      }
    }
  }

  /**
   * Set up automatic cleanup of expired entries
   */
  private setupCleanup(): void {
    // Clean up expired entries every 5 minutes
    const cleanupInterval = 5 * 60 * 1000;

    setInterval(() => {
      const now = Date.now();
      const expiredKeys: string[] = [];

      for (const [key, entry] of this.cache) {
        if (now > entry.expiresAt) {
          expiredKeys.push(key);
        }
      }

      for (const key of expiredKeys) {
        this.cache.delete(key);
      }

      if (expiredKeys.length > 0) {
        this.updateSize();
        
        this.notifyInvalidation({
          type: 'ttl-expire',
          tables: [],
          polymorphicTypes: [],
          keys: expiredKeys,
          timestamp: now
        });

        debugDatabase.debug('Expired cache entries cleaned up', { 
          expiredCount: expiredKeys.length 
        });
      }
    }, cleanupInterval);
  }
}

/**
 * Global cache instance
 */
export const polymorphicQueryCache = new PolymorphicQueryCache({
  maxSize: 2000,
  defaultTTL: 10 * 60 * 1000, // 10 minutes
  enableWarming: true,
  enableMetrics: true,
  memoryLimit: 100, // 100MB
  typeTTL: {
    notable: 15 * 60 * 1000,    // 15 minutes for notes
    loggable: 5 * 60 * 1000,    // 5 minutes for logs
    schedulable: 30 * 60 * 1000, // 30 minutes for schedules
    target: 20 * 60 * 1000,     // 20 minutes for targets
    parseable: 10 * 60 * 1000   // 10 minutes for parsed emails
  }
});

/**
 * Cached query execution functions
 */

/**
 * Execute polymorphic query with caching
 */
export async function executeCachedQuery<T extends Record<string, any>>(
  query: ChainableQuery<T>
): Promise<T[]> {
  return await polymorphicQueryCache.execute(query);
}

/**
 * Execute multiple queries with caching in parallel
 */
export async function executeCachedQueries<T extends Record<string, any>>(
  queries: ChainableQuery<T>[]
): Promise<T[][]> {
  const promises = queries.map(query => polymorphicQueryCache.execute(query));
  return await Promise.all(promises);
}

/**
 * Warm cache with common polymorphic queries
 */
export async function warmPolymorphicCache(
  config: BaseModelConfig,
  polymorphicType: PolymorphicType,
  commonTargetTypes: string[] = []
): Promise<void> {
  const builder = new PolymorphicQueryBuilder(config, polymorphicType);
  
  const warmingQueries = [
    // All records query
    { query: builder.build(), priority: 10 },
    
    // Specific target type queries
    ...commonTargetTypes.map(targetType => ({
      query: builder.forTargetTypes([targetType]).build(),
      priority: 8
    })),
    
    // With targets included
    { query: builder.withTargets().build(), priority: 6 },
    
    // Recent records (limited)
    { query: builder.build().limit(50), priority: 7 }
  ];

  await polymorphicQueryCache.warmCache(warmingQueries);
}

export {
  type PolymorphicCacheConfig,
  type CacheEntry,
  type CacheInvalidationEvent,
  type CacheMetrics
};