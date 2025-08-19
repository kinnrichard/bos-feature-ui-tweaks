# API Reference

This directory contains comprehensive reference documentation for the bŏs API client libraries and type definitions.

## Contents

### TypeScript/JavaScript Reference
- [API Client](./typescript/api-client.md) - Core API client class
- [Authentication](./typescript/authentication.md) - Authentication utilities
- [Error Handling](./typescript/errors.md) - Error classes and handling
- [Type Definitions](./typescript/types.md) - Complete type definitions

### Model Classes
- [ActiveRecord](./typescript/active-record.md) - Promise-based model operations
- [ReactiveRecord](./typescript/reactive-record.md) - Reactive model operations
- [ScopedQuery](./typescript/scoped-query.md) - Query builder interface

### Service Classes
- [Job Service](./typescript/job-service.md) - Job management operations
- [Task Service](./typescript/task-service.md) - Task management operations
- [User Service](./typescript/user-service.md) - User management operations
- [WebSocket Service](./typescript/websocket-service.md) - Real-time communication

### Utility Classes
- [Cache Manager](./typescript/cache-manager.md) - Response caching
- [Retry Handler](./typescript/retry-handler.md) - Request retry logic
- [Validation](./typescript/validation.md) - Input validation utilities

## Quick Reference

### Core API Client

```typescript
import { ApiClient } from '@/lib/api/client';

// Initialize client
const api = new ApiClient();

// Basic operations
const jobs = await api.get('/jobs');
const job = await api.post('/jobs', jobData);
const updated = await api.patch('/jobs/123', updates);
await api.delete('/jobs/123');
```

### Model Usage

```typescript
import { Job, Task } from '@/lib/models';

// Promise-based operations
const job = await Job.find('job-id');
const jobs = await Job.where({ status: 'open' }).all();
const newJob = await Job.create({ title: 'New Job' });

// Reactive operations (Svelte)
const jobStore = ReactiveJob.find('job-id');
const jobsStore = ReactiveJob.where({ status: 'open' });

// Use in components
$: job = $jobStore;
$: jobs = $jobsStore;
```

### Error Handling

```typescript
import { ApiError, RecordNotFoundError } from '@/lib/api/errors';

try {
  const job = await Job.find('invalid-id');
} catch (error) {
  if (error instanceof RecordNotFoundError) {
    console.log('Job not found');
  } else if (error instanceof ApiError) {
    console.log(`API Error: ${error.statusCode}`);
  }
}
```

## Type Definitions

### Core Types

```typescript
// Base record interface
interface BaseRecord {
  id: string;
  created_at: number;
  updated_at: number;
  discarded_at?: number | null;
}

// Job interface
interface JobData extends BaseRecord {
  title: string;
  description?: string;
  status: string;
  priority: number;
  client_id: string;
  assigned_to_id?: string;
  due_at?: number;
  // ... other fields
}

// Task interface
interface TaskData extends BaseRecord {
  title: string;
  description?: string;
  status: string;
  priority: number;
  job_id: string;
  assigned_to_id?: string;
  position: number;
  // ... other fields
}
```

### API Response Types

```typescript
// JSON:API response format
interface JsonApiResponse<T> {
  data: T | T[];
  included?: any[];
  meta?: {
    request_id: string;
    timestamp: string;
    pagination?: {
      page: number;
      per_page: number;
      total: number;
    };
  };
}

// Error response format
interface JsonApiError {
  errors: Array<{
    id: string;
    status: string;
    code: string;
    title: string;
    detail: string;
    source?: {
      pointer: string;
      parameter: string;
    };
    meta?: any;
  }>;
  meta?: {
    request_id: string;
    timestamp: string;
  };
}
```

## Class Reference

### ApiClient

```typescript
class ApiClient {
  constructor(baseUrl?: string);
  
  // HTTP methods
  get<T>(endpoint: string, options?: RequestOptions): Promise<T>;
  post<T>(endpoint: string, data: any, options?: RequestOptions): Promise<T>;
  patch<T>(endpoint: string, data: any, options?: RequestOptions): Promise<T>;
  delete<T>(endpoint: string, options?: RequestOptions): Promise<T>;
  
  // Utility methods
  setAuthToken(token: string): void;
  clearAuthToken(): void;
  setBaseUrl(url: string): void;
}
```

### ActiveRecord

```typescript
class ActiveRecord<T extends BaseRecord> {
  // Finding records
  static find<T>(id: string, options?: QueryOptions): Promise<T>;
  static findBy<T>(conditions: Partial<T>, options?: QueryOptions): Promise<T | null>;
  static all<T>(): ScopedQuery<T>;
  static where<T>(conditions: Partial<T>): ScopedQuery<T>;
  
  // CRUD operations
  static create<T>(data: CreateData<T>, options?: QueryOptions): Promise<T>;
  static update<T>(id: string, data: UpdateData<T>, options?: QueryOptions): Promise<T>;
  static destroy(id: string, options?: QueryOptions): Promise<CrudResult>;
  
  // Discard gem support
  static discard<T>(id: string, options?: QueryOptions): Promise<T>;
  static undiscard<T>(id: string, options?: QueryOptions): Promise<T>;
  static kept<T>(): ScopedQuery<T>;
  static discarded<T>(): ScopedQuery<T>;
  static withDiscarded<T>(): ScopedQuery<T>;
}
```

### ReactiveRecord

