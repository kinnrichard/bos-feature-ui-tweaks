/**
 * Mutator Hook System for Zero.js Custom Mutators
 * 
 * Provides Rails-like callbacks and validation hooks that run during
 * create/update operations, supporting both online and offline mutations.
 */

import type { ValidationResult, MutatorContext } from '../../shared/types';

/**
 * Mutator function that transforms data before saving
 */
export type MutatorFunction<T> = (
  data: Partial<T>,
  context: MutatorContext
) => Promise<Partial<T>> | Partial<T>;

/**
 * Validator function that checks data validity
 */
export type ValidatorFunction<T> = (
  data: Partial<T>,
  context: MutatorContext
) => Promise<ValidationResult> | ValidationResult;

/**
 * Configuration for model mutator hooks
 */
export interface MutatorHooks<T> {
  /**
   * Runs before create operations only
   */
  beforeCreate?: MutatorFunction<T>[];
  
  /**
   * Runs before update operations only
   */
  beforeUpdate?: MutatorFunction<T>[];
  
  /**
   * Runs before both create and update operations
   */
  beforeSave?: MutatorFunction<T>[];
  
  /**
   * Runs after create operations (for logging, etc)
   */
  afterCreate?: MutatorFunction<T>[];
  
  /**
   * Runs after update operations (for logging, etc)
   */
  afterUpdate?: MutatorFunction<T>[];
  
  /**
   * Runs after both create and update operations
   */
  afterSave?: MutatorFunction<T>[];
  
  /**
   * Validators that must pass before saving
   */
  validators?: ValidatorFunction<T>[];
}

/**
 * Model configuration with mutator hooks
 */
export interface ModelWithMutators<T> {
  mutatorHooks?: MutatorHooks<T>;
}

/**
 * Validation error that includes field-specific errors
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
  
  /**
   * Get the first error message for a field
   */
  getFirstError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }
  
  /**
   * Get all error messages as a flat array
   */
  getAllErrors(): string[] {
    return Object.values(this.errors).flat();
  }
}

/**
 * Helper to run a chain of mutator functions
 */
export async function runMutators<T>(
  data: Partial<T>,
  mutators: MutatorFunction<T>[] | undefined,
  context: MutatorContext
): Promise<Partial<T>> {
  if (!mutators || mutators.length === 0) {
    return data;
  }
  
  let result = data;
  for (const mutator of mutators) {
    result = await mutator(result, context);
  }
  
  return result;
}

/**
 * Helper to run validators and collect errors
 */
export async function runValidators<T>(
  data: Partial<T>,
  validators: ValidatorFunction<T>[] | undefined,
  context: MutatorContext
): Promise<ValidationResult> {
  if (!validators || validators.length === 0) {
    return { valid: true };
  }
  
  const errors: Record<string, string[]> = {};
  
  for (const validator of validators) {
    const result = await validator(data, context);
    if (!result.valid && result.errors) {
      // Merge errors
      for (const [field, messages] of Object.entries(result.errors)) {
        if (!errors[field]) {
          errors[field] = [];
        }
        errors[field].push(...messages);
      }
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined
  };
}