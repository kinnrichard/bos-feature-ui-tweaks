/**
 * ActiveRecord<T> - Non-reactive Rails-compatible base class
 *
 * Provides Promise-based CRUD operations that integrate with Zero.js
 * This class returns Promises and is suitable for:
 * - Non-Svelte contexts (Node.js, tests, utilities)
 * - Server-side operations
 * - Cases where reactive updates aren't needed
 *
 * For reactive Svelte components, use ReactiveRecord<T> instead.
 */

import { getZero } from '../../zero/zero-client';
import { BaseScopedQuery } from './scoped-query-base';
import { executeMutatorWithTracking } from '../../shared/mutators/model-mutators';
import { getCurrentUser } from '../../auth/current-user';
import {
  runMutators,
  runValidators,
  ValidationError as MutatorValidationError,
  type MutatorHooks,
  type ModelWithMutators,
} from './mutator-hooks';
import { getDatabaseTimestamp } from '../../shared/utils/utc-timestamp';
import type {
  BaseRecord,
  BaseModelConfig,
  QueryOptions,
  ScopedQuery,
  CreateData,
  UpdateData,
  CrudResult,
  NewRecord,
} from './types';
import type { MutatorContext } from '../../shared/mutators/base-mutator';
import { isLoggableModel } from '../generated-loggable-config';

/**
 * Configuration for ActiveRecord class
 */
export interface ActiveRecordConfig<T = any> extends BaseModelConfig {
  // All base configuration properties inherited from BaseModelConfig
  /** Default values to apply when creating new records */
  defaults?: Partial<CreateData<T>>;
}

/**
 * Rails RecordNotFoundError - thrown by find() when record doesn't exist
 */
export class RecordNotFoundError extends Error {
  constructor(
    message: string,
    public modelName: string,
    public searchCriteria: any
  ) {
    super(message);
    this.name = 'RecordNotFoundError';
  }

  static forId(id: string, modelName: string): RecordNotFoundError {
    return new RecordNotFoundError(`Couldn't find ${modelName} with 'id'=${id}`, modelName, { id });
  }
}

/**
 * Rails RecordInvalidError - thrown when validation fails
 */
export class RecordInvalidError extends Error {
  constructor(
    message: string,
    public record: any,
    public validationErrors: Record<string, string[]>
  ) {
    super(message);
    this.name = 'RecordInvalidError';
  }
}

/**
 * Scoped query implementation for method chaining with includes() support
 * Extends BaseScopedQuery to inherit Rails-style includes() functionality
 */
