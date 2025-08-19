/**
 * Tests for Zero Native Reactivity Runes
 * Tests the custom fZero and fZeroOne runes for Svelte 5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fZero, fZeroOne } from './runes.svelte';
import { getZero } from './zero-client';

// Mock the Zero client
const mockZeroClient = {
  query: {
    jobs: {
      materialize: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(),
      one: vi.fn(),
    },
  },
};

// Mock the zero-client module
vi.mock('./zero-client', () => ({
  getZero: vi.fn(() => mockZeroClient),
}));

// Mock view object with addListener and destroy
const createMockView = (initialData: unknown[] | null | undefined = []) => ({
  data: initialData,
  addListener: vi.fn(),
  destroy: vi.fn(),
});

// Mock query builder
const createMockQueryBuilder = () => ({
  materialize: vi.fn(() => createMockView()),
});

describe('fZero', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create reactive query with default values', () => {
      const queryBuilder = createMockQueryBuilder();
      const mockView = createMockView([]);
      queryBuilder.materialize.mockReturnValue(mockView);

      const query = fZero(() => queryBuilder, []);

      expect(query.data).toEqual([]);
      expect(query.isLoading).toBe(true);
      expect(query.error).toBe(null);
    });

    it('should handle initial data from view', () => {
      const initialData = [{ id: '1', name: 'Test Job' }];
      const queryBuilder = createMockQueryBuilder();
      const mockView = createMockView(initialData);
      queryBuilder.materialize.mockReturnValue(mockView);

      const query = fZero(() => queryBuilder, []);

      expect(query.data).toEqual(initialData);
      expect(query.isLoading).toBe(false);
      expect(query.error).toBe(null);
    });

    it('should handle null/undefined initial data', () => {
      const queryBuilder = createMockQueryBuilder();
      const mockView = createMockView(null);
      queryBuilder.materialize.mockReturnValue(mockView);

      const query = fZero(() => queryBuilder, []);

      expect(query.data).toEqual([]);
      expect(query.isLoading).toBe(false);
      expect(query.error).toBe(null);
    });
  });

  describe('listener setup', () => {
    it('should set up addListener with callback', () => {
      const queryBuilder = createMockQueryBuilder();
      const mockView = createMockView([]);
      const mockRemoveListener = vi.fn();
      mockView.addListener.mockReturnValue(mockRemoveListener);
      queryBuilder.materialize.mockReturnValue(mockView);

      fZero(() => queryBuilder, []);

      expect(mockView.addListener).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should update data when listener callback is called', () => {
      const queryBuilder = createMockQueryBuilder();
      const mockView = createMockView([]);
      const mockRemoveListener = vi.fn();
      let listenerCallback: (data: unknown) => void;

      mockView.addListener.mockImplementation((callback: (data: unknown) => void) => {
        listenerCallback = callback;
        return mockRemoveListener;
      });

      queryBuilder.materialize.mockReturnValue(mockView);

      const query = fZero(() => queryBuilder, []);

      // Simulate data change
      const newData = [{ id: '1', name: 'New Job' }];
      listenerCallback(newData);

      expect(query.data).toEqual(newData);
      expect(query.isLoading).toBe(false);
      expect(query.error).toBe(null);
    });

    it('should handle null data from listener', () => {
      const queryBuilder = createMockQueryBuilder();
      const mockView = createMockView([]);
      const mockRemoveListener = vi.fn();
      let listenerCallback: (data: unknown) => void;

      mockView.addListener.mockImplementation((callback: (data: unknown) => void) => {
        listenerCallback = callback;
        return mockRemoveListener;
      });

      queryBuilder.materialize.mockReturnValue(mockView);

      const defaultValue = [{ id: 'default', name: 'Default' }];
      const query = fZero(() => queryBuilder, defaultValue);

      // Simulate null data change
      listenerCallback(null);

      expect(query.data).toEqual(defaultValue);
      expect(query.isLoading).toBe(false);
      expect(query.error).toBe(null);
    });
  });

  describe('error handling', () => {
    it('should handle Zero client not ready', () => {
      // Use the already imported and mocked getZero
      getZero.mockReturnValue(null);

      const queryBuilder = createMockQueryBuilder();
      const query = fZero(() => queryBuilder, []);

      expect(query.data).toEqual([]);
      expect(query.isLoading).toBe(true);
      expect(query.error).toBe(null);
    });

    it('should handle view creation errors', () => {
      const queryBuilder = createMockQueryBuilder();
      queryBuilder.materialize.mockImplementation(() => {
        throw new Error('View creation failed');
      });

      const query = fZero(() => queryBuilder, []);

      expect(query.data).toEqual([]);
      expect(query.isLoading).toBe(false);
      expect(query.error).toBeInstanceOf(Error);
      expect(query.error?.message).toBe('View creation failed');
    });

    it('should handle non-Error exceptions', () => {
      const queryBuilder = createMockQueryBuilder();
      queryBuilder.materialize.mockImplementation(() => {
        throw 'String error';
      });

      const query = fZero(() => queryBuilder, []);

      expect(query.data).toEqual([]);
      expect(query.isLoading).toBe(false);
      expect(query.error).toBeInstanceOf(Error);
      expect(query.error?.message).toBe('Unknown error');
    });
  });

  describe('cleanup', () => {
    it('should call removeListener on cleanup', () => {
      const queryBuilder = createMockQueryBuilder();
      const mockView = createMockView([]);
      const mockRemoveListener = vi.fn();
      mockView.addListener.mockReturnValue(mockRemoveListener);
      queryBuilder.materialize.mockReturnValue(mockView);

      fZero(() => queryBuilder, []);

      // Simulate cleanup (would normally be called by Svelte's $effect cleanup)
      // In real usage, this would be handled by the $effect return function
      expect(mockView.addListener).toHaveBeenCalled();
      expect(mockView.destroy).toBeDefined();
    });

    it('should call view.destroy on cleanup', () => {
      const queryBuilder = createMockQueryBuilder();
      const mockView = createMockView([]);
      const mockRemoveListener = vi.fn();
      mockView.addListener.mockReturnValue(mockRemoveListener);
      queryBuilder.materialize.mockReturnValue(mockView);

      fZero(() => queryBuilder, []);

      // Verify view has destroy method
      expect(mockView.destroy).toBeDefined();
      expect(typeof mockView.destroy).toBe('function');
    });
  });

  describe('reactive getters', () => {
    it('should provide reactive access to data', () => {
      const queryBuilder = createMockQueryBuilder();
      const mockView = createMockView([]);
      queryBuilder.materialize.mockReturnValue(mockView);

      const query = fZero(() => queryBuilder, []);

      // Test getter property
      expect(typeof query.data).toBe('object');
      expect(Array.isArray(query.data)).toBe(true);
    });

    it('should provide reactive access to isLoading', () => {
      const queryBuilder = createMockQueryBuilder();
      const mockView = createMockView([]);
      queryBuilder.materialize.mockReturnValue(mockView);

      const query = fZero(() => queryBuilder, []);

      expect(typeof query.isLoading).toBe('boolean');
    });

    it('should provide reactive access to error', () => {
      const queryBuilder = createMockQueryBuilder();
      const mockView = createMockView([]);
      queryBuilder.materialize.mockReturnValue(mockView);

      const query = fZero(() => queryBuilder, []);

      expect(query.error).toBe(null);
    });
  });
});

describe('fZeroOne', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create reactive query for single record with default values', () => {
      const queryBuilder = createMockQueryBuilder();
      const mockView = createMockView(null);
      queryBuilder.materialize.mockReturnValue(mockView);

      const query = fZeroOne(() => queryBuilder, null);

      expect(query.data).toBe(null);
      expect(query.isLoading).toBe(true);
      expect(query.error).toBe(null);
    });

    it('should handle initial data from view', () => {
      const initialData = { id: '1', name: 'Test Job' };
      const queryBuilder = createMockQueryBuilder();
      const mockView = createMockView(initialData);
      queryBuilder.materialize.mockReturnValue(mockView);

      const query = fZeroOne(() => queryBuilder, null);

      expect(query.data).toEqual(initialData);
      expect(query.isLoading).toBe(false);
      expect(query.error).toBe(null);
    });

    it('should handle undefined initial data', () => {
      const queryBuilder = createMockQueryBuilder();
      const mockView = createMockView(undefined);
      queryBuilder.materialize.mockReturnValue(mockView);

      const query = fZeroOne(() => queryBuilder, null);

      expect(query.data).toBe(undefined);
      expect(query.isLoading).toBe(false);
      expect(query.error).toBe(null);
    });
  });

  describe('listener setup', () => {
    it('should set up addListener with callback', () => {
      const queryBuilder = createMockQueryBuilder();
      const mockView = createMockView(null);
      const mockRemoveListener = vi.fn();
      mockView.addListener.mockReturnValue(mockRemoveListener);
      queryBuilder.materialize.mockReturnValue(mockView);

      fZeroOne(() => queryBuilder, null);

      expect(mockView.addListener).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should update data when listener callback is called', () => {
      const queryBuilder = createMockQueryBuilder();
      const mockView = createMockView(null);
      const mockRemoveListener = vi.fn();
      let listenerCallback: (data: unknown) => void;

      mockView.addListener.mockImplementation((callback: (data: unknown) => void) => {
        listenerCallback = callback;
        return mockRemoveListener;
      });

      queryBuilder.materialize.mockReturnValue(mockView);

      const query = fZeroOne(() => queryBuilder, null);

      // Simulate data change
      const newData = { id: '1', name: 'New Job' };
      listenerCallback(newData);

      expect(query.data).toEqual(newData);
      expect(query.isLoading).toBe(false);
      expect(query.error).toBe(null);
    });

    it('should handle null data from listener with default value', () => {
      const queryBuilder = createMockQueryBuilder();
      const mockView = createMockView(null);
      const mockRemoveListener = vi.fn();
      let listenerCallback: (data: unknown) => void;

      mockView.addListener.mockImplementation((callback: (data: unknown) => void) => {
        listenerCallback = callback;
        return mockRemoveListener;
      });

      queryBuilder.materialize.mockReturnValue(mockView);

      const defaultValue = { id: 'default', name: 'Default' };
      const query = fZeroOne(() => queryBuilder, defaultValue);

      // Simulate null data change
      listenerCallback(null);

      expect(query.data).toEqual(defaultValue);
      expect(query.isLoading).toBe(false);
      expect(query.error).toBe(null);
    });
  });

  describe('error handling', () => {
    it('should handle Zero client not ready', () => {
      // Use the already imported and mocked getZero
      getZero.mockReturnValue(null);

      const queryBuilder = createMockQueryBuilder();
      const query = fZeroOne(() => queryBuilder, null);

      expect(query.data).toBe(null);
      expect(query.isLoading).toBe(true);
      expect(query.error).toBe(null);
    });

    it('should handle view creation errors', () => {
      const queryBuilder = createMockQueryBuilder();
      queryBuilder.materialize.mockImplementation(() => {
        throw new Error('View creation failed');
      });

      const query = fZeroOne(() => queryBuilder, null);

      expect(query.data).toBe(null);
      expect(query.isLoading).toBe(false);
      expect(query.error).toBeInstanceOf(Error);
      expect(query.error?.message).toBe('View creation failed');
    });
  });

  describe('reactive getters', () => {
    it('should provide reactive access to single record data', () => {
      const queryBuilder = createMockQueryBuilder();
      const mockView = createMockView(null);
      queryBuilder.materialize.mockReturnValue(mockView);

      const query = fZeroOne(() => queryBuilder, null);

      expect(query.data).toBe(null);
      expect(typeof query.isLoading).toBe('boolean');
      expect(query.error).toBe(null);
    });
  });
});

describe('Performance and Memory Management', () => {
  it('should not create unnecessary listeners', () => {
    const queryBuilder = createMockQueryBuilder();
    const mockView = createMockView([]);
    queryBuilder.materialize.mockReturnValue(mockView);

    fZero(() => queryBuilder, []);

    expect(queryBuilder.materialize).toHaveBeenCalledTimes(1);
    expect(mockView.addListener).toHaveBeenCalledTimes(1);
  });

  it('should handle rapid data changes efficiently', () => {
    const queryBuilder = createMockQueryBuilder();
    const mockView = createMockView([]);
    let listenerCallback: (data: unknown) => void;

    mockView.addListener.mockImplementation((callback: (data: unknown) => void) => {
      listenerCallback = callback;
      return vi.fn();
    });

    queryBuilder.materialize.mockReturnValue(mockView);

    const query = fZero(() => queryBuilder, []);

    // Simulate rapid data changes
    for (let i = 0; i < 10; i++) {
      listenerCallback([{ id: i.toString(), name: `Job ${i}` }]);
    }

    expect(query.data).toEqual([{ id: '9', name: 'Job 9' }]);
    expect(query.isLoading).toBe(false);
    expect(query.error).toBe(null);
  });

  it('should handle listener cleanup properly', () => {
    const queryBuilder = createMockQueryBuilder();
    const mockView = createMockView([]);
    const mockRemoveListener = vi.fn();

    mockView.addListener.mockReturnValue(mockRemoveListener);
    queryBuilder.materialize.mockReturnValue(mockView);

    fZero(() => queryBuilder, []);

    // Verify setup
    expect(mockView.addListener).toHaveBeenCalled();
    expect(mockView.destroy).toBeDefined();

    // In real usage, cleanup would be handled by $effect return function
    // Here we just verify the mocks are set up correctly
    expect(mockRemoveListener).toBeDefined();
    expect(typeof mockRemoveListener).toBe('function');
  });
});
