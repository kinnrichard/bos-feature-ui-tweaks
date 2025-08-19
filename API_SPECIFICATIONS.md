# ReactiveRecord v2 API Specifications

## Overview

This document defines the complete API specifications for ReactiveRecord v2 Phase 1, ensuring 100% backward compatibility while introducing enhanced flash prevention capabilities.

## Core API Interfaces

### ReactiveCoordinator<T>

The central orchestration class that manages reactive queries with flash prevention.

```typescript
export interface CoordinatorOptions {
  /** Minimum time to show hydrating state to prevent flash (default: 300ms) */
  minimumHydratingTime?: number;
  
  /** Maximum time to show stale data before forcing loading state (default: 30s) */
  maxStaleTime?: number;
  
  /** Default TTL for materialized views (default: '5m') */
  defaultTtl?: string;
  
  /** Enable debug logging (default: false) */
  debug?: boolean;
  
  /** Enable stale-while-revalidate pattern (default: true) */
  staleWhileRevalidate?: boolean;
  
  /** Custom error retry strategy */
  retryStrategy?: {
    attempts: number;
    backoffMs: number[];
    shouldRetry: (error: Error, attempt: number) => boolean;
  };
}

export interface ReactiveCoordinatorState<T> {
  /** Current data (may be stale during hydrating) */
  readonly data: T | null;
  
  /** Current error state */
  readonly error: Error | null;
  
  /** Timestamp of last successful data update */
  readonly lastUpdated: number;
  
  /** Number of queries executed */
  readonly queryCount: number;
  
  /** Current visual state for UI rendering */
  readonly visualState: VisualState;
  
  /** Whether current data is considered stale */
  readonly isStale: boolean;
  
  /** Time remaining before data is considered stale (ms) */
  readonly staleTimeRemaining: number;
}

export class ReactiveCoordinator<T> {
  constructor(
    getQueryBuilder: () => ZeroQuery<T> | null,
    options?: CoordinatorOptions
  );

  // State access
  readonly data: T | null;
  readonly error: Error | null;
  readonly visualState: VisualState;
  readonly isReady: boolean;
  readonly isLoading: boolean;
  readonly isHydrating: boolean;
  readonly hasError: boolean;

  // Control methods
  refresh(): Promise<void>;
  forceRefresh(): Promise<void>; // Bypass stale-while-revalidate
  retry(): Promise<void>;        // Retry failed queries
  destroy(): void;

  // Subscription
  subscribe(callback: (state: ReactiveCoordinatorState<T>) => void): () => void;
  
  // Advanced features
  preload(): Promise<void>;      // Preload data without subscribing
  invalidate(): void;            // Mark current data as stale
  setOptions(options: Partial<CoordinatorOptions>): void;
  
  // Debug/monitoring
  getMetrics(): CoordinatorMetrics;
  exportState(): SerializableState<T>;
}

export interface CoordinatorMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageQueryTime: number;
  cacheHitRate: number;
  lastQueryTime: number;
  staleDataServed: number;
}
```

### VisualState Interface

Provides clear UI rendering guidance to prevent flashing.

```typescript
export interface VisualState {
  /** Current state in the 5-state lifecycle */
  readonly current: VisualStateType;
  
  /** Whether to show loading skeleton */
  readonly shouldShowSkeleton: boolean;
  
  /** Whether to show actual data */
  readonly shouldShowData: boolean;
  
  /** Whether to show subtle loading indicator */
  readonly shouldShowSubtleLoader: boolean;
  
  /** Whether to show error UI */
  readonly shouldShowError: boolean;
  
  /** Whether user can interact with the interface */
  readonly canInteract: boolean;
  
  /** Additional context for custom UI logic */
  readonly context: VisualStateContext;
}

export type VisualStateType = 
  | 'initializing'  // Setting up query, no data yet
  | 'loading'       // Actively loading, no stale data
  | 'hydrating'     // Loading with stale data available
  | 'ready'         // Fresh data available
  | 'error';        // Query failed

export interface VisualStateContext {
  /** Whether data is considered fresh (within staleness threshold) */
  readonly isFresh: boolean;
  
  /** Age of current data in milliseconds */
  readonly dataAge: number;
  
  /** Whether this is a retry after error */
  readonly isRetry: boolean;
  
  /** Whether this is an automatic background refresh */
  readonly isBackgroundRefresh: boolean;
  
  /** Confidence level in data freshness (0-1) */
  readonly freshnessConfidence: number;
}
```

