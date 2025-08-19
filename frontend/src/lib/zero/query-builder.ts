/**
 * Zero.js Query Builder Utilities for Epic-008
 * 
 * Provides Rails-style where() chaining, automatic null/undefined handling,
 * and consistent return type patterns for Zero.js queries.
 * 
 * Features:
 * - Method chaining like Rails ActiveRecord
 * - Automatic handling of null/undefined values
 * - Type-safe query building
 * - Consistent error handling
 * - Support for complex conditions
 */

import { zeroClient, ZeroNotAvailableError } from './client';
import type { ZeroClient } from './zero-client';

// Supported comparison operators for Zero.js
export type ComparisonOperator = 
  | '=' | '!=' | '<' | '<=' | '>' | '>=' 
  | 'IS' | 'IS NOT' | 'LIKE' | 'NOT LIKE'
  | 'IN' | 'NOT IN';

// Where condition types
export interface WhereCondition {
  field: string;
  operator: ComparisonOperator;
  value: unknown;
}

export interface WhereClause {
  [field: string]: unknown;
}

// Order by types
export type OrderDirection = 'asc' | 'desc';

export interface OrderBy {
  field: string;
  direction: OrderDirection;
}

// Limit and offset
export interface LimitOffset {
  limit?: number;
  offset?: number;
}

/**
 * Enhanced query builder for Zero.js with Rails-style chaining
 * Provides fluent interface for building complex queries
 */
