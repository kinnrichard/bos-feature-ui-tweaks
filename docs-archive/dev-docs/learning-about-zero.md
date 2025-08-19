---
title: "Learning About Zero.js: Best Practices and Reactive Integration"
description: "Comprehensive guide on Zero.js integration best practices and reactive patterns"
last_updated: "2025-07-17"
status: "active"
category: "technical-guide"
tags: ["zero", "best-practices", "reactive", "integration", "svelte"]
---

# Learning About Zero.js: Best Practices and Reactive Integration

## Overview

This document captures our learnings from debugging Zero.js integration and outlines best practices for building reactive, offline-first applications with Zero.js and Svelte 5.

## Key Discoveries

### 1. Zero's Query Lifecycle Architecture

Zero.js has a sophisticated query lifecycle that differs from traditional ORMs:

#### Static vs Reactive Queries

```javascript
// ❌ Static Query - Returns snapshot, doesn't update
const clients = await window.zero.query.clients.run();
const client = clients[0];  // This object never updates

// ✅ Reactive Query - Stays synchronized
const clientsView = window.zero.query.clients.materialize();
const clients = await clientsView.data;  // This updates automatically
```

#### Query Execution Modes

- **Default mode** (`run()`): Returns data from local cache only
- **Complete mode** (`run({ type: 'complete' })`): Waits for server response
- **Materialized queries** (`materialize()`): Creates active queries that stay synchronized

### 2. The Mutation Reactivity Problem

**Issue**: Mutations work but client-side objects don't update automatically.

```javascript
// This pattern doesn't work as expected:
const client = clients[0];
await zero.mutate.clients.update({ id: client.id, name: 'New Name' });
console.log(client.name); // Still shows old name! ❌
```

**Solution**: Use materialized views that automatically update:

```javascript
// This pattern works correctly:
const clientsView = zero.query.clients.materialize();
await zero.mutate.clients.update({ id: client.id, name: 'New Name' });
const updatedClients = await clientsView.data;
console.log(updatedClients[0].name); // Shows new name! ✅
```

### 3. Active Query Management

Zero only keeps data in local cache when **active queries** are maintaining it:

- `run()` creates one-time queries
- `materialize()` creates active queries that persist
- `preload()` creates temporary active queries
- Active queries populate Zero's Client View Repository (CVR)

## Best Practices

### 1. Query Patterns

#### For UI-Bound Data (Always Use Active Queries)
```javascript
// ✅ Good: Creates reactive query for UI
const jobsView = zero.query.jobs.materialize({ ttl: '1h' });

// ❌ Bad: Creates static snapshot
const jobs = await zero.query.jobs.run();
```

#### For One-Time Fetches
```javascript
// ✅ Good: For analytics, reports, one-time operations
const stats = await zero.query.jobs.run({ type: 'complete' });
```

#### For Debugging
```javascript
// ✅ Console testing patterns
const view = zero.query.clients.materialize();
console.log('Initial:', await view.data);

await zero.mutate.clients.update({ id: '123', name: 'Test' });
console.log('After mutation:', await view.data);  // Should show update
```

### 2. Lifecycle Management

```javascript
// ✅ Proper cleanup when component unmounts
const view = zero.query.jobs.materialize({ ttl: '30m' });

// When component unmounts:
view.destroy();
```

### 3. Mutation Best Practices

```javascript
// ✅ Optimistic updates with error handling
try {
  await zero.mutate.jobs.update({
    id: jobId,
    status: 'in-progress',
    updated_at: Date.now()
  });
  // UI updates automatically via materialized views
} catch (error) {
  console.error('Mutation failed:', error);
  // Handle rollback if needed
}
```

## Proposed ActiveRecord-Style Reactive Library

### Current Problem

Our generated model files use `createReactiveQuery` which:
- Creates static snapshots instead of reactive queries
- Doesn't integrate with Zero's CVR cache
- Requires manual refresh for updates

### Proposed Solution

Create a reactive wrapper that uses Zero's native reactivity:

```javascript
// New reactive model implementation
class ReactiveJob {
  constructor(id) {
    this.id = id;
    this.view = zero.query.jobs.where('id', id).materialize();
    this.data = $state(null);
    this.loading = $state(true);
    this.error = $state(null);
    
    // Subscribe to Zero updates
    this.subscribe();
  }

  async subscribe() {
    try {
      this.data = await this.view.data;
      this.loading = false;
    } catch (error) {
      this.error = error;
      this.loading = false;
    }
  }

  // Reactive getters
  get status() { return this.data?.status; }
  get title() { return this.data?.title; }
  
  // Reactive setters with automatic persistence
  set status(newStatus) {
    if (this.data) {
      this.data.status = newStatus;
      this.save();
    }
  }

  async save() {
    try {
      await zero.mutate.jobs.update({
        id: this.id,
        ...this.data,
        updated_at: Date.now()
      });
    } catch (error) {
      this.error = error;
    }
  }

  destroy() {
    this.view.destroy();
  }
}
```

### Usage Pattern

