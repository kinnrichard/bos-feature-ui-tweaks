# Zero.js Integration Layer Migration Guide for Epic-008

This guide explains how to migrate from the current Zero.js patterns to the improved integration layer that provides centralized error handling, Rails-style query building, and enhanced Svelte 5 reactivity.

## Overview of Improvements

### ✅ What's Better Now

1. **Centralized Error Handling**: No more repetitive null checks and try-catch blocks
2. **Type Safety**: Eliminates 'as any' casts with proper TypeScript types
3. **Rails-Style Queries**: Method chaining with where(), orderBy(), limit(), etc.
4. **Enhanced Reactivity**: Better Svelte 5 integration with $state runes
5. **Automatic Validation**: Built-in UUID validation and required field checking
6. **Connection Management**: Automatic retry logic and connection state tracking

### 📦 New Files

- `frontend/src/lib/zero/client.ts` - ZeroClient wrapper with error handling
- `frontend/src/lib/zero/query-builder.ts` - Rails-style query building
- `frontend/src/lib/zero/reactive-query.ts` - Enhanced reactive queries
- `frontend/src/lib/zero/integration-examples.ts` - Usage examples

## Migration Steps

### 1. Update Imports

**Before:**
```typescript
import { getZero } from './zero-client';
```

**After:**
```typescript
import { zeroClient, executeQuery, executeMutation } from './client';
import { createQueryBuilder, table } from './query-builder';
import { createReactiveQuery, createReactiveQueryOne } from './reactive-query';
```

### 2. Migrate Simple Queries

**Before (Verbose Error Handling):**
```typescript
async function getTasks() {
  const zero = getZero();
  if (!zero) {
    throw new Error('Zero client not initialized');
  }
  
  try {
    const result = await zero.query.tasks.run();
    return result || [];
  } catch (error) {
    throw new Error(`Failed to fetch tasks: ${error.message}`);
  }
}
```

**After (Clean and Simple):**
```typescript
async function getTasks() {
  return await createQueryBuilder<Task>('tasks').run();
}
```

### 3. Migrate Complex Queries

**Before:**
```typescript
async function getActiveTasks(jobId: string) {
  const zero = getZero();
  if (!zero) return [];
  
  try {
    let query = zero.query.tasks;
    
    if (jobId) {
      query = query.where('job_id', jobId);
    }
    
    query = query.where('discarded_at', 'IS', null)
                 .where('status', '=', 1)
                 .orderBy('created_at', 'desc');
    
    const result = await query.run();
    return Array.isArray(result) ? result : (result ? [result] : []);
  } catch (error) {
    console.error('Failed to fetch active tasks:', error);
    return [];
  }
}
```

**After:**
```typescript
async function getActiveTasks(jobId: string) {
  return await createQueryBuilder<Task>('tasks')
    .where('job_id', jobId)
    .whereNull('discarded_at')
    .where('status', 1)
    .orderByDesc('created_at')
    .run();
}
```

### 4. Migrate Mutations

**Before:**
```typescript
async function createTask(data: CreateTaskData) {
  const zero = getZero();
  if (!zero) {
    throw new Error('Zero client not initialized');
  }
  
  // Manual validation
  if (!data.lock_version) {
    throw new Error('Lock version is required');
  }
  
  // Manual UUID generation
  const id = crypto.randomUUID();
  if (!id.match(/uuid-regex/)) {
    throw new Error('Invalid UUID');
  }
  
  const now = Date.now();
  
  try {
    await zero.mutate.tasks.insert({
      id,
      ...data,
      created_at: now,
      updated_at: now,
    });
    return { id };
  } catch (error) {
    throw new Error(`Failed to create task: ${error.message}`);
  }
}
```

**After:**
```typescript
async function createTask(data: CreateTaskData) {
  validateRequired(data, ['lock_version', 'applies_to_all_targets']);
  
  const id = generateUUID();
  const now = getCurrentTimestamp();
  
  await executeMutation(
    (client) => client.mutate.tasks.insert({
      id,
      ...data,
      created_at: now,
      updated_at: now,
    }),
    'Failed to create task'
  );
  
  return createMutationResult(id);
}
```

