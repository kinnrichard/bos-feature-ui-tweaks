/**
 * Test Utilities for ReactiveRecord v2 Component Integration
 *
 * Provides reusable utilities for testing ReactiveRecord v2 components,
 * coordinator behavior, and integration scenarios. Includes mock factories,
 * state simulation helpers, and validation utilities.
 */

import { vi, type MockedFunction } from 'vitest';
import type {
  CoordinatorState,
  VisualState,
  CoordinatorConfig,
} from '../../src/lib/reactive/coordinator';
import type { EnhancedReactiveQuery } from '../../src/lib/reactive/integration';

/**
 * Mock ReactiveQuery implementation for testing
 */
export class MockReactiveQuery<T> {
  public subscribers: Array<(data: T, meta: { isLoading: boolean; error: Error | null }) => void> =
    [];
  public mockData: T | null = null;
  public mockIsLoading = false;
  public mockError: Error | null = null;
  public isDestroyed = false;
  public refreshCallCount = 0;
  public refreshDelay = 0;

  constructor(
    initialData: T | null = null,
    public isCollection = false
  ) {
    this.mockData = initialData;
  }

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
    if (this.mockError) return 'error';
    if (this.mockIsLoading) return 'loading';
    return 'complete';
  }
  get present() {
    if (this.mockData === null || this.mockData === undefined) return false;
    if (Array.isArray(this.mockData)) return this.mockData.length > 0;
    return true;
  }
  get blank() {
    return !this.present;
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
    this.refreshCallCount++;
    if (this.refreshDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.refreshDelay));
    }
  }

  destroy() {
    this.isDestroyed = true;
    this.subscribers = [];
  }

  // Test utilities
  simulateDataChange(data: T | null, isLoading = false, error: Error | null = null) {
    this.mockData = data;
    this.mockIsLoading = isLoading;
    this.mockError = error;

    this.subscribers.forEach((callback) => {
      callback(data as T, { isLoading, error });
    });
  }

  simulateLoading(isLoading = true) {
    this.mockIsLoading = isLoading;
    this.subscribers.forEach((callback) => {
      callback(this.mockData as T, { isLoading, error: this.mockError });
    });
  }

  simulateError(error: Error) {
    this.mockError = error;
    this.subscribers.forEach((callback) => {
      callback(this.mockData as T, { isLoading: this.mockIsLoading, error });
    });
  }

  simulateSuccess(data: T) {
    this.simulateDataChange(data, false, null);
  }
}

/**
 * Mock Coordinator for testing
 */
export class MockCoordinator<T> {
  public visualState: VisualState<T>;
  public subscribers: Array<(state: VisualState<T>) => void> = [];
  public refreshCallCount = 0;
  public destroyCallCount = 0;

  constructor(initialState?: Partial<VisualState<T>>) {
    this.visualState = {
      displayData: null,
      shouldShowLoading: false,
      shouldShowEmpty: false,
      shouldShowError: false,
      state: 'initializing',
      error: null,
      isFresh: false,
      isInitialLoad: true,
      ...initialState,
    } as VisualState<T>;
  }

