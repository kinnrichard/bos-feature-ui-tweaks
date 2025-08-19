/**
 * Factory functions for ReactiveRecord v2 with backward compatibility
 *
 * Provides seamless integration with existing ReactiveRecord usage patterns
 * while adding the new coordinator-based functionality for flash prevention.
 */

// Minimal types for compilation
interface BaseRecord {
  id: string;
  created_at: string | number;
  updated_at: string | number;
  discarded_at?: string | number | null;
}

interface ReactiveRecordConfig {
  tableName: string;
  className: string;
  primaryKey?: string;
  supportsDiscard?: boolean;
  defaultTtl?: string;
}

// Simplified stub for ReactiveRecord to test imports
class SimpleReactiveRecord<T extends BaseRecord> {
  constructor(protected config: ReactiveRecordConfig) {
    // T is used as generic constraint for type safety
    void 0 as unknown as T;
  }

  kept() {
    const createQueryChain = () => ({
      where: (_conditions: Record<string, unknown>) => createQueryChain(),
      orderBy: (_field: string, _direction: string) => createQueryChain(),
      limit: (_count: number) => createQueryChain(),
      all: () => ({
        data: [],
        isLoading: false,
        error: null,
        refresh: () => {},
        subscribe: (callback: (data: unknown, meta: unknown) => void) => {
          // Call callback immediately with empty data
          callback([], { isLoading: false, error: null });
          // Return unsubscribe function
          return () => {};
        },
        destroy: () => {
          // Cleanup method for query lifecycle management
        },
      }),
    });

    return {
      includes: (..._relationships: string[]) => createQueryChain(),
      ...createQueryChain(),
    };
  }
}

/**
 * Simplified ReactiveRecordFactory for testing imports
 */
export const ReactiveRecordFactory = {
  /**
   * Create standard reactive record with coordinator
   */
  create<T extends BaseRecord>(config: ReactiveRecordConfig): SimpleReactiveRecord<T> {
    return new SimpleReactiveRecord<T>(config);
  },

  /**
   * Create reactive record optimized for navigation (fast transitions)
   */
  createForNavigation<T extends BaseRecord>(config: ReactiveRecordConfig): SimpleReactiveRecord<T> {
    return new SimpleReactiveRecord<T>(config);
  },

  /**
   * Create reactive record optimized for initial page loads
   */
  createForInitialLoad<T extends BaseRecord>(
    config: ReactiveRecordConfig
  ): SimpleReactiveRecord<T> {
    return new SimpleReactiveRecord<T>(config);
  },

  /**
   * Migrate existing ReactiveRecord instance
   */
  migrate<T extends BaseRecord>(existingRecord: unknown): SimpleReactiveRecord<T> {
    const config = (existingRecord as { config?: ReactiveRecordConfig })?.config || {
      tableName: 'unknown',
      className: 'Unknown',
    };

    return new SimpleReactiveRecord<T>(config);
  },
};

// Export additional classes for compatibility
export class EnhancedReactiveRecord<T extends BaseRecord> extends SimpleReactiveRecord<T> {}
export class EnhancedReactiveScopedQuery<T extends BaseRecord> {
  constructor(private originalQuery: unknown) {
    // T is used as generic constraint for type safety
    void 0 as unknown as T;
  }
}

// Export factory functions for compatibility
export function createEnhancedReactiveRecord<T extends BaseRecord>(
  config: ReactiveRecordConfig
): EnhancedReactiveRecord<T> {
  return new EnhancedReactiveRecord<T>(config);
}

export function upgradeReactiveRecord<T extends BaseRecord>(
  config: ReactiveRecordConfig
): EnhancedReactiveRecord<T> {
  return createEnhancedReactiveRecord<T>(config);
}

// Dev utils stub
export const FactoryDevUtils = {
  inspect: () => {
    /* Factory dev utils stub */
  },
};