### 5. Migrate Reactive Queries

**Before:**
```typescript
function createReactiveQuery<T>(queryBuilder: any, defaultValue: T) {
  let current = defaultValue;
  let resultType: 'loading' | 'success' | 'error' = 'loading';
  let error: Error | null = null;
  let view: any = null;
  
  const execute = async () => {
    try {
      resultType = 'loading';
      const zero = getZero();
      if (!zero) {
        setTimeout(() => execute(), 100);
        return;
      }
      
      view = queryBuilder.materialize();
      const result = await view.data;
      current = result || defaultValue;
      resultType = 'success';
    } catch (err) {
      error = err;
      resultType = 'error';
    }
  };
  
  execute();
  
  return {
    get current() { return current; },
    get resultType() { return resultType; },
    get error() { return error; },
    destroy: () => view?.destroy()
  };
}
```

**After:**
```typescript
const activeTasks = createReactiveQuery(
  () => createQueryBuilder<Task>('tasks')
    .where('status', 1)
    .whereNull('discarded_at'),
  { ttl: '5m', retryAttempts: 3 }
);

// In Svelte component:
// {#each activeTasks.data as task}
// Automatically reactive with Svelte 5 $state
```

### 6. Migrate ActiveRecord Classes

**Before:**
```typescript
export class TaskInstance {
  async update(attributes: Partial<Task>) {
    const zero = getZero();
    if (!zero) {
      throw new Error('Zero client not initialized');
    }
    
    if (!attributes || Object.keys(attributes).length === 0) {
      throw new Error('Update attributes required');
    }
    
    try {
      await zero.mutate.tasks.update({
        id: this.data.id,
        ...attributes,
        updated_at: Date.now(),
      });
      return { id: this.data.id };
    } catch (error) {
      throw new Error(`Update failed: ${error.message}`);
    }
  }
}
```

**After:**
```typescript
export class TaskInstance {
  async update(attributes: Partial<Task>) {
    validateUpdateData(attributes);
    
    return await executeMutation(
      (client) => client.mutate.tasks.update({
        id: this.data.id,
        ...attributes,
        updated_at: getCurrentTimestamp(),
      }),
      'Failed to update task'
    );
  }
}
```

## Key Benefits After Migration

### 1. Reduced Boilerplate

- **90% less error handling code**
- **No more manual null checks**
- **Automatic UUID validation**
- **Built-in retry logic**

### 2. Better Type Safety

- **No more 'as any' casts**
- **Proper TypeScript inference**
- **Compile-time error catching**

### 3. Enhanced Developer Experience

- **Rails-style method chaining**
- **Consistent error messages**
- **Better debugging with SQL-like toString()**

### 4. Improved Performance

- **Automatic query optimization**
- **Better memory management**
- **Efficient connection pooling**

## Advanced Patterns

### Query Builder Chaining

```typescript
// Complex filtering with method chaining
const filteredTasks = createQueryBuilder<Task>('tasks')
  .where({ job_id: jobId, status: 1 })
  .whereNotNull('assigned_to_id')
  .whereIn('priority', [1, 2, 3])
  .whereLike('title', '%important%')
  .orderByDesc('created_at')
  .limit(50);

// Pagination
const pagedTasks = createQueryBuilder<Task>('tasks')
  .where('job_id', jobId)
  .orderBy('position')
  .paginate(page, 20);
```

### Reactive Query Options

```typescript
// Collection query with options
const tasks = createReactiveQuery(
  () => createQueryBuilder<Task>('tasks').where('job_id', jobId),
  {
    ttl: '5m',           // Cache for 5 minutes
    retryAttempts: 3,    // Retry failed queries
    retryDelay: 1000,    // Wait 1s between retries
    enabled: true        // Start immediately
  }
);

// Single record query
const task = createReactiveQueryOne(
  () => createQueryBuilder<Task>('tasks').find(taskId),
  { ttl: '2m', enabled: false } // Start disabled
);

// Enable/disable as needed
task.enable();   // Start listening
task.disable();  // Stop listening but keep data
task.destroy();  // Full cleanup
```