  subscribe(callback: (state: VisualState<T>) => void) {
    this.subscribers.push(callback);
    callback(this.visualState);

    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  async refresh() {
    this.refreshCallCount++;
  }

  destroy() {
    this.destroyCallCount++;
    this.subscribers = [];
  }

  // Test utilities
  updateVisualState(updates: Partial<VisualState<T>>) {
    this.visualState = { ...this.visualState, ...updates };
    this.subscribers.forEach((callback) => callback(this.visualState));
  }

  transitionTo(state: CoordinatorState, data?: T | null) {
    const updates: Partial<VisualState<T>> = { state };

    if (data !== undefined) {
      updates.displayData = data;
    }

    // Set appropriate flags based on state
    switch (state) {
      case 'initializing':
        updates.shouldShowLoading = true;
        updates.shouldShowEmpty = false;
        updates.shouldShowError = false;
        updates.isInitialLoad = true;
        break;
      case 'loading':
        updates.shouldShowLoading = true;
        updates.shouldShowEmpty = false;
        updates.shouldShowError = false;
        break;
      case 'hydrating':
        updates.shouldShowLoading = data === null;
        updates.shouldShowEmpty = false;
        updates.shouldShowError = false;
        break;
      case 'ready':
        updates.shouldShowLoading = false;
        updates.shouldShowEmpty = data === null || (Array.isArray(data) && data.length === 0);
        updates.shouldShowError = false;
        updates.isFresh = true;
        updates.isInitialLoad = false;
        break;
      case 'error':
        updates.shouldShowLoading = false;
        updates.shouldShowEmpty = false;
        updates.shouldShowError = true;
        break;
    }

    this.updateVisualState(updates);
  }

  simulateFlashPrevention(finalData: T, minimumTime = 300) {
    this.transitionTo('loading');

    setTimeout(() => {
      this.transitionTo('ready', finalData);
    }, minimumTime);
  }
}

/**
 * Factory for creating test data
 */
export class TestDataFactory {
  static createActivityLogEntry(overrides = {}) {
    return {
      id: Math.floor(Math.random() * 1000),
      action: 'created',
      entity_type: 'Job',
      entity_id: 123,
      user_id: 456,
      created_at: new Date().toISOString(),
      changes: { status: 'pending' },
      ...overrides,
    };
  }

  static createActivityLogCollection(count = 3, overrides = {}) {
    return Array.from({ length: count }, (_, i) =>
      this.createActivityLogEntry({ id: i + 1, ...overrides })
    );
  }

  static createJobData(overrides = {}) {
    return {
      id: Math.floor(Math.random() * 1000),
      title: 'Test Job',
      status: 'pending',
      created_at: new Date().toISOString(),
      client_id: 123,
      ...overrides,
    };
  }

  static createClientData(overrides = {}) {
    return {
      id: Math.floor(Math.random() * 1000),
      name: 'Test Client',
      email: 'test@example.com',
      status: 'active',
      created_at: new Date().toISOString(),
      ...overrides,
    };
  }

  static createEmptyCollection() {
    return [];
  }

  static createLargeCollection(size = 100, itemFactory = this.createActivityLogEntry) {
    return Array.from({ length: size }, (_, i) => itemFactory({ id: i + 1 }));
  }
}

/**
 * Validation utilities for testing coordinator behavior
 */
export class CoordinatorTestValidator {
  static validateInitialState(visualState: VisualState<any>) {
    return {
      isInitializing: visualState.state === 'initializing',
      showsLoading: visualState.shouldShowLoading,
      isInitialLoad: visualState.isInitialLoad,
      hasNoData: visualState.displayData === null,
    };
  }

  static validateReadyState(visualState: VisualState<any>, expectedData?: any) {
    const validation = {
      isReady: visualState.state === 'ready',
      noLoading: !visualState.shouldShowLoading,
      noError: !visualState.shouldShowError,
      isFresh: visualState.isFresh,
      notInitialLoad: !visualState.isInitialLoad,
    };

    if (expectedData !== undefined) {
      (validation as any).hasCorrectData =
        JSON.stringify(visualState.displayData) === JSON.stringify(expectedData);
    }

    return validation;
  }

  static validateLoadingState(visualState: VisualState<any>) {
    return {
      isLoading: visualState.state === 'loading' || visualState.state === 'initializing',
      showsLoading: visualState.shouldShowLoading,
      noError: !visualState.shouldShowError,
      noEmpty: !visualState.shouldShowEmpty,
    };
  }

  static validateHydratingState(visualState: VisualState<any>) {
    return {
      isHydrating: visualState.state === 'hydrating',
      preservesData: visualState.displayData !== null,
      noError: !visualState.shouldShowError,
    };
  }

  static validateErrorState(visualState: VisualState<any>, expectedError?: Error) {
    const validation = {
      isError: visualState.state === 'error',
      showsError: visualState.shouldShowError,
      noLoading: !visualState.shouldShowLoading,
      hasError: visualState.error !== null,
    };

    if (expectedError) {
      (validation as any).correctError = visualState.error?.message === expectedError.message;
    }

    return validation;
  }

