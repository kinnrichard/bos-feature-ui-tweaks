# Epic-016: Implement Axios Interceptors for Seamless Token Management

## Epic Overview

**Epic ID**: Epic-016  
**Title**: Implement Axios Interceptors for Seamless Token Management  
**Status**: Draft  
**Priority**: High  
**Estimated Effort**: 8-12 hours  
**Sprint**: To be determined  

### Business Value

Currently, users experience authentication interruptions when tokens expire during active work sessions. This epic implements axios interceptors to provide seamless token refresh, eliminating authentication disruptions and improving user experience.

**Key Benefits:**
- **Eliminate auth interruptions** - Users never lose work due to token expiry
- **Improve productivity** - Seamless background token refresh
- **Reduce support burden** - Fewer authentication-related issues
- **Enhance security** - Proper token lifecycle management
- **Better developer experience** - DRY authentication logic

### Success Metrics

- **Zero authentication interruptions** during active user sessions
- **100% transparent token refresh** - users don't notice token renewals
- **Reduced auth-related errors** by 95%
- **Improved session reliability** - no lost work due to expired tokens
- **Code reduction** - 80% less repetitive authentication logic

## Current State Analysis

### Existing Architecture

**Current Authentication Flow:**
```typescript
// Current ApiClient implementation
class ApiClient {
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<boolean> | null = null;
  private requestQueue: Array<() => void> = [];
  
  // Manual token refresh logic in every request
  private async request<T>(endpoint: string, config: RequestConfig = {}) {
    // 1. Get CSRF token manually
    // 2. Add to headers manually
    // 3. Handle 401 with redirect to login
    // 4. No automatic retry logic
  }
}
```

**Problems with Current Approach:**
1. **Manual token management** - Each request requires manual CSRF token handling
2. **No automatic refresh** - 401 errors cause immediate redirect to login
3. **No request queueing** - Concurrent requests during refresh fail
4. **Repetitive logic** - Token handling duplicated across methods
5. **Poor user experience** - Users lose work when tokens expire

### Current Token Architecture

**CSRF Token Management:**
- ✅ **Sophisticated CsrfTokenManager** with proactive refresh
- ✅ **Request queueing** for concurrent token requests
- ✅ **Multiple token sources** (meta tag, API)
- ✅ **4-minute cache duration** with 2-minute refresh threshold

**Authentication Flow:**
- ✅ **Cookie-based authentication** for session management
- ✅ **CSRF tokens** for state-changing operations
- ❌ **No automatic refresh** - relies on manual redirect
- ❌ **No request retry** - failed requests are not retried

## Technical Implementation

### Phase 1: Axios Integration Setup

**1.1 Install Dependencies**
```bash
npm install axios
npm install --save-dev @types/axios
```

**1.2 Create Enhanced API Client**
```typescript
// src/lib/api/enhanced-client.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { csrfTokenManager } from './csrf';
import { debugAPI } from '$lib/utils/debug';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';

export class EnhancedApiClient {
  private axiosInstance: AxiosInstance;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<boolean> | null = null;
  private requestQueue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
    config: AxiosRequestConfig;
  }> = [];

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: import.meta.env.PUBLIC_API_URL || 'http://localhost:3000/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      withCredentials: true, // Include cookies for authentication
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
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

  // ... Implementation details in sections below
}
```

### Phase 2: Request Interceptor Implementation

**2.1 Automatic CSRF Token Injection**
```typescript
private async handleRequest(config: AxiosRequestConfig): Promise<AxiosRequestConfig> {
  // Add CSRF token for state-changing requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method?.toUpperCase() || '')) {
    const csrfToken = await csrfTokenManager.getToken();
    
    if (csrfToken) {
      config.headers = {
        ...config.headers,
        'X-CSRF-Token': csrfToken
      };
      debugAPI('Added CSRF token to request', { 
        method: config.method, 
        url: config.url,
        tokenPrefix: csrfToken.substring(0, 10) + '...' 
      });
    } else {
      debugAPI('No CSRF token available for request', { 
        method: config.method, 
        url: config.url 
      });
    }
  }

  // Add request timing for performance monitoring
  config.metadata = {
    startTime: Date.now()
  };

  return config;
}

private handleRequestError(error: any): Promise<any> {
  debugAPI('Request interceptor error', { error });
  return Promise.reject(error);
}
```

