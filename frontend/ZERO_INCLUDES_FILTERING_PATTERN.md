# Zero.js includes() Client-Side Filtering Pattern

## Quick Reference

**Problem**: Zero.js `includes()` queries cannot filter on included relationships with `WHERE` clauses.

**Solution**: Load all related data via `includes()`, then filter and sort client-side with a ReactiveQuery wrapper.

## Implementation Example

```typescript
// 1. Load parent with all related data
const clientQuery = $derived(ReactiveClient.includes('frontConversations').find(clientId));

// 2. Create filtered reactive query wrapper
const conversationsQuery = $derived.by(() => {
  const conversations = clientQuery.data?.frontConversations || [];
  
  // Client-side filtering and sorting
  const filtered = conversations
    .filter(conv => conv.status_category === 'open')
    .sort((a, b) => new Date(b.waiting_since_timestamp || 0).getTime() - 
                    new Date(a.waiting_since_timestamp || 0).getTime());

  // Return ReactiveQuery-compatible wrapper
  return {
    data: filtered,
    isLoading: clientQuery.isLoading,
    error: clientQuery.error,
    resultType: clientQuery.resultType,
    isCollection: true,
    present: filtered.length > 0,
    blank: filtered.length === 0,
    refresh: () => clientQuery.refresh(),
    destroy: () => clientQuery.destroy(),
    subscribe: (callback) => clientQuery.subscribe(() => {
      callback(filtered, { 
        isLoading: clientQuery.isLoading, 
        error: clientQuery.error 
      });
    })
  };
});

// 3. Use with existing components
<ConversationsListView query={conversationsQuery} />
```

## When to Use

- ✅ Small to medium datasets (< 1000 related records)
- ✅ Need reactive updates and real-time filtering
- ✅ Want to maintain component compatibility
- ✅ Network efficiency is prioritized

## When Not to Use

- ❌ Large datasets (> 1000 related records)
- ❌ Complex server-side filtering would be more efficient
- ❌ Memory constraints are a concern

## Reference Implementation

See `/src/routes/(authenticated)/clients/[id]/conversations/+page.svelte` for a complete working example.

## Documentation

- **[Complete Pattern Guide](./src/lib/patterns/client-side-filtering-with-includes.md)** - Comprehensive documentation
- **[Zero.js README](./src/lib/zero/README.md)** - Updated with includes() limitations
- **[Migration Guide](./src/lib/zero/migration-guide.md)** - Includes migration examples

## Key Benefits

1. **Maintains Reactivity**: Real-time updates when data changes
2. **Component Compatible**: Works with existing ReactiveQuery-based components  
3. **Network Efficient**: Single query loads all required data
4. **Error Handling**: Inherits robust error handling from parent query

This pattern provides a clean workaround for Zero.js limitations while maintaining all the benefits of reactive queries.