### Error Handling Strategies

```typescript
// Optional operations (returns null on error)
const tasks = await executeQuery(
  (client) => client.query.tasks.run(),
  { required: false }
);

// Required operations (throws on error)
const result = await executeMutation(
  (client) => client.mutate.tasks.insert(data),
  'Failed to create task'
);

// Custom error handling
try {
  await executeMutation(/* ... */);
} catch (error) {
  if (error instanceof ZeroNotAvailableError) {
    // Handle connection issues
  } else if (error instanceof ZeroValidationError) {
    // Handle validation errors
  }
}
```

## Testing the Migration

### 1. Gradual Migration Strategy

1. **Start with new queries** - Use new patterns for new code
2. **Migrate simple queries** - Replace straightforward fetches first
3. **Update reactive queries** - Migrate Svelte components gradually
4. **Refactor mutations** - Update create/update/delete operations
5. **Clean up imports** - Remove old patterns when complete

### 2. Verification Steps

```typescript
// Test query builder
const testQuery = createQueryBuilder<Task>('tasks')
  .where('status', 1)
  .orderBy('created_at');

debugDatabase('Query SQL:', testQuery.toSQL());
// Output: SELECT * FROM tasks WHERE status = 1 ORDER BY created_at ASC

// Test reactive query
const reactiveTest = createReactiveQuery(
  () => testQuery,
  { ttl: '1m' }
);

// Verify reactivity in Svelte component
// Should automatically update when data changes
```

### 3. Performance Monitoring

```typescript
// Monitor connection state
const state = zeroClient.getConnectionState();
debugDatabase('Zero connection:', state);

// Track query performance
const startTime = performance.now();
const tasks = await createQueryBuilder<Task>('tasks').run();
debugPerformance(`Query took ${performance.now() - startTime}ms`);
```

## Troubleshooting

### Common Issues

1. **"Zero client not available"**
   - Check if Zero is initialized properly
   - Verify network connection
   - Use `zeroClient.getConnectionState()` for debugging

2. **Type errors with query builder**
   - Ensure proper generic types: `createQueryBuilder<Task>('tasks')`
   - Check that table name matches schema

3. **Reactive queries not updating**
   - Verify TTL is appropriate for your use case
   - Check that component isn't destroyed prematurely
   - Use `.refresh()` to force update

### Debug Tools

```typescript
// Debug connection
debugDatabase('Zero state:', zeroClient.getConnectionState());

// Debug queries
const query = createQueryBuilder<Task>('tasks').where('status', 1);
debugDatabase('SQL:', query.toSQL());

// Debug reactive queries
const reactive = createReactiveQuery(() => query);
debugReactive('Reactive state:', reactive.state);
```

## Zero.js includes() Limitations and Workarounds

### Client-Side Filtering Pattern for Relationship Data

When working with `includes()` queries that need filtering on the included relationships, Zero.js requires a client-side filtering approach. See the [Client-Side Filtering with includes() Pattern](../patterns/client-side-filtering-with-includes.md) for a comprehensive guide.

**Quick Example:**
```typescript
// ❌ This doesn't work with Zero.js
const clientQuery = ReactiveClient
  .includes('frontConversations')
  .where('frontConversations.status_category', 'open')
  .find(clientId);

// ✅ Use client-side filtering pattern instead
const clientQuery = ReactiveClient.includes('frontConversations').find(clientId);
const filteredQuery = $derived.by(() => {
  const conversations = clientQuery.data?.frontConversations || [];
  const filtered = conversations.filter(c => c.status_category === 'open');
  return createReactiveQueryWrapper(filtered, clientQuery);
});
```

This migration guide provides a comprehensive path from the current verbose Zero.js patterns to the new streamlined integration layer while maintaining full compatibility with existing ReactiveRecord and ActiveRecord functionality.