**2.2 Development & Debugging Features**
```typescript
private async handleRequest(config: AxiosRequestConfig): Promise<AxiosRequestConfig> {
  // ... CSRF token logic above ...

  // Development logging
  if (import.meta.env.DEV) {
    debugAPI(`🚀 ${config.method?.toUpperCase()} ${config.url}`, {
      headers: config.headers,
      data: config.data,
      timeout: config.timeout
    });
  }

  return config;
}
```

### Phase 3: Response Interceptor Implementation

**3.1 Success Response Handling**
```typescript
private handleResponse(response: AxiosResponse): AxiosResponse {
  // Update CSRF token from response headers
  csrfTokenManager.setTokenFromResponse(response);

  // Performance monitoring
  const endTime = Date.now();
  const startTime = response.config.metadata?.startTime || endTime;
  const duration = endTime - startTime;

  if (import.meta.env.DEV) {
    debugAPI(`✅ ${response.status} ${response.config.url}`, {
      status: response.status,
      data: response.data,
      duration: `${duration}ms`,
      headers: Object.fromEntries(response.headers)
    });
  }

  return response;
}
```

**3.2 Error Response Handling with Automatic Refresh**
```typescript
private async handleResponseError(error: any): Promise<any> {
  const originalRequest = error.config;
  
  // Development logging
  if (import.meta.env.DEV) {
    const duration = Date.now() - (originalRequest.metadata?.startTime || Date.now());
    debugAPI(`❌ ${error.response?.status || 'Network Error'} ${originalRequest.url}`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      duration: `${duration}ms`
    });
  }

  // Handle 401 Unauthorized with automatic refresh
  if (error.response?.status === 401 && !originalRequest._retry) {
    return this.handleAuthError(originalRequest, error);
  }

  // Handle 403 CSRF token errors
  if (error.response?.status === 403 && 
      error.response?.data?.code === 'INVALID_CSRF_TOKEN') {
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
```

### Phase 4: Request Queue Management

**4.1 Authentication Error Handling**
```typescript
private async handleAuthError(originalRequest: AxiosRequestConfig, error: any): Promise<any> {
  // Prevent infinite retry loops
  originalRequest._retry = true;

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

private queueRequest(config: AxiosRequestConfig): Promise<any> {
  return new Promise((resolve, reject) => {
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
```

**4.2 Token Refresh Implementation**
```typescript
private async performTokenRefresh(): Promise<boolean> {
  try {
    debugAPI('Attempting token refresh...');
    
    // Use existing CSRF token manager for refresh
    const newToken = await csrfTokenManager.forceRefresh();
    
    if (newToken) {
      debugAPI('Token refresh successful');
      return true;
    } else {
      debugAPI('Token refresh failed - no new token received');
      return false;
    }
  } catch (error) {
    debugAPI('Token refresh error', { error });
    return false;
  }
}
```

### Phase 5: Error Handling Strategies

**5.1 CSRF Token Error Recovery**
```typescript
private async handleCsrfError(originalRequest: AxiosRequestConfig, error: any): Promise<any> {
  debugAPI('CSRF token error - forcing refresh', { error: error.response?.data });
  
  try {
    // Force refresh CSRF token
    const newToken = await csrfTokenManager.forceRefresh();
    
    if (newToken) {
      // Update request headers with new token
      originalRequest.headers = {
        ...originalRequest.headers,
        'X-CSRF-Token': newToken
      };
      
      // Retry request
      return this.axiosInstance.request(originalRequest);
    }
  } catch (refreshError) {
    debugAPI('CSRF token refresh failed', { refreshError });
  }
  
  return Promise.reject(error);
}
```