### Zero.js Integration Layer

Enhanced integration with Zero.js queries.

```typescript
export interface ZeroQueryBuilder<T> {
  /** Build the actual Zero.js query */
  buildZeroQuery(): ZeroQuery<T> | null;
  
  /** Get unique cache key for this query */
  getCacheKey(): string;
  
  /** Clone this query builder */
  clone(): ZeroQueryBuilder<T>;
  
  /** Check if query is equivalent to another */
  isEquivalent(other: ZeroQueryBuilder<T>): boolean;
}

export interface ZeroQuery<T> {
  /** Zero.js materialize method */
  materialize(ttl: string | number): MaterializedView<T>;
  
  /** Direct data access (if available) */
  readonly data?: T;
  
  /** Query metadata */
  readonly metadata: {
    tableName: string;
    conditions: unknown;
    includes: string[];
    orderBy?: { field: string; direction: 'asc' | 'desc' };
    limit?: number;
    offset?: number;
  };
}

export interface MaterializedView<T> {
  /** Current data */
  readonly data: T;
  
  /** Add listener for changes */
  addListener(callback: (data: T, result?: any) => void): () => void;
  
  /** Destroy the view */
  destroy(): void;
  
  /** Force refresh */
  refresh(): Promise<void>;
  
  /** View metadata */
  readonly metadata: {
    createdAt: number;
    lastUpdated: number;
    listenerCount: number;
    ttl: string | number;
  };
}
```

## Backward Compatibility APIs

### Enhanced ReactiveRecord

Maintains 100% compatibility with existing ReactiveRecord while adding coordinator support.

```typescript
export class ReactiveRecordV2<T extends BaseRecord> implements ReactiveRecord<T> {
  // All existing methods maintained with identical signatures
  find(id: string, options?: QueryOptions): IReactiveQuery<T | null>;
  findBy(conditions: Partial<T>, options?: QueryOptions): IReactiveQuery<T | null>;
  all(): ReactiveScopedQuery<T>;
  where(conditions: Partial<T>): ReactiveScopedQuery<T>;
  kept(): ReactiveScopedQuery<T>;
  discarded(): ReactiveScopedQuery<T>;
  withDiscarded(): ReactiveScopedQuery<T>;
  includes(...relationships: string[]): ReactiveScopedQuery<T>;

  // Enhanced methods with coordinator support
  findCoordinated(id: string, options?: CoordinatedQueryOptions): ReactiveCoordinator<T | null>;
  allCoordinated(options?: CoordinatedQueryOptions): ReactiveCoordinator<T[]>;
  whereCoordinated(conditions: Partial<T>, options?: CoordinatedQueryOptions): ReactiveCoordinator<T[]>;

  // Migration helpers
  enableCoordinatorMode(): void;        // Opt into coordinator for all queries
  disableCoordinatorMode(): void;       // Revert to legacy behavior
  isCoordinatorEnabled(): boolean;      // Check current mode
}

export interface CoordinatedQueryOptions extends QueryOptions {
  /** Coordinator-specific options */
  coordinator?: Partial<CoordinatorOptions>;
  
  /** Whether to use coordinator (default: auto-detect) */
  useCoordinator?: boolean;
  
  /** Share coordinator with other queries using same cache key */
  shareCoordinator?: boolean;
}
```

### Coordinated Query Wrappers

Wrapper classes that maintain ReactiveQuery API while using coordinators internally.

