/**
 * Unit tests for ReactiveRecord v2 Integration Utilities
 *
 * Tests the integration layer that connects coordinator functionality
 * with existing ReactiveQuery implementations and provides migration utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withCoordinator,
  ReactiveQueryAdapter,
  ReactiveQueryFactory,
  MigrationUtils,
  DevUtils,
  TypeGuards,
  type EnhancedReactiveQuery,
} from '../../src/lib/reactive/integration';

// Mock the coordinator
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
  subscribe: vi.fn((callback) => {
    callback(mockCoordinator.visualState);
    return () => {};
  }),
  refresh: vi.fn(),
  destroy: vi.fn(),
};

vi.mock('../../src/lib/reactive/coordinator', () => ({
  createReactiveCoordinator: vi.fn(() => mockCoordinator),
}));

// Mock ReactiveQuery implementation
class MockReactiveQuery {
  constructor(
    public data: any = null,
    public isLoading = false,
    public error: Error | null = null,
    public isCollection = false
  ) {}

  get resultType() {
    if (this.error) return 'error';
    if (this.isLoading) return 'loading';
    return 'complete';
  }

  get present() {
    if (this.data === null || this.data === undefined) return false;
    if (Array.isArray(this.data)) return this.data.length > 0;
    return true;
  }

  get blank() {
    return !this.present;
  }

  async refresh() {
    // Mock refresh implementation
  }

  destroy() {
    // Mock destroy implementation
  }

  subscribe(callback: (data: any) => void) {
    callback(this.data);
    return () => {};
  }
}

describe('withCoordinator', () => {
  let mockQuery: MockReactiveQuery;
  let enhancedQuery: EnhancedReactiveQuery<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery = new MockReactiveQuery('test data', false, null);
    enhancedQuery = withCoordinator(mockQuery);
  });

  it('should preserve original query interface', () => {
    expect(enhancedQuery.data).toBe('test data');
    expect(enhancedQuery.isLoading).toBe(false);
    expect(enhancedQuery.error).toBe(null);
    expect(enhancedQuery.resultType).toBe('complete');
    expect(enhancedQuery.isCollection).toBe(false);
    expect(enhancedQuery.present).toBe(true);
    expect(enhancedQuery.blank).toBe(false);
  });

  it('should add coordinator functionality', () => {
    expect(enhancedQuery.coordinator).toBe(mockCoordinator);
    expect(typeof enhancedQuery.getVisualState).toBe('function');
    expect(typeof enhancedQuery.subscribeToVisualState).toBe('function');
  });

  it('should delegate refresh to coordinator', async () => {
    await enhancedQuery.refresh();
    expect(mockCoordinator.refresh).toHaveBeenCalled();
  });

  it('should destroy both coordinator and query', () => {
    const destroySpy = vi.spyOn(mockQuery, 'destroy');

    enhancedQuery.destroy();

    expect(mockCoordinator.destroy).toHaveBeenCalled();
    expect(destroySpy).toHaveBeenCalled();
  });

  it('should provide visual state access', () => {
    const visualState = enhancedQuery.getVisualState!();
    expect(visualState).toBe(mockCoordinator.visualState);
  });

  it('should provide visual state subscription', () => {
    const callback = vi.fn();
    const unsubscribe = enhancedQuery.subscribeToVisualState!(callback);

    expect(mockCoordinator.subscribe).toHaveBeenCalledWith(callback);
    expect(typeof unsubscribe).toBe('function');
  });
});

describe('ReactiveQueryAdapter', () => {
  let mockQuery: MockReactiveQuery;
  let adapter: ReactiveQueryAdapter<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery = new MockReactiveQuery(['item1', 'item2'], false, null, true);
    adapter = new ReactiveQueryAdapter(mockQuery);
  });

  it('should implement ReactiveQuery interface using coordinator', () => {
    // Mock coordinator to return specific visual state
    mockCoordinator.visualState.displayData = ['adapted1', 'adapted2'];
    mockCoordinator.visualState.shouldShowLoading = true;
    mockCoordinator.visualState.error = new Error('Adapter error');
    mockCoordinator.visualState.state = 'error';

    expect(adapter.data).toEqual(['adapted1', 'adapted2']);
    expect(adapter.isLoading).toBe(true);
    expect(adapter.error?.message).toBe('Adapter error');
    expect(adapter.resultType).toBe('error');
  });

  it('should map coordinator states to resultType correctly', () => {
    // Test ready state
    mockCoordinator.visualState.state = 'ready';
    expect(adapter.resultType).toBe('complete');

    // Test error state
    mockCoordinator.visualState.state = 'error';
    expect(adapter.resultType).toBe('error');

    // Test loading states
    mockCoordinator.visualState.state = 'loading';
    expect(adapter.resultType).toBe('loading');

    mockCoordinator.visualState.state = 'initializing';
    expect(adapter.resultType).toBe('loading');

    mockCoordinator.visualState.state = 'hydrating';
    expect(adapter.resultType).toBe('loading');
  });

  it('should compute present/blank correctly', () => {
    // With data
    mockCoordinator.visualState.displayData = ['item'];
    expect(adapter.present).toBe(true);
    expect(adapter.blank).toBe(false);

    // Empty array
    mockCoordinator.visualState.displayData = [];
    expect(adapter.present).toBe(false);
    expect(adapter.blank).toBe(true);

    // Null data
    mockCoordinator.visualState.displayData = null;
    expect(adapter.present).toBe(false);
    expect(adapter.blank).toBe(true);
  });

  it('should delegate to coordinator methods', async () => {
    const callback = vi.fn();

    await adapter.refresh();
    expect(mockCoordinator.refresh).toHaveBeenCalled();

    adapter.destroy();
    expect(mockCoordinator.destroy).toHaveBeenCalled();

    adapter.subscribe(callback);
    expect(mockCoordinator.subscribe).toHaveBeenCalled();
  });

  it('should provide enhanced functionality', () => {
    const visualState = adapter.getVisualState();
    expect(visualState).toBe(mockCoordinator.visualState);

    const callback = vi.fn();
    const unsubscribe = adapter.subscribeToVisualState(callback);
    expect(mockCoordinator.subscribe).toHaveBeenCalledWith(callback);
  });
});

describe('ReactiveQueryFactory', () => {
  let mockQuery: MockReactiveQuery;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery = new MockReactiveQuery('factory test');
  });

  describe('create()', () => {
    it('should create enhanced query with coordinator', () => {
      const enhanced = ReactiveQueryFactory.create(mockQuery, { debug: true });

      expect(enhanced).toHaveProperty('coordinator');
      expect(enhanced.data).toBe('factory test');
    });
  });

  describe('createAdapter()', () => {
    it('should create adapter instance', () => {
      const adapter = ReactiveQueryFactory.createAdapter(mockQuery);

      expect(adapter).toBeInstanceOf(ReactiveQueryAdapter);
    });
  });

  describe('createForNavigation()', () => {
    it('should create query with navigation-optimized config', async () => {
      const { createReactiveCoordinator } = await import('../../src/lib/reactive/coordinator');

      ReactiveQueryFactory.createForNavigation(mockQuery);

      expect(createReactiveCoordinator).toHaveBeenCalledWith(
        mockQuery,
        expect.objectContaining({
          minimumLoadingTime: 100,
          preserveStaleData: true,
          debug: false,
        })
      );
    });
  });

  describe('createForInitialLoad()', () => {
    it('should create query with initial-load-optimized config', async () => {
      const { createReactiveCoordinator } = await import('../../src/lib/reactive/coordinator');

      ReactiveQueryFactory.createForInitialLoad(mockQuery);

      expect(createReactiveCoordinator).toHaveBeenCalledWith(
        mockQuery,
        expect.objectContaining({
          minimumLoadingTime: 500,
          initialLoadTimeout: 15000,
          preserveStaleData: false,
          debug: false,
        })
      );
    });
  });
});

describe('MigrationUtils', () => {
  describe('upgradeReactiveRecord()', () => {
    it('should wrap ReactiveRecord methods with coordinator', () => {
      const mockRecordClass = {
        find: vi.fn(() => mockQuery),
        findBy: vi.fn(() => mockQuery),
        all: vi.fn(() => mockQuery),
        where: vi.fn(() => mockQuery),
        customMethod: vi.fn(),
      };

      const upgraded = MigrationUtils.upgradeReactiveRecord(mockRecordClass);

      // Should have all original methods
      expect(typeof upgraded.find).toBe('function');
      expect(typeof upgraded.findBy).toBe('function');
      expect(typeof upgraded.all).toBe('function');
      expect(typeof upgraded.where).toBe('function');
      expect(typeof upgraded.customMethod).toBe('function');

      // Test method wrapping
      const result = upgraded.find('123');
      expect(mockRecordClass.find).toHaveBeenCalledWith('123');
      expect(result).toHaveProperty('coordinator');
    });

    it('should not wrap non-ReactiveQuery results', () => {
      const mockRecordClass = {
        find: vi.fn(() => ({ data: 'test' })), // ReactiveQuery-like
        customMethod: vi.fn(() => 'string result'), // Not a ReactiveQuery
        otherMethod: vi.fn(() => ({ some: 'object' })), // Different object
      };

      const upgraded = MigrationUtils.upgradeReactiveRecord(mockRecordClass);

      // ReactiveQuery-like result should be wrapped
      const findResult = upgraded.find('123');
      expect(findResult).toHaveProperty('coordinator');

      // Non-ReactiveQuery results should not be wrapped
      const stringResult = upgraded.customMethod();
      expect(stringResult).toBe('string result');

      const objectResult = upgraded.otherMethod();
      expect(objectResult).toEqual({ some: 'object' });
    });
  });

  describe('upgradeQuery()', () => {
    it('should upgrade query based on context', () => {
      const standardQuery = MigrationUtils.upgradeQuery(mockQuery, 'standard');
      expect(standardQuery).toHaveProperty('coordinator');

      const navQuery = MigrationUtils.upgradeQuery(mockQuery, 'navigation');
      expect(navQuery).toHaveProperty('coordinator');

      const initialQuery = MigrationUtils.upgradeQuery(mockQuery, 'initial');
      expect(initialQuery).toHaveProperty('coordinator');
    });

    it('should default to standard context', () => {
      const query = MigrationUtils.upgradeQuery(mockQuery);
      expect(query).toHaveProperty('coordinator');
    });
  });
});

describe('DevUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDebugCoordinator()', () => {
    it('should create coordinator with debug enabled', async () => {
      const { createReactiveCoordinator } = await import('../../src/lib/reactive/coordinator');

      DevUtils.createDebugCoordinator(mockQuery, 'test-label');

      expect(createReactiveCoordinator).toHaveBeenCalledWith(
        mockQuery,
        expect.objectContaining({
          debug: true,
          minimumLoadingTime: 300,
          preserveStaleData: true,
        })
      );
    });
  });

  describe('monitorStateTransitions()', () => {
    it('should monitor state transitions', () => {
      const enhancedQuery = withCoordinator(mockQuery);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const unsubscribe = DevUtils.monitorStateTransitions(enhancedQuery, 'test-monitor');

      expect(typeof unsubscribe).toBe('function');
      expect(mockCoordinator.subscribe).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle queries without coordinator', () => {
      const plainQuery = mockQuery as any;
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const unsubscribe = DevUtils.monitorStateTransitions(plainQuery, 'no-coordinator');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ReactiveRecord v2]',
        'Cannot monitor query without coordinator',
        { label: 'no-coordinator' }
      );

      expect(typeof unsubscribe).toBe('function');
      consoleSpy.mockRestore();
    });

    it('should log state transitions', () => {
      const enhancedQuery = withCoordinator(mockQuery);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      DevUtils.monitorStateTransitions(enhancedQuery, 'transition-test');

      // Simulate state change
      const callback = mockCoordinator.subscribe.mock.calls[0][0];
      callback({
        ...mockCoordinator.visualState,
        state: 'loading',
        displayData: 'new data',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ReactiveRecord v2]',
        'State transition [transition-test]',
        expect.objectContaining({
          from: 'ready',
          to: 'loading',
          hasData: true,
          isFresh: true,
        })
      );

      consoleSpy.mockRestore();
    });
  });
});

describe('TypeGuards', () => {
  it('should identify enhanced queries', () => {
    const plainQuery = mockQuery;
    const enhancedQuery = withCoordinator(mockQuery);

    expect(TypeGuards.isEnhancedQuery(plainQuery)).toBe(false);
    expect(TypeGuards.isEnhancedQuery(enhancedQuery)).toBe(true);
    expect(TypeGuards.isEnhancedQuery(null)).toBe(false);
    expect(TypeGuards.isEnhancedQuery(undefined)).toBe(false);
    expect(TypeGuards.isEnhancedQuery('string')).toBe(false);
  });

  it('should identify queries with visual state', () => {
    const plainQuery = mockQuery;
    const enhancedQuery = withCoordinator(mockQuery);
    const partialEnhanced = { coordinator: mockCoordinator }; // Missing getVisualState

    expect(TypeGuards.hasVisualState(plainQuery)).toBe(false);
    expect(TypeGuards.hasVisualState(enhancedQuery)).toBe(true);
    expect(TypeGuards.hasVisualState(partialEnhanced)).toBe(false);
  });
});