export class ZeroQueryBuilder<T = any> {
  private tableName: string;
  private whereConditions: WhereCondition[] = [];
  private orderByClause: OrderBy[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private selectFields?: string[];
  
  constructor(tableName: string) {
    this.tableName = tableName;
  }
  
  /**
   * Add WHERE condition with automatic null handling
   * Supports both object syntax and individual conditions
   */
  where(
    fieldOrConditions: string | WhereClause,
    operatorOrValue?: ComparisonOperator | unknown,
    value?: unknown
  ): ZeroQueryBuilder<T> {
    // Object syntax: where({ status: 'active', client_id: 'uuid' })
    if (typeof fieldOrConditions === 'object' && fieldOrConditions !== null) {
      Object.entries(fieldOrConditions).forEach(([field, val]) => {
        if (val !== undefined) { // Skip undefined values
          if (val === null) {
            this.whereConditions.push({ field, operator: 'IS', value: null });
          } else {
            this.whereConditions.push({ field, operator: '=', value: val });
          }
        }
      });
      return this;
    }
    
    // Individual condition syntax: where('status', '=', 'active')
    if (typeof fieldOrConditions === 'string') {
      const field = fieldOrConditions;
      
      // Two-parameter syntax: where('status', 'active')
      if (value === undefined && operatorOrValue !== undefined) {
        const val = operatorOrValue;
        if (val === null) {
          this.whereConditions.push({ field, operator: 'IS', value: null });
        } else {
          this.whereConditions.push({ field, operator: '=', value: val });
        }
        return this;
      }
      
      // Three-parameter syntax: where('status', '=', 'active')
      if (typeof operatorOrValue === 'string' && value !== undefined) {
        const operator = operatorOrValue as ComparisonOperator;
        this.whereConditions.push({ field, operator, value });
        return this;
      }
    }
    
    throw new Error('Invalid where() arguments. Use where(field, value) or where(field, operator, value) or where(object)');
  }
  
  /**
   * Add WHERE NOT condition
   */
  whereNot(field: string, value: unknown): ZeroQueryBuilder<T> {
    if (value === null) {
      return this.where(field, 'IS NOT', null);
    }
    return this.where(field, '!=', value);
  }
  
  /**
   * Add WHERE field IS NULL condition
   */
  whereNull(field: string): ZeroQueryBuilder<T> {
    return this.where(field, 'IS', null);
  }
  
  /**
   * Add WHERE field IS NOT NULL condition
   */
  whereNotNull(field: string): ZeroQueryBuilder<T> {
    return this.where(field, 'IS NOT', null);
  }
  
  /**
   * Add WHERE field IN (...values) condition
   */
  whereIn(field: string, values: unknown[]): ZeroQueryBuilder<T> {
    if (!values || values.length === 0) {
      // Empty array should match nothing
      return this.where(field, '=', '__NEVER_MATCH__');
    }
    return this.where(field, 'IN', values);
  }
  
  /**
   * Add WHERE field NOT IN (...values) condition
   */
  whereNotIn(field: string, values: unknown[]): ZeroQueryBuilder<T> {
    if (!values || values.length === 0) {
      // Empty array should match everything
      return this;
    }
    return this.where(field, 'NOT IN', values);
  }
  
  /**
   * Add WHERE field LIKE pattern condition
   */
  whereLike(field: string, pattern: string): ZeroQueryBuilder<T> {
    return this.where(field, 'LIKE', pattern);
  }
  
  /**
   * Add WHERE field NOT LIKE pattern condition
   */
  whereNotLike(field: string, pattern: string): ZeroQueryBuilder<T> {
    return this.where(field, 'NOT LIKE', pattern);
  }
  
  /**
   * Add ORDER BY clause
   */
  orderBy(field: string, direction: OrderDirection = 'asc'): ZeroQueryBuilder<T> {
    this.orderByClause.push({ field, direction });
    return this;
  }
  
  /**
   * Add ORDER BY ascending (convenience method)
   */
  orderByAsc(field: string): ZeroQueryBuilder<T> {
    return this.orderBy(field, 'asc');
  }
  
  /**
   * Add ORDER BY descending (convenience method)
   */
  orderByDesc(field: string): ZeroQueryBuilder<T> {
    return this.orderBy(field, 'desc');
  }
  
  /**
   * Set LIMIT clause
   */
  limit(count: number): ZeroQueryBuilder<T> {
    if (count < 0) {
      throw new Error('Limit must be non-negative');
    }
    this.limitValue = count;
    return this;
  }
  
  /**
   * Set OFFSET clause
   */
  offset(count: number): ZeroQueryBuilder<T> {
    if (count < 0) {
      throw new Error('Offset must be non-negative');
    }
    this.offsetValue = count;
    return this;
  }
  
  /**
   * Set both limit and offset (pagination)
   */
  paginate(page: number, perPage: number): ZeroQueryBuilder<T> {
    if (page < 1) {
      throw new Error('Page must be >= 1');
    }
    if (perPage < 1) {
      throw new Error('Per page must be >= 1');
    }
    
    this.limitValue = perPage;
    this.offsetValue = (page - 1) * perPage;
    return this;
  }
  
  /**
   * Select specific fields (if supported by Zero.js)
   */
  select(...fields: string[]): ZeroQueryBuilder<T> {
    this.selectFields = fields;
    return this;
  }
  
  /**
   * Build the actual Zero.js query
   */
  private buildZeroQuery(client: ZeroClient): any {
    if (!client.query || !(this.tableName in client.query)) {
      throw new Error(`Table '${this.tableName}' not found in Zero schema`);
    }
    
    let query = (client.query as any)[this.tableName];
    
    // Apply WHERE conditions
    for (const condition of this.whereConditions) {
      const { field, operator, value } = condition;
      
      // Handle different operators
      if (operator === 'IS' || operator === 'IS NOT') {
        query = query.where(field, operator, value);
      } else if (operator === 'IN' || operator === 'NOT IN') {
        // For IN/NOT IN, we might need to handle differently based on Zero.js API
        query = query.where(field, operator, value);
      } else {
        query = query.where(field, operator, value);
      }
    }
    
    // Apply ORDER BY
    for (const order of this.orderByClause) {
      query = query.orderBy(order.field, order.direction);
    }
    
    // Apply LIMIT
    if (this.limitValue !== undefined) {
      query = query.limit(this.limitValue);
    }
    
    // Apply OFFSET (if supported)
    if (this.offsetValue !== undefined && query.offset) {
      query = query.offset(this.offsetValue);
    }
    
    return query;
  }
  
  /**
   * Execute query and return all results
   */
  async run(): Promise<T[]> {
    return await zeroClient.executeQuery(
      (client) => {
        const query = this.buildZeroQuery(client);
        return query.run();
      },
      { required: true, errorMessage: `Failed to execute query on ${this.tableName}` }
    ) || [];
  }
  
  /**
   * Execute query and return first result
   */
  async first(): Promise<T | null> {
    return await zeroClient.executeQuery(
      (client) => {
        const query = this.buildZeroQuery(client).limit(1);
        return query.one();
      },
      { required: false, errorMessage: `Failed to execute first() query on ${this.tableName}` }
    );
  }
  
  /**
   * Execute query and return single result (throws if multiple found)
   */
  async one(): Promise<T | null> {
    return await zeroClient.executeQuery(
      (client) => {
        const query = this.buildZeroQuery(client);
        return query.one();
      },
      { required: false, errorMessage: `Failed to execute one() query on ${this.tableName}` }
    );
  }
  
  /**
   * Get materialized view for reactive queries
   */
  materialize(ttl?: string): any {
    const client = zeroClient.getClient();
    if (!client) {
      throw new ZeroNotAvailableError('Zero client not available for materialized view');
    }
    
    const query = this.buildZeroQuery(client);
    return ttl ? query.materialize(ttl) : query.materialize();
  }
  
  /**
   * Clone this query builder for further modification
   */
  clone(): ZeroQueryBuilder<T> {
    const cloned = new ZeroQueryBuilder<T>(this.tableName);
    cloned.whereConditions = [...this.whereConditions];
    cloned.orderByClause = [...this.orderByClause];
    cloned.limitValue = this.limitValue;
    cloned.offsetValue = this.offsetValue;
    cloned.selectFields = this.selectFields ? [...this.selectFields] : undefined;
    return cloned;
  }
  
  /**
   * Get SQL-like representation for debugging
   */
  toSQL(): string {
    let sql = `SELECT * FROM ${this.tableName}`;
    
    if (this.whereConditions.length > 0) {
      const conditions = this.whereConditions
        .map(c => `${c.field} ${c.operator} ${JSON.stringify(c.value)}`)
        .join(' AND ');
      sql += ` WHERE ${conditions}`;
    }
    
    if (this.orderByClause.length > 0) {
      const orders = this.orderByClause
        .map(o => `${o.field} ${o.direction.toUpperCase()}`)
        .join(', ');
      sql += ` ORDER BY ${orders}`;
    }
    
    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`;
    }
    
    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ${this.offsetValue}`;
    }
    
    return sql;
  }
}

