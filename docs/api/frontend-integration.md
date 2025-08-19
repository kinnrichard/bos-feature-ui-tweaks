---
title: "Frontend API Integration Guide"
description: "Guide for integrating the bŏs API with frontend applications, focusing on Svelte PWA"
last_updated: "2025-07-17"
status: "active"
category: "api"
tags: ["api", "frontend", "integration", "svelte", "pwa"]
---

# Frontend API Integration Guide

## Overview

This guide covers how to integrate the bŏs API with frontend applications, with specific focus on the Svelte PWA implementation and general patterns for other frameworks.

## Architecture Overview

The bŏs frontend uses a multi-layer architecture:

1. **API Layer**: HTTP client with authentication and error handling
2. **Model Layer**: ActiveRecord/ReactiveRecord for data management
3. **Component Layer**: Svelte components with reactive state
4. **Service Layer**: Business logic and data transformation

## API Client Setup

### Basic HTTP Client

```typescript
// lib/api/client.ts
import { ZeroJwtService } from './zero-jwt-service';

export class ApiClient {
  private baseUrl = '/api/v1';
  
  async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new ApiError(response);
    }
    
    return response.json();
  }
  
  // Convenience methods
  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'GET' });
  }
  
  post<T>(endpoint: string, data: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  
  patch<T>(endpoint: string, data: any) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
  
  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}
```

### Enhanced Client with Authentication

```typescript
// lib/api/enhanced-client.ts
import { ApiClient } from './client';
import { ZeroJwtService } from './zero-jwt-service';

export class EnhancedApiClient extends ApiClient {
  private jwtService: ZeroJwtService;
  
  constructor() {
    super();
    this.jwtService = new ZeroJwtService();
  }
  
  async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    // Auto-refresh token if needed
    await this.jwtService.ensureValidToken();
    
    try {
      return await super.request<T>(endpoint, options);
    } catch (error) {
      // Handle token expiration
      if (error.status === 401) {
        await this.jwtService.refreshToken();
        return await super.request<T>(endpoint, options);
      }
      throw error;
    }
  }
}
```

## Authentication Integration

### JWT Service

```typescript
// lib/api/zero-jwt-service.ts
export class ZeroJwtService {
  private tokenRefreshPromise: Promise<void> | null = null;
  
  async ensureValidToken(): Promise<void> {
    const token = this.getStoredToken();
    if (!token || this.isTokenExpired(token)) {
      await this.refreshToken();
    }
  }
  
  async refreshToken(): Promise<void> {
    // Prevent multiple simultaneous refresh attempts
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }
    
    this.tokenRefreshPromise = this.performTokenRefresh();
    
    try {
      await this.tokenRefreshPromise;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }
  
  private async performTokenRefresh(): Promise<void> {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include', // Include cookies
    });
    
    if (!response.ok) {
      // Refresh failed, redirect to login
      window.location.href = '/login';
      throw new Error('Token refresh failed');
    }
    
    // Token refreshed successfully (via cookies)
  }
  
  private getStoredToken(): string | null {
    // For cookie auth, we can't directly access httpOnly cookies
    // Instead, we track token state via a separate flag
    return localStorage.getItem('auth_state');
  }
  
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }
}
```

## Model Layer Integration

### ActiveRecord for Non-Reactive Operations

```typescript
// lib/models/active-record.ts
import { EnhancedApiClient } from '../api/enhanced-client';

export class ActiveRecord<T extends { id: string }> {
  protected static client = new EnhancedApiClient();
  protected static tableName: string;
  
  static async find<T>(id: string): Promise<T> {
    const response = await this.client.get(`/${this.tableName}/${id}`);
    return response.data;
  }
  
  static async all<T>(): Promise<T[]> {
    const response = await this.client.get(`/${this.tableName}`);
    return response.data;
  }
  
  static async create<T>(data: Partial<T>): Promise<T> {
    const response = await this.client.post(`/${this.tableName}`, {
      data: {
        type: this.tableName,
        attributes: data,
      },
    });
    return response.data;
  }
  
  static async update<T>(id: string, data: Partial<T>): Promise<T> {
    const response = await this.client.patch(`/${this.tableName}/${id}`, {
      data: {
        type: this.tableName,
        id,
        attributes: data,
      },
    });
    return response.data;
  }
  
  static async destroy(id: string): Promise<void> {
    await this.client.delete(`/${this.tableName}/${id}`);
  }
}
```