  static validateEmptyState(visualState: VisualState<any>) {
    return {
      isReady: visualState.state === 'ready',
      showsEmpty: visualState.shouldShowEmpty,
      noLoading: !visualState.shouldShowLoading,
      noError: !visualState.shouldShowError,
      hasNoData:
        visualState.displayData === null ||
        (Array.isArray(visualState.displayData) && visualState.displayData.length === 0),
    };
  }

  static validateFlashPrevention(states: VisualState<any>[], minimumLoadingTime = 300) {
    const loadingDuration = this.calculateLoadingDuration(states);

    return {
      respectsMinimumTime: loadingDuration >= minimumLoadingTime,
      noFlash: !this.detectFlash(states),
      properProgression: this.validateStateProgression(states),
    };
  }

  private static calculateLoadingDuration(states: VisualState<any>[]): number {
    const firstLoading = states.findIndex((s) => s.shouldShowLoading);
    const lastLoading = states.reverse().findIndex((s) => s.shouldShowLoading);

    if (firstLoading === -1 || lastLoading === -1) return 0;

    return states.length - 1 - lastLoading - firstLoading;
  }

  private static detectFlash(states: VisualState<any>[]): boolean {
    // Flash detection: rapid transitions between loading and non-loading
    let flashCount = 0;
    let previousLoading = states[0]?.shouldShowLoading || false;

    for (let i = 1; i < states.length; i++) {
      const currentLoading = states[i].shouldShowLoading;
      if (previousLoading !== currentLoading) {
        flashCount++;
      }
      previousLoading = currentLoading;
    }

    return flashCount > 2; // More than one transition cycle indicates flash
  }

  private static validateStateProgression(states: VisualState<any>[]): boolean {
    // Valid progressions: initializing -> loading -> ready, initializing -> ready, etc.
    const stateSequence = states.map((s) => s.state);
    const invalidTransitions = this.findInvalidTransitions(stateSequence);

    return invalidTransitions.length === 0;
  }

  private static findInvalidTransitions(states: CoordinatorState[]): string[] {
    const invalid: string[] = [];
    const validTransitions: Record<CoordinatorState, CoordinatorState[]> = {
      initializing: ['loading', 'ready', 'error'],
      loading: ['ready', 'error', 'hydrating'],
      hydrating: ['ready', 'error'],
      ready: ['loading', 'hydrating', 'error'],
      error: ['loading', 'ready'],
    };

    for (let i = 1; i < states.length; i++) {
      const from = states[i - 1];
      const to = states[i];

      if (!validTransitions[from]?.includes(to)) {
        invalid.push(`${from} -> ${to}`);
      }
    }

    return invalid;
  }
}

/**
 * Integration test helpers for component testing
 */
export class ComponentTestHelpers {
  static createMockReactiveRecord<T>(tableName: string, className: string) {
    const mockQuery = new MockReactiveQuery<T>();

    return {
      config: { tableName, className },
      find: vi.fn(() => mockQuery),
      findBy: vi.fn(() => mockQuery),
      all: vi.fn(() => ({
        all: vi.fn(() => mockQuery),
        first: vi.fn(() => mockQuery),
        where: vi.fn(() => ({
          all: vi.fn(() => mockQuery),
        })),
      })),
      where: vi.fn(() => ({
        all: vi.fn(() => mockQuery),
        first: vi.fn(() => mockQuery),
      })),
      kept: vi.fn(() => ({
        all: vi.fn(() => mockQuery),
        where: vi.fn(() => ({
          all: vi.fn(() => mockQuery),
        })),
      })),
      _mockQuery: mockQuery, // For test access
    };
  }

  static simulateNetworkDelay(ms = 100) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static createStateCapture<T>() {
    const states: VisualState<T>[] = [];

    const capture = (state: VisualState<T>) => {
      states.push({ ...state });
    };

    return {
      capture,
      getStates: () => [...states],
      getLatestState: () => states[states.length - 1],
      clear: () => {
        states.length = 0;
      },
    };
  }

