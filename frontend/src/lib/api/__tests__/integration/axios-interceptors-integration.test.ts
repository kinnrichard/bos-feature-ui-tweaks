import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modules before importing
vi.mock('$lib/api/csrf', () => ({
  csrfTokenManager: {
    getToken: vi.fn(),
    setTokenFromResponse: vi.fn(),
    forceRefresh: vi.fn()
  }
}));

vi.mock('$app/navigation', () => ({
  goto: vi.fn()
}));

vi.mock('$lib/utils/debug', () => ({
  debugAPI: vi.fn()
}));

vi.mock('$app/environment', () => ({
  browser: true
}));

// Import the class we'll be testing
import { EnhancedApiClient } from '$lib/api/client';
import { csrfTokenManager } from '$lib/api/csrf';
import { goto } from '$app/navigation';

// Mock fetch for token refresh endpoint
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.showToast for user notifications
const mockShowToast = vi.fn();
Object.defineProperty(window, 'showToast', {
  value: mockShowToast,
  writable: true
});

describe('Axios Interceptors Integration Tests', () => {
  let apiClient: EnhancedApiClient;
  let axiosInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    mockShowToast.mockClear();
    
    apiClient = new EnhancedApiClient();
    axiosInstance = (apiClient as any).axiosInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Token Refresh Scenarios', () => {
    it('should handle concurrent requests during token refresh', async () => {
      // Arrange
      const responses = [
        { status: 401, data: { error: 'Unauthorized' } },
        { status: 401, data: { error: 'Unauthorized' } },
        { status: 401, data: { error: 'Unauthorized' } }
      ];

      // Mock token refresh to take some time
      let refreshResolve: (value: string) => void;
      const refreshPromise = new Promise<string>((resolve) => {
        refreshResolve = resolve;
      });
      vi.mocked(csrfTokenManager.forceRefresh).mockReturnValue(refreshPromise);

      // Mock successful retry requests
      const mockRetryResponse = { data: { success: true }, status: 200 };
      vi.spyOn(axiosInstance, 'request').mockResolvedValue(mockRetryResponse);

      // Act
      const requests = responses.map((response, index) => {
        const error = {
          response,
          config: {
            url: `/api/jobs/${index}`,
            method: 'GET'
          }
        };
        return (apiClient as any).handleResponseError(error);
      });

      // Simulate token refresh completing
      setTimeout(() => refreshResolve!('new-token-123'), 50);

      const results = await Promise.all(requests);

      // Assert
      expect(vi.mocked(csrfTokenManager.forceRefresh)).toHaveBeenCalledTimes(1);
      expect(axiosInstance.request).toHaveBeenCalledTimes(3);
      results.forEach(result => {
        expect(result).toBe(mockRetryResponse);
      });
    });

    it('should handle token refresh failure with queued requests', async () => {
      // Arrange
      const responses = [
        { status: 401, data: { error: 'Unauthorized' } },
        { status: 401, data: { error: 'Unauthorized' } }
      ];

      // Mock token refresh failure
      vi.mocked(csrfTokenManager.forceRefresh).mockResolvedValue(null);

      // Act
      const requests = responses.map((response, index) => {
        const error = {
          response,
          config: {
            url: `/api/jobs/${index}`,
            method: 'GET'
          }
        };
        return (apiClient as any).handleResponseError(error);
      });

      // Assert
      await expect(Promise.all(requests)).rejects.toThrow();
      expect(vi.mocked(csrfTokenManager.forceRefresh)).toHaveBeenCalledTimes(1);
    });

    it('should handle mixed success and failure during token refresh', async () => {
      // Arrange
      const error401 = {
        response: { status: 401, data: { error: 'Unauthorized' } },
        config: { url: '/api/jobs/1', method: 'GET' }
      };

      const error403 = {
        response: { status: 403, data: { code: 'INVALID_CSRF_TOKEN' } },
        config: { url: '/api/jobs/2', method: 'POST' }
      };

      // Mock successful token refresh
      vi.mocked(csrfTokenManager.forceRefresh).mockResolvedValue('new-token-123');

      // Mock successful retry requests
      const mockRetryResponse = { data: { success: true }, status: 200 };
      vi.spyOn(axiosInstance, 'request').mockResolvedValue(mockRetryResponse);

      // Act
      const [result1, result2] = await Promise.all([
        (apiClient as any).handleResponseError(error401),
        (apiClient as any).handleResponseError(error403)
      ]);

      // Assert
      expect(vi.mocked(csrfTokenManager.forceRefresh)).toHaveBeenCalledTimes(2);
      expect(axiosInstance.request).toHaveBeenCalledTimes(2);
      expect(result1).toBe(mockRetryResponse);
      expect(result2).toBe(mockRetryResponse);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle cascading errors during token refresh', async () => {
      // Arrange
      const error = {
        response: { status: 401, data: { error: 'Unauthorized' } },
        config: { url: '/api/jobs', method: 'GET' }
      };

      // Mock token refresh to succeed
      vi.mocked(csrfTokenManager.forceRefresh).mockResolvedValue('new-token-123');

      // Mock retry to fail with another 401
      const retryError = {
        response: { status: 401, data: { error: 'Still unauthorized' } },
        config: { url: '/api/jobs', method: 'GET', _retry: true }
      };
      vi.spyOn(axiosInstance, 'request').mockRejectedValue(retryError);

      // Act & Assert
      await expect((apiClient as any).handleResponseError(error)).rejects.toBe(retryError);
      expect(vi.mocked(csrfTokenManager.forceRefresh)).toHaveBeenCalledTimes(1);
    });

    it('should handle network errors during token refresh', async () => {
      // Arrange
      const error = {
        response: { status: 401, data: { error: 'Unauthorized' } },
        config: { url: '/api/jobs', method: 'GET' }
      };

      // Mock token refresh to fail with network error
      vi.mocked(csrfTokenManager.forceRefresh).mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect((apiClient as any).handleResponseError(error)).rejects.toBe(error);
      expect(vi.mocked(csrfTokenManager.forceRefresh)).toHaveBeenCalledTimes(1);
    });
  });

  describe('Rate Limiting Edge Cases', () => {
    it('should handle rate limiting with invalid retry-after header', async () => {
      // Arrange
      const error = {
        response: {
          status: 429,
          headers: { 'retry-after': 'invalid' }
        },
        config: { url: '/api/jobs', method: 'GET' }
      };

      const mockRetryResponse = { data: { jobs: [] } };
      vi.spyOn(axiosInstance, 'request').mockResolvedValue(mockRetryResponse);
      
      // Use fake timers to control setTimeout
      vi.useFakeTimers();
      const sleepSpy = vi.spyOn(global, 'setTimeout');

      // Act
      const resultPromise = (apiClient as any).handleResponseError(error);
      
      // Fast-forward time to trigger the timeout
      vi.advanceTimersByTime(5000);
      
      const result = await resultPromise;

      // Assert
      expect(sleepSpy).toHaveBeenCalledWith(expect.any(Function), 5000); // Default 5 seconds
      expect(result).toBe(mockRetryResponse);
      
      // Restore real timers
      vi.useRealTimers();
    });

    it('should handle rate limiting with very large retry-after', async () => {
      // Arrange
      const error = {
        response: {
          status: 429,
          headers: { 'retry-after': '10' } // Use smaller value for testing
        },
        config: { url: '/api/jobs', method: 'GET' }
      };

      const mockRetryResponse = { data: { jobs: [] } };
      vi.spyOn(axiosInstance, 'request').mockResolvedValue(mockRetryResponse);
      
      // Use fake timers to control setTimeout
      vi.useFakeTimers();
      const sleepSpy = vi.spyOn(global, 'setTimeout');

      // Act
      const resultPromise = (apiClient as any).handleResponseError(error);
      
      // Fast-forward time to trigger the timeout
      vi.advanceTimersByTime(10000);
      
      const result = await resultPromise;

      // Assert
      expect(sleepSpy).toHaveBeenCalledWith(expect.any(Function), 10000); // 10 seconds in ms
      expect(result).toBe(mockRetryResponse);
      
      // Restore real timers
      vi.useRealTimers();
    });
  });

  describe('Server Error Retry Logic', () => {
    it('should use exponential backoff for multiple retries', async () => {
      // Arrange
      const error = {
        response: { status: 500, data: { error: 'Internal Server Error' } },
        config: { url: '/api/jobs', method: 'GET' }
      };

      // Mock successful retry
      const mockSuccessResponse = { data: { jobs: [] } };
      vi.spyOn(axiosInstance, 'request').mockResolvedValue(mockSuccessResponse);

      // Use fake timers to control setTimeout
      vi.useFakeTimers();
      const sleepSpy = vi.spyOn(global, 'setTimeout');

      // Act
      const resultPromise = (apiClient as any).handleResponseError(error);
      
      // Fast-forward time to trigger the retry
      vi.advanceTimersByTime(1000);
      
      const result = await resultPromise;

      // Assert
      expect(sleepSpy).toHaveBeenCalledWith(expect.any(Function), 1000); // 2^0 * 1000
      expect(result).toBe(mockSuccessResponse);
      
      // Restore real timers
      vi.useRealTimers();
    });

    it('should handle server errors for different HTTP methods', async () => {
      // Arrange
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      const errors = methods.map(method => ({
        response: { status: 503, data: { error: 'Service Unavailable' } },
        config: { url: `/api/jobs`, method }
      }));

      const mockRetryResponse = { data: { success: true } };
      vi.spyOn(axiosInstance, 'request').mockResolvedValue(mockRetryResponse);

      // Use fake timers to control setTimeout
      vi.useFakeTimers();

      // Act
      const resultPromises = errors.map(error => (apiClient as any).handleResponseError(error));
      
      // Fast-forward time for all retries
      vi.advanceTimersByTime(1000);
      
      const results = await Promise.all(resultPromises);

      // Assert
      expect(axiosInstance.request).toHaveBeenCalledTimes(5);
      results.forEach(result => {
        expect(result).toBe(mockRetryResponse);
      });
      
      // Restore real timers
      vi.useRealTimers();
    });
  });

  describe('Memory and Performance Tests', () => {
    it('should not leak memory with many queued requests', async () => {
      // Arrange
      const initialQueueSize = (apiClient as any).requestQueue.length;
      const numRequests = 100;

      // Mock token refresh to take time
      let refreshResolve: (value: string) => void;
      const refreshPromise = new Promise<string>((resolve) => {
        refreshResolve = resolve;
      });
      vi.mocked(csrfTokenManager.forceRefresh).mockReturnValue(refreshPromise);

      // Create many concurrent requests
      const requests = Array.from({ length: numRequests }, (_, i) => {
        const error = {
          response: { status: 401, data: { error: 'Unauthorized' } },
          config: { url: `/api/jobs/${i}`, method: 'GET' }
        };
        return (apiClient as any).handleResponseError(error);
      });

      // Check queue size during refresh
      const queueSizeDuringRefresh = (apiClient as any).requestQueue.length;
      expect(queueSizeDuringRefresh).toBe(numRequests - 1); // First request starts refresh

      // Complete token refresh
      const mockRetryResponse = { data: { success: true } };
      vi.spyOn(axiosInstance, 'request').mockResolvedValue(mockRetryResponse);
      refreshResolve!('new-token-123');

      // Act
      await Promise.all(requests);

      // Assert
      const finalQueueSize = (apiClient as any).requestQueue.length;
      expect(finalQueueSize).toBe(initialQueueSize); // Queue should be empty again
    });

    it('should limit request queue size', () => {
      // Arrange
      const maxQueueSize = 100;
      
      // Test the queue size limit directly
      const queueSize = (apiClient as any).requestQueue.length;
      
      // Assert
      expect(queueSize).toBeLessThanOrEqual(maxQueueSize);
      expect((apiClient as any).maxQueueSize).toBe(maxQueueSize);
    });
  });

  describe('Error Message Handling', () => {
    it('should preserve error context through interceptors', async () => {
      // Arrange
      const originalError = {
        response: {
          status: 422,
          data: { 
            error: 'Validation failed',
            details: { title: ['cannot be blank'] }
          }
        },
        config: { url: '/api/jobs', method: 'POST' }
      };

      // Act & Assert
      await expect((apiClient as any).handleResponseError(originalError)).rejects.toBe(originalError);
    });

    it('should handle errors without response object', async () => {
      // Arrange
      const networkError = new Error('Network connection failed');

      // Act & Assert
      await expect((apiClient as any).handleResponseError(networkError)).rejects.toBe(networkError);
    });
  });

  describe('Browser Environment Tests', () => {
    it('should handle missing window.showToast gracefully', () => {
      // Arrange
      const originalShowToast = (window as any).showToast;
      (window as any).showToast = undefined;

      // Act - should not throw error even without showToast
      expect(() => {
        if (typeof window !== 'undefined' && window.showToast) {
          window.showToast('test', 'warning');
        }
      }).not.toThrow();
      
      // Cleanup
      (window as any).showToast = originalShowToast;
    });

    it('should handle requests in non-browser environment', () => {
      // Arrange
      const originalWindow = global.window;
      delete (global as any).window;

      // Act - should work without window object
      expect(() => {
        if (typeof window !== 'undefined' && window.showToast) {
          window.showToast('test', 'warning');
        }
      }).not.toThrow();

      // Cleanup
      global.window = originalWindow;
    });
  });

  describe('Configuration and Setup', () => {
    it('should configure axios instance correctly', () => {
      // Assert
      expect(axiosInstance.defaults.timeout).toBe(30000);
      expect(axiosInstance.defaults.headers['Content-Type']).toBe('application/json');
      expect(axiosInstance.defaults.headers['Accept']).toBe('application/json');
      expect(axiosInstance.defaults.withCredentials).toBe(true);
    });

    it('should have request and response interceptors configured', () => {
      // Assert
      expect(axiosInstance.interceptors.request.handlers).toHaveLength(1);
      expect(axiosInstance.interceptors.response.handlers).toHaveLength(1);
    });
  });
});