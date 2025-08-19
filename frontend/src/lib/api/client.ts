import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  AxiosHeaders,
} from 'axios';
import { csrfTokenManager } from './csrf';
import { debugAPI } from '$lib/utils/debug';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { toastStore } from '$lib/stores/toast.svelte';

export interface RequestConfig extends AxiosRequestConfig {
  metadata?: {
    startTime: number;
  };
  _retry?: boolean;
  _retryCount?: number;
  skipAuth?: boolean;
  retryOnUnauthorized?: boolean;
}

export interface QueuedRequest {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  config: AxiosRequestConfig;
}

export class EnhancedApiClient {
  private axiosInstance: AxiosInstance;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<boolean> | null = null;
  private requestQueue: QueuedRequest[] = [];
  private readonly maxQueueSize = 100; // Prevent memory leaks
  private readonly maxRetries = 3;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: import.meta.env.PUBLIC_API_URL || 'http://localhost:4000/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      withCredentials: true, // Include cookies for authentication
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - Add CSRF tokens automatically
    this.axiosInstance.interceptors.request.use(
      this.handleRequest.bind(this),
      this.handleRequestError.bind(this)
    );

    // Response interceptor - Handle auth failures and token refresh
    this.axiosInstance.interceptors.response.use(
      this.handleResponse.bind(this),
      this.handleResponseError.bind(this)
    );
  }

  private async handleRequest(
    config: InternalAxiosRequestConfig
  ): Promise<InternalAxiosRequestConfig> {
    const requestConfig = config as RequestConfig;

    // Skip all authentication and CSRF handling for skipAuth requests
    if (requestConfig.skipAuth) {
      // Add request timing for performance monitoring
      (config as RequestConfig).metadata = {
        startTime: Date.now(),
      };
      return config;
    }

    // Ensure headers object exists and convert to AxiosHeaders if needed
    if (!config.headers) {
      config.headers = new AxiosHeaders();
    } else if (!(config.headers instanceof AxiosHeaders)) {
      // Convert plain object to AxiosHeaders
      const originalHeaders = config.headers;
      config.headers = new AxiosHeaders();
      for (const [key, value] of Object.entries(originalHeaders)) {
        config.headers.set(key, String(value));
      }
    }

    // Add CSRF token for state-changing requests
    const method = config.method?.toUpperCase() || '';
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      try {
        const csrfToken = await csrfTokenManager.getToken();

        if (csrfToken) {
          config.headers.set('X-CSRF-Token', csrfToken);
          debugAPI('Added CSRF token to request', {
            method: config.method,
            url: config.url,
            tokenPrefix: csrfToken.substring(0, 10) + '...',
          });
        } else {
          debugAPI('No CSRF token available for request', {
            method: config.method,
            url: config.url,
          });
        }
      } catch (error) {
        debugAPI('Failed to get CSRF token', {
          method: config.method,
          url: config.url,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue without CSRF token - let the server handle it
      }
    }

    // Add request timing for performance monitoring
    (config as RequestConfig).metadata = {
      startTime: Date.now(),
    };

    // Development logging
    if (import.meta.env.DEV) {
      debugAPI(`🚀 ${method} ${config.url}`, {
        headers: config.headers,
        data: config.data,
        timeout: config.timeout,
      });
    }

    return config;
  }

  private handleRequestError(error: unknown): Promise<never> {
    debugAPI('Request interceptor error', { error });
    return Promise.reject(error);
  }

  private handleResponse(response: AxiosResponse): AxiosResponse {
    // Update CSRF token from response headers
    csrfTokenManager.setTokenFromResponse(response);

    // Performance monitoring
    const endTime = Date.now();
    const startTime = (response.config as RequestConfig).metadata?.startTime || endTime;
    const duration = endTime - startTime;

    if (import.meta.env.DEV) {
      debugAPI(`✅ ${response.status} ${response.config.url}`, {
        status: response.status,
        data: response.data,
        duration: `${duration}ms`,
        headers: Object.fromEntries(Object.entries(response.headers)),
      });
    }

    return response;
  }

  private async handleResponseError(error: unknown): Promise<never> {
    const originalRequest = error.config;

    // Development logging
    if (import.meta.env.DEV) {
      const duration =
        Date.now() - ((originalRequest as RequestConfig)?.metadata?.startTime || Date.now());
      debugAPI(`❌ ${error.response?.status || 'Network Error'} ${originalRequest?.url}`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        duration: `${duration}ms`,
      });
    }

    // If there's no originalRequest, this is likely a network error
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized with automatic refresh (unless disabled)
    const requestConfig = originalRequest as RequestConfig;
    if (
      error.response?.status === 401 &&
      !(originalRequest as RequestConfig)._retry &&
      requestConfig.retryOnUnauthorized !== false
    ) {
      return this.handleAuthError(originalRequest, error);
    }

    // Handle 403 CSRF token errors
    if (error.response?.status === 403 && error.response?.data?.code === 'INVALID_CSRF_TOKEN') {
      return this.handleCsrfError(originalRequest, error);
    }

    // Handle 429 Rate Limiting
    if (error.response?.status === 429) {
      return this.handleRateLimitError(originalRequest, error);
    }

    // Handle 5xx Server Errors
    if (error.response?.status >= 500) {
      return this.handleServerError(originalRequest, error);
    }

    return Promise.reject(error);
  }

  private async handleAuthError(
    originalRequest: AxiosRequestConfig,
    error: unknown
  ): Promise<AxiosResponse> {
    // Prevent infinite retry loops
    (originalRequest as RequestConfig)._retry = true;

    // If we're already refreshing, queue this request
    if (this.isRefreshing) {
      return this.queueRequest(originalRequest);
    }

    // Start refresh process
    this.isRefreshing = true;

    try {
      const refreshSuccess = await this.performTokenRefresh();

      if (refreshSuccess) {
        // Process all queued requests
        this.processRequestQueue(true);

        // Retry original request
        return this.axiosInstance.request(originalRequest);
      } else {
        // Refresh failed - clear queue and redirect
        this.processRequestQueue(false);
        this.redirectToLogin();
        return Promise.reject(error);
      }
    } finally {
      this.isRefreshing = false;
    }
  }

  private queueRequest(config: AxiosRequestConfig): Promise<AxiosResponse> {
    return new Promise((resolve, reject) => {
      // Prevent memory leaks by limiting queue size
      if (this.requestQueue.length >= this.maxQueueSize) {
        reject(new Error('Request queue is full. Too many concurrent requests.'));
        return;
      }

      this.requestQueue.push({ resolve, reject, config });
    });
  }

  private processRequestQueue(success: boolean): void {
    const queue = [...this.requestQueue];
    this.requestQueue = [];

    queue.forEach(({ resolve, reject, config }) => {
      if (success) {
        resolve(this.axiosInstance.request(config));
      } else {
        reject(new Error('Token refresh failed'));
      }
    });
  }

  private clearRequestQueue(): void {
    this.requestQueue.forEach(({ reject }) => {
      reject(new Error('Authentication failed'));
    });
    this.requestQueue = [];
  }

  private async performTokenRefresh(): Promise<boolean> {
    try {
      debugAPI('Attempting auth token refresh...');

      // Get CSRF token first for the refresh request
      const csrfToken = await csrfTokenManager.getToken();

      // Call the auth refresh endpoint
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
      });

      if (response.ok) {
        debugAPI('Auth token refresh successful');
        return true;
      } else {
        // Don't log as error if it's a missing token (first login)
        if (response.status === 400) {
          const data = await response.json();
          if (data.errors?.[0]?.code === 'MISSING_TOKEN') {
            debugAPI('No refresh token available - likely during login transition');
            return false;
          }
        }
        debugAPI('Auth token refresh failed', { status: response.status });
        return false;
      }
    } catch (error) {
      debugAPI('Auth token refresh error', { error });
      return false;
    }
  }

  private async handleCsrfError(
    originalRequest: AxiosRequestConfig,
    error: unknown
  ): Promise<AxiosResponse> {
    debugAPI('CSRF token error - forcing refresh', { error: error.response?.data });

    try {
      // Force refresh CSRF token
      const newToken = await csrfTokenManager.forceRefresh();

      if (newToken) {
        // Ensure headers exist
        if (!originalRequest.headers) {
          originalRequest.headers = new AxiosHeaders();
        }
        // Update request headers with new token
        if (originalRequest.headers instanceof AxiosHeaders) {
          originalRequest.headers.set('X-CSRF-Token', newToken);
        } else {
          if (originalRequest.headers) {
            (originalRequest.headers as Record<string, string>)['X-CSRF-Token'] = newToken;
          }
        }

        // Retry request
        return this.axiosInstance.request(originalRequest);
      }
    } catch (refreshError) {
      debugAPI('CSRF token refresh failed', { refreshError });
    }

    return Promise.reject(error);
  }

  private async handleRateLimitError(
    originalRequest: AxiosRequestConfig,
    error: unknown
  ): Promise<AxiosResponse> {
    const retryAfter = error.response?.headers['retry-after'] || '5';
    const delayMs = isNaN(parseInt(retryAfter)) ? 5000 : parseInt(retryAfter) * 1000;

    debugAPI(`Rate limited - retrying after ${delayMs}ms`, {
      url: originalRequest.url,
      retryAfter,
    });

    // Show user-friendly message
    if (browser) {
      toastStore.warning('Please wait a moment before trying again');
    }

    // Wait and retry
    await this.delay(delayMs);
    return this.axiosInstance.request(originalRequest);
  }

  private async handleServerError(
    originalRequest: AxiosRequestConfig,
    error: unknown
  ): Promise<AxiosResponse> {
    const retryCount = (originalRequest as RequestConfig)._retryCount || 0;

    if (retryCount < this.maxRetries) {
      (originalRequest as RequestConfig)._retryCount = retryCount + 1;
      const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff

      debugAPI(`Server error - retrying (${retryCount + 1}/${this.maxRetries}) after ${delay}ms`, {
        url: originalRequest.url,
        status: error.response?.status,
        error: error.response?.data,
      });

      await this.delay(delay);
      return this.axiosInstance.request(originalRequest);
    }

    debugAPI('Max retries exceeded for server error', {
      url: originalRequest.url,
      retryCount,
    });

    return Promise.reject(error);
  }

  private redirectToLogin(): void {
    if (browser) {
      goto('/login');
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Public API methods
  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    const response = await this.axiosInstance.get(endpoint, config);
    return response.data;
  }

  async post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    const response = await this.axiosInstance.post(endpoint, data, config);
    return response.data;
  }

  async put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    const response = await this.axiosInstance.put(endpoint, data, config);
    return response.data;
  }

  async patch<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    const response = await this.axiosInstance.patch(endpoint, data, config);
    return response.data;
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    const response = await this.axiosInstance.delete(endpoint, config);
    return response.data;
  }
}

// Export singleton instance
export const api = new EnhancedApiClient();