  static waitForState<T>(
    coordinator: { visualState: VisualState<T> },
    predicate: (state: VisualState<T>) => boolean,
    timeout = 1000
  ): Promise<VisualState<T>> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const check = () => {
        if (predicate(coordinator.visualState)) {
          resolve(coordinator.visualState);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for state condition`));
        } else {
          setTimeout(check, 10);
        }
      };

      check();
    });
  }

  static measurePerformance<T>(operation: () => T): { result: T; duration: number } {
    const start = performance.now();
    const result = operation();
    const duration = performance.now() - start;

    return { result, duration };
  }
}

/**
 * Assertion helpers for cleaner test code
 */
export class ReactiveAssertions {
  static expectInitializing<T>(visualState: VisualState<T>) {
    const validation = CoordinatorTestValidator.validateInitialState(visualState);

    if (!validation.isInitializing) {
      throw new Error(`Expected state 'initializing', got '${visualState.state}'`);
    }
    if (!validation.showsLoading) {
      throw new Error('Expected loading indicator to be shown in initializing state');
    }
    if (!validation.isInitialLoad) {
      throw new Error('Expected isInitialLoad to be true in initializing state');
    }
  }

  static expectReady<T>(visualState: VisualState<T>, expectedData?: T) {
    const validation = CoordinatorTestValidator.validateReadyState(visualState, expectedData);

    if (!validation.isReady) {
      throw new Error(`Expected state 'ready', got '${visualState.state}'`);
    }
    if (validation.noLoading === false) {
      throw new Error('Expected no loading indicator in ready state');
    }
    if (expectedData && !(validation as any).hasCorrectData) {
      throw new Error('Data does not match expected value');
    }
  }

  static expectLoading<T>(visualState: VisualState<T>) {
    const validation = CoordinatorTestValidator.validateLoadingState(visualState);

    if (!validation.isLoading) {
      throw new Error(`Expected loading state, got '${visualState.state}'`);
    }
    if (!validation.showsLoading) {
      throw new Error('Expected loading indicator to be shown');
    }
  }

  static expectError<T>(visualState: VisualState<T>, expectedError?: Error) {
    const validation = CoordinatorTestValidator.validateErrorState(visualState, expectedError);

    if (!validation.isError) {
      throw new Error(`Expected state 'error', got '${visualState.state}'`);
    }
    if (!validation.hasError) {
      throw new Error('Expected error to be present');
    }
    if (expectedError && !(validation as any).correctError) {
      throw new Error(
        `Expected error '${expectedError.message}', got '${visualState.error?.message}'`
      );
    }
  }

  static expectNoFlash<T>(states: VisualState<T>[], minimumLoadingTime = 300) {
    const validation = CoordinatorTestValidator.validateFlashPrevention(states, minimumLoadingTime);

    if (!validation.respectsMinimumTime) {
      throw new Error(`Loading time did not respect minimum of ${minimumLoadingTime}ms`);
    }
    if (validation.noFlash === false) {
      throw new Error('Flash detected in state transitions');
    }
    if (!validation.properProgression) {
      throw new Error('Invalid state progression detected');
    }
  }
}

/**
 * Mock factory for creating coordinator instances
 */
export function createMockCoordinator<T>(initialState?: Partial<VisualState<T>>) {
  return new MockCoordinator<T>(initialState);
}

/**
 * Mock factory for creating reactive queries
 */
export function createMockQuery<T>(initialData?: T, isCollection = false) {
  return new MockReactiveQuery<T>(initialData, isCollection);
}

/**
 * Performance testing utilities
 */
export class PerformanceTestUtils {
  static measureCoordinatorCreation(iterations = 100) {
    const mockQuery = createMockQuery();
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const coordinator = createMockCoordinator();
      const end = performance.now();

      times.push(end - start);
      coordinator.destroy();
    }

    return {
      average: times.reduce((sum, time) => sum + time, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      median: times.sort()[Math.floor(times.length / 2)],
    };
  }

  static measureStateTransitions<T>(coordinator: MockCoordinator<T>, transitionCount = 100) {
    const start = performance.now();

    for (let i = 0; i < transitionCount; i++) {
      coordinator.transitionTo('loading');
      coordinator.transitionTo('ready', `data-${i}` as T);
    }

    const end = performance.now();
    return (end - start) / transitionCount; // Average per transition
  }
}