```typescript
export class CoordinatedQueryOne<T> implements IReactiveQuery<T | null> {
  constructor(private coordinator: ReactiveCoordinator<T | null>);

  // ReactiveQuery API compatibility
  get data(): T | null { return this.coordinator.data; }
  get isLoading(): boolean { return this.coordinator.isLoading; }
  get error(): Error | null { return this.coordinator.error; }
  get resultType(): 'loading' | 'complete' | 'error' { 
    return this.mapResultType(this.coordinator.visualState.current);
  }
  get isCollection(): boolean { return false; }
  get present(): boolean { return this.coordinator.data !== null; }
  get blank(): boolean { return this.coordinator.data === null; }

  async refresh(): Promise<void> { return this.coordinator.refresh(); }
  destroy(): void { this.coordinator.destroy(); }
  subscribe(callback: (data: T | null) => void): () => void;

  // Enhanced API access
  get coordinator(): ReactiveCoordinator<T | null> { return this.coordinator; }
  get visualState(): VisualState { return this.coordinator.visualState; }

  private mapResultType(state: VisualStateType): 'loading' | 'complete' | 'error' {
    switch (state) {
      case 'ready': return 'complete';
      case 'error': return 'error';
      default: return 'loading';
    }
  }
}

export class CoordinatedQueryMany<T> implements IReactiveQuery<T[]> {
  constructor(private coordinator: ReactiveCoordinator<T[]>);

  // Similar implementation for arrays
  get data(): T[] { return this.coordinator.data || []; }
  get isCollection(): boolean { return true; }
  // ... rest similar to CoordinatedQueryOne
}
```

## Component Integration APIs

### ReactiveView Component

Enhanced component for coordinated reactive rendering.

```typescript
// Svelte component interface
export interface ReactiveViewProps<T> {
  /** The coordinator managing the data */
  coordinator: ReactiveCoordinator<T>;
  
  /** Loading skeleton configuration */
  skeleton?: {
    type: 'generic' | 'table' | 'cards' | 'list';
    count: number;
    height?: string;
    animation?: 'pulse' | 'shimmer' | 'wave';
  };
  
  /** Error display configuration */
  errorDisplay?: {
    showRetry: boolean;
    showDetails: boolean;
    customMessage?: string;
  };
  
  /** Hydrating state configuration */
  hydrating?: {
    showIndicator: boolean;
    indicatorType: 'spinner' | 'pulse' | 'progress';
    position: 'top' | 'bottom' | 'overlay';
  };
  
  /** Custom class names */
  class?: string;
  
  /** Custom styles */
  style?: string;
}

// Slot props provided to content
export interface ReactiveViewSlotProps<T> {
  /** Current data */
  data: T | null;
  
  /** Current visual state */
  visualState: VisualState;
  
  /** Coordinator instance for advanced usage */
  coordinator: ReactiveCoordinator<T>;
  
  /** Helper functions */
  helpers: {
    refresh: () => Promise<void>;
    retry: () => Promise<void>;
    isStale: () => boolean;
    getAge: () => number;
  };
}
```

### Component Hooks (for non-Svelte frameworks)

```typescript
export interface UseReactiveCoordinatorOptions<T> {
  queryBuilder: () => ZeroQuery<T> | null;
  options?: CoordinatorOptions;
  dependencies?: unknown[]; // For dependency tracking
}

export interface UseReactiveCoordinatorResult<T> {
  data: T | null;
  error: Error | null;
  visualState: VisualState;
  isLoading: boolean;
  isReady: boolean;
  isHydrating: boolean;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
  coordinator: ReactiveCoordinator<T>;
}

// React hook (if needed)
export function useReactiveCoordinator<T>(
  options: UseReactiveCoordinatorOptions<T>
): UseReactiveCoordinatorResult<T>;

// Vanilla JS helper
export function createReactiveCoordinator<T>(
  queryBuilder: () => ZeroQuery<T> | null,
  options?: CoordinatorOptions
): ReactiveCoordinator<T>;
```

## Migration and Factory APIs

### Factory Functions

