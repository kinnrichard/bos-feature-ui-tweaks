/**
 * Polymorphic Query System - ChainableQuery for polymorphic relationships
 * 
 * Provides type-safe, chainable queries for polymorphic associations with
 * eager loading optimization and filtering capabilities.
 * 
 * Key Features:
 * - Type-safe polymorphic queries with generic constraints
 * - Chainable API similar to ActiveRecord/Rails
 * - Polymorphic filtering (e.g., only Job notes)
 * - Eager loading optimization for polymorphic relationships
 * - Integration with existing ScopedQuery patterns
 * - Support for both ActiveRecord and ReactiveRecord patterns
 * 
 * Generated: 2025-08-06 Epic-008 Polymorphic Query System
 */

import { BaseScopedQuery, RelationshipError, ConnectionError } from '../../models/base/scoped-query-base';
import type { BaseModelConfig } from '../../models/base/types';
import type { 
  PolymorphicType
} from './types';
// import { getPolymorphicTracker } from './tracker';
import { debugDatabase } from '../../utils/debug';

/**
 * Polymorphic query conditions for type-safe filtering
 */
export interface PolymorphicConditions {
  /** Filter by polymorphic type (e.g., only 'notable' records) */
  polymorphicType?: PolymorphicType | PolymorphicType[];
  /** Filter by target model (e.g., only Job targets) */
  targetType?: string | string[];
  /** Filter by specific target IDs */
  targetId?: string | number | (string | number)[];
  /** Additional custom conditions */
  [key: string]: any;
}

/**
 * Configuration for polymorphic eager loading
 */
export interface PolymorphicEagerLoadConfig {
  /** Include the polymorphic targets in results */
  includeTargets?: boolean;
  /** Specific target types to include (if not specified, includes all) */
  targetTypes?: string[];
  /** Callback for refining target queries */
  targetCallback?: (targetQuery: any, targetType: string) => any;
}

/**
 * Abstract base class for polymorphic queries
 * Extends BaseScopedQuery with polymorphic-specific functionality
 */
export abstract class PolymorphicQuery<T extends Record<string, any>> extends BaseScopedQuery<T> {
  protected polymorphicConditions: PolymorphicConditions = {};
  protected eagerLoadConfig: PolymorphicEagerLoadConfig = {};
  protected polymorphicIncludes: string[] = [];

  constructor(config: BaseModelConfig, protected polymorphicType?: PolymorphicType) {
    super(config);
  }

  /**
   * Filter by polymorphic type (e.g., only 'notable' records)
   * 
   * @example
   * ```typescript
   * // Get only notable records
   * Note.forPolymorphicType('notable')
   * 
   * // Get multiple types
   * ActivityLog.forPolymorphicType(['loggable', 'notable'])
   * ```
   */
  forPolymorphicType(type: PolymorphicType | PolymorphicType[]): this {
    const newQuery = this.clone();
    newQuery.polymorphicConditions.polymorphicType = type;
    return newQuery;
  }

  /**
   * Filter by target model type (e.g., only Job targets)
   * 
   * @example
   * ```typescript
   * // Get notes only for Jobs
   * Note.forTargetType('Job')
   * 
   * // Get notes for Jobs and Tasks
   * Note.forTargetType(['Job', 'Task'])
   * ```
   */
  forTargetType(targetType: string | string[]): this {
    const newQuery = this.clone();
    newQuery.polymorphicConditions.targetType = targetType;
    return newQuery;
  }

  /**
   * Filter by specific target IDs
   * 
   * @example
   * ```typescript
   * // Get notes for specific job
   * Note.forTargetId(123)
   * 
   * // Get notes for multiple targets
   * Note.forTargetId([123, 456, 789])
   * ```
   */
  forTargetId(targetId: string | number | (string | number)[]): this {
    const newQuery = this.clone();
    newQuery.polymorphicConditions.targetId = targetId;
    return newQuery;
  }

