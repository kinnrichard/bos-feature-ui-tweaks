/**
 * Polymorphic Query Builder - Advanced query construction for polymorphic relationships
 * 
 * Provides sophisticated query building capabilities for polymorphic associations
 * with support for complex conditions, joins, and optimization.
 * 
 * Key Features:
 * - Type-safe query construction
 * - Support for complex polymorphic joins
 * - Query optimization and batching
 * - Integration with ChainableQuery system
 * - Support for specific type queries (e.g., only Job notes)
 * - Advanced filtering and aggregation
 * 
 * Generated: 2025-08-06 Epic-008 Polymorphic Query Builder
 */

import { ChainableQuery, createPolymorphicQuery } from './query-system';
import type { BaseModelConfig } from '../../models/base/types';
import type { 
  PolymorphicType
} from './types';
import { getPolymorphicTracker } from './tracker';
import { debugDatabase } from '../../utils/debug';

/**
 * Advanced query options for polymorphic relationships
 */
export interface PolymorphicQueryOptions {
  /** Include target records in results */
  includeTargets?: boolean;
  /** Specific target types to include */
  targetTypes?: string[];
  /** Group results by target type */
  groupByTargetType?: boolean;
  /** Order by target type first, then by other criteria */
  orderByTargetType?: 'asc' | 'desc';
  /** Batch size for query optimization */
  batchSize?: number;
  /** Custom join conditions */
  customJoinConditions?: Record<string, any>;
}

/**
 * Join configuration for polymorphic relationships
 */
export interface PolymorphicJoinConfig {
  /** Type of join (inner, left, right) */
  joinType: 'inner' | 'left' | 'right';
  /** Source table and columns */
  source: {
    table: string;
    typeColumn: string;
    idColumn: string;
  };
  /** Target table and columns */
  target: {
    table: string;
    primaryKey: string;
  };
  /** Additional join conditions */
  conditions?: Record<string, any>;
}

/**
 * Aggregation configuration for polymorphic queries
 */
export interface PolymorphicAggregationConfig {
  /** Fields to aggregate */
  fields: string[];
  /** Aggregation functions to apply */
  functions: ('count' | 'sum' | 'avg' | 'min' | 'max')[];
  /** Group by target type */
  groupByTargetType?: boolean;
  /** Additional group by fields */
  groupByFields?: string[];
}

/**
 * Query plan for polymorphic operations
 */
export interface PolymorphicQueryPlan {
  /** Source table being queried */
  sourceTable: string;
  /** Polymorphic type involved */
  polymorphicType: PolymorphicType;
  /** Target types included in query */
  targetTypes: string[];
  /** Estimated query cost */
  estimatedCost: number;
  /** Query optimization recommendations */
  optimizations: string[];
  /** Join strategy to use */
  joinStrategy: 'single' | 'batch' | 'subquery';
}

/**
 * Advanced polymorphic query builder
 */
export class PolymorphicQueryBuilder<T extends Record<string, any>> {
  private baseConfig: BaseModelConfig;
  private polymorphicType?: PolymorphicType;
  private options: PolymorphicQueryOptions = {};
  private joinConfigs: PolymorphicJoinConfig[] = [];
  private aggregationConfig?: PolymorphicAggregationConfig;

  constructor(config: BaseModelConfig, polymorphicType?: PolymorphicType) {
    this.baseConfig = config;
    this.polymorphicType = polymorphicType;
  }

  /**
   * Configure query options
   * 
   * @example
   * ```typescript
   * const builder = new PolymorphicQueryBuilder(noteConfig, 'notable')
   *   .withOptions({
   *     includeTargets: true,
   *     targetTypes: ['Job', 'Task'],
   *     groupByTargetType: true
   *   });
   * ```
   */
  withOptions(options: PolymorphicQueryOptions): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  /**
   * Add custom join configuration
   * 
   * @example
   * ```typescript
   * builder.addJoin({
   *   joinType: 'left',
   *   source: { table: 'notes', typeColumn: 'notable_type', idColumn: 'notable_id' },
   *   target: { table: 'jobs', primaryKey: 'id' }
   * });
   * ```
   */
  addJoin(config: PolymorphicJoinConfig): this {
    this.joinConfigs.push(config);
    return this;
  }