```typescript
// Create coordinators with intelligent defaults
export function createActivityLogCoordinator(
  options?: Partial<CoordinatorOptions>
): ReactiveCoordinator<ActivityLogData[]> {
  return new ReactiveCoordinator(
    () => ReactiveActivityLog.includes(['user', 'client', 'job'])
      .orderBy('created_at', 'asc')
      .limit(500)
      .buildZeroQuery(),
    {
      minimumHydratingTime: 200,
      maxStaleTime: 30000,
      defaultTtl: '5m',
      staleWhileRevalidate: true,
      ...options
    }
  );
}

export function createJobListCoordinator(
  filters?: Partial<JobData>,
  options?: Partial<CoordinatorOptions>
): ReactiveCoordinator<JobData[]> {
  return new ReactiveCoordinator(
    () => ReactiveJob.includes(['client', 'tasks'])
      .where(filters || {})
      .orderBy('created_at', 'desc')
      .buildZeroQuery(),
    {
      minimumHydratingTime: 150,
      maxStaleTime: 60000,
      defaultTtl: '10m',
      ...options
    }
  );
}

// Generic factory for any model
export function createModelCoordinator<T extends BaseRecord>(
  model: ReactiveRecord<T>,
  queryBuilder: (model: ReactiveRecord<T>) => ZeroQueryBuilder<T>,
  options?: Partial<CoordinatorOptions>
): ReactiveCoordinator<T> {
  return new ReactiveCoordinator(
    () => queryBuilder(model).buildZeroQuery(),
    options
  );
}
```

### Migration Utilities

```typescript
export interface MigrationContext {
  /** Current ReactiveQuery instances being used */
  existingQueries: Map<string, IReactiveQuery<any>>;
  
  /** Components that will be migrated */
  targetComponents: string[];
  
  /** Migration options */
  options: {
    preserveExistingBehavior: boolean;
    enableDebugMode: boolean;
    rollbackOnError: boolean;
  };
}

export class ReactiveRecordMigrator {
  static analyzeCurrentUsage(projectPath: string): MigrationContext;
  
  static generateMigrationPlan(context: MigrationContext): MigrationPlan;
  
  static validateMigration(plan: MigrationPlan): ValidationResult;
  
  static executeMigration(plan: MigrationPlan): Promise<MigrationResult>;
  
  static rollbackMigration(result: MigrationResult): Promise<void>;
}

export interface MigrationPlan {
  phases: MigrationPhase[];
  estimatedTimeMinutes: number;
  riskLevel: 'low' | 'medium' | 'high';
  rollbackStrategy: RollbackStrategy;
}

export interface MigrationPhase {
  name: string;
  description: string;
  components: string[];
  changes: CodeChange[];
  tests: TestCase[];
}
```

## Error Handling APIs

### Error Types

```typescript
export class ReactiveCoordinatorError extends Error {
  constructor(
    message: string,
    public readonly code: CoordinatorErrorCode,
    public readonly context?: unknown
  ) {
    super(message);
    this.name = 'ReactiveCoordinatorError';
  }
}

export enum CoordinatorErrorCode {
  QUERY_BUILDER_FAILED = 'QUERY_BUILDER_FAILED',
  ZERO_CLIENT_UNAVAILABLE = 'ZERO_CLIENT_UNAVAILABLE',
  MATERIALIZATION_FAILED = 'MATERIALIZATION_FAILED',
  LISTENER_ERROR = 'LISTENER_ERROR',
  INVALID_TTL = 'INVALID_TTL',
  STALE_DATA_TIMEOUT = 'STALE_DATA_TIMEOUT',
  RETRY_EXHAUSTED = 'RETRY_EXHAUSTED',
  COORDINATOR_DESTROYED = 'COORDINATOR_DESTROYED'
}

export interface ErrorContext {
  coordinatorId: string;
  queryMetadata: unknown;
  attemptNumber: number;
  timestamp: number;
  userAgent?: string;
  networkStatus?: 'online' | 'offline';
}
```

### Error Recovery

```typescript
export interface ErrorRecoveryStrategy {
  shouldRetry(error: Error, attempt: number, context: ErrorContext): boolean;
  getRetryDelayMs(attempt: number): number;
  getMaxRetries(): number;
  shouldFallbackToStale(error: Error): boolean;
  shouldShowErrorUI(error: Error): boolean;
}

export class DefaultErrorRecoveryStrategy implements ErrorRecoveryStrategy {
  constructor(private options?: {
    maxRetries?: number;
    baseDelayMs?: number;
    exponentialBackoff?: boolean;
    fallbackToStaleOnNetwork?: boolean;
  });

  shouldRetry(error: Error, attempt: number, context: ErrorContext): boolean;
  getRetryDelayMs(attempt: number): number;
  getMaxRetries(): number;
  shouldFallbackToStale(error: Error): boolean;
  shouldShowErrorUI(error: Error): boolean;
}
```

