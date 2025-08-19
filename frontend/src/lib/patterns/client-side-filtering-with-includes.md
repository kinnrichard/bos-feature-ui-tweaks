# Client-Side Filtering with Zero.js includes() Pattern

## Overview

This pattern addresses Zero.js limitations where:
1. `includes()` queries cannot be combined with `WHERE` clauses on the included relationships
2. Many-to-many relationships cannot be directly accessed via `includes()` and require querying through join tables

It provides clean solutions to filter and sort related data client-side while maintaining reactivity and component compatibility.

## When to Use This Pattern

### ✅ Good Use Cases
- **Small to medium datasets** (< 1000 related records)
- **Real-time filtering requirements** with reactive updates
- **Component compatibility** with existing ReactiveQuery interfaces
- **Performance is acceptable** for client-side operations
- **Network efficiency** is prioritized over memory usage

### ❌ Avoid for
- **Large datasets** (> 1000 related records)
- **Complex filtering logic** that would be more efficient server-side
- **Memory-constrained environments**
- **Scenarios where server-side pagination is required**

## Implementation Pattern

### 1. Basic Structure

```typescript
// Base query with includes() - loads all related data
const parentQuery = $derived(ReactiveParent.includes('relationName').find(parentId));

// Client-side filtering wrapper
const filteredQuery = $derived.by(() => {
  const parent = parentQuery.data;
  const relations = parent?.relationName || [];
  
  // Apply filtering logic
  const filtered = relations.filter(/* filtering logic */);
  
  // Apply sorting logic
  const sorted = filtered.sort(/* sorting logic */);

  // Return ReactiveQuery-compatible wrapper
  const wrapper: ReactiveQuery<DataType[]> = {
    data: sorted,
    isLoading: parentQuery.isLoading,
    error: parentQuery.error,
    resultType: parentQuery.resultType,
    isCollection: true,
    present: sorted.length > 0,
    blank: sorted.length === 0,
    refresh: () => parentQuery.refresh(),
    destroy: () => parentQuery.destroy(),
    subscribe: (callback) => parentQuery.subscribe(() => {
      callback(sorted, { 
        isLoading: parentQuery.isLoading, 
        error: parentQuery.error 
      });
    })
  };

  return wrapper;
});
```

### 2. Real-World Example: Client Conversations

**File**: `/src/routes/(authenticated)/clients/[id]/conversations/+page.svelte`

```typescript
// Load client with all conversations
const clientQuery = $derived(ReactiveClient.includes('frontConversations').find(clientId));

// Filter for open conversations and sort by timestamp
const conversationsQuery = $derived.by(() => {
  const client = clientQuery.data;
  const conversations = client?.frontConversations || [];
  
  // Filter to only open conversations
  const openConversations = conversations.filter((conv) => 
    conv.status_category === 'open'
  );
  
  // Sort by waiting_since_timestamp (newest first)
  const sortedConversations = openConversations.sort((a, b) => {
    const timeA = a.waiting_since_timestamp ? new Date(a.waiting_since_timestamp).getTime() : 0;
    const timeB = b.waiting_since_timestamp ? new Date(b.waiting_since_timestamp).getTime() : 0;
    return timeB - timeA; // descending order
  });

  // ReactiveQuery wrapper for component compatibility
  const wrapper: ReactiveQuery<FrontConversationData[]> = {
    data: sortedConversations,
    isLoading: clientQuery.isLoading,
    error: clientQuery.error,
    resultType: clientQuery.resultType,
    isCollection: true,
    present: sortedConversations.length > 0,
    blank: sortedConversations.length === 0,
    refresh: () => clientQuery.refresh(),
    destroy: () => clientQuery.destroy(),
    subscribe: (callback) => clientQuery.subscribe(() => {
      callback(sortedConversations, { 
        isLoading: clientQuery.isLoading, 
        error: clientQuery.error 
      });
    })
  };

  return wrapper;
});
```

## Key Benefits

### 1. **Reactivity Preservation**
- Maintains real-time updates when parent or related data changes
- Automatically re-filters and re-sorts when data updates
- Works seamlessly with Svelte's reactive system

### 2. **Component Compatibility**
- Provides standard ReactiveQuery interface
- Can be used with existing components expecting ReactiveQuery
- Supports all standard query operations (refresh, destroy, subscribe)

### 3. **Network Efficiency**
- Single query loads all required data
- Reduces server round-trips compared to separate queries
- Leverages Zero.js includes() optimization

### 4. **Error Handling**
- Inherits error handling from parent query
- Provides consistent error states across filtering operations
- Maintains loading states during parent query operations

### 5. **Many-to-Many Relationships**

For many-to-many relationships, query through the join table:

```typescript
// Step 1: Query join table
const joinTableQuery = ReactiveClientsFrontConversation
  .where({ client_id: clientId })
  .all();

// Step 2: Extract target IDs
const conversationIds = joinTableQuery.data?.map(r => r.front_conversation_id) || [];

// Step 3: Query target table with ID filter
const targetQuery = ReactiveFrontConversation
  .where({ status_category: 'open' })
  .all();

// Step 4: Filter by IDs client-side
const filtered = targetQuery.data?.filter(item => conversationIds.includes(item.id));
```

## Performance Considerations

### Memory Usage
```typescript
// Monitor relationship size for performance impact
const conversations = client?.frontConversations || [];
console.log(`Filtering ${conversations.length} conversations client-side`);

// Consider server-side filtering for large datasets
if (conversations.length > 1000) {
  console.warn('Large dataset detected - consider server-side filtering');
}
```

### Computation Efficiency
```typescript
// Use efficient filtering predicates
const filtered = conversations.filter((conv) => {
  // Avoid expensive operations in filter
  return conv.status_category === 'open'; // ✅ Simple property check
});

// Optimize sorting comparisons
const sorted = filtered.sort((a, b) => {
  // Cache computed values when possible
  const timeA = a.cached_timestamp || computeTimestamp(a);
  const timeB = b.cached_timestamp || computeTimestamp(b);
  return timeB - timeA;
});
```

## Alternative Approaches

### 1. Separate Query (for large datasets)
```typescript
// When client-side filtering isn't optimal
const conversationsQuery = ReactiveFrontConversation
  .where('client_id', clientId)
  .where('status_category', 'open')
  .orderBy('waiting_since_timestamp', 'desc')
  .all();
```

### 2. Custom API Endpoint (for complex filtering)
```typescript
// When filtering logic is too complex for client-side
const conversationsQuery = createReactiveQuery(
  () => executeQuery(
    (client) => client.api.clientConversations({
      clientId,
      status: 'open',
      sortBy: 'waiting_since_timestamp',
      sortOrder: 'desc'
    })
  )
);
```

### 3. Hybrid Approach (for performance optimization)
```typescript
// Load a subset with includes(), fetch more as needed
const clientQuery = ReactiveClient
  .includes('frontConversations', { limit: 50 }) // If supported
  .find(clientId);

// Additional query for more data if needed
const additionalQuery = ReactiveFrontConversation
  .where('client_id', clientId)
  .where('status_category', 'open')
  .offset(50)
  .all();
```

## Testing Considerations

### Unit Testing
```typescript
// Test filtering logic separately
describe('conversation filtering', () => {
  it('filters open conversations', () => {
    const conversations = [
      { status_category: 'open', id: '1' },
      { status_category: 'closed', id: '2' },
      { status_category: 'open', id: '3' }
    ];
    
    const filtered = conversations.filter(conv => conv.status_category === 'open');
    expect(filtered).toHaveLength(2);
    expect(filtered.map(c => c.id)).toEqual(['1', '3']);
  });
});
```

### Integration Testing
```typescript
// Test the complete pattern with real data
describe('client conversations page', () => {
  it('shows only open conversations for client', async () => {
    // Setup test data
    const client = await createTestClient();
    await createTestConversation(client.id, { status_category: 'open' });
    await createTestConversation(client.id, { status_category: 'closed' });
    
    // Test the page
    const page = await render(ClientConversationsPage, { clientId: client.id });
    
    // Should only show open conversation
    expect(page.getAllByRole('article')).toHaveLength(1);
  });
});
```

## Migration Guide

### From Separate Queries
```typescript
// Before: Two separate queries
const clientQuery = ReactiveClient.find(clientId);
const conversationsQuery = ReactiveFrontConversation
  .where('client_id', clientId)
  .where('status_category', 'open')
  .all();

// After: Single query with client-side filtering
const clientQuery = ReactiveClient.includes('frontConversations').find(clientId);
const conversationsQuery = $derived.by(() => {
  // ... filtering pattern as shown above
});
```

### From Non-Reactive Approaches
```typescript
// Before: Manual data fetching
let conversations = [];
onMount(async () => {
  const client = await fetchClient(clientId);
  conversations = client.frontConversations.filter(c => c.status_category === 'open');
});

// After: Reactive pattern
const conversationsQuery = $derived.by(() => {
  // ... reactive filtering pattern
});
```

## Documentation Standards

When implementing this pattern, include these comments:

```typescript
// Epic/Feature reference for context
// Zero.js limitation explanation
// Performance considerations for the dataset size
// Alternative approaches considered
// Component compatibility notes
```

## Related Patterns

- **[ReactiveQuery Wrapper Pattern](./reactive-query-wrapper.md)** - For creating custom reactive queries
- **[Zero.js Includes Optimization](../zero/includes-optimization.md)** - For optimizing includes() queries
- **[Client-Side Search Patterns](./client-side-search.md)** - For implementing search with this pattern

---

This pattern provides a robust solution for Zero.js includes() limitations while maintaining the benefits of reactive queries and component compatibility. Use it when the dataset size and performance characteristics align with client-side filtering requirements.