  /**
   * Include polymorphic targets in query results with eager loading
   * 
   * @example
   * ```typescript
   * // Include all polymorphic targets
   * Note.includePolymorphicTargets()
   * 
   * // Include only specific target types
   * Note.includePolymorphicTargets({ targetTypes: ['Job', 'Task'] })
   * 
   * // Include targets with callback refinement
   * Note.includePolymorphicTargets({ 
   *   targetCallback: (query, targetType) => {
   *     if (targetType === 'Job') {
   *       return query.where({ status: 'active' });
   *     }
   *     return query;
   *   }
   * })
   * ```
   */
  includePolymorphicTargets(config: PolymorphicEagerLoadConfig = {}): this {
    const newQuery = this.clone();
    newQuery.eagerLoadConfig = { 
      includeTargets: true,
      ...config 
    };
    return newQuery;
  }

  /**
   * Include specific polymorphic relationship by name
   * Integrates with existing includes() functionality
   * 
   * @example
   * ```typescript
   * // Include the polymorphic target
   * Note.includePolymorphic('notable')
   * 
   * // Chain with other includes
   * Note.includePolymorphic('notable').includes('user')
   * ```
   */
  includePolymorphic(relationshipName: string): this {
    const newQuery = this.clone();
    newQuery.polymorphicIncludes = [...this.polymorphicIncludes, relationshipName];
    
    // Also add to standard includes for integration with existing system
    return newQuery.includes(relationshipName);
  }