**5.2 Rate Limiting Handling**
```typescript
private async handleRateLimitError(originalRequest: AxiosRequestConfig, error: any): Promise<any> {
  const retryAfter = error.response?.headers['retry-after'] || 5;
  const delayMs = parseInt(retryAfter) * 1000;
  
  debugAPI(`Rate limited - retrying after ${delayMs}ms`, { 
    url: originalRequest.url,
    retryAfter 
  });
  
  // Show user-friendly message
  if (typeof window !== 'undefined' && window.showToast) {
    window.showToast('Please wait a moment before trying again', 'warning');
  }
  
  // Wait and retry
  await new Promise(resolve => setTimeout(resolve, delayMs));
  return this.axiosInstance.request(originalRequest);
}
```

**5.3 Server Error Handling**
```typescript
private async handleServerError(originalRequest: AxiosRequestConfig, error: any): Promise<any> {
  const maxRetries = 3;
  const retryCount = originalRequest._retryCount || 0;
  
  if (retryCount < maxRetries) {
    originalRequest._retryCount = retryCount + 1;
    const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
    
    debugAPI(`Server error - retrying (${retryCount + 1}/${maxRetries}) after ${delay}ms`, {
      url: originalRequest.url,
      status: error.response?.status,
      error: error.response?.data
    });
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return this.axiosInstance.request(originalRequest);
  }
  
  debugAPI('Max retries exceeded for server error', { 
    url: originalRequest.url,
    retryCount 
  });
  
  return Promise.reject(error);
}
```

### Phase 6: Integration with Existing Code

**6.1 API Client Migration**
```typescript
// src/lib/api/client.ts - Enhanced version
import { EnhancedApiClient } from './enhanced-client';

class ApiClient extends EnhancedApiClient {
  // Keep existing public API methods
  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    const response = await this.axiosInstance.get(endpoint, config);
    return response.data;
  }

  async post<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<T> {
    const response = await this.axiosInstance.post(endpoint, data, config);
    return response.data;
  }

  async put<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<T> {
    const response = await this.axiosInstance.put(endpoint, data, config);
    return response.data;
  }

  async patch<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<T> {
    const response = await this.axiosInstance.patch(endpoint, data, config);
    return response.data;
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    const response = await this.axiosInstance.delete(endpoint, config);
    return response.data;
  }
}

// Export singleton instance
export const api = new ApiClient();
```

**6.2 Zero.js Integration**
```typescript
// src/lib/zero/zero-client.ts - Enhanced integration
import { api } from '$lib/api/client';

// Use enhanced API client for Zero.js auth calls
async function getAuthToken(): Promise<string> {
  try {
    const response = await api.get('/auth/token');
    return response.token;
  } catch (error) {
    // Enhanced error handling will automatically retry with fresh tokens
    throw error;
  }
}

// Enhanced Zero client initialization
export async function initializeZero(): Promise<ZeroClient> {
  try {
    const token = await getAuthToken();
    
    // Zero.js initialization with token
    const zero = new Zero({
      server: import.meta.env.PUBLIC_ZERO_SERVER_URL,
      userID: await getUserId(),
      auth: token,
      schema,
      kvStore: 'mem'
    });
    
    return zero;
  } catch (error) {
    debugAuth('Zero initialization failed', { error });
    throw error;
  }
}
```

## Zero.js Integration Strategy

### Coordination with Real-Time Connection