```typescript
class ReactiveRecord<T extends BaseRecord> {
  // Reactive queries
  static find<T>(id: string): ReactiveQueryOne<T>;
  static all<T>(): ReactiveQuery<T>;
  static where<T>(conditions: Partial<T>): ReactiveQuery<T>;
  
  // Reactive query methods
  static refresh(): void;
  static enable(): void;
  static disable(): void;
  static destroy(): void;
  
  // Reactive state
  data: T | T[];
  isLoading: boolean;
  error: Error | null;
}
```

### ScopedQuery

```typescript
class ScopedQuery<T> {
  // Chaining methods
  where(conditions: Partial<T>): ScopedQuery<T>;
  whereNull(field: keyof T): ScopedQuery<T>;
  whereNotNull(field: keyof T): ScopedQuery<T>;
  orderBy(field: keyof T, direction?: 'asc' | 'desc'): ScopedQuery<T>;
  limit(count: number): ScopedQuery<T>;
  offset(count: number): ScopedQuery<T>;
  
  // Execution methods
  all(options?: QueryOptions): Promise<T[]>;
  first(options?: QueryOptions): Promise<T | null>;
  last(options?: QueryOptions): Promise<T | null>;
  count(options?: QueryOptions): Promise<number>;
  exists(options?: QueryOptions): Promise<boolean>;
  
  // Discard methods
  kept(): ScopedQuery<T>;
  discarded(): ScopedQuery<T>;
  withDiscarded(): ScopedQuery<T>;
}
```

## Configuration Options

### Query Options

```typescript
interface QueryOptions {
  withDiscarded?: boolean;    // Include discarded records
  timeout?: number;          // Request timeout in milliseconds
  retries?: number;          // Number of retry attempts
  cache?: boolean;           // Enable response caching
}
```

### Request Options

```typescript
interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  cache?: boolean;
  signal?: AbortSignal;
}
```

## Error Classes

### ApiError

```typescript
class ApiError extends Error {
  constructor(response: Response, errors?: any[]);
  
  readonly statusCode: number;
  readonly response: Response;
  readonly errors: any[];
  
  get isClientError(): boolean;
  get isServerError(): boolean;
  get isNetworkError(): boolean;
  
  static fromResponse(response: Response): Promise<ApiError>;
}
```

### RecordNotFoundError

```typescript
class RecordNotFoundError extends Error {
  constructor(message: string, modelName: string, searchCriteria: any);
  
  readonly modelName: string;
  readonly searchCriteria: any;
  
  static forId(id: string, modelName: string): RecordNotFoundError;
}
```

### ValidationError

```typescript
class ValidationError extends Error {
  constructor(message: string, errors: Record<string, string[]>);
  
  readonly validationErrors: Record<string, string[]>;
  
  hasFieldError(field: string): boolean;
  getFieldErrors(field: string): string[];
}
```

## Usage Examples

### Basic CRUD Operations

```typescript
// Create
const job = await Job.create({
  title: 'New Job',
  description: 'Job description',
  status: 'open',
  priority: 1,
  client_id: 'client-123'
});

// Read
const foundJob = await Job.find(job.id);
const allJobs = await Job.all().all();
const openJobs = await Job.where({ status: 'open' }).all();

// Update
const updatedJob = await Job.update(job.id, {
  status: 'in_progress'
});

// Delete
await Job.destroy(job.id);
```

### Advanced Queries

```typescript
// Complex query with chaining
const urgentJobs = await Job
  .where({ status: 'open' })
  .where({ priority: 1 })
  .whereNotNull('due_at')
  .orderBy('due_at', 'asc')
  .limit(10)
  .all();

// Pagination
const page2Jobs = await Job
  .where({ status: 'open' })
  .orderBy('created_at', 'desc')
  .limit(20)
  .offset(20)
  .all();

// Count and existence checks
const openJobCount = await Job.where({ status: 'open' }).count();
const hasUrgentJobs = await Job.where({ priority: 1 }).exists();
```

### Reactive Usage (Svelte)

```svelte
<script>
  import { ReactiveJob } from '@/lib/models';
  
  export let clientId: string;
  
  // Reactive store - automatically updates
  const jobsStore = ReactiveJob.where({ client_id: clientId });
  
  $: jobs = $jobsStore.data;
  $: isLoading = $jobsStore.isLoading;
  $: error = $jobsStore.error;
  
  // Cleanup on destroy
  onDestroy(() => {
    jobsStore.destroy();
  });
</script>

{#if isLoading}
  <p>Loading jobs...</p>
{:else if error}
  <p>Error: {error.message}</p>
{:else}
  {#each jobs as job}
    <div>{job.title}</div>
  {/each}
{/if}
```

## Best Practices

1. **Use TypeScript** for better type safety and IDE support
2. **Handle errors properly** with try-catch blocks and error boundaries
3. **Use reactive stores** for real-time updates in Svelte components
4. **Implement caching** for frequently accessed data
5. **Clean up resources** by calling `destroy()` on reactive queries
6. **Use query chaining** for complex database queries
7. **Validate inputs** before sending to API
8. **Monitor performance** and optimize queries as needed

## See Also

- [API Specification](../../api-specification.md) - Complete API documentation
- [Authentication Guide](../../api-authentication.md) - Authentication setup
- [Frontend Integration](../../FRONTEND_INTEGRATION.md) - Frontend-specific patterns
- [Examples](../examples/) - Working code examples