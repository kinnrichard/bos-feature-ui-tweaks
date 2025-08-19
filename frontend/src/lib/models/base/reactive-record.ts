/**
 * ReactiveRecord<T> - Reactive Rails-compatible base class
 *
 * Provides ReactiveQuery-based CRUD operations that integrate with Zero.js
 * This class returns ReactiveQuery objects and is suitable for:
 * - Svelte components requiring reactive state
 * - UI components that need automatic updates
 * - Cases where reactive behavior is desired
 *
 * For non-reactive contexts, use ActiveRecord<T> instead.
 */

import { getZero } from '../../zero/zero-client';
import { ReactiveQuery } from '../../zero/reactive-query.svelte';
import { BaseScopedQuery } from './scoped-query-base';
import type {
  BaseRecord,
  BaseModelConfig,
  QueryOptions,
  ReactiveScopedQuery,
  ReactiveQuery as IReactiveQuery,
  QueryMeta,
} from './types';

/**
 * Configuration for ReactiveRecord class
 */
export interface ReactiveRecordConfig extends BaseModelConfig {
  /** Default TTL for reactive queries */
  defaultTtl?: string;
}

/**
 * ReactiveQuery implementation for single records
 */
export class ReactiveQueryOne<T> implements IReactiveQuery<T> {
  private reactiveQuery: ReactiveQuery<T>;

  constructor(getQueryBuilder: () => any | null, defaultValue: T | null = null, ttl?: string) {
    // Wrap single value as array for ReactiveQuery, then unwrap in getter
    this.reactiveQuery = new ReactiveQuery<T>(
      getQueryBuilder,
      defaultValue ? [defaultValue] : [],
      ttl
    );
  }

  get data(): T | null {
    const arrayData = this.reactiveQuery.data;
    return arrayData.length > 0 ? arrayData[0] : null;
  }

  get isLoading(): boolean {
    return this.reactiveQuery.isLoading;
  }

  get error(): Error | null {
    return this.reactiveQuery.error;
  }

  get resultType(): 'loading' | 'complete' | 'error' {
    return this.reactiveQuery.resultType;
  }

  get isCollection(): boolean {
    return false;
  }

  get present(): boolean {
    return this.data !== null;
  }

  get blank(): boolean {
    return this.data === null;
  }

  async refresh(): Promise<void> {
    this.reactiveQuery.refresh();
  }

  destroy(): void {
    this.reactiveQuery.destroy();
  }

  subscribe(callback: (data: T | null, meta?: QueryMeta) => void): () => void {
    return this.reactiveQuery.subscribe((arrayData, meta) => {
      const singleData = arrayData.length > 0 ? arrayData[0] : null;
      callback(singleData, meta);
    });
  }
}

/**
 * ReactiveQuery implementation for collections
 */
export class ReactiveQueryMany<T> implements IReactiveQuery<T[]> {
  private reactiveQuery: ReactiveQuery<T>;

  constructor(getQueryBuilder: () => any | null, defaultValue: T[] = [], ttl?: string) {
    this.reactiveQuery = new ReactiveQuery<T>(getQueryBuilder, defaultValue, ttl);
  }

  get data(): T[] {
    return this.reactiveQuery.data;
  }

  get isLoading(): boolean {
    return this.reactiveQuery.isLoading;
  }

  get error(): Error | null {
    return this.reactiveQuery.error;
  }

  get resultType(): 'loading' | 'complete' | 'error' {
    return this.reactiveQuery.resultType;
  }

  get isCollection(): boolean {
    return true;
  }

  get present(): boolean {
    return this.data.length > 0;
  }

  get blank(): boolean {
    return this.data.length === 0;
  }

  async refresh(): Promise<void> {
    this.reactiveQuery.refresh();
  }

  destroy(): void {
    this.reactiveQuery.destroy();
  }

  subscribe(callback: (data: T[], meta?: QueryMeta) => void): () => void {
    return this.reactiveQuery.subscribe(callback);
  }
}

/**
 * Reactive scoped query implementation for method chaining with includes() support
 * Extends BaseScopedQuery to inherit Rails-style includes() functionality
 */
class ReactiveRecordScopedQuery<T extends BaseRecord>
  extends BaseScopedQuery<T>
  implements ReactiveScopedQuery<T>
{
  constructor(protected config: ReactiveRecordConfig) {
    super(config);
  }

  all(options: QueryOptions = {}): IReactiveQuery<T[]> {
    return new ReactiveQueryMany<T>(
      () => this.buildZeroQuery(),
      [],
      options.ttl?.toString() || this.config.defaultTtl
    );
  }

  first(options: QueryOptions = {}): IReactiveQuery<T | null> {
    const query = this.clone();
    query.limitCount = 1;
    return new ReactiveQueryOne<T>(
      () => query.buildZeroQuery(),
      null,
      options.ttl?.toString() || this.config.defaultTtl
    );
  }

  last(options: QueryOptions = {}): IReactiveQuery<T | null> {
    const query = this.clone();
    // Reverse order and take first
    if (query.orderByField) {
      query.orderByDirection = query.orderByDirection === 'asc' ? 'desc' : 'asc';
    } else {
      query.orderByField = 'created_at' as keyof T;
      query.orderByDirection = 'asc';
    }
    query.limitCount = 1;
    return new ReactiveQueryOne<T>(
      () => query.buildZeroQuery(),
      null,
      options.ttl?.toString() || this.config.defaultTtl
    );
  }

  find(id: string, options: QueryOptions = {}): IReactiveQuery<T | null> {
    return this.where({ id } as Partial<T>).first(options);
  }

  count(options: QueryOptions = {}): IReactiveQuery<number> {
    return new ReactiveQueryOne<number>(
      () => {
        const query = this.buildZeroQuery();
        return query
          ? {
              ...query,
              many: async () => {
                const results = await query.run();
                return [results ? results.length : 0];
              },
            }
          : null;
      },
      0,
      options.ttl?.toString() || this.config.defaultTtl
    );
  }

  exists(options: QueryOptions = {}): IReactiveQuery<boolean> {
    return new ReactiveQueryOne<boolean>(
      () => {
        const query = this.buildZeroQuery();
        return query
          ? {
              ...query,
              many: async () => {
                const results = await query.run();
                return [results && results.length > 0];
              },
            }
          : null;
      },
      false,
      options.ttl?.toString() || this.config.defaultTtl
    );
  }

  protected clone(): this {
    const newQuery = new ReactiveRecordScopedQuery<T>(this.config);
    newQuery.conditions = [...this.conditions];
    newQuery.relationships = [...this.relationships];
    newQuery.orderByField = this.orderByField;
    newQuery.orderByDirection = this.orderByDirection;
    newQuery.limitCount = this.limitCount;
    newQuery.offsetCount = this.offsetCount;
    newQuery.includeDiscarded = this.includeDiscarded;
    newQuery.onlyDiscarded = this.onlyDiscarded;
    return newQuery as this;
  }
}