## Performance and Monitoring APIs

### Performance Monitoring

```typescript
export interface PerformanceMetrics {
  /** Time from coordinator creation to first data */
  timeToFirstData: number;
  
  /** Time from query trigger to data ready */
  queryLatency: number;
  
  /** Number of prevented skeleton flashes */
  flashPreventionCount: number;
  
  /** Time spent in each visual state */
  stateTimeBreakdown: Record<VisualStateType, number>;
  
  /** Cache hit/miss ratio */
  cacheEfficiency: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  
  /** Memory usage statistics */
  memoryUsage: {
    coordinatorBytes: number;
    dataBytes: number;
    listenerCount: number;
  };
}

export interface MonitoringHooks {
  onStateChange?(from: VisualStateType, to: VisualStateType, duration: number): void;
  onDataReceived?(dataSize: number, latency: number): void;
  onError?(error: Error, context: ErrorContext): void;
  onCacheHit?(cacheKey: string): void;
  onCacheMiss?(cacheKey: string): void;
  onFlashPrevented?(reason: string): void;
}

export class PerformanceMonitor {
  constructor(private hooks?: MonitoringHooks);
  
  attachToCoordinator(coordinator: ReactiveCoordinator<any>): () => void;
  getMetrics(): PerformanceMetrics;
  exportReport(format: 'json' | 'csv' | 'html'): string;
  reset(): void;
}
```

### Debug APIs

```typescript
export interface DebugInfo<T> {
  coordinatorId: string;
  currentState: VisualStateType;
  stateHistory: Array<{
    state: VisualStateType;
    timestamp: number;
    duration: number;
    trigger: string;
  }>;
  queryInfo: {
    builderSource: string;
    cacheKey: string;
    lastQuery: number;
    queryCount: number;
  };
  dataInfo: {
    lastUpdated: number;
    dataSize: number;
    isStale: boolean;
    staleDuration: number;
  };
  listenerInfo: {
    count: number;
    callbacks: string[];
  };
}

export interface DebugOptions {
  enableStateLogging: boolean;
  enableQueryLogging: boolean;
  enableDataLogging: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  maxHistoryEntries: number;
}

export class ReactiveCoordinatorDebugger {
  constructor(private options?: DebugOptions);
  
  attachToCoordinator<T>(coordinator: ReactiveCoordinator<T>): () => void;
  getDebugInfo<T>(coordinator: ReactiveCoordinator<T>): DebugInfo<T>;
  exportLogs(format: 'json' | 'text'): string;
  
  // Global debugging
  static enableGlobalDebugging(options?: DebugOptions): void;
  static disableGlobalDebugging(): void;
  static getAllCoordinators(): ReactiveCoordinator<any>[];
}
```

## Type Safety and Validation

### Type Guards

```typescript
export function isReactiveCoordinator<T>(obj: unknown): obj is ReactiveCoordinator<T> {
  return obj instanceof ReactiveCoordinator;
}

export function isVisualState(obj: unknown): obj is VisualState {
  return typeof obj === 'object' && 
         obj !== null && 
         'current' in obj && 
         'shouldShowSkeleton' in obj;
}

export function isCoordinatorError(error: unknown): error is ReactiveCoordinatorError {
  return error instanceof ReactiveCoordinatorError;
}
```

### Runtime Validation

```typescript
export interface ValidationRule<T> {
  name: string;
  validate(value: T): boolean;
  message: string;
}

export class CoordinatorValidator<T> {
  constructor(private rules: ValidationRule<T>[]);
  
  validate(coordinator: ReactiveCoordinator<T>): ValidationResult;
  validateState(state: ReactiveCoordinatorState<T>): ValidationResult;
  validateOptions(options: CoordinatorOptions): ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
```

This comprehensive API specification ensures backward compatibility while providing powerful new capabilities for flash prevention and enhanced reactive state management.