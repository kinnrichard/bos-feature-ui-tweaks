/**
 * Comprehensive Lifecycle State Tests for ReactiveRecord v2
 *
 * Tests all 5 coordinator states (initializing, loading, hydrating, ready, error)
 * and validates proper transitions, edge cases, and complex scenarios that
 * could occur in production usage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ReactiveCoordinator,
  type CoordinatorState,
  type VisualState,
} from '../../src/lib/reactive/coordinator';
import {
  MockReactiveQuery,
  MockCoordinator,
  TestDataFactory,
  CoordinatorTestValidator,
  ReactiveAssertions,
  ComponentTestHelpers,
  createMockQuery,
  createMockCoordinator,
} from './test-utilities';

describe('ReactiveCoordinator Lifecycle States', () => {
  let mockQuery: MockReactiveQuery<any>;
  let coordinator: ReactiveCoordinator<any>;
  let stateCapture: ReturnType<typeof ComponentTestHelpers.createStateCapture>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockQuery = createMockQuery();
    coordinator = new ReactiveCoordinator(mockQuery as any);
    stateCapture = ComponentTestHelpers.createStateCapture();
  });

  afterEach(() => {
    coordinator.destroy();
    vi.useRealTimers();
  });

  describe('State: initializing', () => {
    it('should start in initializing state', () => {
      const visualState = coordinator.visualState;

      ReactiveAssertions.expectInitializing(visualState);
      expect(visualState.state).toBe('initializing');
      expect(visualState.displayData).toBe(null);
      expect(visualState.shouldShowLoading).toBe(true);
      expect(visualState.shouldShowEmpty).toBe(false);
      expect(visualState.shouldShowError).toBe(false);
      expect(visualState.isInitialLoad).toBe(true);
      expect(visualState.isFresh).toBe(false);
    });

    it('should handle initial load timeout', () => {
      const coordinator = new ReactiveCoordinator(mockQuery as any, {
        initialLoadTimeout: 1000,
      });

      coordinator.subscribe(stateCapture.capture);

      // Fast forward past timeout
      vi.advanceTimersByTime(1000);

      const finalState = stateCapture.getLatestState();
      expect(finalState.state).toBe('error');
      expect(finalState.error?.message).toContain('timeout');

      coordinator.destroy();
    });

    it('should transition from initializing to ready on data arrival', () => {
      coordinator.subscribe(stateCapture.capture);

      // Simulate data arriving
      mockQuery.simulateDataChange('initial data', false);

      const states = stateCapture.getStates();
      expect(states).toHaveLength(2); // initializing + ready
      expect(states[0].state).toBe('initializing');
      expect(states[1].state).toBe('ready');
      expect(states[1].displayData).toBe('initial data');
    });

    it('should transition from initializing to error on query error', () => {
      coordinator.subscribe(stateCapture.capture);

      const testError = new Error('Initial load failed');
      mockQuery.simulateError(testError);

      const finalState = stateCapture.getLatestState();
      ReactiveAssertions.expectError(finalState, testError);
    });
  });

  describe('State: loading', () => {
    it('should transition to loading on refresh from ready state', async () => {
      // First get to ready state
      mockQuery.simulateDataChange('initial data', false);

      coordinator.subscribe(stateCapture.capture);
      stateCapture.clear(); // Clear initial states

      // Start refresh
      coordinator.refresh();

      const loadingState = stateCapture.getLatestState();
      ReactiveAssertions.expectLoading(loadingState);
      expect(loadingState.state).toBe('loading');
      expect(loadingState.shouldShowLoading).toBe(true);
    });

    it('should enforce minimum loading time in loading state', () => {
      const coordinator = new ReactiveCoordinator(mockQuery as any, {
        minimumLoadingTime: 500,
      });

      coordinator.subscribe(stateCapture.capture);

      // Simulate quick data arrival
      mockQuery.simulateDataChange('quick data', false);

      // Should still be in loading state
      expect(coordinator.visualState.shouldShowLoading).toBe(true);

      // Fast forward past minimum time
      vi.advanceTimersByTime(500);
      expect(coordinator.visualState.state).toBe('ready');

      const states = stateCapture.getStates();
      ReactiveAssertions.expectNoFlash(states, 500);

      coordinator.destroy();
    });

    it('should handle error during loading state', () => {
      coordinator.subscribe(stateCapture.capture);

      const testError = new Error('Loading failed');
      mockQuery.simulateError(testError);

      const errorState = stateCapture.getLatestState();
      ReactiveAssertions.expectError(errorState, testError);
    });

    it('should transition from loading to hydrating when refreshing with existing data', async () => {
      // Set up initial data
      mockQuery.simulateDataChange('existing data', false);
      expect(coordinator.visualState.state).toBe('ready');

      coordinator.subscribe(stateCapture.capture);
      stateCapture.clear();

      // Refresh should go to hydrating, not loading
      coordinator.refresh();

      const hydratingState = stateCapture.getLatestState();
      expect(hydratingState.state).toBe('hydrating');
      expect(hydratingState.displayData).toBe('existing data');
    });
  });

  describe('State: hydrating', () => {
    beforeEach(() => {
      // Set up coordinator with existing data
      mockQuery.simulateDataChange('existing data', false);
      expect(coordinator.visualState.state).toBe('ready');
    });

    it('should preserve stale data during hydrating state', async () => {
      coordinator.subscribe(stateCapture.capture);
      stateCapture.clear();

      // Start refresh to enter hydrating state
      coordinator.refresh();

      const hydratingState = stateCapture.getLatestState();
      expect(hydratingState.state).toBe('hydrating');
      expect(hydratingState.displayData).toBe('existing data'); // Preserved
      expect(hydratingState.shouldShowLoading).toBe(false); // No loading with stale data
    });

    it('should show loading indicator during hydrating when no stale data', async () => {
      // Clear existing data first
      coordinator = new ReactiveCoordinator(mockQuery as any);

      coordinator.subscribe(stateCapture.capture);

      // Refresh without existing data
      coordinator.refresh();

      const hydratingState = stateCapture.getLatestState();
      expect(hydratingState.state).toBe('loading'); // Should be loading, not hydrating
      expect(hydratingState.shouldShowLoading).toBe(true);
    });

    it('should transition from hydrating to ready with new data', async () => {
      coordinator.subscribe(stateCapture.capture);
      stateCapture.clear();

      // Start hydrating
      coordinator.refresh();
      expect(stateCapture.getLatestState().state).toBe('hydrating');

      // Provide new data
      mockQuery.simulateDataChange('refreshed data', false);

      const readyState = stateCapture.getLatestState();
      ReactiveAssertions.expectReady(readyState, 'refreshed data');
    });

    it('should handle error during hydrating state', async () => {
      coordinator.subscribe(stateCapture.capture);
      stateCapture.clear();

      // Start hydrating
      coordinator.refresh();

      // Simulate error during refresh
      const testError = new Error('Refresh failed');
      mockQuery.simulateError(testError);

      const errorState = stateCapture.getLatestState();
      ReactiveAssertions.expectError(errorState, testError);
    });

    it('should respect minimum loading time during hydrating', () => {
      const coordinator = new ReactiveCoordinator(mockQuery as any, {
        minimumLoadingTime: 300,
      });

      // Set initial data
      mockQuery.simulateDataChange('initial', false);

      coordinator.subscribe(stateCapture.capture);
      stateCapture.clear();

      // Start hydrating
      coordinator.refresh();

      // Immediately provide new data
      mockQuery.simulateDataChange('new data', false);

      // Should not immediately transition to ready
      expect(coordinator.visualState.state).toBe('hydrating');

      // Fast forward past minimum time
      vi.advanceTimersByTime(300);
      expect(coordinator.visualState.state).toBe('ready');

      coordinator.destroy();
    });
  });

  describe('State: ready', () => {
    it('should indicate fresh data in ready state', () => {
      mockQuery.simulateDataChange('fresh data', false);

      const readyState = coordinator.visualState;
      ReactiveAssertions.expectReady(readyState, 'fresh data');
      expect(readyState.isFresh).toBe(true);
      expect(readyState.isInitialLoad).toBe(false);
    });

    it('should handle empty data in ready state', () => {
      mockQuery.simulateDataChange(null, false);

      const readyState = coordinator.visualState;
      expect(readyState.state).toBe('ready');
      expect(readyState.shouldShowEmpty).toBe(true);
      expect(readyState.displayData).toBe(null);
    });

    it('should handle empty collection in ready state', () => {
      const emptyCollectionQuery = createMockQuery([], true);
      const coordinator = new ReactiveCoordinator(emptyCollectionQuery as any);

      emptyCollectionQuery.simulateDataChange([], false);

      const readyState = coordinator.visualState;
      expect(readyState.state).toBe('ready');
      expect(readyState.shouldShowEmpty).toBe(true);
      expect(readyState.displayData).toEqual([]);

      coordinator.destroy();
    });

    it('should transition from ready to hydrating on refresh', async () => {
      mockQuery.simulateDataChange('data', false);

      coordinator.subscribe(stateCapture.capture);
      stateCapture.clear();

      coordinator.refresh();

      const hydratingState = stateCapture.getLatestState();
      expect(hydratingState.state).toBe('hydrating');
      expect(hydratingState.displayData).toBe('data');
    });

    it('should transition from ready to error on query error', () => {
      mockQuery.simulateDataChange('data', false);

      coordinator.subscribe(stateCapture.capture);
      stateCapture.clear();

      const testError = new Error('Query error');
      mockQuery.simulateError(testError);

      const errorState = stateCapture.getLatestState();
      ReactiveAssertions.expectError(errorState, testError);
    });
  });

  describe('State: error', () => {
    let testError: Error;

    beforeEach(() => {
      testError = new Error('Test error condition');
    });

    it('should preserve stale data in error state with preserveStaleData=true', () => {
      const coordinator = new ReactiveCoordinator(mockQuery as any, {
        preserveStaleData: true,
      });

      // Set initial data
      mockQuery.simulateDataChange('stale data', false);

      coordinator.subscribe(stateCapture.capture);
      stateCapture.clear();

      // Trigger error
      mockQuery.simulateError(testError);

      const errorState = stateCapture.getLatestState();
      expect(errorState.state).toBe('error');
      expect(errorState.displayData).toBe('stale data'); // Preserved
      expect(errorState.shouldShowError).toBe(false); // Don't show error with stale data

      coordinator.destroy();
    });

    it('should not preserve stale data in error state with preserveStaleData=false', () => {
      const coordinator = new ReactiveCoordinator(mockQuery as any, {
        preserveStaleData: false,
      });

      // Set initial data
      mockQuery.simulateDataChange('stale data', false);

      coordinator.subscribe(stateCapture.capture);
      stateCapture.clear();

      // Trigger error
      mockQuery.simulateError(testError);

      const errorState = stateCapture.getLatestState();
      expect(errorState.state).toBe('error');
      expect(errorState.displayData).toBe(null); // Not preserved
      expect(errorState.shouldShowError).toBe(true); // Show error without stale data

      coordinator.destroy();
    });

    it('should transition from error to loading on refresh', async () => {
      mockQuery.simulateError(testError);

      coordinator.subscribe(stateCapture.capture);
      stateCapture.clear();

      coordinator.refresh();

      const loadingState = stateCapture.getLatestState();
      ReactiveAssertions.expectLoading(loadingState);
    });

    it('should transition from error to ready on successful data', () => {
      mockQuery.simulateError(testError);

      coordinator.subscribe(stateCapture.capture);
      stateCapture.clear();

      // Simulate recovery
      mockQuery.simulateDataChange('recovered data', false);

      const readyState = stateCapture.getLatestState();
      ReactiveAssertions.expectReady(readyState, 'recovered data');
    });
  });

  describe('Complex State Transitions', () => {
    it('should handle rapid state changes without corruption', () => {
      coordinator.subscribe(stateCapture.capture);

      // Rapid sequence of state changes
      mockQuery.simulateDataChange('data1', false);
      mockQuery.simulateError(new Error('error1'));
      mockQuery.simulateDataChange('data2', false);
      mockQuery.simulateError(new Error('error2'));
      mockQuery.simulateDataChange('data3', false);

      const states = stateCapture.getStates();
      const finalState = stateCapture.getLatestState();

      // Should end in ready state with final data
      expect(finalState.state).toBe('ready');
      expect(finalState.displayData).toBe('data3');

      // Validate no invalid transitions occurred
      const validation = CoordinatorTestValidator.validateFlashPrevention(states);
      expect(validation.properProgression).toBe(true);
    });

    it('should handle concurrent refresh operations gracefully', async () => {
      mockQuery.simulateDataChange('initial', false);

      coordinator.subscribe(stateCapture.capture);
      stateCapture.clear();

      // Start multiple concurrent refreshes
      const refreshPromises = [coordinator.refresh(), coordinator.refresh(), coordinator.refresh()];

      // All should complete without error
      await expect(Promise.all(refreshPromises)).resolves.not.toThrow();

      const finalState = stateCapture.getLatestState();
      expect(['hydrating', 'ready']).toContain(finalState.state);
    });

    it('should maintain data consistency during long refresh cycles', async () => {
      const testData = TestDataFactory.createActivityLogCollection(5);
      mockQuery.simulateDataChange(testData, false);

      coordinator.subscribe(stateCapture.capture);
      stateCapture.clear();

      // Start refresh
      coordinator.refresh();
      expect(stateCapture.getLatestState().state).toBe('hydrating');

      // Data should remain consistent throughout refresh
      const duringRefresh = coordinator.visualState;
      expect(duringRefresh.displayData).toEqual(testData);

      // Complete refresh with new data
      const newData = TestDataFactory.createActivityLogCollection(3);
      mockQuery.simulateDataChange(newData, false);

      const afterRefresh = coordinator.visualState;
      expect(afterRefresh.displayData).toEqual(newData);
    });

    it('should handle destroyed coordinator gracefully', () => {
      mockQuery.simulateDataChange('data', false);

      coordinator.subscribe(stateCapture.capture);

      // Destroy coordinator
      coordinator.destroy();

      // Further operations should not throw
      expect(() => {
        mockQuery.simulateDataChange('new data', false);
        mockQuery.simulateError(new Error('post-destroy error'));
      }).not.toThrow();

      // Should not receive further notifications
      const stateCount = stateCapture.getStates().length;
      mockQuery.simulateDataChange('ignored data', false);
      expect(stateCapture.getStates()).toHaveLength(stateCount);
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle null/undefined data transitions', () => {
      coordinator.subscribe(stateCapture.capture);

      // Test various null/undefined scenarios
      mockQuery.simulateDataChange(null, false);
      expect(coordinator.visualState.shouldShowEmpty).toBe(true);

      mockQuery.simulateDataChange(undefined as any, false);
      expect(coordinator.visualState.shouldShowEmpty).toBe(true);

      mockQuery.simulateDataChange('', false);
      expect(coordinator.visualState.shouldShowEmpty).toBe(false); // Empty string is not null
    });

    it('should handle very large datasets efficiently', () => {
      const largeDataset = TestDataFactory.createLargeCollection(1000);

      const { duration } = ComponentTestHelpers.measurePerformance(() => {
        mockQuery.simulateDataChange(largeDataset, false);
      });

      expect(duration).toBeLessThan(100); // Should handle large data quickly
      expect(coordinator.visualState.displayData).toHaveLength(1000);
    });

    it('should handle subscriber errors without affecting other subscribers', () => {
      const goodSubscriber = vi.fn();
      const badSubscriber = vi.fn(() => {
        throw new Error('Subscriber error');
      });

      coordinator.subscribe(goodSubscriber);
      coordinator.subscribe(badSubscriber);

      // Should not throw despite bad subscriber
      expect(() => {
        mockQuery.simulateDataChange('test data', false);
      }).not.toThrow();

      // Good subscriber should still be called
      expect(goodSubscriber).toHaveBeenCalled();
      expect(badSubscriber).toHaveBeenCalled();
    });

    it('should handle extremely rapid state changes', () => {
      coordinator.subscribe(stateCapture.capture);

      // Simulate very rapid changes (like during development hot reload)
      for (let i = 0; i < 100; i++) {
        mockQuery.simulateDataChange(`data-${i}`, i % 2 === 0);
      }

      const finalState = stateCapture.getLatestState();
      expect(finalState.displayData).toBe('data-99');

      // Should not have memory leaks or corruption
      expect(coordinator.visualState).toBeDefined();
    });
  });

  describe('State Validation and Consistency', () => {
    it('should maintain state consistency across all transitions', () => {
      coordinator.subscribe(stateCapture.capture);

      // Execute comprehensive state transition sequence
      mockQuery.simulateDataChange('initial', false); // -> ready
      coordinator.refresh(); // -> hydrating
      mockQuery.simulateDataChange('refreshed', false); // -> ready
      mockQuery.simulateError(new Error('error')); // -> error
      coordinator.refresh(); // -> loading
      mockQuery.simulateDataChange('recovered', false); // -> ready

      const states = stateCapture.getStates();

      // Validate each state is internally consistent
      states.forEach((state, index) => {
        expect(state).toBeDefined();
        expect(['initializing', 'loading', 'hydrating', 'ready', 'error']).toContain(state.state);

        // State-specific validations
        if (state.shouldShowLoading) {
          expect(['initializing', 'loading', 'hydrating']).toContain(state.state);
        }

        if (state.shouldShowError) {
          expect(state.state).toBe('error');
          expect(state.error).not.toBe(null);
        }

        if (state.shouldShowEmpty) {
          expect(state.state).toBe('ready');
          expect(
            state.displayData === null ||
              (Array.isArray(state.displayData) && state.displayData.length === 0)
          ).toBe(true);
        }
      });
    });

    it('should provide accurate state metadata', () => {
      coordinator.subscribe(stateCapture.capture);

      // Test initial load detection
      expect(coordinator.visualState.isInitialLoad).toBe(true);

      mockQuery.simulateDataChange('first data', false);
      expect(coordinator.visualState.isInitialLoad).toBe(false);

      // Test freshness detection
      expect(coordinator.visualState.isFresh).toBe(true);

      coordinator.refresh();
      expect(coordinator.visualState.isFresh).toBe(true); // Still fresh during hydrating

      // Test error state
      mockQuery.simulateError(new Error('test'));
      expect(coordinator.visualState.isFresh).toBe(false);
    });
  });
});