  /**
   * Get valid target types for the current polymorphic type
   */
  getValidTargetTypes(): string[] {
    if (!this.polymorphicType) {
      return [];
    }

    try {
      const config = polymorphicTracker.getConfig();
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
   * Validate polymorphic conditions against configuration
   */
  protected validatePolymorphicConditions(): void {
    const { targetType } = this.polymorphicConditions;
    
    if (targetType && this.polymorphicType) {
      const validTargets = this.getValidTargetTypes();
      const targetTypes = Array.isArray(targetType) ? targetType : [targetType];
      
      const invalidTargets = targetTypes.filter(t => !validTargets.includes(t));
      if (invalidTargets.length > 0) {
        throw new RelationshipError(
          `Invalid target type(s) '${invalidTargets.join(', ')}' for polymorphic type '${this.polymorphicType}'. Valid targets: ${validTargets.join(', ')}`,
          this.polymorphicType,
          this.tableName
        );
      }
    }
  }

  /**
   * Build Zero.js query with polymorphic conditions applied
   * Extends base buildZeroQuery with polymorphic functionality
   */
  protected buildZeroQuery(): any | null {
    // Start with base query
    let query = super.buildZeroQuery();
    if (!query) {
      return null;
    }

    // Validate polymorphic conditions
    this.validatePolymorphicConditions();

    // Apply polymorphic conditions
    query = this.applyPolymorphicConditions(query);
    
    // Apply polymorphic eager loading
    query = this.applyPolymorphicEagerLoading(query);

    return query;
  }

  /**
   * Apply polymorphic filtering conditions to Zero.js query
   */
  protected applyPolymorphicConditions(query: any): any {
    const { polymorphicType, targetType, targetId } = this.polymorphicConditions;

    // Filter by polymorphic type (if different from default)
    if (polymorphicType && polymorphicType !== this.polymorphicType) {
      const types = Array.isArray(polymorphicType) ? polymorphicType : [polymorphicType];
      
      if (types.length === 1) {
        // Single type - direct where condition
        // Assume polymorphic type is stored in a column (depends on schema)
        query = query.where('polymorphic_type', types[0]);
      } else {
        // Multiple types - use IN condition
        // Note: This may need adjustment based on Zero.js IN support
        query = query.where('polymorphic_type', 'in', types);
      }
    }

    // Filter by target model type
    if (targetType) {
      const types = Array.isArray(targetType) ? targetType : [targetType];
      
      if (types.length === 1) {
        // Single target type
        query = query.where('notable_type', types[0]);
      } else {
        // Multiple target types
        query = query.where('notable_type', 'in', types);
      }
    }

    // Filter by target ID
    if (targetId) {
      const ids = Array.isArray(targetId) ? targetId : [targetId];
      
      if (ids.length === 1) {
        // Single target ID
        query = query.where('notable_id', ids[0]);
      } else {
        // Multiple target IDs
        query = query.where('notable_id', 'in', ids);
      }
    }

    return query;
  }

  /**
   * Apply polymorphic eager loading to Zero.js query
   */
  protected applyPolymorphicEagerLoading(query: any): any {
    if (!this.eagerLoadConfig.includeTargets) {
      return query;
    }

    const { targetTypes, targetCallback } = this.eagerLoadConfig;
    const validTargets = this.getValidTargetTypes();
    const targetsToLoad = targetTypes || validTargets;

    // For each target type, add a related() call
    // This is a simplified approach - more sophisticated loading may be needed
    for (const targetType of targetsToLoad) {
      if (validTargets.includes(targetType)) {
        try {
          // Create relationship name from target type (e.g., Job -> job)
          const relationshipName = targetType.toLowerCase();
          
          if (targetCallback) {
            // Apply callback refinement
            query = query.related(relationshipName, (subQuery: any) => {
              return targetCallback(subQuery, targetType);
            });
          } else {
            // Simple eager loading
            query = query.related(relationshipName);
          }
        } catch (error) {
          debugDatabase.warn('Failed to apply polymorphic eager loading', {
            targetType,
            relationshipName: targetType.toLowerCase(),
            error
          });
        }
      }
    }

    return query;
  }

  /**
   * Build conditions for polymorphic target queries
   * Used by query builders for complex polymorphic queries
   */
  buildTargetConditions(targetType: string): Record<string, any> {
    const conditions: Record<string, any> = {};

    // Add polymorphic type condition
    if (this.polymorphicType) {
      conditions[`${this.polymorphicType}_type`] = targetType;
    }

    // Add any specific target ID conditions
    const { targetId } = this.polymorphicConditions;
    if (targetId) {
      conditions[`${this.polymorphicType}_id`] = targetId;
    }

    return conditions;
  }

  /**
   * Get metadata about current polymorphic configuration
   */
  getPolymorphicMetadata(): {
    type?: PolymorphicType;
    validTargets: string[];
    conditions: PolymorphicConditions;
    eagerLoading: PolymorphicEagerLoadConfig;
  } {
    return {
      type: this.polymorphicType,
      validTargets: this.getValidTargetTypes(),
      conditions: { ...this.polymorphicConditions },
      eagerLoading: { ...this.eagerLoadConfig }
    };
  }
}

/**
 * Chainable Query class for polymorphic relationships
 * Concrete implementation of PolymorphicQuery with execution methods
 */
export class ChainableQuery<T extends Record<string, any>> extends PolymorphicQuery<T> {
  /**
   * Execute query and return all results
   * 
   * @example
   * ```typescript
   * const notes = await Note.forTargetType('Job').all();
   * ```
   */
  async all(): Promise<T[]> {
    const query = this.buildZeroQuery();
    if (!query) {
      throw ConnectionError.zeroNotAvailable();
    }

    try {
      const results = await query.run();
      return Array.isArray(results) ? results : [];
    } catch (error) {
      debugDatabase.error('ChainableQuery.all() failed', {
        tableName: this.tableName,
        polymorphicType: this.polymorphicType,
        conditions: this.polymorphicConditions,
        error
      });
      throw error;
    }
  }

  /**
   * Execute query and return first result
   * 
   * @example
   * ```typescript
   * const note = await Note.forTargetType('Job').first();
   * ```
   */
  async first(): Promise<T | null> {
    const query = this.buildZeroQuery();
    if (!query) {
      throw ConnectionError.zeroNotAvailable();
    }

    try {
      const result = await query.limit(1).run();
      return Array.isArray(result) && result.length > 0 ? result[0] : null;
    } catch (error) {
      debugDatabase.error('ChainableQuery.first() failed', {
        tableName: this.tableName,
        polymorphicType: this.polymorphicType,
        conditions: this.polymorphicConditions,
        error
      });
      throw error;
    }
  }

  /**
   * Execute query and return count
   * 
   * @example
   * ```typescript
   * const count = await Note.forTargetType('Job').count();
   * ```
   */
  async count(): Promise<number> {
    const query = this.buildZeroQuery();
    if (!query) {
      throw ConnectionError.zeroNotAvailable();
    }

    try {
      // Note: Zero.js may have a specific count() method
      // This is a fallback that loads all and counts
      const results = await query.run();
      return Array.isArray(results) ? results.length : 0;
    } catch (error) {
      debugDatabase.error('ChainableQuery.count() failed', {
        tableName: this.tableName,
        polymorphicType: this.polymorphicType,
        conditions: this.polymorphicConditions,
        error
      });
      throw error;
    }
  }

  /**
   * Check if any records exist matching the query
   * 
   * @example
   * ```typescript
   * const hasNotes = await Note.forTargetType('Job').exists();
   * ```
   */
  async exists(): Promise<boolean> {
    try {
      const first = await this.limit(1).first();
      return first !== null;
    } catch (error) {
      debugDatabase.error('ChainableQuery.exists() failed', {
        tableName: this.tableName,
        polymorphicType: this.polymorphicType,
        conditions: this.polymorphicConditions,
        error
      });
      return false;
    }
  }

  /**
   * Execute query with pagination
   * 
   * @example
   * ```typescript
   * const page = await Note.forTargetType('Job').paginate(1, 10);
   * ```
   */
  async paginate(page: number = 1, perPage: number = 10): Promise<{
    data: T[];
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * perPage;
    
    // Get total count (without pagination)
    const total = await this.count();
    
    // Get paginated data
    const data = await this.limit(perPage).offset(offset).all();
    
    const totalPages = Math.ceil(total / perPage);
    
    return {
      data,
      page,
      perPage,
      total,
      totalPages
    };
  }

  /**
   * Create a deep copy of the query for immutable chaining
   */
  protected clone(): this {
    const cloned = new ChainableQuery(this.config, this.polymorphicType) as this;
    
    // Copy base properties
    cloned.conditions = [...this.conditions];
    cloned.relationships = [...this.relationships];
    cloned.orderByField = this.orderByField;
    cloned.orderByDirection = this.orderByDirection;
    cloned.limitCount = this.limitCount;
    cloned.offsetCount = this.offsetCount;
    cloned.includeDiscarded = this.includeDiscarded;
    cloned.onlyDiscarded = this.onlyDiscarded;
    
    // Copy polymorphic properties
    cloned.polymorphicConditions = { ...this.polymorphicConditions };
    cloned.eagerLoadConfig = { ...this.eagerLoadConfig };
    cloned.polymorphicIncludes = [...this.polymorphicIncludes];
    
    return cloned;
  }
}

/**
 * Factory function to create ChainableQuery instances
 * 
 * @example
 * ```typescript
 * const noteQuery = createPolymorphicQuery<NoteData>({
 *   tableName: 'notes'
 * }, 'notable');
 * 
 * const jobNotes = await noteQuery.forTargetType('Job').all();
 * ```
 */
export function createPolymorphicQuery<T extends Record<string, any>>(
  config: BaseModelConfig,
  polymorphicType?: PolymorphicType
): ChainableQuery<T> {
  return new ChainableQuery<T>(config, polymorphicType);
}

/**
 * Helper function to create type-specific polymorphic queries
 * 
 * @example
 * ```typescript
 * // Create a query specifically for notable relationships
 * const notableQuery = createNotableQuery<NoteData>({ tableName: 'notes' });
 * const jobNotes = await notableQuery.forTargetType('Job').all();
 * ```
 */
export function createNotableQuery<T extends Record<string, any>>(
  config: BaseModelConfig
): ChainableQuery<T> {
  return createPolymorphicQuery<T>(config, 'notable');
}

/**
 * Helper function to create loggable polymorphic queries
 */
export function createLoggableQuery<T extends Record<string, any>>(
  config: BaseModelConfig
): ChainableQuery<T> {
  return createPolymorphicQuery<T>(config, 'loggable');
}

/**
 * Helper function to create schedulable polymorphic queries
 */
export function createSchedulableQuery<T extends Record<string, any>>(
  config: BaseModelConfig
): ChainableQuery<T> {
  return createPolymorphicQuery<T>(config, 'schedulable');
}

/**
 * Helper function to create target polymorphic queries
 */
export function createTargetQuery<T extends Record<string, any>>(
  config: BaseModelConfig
): ChainableQuery<T> {
  return createPolymorphicQuery<T>(config, 'target');
}

/**
 * Helper function to create parseable polymorphic queries
 */
export function createParseableQuery<T extends Record<string, any>>(
  config: BaseModelConfig
): ChainableQuery<T> {
  return createPolymorphicQuery<T>(config, 'parseable');
}

/**
 * Export all query types for easy import
 */
export {
  type PolymorphicConditions,
  type PolymorphicEagerLoadConfig
};