/**
 * Performance tests for ReactiveRecord v2 Flash Prevention
 *
 * Validates timing thresholds, coordinator performance, and ensures
 * flash prevention meets the <50ms initialization requirement and
 * proper minimum loading time enforcement.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ReactiveCoordinator,
  createReactiveCoordinator,
  type CoordinatorConfig,
} from '../../src/lib/reactive/coordinator';
import { ReactiveRecordFactory } from '../../src/lib/reactive/factory';
import { withCoordinator, ReactiveQueryFactory } from '../../src/lib/reactive/integration';

// Performance test utilities
class PerformanceTimer {
  private startTime: number = 0;

  start() {
    this.startTime = performance.now();
  }

  elapsed(): number {
    return performance.now() - this.startTime;
  }
}

// Mock ReactiveQuery for performance testing
class MockReactiveQuery<T> {
  public subscribers: Array<(data: T, meta: { isLoading: boolean; error: Error | null }) => void> =
    [];
  public mockData: T | null = null;
  public mockIsLoading = true;
  public mockError: Error | null = null;
  public isDestroyed = false;
  public refreshDelay = 0; // Configurable delay for refresh simulation

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
    callback(this.mockData as T, { isLoading: this.mockIsLoading, error: this.mockError });

    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  async refresh() {
    if (this.refreshDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.refreshDelay));
    }
  }

  destroy() {
    this.isDestroyed = true;
    this.subscribers = [];
  }

  simulateDataChange(data: T | null, isLoading = false, error: Error | null = null) {
    this.mockData = data;
    this.mockIsLoading = isLoading;
    this.mockError = error;

    this.subscribers.forEach((callback) => {
      callback(data as T, { isLoading, error });
    });
  }

  simulateDelayedData(data: T, delay: number) {
    setTimeout(() => {
      this.simulateDataChange(data, false);
    }, delay);
  }
}

describe('ReactiveCoordinator Performance', () => {
  let mockQuery: MockReactiveQuery<string>;
  let timer: PerformanceTimer;

  beforeEach(() => {
    vi.useFakeTimers();
    mockQuery = new MockReactiveQuery<string>();
    timer = new PerformanceTimer();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization performance', () => {
    it('should initialize coordinator in under 50ms', () => {
      timer.start();

      const coordinator = new ReactiveCoordinator(mockQuery as any);

      const elapsed = timer.elapsed();
      expect(elapsed).toBeLessThan(50);

      coordinator.destroy();
    });

    it('should handle multiple coordinators simultaneously', () => {
      const coordinatorCount = 10;
      const coordinators: ReactiveCoordinator<string>[] = [];

      timer.start();

      for (let i = 0; i < coordinatorCount; i++) {
        const query = new MockReactiveQuery<string>();
        const coordinator = new ReactiveCoordinator(query as any);
        coordinators.push(coordinator);
      }

      const elapsed = timer.elapsed();
      expect(elapsed).toBeLessThan(50 * coordinatorCount); // Linear scaling acceptable

      coordinators.forEach((coordinator) => coordinator.destroy());
    });

    it('should subscribe to visual state updates efficiently', () => {
      const coordinator = new ReactiveCoordinator(mockQuery as any);
      const subscriberCount = 100;
      const unsubscribers: Array<() => void> = [];

      timer.start();

      for (let i = 0; i < subscriberCount; i++) {
        const unsubscribe = coordinator.subscribe(() => {});
        unsubscribers.push(unsubscribe);
      }

      const elapsed = timer.elapsed();
      expect(elapsed).toBeLessThan(100); // Should handle many subscribers quickly

      unsubscribers.forEach((unsubscribe) => unsubscribe());
      coordinator.destroy();
    });
  });

  describe('flash prevention timing', () => {
    it('should enforce minimum loading time', () => {
      const minimumLoadingTime = 300;
      const coordinator = new ReactiveCoordinator(mockQuery as any, {
        minimumLoadingTime,
      });

      // Simulate data arriving immediately
      mockQuery.simulateDataChange('quick data', false);

      // Should still be in loading state
      expect(coordinator.visualState.shouldShowLoading).toBe(true);
      expect(coordinator.visualState.state).not.toBe('ready');

      // Fast forward to just before minimum time
      vi.advanceTimersByTime(minimumLoadingTime - 10);
      expect(coordinator.visualState.state).not.toBe('ready');

      // Fast forward past minimum time
      vi.advanceTimersByTime(20);
      expect(coordinator.visualState.state).toBe('ready');
      expect(coordinator.visualState.shouldShowLoading).toBe(false);

      coordinator.destroy();
    });

    it('should handle rapid successive data changes efficiently', () => {
      const coordinator = new ReactiveCoordinator(mockQuery as any, {
        minimumLoadingTime: 200,
      });

      const stateChanges: string[] = [];
      coordinator.subscribe((state) => {
        stateChanges.push(state.state);
      });

      // Rapid data changes
      mockQuery.simulateDataChange('data1', false);
      mockQuery.simulateDataChange('data2', false);
      mockQuery.simulateDataChange('data3', false);

      // Should not cause state thrashing
      expect(stateChanges.filter((s) => s === 'ready').length).toBeLessThanOrEqual(1);

      coordinator.destroy();
    });

    it('should optimize for navigation scenarios', () => {
      const navigationConfig: CoordinatorConfig = {
        minimumLoadingTime: 100, // Shorter for navigation
        preserveStaleData: true,
      };

      const coordinator = new ReactiveCoordinator(mockQuery as any, navigationConfig);

      // Set initial data
      mockQuery.simulateDataChange('initial data', false);
      vi.advanceTimersByTime(100);
      expect(coordinator.visualState.state).toBe('ready');

      // Start navigation refresh
      timer.start();
      coordinator.refresh();

      // Should preserve stale data during hydrating
      expect(coordinator.visualState.displayData).toBe('initial data');
      expect(coordinator.visualState.state).toBe('hydrating');

      const transitionTime = timer.elapsed();
      expect(transitionTime).toBeLessThan(10); // Very fast transition

      coordinator.destroy();
    });
  });

  describe('memory and resource management', () => {
    it('should clean up resources efficiently', () => {
      const coordinators: ReactiveCoordinator<string>[] = [];

      // Create many coordinators
      for (let i = 0; i < 50; i++) {
        const query = new MockReactiveQuery<string>();
        const coordinator = new ReactiveCoordinator(query as any);
        coordinators.push(coordinator);
      }

      timer.start();

      // Destroy all coordinators
      coordinators.forEach((coordinator) => coordinator.destroy());

      const elapsed = timer.elapsed();
      expect(elapsed).toBeLessThan(100); // Should destroy quickly
    });

    it('should handle memory pressure without degradation', () => {
      const largeDataSet = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: `item-${i}`.repeat(100), // Large strings
      }));

      const coordinator = new ReactiveCoordinator(mockQuery as any);

      timer.start();

      // Simulate large data changes
      mockQuery.simulateDataChange(largeDataSet as any, false);

      const elapsed = timer.elapsed();
      expect(elapsed).toBeLessThan(100); // Should handle large data efficiently

      coordinator.destroy();
    });

    it('should not leak memory on repeated state changes', () => {
      const coordinator = new ReactiveCoordinator(mockQuery as any);
      const initialMemoryUsage = process.memoryUsage().heapUsed;

      // Simulate many state changes
      for (let i = 0; i < 1000; i++) {
        mockQuery.simulateDataChange(`data-${i}`, false);
        vi.advanceTimersByTime(1);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemoryUsage = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemoryUsage - initialMemoryUsage;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);

      coordinator.destroy();
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent refresh operations', async () => {
      const coordinator = new ReactiveCoordinator(mockQuery as any, {
        minimumLoadingTime: 100,
      });

      // Set initial data
      mockQuery.simulateDataChange('initial', false);
      vi.advanceTimersByTime(100);

      timer.start();

      // Start multiple concurrent refreshes
      const refreshPromises = [coordinator.refresh(), coordinator.refresh(), coordinator.refresh()];

      // Simulate new data
      mockQuery.simulateDataChange('refreshed', false);
      vi.advanceTimersByTime(100);

      await Promise.all(refreshPromises);

      const elapsed = timer.elapsed();
      expect(elapsed).toBeLessThan(200); // Should handle concurrency efficiently
      expect(coordinator.visualState.displayData).toBe('refreshed');

      coordinator.destroy();
    });

    it('should maintain performance under high subscription load', () => {
      const coordinator = new ReactiveCoordinator(mockQuery as any);
      const subscriptionCount = 500;
      const unsubscribers: Array<() => void> = [];

      // Add many subscribers
      for (let i = 0; i < subscriptionCount; i++) {
        const unsubscribe = coordinator.subscribe(() => {});
        unsubscribers.push(unsubscribe);
      }

      timer.start();

      // Trigger state change that notifies all subscribers
      mockQuery.simulateDataChange('broadcast data', false);

      const elapsed = timer.elapsed();
      expect(elapsed).toBeLessThan(100); // Should notify all subscribers quickly

      unsubscribers.forEach((unsubscribe) => unsubscribe());
      coordinator.destroy();
    });
  });
});

describe('Factory Performance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create enhanced records efficiently', () => {
    const timer = new PerformanceTimer();
    const recordCount = 100;

    timer.start();

    for (let i = 0; i < recordCount; i++) {
      const record = ReactiveRecordFactory.create({
        tableName: `table_${i}`,
        className: `Model${i}`,
      });

      // Simulate some usage
      record.find('test-id');
      record.where({ active: true }).all();
    }

    const elapsed = timer.elapsed();
    expect(elapsed).toBeLessThan(recordCount * 2); // <2ms per record
  });

  it('should optimize query creation patterns', () => {
    const timer = new PerformanceTimer();
    const mockQuery = new MockReactiveQuery();

    timer.start();

    // Test different factory methods
    const standard = ReactiveQueryFactory.create(mockQuery as any);
    const navigation = ReactiveQueryFactory.createForNavigation(mockQuery as any);
    const initialLoad = ReactiveQueryFactory.createForInitialLoad(mockQuery as any);

    const elapsed = timer.elapsed();
    expect(elapsed).toBeLessThan(50); // All factory methods should be fast

    // Clean up
    standard.destroy();
    navigation.destroy();
    initialLoad.destroy();
  });
});

describe('Integration Performance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should maintain performance with coordinator integration', () => {
    const timer = new PerformanceTimer();
    const mockQuery = new MockReactiveQuery();

    timer.start();

    const enhancedQuery = withCoordinator(mockQuery as any, {
      minimumLoadingTime: 200,
      preserveStaleData: true,
      debug: false,
    });

    // Simulate usage
    enhancedQuery.getVisualState!();
    enhancedQuery.subscribeToVisualState!(() => {});

    const elapsed = timer.elapsed();
    expect(elapsed).toBeLessThan(25); // Integration should be very fast

    enhancedQuery.destroy();
  });

  it('should scale with multiple enhanced queries', () => {
    const timer = new PerformanceTimer();
    const queryCount = 50;
    const enhancedQueries: any[] = [];

    timer.start();

    for (let i = 0; i < queryCount; i++) {
      const mockQuery = new MockReactiveQuery();
      const enhanced = withCoordinator(mockQuery as any);
      enhancedQueries.push(enhanced);
    }

    const elapsed = timer.elapsed();
    expect(elapsed).toBeLessThan(queryCount * 5); // <5ms per query

    // Clean up
    enhancedQueries.forEach((query) => query.destroy());
  });
});

describe('Real-world Performance Scenarios', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle ActivityLogList-style usage efficiently', () => {
    // Simulate the /logs/ view scenario
    const timer = new PerformanceTimer();
    const activityLogQuery = new MockReactiveQuery([], true); // Collection query

    timer.start();

    const coordinator = new ReactiveCoordinator(activityLogQuery as any, {
      minimumLoadingTime: 300,
      preserveStaleData: true,
      debug: false,
    });

    // Simulate navigation to /logs/ page
    const initialState = coordinator.visualState;
    expect(initialState.shouldShowLoading).toBe(true);

    // Simulate data loading after 50ms (typical API response)
    activityLogQuery.simulateDelayedData(
      [
        { id: 1, message: 'Log entry 1' },
        { id: 2, message: 'Log entry 2' },
      ] as any,
      50
    );

    vi.advanceTimersByTime(50); // Data arrives
    vi.advanceTimersByTime(250); // Wait for minimum loading time

    const finalState = coordinator.visualState;
    expect(finalState.state).toBe('ready');
    expect(finalState.shouldShowLoading).toBe(false);

    const elapsed = timer.elapsed();
    expect(elapsed).toBeLessThan(100); // Coordinator operations should be fast

    coordinator.destroy();
  });

  it('should optimize for frequent navigation between views', () => {
    const timer = new PerformanceTimer();

    // Simulate multiple page views with different queries
    const views = [
      { name: 'jobs', query: new MockReactiveQuery([]) },
      { name: 'clients', query: new MockReactiveQuery([]) },
      { name: 'logs', query: new MockReactiveQuery([]) },
    ];

    const coordinators = views.map((view) =>
      ReactiveRecordFactory.createForNavigation({
        tableName: view.name,
        className: view.name.charAt(0).toUpperCase() + view.name.slice(1),
      })
    );

    timer.start();

    // Simulate rapid navigation
    coordinators.forEach((record, index) => {
      const query = record.all();
      views[index].query.simulateDataChange([{ id: index }] as any, false);
    });

    const elapsed = timer.elapsed();
    expect(elapsed).toBeLessThan(150); // Navigation should be very fast
  });
});
