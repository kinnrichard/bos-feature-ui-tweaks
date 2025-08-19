/**
 * Integration tests for ReactiveView component
 *
 * Tests the ReactiveView Svelte component in isolation with different
 * state scenarios and rendering patterns to validate flash prevention
 * and declarative state handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import ReactiveView from '../../src/lib/reactive/ReactiveView.svelte';

// Mock the coordinator
const mockCoordinator = {
  visualState: {
    displayData: null,
    shouldShowLoading: false,
    shouldShowEmpty: false,
    shouldShowError: false,
    state: 'initializing',
    error: null,
    isFresh: false,
    isInitialLoad: true,
  },
  subscribe: vi.fn(),
  refresh: vi.fn(),
  destroy: vi.fn(),
};

// Mock the coordinator creation
vi.mock('../../src/lib/reactive/coordinator', () => ({
  createReactiveCoordinator: vi.fn(() => mockCoordinator),
}));

// Mock debug utility
vi.mock('../../src/lib/utils/debug', () => ({
  debugReactive: vi.fn(),
}));

// Mock ReactiveQuery interface
class MockReactiveQuery {
  constructor(
    public data: any = null,
    public isLoading = false,
    public error: Error | null = null,
    public isCollection = false
  ) {}

  get resultType() {
    return this.isLoading ? 'loading' : 'complete';
  }
  get present() {
    return this.data !== null;
  }
  get blank() {
    return this.data === null;
  }

  async refresh() {}
  destroy() {}
  subscribe() {
    return () => {};
  }
}

describe('ReactiveView Component Integration', () => {
  let mockQuery: MockReactiveQuery;
  let subscribeCallback: (state: any) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery = new MockReactiveQuery();

    // Setup mock coordinator subscription
    mockCoordinator.subscribe.mockImplementation((callback) => {
      subscribeCallback = callback;
      // Immediately call with current state
      callback(mockCoordinator.visualState);
      return () => {};
    });

    // Reset coordinator state
    mockCoordinator.visualState = {
      displayData: null,
      shouldShowLoading: false,
      shouldShowEmpty: false,
      shouldShowError: false,
      state: 'initializing',
      error: null,
      isFresh: false,
      isInitialLoad: true,
    };
  });

  afterEach(() => {
    cleanup();
  });

  describe('initial rendering', () => {
    it('should render loading state initially', async () => {
      mockCoordinator.visualState.shouldShowLoading = true;

      const { container, getByText } = render(ReactiveView, {
        props: { query: mockQuery },
      });

      await tick();

      expect(getByText('Loading...')).toBeInTheDocument();
      expect(container.querySelector('.reactive-view__loading')).toBeInTheDocument();
    });

    it('should render custom loading content when provided', async () => {
      mockCoordinator.visualState.shouldShowLoading = true;

      const { getByText } = render(ReactiveView, {
        props: {
          query: mockQuery,
          children: {
            loading: () => 'Custom loading content',
          },
        },
      });

      await tick();

      expect(getByText('Custom loading content')).toBeInTheDocument();
    });
  });

  describe('data state rendering', () => {
    it('should render content when data is available', async () => {
      mockCoordinator.visualState = {
        displayData: 'test content',
        shouldShowLoading: false,
        shouldShowEmpty: false,
        shouldShowError: false,
        state: 'ready',
        error: null,
        isFresh: true,
        isInitialLoad: false,
      };

      const { container, getByText } = render(ReactiveView, {
        props: { query: mockQuery },
      });

      await tick();

      expect(getByText('Data loaded successfully')).toBeInTheDocument();
      expect(container.querySelector('.reactive-view__content')).toBeInTheDocument();
    });

    it('should render custom content with context data', async () => {
      mockCoordinator.visualState = {
        displayData: { id: 1, name: 'Test Item' },
        shouldShowLoading: false,
        shouldShowEmpty: false,
        shouldShowError: false,
        state: 'ready',
        error: null,
        isFresh: true,
        isInitialLoad: false,
      };

      const { getByText } = render(ReactiveView, {
        props: {
          query: mockQuery,
          children: {
            content: (context) => `Item: ${context.data.name}`,
          },
        },
      });

      await tick();

      expect(getByText('Item: Test Item')).toBeInTheDocument();
    });
  });

  describe('empty state rendering', () => {
    it('should render empty state when shouldShowEmpty is true', async () => {
      mockCoordinator.visualState = {
        displayData: null,
        shouldShowLoading: false,
        shouldShowEmpty: true,
        shouldShowError: false,
        state: 'ready',
        error: null,
        isFresh: true,
        isInitialLoad: false,
      };

      const { container, getByText } = render(ReactiveView, {
        props: { query: mockQuery },
      });

      await tick();

      expect(getByText('No data available')).toBeInTheDocument();
      expect(container.querySelector('.reactive-view__empty')).toBeInTheDocument();
    });

    it('should render custom empty content', async () => {
      mockCoordinator.visualState.shouldShowEmpty = true;
      mockCoordinator.visualState.state = 'ready';

      const { getByText } = render(ReactiveView, {
        props: {
          query: mockQuery,
          children: {
            empty: () => 'No items found',
          },
        },
      });

      await tick();

      expect(getByText('No items found')).toBeInTheDocument();
    });
  });

  describe('error state rendering', () => {
    it('should render error state when shouldShowError is true', async () => {
      const testError = new Error('Test error message');
      mockCoordinator.visualState = {
        displayData: null,
        shouldShowLoading: false,
        shouldShowEmpty: false,
        shouldShowError: true,
        state: 'error',
        error: testError,
        isFresh: false,
        isInitialLoad: false,
      };

      const { container, getByText } = render(ReactiveView, {
        props: { query: mockQuery },
      });

      await tick();

      expect(getByText('Error loading data: Test error message')).toBeInTheDocument();
      expect(container.querySelector('.reactive-view__error')).toBeInTheDocument();
      expect(getByText('Retry')).toBeInTheDocument();
    });

    it('should call refresh when retry button is clicked', async () => {
      const testError = new Error('Test error');
      mockCoordinator.visualState = {
        displayData: null,
        shouldShowLoading: false,
        shouldShowEmpty: false,
        shouldShowError: true,
        state: 'error',
        error: testError,
        isFresh: false,
        isInitialLoad: false,
      };

      const { getByText } = render(ReactiveView, {
        props: { query: mockQuery },
      });

      await tick();

      const retryButton = getByText('Retry');
      await retryButton.click();

      expect(mockCoordinator.refresh).toHaveBeenCalled();
    });
  });

  describe('progressive loading strategy', () => {
    it('should show loading overlay with existing data in progressive mode', async () => {
      mockCoordinator.visualState = {
        displayData: 'existing data',
        shouldShowLoading: true,
        shouldShowEmpty: false,
        shouldShowError: false,
        state: 'hydrating',
        error: null,
        isFresh: false,
        isInitialLoad: false,
      };

      const { container, getByText } = render(ReactiveView, {
        props: {
          query: mockQuery,
          strategy: 'progressive',
        },
      });

      await tick();

      // Should show both content and loading overlay
      expect(getByText('Data loaded successfully')).toBeInTheDocument();
      expect(getByText('Refreshing...')).toBeInTheDocument();
      expect(container.querySelector('.reactive-view__loading-overlay')).toBeInTheDocument();
    });

    it('should use custom loading overlay content', async () => {
      mockCoordinator.visualState = {
        displayData: 'data',
        shouldShowLoading: true,
        shouldShowEmpty: false,
        shouldShowError: false,
        state: 'hydrating',
        error: null,
        isFresh: false,
        isInitialLoad: false,
      };

      const { getByText } = render(ReactiveView, {
        props: {
          query: mockQuery,
          strategy: 'progressive',
          children: {
            content: () => 'Main content',
            loadingOverlay: () => 'Custom overlay',
          },
        },
      });

      await tick();

      expect(getByText('Main content')).toBeInTheDocument();
      expect(getByText('Custom overlay')).toBeInTheDocument();
    });
  });

  describe('display filters', () => {
    it('should apply filters to collection data', async () => {
      const collectionData = [
        { id: 1, name: 'Active Item', status: 'active' },
        { id: 2, name: 'Inactive Item', status: 'inactive' },
        { id: 3, name: 'Another Active', status: 'active' },
      ];

      mockCoordinator.visualState = {
        displayData: collectionData,
        shouldShowLoading: false,
        shouldShowEmpty: false,
        shouldShowError: false,
        state: 'ready',
        error: null,
        isFresh: true,
        isInitialLoad: false,
      };

      const { getByText } = render(ReactiveView, {
        props: {
          query: mockQuery,
          displayFilters: { status: 'active' },
          children: {
            content: (context) => `Found ${context.data.length} items`,
          },
        },
      });

      await tick();

      expect(getByText('Found 2 items')).toBeInTheDocument();
    });

    it('should handle empty results after filtering', async () => {
      const collectionData = [{ id: 1, name: 'Item', status: 'active' }];

      mockCoordinator.visualState = {
        displayData: collectionData,
        shouldShowLoading: false,
        shouldShowEmpty: true, // Coordinator says should show empty
        shouldShowError: false,
        state: 'ready',
        error: null,
        isFresh: true,
        isInitialLoad: false,
      };

      const { getByText } = render(ReactiveView, {
        props: {
          query: mockQuery,
          displayFilters: { status: 'nonexistent' },
        },
      });

      await tick();

      expect(getByText('No data available')).toBeInTheDocument();
    });

    it('should apply string matching filters', async () => {
      const collectionData = [
        { id: 1, title: 'React Component' },
        { id: 2, title: 'Vue Component' },
        { id: 3, title: 'Angular Service' },
      ];

      mockCoordinator.visualState = {
        displayData: collectionData,
        shouldShowLoading: false,
        shouldShowEmpty: false,
        shouldShowError: false,
        state: 'ready',
        error: null,
        isFresh: true,
        isInitialLoad: false,
      };

      const { getByText } = render(ReactiveView, {
        props: {
          query: mockQuery,
          displayFilters: { title: 'component' }, // Case insensitive
          children: {
            content: (context) => `Filtered: ${context.data.length} components`,
          },
        },
      });

      await tick();

      expect(getByText('Filtered: 2 components')).toBeInTheDocument();
    });
  });

  describe('state transitions and reactivity', () => {
    it('should react to coordinator state changes', async () => {
      const { container } = render(ReactiveView, {
        props: { query: mockQuery },
      });

      // Initially loading
      mockCoordinator.visualState.shouldShowLoading = true;
      subscribeCallback(mockCoordinator.visualState);
      await tick();

      expect(container.querySelector('.reactive-view__loading')).toBeInTheDocument();

      // Transition to ready with data
      mockCoordinator.visualState = {
        displayData: 'loaded data',
        shouldShowLoading: false,
        shouldShowEmpty: false,
        shouldShowError: false,
        state: 'ready',
        error: null,
        isFresh: true,
        isInitialLoad: false,
      };
      subscribeCallback(mockCoordinator.visualState);
      await tick();

      expect(container.querySelector('.reactive-view__content')).toBeInTheDocument();
      expect(container.querySelector('.reactive-view__loading')).not.toBeInTheDocument();
    });

    it('should handle display filter changes reactively', async () => {
      const collectionData = [
        { id: 1, category: 'A' },
        { id: 2, category: 'B' },
      ];

      mockCoordinator.visualState = {
        displayData: collectionData,
        shouldShowLoading: false,
        shouldShowEmpty: false,
        shouldShowError: false,
        state: 'ready',
        error: null,
        isFresh: true,
        isInitialLoad: false,
      };

      const { getByText, rerender } = render(ReactiveView, {
        props: {
          query: mockQuery,
          displayFilters: { category: 'A' },
          children: {
            content: (context) => `Count: ${context.data.length}`,
          },
        },
      });

      await tick();
      expect(getByText('Count: 1')).toBeInTheDocument();

      // Change filters
      await rerender({
        query: mockQuery,
        displayFilters: {},
        children: {
          content: (context) => `Count: ${context.data.length}`,
        },
      });

      await tick();
      expect(getByText('Count: 2')).toBeInTheDocument();
    });
  });

  describe('context data and refresh functionality', () => {
    it('should provide complete context data to children', async () => {
      mockCoordinator.visualState = {
        displayData: { test: 'data' },
        shouldShowLoading: false,
        shouldShowEmpty: false,
        shouldShowError: false,
        state: 'ready',
        error: null,
        isFresh: true,
        isInitialLoad: false,
      };

      let capturedContext: any;

      render(ReactiveView, {
        props: {
          query: mockQuery,
          children: {
            content: (context) => {
              capturedContext = context;
              return 'Content';
            },
          },
        },
      });

      await tick();

      expect(capturedContext).toEqual({
        data: { test: 'data' },
        state: 'ready',
        isLoading: false,
        isEmpty: false,
        hasError: false,
        error: null,
        isFresh: true,
        isInitialLoad: false,
        refresh: expect.any(Function),
      });
    });

    it('should allow refresh calls through context', async () => {
      mockCoordinator.visualState = {
        displayData: 'data',
        shouldShowLoading: false,
        shouldShowEmpty: false,
        shouldShowError: false,
        state: 'ready',
        error: null,
        isFresh: true,
        isInitialLoad: false,
      };

      let refreshFunction: any;

      render(ReactiveView, {
        props: {
          query: mockQuery,
          children: {
            content: (context) => {
              refreshFunction = context.refresh;
              return 'Content';
            },
          },
        },
      });

      await tick();

      await refreshFunction();
      expect(mockCoordinator.refresh).toHaveBeenCalled();
    });
  });

  describe('cleanup and lifecycle', () => {
    it('should clean up coordinator on destroy', () => {
      const { unmount } = render(ReactiveView, {
        props: { query: mockQuery },
      });

      unmount();

      expect(mockCoordinator.destroy).toHaveBeenCalled();
    });

    it('should handle subscription cleanup', () => {
      const unsubscribeMock = vi.fn();
      mockCoordinator.subscribe.mockReturnValue(unsubscribeMock);

      const { unmount } = render(ReactiveView, {
        props: { query: mockQuery },
      });

      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  describe('debug mode', () => {
    it('should enable debug logging when debug prop is true', async () => {
      const { debugReactive } = await import('../../src/lib/utils/debug');

      render(ReactiveView, {
        props: {
          query: mockQuery,
          debug: true,
        },
      });

      expect(debugReactive).toHaveBeenCalledWith('ReactiveView mounted', {
        strategy: 'progressive',
      });
    });
  });
});