class ActiveRecordScopedQuery<T extends BaseRecord>
  extends BaseScopedQuery<T>
  implements ScopedQuery<T>
{
  constructor(protected config: ActiveRecordConfig<T>) {
    super(config);
  }

  async all(options: QueryOptions = {}): Promise<T[]> {
    return this.executeQuery(true, options) as Promise<T[]>;
  }

  async first(options: QueryOptions = {}): Promise<T | null> {
    const query = this.clone();
    query.limitCount = 1;
    const results = (await query.executeQuery(true, options)) as T[];
    return results.length > 0 ? results[0] : null;
  }

  async last(options: QueryOptions = {}): Promise<T | null> {
    const query = this.clone();
    // Reverse order and take first
    if (query.orderByField) {
      query.orderByDirection = query.orderByDirection === 'asc' ? 'desc' : 'asc';
    } else {
      query.orderByField = 'created_at' as keyof T;
      query.orderByDirection = 'asc';
    }
    query.limitCount = 1;
    const results = (await query.executeQuery(true, options)) as T[];
    return results.length > 0 ? results[0] : null;
  }

  async find(id: string, options: QueryOptions = {}): Promise<T | null> {
    return this.where({ id } as Partial<T>).first(options);
  }

  async count(options: QueryOptions = {}): Promise<number> {
    const results = (await this.executeQuery(true, options)) as T[];
    return results.length;
  }

  async exists(options: QueryOptions = {}): Promise<boolean> {
    const count = await this.count(options);
    return count > 0;
  }

  protected clone(): this {
    const newQuery = new ActiveRecordScopedQuery<T>(this.config);
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

  private async executeQuery(
    isCollection: boolean,
    _options: QueryOptions = {}
  ): Promise<T | T[] | null> {
    try {
      const query = this.buildZeroQuery();

      if (isCollection) {
        const results = await query.run();
        return results || [];
      } else {
        const result = await query.one().run();
        return result;
      }
    } catch (error) {
      throw new Error(`Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * ActiveRecord<T> - Main Rails-compatible model base class
 *
 * Provides Promise-based CRUD operations with Rails-like API:
 * - find(id) - find by ID, throws RecordNotFoundError if not found
 * - findBy(conditions) - find by conditions, returns null if not found
 * - where(conditions) - scope for filtering, returns ScopedQuery
 * - all() - get all records, returns ScopedQuery
 * - create(data) - create new record
 * - update(id, data) - update existing record
 * - destroy(id) - hard delete record
 * - discard(id) - soft delete using discard gem
 * - undiscard(id) - restore discarded record
 */
export class ActiveRecord<T extends BaseRecord> implements ModelWithMutators<T> {
  /**
   * Mutator hooks configuration for this model
   * Can be overridden in subclasses to provide model-specific hooks
   */
  static mutatorHooks?: MutatorHooks<any>;

  constructor(private config: ActiveRecordConfig<T>) {}

  /**
   * Find a record by ID - Rails .find() behavior
   * Throws RecordNotFoundError if record doesn't exist
   */
  async find(id: string, _options: QueryOptions = {}): Promise<T> {
    const zero = getZero();
    if (!zero) {
      throw new Error('Zero client not initialized');
    }

    const queryTable = (zero.query as any)[this.config.tableName];
    if (!queryTable) {
      throw new Error(`Table '${this.config.tableName}' not found in Zero schema`);
    }

    let query = queryTable.where('id', id);

    // Skip discarded_at filtering in find() - should find any record by ID

    try {
      const result = await query.one().run();
      if (!result) {
        throw RecordNotFoundError.forId(id, this.config.className);
      }
      return result;
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw error;
      }
      throw new Error(`Find failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find a record by conditions - Rails .find_by() behavior
   * Returns null if record doesn't exist (doesn't throw)
   */
  async findBy(conditions: Partial<T>, options: QueryOptions = {}): Promise<T | null> {
    return this.where(conditions).first(options);
  }

  /**
   * Create scoped query for all records - Rails .all behavior
   * Returns ScopedQuery for method chaining
   */
  all(): ScopedQuery<T> {
    return new ActiveRecordScopedQuery<T>(this.config);
  }

  /**
   * Create scoped query with conditions - Rails .where() behavior
   * Returns ScopedQuery for method chaining
   */
  where(conditions: Partial<T>): ScopedQuery<T> {
    return new ActiveRecordScopedQuery<T>(this.config).where(conditions);
  }

  /**
   * Get only kept (non-discarded) records - Rails .kept behavior
   */
  kept(): ScopedQuery<T> {
    return new ActiveRecordScopedQuery<T>(this.config).kept();
  }

  /**
   * Get only discarded records - Rails .discarded behavior
   */
  discarded(): ScopedQuery<T> {
    return new ActiveRecordScopedQuery<T>(this.config).discarded();
  }

  /**
   * Include discarded records in query - Rails .with_discarded behavior
   */
  withDiscarded(): ScopedQuery<T> {
    return new ActiveRecordScopedQuery<T>(this.config).withDiscarded();
  }

  /**
   * Create a new unpersisted record - Rails .new() behavior
   * Returns an object with defaults applied but no database interaction
   * The record has id, created_at, and updated_at set to null
   *
   * @param data - Optional data to merge with defaults
   * @returns NewRecord<T> - Unpersisted record ready for forms
   *
   * @example
   * ```typescript
   * // Create empty job with defaults
   * const newJob = Job.new();
   *
   * // Create job with initial data
   * const newJob = Job.new({
   *   client_id: 'client-123',
   *   title: 'New Project'
   * });
   *
   * // Use in forms - record is not saved until calling create()
   * const savedJob = await Job.create(newJob);
   * ```
   */
  new(data: Partial<CreateData<T>> = {}): NewRecord<T> {
    // Apply defaults first, then override with provided data
    const recordData = {
      ...(this.config.defaults || {}),
      ...data,
      id: null,
      created_at: null,
      updated_at: null,
    };

    return recordData as NewRecord<T>;
  }

  /**
   * Rails-familiar includes() method for eager loading relationships
   * Returns ScopedQuery for method chaining
   *
   * @param relationships - List of relationship names to include
   * @returns ScopedQuery with relationships configured
   *
   * @example
   * ```typescript
   * // Single relationship
   * const job = await Job.includes('client').find(id);
   *
   * // Multiple relationships
   * const jobs = await Job.includes('client', 'tasks', 'jobAssignments').where({ status: 'active' });
   *
   * // Method chaining
   * const jobs = await Job.includes('client')
   *   .where({ status: 'active' })
   *   .orderBy('created_at', 'desc')
   *   .limit(10);
   * ```
   */
  includes(...relationships: string[]): ScopedQuery<T> {
    return new ActiveRecordScopedQuery<T>(this.config).includes(...relationships);
  }

  /**
   * Get mutator hooks for this model
   * Looks for hooks on the constructor (class static property)
   */
  private getMutatorHooks(): MutatorHooks<T> | undefined {
    return (this.constructor as any).mutatorHooks;
  }

  /**
   * Get current UTC timestamp for consistent database operations
   * Centralizes timestamp generation to fix timezone bugs
   */
  protected currentTime(): number {
    return getDatabaseTimestamp();
  }

  /**
   * Check if this model includes the Loggable concern
   * Uses generated configuration from Rails introspection
   */
  protected async isLoggableModel(): Promise<boolean> {
    try {
      const result = isLoggableModel(this.config.tableName);
      console.log(`[ActiveRecord] isLoggableModel(${this.config.tableName}) = ${result}`);
      return result;
    } catch (error) {
      // If config not loaded yet, return false
      console.warn(
        `[ActiveRecord] Could not check if ${this.config.tableName} is loggable:`,
        error
      );
      return false;
    }
  }

  /**
   * Create a new record - Rails .create() behavior
   */
  async create(data: CreateData<T>, _options: QueryOptions = {}): Promise<T> {
    const zero = getZero();
    if (!zero) {
      throw new Error('Zero client not initialized');
    }

    const id = crypto.randomUUID();
    const now = this.currentTime();

    // Apply defaults first, then override with provided data
    let processedData: any = {
      ...(this.config.defaults || {}),
      ...data,
      id,
      created_at: now,
      updated_at: now,
    };

    // Create mutator context
    const context: MutatorContext = {
      action: 'create',
      user: getCurrentUser(),
      offline: !navigator.onLine,
      environment: import.meta.env?.MODE || 'development',
    };

    // Get mutator hooks for this model
    const hooks = this.getMutatorHooks();

    if (hooks) {
      // Run beforeSave hooks
      if (hooks.beforeSave) {
        processedData = await runMutators(processedData, hooks.beforeSave, context);
      }

      // Run beforeCreate hooks
      if (hooks.beforeCreate) {
        processedData = await runMutators(processedData, hooks.beforeCreate, context);
      }

      // Run validators
      if (hooks.validators) {
        const validationResult = await runValidators(processedData, hooks.validators, context);
        if (!validationResult.valid) {
          throw new MutatorValidationError('Validation failed', validationResult.errors || {});
        }
      }
    }

    // Apply legacy mutator pipeline (for backward compatibility)
    const mutatedData = await executeMutatorWithTracking(
      this.config.tableName,
      processedData,
      null, // No original data for creates
      context,
      { trackChanges: false } // No changes to track for creation
    );

    try {
      console.log(`[ActiveRecord] Creating ${this.config.tableName} with data:`, mutatedData);

      // Check if Zero client is properly initialized
      if (!zero.mutate || !(zero.mutate as any)[this.config.tableName]) {
        throw new Error(
          `Zero mutation table '${this.config.tableName}' not found. Available tables: ${Object.keys(zero.mutate || {}).join(', ')}`
        );
      }

      // Check if this model needs activity logging
      const needsActivityLog = (await this.isLoggableModel()) && context.pendingActivityLog;

      console.log(`[ActiveRecord] Activity logging check for ${this.config.tableName}:`, {
        isLoggable: await this.isLoggableModel(),
        hasPendingActivityLog: !!context.pendingActivityLog,
        needsActivityLog,
      });

      if (needsActivityLog && context.pendingActivityLog) {
        console.log(
          `[ActiveRecord] Using mutateBatch for atomic operation on ${this.config.tableName}`
        );

        // Use mutateBatch for atomic operation
        await zero.mutateBatch(async (tx) => {
          // Insert the main record
          console.log(`[ActiveRecord] Inserting main record into ${this.config.tableName}`);
          await (tx as any)[this.config.tableName].insert(mutatedData);

          // Insert activity log in same transaction
          const activityLogData = {
            id: crypto.randomUUID(),
            created_at: now,
            updated_at: now,
            ...context.pendingActivityLog,
            loggable_id: id, // Use the parent record's ID
          };

          console.log(`[ActiveRecord] Inserting activity log:`, activityLogData);

          try {
            await tx.activity_logs.insert(activityLogData);
            console.log(`[ActiveRecord] ✅ Activity log created for ${this.config.tableName}`);
          } catch (activityLogError) {
            console.error(`[ActiveRecord] ❌ Activity log creation failed:`, activityLogError);
            // Log error but don't fail the parent creation
            console.error(
              `[ActiveRecord] Failed to create activity log for ${this.config.tableName}:`,
              activityLogError
            );
            // In mutateBatch, any error will rollback the entire transaction
            // So we re-throw to ensure atomic behavior
            throw activityLogError;
          }
        });
        console.log(
          `[ActiveRecord] Batch insert successful for ${this.config.tableName} with activity log`
        );
      } else {
        // Regular insert for non-loggable models
        await (zero.mutate as any)[this.config.tableName].insert(mutatedData);
        console.log(`[ActiveRecord] Insert successful for ${this.config.tableName}:`, id);
      }

      const createdRecord = await this.find(id, { withDiscarded: true });
      console.log(`[ActiveRecord] Record retrieved after creation:`, createdRecord);

      // Run after hooks
      if (hooks) {
        if (hooks.afterCreate) {
          await runMutators(createdRecord as any, hooks.afterCreate, context);
        }
        if (hooks.afterSave) {
          await runMutators(createdRecord as any, hooks.afterSave, context);
        }
      }

      return createdRecord;
    } catch (error) {
      console.error(`[ActiveRecord] Create failed for ${this.config.tableName}:`, error);
      console.error('[ActiveRecord] Error details:', {
        table: this.config.tableName,
        data: mutatedData,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      });

      if (error instanceof MutatorValidationError) {
        throw error;
      }
      throw new Error(`Create failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing record - Rails .update() behavior
   */
  async update(id: string, data: UpdateData<T>, _options: QueryOptions = {}): Promise<T> {
    const zero = getZero();
    if (!zero) {
      throw new Error('Zero client not initialized');
    }

    const now = this.currentTime();

    try {
      // Create context for mutator pipeline
      const context: MutatorContext = {
        action: 'update',
        user: getCurrentUser(),
        offline: !navigator.onLine,
        environment: import.meta.env?.MODE || 'development',
      };

      // Process data through mutator pipeline
      const mutatedData = await this.processUpdateData(id, data, context);

      // Check if this model needs activity logging
      const needsActivityLog = (await this.isLoggableModel()) && context.pendingActivityLog;

      console.log(`[ActiveRecord] Update activity logging check for ${this.config.tableName}:`, {
        isLoggable: await this.isLoggableModel(),
        hasPendingActivityLog: !!context.pendingActivityLog,
        needsActivityLog,
      });

      if (needsActivityLog && context.pendingActivityLog) {
        console.log(
          `[ActiveRecord] Using mutateBatch for atomic update on ${this.config.tableName}`
        );

        // Use mutateBatch for atomic operation
        await zero.mutateBatch(async (tx) => {
          // Update the main record
          console.log(`[ActiveRecord] Updating record in ${this.config.tableName}`);
          await (tx as any)[this.config.tableName].update(mutatedData);

          // Insert activity log in same transaction
          const activityLogData = {
            id: crypto.randomUUID(),
            created_at: now,
            updated_at: now,
            ...context.pendingActivityLog,
            loggable_id: id, // Use the existing record's ID
          };

          console.log(`[ActiveRecord] Inserting activity log for update:`, activityLogData);

          try {
            await tx.activity_logs.insert(activityLogData);
            console.log(
              `[ActiveRecord] ✅ Activity log created for ${this.config.tableName} update`
            );
          } catch (activityLogError) {
            console.error(`[ActiveRecord] ❌ Activity log creation failed:`, activityLogError);
            // In mutateBatch, any error will rollback the entire transaction
            // So we re-throw to ensure atomic behavior
            throw activityLogError;
          }
        });
      } else {
        // No activity logging needed, execute single mutation
        console.log(`[ActiveRecord] Executing single update mutation for ${this.config.tableName}`);
        console.log(`[ActiveRecord] Mutating ${this.config.tableName} with data:`, mutatedData);
        await (zero.mutate as any)[this.config.tableName].update(mutatedData);
      }

      const updatedRecord = await this.find(id, { withDiscarded: true });

      // Run after hooks
      const hooks = this.getMutatorHooks();
      if (hooks) {
        if (hooks.afterUpdate) {
          await runMutators(updatedRecord as any, hooks.afterUpdate, context);
        }
        if (hooks.afterSave) {
          await runMutators(updatedRecord as any, hooks.afterSave, context);
        }
      }

      return updatedRecord;
    } catch (error) {
      if (error instanceof MutatorValidationError) {
        throw error;
      }
      console.error(`[ActiveRecord] Original update error:`, error);
      throw new Error(`Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Hard delete a record - Rails .destroy() behavior
   */
  async destroy(id: string, _options: QueryOptions = {}): Promise<CrudResult> {
    const zero = getZero();
    if (!zero) {
      throw new Error('Zero client not initialized');
    }

    // Verify record exists first
    await this.find(id, { withDiscarded: true });

    try {
      await (zero.mutate as any)[this.config.tableName].delete({ id });
      return { id, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        id,
        success: false,
        error: `Destroy failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Soft delete a record using discard gem - Rails .discard() behavior
   */
  async discard(id: string, _options: QueryOptions = {}): Promise<T> {
    const now = Date.now();
    return this.update(id, { discarded_at: now } as UpdateData<T>, _options);
  }

  /**
   * Restore a discarded record - Rails .undiscard() behavior
   */
  async undiscard(id: string, options: QueryOptions = {}): Promise<T> {
    return this.update(id, { discarded_at: null } as UpdateData<T>, {
      ...options,
      withDiscarded: true,
    });
  }

  /**
   * Create or update a record (upsert) - Rails .find_or_create_by + update pattern
   */
  async upsert(
    data: (CreateData<T> & { id?: string }) | (UpdateData<T> & { id: string }),
    options: QueryOptions = {}
  ): Promise<T> {
    if ('id' in data && data.id) {
      // Update existing record
      return this.update(data.id, data as UpdateData<T>, options);
    } else {
      // Create new record
      return this.create(data as CreateData<T>, options);
    }
  }

  /**
   * Process update data through mutator pipeline (extracted for reuse in batch operations)
   */
  private async processUpdateData(
    id: string,
    data: UpdateData<T>,
    existingContext?: MutatorContext
  ): Promise<any> {
    // Get original record for change tracking
    const originalRecord = await this.find(id, { withDiscarded: true });

    let processedData: any = {
      ...originalRecord, // Include all original fields for mutators to access
      ...data, // Override with fields being updated
      id,
      updated_at: this.currentTime(),
    };

    // Use provided context or create new one
    const context: MutatorContext = existingContext || {
      action: 'update',
      user: getCurrentUser(),
      offline: !navigator.onLine,
      environment: import.meta.env?.MODE || 'development',
    };

    // Get mutator hooks for this model
    const hooks = this.getMutatorHooks();

    if (hooks) {
      // Run beforeSave hooks
      if (hooks.beforeSave) {
        processedData = await runMutators(processedData, hooks.beforeSave, context);
      }

      // Run beforeUpdate hooks
      if (hooks.beforeUpdate) {
        processedData = await runMutators(processedData, hooks.beforeUpdate, context);
      }

      // Run validators
      if (hooks.validators) {
        const validationResult = await runValidators(processedData, hooks.validators, context);
        if (!validationResult.valid) {
          throw new MutatorValidationError('Validation failed', validationResult.errors || {});
        }
      }
    }

    // Apply legacy mutator pipeline (for backward compatibility)
    const mutatedData = await executeMutatorWithTracking(
      this.config.tableName,
      processedData,
      originalRecord,
      context,
      { trackChanges: true } // Enable change tracking for updates
    );

    return mutatedData;
  }

  /**
   * Batch update multiple records using Zero's native mutateBatch API
   * All updates are executed atomically - either all succeed or all fail
   *
   * @param updates Array of {id, data} objects to update
   * @param options Query options (currently unused but kept for consistency)
   * @returns Promise<T[]> Array of updated records
   *
   * @example
   * ```typescript
   * // Batch update multiple tasks
   * const updates = [
   *   { id: 'task1', data: { position: 1 } },
   *   { id: 'task2', data: { position: 2 } },
   *   { id: 'task3', data: { position: 3 } }
   * ];
   * const updatedTasks = await Task.updateBatch(updates);
   * ```
   */
  async updateBatch(
    updates: Array<{ id: string; data: UpdateData<T> }>,
    _options: QueryOptions = {}
  ): Promise<T[]> {
    const zero = getZero();
    if (!zero) {
      throw new Error('Zero client not initialized');
    }

    if (updates.length === 0) {
      return [];
    }

    try {
      // eslint-disable-next-line no-console
      console.log(`[ActiveRecord] Starting batch update for ${this.config.tableName}:`, {
        count: updates.length,
        ids: updates.map((u) => u.id).join(', '),
        changes: updates.map((u) => ({
          id: u.id,
          fields: Object.keys(u.data),
          data: u.data,
        })),
      });

      // Process all updates through mutator pipeline first
      const processedUpdates: Array<{
        id: string;
        processedData: any;
        context: MutatorContext;
      }> = [];

      const now = this.currentTime();
      const isLoggable = await this.isLoggableModel();

      for (const update of updates) {
        // Create context for each update
        const context: MutatorContext = {
          action: 'update',
          user: getCurrentUser(),
          offline: !navigator.onLine,
          environment: import.meta.env?.MODE || 'development',
        };

        const processedData = await this.processUpdateData(update.id, update.data, context);
        processedUpdates.push({ id: update.id, processedData, context });
      }

      // Execute all mutations in a single atomic batch using Zero's native API
      await zero.mutateBatch(async (tx: any) => {
        for (const { id, processedData, context } of processedUpdates) {
          // Update the main record
          await tx[this.config.tableName].update(processedData);

          // If this model needs activity logging and has pending activity log
          if (isLoggable && context.pendingActivityLog) {
            // Insert activity log in same transaction
            const activityLogData = {
              id: crypto.randomUUID(),
              created_at: now,
              updated_at: now,
              ...context.pendingActivityLog,
              loggable_id: id, // Use the existing record's ID
            };

            await tx.activity_logs.insert(activityLogData);
          }
        }
      });

      console.log(`[ActiveRecord] Batch update successful for ${this.config.tableName}`, {
        count: updates.length,
      });

      // Retrieve all updated records and run after hooks
      const updatedRecords: T[] = [];
      const hooks = this.getMutatorHooks();

      for (const { id } of processedUpdates) {
        const updatedRecord = await this.find(id, { withDiscarded: true });
        updatedRecords.push(updatedRecord);

        // Run after hooks for each record
        if (hooks) {
          const context: MutatorContext = {
            action: 'update',
            user: getCurrentUser(),
            offline: !navigator.onLine,
            environment: import.meta.env?.MODE || 'development',
          };

          if (hooks.afterUpdate) {
            await runMutators(updatedRecord as any, hooks.afterUpdate, context);
          }
          if (hooks.afterSave) {
            await runMutators(updatedRecord as any, hooks.afterSave, context);
          }
        }
      }

      return updatedRecords;
    } catch (error) {
      console.error(`[ActiveRecord] Batch update failed for ${this.config.tableName}:`, error);
      console.error('[ActiveRecord] Batch error details:', {
        table: this.config.tableName,
        updateCount: updates.length,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      });

      if (error instanceof MutatorValidationError) {
        throw error;
      }
      throw new Error(
        `Batch update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Factory function to create ActiveRecord instances
 */
export function createActiveRecord<T extends BaseRecord>(
  config: ActiveRecordConfig<T>
): ActiveRecord<T> {
  return new ActiveRecord<T>(config);
}
