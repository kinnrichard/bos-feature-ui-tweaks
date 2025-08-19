/**
 * Tests for ReactiveCoordinator - Core state lifecycle management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReactiveCoordinator, type CoordinatorState, type VisualState } from './coordinator';

// Mock ReactiveQuery
class MockReactiveQuery<T> {
  public subscribers: Array<(data: T, meta: { isLoading: boolean; error: Error | null }) => void> =
    [];
  public mockData: T | null = null;
  public mockIsLoading = true;
  public mockError: Error | null = null;
  public isDestroyed = false;

  constructor(public isCollection = false) {}

  get data() {
    return this.mockData;
  }
  get isLoading() {
    return this.mockIsLoading;
  }
  get error() {
    return this.mockError;
  }
  get resultType() {
    return 'loading' as const;
  }
  get present() {
    return this.mockData !== null;
  }
  get blank() {
    return this.mockData === null;
  }

  subscribe(callback: (data: T, meta: { isLoading: boolean; error: Error | null }) => void) {
    this.subscribers.push(callback);
    // Immediately call with current state
    callback(this.mockData as T, { isLoading: this.mockIsLoading, error: this.mockError });

    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  async refresh() {
    // Simulate refresh
  }

  destroy() {
    this.isDestroyed = true;
    this.subscribers = [];
  }

  // Test helper to simulate data changes
  simulateDataChange(data: T | null, isLoading = false, error: Error | null = null) {
    this.mockData = data;
    this.mockIsLoading = isLoading;
    this.mockError = error;

    this.subscribers.forEach((callback) => {
      callback(data as T, { isLoading, error });
    });
  }
}

describe('ReactiveCoordinator', () => {
  let mockQuery: MockReactiveQuery<string>;
  let coordinator: ReactiveCoordinator<string>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockQuery = new MockReactiveQuery<string>();
    coordinator = new ReactiveCoordinator(mockQuery as any);
  });

  afterEach(() => {
    coordinator.destroy();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should start in initializing state', () => {
      const visualState = coordinator.visualState;
      expect(visualState.state).toBe('initializing');
      expect(visualState.isInitialLoad).toBe(true);
      expect(visualState.shouldShowLoading).toBe(true);
    });

    it('should transition to ready when data is received', () => {
      mockQuery.simulateDataChange('test data', false);

      const visualState = coordinator.visualState;
      expect(visualState.displayData).toBe('test data');
      expect(visualState.state).toBe('ready');
      expect(visualState.shouldShowLoading).toBe(false);
    });
  });

  describe('state transitions', () => {
    it('should preserve stale data during hydrating state', async () => {
      // First, get some data
      mockQuery.simulateDataChange('initial data', false);
      expect(coordinator.visualState.displayData).toBe('initial data');

      // Start refresh (should go to hydrating)
      const refreshPromise = coordinator.refresh();

      // Should still show initial data
      const visualState = coordinator.visualState;
      expect(visualState.displayData).toBe('initial data');
      expect(visualState.state).toBe('hydrating');

      // Simulate new data coming in
      mockQuery.simulateDataChange('updated data', false);

      await refreshPromise;
      expect(coordinator.visualState.displayData).toBe('updated data');
    });

    it('should handle error states properly', () => {
      const testError = new Error('Test error');
      mockQuery.simulateDataChange(null, false, testError);

      const visualState = coordinator.visualState;
      expect(visualState.state).toBe('error');
      expect(visualState.error).toBe(testError);
      expect(visualState.shouldShowError).toBe(false); // Because preserveStaleData is true by default
    });

    it('should respect minimum loading time', () => {
      const coordinator = new ReactiveCoordinator(mockQuery as any, {
        minimumLoadingTime: 500,
      });

      // Simulate data arriving quickly
      mockQuery.simulateDataChange('quick data', false);

      // Should still be in loading state due to minimum time
      expect(coordinator.visualState.shouldShowLoading).toBe(true);

      // Fast forward past minimum time
      vi.advanceTimersByTime(500);

      // Now should be ready
      expect(coordinator.visualState.state).toBe('ready');
      expect(coordinator.visualState.shouldShowLoading).toBe(false);

      coordinator.destroy();
    });
  });

  describe('visual state computation', () => {
    it('should compute shouldShowEmpty correctly for collections', () => {
      const mockArrayQuery = new MockReactiveQuery<string[]>(true);
      const coordinator = new ReactiveCoordinator(mockArrayQuery as any);

      // Empty array should trigger empty state
      mockArrayQuery.simulateDataChange([], false);

      const visualState = coordinator.visualState;
      expect(visualState.shouldShowEmpty).toBe(true);
      expect(visualState.displayData).toEqual([]);

      coordinator.destroy();
    });

    it('should compute shouldShowEmpty correctly for single items', () => {
      mockQuery.simulateDataChange(null, false);

      const visualState = coordinator.visualState;
      expect(visualState.shouldShowEmpty).toBe(true);
      expect(visualState.displayData).toBe(null);
    });

    it('should track data freshness', () => {
      // Initially not fresh
      expect(coordinator.visualState.isFresh).toBe(false);

      // After data arrives, should be fresh
      mockQuery.simulateDataChange('fresh data', false);
      expect(coordinator.visualState.isFresh).toBe(true);

      // During hydrating, data becomes stale
      coordinator.refresh();
      expect(coordinator.visualState.isFresh).toBe(true); // Still considered fresh during hydrating
    });
  });

  describe('subscription management', () => {
    it('should notify subscribers of state changes', () => {
      const mockSubscriber = vi.fn();
      const unsubscribe = coordinator.subscribe(mockSubscriber);

      // Should be called immediately with initial state
      expect(mockSubscriber).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'initializing',
          isInitialLoad: true,
        })
      );

      // Clear previous calls
      mockSubscriber.mockClear();

      // Simulate data change
      mockQuery.simulateDataChange('new data', false);

      // Should be notified of new state
      expect(mockSubscriber).toHaveBeenCalledWith(
        expect.objectContaining({
          displayData: 'new data',
          state: 'ready',
        })
      );

      unsubscribe();
    });

    it('should handle subscriber errors gracefully', () => {
      const badSubscriber = vi.fn(() => {
        throw new Error('Subscriber error');
      });

      const goodSubscriber = vi.fn();

      coordinator.subscribe(badSubscriber);
      coordinator.subscribe(goodSubscriber);

      // Should not throw when notifying subscribers
      expect(() => {
        mockQuery.simulateDataChange('test data', false);
      }).not.toThrow();

      // Good subscriber should still be called
      expect(goodSubscriber).toHaveBeenCalled();
    });
  });

  describe('cleanup and destruction', () => {
    it('should clean up resources on destroy', () => {
      const mockSubscriber = vi.fn();
      coordinator.subscribe(mockSubscriber);

      coordinator.destroy();

      // Should not receive further notifications
      mockSubscriber.mockClear();
      mockQuery.simulateDataChange('post-destroy data', false);
      expect(mockSubscriber).not.toHaveBeenCalled();

      // Query should be destroyed
      expect(mockQuery.isDestroyed).toBe(true);
    });

    it('should handle multiple destroy calls safely', () => {
      expect(() => {
        coordinator.destroy();
        coordinator.destroy();
      }).not.toThrow();
    });
  });

  describe('configuration options', () => {
    it('should respect preserveStaleData setting', () => {
      const coordinator = new ReactiveCoordinator(mockQuery as any, {
        preserveStaleData: false,
      });

      // Set some initial data
      mockQuery.simulateDataChange('initial data', false);
      expect(coordinator.visualState.displayData).toBe('initial data');

      // Simulate error
      const testError = new Error('Test error');
      mockQuery.simulateDataChange(null, false, testError);

      // With preserveStaleData: false, should not show stale data in error state
      const visualState = coordinator.visualState;
      expect(visualState.displayData).toBe(null);
      expect(visualState.shouldShowError).toBe(true);

      coordinator.destroy();
    });

    it('should handle initial load timeout', () => {
      const coordinator = new ReactiveCoordinator(mockQuery as any, {
        initialLoadTimeout: 1000,
      });

      // Fast forward past timeout
      vi.advanceTimersByTime(1000);

      // Should transition to error state
      const visualState = coordinator.visualState;
      expect(visualState.state).toBe('error');
      expect(visualState.error?.message).toContain('timeout');

      coordinator.destroy();
    });
  });
});
