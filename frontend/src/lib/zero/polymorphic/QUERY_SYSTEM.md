# Polymorphic Query System

A comprehensive query system for efficient polymorphic relationship querying with type safety, caching, and Svelte 5 reactive integration.

## Overview

The Polymorphic Query System provides a Rails-like, chainable query interface specifically designed for polymorphic relationships. It extends the existing `BaseScopedQuery` architecture with polymorphic-specific functionality while maintaining full integration with Zero.js.

## Architecture

```
┌─────────────────────┐
│   Reactive Queries  │ ← Svelte 5 reactive integration
├─────────────────────┤
│   Query Cache       │ ← Intelligent caching layer
├─────────────────────┤
│   Query Builder     │ ← Advanced query construction
├─────────────────────┤
│   ChainableQuery    │ ← Core query execution
├─────────────────────┤
│   PolymorphicQuery  │ ← Polymorphic query base
├─────────────────────┤
│   BaseScopedQuery   │ ← Existing query foundation
└─────────────────────┘
```

## Key Features

### 1. Type-Safe Polymorphic Queries
- Generic constraints for polymorphic types
- Compile-time validation of target types
- Integration with existing TypeScript definitions

### 2. Chainable Query API
- Rails-familiar method chaining
- Polymorphic-specific filtering methods
- Standard query methods (where, orderBy, limit, etc.)

### 3. Intelligent Caching
- Automatic cache key generation
- TTL-based expiration
- LRU eviction strategy
- Cache invalidation on data changes

### 4. Svelte 5 Reactive Integration
- Runes-based reactive state ($state, $derived, $effect)
- Auto-updating query results
- Optimistic updates with rollback
- Component lifecycle integration

### 5. Performance Optimization
- Query plan analysis
- Batch execution
- Eager loading optimization
- Memory-efficient caching

## Core Components

### ChainableQuery

The main query execution class that extends `PolymorphicQuery`:

```typescript
import { createNotableQuery } from '$lib/zero/polymorphic';

// Create a polymorphic query for notes
const noteQuery = createNotableQuery<NoteData>(noteConfig);

// Chain methods for filtering
const jobNotes = await noteQuery
  .forTargetType('Job')
  .forTargetId(123)
  .orderBy('created_at', 'desc')
  .limit(10)
  .all();
```

### PolymorphicQueryBuilder

Advanced query construction with complex options:

```typescript
import { createNotableQueryBuilder } from '$lib/zero/polymorphic';

const builder = createNotableQueryBuilder<NoteData>(noteConfig);

const complexQuery = await builder
  .withOptions({
    includeTargets: true,
    targetTypes: ['Job', 'Task'],
    groupByTargetType: true
  })
  .withAggregation({
    fields: ['id'],
    functions: ['count'],
    groupByTargetType: true
  })
  .build();

const results = await complexQuery.all();
```

### PolymorphicQueryCache

Intelligent caching for query optimization:

```typescript
import { executeCachedQuery, warmPolymorphicCache } from '$lib/zero/polymorphic';

// Execute with automatic caching
const cachedResults = await executeCachedQuery(noteQuery);

// Pre-warm cache for common queries
await warmPolymorphicCache(noteConfig, 'notable', ['Job', 'Task']);

// Get cache performance metrics
const metrics = polymorphicQueryCache.getMetrics();
console.log(`Hit ratio: ${metrics.hitRatio}`);
```

### ReactivePolymorphicQuery

Svelte 5 reactive queries with automatic updates:

```typescript
import { createReactivePolymorphicQuery } from '$lib/zero/polymorphic';

const reactiveNotes = createReactivePolymorphicQuery<NoteData>(
  noteConfig,
  'notable',
  { targetType: 'Job', targetId: 123 },
  { refreshInterval: 30000 }
);

// Access reactive state
$: notes = reactiveNotes.data;
$: loading = reactiveNotes.loading;
$: error = reactiveNotes.error;
```

## Usage Examples

### Basic Queries