### ReactiveRecord for Svelte Integration

```typescript
// lib/models/reactive-record.ts
import { writable, derived } from 'svelte/store';
import { ActiveRecord } from './active-record';

export class ReactiveRecord<T extends { id: string }> extends ActiveRecord<T> {
  private cache = new Map<string, any>();
  private subscriptions = new Map<string, any>();
  
  static find<T>(id: string) {
    const cacheKey = `${this.tableName}:${id}`;
    
    if (!this.cache.has(cacheKey)) {
      const store = writable<T | null>(null);
      
      // Initial load
      this.loadRecord(id).then(record => {
        store.set(record);
      });
      
      // Set up real-time updates
      this.subscribeToRecord(id, (record) => {
        store.set(record);
      });
      
      this.cache.set(cacheKey, store);
    }
    
    return this.cache.get(cacheKey);
  }
  
  static all<T>() {
    const cacheKey = `${this.tableName}:all`;
    
    if (!this.cache.has(cacheKey)) {
      const store = writable<T[]>([]);
      
      // Initial load
      this.loadAllRecords().then(records => {
        store.set(records);
      });
      
      // Set up real-time updates
      this.subscribeToCollection((records) => {
        store.set(records);
      });
      
      this.cache.set(cacheKey, store);
    }
    
    return this.cache.get(cacheKey);
  }
  
  private static async loadRecord<T>(id: string): Promise<T> {
    return super.find<T>(id);
  }
  
  private static async loadAllRecords<T>(): Promise<T[]> {
    return super.all<T>();
  }
  
  private static subscribeToRecord(id: string, callback: (record: any) => void) {
    // WebSocket subscription for real-time updates
    const ws = new WebSocket(`ws://localhost:3000/cable`);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        command: 'subscribe',
        identifier: JSON.stringify({
          channel: `${this.tableName}Channel`,
          id: id
        })
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'confirm_subscription') return;
      
      callback(data.record);
    };
    
    return ws;
  }
  
  private static subscribeToCollection(callback: (records: any[]) => void) {
    // WebSocket subscription for collection updates
    const ws = new WebSocket(`ws://localhost:3000/cable`);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        command: 'subscribe',
        identifier: JSON.stringify({
          channel: `${this.tableName}Channel`,
          collection: true
        })
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'confirm_subscription') return;
      
      callback(data.records);
    };
    
    return ws;
  }
}
```

## Component Integration Patterns

### Basic Component with API Data

```svelte
<!-- lib/components/JobList.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { JobService } from '../services/job-service';
  import type { Job } from '../types/job';
  
  let jobs: Job[] = [];
  let loading = true;
  let error: string | null = null;
  
  onMount(async () => {
    try {
      jobs = await JobService.getAll();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });
  
  async function handleStatusChange(jobId: string, newStatus: string) {
    try {
      await JobService.updateStatus(jobId, newStatus);
      // Update local state
      jobs = jobs.map(job => 
        job.id === jobId ? { ...job, status: newStatus } : job
      );
    } catch (err) {
      error = err.message;
    }
  }
</script>

{#if loading}
  <div class="loading">Loading jobs...</div>
{:else if error}
  <div class="error">Error: {error}</div>
{:else}
  <div class="job-list">
    {#each jobs as job}
      <div class="job-card">
        <h3>{job.title}</h3>
        <p>Status: {job.status}</p>
        <button 
          on:click={() => handleStatusChange(job.id, 'in_progress')}
        >
          Start Job
        </button>
      </div>
    {/each}
  </div>
{/if}
```

### Reactive Component with Real-time Updates

```svelte
<!-- lib/components/ReactiveJobList.svelte -->
<script lang="ts">
  import { ReactiveJob } from '../models/reactive-job';
  
  // Reactive store automatically updates when data changes
  const jobsStore = ReactiveJob.all();
  
  $: jobs = $jobsStore;
  $: loading = jobs.length === 0;
  
  async function handleStatusChange(jobId: string, newStatus: string) {
    await ReactiveJob.update(jobId, { status: newStatus });
    // No need to update local state - reactive store handles it
  }
</script>

{#if loading}
  <div class="loading">Loading jobs...</div>
{:else}
  <div class="job-list">
    {#each jobs as job}
      <div class="job-card">
        <h3>{job.title}</h3>
        <p>Status: {job.status}</p>
        <button 
          on:click={() => handleStatusChange(job.id, 'in_progress')}
        >
          Start Job
        </button>
      </div>
    {/each}
  </div>
{/if}
```

## Error Handling Patterns

### Centralized Error Handling

```typescript
// lib/api/error-handler.ts
export class ApiError extends Error {
  constructor(
    public response: Response,
    public errors: any[] = []
  ) {
    super(`API Error: ${response.status} ${response.statusText}`);
  }
  
  static async fromResponse(response: Response): Promise<ApiError> {
    try {
      const data = await response.json();
      return new ApiError(response, data.errors || []);
    } catch {
      return new ApiError(response);
    }
  }
  
  get statusCode(): number {
    return this.response.status;
  }
  
  get isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }
  
  get isServerError(): boolean {
    return this.statusCode >= 500;
  }
  
  get isNetworkError(): boolean {
    return this.statusCode === 0;
  }
}
```

### Component Error Handling

```svelte
<!-- lib/components/ErrorBoundary.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { ApiError } from '../api/error-handler';
  
  export let error: Error | null = null;
  
  const dispatch = createEventDispatcher();
  
  function handleRetry() {
    dispatch('retry');
    error = null;
  }
  
  function getErrorMessage(error: Error): string {
    if (error instanceof ApiError) {
      if (error.statusCode === 401) {
        return 'Please log in to continue';
      }
      if (error.statusCode === 403) {
        return 'You don\'t have permission to access this resource';
      }
      if (error.statusCode === 429) {
        return 'Too many requests. Please try again later.';
      }
      if (error.errors.length > 0) {
        return error.errors[0].detail || error.errors[0].title;
      }
    }
    return error.message || 'An unexpected error occurred';
  }
</script>

{#if error}
  <div class="error-boundary">
    <h3>Something went wrong</h3>
    <p>{getErrorMessage(error)}</p>
    <button on:click={handleRetry}>Try Again</button>
  </div>
{:else}
  <slot />
{/if}
```

## Performance Optimizations

### Request Caching

```typescript
// lib/api/cache.ts
export class RequestCache {
  private cache = new Map<string, any>();
  private timestamps = new Map<string, number>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes
  
  get<T>(key: string): T | null {
    const timestamp = this.timestamps.get(key);
    if (!timestamp || Date.now() - timestamp > this.TTL) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      return null;
    }
    
    return this.cache.get(key);
  }
  
  set<T>(key: string, value: T): void {
    this.cache.set(key, value);
    this.timestamps.set(key, Date.now());
  }
  
  clear(): void {
    this.cache.clear();
    this.timestamps.clear();
  }
}
```

### Optimistic Updates

```typescript
// lib/services/optimistic-updates.ts
export class OptimisticUpdateService {
  private pendingUpdates = new Map<string, any>();
  
  async updateWithOptimism<T>(
    id: string,
    updates: Partial<T>,
    apiCall: () => Promise<T>
  ): Promise<T> {
    // Store optimistic update
    this.pendingUpdates.set(id, updates);
    
    try {
      // Perform API call
      const result = await apiCall();
      
      // Remove pending update on success
      this.pendingUpdates.delete(id);
      
      return result;
    } catch (error) {
      // Revert optimistic update on failure
      this.pendingUpdates.delete(id);
      throw error;
    }
  }
  
  getPendingUpdates(id: string): any {
    return this.pendingUpdates.get(id);
  }
}
```

## Testing Integration

### API Client Testing

```typescript
// tests/api/client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ApiClient } from '../lib/api/client';

describe('ApiClient', () => {
  it('should make GET requests with proper headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] })
    });
    
    global.fetch = mockFetch;
    
    const client = new ApiClient();
    await client.get('/jobs');
    
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/jobs', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
      },
    });
  });
});
```

### Component Testing

```typescript
// tests/components/JobList.test.ts
import { render, screen, waitFor } from '@testing-library/svelte';
import { vi } from 'vitest';
import JobList from '../lib/components/JobList.svelte';
import { JobService } from '../lib/services/job-service';

