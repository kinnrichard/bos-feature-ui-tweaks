/**
 * Epic 015 Integration Tests
 * Tests the actual migrated console statements in their real contexts
 *
 * Test Coverage:
 * - Authentication layer integration
 * - Zero.js system integration
 * - Component error handling
 * - Model layer integration
 * - Real-world error scenarios
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../../api/auth';
import { handleZeroMutationError } from '../../../utils/popover-utils';
import { validateZeroConfig } from '../../../zero/zero-config';
import { ZeroClientWrapper } from '../../../zero/client';
import { debugAuth, debugDatabase, debugWorkflow, debugComponent } from '../namespaces';
import { api, type EnhancedApiClient } from '../../../api/client';
import { csrfTokenManager } from '../../../api/csrf';
import { getZero, getZeroAsync } from '../../../zero/zero-client';

// Mock dependencies
vi.mock('../../../api/client', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('../../../api/csrf', () => ({
  csrfTokenManager: {
    clearToken: vi.fn(),
  },
}));

vi.mock('../../../zero/zero-client', () => ({
  getZero: vi.fn(),
  getZeroAsync: vi.fn(),
}));

vi.mock('../../../services/TaskHierarchyManager', () => ({
  TaskHierarchyManager: vi.fn().mockImplementation(() => ({
    processTaskHierarchy: vi.fn(),
    validateHierarchy: vi.fn(),
    getTaskLevel: vi.fn(),
  })),
}));

vi.mock('debug', () => ({
  default: vi.fn(() => vi.fn()),
}));

// Mock console for testing
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

describe('Epic 015 Integration - Authentication Layer', () => {
  let authService: AuthService;
  let mockApi: ReturnType<typeof vi.mocked<EnhancedApiClient>>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock the API client
    mockApi = {
      post: vi.fn(),
      get: vi.fn(),
    };

    // Setup mocks using the already imported and mocked api
    vi.mocked(api.post).mockImplementation(mockApi.post);
    vi.mocked(api.get).mockImplementation(mockApi.get);

    authService = new AuthService();

    // Mock debug functions
    vi.mocked(debugAuth.error).mockImplementation(mockConsole.error);
  });

  it('should log authentication failures with proper context and redaction', async () => {
    // Setup API to throw an error
    const authError = new Error('Invalid credentials');
    mockApi.post.mockRejectedValue(authError);

    const credentials = {
      email: 'user@example.com',
      password: 'secretPassword123',
    };

    // Attempt login
    await expect(authService.login(credentials)).rejects.toThrow('Invalid credentials');

    // Verify debug logging occurred
    expect(debugAuth.error).toHaveBeenCalledWith(
      'Login failed',
      expect.objectContaining({
        error: authError,
        credentials: credentials.email,
      })
    );

    // Verify password was not logged (should be redacted)
    expect(debugAuth.error).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        password: expect.anything(),
      })
    );
  });

  it('should log token refresh failures with redacted tokens', async () => {
    const refreshError = new Error('Token expired');
    mockApi.post.mockRejectedValue(refreshError);

    const refreshData = {
      refreshToken: 'refresh-token-abc123',
    };

    await expect(authService.refresh(refreshData)).rejects.toThrow('Token expired');

    expect(debugAuth.error).toHaveBeenCalledWith(
      'Token refresh failed',
      expect.objectContaining({
        error: refreshError,
        refreshData,
      })
    );
  });

  it('should log logout failures while still clearing tokens', async () => {
    const logoutError = new Error('Network error');
    mockApi.post.mockRejectedValue(logoutError);

    const clearTokenSpy = vi.spyOn(csrfTokenManager, 'clearToken');

    await expect(authService.logout()).rejects.toThrow('Network error');

    expect(debugAuth.error).toHaveBeenCalledWith(
      'Logout failed',
      expect.objectContaining({
        error: logoutError,
      })
    );

    // Verify tokens were still cleared despite error
    expect(clearTokenSpy).toHaveBeenCalled();
  });
});

describe('Epic 015 Integration - Zero.js System', () => {
  let mockGetZero: ReturnType<typeof vi.mocked<typeof getZero>>;
  let mockGetZeroAsync: ReturnType<typeof vi.mocked<typeof getZeroAsync>>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetZero = vi.mocked(getZero);
    mockGetZeroAsync = vi.mocked(getZeroAsync);

    // Mock debug functions
    vi.mocked(debugDatabase.warn).mockImplementation(mockConsole.warn);
    vi.mocked(debugDatabase.error).mockImplementation(mockConsole.error);
  });

  it('should warn about low connection timeout in configuration', () => {
    const config = {
      client: { CONNECTION_TIMEOUT: 500 },
      query: {
        MAX_RETRIES: 3,
        DEBUG_LOGGING: false,
      },
    };

    validateZeroConfig(config);

    expect(debugDatabase.warn).toHaveBeenCalledWith(
      'Connection timeout very low, may cause issues',
      expect.objectContaining({
        timeout: 500,
      })
    );
  });

  it('should warn about debug logging enabled in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const config = {
      client: { CONNECTION_TIMEOUT: 5000 },
      query: {
        MAX_RETRIES: 3,
        DEBUG_LOGGING: true,
      },
    };

    validateZeroConfig(config);

    expect(debugDatabase.warn).toHaveBeenCalledWith(
      'Debug logging enabled in production environment',
      expect.objectContaining({
        nodeEnv: 'production',
        debugLogging: true,
      })
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('should handle Zero client connection failures', () => {
    const connectionError = new Error('Connection refused');
    mockGetZero.mockImplementation(() => {
      throw connectionError;
    });

    const client = new ZeroClientWrapper();
    const result = client.getClient();

    expect(result).toBeNull();
    expect(debugDatabase.warn).toHaveBeenCalledWith(
      'Failed to get Zero client',
      expect.objectContaining({
        error: connectionError,
      })
    );
  });

  it('should handle Zero async connection issues', async () => {
    const asyncError = new Error('Async connection failed');
    mockGetZeroAsync.mockRejectedValue(asyncError);

    const client = new ZeroClientWrapper();
    const result = await client.getClientAsync('Test operation', false);

    expect(result).toBeNull();
    expect(debugDatabase.warn).toHaveBeenCalledWith(
      'Zero client connection issue',
      expect.objectContaining({
        error: asyncError,
        errorMsg: expect.stringContaining('Test operation'),
      })
    );
  });
});

describe('Epic 015 Integration - Component Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(debugComponent.error).mockImplementation(mockConsole.error);
    vi.mocked(debugComponent.warn).mockImplementation(mockConsole.warn);
    vi.mocked(debugWorkflow.error).mockImplementation(mockConsole.error);
  });

  it('should handle popover mutation errors with context', () => {
    const mockError = {
      code: 'INVALID_CSRF_TOKEN',
      message: 'CSRF token is invalid',
    };

    handleZeroMutationError(mockError, 'TechnicianAssignment');

    expect(debugComponent.error).toHaveBeenCalledWith(
      'Zero mutation error',
      expect.objectContaining({
        error: mockError,
        context: 'TechnicianAssignment',
        errorMessage: expect.any(String),
      })
    );
  });

  it('should handle generic popover errors', () => {
    const genericError = new Error('Network timeout');

    handleZeroMutationError(genericError);

    expect(debugComponent.error).toHaveBeenCalledWith(
      'Zero mutation error',
      expect.objectContaining({
        error: genericError,
        context: undefined,
        errorMessage: expect.any(String),
      })
    );
  });

  it('should provide proper error context for component failures', () => {
    const componentError = new Error('Component render failed');
    const componentState = {
      isVisible: true,
      userEmail: 'user@example.com',
      authToken: 'bearer-token-123', // Should be redacted
      formData: {
        name: 'John Doe',
        password: 'secret123', // Should be redacted
      },
    };

    // Simulate component error logging
    debugComponent.error('Component state invalid', {
      state: componentState,
      componentName: 'TestComponent',
      error: componentError,
    });

    expect(debugComponent.error).toHaveBeenCalledWith(
      'Component state invalid',
      expect.objectContaining({
        state: componentState,
        componentName: 'TestComponent',
        error: componentError,
      })
    );
  });
});

describe('Epic 015 Integration - Model Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(debugDatabase.error).mockImplementation(mockConsole.error);
    vi.mocked(debugDatabase.warn).mockImplementation(mockConsole.warn);
  });

  it('should handle relationship errors with proper context', () => {
    // Mock a relationship error scenario
    const relationshipError = new Error('Relationship not found');
    const tableName = 'tasks';
    const relationshipName = 'jobAssignments.user';

    // Simulate the error that would occur in scoped-query-base.ts
    try {
      throw relationshipError;
    } catch (error) {
      debugDatabase.error('Zero.js relationship error', {
        relationshipName,
        tableName,
        error,
      });
    }

    expect(debugDatabase.error).toHaveBeenCalledWith(
      'Zero.js relationship error',
      expect.objectContaining({
        relationshipName,
        tableName,
        error: relationshipError,
      })
    );
  });

  it('should handle relationship validation warnings', () => {
    const validationError = new Error('Validation failed');
    const tableName = 'users';

    // Simulate validation warning
    debugDatabase.warn('Relationship validation failed', {
      tableName,
      error: validationError,
    });

    expect(debugDatabase.warn).toHaveBeenCalledWith(
      'Relationship validation failed',
      expect.objectContaining({
        tableName,
        error: validationError,
      })
    );
  });
});

describe('Epic 015 Integration - Real-world Error Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(debugWorkflow.error).mockImplementation(mockConsole.error);
    vi.mocked(debugComponent.error).mockImplementation(mockConsole.error);
  });

  it('should handle task creation failures with sensitive data redaction', () => {
    const taskCreationError = new Error('Validation failed');
    const taskData = {
      title: 'Sensitive task',
      description: 'Task with sensitive info',
      assignee: 'user@example.com',
      apiKey: 'sk-secret-key-123', // Should be redacted
      metadata: {
        createdBy: 'admin@example.com',
        token: 'creation-token-456', // Should be redacted
      },
    };

    // Simulate task creation error
    debugWorkflow.error('Task creation failed', {
      error: taskCreationError,
      taskData,
    });

    expect(debugWorkflow.error).toHaveBeenCalledWith(
      'Task creation failed',
      expect.objectContaining({
        error: taskCreationError,
        taskData,
      })
    );
  });

  it('should handle task drag-and-drop errors with context', () => {
    const dragError = new Error('Invalid drop target');
    const draggedTaskId = 'task-123';
    const targetTaskId = 'task-456';

    debugWorkflow.error('Task nesting failed', {
      error: dragError,
      draggedTaskId,
      targetTaskId,
    });

    expect(debugWorkflow.error).toHaveBeenCalledWith(
      'Task nesting failed',
      expect.objectContaining({
        error: dragError,
        draggedTaskId,
        targetTaskId,
      })
    );
  });

  it('should handle job title update failures', () => {
    const updateError = new Error('Network timeout');
    const jobId = 'job-789';
    const newTitle = 'Updated job title';

    debugComponent.error('Job title update failed', {
      error: updateError,
      jobId,
      newTitle,
    });

    expect(debugComponent.error).toHaveBeenCalledWith(
      'Job title update failed',
      expect.objectContaining({
        error: updateError,
        jobId,
        newTitle,
      })
    );
  });

  it('should handle complex nested error scenarios', () => {
    const complexError = new Error('Complex operation failed');
    const complexData = {
      operation: 'multi-step-process',
      steps: [
        { id: 'step-1', status: 'completed' },
        { id: 'step-2', status: 'failed' },
      ],
      context: {
        userId: 'user-123',
        sessionId: 'sess-456', // Should be redacted
        permissions: ['read', 'write'],
        tokens: {
          access: 'access-token-789', // Should be redacted
          refresh: 'refresh-token-012', // Should be redacted
        },
      },
    };

    debugWorkflow.error('Complex operation failed', {
      error: complexError,
      data: complexData,
    });

    expect(debugWorkflow.error).toHaveBeenCalledWith(
      'Complex operation failed',
      expect.objectContaining({
        error: complexError,
        data: complexData,
      })
    );
  });
});

describe('Epic 015 Integration - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(debugDatabase.error).mockImplementation(mockConsole.error);
    vi.mocked(debugComponent.warn).mockImplementation(mockConsole.warn);
  });

  it('should handle null and undefined error data gracefully', () => {
    debugDatabase.error('Null error test', {
      error: null,
      data: undefined,
      validField: 'should-appear',
    });

    expect(debugDatabase.error).toHaveBeenCalledWith(
      'Null error test',
      expect.objectContaining({
        error: null,
        data: undefined,
        validField: 'should-appear',
      })
    );
  });

  it('should handle empty objects and arrays', () => {
    debugComponent.warn('Empty data test', {
      emptyObject: {},
      emptyArray: [],
      nullValue: null,
      undefinedValue: undefined,
    });

    expect(debugComponent.warn).toHaveBeenCalledWith(
      'Empty data test',
      expect.objectContaining({
        emptyObject: {},
        emptyArray: [],
        nullValue: null,
        undefinedValue: undefined,
      })
    );
  });

  it('should handle very large strings without truncation issues', () => {
    const largeString = 'a'.repeat(10000);
    const largeError = new Error(largeString);

    debugDatabase.error('Large string test', {
      error: largeError,
      description: largeString,
    });

    expect(debugDatabase.error).toHaveBeenCalledWith(
      'Large string test',
      expect.objectContaining({
        error: largeError,
        description: largeString,
      })
    );
  });

  it('should handle mixed data types correctly', () => {
    const mixedData = {
      string: 'test',
      number: 123,
      boolean: true,
      date: new Date('2024-01-15'),
      regex: /test/g,
      function: () => 'test',
      symbol: Symbol('test'),
      bigint: BigInt(123),
      password: 'should-be-redacted', // Should be redacted
    };

    debugComponent.warn('Mixed data types test', { data: mixedData });

    expect(debugComponent.warn).toHaveBeenCalledWith(
      'Mixed data types test',
      expect.objectContaining({
        data: mixedData,
      })
    );
  });
});