```javascript
// In Svelte component
const currentJob = new ReactiveJob(jobId);

// This automatically updates UI everywhere
currentJob.status = 'in-progress';
currentJob.title = 'Updated title';
```

## Svelte 5 Integration

### Custom Runes for Zero

```javascript
// Custom rune for Zero queries
function fZero(queryFn) {
  const view = queryFn().materialize();
  const data = $state(null);
  const loading = $state(true);
  const error = $state(null);

  // Subscribe to Zero updates
  view.data.then(result => {
    data = result;
    loading = false;
  }).catch(err => {
    error = err;
    loading = false;
  });

  return {
    get data() { return data; },
    get loading() { return loading; },
    get error() { return error; },
    destroy: () => view.destroy()
  };
}

// Usage in Svelte component
const jobs = fZero(() => zero.query.jobs.orderBy('created_at', 'desc'));
```

### Reactive Model Integration

```javascript
// In Svelte component
<script>
  import { ReactiveJob } from '$lib/zero/reactive-models';
  
  let currentJob = new ReactiveJob(jobId);
  
  // Cleanup on unmount
  onDestroy(() => currentJob.destroy());
</script>

<!-- UI automatically updates when job changes -->
<div class="job-status">{currentJob.status}</div>
<button onclick={() => currentJob.status = 'completed'}>
  Mark Complete
</button>
```

## Implementation Roadmap

### Phase 1: Fix Current Issues
1. ✅ Identify query lifecycle problems
2. ✅ Test Zero's native reactivity
3. ✅ Understand mutation behavior
4. ✅ Document findings (this document)

### Phase 2: Create Reactive Library
1. Design ReactiveModel base class
2. Create Svelte 5 rune integration
3. Implement reactive getters/setters
4. Add automatic persistence

### Phase 3: Migration
1. Update generated model files
2. Migrate existing components
3. Test reactive behavior
4. Performance optimization

### Phase 4: Advanced Features
1. Optimistic updates
2. Offline conflict resolution
3. Real-time collaboration
4. Advanced caching strategies

## Console Testing Patterns

### Testing Query Lifecycle
```javascript
// Test active queries
const view = zero.query.clients.materialize();
console.log('Active query:', await view.data);

// Test static queries
const static = await zero.query.clients.run();
console.log('Static query:', static);

// Test mutation reactivity
await zero.mutate.clients.update({ id: '123', name: 'Test' });
console.log('After mutation (active):', await view.data);
console.log('After mutation (static):', static); // Won't update
```

### Testing Permissions
```javascript
// Test RLS policies
try {
  const result = await zero.mutate.clients.insert({
    id: crypto.randomUUID(),
    name: 'Permission Test',
    created_at: Date.now(),
    updated_at: Date.now()
  });
  console.log('Insert result:', result);
} catch (error) {
  console.error('Permission error:', error);
}
```

## Common Pitfalls

### 1. Using Static Objects for UI
```javascript
// ❌ Don't do this - object won't update
const jobs = await zero.query.jobs.run();
const job = jobs[0];
// UI bound to `job` won't update after mutations
```

### 2. Forgetting to Clean Up Views
```javascript
// ❌ Memory leak - view never destroyed
const view = zero.query.jobs.materialize();

// ✅ Proper cleanup
onDestroy(() => view.destroy());
```

### 3. Not Using TTL for Background Queries
```javascript
// ❌ Query stops immediately when component unmounts
const view = zero.query.jobs.materialize();

// ✅ Query continues in background for 30 minutes
const view = zero.query.jobs.materialize({ ttl: '30m' });
```

## Performance Considerations

### 1. Query Optimization
- Use specific queries instead of fetching all data
- Implement proper TTL strategies
- Monitor Zero's 20MB client limit

### 2. View Management
- Destroy views when no longer needed
- Share views between components when possible
- Use backgrounding for frequently accessed data

### 3. Mutation Batching
- Batch related mutations when possible
- Use transactions for multi-table operations
- Implement optimistic updates for better UX

## Debugging Zero Issues

### 1. Check Query State
```javascript
console.log('Zero state:', window.zeroDebug.getZeroState());
console.log('User info:', window.zeroUserDebug);
```

### 2. Test Permissions
```sql
-- In Rails console
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'jobs';
```

### 3. Monitor Network
- Check WebSocket connections to Zero server
- Verify JWT token validity
- Monitor for permission errors

## Next Steps

1. **Implement Reactive Library**: Create the proposed ReactiveModel system
2. **Svelte 5 Integration**: Build custom runes for seamless integration
3. **Migrate Components**: Update existing components to use reactive patterns
4. **Performance Testing**: Ensure the reactive system performs well at scale
5. **Documentation**: Create component-level documentation for the team

## Conclusion

Zero.js provides powerful offline-first capabilities, but requires understanding its query lifecycle and reactive architecture. By using materialized views, proper cleanup, and reactive patterns, we can build truly responsive applications that work seamlessly online and offline.

The key insight is that **Zero's reactivity works perfectly** - we just need to use it correctly by creating active queries that stay synchronized with the server data.