vi.mock('../lib/services/job-service');

describe('JobList', () => {
  it('should display jobs when loaded', async () => {
    const mockJobs = [
      { id: '1', title: 'Test Job', status: 'open' }
    ];
    
    vi.mocked(JobService.getAll).mockResolvedValue(mockJobs);
    
    render(JobList);
    
    await waitFor(() => {
      expect(screen.getByText('Test Job')).toBeInTheDocument();
      expect(screen.getByText('Status: open')).toBeInTheDocument();
    });
  });
});
```

## Best Practices

### 1. Always Handle Errors Gracefully
- Implement proper error boundaries
- Provide meaningful error messages
- Allow users to recover from errors

### 2. Use Optimistic Updates
- Update UI immediately for better UX
- Revert changes on API errors
- Show loading states for critical operations

### 3. Implement Proper Caching
- Cache API responses appropriately
- Invalidate cache when data changes
- Use reactive stores for shared state

### 4. Handle Authentication Properly
- Implement token refresh
- Redirect to login on auth errors
- Handle offline scenarios

### 5. Test Thoroughly
- Unit test API clients
- Integration test components
- Mock external dependencies

## Related Documentation

### API Documentation
- **[API Authentication](./api-authentication.md)** - API authentication methods and security
- **[API Specification](./api-specification.md)** - Technical API specification and standards
- **[Frontend API Reference](./frontend-api-reference.md)** - ReactiveRecord/ActiveRecord API reference
- **[API Examples](./v1/examples/README.md)** - Code examples and usage patterns

### Frontend Development
- **[Frontend Debug System](../frontend/epics/epic-014-debug-system-guide.md)** - Debug API calls and responses
- **[Zero.js Integration](../../frontend/src/lib/zero/README.md)** - Zero.js reactive system documentation
- **[Frontend Migration Guide](../../frontend/epic-008-migration-guide.md)** - Svelte 5 migration patterns
- **[ReactiveRecord Usage](../../dev-docs/using-reactive-record.md)** - ActiveRecord-style reactive patterns

### Architecture & Implementation
- **[Technical Decisions](../standards/technical-decisions.md)** - Frontend architecture decisions
- **[Style Guide](../standards/style-guide.md)** - Frontend code style standards
- **[Testing Strategy](../tests/readme-tests.md)** - Frontend testing patterns

### Development Workflow
- **[Epic Management](../epics/README.md)** - Frontend feature epic tracking
- **[Story Development](../stories/README.md)** - Frontend user stories
- **[Claude Automation](../guides/claude-automation-setup.md)** - Automated development setup

### See Also
- **[Component Library](../frontend/component-library.md)** - Reusable UI components
- **[Performance Guidelines](../architecture/performance-guidelines.md)** - Frontend optimization
- **[Troubleshooting Guide](../architecture/troubleshooting-guide.md)** - Frontend debugging