**Enhanced Connection Management:**
```typescript
// src/lib/zero/enhanced-zero-client.ts
import { api } from '$lib/api/client';
import { EnhancedApiClient } from '$lib/api/enhanced-client';

class EnhancedZeroClient {
  private zero: ZeroClient | null = null;
  private apiClient: EnhancedApiClient;
  
  constructor() {
    this.apiClient = api;
  }
  
  async initializeWithTokenRefresh(): Promise<ZeroClient> {
    // Use enhanced API client for authentication
    const authData = await this.apiClient.get('/auth/zero-token');
    
    this.zero = new Zero({
      server: import.meta.env.PUBLIC_ZERO_SERVER_URL,
      userID: authData.userId,
      auth: authData.token,
      schema,
      kvStore: 'mem'
    });
    
    // Setup token refresh coordination
    this.setupTokenRefreshCoordination();
    
    return this.zero;
  }
  
  private setupTokenRefreshCoordination(): void {
    // Listen for API client token refresh events
    this.apiClient.on('tokenRefreshed', async (newToken) => {
      // Update Zero.js connection with new token
      if (this.zero) {
        await this.zero.updateAuth(newToken);
      }
    });
  }
}
```

### Handling Connection State

**Synchronized Connection Management:**
```typescript
// Coordinate API and Zero.js connection states
class ConnectionManager {
  private apiClient: EnhancedApiClient;
  private zeroClient: EnhancedZeroClient;
  private connectionState: 'connected' | 'disconnected' | 'refreshing' = 'disconnected';
  
  async handleTokenRefresh(): Promise<void> {
    this.connectionState = 'refreshing';
    
    try {
      // 1. Refresh API tokens (handled by axios interceptors)
      // 2. Update Zero.js connection
      await this.zeroClient.refreshConnection();
      
      this.connectionState = 'connected';
    } catch (error) {
      this.connectionState = 'disconnected';
      throw error;
    }
  }
}
```

## Testing Strategy

### Unit Tests

**Test Coverage Requirements:**
- ✅ Request interceptor adds CSRF tokens correctly
- ✅ Response interceptor handles 401 errors
- ✅ Request queue management during refresh
- ✅ Token refresh success/failure scenarios
- ✅ Error handling for different HTTP status codes
- ✅ Integration with existing CsrfTokenManager

**Sample Test Structure:**
```typescript
// tests/unit/api/enhanced-client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EnhancedApiClient } from '$lib/api/enhanced-client';

describe('EnhancedApiClient', () => {
  describe('Request Interceptor', () => {
    it('should add CSRF token to POST requests', async () => {
      // Test implementation
    });
    
    it('should not add CSRF token to GET requests', async () => {
      // Test implementation
    });
  });
  
  describe('Response Interceptor', () => {
    it('should handle 401 errors with token refresh', async () => {
      // Test implementation
    });
    
    it('should queue requests during token refresh', async () => {
      // Test implementation
    });
  });
});
```

### Integration Tests

**Test Scenarios:**
1. **Token Refresh During Active Session**
2. **Multiple Concurrent Requests During Refresh**
3. **CSRF Token Error Recovery**
4. **Rate Limiting Handling**
5. **Server Error Retry Logic**

**Sample Integration Test:**
```typescript
// tests/integration/token-refresh.test.ts
import { test, expect } from '@playwright/test';

test.describe('Token Refresh Integration', () => {
  test('should refresh token seamlessly during active session', async ({ page }) => {
    await page.goto('/jobs');
    
    // Simulate token expiry
    await page.evaluate(() => {
      // Mock token expiry
      document.cookie = 'session_token=expired; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
    });
    
    // Trigger API call that should refresh token
    await page.click('[data-testid="create-task-button"]');
    await page.fill('[data-testid="task-title"]', 'Test Task');
    await page.click('[data-testid="save-task"]');
    
    // Task should be created successfully despite token expiry
    await expect(page.locator('[data-testid="task-list"]')).toContainText('Test Task');
  });
});
```

### End-to-End Tests

**Test Scenarios:**
1. **User workflow with token refresh**
2. **Background token refresh during long sessions**
3. **Error handling user experience**
4. **Cross-browser compatibility**

## Migration Plan

