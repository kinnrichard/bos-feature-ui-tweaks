/**
 * TypeScript ambient declarations for ReactiveRecord vs ActiveRecord context validation
 * 
 * EPIC-007 Phase 2 Story 3: Clear Naming Convention Implementation
 * Provides compile-time checks for proper model usage in different contexts
 */

declare namespace ModelContext {
  /**
   * Context types for model validation
   */
  type Context = 'svelte' | 'test' | 'server' | 'worker' | 'api' | 'vanilla';

  /**
   * Model type enforcement
   */
  interface ModelConstraints {
    /** ReactiveRecord/ReactiveModel should only be used in Svelte context */
    ReactiveContext: 'svelte';
    /** ActiveRecord/ActiveModel can be used in any non-Svelte context */
    ActiveContext: Exclude<Context, 'svelte'>;
  }

  /**
   * Conditional type for validating model usage in specific contexts
   */
  type ValidateModelUsage<T, C extends Context> = 
    C extends 'svelte' 
      ? T extends { __reactive: true } 
        ? T 
        : never & { __error: 'Use ReactiveModel in Svelte files for automatic reactivity' }
      : T extends { __reactive: true }
        ? never & { __error: 'ReactiveModel should not be used outside Svelte files. Use ActiveModel for better performance.' }
        : T;

  /**
   * Context-aware model factory interface
   */
  interface ContextAwareFactory<T> {
    /** For Svelte components - provides reactive state */
    svelte(): ReactiveModelInterface<T>;
    /** For vanilla JS/TS - optimized performance */
    vanilla(): ActiveModelInterface<T>;
    /** For testing - predictable behavior */
    test(): ActiveModelInterface<T>;
    /** For server-side - no browser dependencies */
    server(): ActiveModelInterface<T>;
  }

  /**
   * ReactiveModel interface with reactivity markers
   */
  interface ReactiveModelInterface<T> {
    readonly __reactive: true;
    readonly __context: 'svelte';
    
    // Reactive getters (Svelte 5 $state integration)
    readonly record: T | null;
    readonly records: T[];
    readonly data: T | T[] | null;
    readonly isLoading: boolean;
    readonly error: Error | null;
    readonly present: boolean;
    readonly blank: boolean;
  }

  /**
   * ActiveModel interface with performance optimization
   */
  interface ActiveModelInterface<T> {
    readonly __reactive: false;
    readonly __context: Exclude<Context, 'svelte'>;
    
    // Direct property access (faster performance)
    readonly record: T | null;
    readonly records: T[];
    readonly data: T | T[] | null;
    readonly isLoading: boolean;
    readonly error: Error | null;
    readonly present: boolean;
    readonly blank: boolean;
    
    // Subscription API for manual updates
    subscribe(callback: (data: T | T[] | null, meta: any) => void): () => void;
    destroy(): void;
  }
}

/**
 * Global augmentation for module system
 */
declare global {
  namespace Epic007 {
    /**
     * File context detection at compile time
     */
    type FileContext<T extends string> = 
      T extends `${string}.svelte` 
        ? 'svelte'
        : T extends `${string}.test.${string}`
          ? 'test'
          : T extends `${string}.spec.${string}`
            ? 'test'
            : 'vanilla';

    /**
     * Model usage validation based on file extension
     */
    type ValidateModelInFile<Model, FileName extends string> = 
      ModelContext.ValidateModelUsage<Model, FileContext<FileName>>;

    /**
     * Type guard for reactive models
     */
    type IsReactiveModel<T> = T extends { __reactive: true } ? true : false;

    /**
     * Type guard for active models  
     */
    type IsActiveModel<T> = T extends { __reactive: false } ? true : false;

    /**
     * Context-specific model recommendation
     */
    type RecommendedModel<Context extends ModelContext.Context> = 
      Context extends 'svelte' 
        ? 'Use ReactiveModel/ReactiveRecord for automatic UI updates'
        : 'Use ActiveModel/ActiveRecord for optimal performance';
  }
}

/**
 * Utility types for import validation
 */
export type ReactiveModelImportCheck<T> = T extends `${string}.svelte`
  ? { valid: true; model: 'ReactiveModel' }
  : { valid: false; error: 'ReactiveModel should only be imported in .svelte files'; suggestion: 'ActiveModel' };

export type ActiveModelImportCheck<T> = T extends `${string}.svelte`
  ? { valid: false; error: 'ActiveModel in Svelte files will not be reactive'; suggestion: 'ReactiveModel' }
  : { valid: true; model: 'ActiveModel' };

/**
 * Runtime validation helpers
 */
export interface ModelValidationHelpers {
  /**
   * Validate model usage at runtime
   */
  validateModelContext(modelType: 'reactive' | 'active', context: ModelContext.Context): {
    valid: boolean;
    error?: string;
    suggestion?: string;
  };

  /**
   * Get recommended model for current context
   */
  getRecommendedModel(context: ModelContext.Context): 'reactive' | 'active';

  /**
   * Check if current file context supports reactive models
   */
  supportsReactiveModels(): boolean;
}

/**
 * Module augmentation for better IDE support
 */
declare module '*/record-factory/*' {
  export interface ModelFactoryMeta {
    __validationEnabled: true;
    __enforceContext: true;
  }
}