```typescript
import { 
  createNotableQuery, 
  createLoggableQuery,
  createSchedulableQuery 
} from '$lib/zero/polymorphic';

// Notes for specific Job
const jobNotes = await createNotableQuery<NoteData>(noteConfig)
  .forTargetType('Job')
  .forTargetId(123)
  .all();

// Activity logs for multiple targets
const logs = await createLoggableQuery<ActivityLogData>(activityLogConfig)
  .forTargetType(['Job', 'Task', 'Client'])
  .orderBy('created_at', 'desc')
  .limit(50)
  .all();

// Scheduled items for Jobs
const scheduled = await createSchedulableQuery<ScheduledData>(scheduledConfig)
  .forTargetType('Job')
  .where({ status: 'pending' })
  .all();
```

### Advanced Filtering

```typescript
// Multiple polymorphic types
const multiTypeQuery = createPolymorphicQuery<NoteData>(noteConfig)
  .forPolymorphicType(['notable', 'loggable'])
  .forTargetType('Job')
  .all();

// With polymorphic targets included
const notesWithTargets = await createNotableQuery<NoteData>(noteConfig)
  .forTargetType(['Job', 'Task'])
  .includePolymorphicTargets({
    targetCallback: (query, targetType) => {
      if (targetType === 'Job') {
        return query.where({ status: 'active' });
      }
      return query;
    }
  })
  .all();
```

### Svelte Component Integration

```svelte
<script lang="ts">
  import { useReactivePolymorphicQuery, cleanupReactiveQuery } from '$lib/zero/polymorphic';
  import { onDestroy } from 'svelte';
  
  export let jobId: number;
  
  const { data, loading, error, refresh } = useReactivePolymorphicQuery(
    `job-notes-${jobId}`,
    noteConfig,
    'notable',
    { targetType: 'Job', targetId: jobId },
    { refreshInterval: 30000 }
  );
  
  onDestroy(() => {
    cleanupReactiveQuery(`job-notes-${jobId}`);
  });
</script>

<div class="notes-section">
  {#if $loading}
    <div class="loading">Loading notes...</div>
  {:else if $error}
    <div class="error">Error: {$error.message}</div>
  {:else}
    <div class="notes">
      {#each $data as note (note.id)}
        <div class="note">
          <p>{note.content}</p>
          <small>{note.created_at}</small>
        </div>
      {/each}
    </div>
  {/if}
  
  <button onclick={refresh}>Refresh</button>
</div>
```

### Model Integration

```typescript
class Note extends ActiveRecord<NoteData> {
  // Create polymorphic query methods
  static async findByJob(jobId: number): Promise<Note[]> {
    const query = createNotableQuery<NoteData>(Note.config)
      .forTargetType('Job')
      .forTargetId(jobId);
    
    const data = await executeCachedQuery(query);
    return data.map(noteData => new Note(noteData));
  }
  
  static createReactiveQueryForJob(jobId: number) {
    return createReactivePolymorphicQuery<NoteData>(
      Note.config,
      'notable',
      { targetType: 'Job', targetId: jobId }
    );
  }
  
  // Instance method for related notes
  async getRelatedNotes(): Promise<Note[]> {
    if (!this.notable_type || !this.notable_id) return [];
    
    const query = createNotableQuery<NoteData>(Note.config)
      .forTargetType(this.notable_type)
      .forTargetId(this.notable_id)
      .where({ id: { neq: this.id } });
    
    const data = await query.all();
    return data.map(noteData => new Note(noteData));
  }
}
```

## Query Methods

### Polymorphic-Specific Methods

| Method | Description | Example |
|--------|-------------|---------|
| `forPolymorphicType()` | Filter by polymorphic type | `.forPolymorphicType('notable')` |
| `forTargetType()` | Filter by target model type | `.forTargetType('Job')` |
| `forTargetId()` | Filter by target ID(s) | `.forTargetId([123, 456])` |
| `includePolymorphicTargets()` | Include target records | `.includePolymorphicTargets()` |
| `includePolymorphic()` | Include specific relationship | `.includePolymorphic('notable')` |

### Standard Query Methods

| Method | Description | Example |
|--------|-------------|---------|
| `where()` | Add conditions | `.where({ status: 'active' })` |
| `orderBy()` | Order results | `.orderBy('created_at', 'desc')` |
| `limit()` | Limit results | `.limit(10)` |
| `offset()` | Skip results | `.offset(20)` |
| `includes()` | Include relationships | `.includes('user')` |

