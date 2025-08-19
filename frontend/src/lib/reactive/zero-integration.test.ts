/**
 * Tests for Zero.js Integration with ReactiveRecord v2
 *
 * Validates that the new coordinator system integrates seamlessly with
 * Zero.js reactive queries and provides enhanced functionality without
 * breaking existing Zero.js patterns.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withCoordinator, ReactiveQueryFactory } from '../../src/lib/reactive/integration';
import { ReactiveRecordFactory } from '../../src/lib/reactive/factory';

// Mock Zero.js reactive query implementation
class MockZeroReactiveQuery<T> {
  private _data: T | null = null;
  private _isLoading = false;
  private _error: Error | null = null;
  private subscribers: Array<(data: T, meta: { isLoading: boolean; error: Error | null }) => void> =
    [];
  private refreshHandlers: Array<() => Promise<void>> = [];

  constructor(
    initialData: T | null = null,
    public isCollection = false
  ) {
    this._data = initialData;
  }

  // Zero.js-style reactive properties
  get data(): T | null {
    return this._data;
  }
  get isLoading(): boolean {
    return this._isLoading;
  }
  get error(): Error | null {
    return this._error;
  }
  get resultType(): 'loading' | 'complete' | 'error' {
    if (this._error) return 'error';
    if (this._isLoading) return 'loading';
    return 'complete';
  }
  get present(): boolean {
    if (this._data === null || this._data === undefined) return false;
    if (Array.isArray(this._data)) return this._data.length > 0;
    return true;
  }
  get blank(): boolean {
    return !this.present;
  }

  // Zero.js-style subscription
  subscribe(
    callback: (data: T, meta: { isLoading: boolean; error: Error | null }) => void
  ): () => void {
    this.subscribers.push(callback);

    // Immediately notify with current state
    callback(this._data as T, {
      isLoading: this._isLoading,
      error: this._error,
    });

    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  // Zero.js-style refresh
  async refresh(): Promise<void> {
    this._isLoading = true;
    this.notifySubscribers();

    try {
      // Execute all refresh handlers
      await Promise.all(this.refreshHandlers.map((handler) => handler()));

      this._isLoading = false;
      this.notifySubscribers();
    } catch (error) {
      this._error = error as Error;
      this._isLoading = false;
      this.notifySubscribers();
    }
  }

  destroy(): void {
    this.subscribers = [];
    this.refreshHandlers = [];
  }

  // Test utilities
  setData(data: T | null): void {
    this._data = data;
    this.notifySubscribers();
  }

  setLoading(loading: boolean): void {
    this._isLoading = loading;
    this.notifySubscribers();
  }

  setError(error: Error | null): void {
    this._error = error;
    this.notifySubscribers();
  }

  addRefreshHandler(handler: () => Promise<void>): void {
    this.refreshHandlers.push(handler);
  }

  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => {
      callback(this._data as T, {
        isLoading: this._isLoading,
        error: this._error,
      });
    });
  }
}

// Mock coordinator
const mockCoordinator = {
  visualState: {
    displayData: null,
    shouldShowLoading: false,
    shouldShowEmpty: false,
    shouldShowError: false,
    state: 'ready',
    error: null,
    isFresh: true,
    isInitialLoad: false,
  },
  subscribe: vi.fn(),
  refresh: vi.fn(),
  destroy: vi.fn(),
};

vi.mock('../../src/lib/reactive/coordinator', () => ({
  createReactiveCoordinator: vi.fn(() => mockCoordinator),
}));

describe('Zero.js Integration with ReactiveRecord v2', () => {
  let zeroQuery: MockZeroReactiveQuery<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    zeroQuery = new MockZeroReactiveQuery();

    // Setup coordinator subscription mock
    mockCoordinator.subscribe.mockImplementation((callback) => {
      callback(mockCoordinator.visualState);
      return () => {};
    });
  });

  describe('Enhanced Query Wrapper', () => {
    it('should preserve Zero.js reactive query interface', () => {
      const enhanced = withCoordinator(zeroQuery as any);

      // Should maintain all Zero.js properties
      expect(enhanced.data).toBe(zeroQuery.data);
      expect(enhanced.isLoading).toBe(zeroQuery.isLoading);
      expect(enhanced.error).toBe(zeroQuery.error);
      expect(enhanced.resultType).toBe(zeroQuery.resultType);
      expect(enhanced.isCollection).toBe(zeroQuery.isCollection);
      expect(enhanced.present).toBe(zeroQuery.present);
      expect(enhanced.blank).toBe(zeroQuery.blank);
    });

    it('should add coordinator capabilities to Zero.js queries', () => {
      const enhanced = withCoordinator(zeroQuery as any);

      // Should have coordinator enhancements
      expect(enhanced.coordinator).toBeDefined();
      expect(typeof enhanced.getVisualState).toBe('function');
      expect(typeof enhanced.subscribeToVisualState).toBe('function');
    });

    it('should handle Zero.js subscription patterns', () => {
      const enhanced = withCoordinator(zeroQuery as any);
      const callback = vi.fn();

      const unsubscribe = enhanced.subscribe(callback);

      // Should work with Zero.js-style subscriptions
      expect(callback).toHaveBeenCalledWith(zeroQuery.data);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should coordinate refresh with Zero.js queries', async () => {
      const enhanced = withCoordinator(zeroQuery as any);
      const refreshSpy = vi.spyOn(zeroQuery, 'refresh');

      await enhanced.refresh();

      // Should delegate to coordinator refresh, not Zero.js refresh directly
      expect(mockCoordinator.refresh).toHaveBeenCalled();
      // Zero.js refresh should not be called directly
      expect(refreshSpy).not.toHaveBeenCalled();
    });
  });

  describe('Zero.js Collection Queries', () => {
    it('should handle Zero.js collection queries', () => {
      const collectionData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];

      const collectionQuery = new MockZeroReactiveQuery(collectionData, true);
      const enhanced = withCoordinator(collectionQuery as any);

      expect(enhanced.isCollection).toBe(true);
      expect(enhanced.data).toEqual(collectionData);
      expect(enhanced.present).toBe(true);
    });

    it('should handle empty Zero.js collections', () => {
      const emptyQuery = new MockZeroReactiveQuery([], true);
      const enhanced = withCoordinator(emptyQuery as any);

      expect(enhanced.isCollection).toBe(true);
      expect(enhanced.data).toEqual([]);
      expect(enhanced.blank).toBe(true);
    });

    it('should coordinate collection state changes', () => {
      const collectionQuery = new MockZeroReactiveQuery<any[]>([], true);
      const enhanced = withCoordinator(collectionQuery as any);

      const stateCallback = vi.fn();
      enhanced.subscribeToVisualState!(stateCallback);

      // Simulate Zero.js data change
      collectionQuery.setData([{ id: 1, name: 'New Item' }]);

      // Coordinator should have received the update
      expect(mockCoordinator.subscribe).toHaveBeenCalled();
    });
  });

  describe('Zero.js Single Record Queries', () => {
    it('should handle Zero.js single record queries', () => {
      const recordData = { id: 1, name: 'Single Record' };
      const recordQuery = new MockZeroReactiveQuery(recordData, false);
      const enhanced = withCoordinator(recordQuery as any);

      expect(enhanced.isCollection).toBe(false);
      expect(enhanced.data).toEqual(recordData);
      expect(enhanced.present).toBe(true);
    });

    it('should handle null Zero.js records', () => {
      const nullQuery = new MockZeroReactiveQuery(null, false);
      const enhanced = withCoordinator(nullQuery as any);

      expect(enhanced.data).toBe(null);
      expect(enhanced.blank).toBe(true);
    });
  });

  describe('Zero.js Error Handling', () => {
    it('should integrate Zero.js errors with coordinator', () => {
      const errorQuery = new MockZeroReactiveQuery(null);
      const testError = new Error('Zero.js query error');

      errorQuery.setError(testError);

      const enhanced = withCoordinator(errorQuery as any);

      expect(enhanced.error).toBe(testError);
      expect(enhanced.resultType).toBe('error');
    });

    it('should handle Zero.js loading states', () => {
      const loadingQuery = new MockZeroReactiveQuery(null);
      loadingQuery.setLoading(true);

      const enhanced = withCoordinator(loadingQuery as any);

      expect(enhanced.isLoading).toBe(true);
      expect(enhanced.resultType).toBe('loading');
    });
  });

  describe('ReactiveRecord Factory with Zero.js', () => {
    it('should create factory records that work with Zero.js patterns', () => {
      const ReactiveActivityLog = ReactiveRecordFactory.create({
        tableName: 'activity_logs',
        className: 'ActivityLog',
      });

      // Simulate methods that would return Zero.js queries
      const findQuery = ReactiveActivityLog.find('123');
      const allQuery = ReactiveActivityLog.all().all();

      // Should have coordinator integration
      expect(findQuery).toHaveProperty('coordinator');
      expect(allQuery).toHaveProperty('coordinator');
    });

    it('should support Zero.js query chaining patterns', () => {
      const ReactiveClient = ReactiveRecordFactory.create({
        tableName: 'clients',
        className: 'Client',
      });

      // Simulate Zero.js-style chaining
      const complexQuery = ReactiveClient.kept()
        .where({ status: 'active' })
        .includes('jobs', 'contacts')
        .orderBy('name', 'asc')
        .limit(10)
        .all();

      expect(complexQuery).toHaveProperty('coordinator');
    });
  });

  describe('Integration Factory Methods', () => {
    it('should create navigation-optimized queries for Zero.js', async () => {
      const zeroQuery = new MockZeroReactiveQuery([]);
      const { createReactiveCoordinator } = await import('../../src/lib/reactive/coordinator');

      ReactiveQueryFactory.createForNavigation(zeroQuery as any);

      expect(createReactiveCoordinator).toHaveBeenCalledWith(
        zeroQuery,
        expect.objectContaining({
          minimumLoadingTime: 100,
          preserveStaleData: true,
        })
      );
    });

    it('should create initial-load-optimized queries for Zero.js', async () => {
      const zeroQuery = new MockZeroReactiveQuery(null);
      const { createReactiveCoordinator } = await import('../../src/lib/reactive/coordinator');

      ReactiveQueryFactory.createForInitialLoad(zeroQuery as any);

      expect(createReactiveCoordinator).toHaveBeenCalledWith(
        zeroQuery,
        expect.objectContaining({
          minimumLoadingTime: 500,
          initialLoadTimeout: 15000,
          preserveStaleData: false,
        })
      );
    });
  });

  describe('Zero.js Lifecycle Integration', () => {
    it('should properly destroy Zero.js queries with coordinator', () => {
      const zeroQuery = new MockZeroReactiveQuery([]);
      const destroySpy = vi.spyOn(zeroQuery, 'destroy');

      const enhanced = withCoordinator(zeroQuery as any);
      enhanced.destroy();

      expect(mockCoordinator.destroy).toHaveBeenCalled();
      expect(destroySpy).toHaveBeenCalled();
    });

    it('should handle Zero.js subscription cleanup', () => {
      const zeroQuery = new MockZeroReactiveQuery([]);
      const enhanced = withCoordinator(zeroQuery as any);

      const callback = vi.fn();
      const unsubscribe = enhanced.subscribe(callback);

      // Should be able to unsubscribe without errors
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('Real-world Zero.js Scenarios', () => {
    it('should handle ActivityLog Zero.js queries', () => {
      // Simulate actual ActivityLog data structure
      const activityLogData = [
        {
          id: 1,
          action: 'created',
          entity_type: 'Job',
          entity_id: 123,
          user_id: 456,
          created_at: '2024-01-01T10:00:00Z',
          changes: { status: 'pending' },
        },
        {
          id: 2,
          action: 'updated',
          entity_type: 'Job',
          entity_id: 123,
          user_id: 456,
          created_at: '2024-01-01T11:00:00Z',
          changes: { status: 'in_progress' },
        },
      ];

      const activityLogQuery = new MockZeroReactiveQuery(activityLogData, true);
      const enhanced = withCoordinator(activityLogQuery as any, {
        preserveStaleData: true,
        minimumLoadingTime: 300,
      });

      expect(enhanced.isCollection).toBe(true);
      expect(enhanced.data).toHaveLength(2);
      expect(enhanced.present).toBe(true);

      // Should maintain Zero.js data structure
      expect(enhanced.data[0]).toHaveProperty('action', 'created');
      expect(enhanced.data[1]).toHaveProperty('changes');
    });

    it('should integrate with Zero.js custom query methods', async () => {
      const zeroQuery = new MockZeroReactiveQuery([]);

      // Simulate custom Zero.js refresh logic
      zeroQuery.addRefreshHandler(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        zeroQuery.setData([{ id: 1, refreshed: true }]);
      });

      const enhanced = withCoordinator(zeroQuery as any);

      // Coordinator refresh should work with Zero.js custom logic
      mockCoordinator.refresh.mockImplementation(async () => {
        await zeroQuery.refresh();
      });

      await enhanced.refresh();

      expect(mockCoordinator.refresh).toHaveBeenCalled();
    });

    it('should support Zero.js query reuse patterns', () => {
      // Simulate shared Zero.js query instance
      const sharedQuery = new MockZeroReactiveQuery([{ shared: true }], true);

      const enhanced1 = withCoordinator(sharedQuery as any);
      const enhanced2 = withCoordinator(sharedQuery as any);

      // Both should work independently
      expect(enhanced1.data).toEqual(enhanced2.data);
      expect(enhanced1.coordinator).not.toBe(enhanced2.coordinator);
    });
  });

  describe('Migration Compatibility', () => {
    it('should maintain backward compatibility with existing Zero.js usage', () => {
      const existingZeroQuery = new MockZeroReactiveQuery([{ legacy: true }]);

      // Existing code pattern
      const callback = vi.fn();
      const unsubscribe = existingZeroQuery.subscribe(callback);

      // Should work the same after enhancement
      const enhanced = withCoordinator(existingZeroQuery as any);
      const enhancedCallback = vi.fn();
      const enhancedUnsubscribe = enhanced.subscribe(enhancedCallback);

      expect(callback).toHaveBeenCalled();
      expect(enhancedCallback).toHaveBeenCalled();

      expect(() => {
        unsubscribe();
        enhancedUnsubscribe();
      }).not.toThrow();
    });

    it('should work with existing Zero.js error patterns', () => {
      const errorQuery = new MockZeroReactiveQuery(null);
      const networkError = new Error('Network connection failed');

      errorQuery.setError(networkError);

      const enhanced = withCoordinator(errorQuery as any);

      // Should preserve Zero.js error handling
      expect(enhanced.error).toBe(networkError);
      expect(enhanced.resultType).toBe('error');
      expect(enhanced.blank).toBe(true);
    });
  });
});