/**
 * ReactiveRecord<T> - Main Rails-compatible reactive model base class
 *
 * Provides ReactiveQuery-based CRUD operations with Rails-like API:
 * - find(id) - find by ID, returns ReactiveQuery<T | null>
 * - findBy(conditions) - find by conditions, returns ReactiveQuery<T | null>
 * - where(conditions) - scope for filtering, returns ReactiveScopedQuery<T>
 * - all() - get all records, returns ReactiveScopedQuery<T>
 * - kept() - get non-discarded records, returns ReactiveScopedQuery<T>
 * - discarded() - get discarded records, returns ReactiveScopedQuery<T>
 * - withDiscarded() - include discarded records, returns ReactiveScopedQuery<T>
 */
export class ReactiveRecord<T extends BaseRecord> {
  constructor(private config: ReactiveRecordConfig) {}

  /**
   * Find a record by ID - Rails .find() behavior
   * Returns ReactiveQuery that will be null if record doesn't exist
   */
  find(id: string, options: QueryOptions = {}): IReactiveQuery<T | null> {
    return new ReactiveQueryOne<T>(
      () => {
        const zero = getZero();
        if (!zero) {
          return null;
        }

        const queryTable = (zero.query as any)[this.config.tableName];
        if (!queryTable) {
          return null;
        }

        let query = queryTable.where('id', id);

        // Skip discarded_at filtering in find() - should find any record by ID

        return query;
      },
      null,
      options.ttl?.toString() || this.config.defaultTtl
    );
  }

  /**
   * Find a record by conditions - Rails .find_by() behavior
   * Returns ReactiveQuery<T | null>
   */
  findBy(conditions: Partial<T>, options: QueryOptions = {}): IReactiveQuery<T | null> {
    return this.where(conditions).first(options);
  }

  /**
   * Create reactive scoped query for all records - Rails .all behavior
   * Returns ReactiveScopedQuery for method chaining
   */
  all(): ReactiveScopedQuery<T> {
    return new ReactiveRecordScopedQuery<T>(this.config);
  }

  /**
   * Create reactive scoped query with conditions - Rails .where() behavior
   * Returns ReactiveScopedQuery for method chaining
   */
  where(conditions: Partial<T>): ReactiveScopedQuery<T> {
    return new ReactiveRecordScopedQuery<T>(this.config).where(conditions);
  }

  /**
   * Get only kept (non-discarded) records - Rails .kept behavior
   */
  kept(): ReactiveScopedQuery<T> {
    return new ReactiveRecordScopedQuery<T>(this.config).kept();
  }

  /**
   * Get only discarded records - Rails .discarded behavior
   */
  discarded(): ReactiveScopedQuery<T> {
    return new ReactiveRecordScopedQuery<T>(this.config).discarded();
  }

  /**
   * Include discarded records in query - Rails .with_discarded behavior
   */
  withDiscarded(): ReactiveScopedQuery<T> {
    return new ReactiveRecordScopedQuery<T>(this.config).withDiscarded();
  }

  /**
   * Rails-familiar includes() method for eager loading relationships
   * Returns ReactiveScopedQuery for method chaining
   *
   * @param relationships - List of relationship names to include
   * @returns ReactiveScopedQuery with relationships configured
   *
   * @example
   * ```typescript
   * // Single relationship
   * const jobQuery = ReactiveJob.includes('client').find(id);
   *
   * // Multiple relationships
   * const jobsQuery = ReactiveJob.includes('client', 'tasks', 'jobAssignments').where({ status: 'active' });
   *
   * // Method chaining with reactive updates
   * const jobsQuery = ReactiveJob.includes('client')
   *   .where({ status: 'active' })
   *   .orderBy('created_at', 'desc')
   *   .limit(10)
   *   .all();
   *
   * // In Svelte component
   * $: jobs = jobsQuery.data;
   * $: isLoading = jobsQuery.isLoading;
   * ```
   */
  includes(...relationships: string[]): ReactiveScopedQuery<T> {
    return new ReactiveRecordScopedQuery<T>(this.config).includes(...relationships);
  }
}

/**
 * Factory function to create ReactiveRecord instances
 */
export function createReactiveRecord<T extends BaseRecord>(
  config: ReactiveRecordConfig
): ReactiveRecord<T> {
  return new ReactiveRecord<T>(config);
}