### Execution Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `all()` | Get all results | `Promise<T[]>` |
| `first()` | Get first result | `Promise<T \| null>` |
| `count()` | Get result count | `Promise<number>` |
| `exists()` | Check existence | `Promise<boolean>` |
| `paginate()` | Get paginated results | `Promise<PaginationResult<T>>` |

## Factory Functions

### Basic Queries

```typescript
// Create polymorphic queries for each type
createPolymorphicQuery<T>(config, polymorphicType?)
createNotableQuery<T>(config)
createLoggableQuery<T>(config)
createSchedulableQuery<T>(config)
createTargetQuery<T>(config)
createParseableQuery<T>(config)
```

### Query Builders

```typescript
// Create advanced query builders
createNotableQueryBuilder<T>(config)
createLoggableQueryBuilder<T>(config)
createSchedulableQueryBuilder<T>(config)
createTargetQueryBuilder<T>(config)
createParseableQueryBuilder<T>(config)
```

### Reactive Queries

```typescript
// Create reactive queries for Svelte 5
createReactivePolymorphicQuery<T>(config, type?, conditions?, options?)
createReactiveNotableQuery<T>(config, conditions?, options?)
createReactiveLoggableQuery<T>(config, conditions?, options?)
createReactiveSchedulableQuery<T>(config, conditions?, options?)
createReactiveTargetQuery<T>(config, conditions?, options?)
createReactiveParseableQuery<T>(config, conditions?, options?)
```

## Performance Features

### Query Optimization

```typescript
// Analyze query performance
const builder = createNotableQueryBuilder<NoteData>(noteConfig);
const queryPlan = await builder.analyzeQueryPlan();

console.log({
  estimatedCost: queryPlan.estimatedCost,
  optimizations: queryPlan.optimizations,
  joinStrategy: queryPlan.joinStrategy
});

// Create optimized query
const optimizedQuery = await createOptimizedPolymorphicQuery({
  config: noteConfig,
  polymorphicType: 'notable',
  targetTypes: ['Job'],
  includeTargets: true,
  batchSize: 100,
  analyzeFirst: true
});
```

### Batch Execution

```typescript
// Execute multiple target types in parallel
const batchExecutor = PolymorphicQueryBuilder.createBatchExecutor<NoteData>(
  noteConfig,
  'notable'
);

const results = await batchExecutor.executeForTargets(['Job', 'Task', 'Client']);
console.log({
  jobs: results.Job?.length || 0,
  tasks: results.Task?.length || 0,
  clients: results.Client?.length || 0
});
```

### Cache Configuration

```typescript
// Configure cache settings
const cache = new PolymorphicQueryCache({
  maxSize: 2000,
  defaultTTL: 10 * 60 * 1000, // 10 minutes
  memoryLimit: 100, // 100MB
  typeTTL: {
    notable: 15 * 60 * 1000,    // 15 minutes for notes
    loggable: 5 * 60 * 1000,    // 5 minutes for logs
    schedulable: 30 * 60 * 1000 // 30 minutes for schedules
  }
});
```

## Integration Points

### Zero.js Integration
- Uses Zero.js `related()` method for joins
- Leverages Zero.js memory management
- Compatible with Zero.js query syntax

### BaseScopedQuery Integration
- Extends existing `BaseScopedQuery` functionality
- Compatible with existing `includes()` patterns
- Maintains relationship validation

### ReactiveRecord Integration
- Works with ReactiveRecord patterns
- Automatic cache invalidation
- Reactive state management

## Best Practices

### 1. Use Specific Queries
```typescript
// Good: Use specific query types
const jobNotes = await createNotableQuery<NoteData>(noteConfig)
  .forTargetType('Job')
  .all();

// Avoid: Generic queries when specific type is known
const allNotes = await createPolymorphicQuery<NoteData>(noteConfig)
  .forPolymorphicType('notable')
  .forTargetType('Job')
  .all();
```

### 2. Leverage Caching
```typescript
// Good: Use cached execution for repeated queries
const cachedResults = await executeCachedQuery(query);

// Consider: Warm cache for common queries
await warmPolymorphicCache(noteConfig, 'notable', ['Job', 'Task']);
```

### 3. Use Reactive Queries in Components
```typescript
// Good: Use reactive queries for real-time updates
const reactiveQuery = useReactivePolymorphicQuery(
  'job-notes',
  noteConfig,
  'notable',
  { targetType: 'Job', targetId: jobId }
);

// Remember: Clean up on component unmount
onDestroy(() => {
  cleanupReactiveQuery('job-notes');
});
```