  /**
   * Configure aggregation for the query
   * 
   * @example
   * ```typescript
   * builder.withAggregation({
   *   fields: ['id'],
   *   functions: ['count'],
   *   groupByTargetType: true
   * });
   * ```
   */
  withAggregation(config: PolymorphicAggregationConfig): this {
    this.aggregationConfig = config;
    return this;
  }

  /**
   * Build a query for specific target types only
   * 
   * @example
   * ```typescript
   * const jobNotes = await builder
   *   .forTargetTypes(['Job'])
   *   .build()
   *   .all();
   * ```
   */
  forTargetTypes(targetTypes: string[]): this {
    return this.withOptions({ targetTypes });
  }

  /**
   * Build a query that includes polymorphic targets
   * 
   * @example
   * ```typescript
   * const notesWithTargets = await builder
   *   .withTargets()
   *   .build()
   *   .all();
   * ```
   */
  withTargets(): this {
    return this.withOptions({ includeTargets: true });
  }

  /**
   * Build a query grouped by target type
   * 
   * @example
   * ```typescript
   * const groupedNotes = await builder
   *   .groupedByTargetType()
   *   .build()
   *   .all();
   * ```
   */
  groupedByTargetType(): this {
    return this.withOptions({ groupByTargetType: true });
  }

  /**
   * Build a batched query for large result sets
   * 
   * @example
   * ```typescript
   * const batchedQuery = builder
   *   .batched(100)
   *   .build();
   * ```
   */
  batched(batchSize: number): this {
    return this.withOptions({ batchSize });
  }

  /**
   * Analyze the query plan and suggest optimizations
   */
  async analyzeQueryPlan(): Promise<PolymorphicQueryPlan> {
    const validTargets = this.getValidTargetTypes();
    const targetTypes = this.options.targetTypes || validTargets;
    
    // Estimate query cost based on target types and options
    let estimatedCost = targetTypes.length * 10; // Base cost per target type
    
    const optimizations: string[] = [];
    let joinStrategy: 'single' | 'batch' | 'subquery' = 'single';

    // Add cost for joins
    if (this.options.includeTargets) {
      estimatedCost += targetTypes.length * 20; // Cost for joining targets
      
      if (targetTypes.length > 3) {
        optimizations.push('Consider batching queries for large number of target types');
        joinStrategy = 'batch';
      }
    }

    // Add cost for aggregation
    if (this.aggregationConfig) {
      estimatedCost += this.aggregationConfig.fields.length * 5;
      
      if (this.aggregationConfig.groupByTargetType) {
        optimizations.push('Grouping by target type may benefit from indexing on type columns');
      }
    }

    // Suggest optimizations based on configuration
    if (this.options.batchSize && this.options.batchSize > 1000) {
      optimizations.push('Large batch sizes may cause memory issues, consider smaller batches');
    }

    if (!this.options.targetTypes && validTargets.length > 5) {
      optimizations.push('Consider filtering to specific target types to improve performance');
    }

    return {
      sourceTable: this.baseConfig.tableName,
      polymorphicType: this.polymorphicType!,
      targetTypes,
      estimatedCost,
      optimizations,
      joinStrategy
    };
  }

  /**
   * Build the final ChainableQuery with all configurations applied
   */
  build(): ChainableQuery<T> {
    let query = createPolymorphicQuery<T>(this.baseConfig, this.polymorphicType);

    // Apply target type filtering
    if (this.options.targetTypes && this.options.targetTypes.length > 0) {
      query = query.forTargetType(this.options.targetTypes);
    }

    // Apply target inclusion
    if (this.options.includeTargets) {
      query = query.includePolymorphicTargets({
        targetTypes: this.options.targetTypes
      });
    }

    // Apply ordering by target type
    if (this.options.orderByTargetType) {
      // Note: This would need to be implemented in ChainableQuery
      // For now, we'll add a condition that can be handled in buildZeroQuery
      const orderDirection = this.options.orderByTargetType;
      if (this.polymorphicType) {
        query = query.orderBy(`${this.polymorphicType}_type` as keyof T, orderDirection);
      }
    }

    // Apply batching through limit if specified
    if (this.options.batchSize) {
      query = query.limit(this.options.batchSize);
    }

    return query;
  }

  /**
   * Build and execute the query, returning results
   */
  async execute(): Promise<T[]> {
    const query = this.build();
    return await query.all();
  }

