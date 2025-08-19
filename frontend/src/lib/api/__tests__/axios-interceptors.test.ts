import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios, { AxiosHeaders } from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

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

describe('EnhancedApiClient - Axios Interceptors', () => {
  let apiClient: EnhancedApiClient;
  let axiosInstance: AxiosInstance;
  
  beforeEach(() => {
    vi.clearAllMocks();
    apiClient = new EnhancedApiClient();
    axiosInstance = (apiClient as any).axiosInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Request Interceptor', () => {
    describe('CSRF Token Injection', () => {
      it('should add CSRF token to POST requests', async () => {
        // Arrange
        const mockToken = 'csrf-token-123';
        vi.mocked(csrfTokenManager.getToken).mockResolvedValue(mockToken);
        
        const config: AxiosRequestConfig = {
          method: 'POST',
          url: '/api/jobs',
          data: { title: 'Test Job' }
        };

        // Act
        const processedConfig = await (apiClient as any).handleRequest(config);

        // Assert
        expect(csrfTokenManager.getToken).toHaveBeenCalledTimes(1);
        expect(processedConfig.headers).toEqual(
          expect.objectContaining({
            'X-CSRF-Token': mockToken
          })
        );
      });

      it('should add CSRF token to PUT requests', async () => {
        // Arrange
        const mockToken = 'csrf-token-456';
        vi.mocked(csrfTokenManager.getToken).mockResolvedValue(mockToken);
        
        const config: AxiosRequestConfig = {
          method: 'PUT',
          url: '/api/jobs/123',
          data: { title: 'Updated Job' }
        };

        // Act
        const processedConfig = await (apiClient as any).handleRequest(config);

        // Assert
        expect(processedConfig.headers['X-CSRF-Token']).toBe(mockToken);
      });

      it('should add CSRF token to PATCH requests', async () => {
        // Arrange
        const mockToken = 'csrf-token-789';
        vi.mocked(csrfTokenManager.getToken).mockResolvedValue(mockToken);
        
        const config: AxiosRequestConfig = {
          method: 'PATCH',
          url: '/api/jobs/123',
          data: { status: 'completed' }
        };

        // Act
        const processedConfig = await (apiClient as any).handleRequest(config);

        // Assert
        expect(processedConfig.headers['X-CSRF-Token']).toBe(mockToken);
      });

      it('should add CSRF token to DELETE requests', async () => {
        // Arrange
        const mockToken = 'csrf-token-delete';
        vi.mocked(csrfTokenManager.getToken).mockResolvedValue(mockToken);
        
        const config: AxiosRequestConfig = {
          method: 'DELETE',
          url: '/api/jobs/123'
        };

        // Act
        const processedConfig = await (apiClient as any).handleRequest(config);

        // Assert
        expect(processedConfig.headers['X-CSRF-Token']).toBe(mockToken);
      });

      it('should NOT add CSRF token to GET requests', async () => {
        // Arrange
        const config: AxiosRequestConfig = {
          method: 'GET',
          url: '/api/jobs'
        };

        // Act
        const processedConfig = await (apiClient as any).handleRequest(config);

        // Assert
        expect(csrfTokenManager.getToken).not.toHaveBeenCalled();
        expect(processedConfig.headers).not.toHaveProperty('X-CSRF-Token');
      });

      it('should handle missing CSRF token gracefully', async () => {
        // Arrange
        vi.mocked(csrfTokenManager.getToken).mockResolvedValue(null);
        
        const config: AxiosRequestConfig = {
          method: 'POST',
          url: '/api/jobs',
          data: { title: 'Test Job' }
        };

        // Act
        const processedConfig = await (apiClient as any).handleRequest(config);

        // Assert
        expect(processedConfig.headers).not.toHaveProperty('X-CSRF-Token');
      });

      it('should handle CSRF token manager errors gracefully', async () => {
        // Arrange
        vi.mocked(csrfTokenManager.getToken).mockRejectedValue(new Error('Token fetch failed'));
        
        const config: AxiosRequestConfig = {
          method: 'POST',
          url: '/api/jobs',
          data: { title: 'Test Job' }
        };

        // Act
        const processedConfig = await (apiClient as any).handleRequest(config);

        // Assert - should continue without CSRF token
        expect(processedConfig.headers).not.toHaveProperty('X-CSRF-Token');
        expect(processedConfig.metadata).toHaveProperty('startTime');
      });
    });

    describe('Request Metadata', () => {
      it('should add timing metadata to requests', async () => {
        // Arrange
        const config: AxiosRequestConfig = {
          method: 'GET',
          url: '/api/jobs'
        };

        // Act
        const processedConfig = await (apiClient as any).handleRequest(config);

        // Assert
        expect(processedConfig.metadata).toHaveProperty('startTime');
        expect(typeof processedConfig.metadata.startTime).toBe('number');
      });

      it('should preserve existing headers', async () => {
        // Arrange
        const mockToken = 'csrf-token-123';
        vi.mocked(csrfTokenManager.getToken).mockResolvedValue(mockToken);
        
        const config: AxiosRequestConfig = {
          method: 'POST',
          url: '/api/jobs',
          headers: {
            'Custom-Header': 'custom-value',
            'Accept': 'application/json'
          }
        };

        // Act
        const processedConfig = await (apiClient as any).handleRequest(config);

        // Assert
        expect(processedConfig.headers.get('Custom-Header')).toBe('custom-value');
        expect(processedConfig.headers.get('Accept')).toBe('application/json');
        expect(processedConfig.headers.get('X-CSRF-Token')).toBe(mockToken);
      });
    });
  });

  describe('Response Interceptor', () => {
    describe('Success Response Handling', () => {
      it('should update CSRF token from response headers', () => {
        // Arrange
        const mockResponse: AxiosResponse = {
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: { 'x-csrf-token': 'new-token-123' },
          config: { 
            url: '/api/jobs',
            headers: new AxiosHeaders(),
            metadata: { startTime: Date.now() - 100 }
          } as any
        };

        // Act
        const processedResponse = (apiClient as any).handleResponse(mockResponse);

        // Assert
        expect(csrfTokenManager.setTokenFromResponse).toHaveBeenCalledWith(mockResponse);
        expect(processedResponse).toBe(mockResponse);
      });

      it('should handle responses without metadata', () => {
        // Arrange
        const mockResponse: AxiosResponse = {
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: { 
            url: '/api/jobs',
            headers: new AxiosHeaders()
          } as any
        };

        // Act
        const processedResponse = (apiClient as any).handleResponse(mockResponse);

        // Assert
        expect(processedResponse).toBe(mockResponse);
      });
    });

    describe('401 Authentication Error Handling', () => {
      it('should handle 401 error with successful token refresh', async () => {
        // Arrange
        const mockError = {
          response: {
            status: 401,
            data: { error: 'Unauthorized' }
          },
          config: {
            url: '/api/jobs',
            method: 'GET'
          }
        };

        vi.mocked(csrfTokenManager.forceRefresh).mockResolvedValue('new-token-123');
        
        // Mock axios request to return success after retry
        const mockRetryResponse = { data: { jobs: [] } };
        vi.spyOn(axiosInstance, 'request').mockResolvedValue(mockRetryResponse);

        // Act
        const result = await (apiClient as any).handleResponseError(mockError);

        // Assert
        expect(csrfTokenManager.forceRefresh).toHaveBeenCalledTimes(1);
        expect(axiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/api/jobs',
            method: 'GET',
            _retry: true
          })
        );
        expect(result).toBe(mockRetryResponse);
      });

      it('should handle 401 error with failed token refresh', async () => {
        // Arrange
        const mockError = {
          response: {
            status: 401,
            data: { error: 'Unauthorized' }
          },
          config: {
            url: '/api/jobs',
            method: 'GET'
          }
        };

        vi.mocked(csrfTokenManager.forceRefresh).mockResolvedValue(null);

        // Act & Assert
        await expect((apiClient as any).handleResponseError(mockError)).rejects.toBe(mockError);
        expect(goto).toHaveBeenCalledWith('/login');
      });

      it('should not retry 401 errors that have already been retried', async () => {
        // Arrange
        const mockError = {
          response: {
            status: 401,
            data: { error: 'Unauthorized' }
          },
          config: {
            url: '/api/jobs',
            method: 'GET',
            _retry: true
          }
        };

        // Act & Assert
        await expect((apiClient as any).handleResponseError(mockError)).rejects.toBe(mockError);
        expect(csrfTokenManager.forceRefresh).not.toHaveBeenCalled();
      });
    });

    describe('Request Queue Management', () => {
      it('should queue requests during token refresh', async () => {
        // Arrange
        const mockError1 = {
          response: { status: 401 },
          config: { url: '/api/jobs/1', method: 'GET' }
        };
        const mockError2 = {
          response: { status: 401 },
          config: { url: '/api/jobs/2', method: 'GET' }
        };

        vi.mocked(csrfTokenManager.forceRefresh).mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve('new-token'), 100))
        );

        vi.spyOn(axiosInstance, 'request').mockResolvedValue({ data: { success: true } });

        // Act
        const [result1, result2] = await Promise.all([
          (apiClient as any).handleResponseError(mockError1),
          (apiClient as any).handleResponseError(mockError2)
        ]);

        // Assert
        expect(csrfTokenManager.forceRefresh).toHaveBeenCalledTimes(1);
        expect(axiosInstance.request).toHaveBeenCalledTimes(2);
        expect(result1.data.success).toBe(true);
        expect(result2.data.success).toBe(true);
      });

      it('should reject queued requests when token refresh fails', async () => {
        // Arrange
        const mockError1 = {
          response: { status: 401 },
          config: { url: '/api/jobs/1', method: 'GET' }
        };
        const mockError2 = {
          response: { status: 401 },
          config: { url: '/api/jobs/2', method: 'GET' }
        };

        vi.mocked(csrfTokenManager.forceRefresh).mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve(null), 100))
        );

        // Act & Assert
        await expect(Promise.all([
          (apiClient as any).handleResponseError(mockError1),
          (apiClient as any).handleResponseError(mockError2)
        ])).rejects.toThrow();
      });
    });

    describe('403 CSRF Token Error Handling', () => {
      it('should handle CSRF token errors with successful refresh', async () => {
        // Arrange
        const mockError = {
          response: {
            status: 403,
            data: { code: 'INVALID_CSRF_TOKEN' }
          },
          config: {
            url: '/api/jobs',
            method: 'POST',
            headers: { 'X-CSRF-Token': 'old-token' }
          }
        };

        vi.mocked(csrfTokenManager.forceRefresh).mockResolvedValue('new-csrf-token');
        
        const mockRetryResponse = { data: { success: true } };
        vi.spyOn(axiosInstance, 'request').mockResolvedValue(mockRetryResponse);

        // Act
        const result = await (apiClient as any).handleResponseError(mockError);

        // Assert
        expect(csrfTokenManager.forceRefresh).toHaveBeenCalledTimes(1);
        expect(axiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-CSRF-Token': 'new-csrf-token'
            })
          })
        );
        expect(result).toBe(mockRetryResponse);
      });

      it('should handle CSRF token refresh failure', async () => {
        // Arrange
        const mockError = {
          response: {
            status: 403,
            data: { code: 'INVALID_CSRF_TOKEN' }
          },
          config: {
            url: '/api/jobs',
            method: 'POST',
            headers: { 'X-CSRF-Token': 'old-token' }
          }
        };

        vi.mocked(csrfTokenManager.forceRefresh).mockRejectedValue(new Error('Refresh failed'));

        // Act & Assert
        await expect((apiClient as any).handleResponseError(mockError)).rejects.toBe(mockError);
      });
    });

    describe('429 Rate Limiting Handling', () => {
      it('should handle rate limiting with retry-after header', async () => {
        // Arrange
        const mockError = {
          response: {
            status: 429,
            headers: { 'retry-after': '2' }
          },
          config: {
            url: '/api/jobs',
            method: 'GET'
          }
        };

        const mockRetryResponse = { data: { jobs: [] } };
        vi.spyOn(axiosInstance, 'request').mockResolvedValue(mockRetryResponse);
        
        const sleepSpy = vi.spyOn(global, 'setTimeout');

        // Act
        const result = await (apiClient as any).handleResponseError(mockError);

        // Assert
        expect(sleepSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
        expect(axiosInstance.request).toHaveBeenCalledWith(mockError.config);
        expect(result).toBe(mockRetryResponse);
      });

      it('should handle rate limiting without retry-after header', async () => {
        // Arrange
        const mockError = {
          response: {
            status: 429,
            headers: {}
          },
          config: {
            url: '/api/jobs',
            method: 'GET'
          }
        };

        const mockRetryResponse = { data: { jobs: [] } };
        vi.spyOn(axiosInstance, 'request').mockResolvedValue(mockRetryResponse);
        
        // Use fake timers to control setTimeout
        vi.useFakeTimers();
        const sleepSpy = vi.spyOn(global, 'setTimeout');

        // Act
        const resultPromise = (apiClient as any).handleResponseError(mockError);
        
        // Fast-forward time to trigger the timeout
        vi.advanceTimersByTime(5000);
        
        const result = await resultPromise;

        // Assert
        expect(sleepSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
        expect(result).toBe(mockRetryResponse);
        
        // Restore real timers
        vi.useRealTimers();
      });
    });

    describe('5xx Server Error Handling', () => {
      it('should retry server errors with exponential backoff', async () => {
        // Arrange
        const mockError = {
          response: {
            status: 500,
            data: { error: 'Internal Server Error' }
          },
          config: {
            url: '/api/jobs',
            method: 'GET'
          }
        };

        const mockRetryResponse = { data: { jobs: [] } };
        vi.spyOn(axiosInstance, 'request').mockResolvedValue(mockRetryResponse);
        
        const sleepSpy = vi.spyOn(global, 'setTimeout');

        // Act
        const result = await (apiClient as any).handleResponseError(mockError);

        // Assert
        expect(sleepSpy).toHaveBeenCalledWith(expect.any(Function), 1000); // 2^0 * 1000
        expect(axiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({
            url: '/api/jobs',
            method: 'GET',
            _retryCount: 1
          })
        );
        expect(result).toBe(mockRetryResponse);
      });

      it('should stop retrying after max retries', async () => {
        // Arrange
        const mockError = {
          response: {
            status: 500,
            data: { error: 'Internal Server Error' }
          },
          config: {
            url: '/api/jobs',
            method: 'GET',
            _retryCount: 3
          }
        };

        // Create a spy for the axios request method
        const requestSpy = vi.spyOn(axiosInstance, 'request');

        // Act & Assert
        await expect((apiClient as any).handleResponseError(mockError)).rejects.toBe(mockError);
        expect(requestSpy).not.toHaveBeenCalled();
      });
    });

    describe('Network Error Handling', () => {
      it('should handle network errors', async () => {
        // Arrange
        const networkError = new Error('Network Error');
        networkError.name = 'NetworkError';

        // Act & Assert
        await expect((apiClient as any).handleResponseError(networkError)).rejects.toBe(networkError);
      });

      it('should handle timeout errors', async () => {
        // Arrange
        const timeoutError = new Error('Timeout');
        timeoutError.name = 'TimeoutError';

        // Act & Assert
        await expect((apiClient as any).handleResponseError(timeoutError)).rejects.toBe(timeoutError);
      });
    });
  });

  describe('Public API Methods', () => {
    beforeEach(() => {
      // Mock axios instance methods
      vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { jobs: [] } });
      vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { job: { id: 1 } } });
      vi.spyOn(axiosInstance, 'put').mockResolvedValue({ data: { job: { id: 1 } } });
      vi.spyOn(axiosInstance, 'patch').mockResolvedValue({ data: { job: { id: 1 } } });
      vi.spyOn(axiosInstance, 'delete').mockResolvedValue({ data: { success: true } });
    });

    it('should make GET requests through interceptors', async () => {
      // Act
      const result = await apiClient.get('/api/jobs');

      // Assert
      expect(axiosInstance.get).toHaveBeenCalledWith('/api/jobs', undefined);
      expect(result).toEqual({ jobs: [] });
    });

    it('should make POST requests through interceptors', async () => {
      // Act
      const result = await apiClient.post('/api/jobs', { title: 'New Job' });

      // Assert
      expect(axiosInstance.post).toHaveBeenCalledWith('/api/jobs', { title: 'New Job' }, undefined);
      expect(result).toEqual({ job: { id: 1 } });
    });

    it('should make PUT requests through interceptors', async () => {
      // Act
      const result = await apiClient.put('/api/jobs/1', { title: 'Updated Job' });

      // Assert
      expect(axiosInstance.put).toHaveBeenCalledWith('/api/jobs/1', { title: 'Updated Job' }, undefined);
      expect(result).toEqual({ job: { id: 1 } });
    });

    it('should make PATCH requests through interceptors', async () => {
      // Act
      const result = await apiClient.patch('/api/jobs/1', { status: 'completed' });

      // Assert
      expect(axiosInstance.patch).toHaveBeenCalledWith('/api/jobs/1', { status: 'completed' }, undefined);
      expect(result).toEqual({ job: { id: 1 } });
    });

    it('should make DELETE requests through interceptors', async () => {
      // Act
      const result = await apiClient.delete('/api/jobs/1');

      // Assert
      expect(axiosInstance.delete).toHaveBeenCalledWith('/api/jobs/1', undefined);
      expect(result).toEqual({ success: true });
    });
  });

  describe('Error Boundary Tests', () => {
    it('should handle malformed responses gracefully', async () => {
      // Arrange
      const mockError = {
        response: {
          status: 500,
          data: 'Not JSON'
        },
        config: {
          url: '/api/jobs',
          method: 'GET'
        }
      };

      // Mock axios request to fail with server error but eventually succeed
      const mockRetryResponse = { data: { jobs: [] } };
      vi.spyOn(axiosInstance, 'request').mockResolvedValue(mockRetryResponse);
      
      // Use fake timers to control setTimeout
      vi.useFakeTimers();

      // Act
      const resultPromise = (apiClient as any).handleResponseError(mockError);
      
      // Fast-forward time to trigger the retry
      vi.advanceTimersByTime(1000);
      
      const result = await resultPromise;

      // Assert - should retry and succeed
      expect(result).toBe(mockRetryResponse);
      
      // Restore real timers
      vi.useRealTimers();
    });

    it('should handle undefined response data', async () => {
      // Arrange
      const mockError = {
        response: {
          status: 500,
          data: undefined
        },
        config: {
          url: '/api/jobs',
          method: 'GET'
        }
      };

      // Mock axios request to fail with server error but eventually succeed
      const mockRetryResponse = { data: { jobs: [] } };
      vi.spyOn(axiosInstance, 'request').mockResolvedValue(mockRetryResponse);
      
      // Use fake timers to control setTimeout
      vi.useFakeTimers();

      // Act
      const resultPromise = (apiClient as any).handleResponseError(mockError);
      
      // Fast-forward time to trigger the retry
      vi.advanceTimersByTime(1000);
      
      const result = await resultPromise;

      // Assert - should retry and succeed
      expect(result).toBe(mockRetryResponse);
      
      // Restore real timers
      vi.useRealTimers();
    });
  });
});