### 4. Optimize Performance
```typescript
// Good: Use batch execution for multiple target types
const batchExecutor = PolymorphicQueryBuilder.createBatchExecutor(config, type);
const results = await batchExecutor.executeForTargets(['Job', 'Task']);

// Good: Analyze query plans for optimization
const plan = await builder.analyzeQueryPlan();
```

## Error Handling

```typescript
try {
  const results = await createNotableQuery<NoteData>(noteConfig)
    .forTargetType('InvalidType') // Will validate against config
    .all();
} catch (error) {
  if (error instanceof RelationshipError) {
    console.error('Invalid polymorphic target:', error.message);
  }
}
```

## Testing

```typescript
import { 
  createNotableQuery,
  polymorphicQueryCache,
  createReactivePolymorphicQuery 
} from '$lib/zero/polymorphic';

// Test basic queries
test('should filter notes by target type', async () => {
  const jobNotes = await createNotableQuery<NoteData>(noteConfig)
    .forTargetType('Job')
    .all();
  
  expect(jobNotes).toBeInstanceOf(Array);
  expect(jobNotes.every(note => note.notable_type === 'Job')).toBe(true);
});

// Test caching
test('should cache query results', async () => {
  const query = createNotableQuery<NoteData>(noteConfig).forTargetType('Job');
  
  await polymorphicQueryCache.execute(query);
  const cachedResult = await polymorphicQueryCache.get(query);
  
  expect(cachedResult).toBeDefined();
});

// Test reactive queries
test('should update reactive query state', async () => {
  const reactiveQuery = createReactivePolymorphicQuery<NoteData>(
    noteConfig,
    'notable',
    { targetType: 'Job' }
  );
  
  expect(reactiveQuery.loading).toBe(true);
  
  // Wait for initial load
  await new Promise(resolve => setTimeout(resolve, 100));
  
  expect(reactiveQuery.loading).toBe(false);
  expect(reactiveQuery.data).toBeInstanceOf(Array);
  
  reactiveQuery.destroy();
});
```

## File Structure

```
src/lib/zero/polymorphic/
├── query-system.ts        # Core ChainableQuery and PolymorphicQuery
├── query-builder.ts       # Advanced PolymorphicQueryBuilder
├── query-cache.ts         # Caching layer with TTL and LRU
├── reactive-queries.ts    # Svelte 5 reactive integration
├── query-examples.ts      # Comprehensive usage examples
├── QUERY_SYSTEM.md        # This documentation
└── index.ts              # Exports all query system components
```

## Related Documentation

- [Polymorphic Tracking System](./README.md) - Core polymorphic system
- [Model Integration](./IMPLEMENTATION.md) - ActiveRecord/ReactiveRecord integration
- [Base Scoped Query](../models/base/scoped-query-base.ts) - Foundation query system
- [Zero.js Integration](../zero-client.ts) - Database connection layer

## Migration Guide

### From Direct Zero.js Queries

```typescript
// Before: Direct Zero.js usage
const zero = getZero();
const notes = await zero.query.notes
  .where('notable_type', 'Job')
  .where('notable_id', 123)
  .run();

// After: Polymorphic query system
const notes = await createNotableQuery<NoteData>(noteConfig)
  .forTargetType('Job')
  .forTargetId(123)
  .all();
```

### From BaseScopedQuery

```typescript
// Before: Generic scoped query
class NoteQuery extends BaseScopedQuery<NoteData> {
  forJob(jobId: number) {
    return this.where({ notable_type: 'Job', notable_id: jobId });
  }
}

// After: Polymorphic query
const jobNotes = await createNotableQuery<NoteData>(noteConfig)
  .forTargetType('Job')
  .forTargetId(jobId)
  .all();
```

## Contributing

When extending the query system:

1. **Maintain Type Safety**: Ensure all new features preserve TypeScript type safety
2. **Follow Patterns**: Use existing patterns for factory functions and method chaining
3. **Update Examples**: Add examples for new features in `query-examples.ts`
4. **Test Coverage**: Add comprehensive tests for new functionality
5. **Performance**: Consider caching and optimization for new features

---

*Generated: 2025-08-06 Epic-008 Polymorphic Query System Documentation*