  /**
   * Build and execute aggregation query
   */
  async executeAggregation(): Promise<Record<string, any>[]> {
    if (!this.aggregationConfig) {
      throw new Error('Aggregation config not set. Call withAggregation() first.');
    }

    // This would require custom Zero.js query building for aggregation
    // For now, we'll simulate with a regular query and post-process
    const results = await this.execute();
    
    return this.processAggregation(results);
  }

  /**
   * Create multiple specialized builders for different target types
   * 
   * @example
   * ```typescript
   * const builders = PolymorphicQueryBuilder.createBuilders(noteConfig, 'notable', ['Job', 'Task']);
   * const jobNotes = await builders.Job.build().all();
   * const taskNotes = await builders.Task.build().all();
   * ```
   */
  static createBuilders<T extends Record<string, any>>(
    config: BaseModelConfig,
    polymorphicType: PolymorphicType,
    targetTypes: string[]
  ): Record<string, PolymorphicQueryBuilder<T>> {
    const builders: Record<string, PolymorphicQueryBuilder<T>> = {};

    for (const targetType of targetTypes) {
      builders[targetType] = new PolymorphicQueryBuilder<T>(config, polymorphicType)
        .forTargetTypes([targetType]);
    }

    return builders;
  }

  /**
   * Create a batch query executor for multiple target types
   * 
   * @example
   * ```typescript
   * const executor = PolymorphicQueryBuilder.createBatchExecutor(noteConfig, 'notable');
   * const results = await executor.executeForTargets(['Job', 'Task', 'Client']);
   * ```
   */
  static createBatchExecutor<T extends Record<string, any>>(
    config: BaseModelConfig,
    polymorphicType: PolymorphicType
  ) {
    return {
      async executeForTargets(targetTypes: string[]): Promise<Record<string, T[]>> {
        const results: Record<string, T[]> = {};

        // Execute queries for each target type in parallel
        const promises = targetTypes.map(async (targetType) => {
          const builder = new PolymorphicQueryBuilder<T>(config, polymorphicType)
            .forTargetTypes([targetType]);
          
          const data = await builder.execute();
          return { targetType, data };
        });

        const targetResults = await Promise.all(promises);

        // Organize results by target type
        for (const { targetType, data } of targetResults) {
          results[targetType] = data;
        }

        return results;
      },

      async executeWithCounts(targetTypes: string[]): Promise<Record<string, { data: T[], count: number }>> {
        const results: Record<string, { data: T[], count: number }> = {};

        // Execute queries with counts for each target type
        const promises = targetTypes.map(async (targetType) => {
          const builder = new PolymorphicQueryBuilder<T>(config, polymorphicType)
            .forTargetTypes([targetType]);
          
          const query = builder.build();
          const data = await query.all();
          const count = data.length;
          
          return { targetType, data, count };
        });

        const targetResults = await Promise.all(promises);

        // Organize results by target type
        for (const { targetType, data, count } of targetResults) {
          results[targetType] = { data, count };
        }

        return results;
      }
    };
  }

  /**
   * Get valid target types for the current polymorphic type
   */
  private getValidTargetTypes(): string[] {
    if (!this.polymorphicType) {
      return [];
    }

    try {
      const tracker = getPolymorphicTracker();
      const config = tracker.getConfig();
      const association = config?.associations[this.polymorphicType];
      if (!association) {
        return [];
      }

      return Object.keys(association.validTargets);
    } catch (error) {
      debugDatabase.warn('Failed to get valid target types', { 
        polymorphicType: this.polymorphicType,
        error 
      });
      return [];
    }
  }

  /**
   * Process aggregation results (simplified implementation)
   */
  private processAggregation(results: T[]): Record<string, any>[] {
    if (!this.aggregationConfig) {
      return [];
    }

    const { fields, functions, groupByTargetType } = this.aggregationConfig;

    if (groupByTargetType && this.polymorphicType) {
      // Group by polymorphic target type
      const typeColumn = `${this.polymorphicType}_type`;
      const grouped = new Map<string, T[]>();

      for (const result of results) {
        const type = (result as any)[typeColumn] || 'unknown';
        if (!grouped.has(type)) {
          grouped.set(type, []);
        }
        grouped.get(type)!.push(result);
      }

      // Calculate aggregations for each group
      const aggregated: Record<string, any>[] = [];
      for (const [type, typeResults] of grouped) {
        const agg: Record<string, any> = { target_type: type };

        for (const field of fields) {
          for (const func of functions) {
            const key = `${field}_${func}`;
            agg[key] = this.calculateAggregation(typeResults, field, func);
          }
        }

        aggregated.push(agg);
      }

      return aggregated;
    } else {
      // Simple aggregation without grouping
      const agg: Record<string, any> = {};

      for (const field of fields) {
        for (const func of functions) {
          const key = `${field}_${func}`;
          agg[key] = this.calculateAggregation(results, field, func);
        }
      }

      return [agg];
    }
  }