/**
 * Create a new query builder for a table
 */
export function createQueryBuilder<T = any>(tableName: string): ZeroQueryBuilder<T> {
  return new ZeroQueryBuilder<T>(tableName);
}

/**
 * Rails-style query interface for any table
 */
export function createTableQueries<T = any>(tableName: string) {
  return {
    /**
     * Get all records (like Rails Model.all)
     */
    all(): ZeroQueryBuilder<T> {
      return createQueryBuilder<T>(tableName);
    },
    
    /**
     * Find record by ID (like Rails Model.find)
     */
    find(id: string): ZeroQueryBuilder<T> {
      return createQueryBuilder<T>(tableName).where('id', id);
    },
    
    /**
     * Find records matching conditions (like Rails Model.where)
     */
    where(
      fieldOrConditions: string | WhereClause,
      operatorOrValue?: ComparisonOperator | unknown,
      value?: unknown
    ): ZeroQueryBuilder<T> {
      return createQueryBuilder<T>(tableName).where(fieldOrConditions as any, operatorOrValue as any, value);
    },
    
    /**
     * Order records (like Rails Model.order)
     */
    order(field: string, direction: OrderDirection = 'asc'): ZeroQueryBuilder<T> {
      return createQueryBuilder<T>(tableName).orderBy(field, direction);
    },
    
    /**
     * Limit records (like Rails Model.limit)
     */
    limit(count: number): ZeroQueryBuilder<T> {
      return createQueryBuilder<T>(tableName).limit(count);
    },
    
    /**
     * Get first record (like Rails Model.first)
     */
    async first(): Promise<T | null> {
      return await createQueryBuilder<T>(tableName).first();
    },
    
    /**
     * Create query builder instance
     */
    query(): ZeroQueryBuilder<T> {
      return createQueryBuilder<T>(tableName);
    }
  };
}

// Export convenience functions
export const query = createQueryBuilder;
export const table = createTableQueries;