### Phase 1: Parallel Implementation (Week 1)
- ✅ Install axios dependency
- ✅ Create EnhancedApiClient class
- ✅ Implement basic interceptors
- ✅ Unit tests for core functionality

### Phase 2: Feature Complete (Week 2)
- ✅ Request/response interceptor implementation
- ✅ Request queue management
- ✅ Error handling strategies
- ✅ Integration tests

### Phase 3: Integration & Testing (Week 3)
- ✅ Zero.js integration
- ✅ Migration from existing ApiClient
- ✅ End-to-end testing
- ✅ Performance optimization

### Phase 4: Deployment (Week 4)
- ✅ Feature flag implementation
- ✅ Gradual rollout
- ✅ Monitoring and metrics
- ✅ Production validation

### Rollback Strategy

**Rollback Triggers:**
- Authentication failure rate > 5%
- Token refresh errors > 10%
- User complaints about lost sessions
- Performance degradation > 200ms

**Rollback Process:**
1. Disable feature flag
2. Revert to original ApiClient
3. Monitor error rates
4. Investigate and fix issues
5. Re-enable with fixes

## Performance Considerations

### Metrics to Monitor

**Token Refresh Performance:**
- Token refresh success rate (target: >99%)
- Token refresh duration (target: <500ms)
- Request queue wait time (target: <100ms)
- Failed request retry rate (target: <1%)

**User Experience Metrics:**
- Session interruption rate (target: 0%)
- Lost work incidents (target: 0%)
- Authentication error reports (target: <1/week)
- User satisfaction score (target: >90%)

### Optimization Strategies

**Request Optimization:**
- Batch concurrent requests during refresh
- Implement exponential backoff for retries
- Cache successful responses
- Deduplicate identical requests

**Memory Management:**
- Limit request queue size
- Clean up expired tokens
- Garbage collect old interceptors
- Monitor memory usage

## Security Considerations

### Token Security

**Enhanced Security Measures:**
- Tokens never stored in localStorage
- Automatic token rotation
- Secure cookie transmission
- CSRF protection maintained
- Request signature validation

**Security Testing:**
- XSS vulnerability testing
- CSRF attack simulation
- Token interception testing
- Rate limiting validation
- Error message security review

### Audit Trail

**Logging Requirements:**
- Token refresh events
- Authentication failures
- Security violations
- Performance metrics
- User session activity

## Success Criteria

### Technical Success Metrics

- ✅ **Zero authentication interruptions** during user sessions
- ✅ **100% transparent token refresh** - no user awareness required
- ✅ **<500ms token refresh time** - minimal performance impact
- ✅ **99%+ token refresh success rate** - reliable operation
- ✅ **80% code reduction** in authentication logic

### User Experience Success Metrics

- ✅ **Zero lost work incidents** due to token expiry
- ✅ **95% reduction** in authentication error reports
- ✅ **Improved user satisfaction** - seamless app experience
- ✅ **Reduced support tickets** - fewer auth-related issues
- ✅ **Better productivity** - uninterrupted workflow

### Business Impact

- ✅ **Improved user retention** - better app experience
- ✅ **Reduced support costs** - fewer authentication issues
- ✅ **Enhanced security** - proper token lifecycle management
- ✅ **Competitive advantage** - professional app behavior
- ✅ **Developer productivity** - cleaner authentication code

## Conclusion

Epic-016 implements a production-ready axios interceptor system that eliminates authentication interruptions while maintaining security and performance. The implementation builds on existing architecture, provides comprehensive error handling, and delivers a seamless user experience.

**Key Deliverables:**
1. Enhanced API client with automatic token refresh
2. Request queue management for concurrent operations
3. Comprehensive error handling and retry logic
4. Zero.js integration for real-time coordination
5. Full test coverage and migration strategy
6. Performance monitoring and security audit trail

This epic transforms the authentication experience from a source of user frustration into a transparent, reliable foundation for the BOS application.