  /**
   * Calculate specific aggregation function
   */
  private calculateAggregation(
    results: T[], 
    field: string, 
    func: 'count' | 'sum' | 'avg' | 'min' | 'max'
  ): number {
    if (results.length === 0) {
      return 0;
    }

    const values = results
      .map(r => (r as any)[field])
      .filter(v => v !== null && v !== undefined && !isNaN(Number(v)))
      .map(v => Number(v));

    switch (func) {
      case 'count':
        return results.length;
      case 'sum':
        return values.reduce((sum, v) => sum + v, 0);
      case 'avg':
        return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
      case 'min':
        return values.length > 0 ? Math.min(...values) : 0;
      case 'max':
        return values.length > 0 ? Math.max(...values) : 0;
      default:
        return 0;
    }
  }
}

/**
 * Factory functions for common polymorphic query builders
 */

/**
 * Create a query builder for notable relationships
 */
export function createNotableQueryBuilder<T extends Record<string, any>>(
  config: BaseModelConfig
): PolymorphicQueryBuilder<T> {
  return new PolymorphicQueryBuilder<T>(config, 'notable');
}

/**
 * Create a query builder for loggable relationships
 */
export function createLoggableQueryBuilder<T extends Record<string, any>>(
  config: BaseModelConfig
): PolymorphicQueryBuilder<T> {
  return new PolymorphicQueryBuilder<T>(config, 'loggable');
}

/**
 * Create a query builder for schedulable relationships
 */
export function createSchedulableQueryBuilder<T extends Record<string, any>>(
  config: BaseModelConfig
): PolymorphicQueryBuilder<T> {
  return new PolymorphicQueryBuilder<T>(config, 'schedulable');
}

/**
 * Create a query builder for target relationships
 */
export function createTargetQueryBuilder<T extends Record<string, any>>(
  config: BaseModelConfig
): PolymorphicQueryBuilder<T> {
  return new PolymorphicQueryBuilder<T>(config, 'target');
}

/**
 * Create a query builder for parseable relationships
 */
export function createParseableQueryBuilder<T extends Record<string, any>>(
  config: BaseModelConfig
): PolymorphicQueryBuilder<T> {
  return new PolymorphicQueryBuilder<T>(config, 'parseable');
}

/**
 * Utility function to create optimized polymorphic queries
 * 
 * @example
 * ```typescript
 * const optimizedQuery = await createOptimizedPolymorphicQuery({
 *   config: noteConfig,
 *   polymorphicType: 'notable',
 *   targetTypes: ['Job'],
 *   includeTargets: true,
 *   batchSize: 50
 * });
 * ```
 */
export async function createOptimizedPolymorphicQuery<T extends Record<string, any>>(options: {
  config: BaseModelConfig;
  polymorphicType: PolymorphicType;
  targetTypes?: string[];
  includeTargets?: boolean;
  batchSize?: number;
  analyzeFirst?: boolean;
}): Promise<ChainableQuery<T>> {
  const { config, polymorphicType, targetTypes, includeTargets, batchSize, analyzeFirst = true } = options;
  
  const builder = new PolymorphicQueryBuilder<T>(config, polymorphicType);

  // Configure builder
  if (targetTypes) {
    builder.forTargetTypes(targetTypes);
  }
  
  if (includeTargets) {
    builder.withTargets();
  }
  
  if (batchSize) {
    builder.batched(batchSize);
  }

  // Analyze query plan if requested
  if (analyzeFirst) {
    const plan = await builder.analyzeQueryPlan();
    
    // Log optimization suggestions
    if (plan.optimizations.length > 0) {
      debugDatabase.info('Query optimization suggestions', {
        table: config.tableName,
        polymorphicType,
        estimatedCost: plan.estimatedCost,
        optimizations: plan.optimizations
      });
    }
  }

  return builder.build();
}