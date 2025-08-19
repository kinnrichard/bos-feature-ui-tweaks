# Epic: Client-Filtered Conversations View

## Problem Statement

The current implementation at `/clients/[id]/conversations` displays ALL open conversations in the system rather than filtering to show only conversations belonging to the specific client. This creates a poor user experience where users see irrelevant conversations when viewing a client's conversation list.

The route exists and renders, but the filtering logic is incomplete with a TODO comment indicating the need for proper client-based filtering.

## Solution Overview

Leverage the recently implemented `clients_front_conversations` join table to efficiently filter conversations by client. The solution will:

1. Use the existing `ReactiveClient.includes('frontConversations')` relationship
2. Apply client-side filtering for open conversations (Zero.js doesn't support where conditions in includes)
3. Implement client-side sorting by `waiting_since_timestamp`
4. Create a query-like wrapper object for ConversationsListView compatibility
5. Remove unnecessary client-side filtering logic

## Success Criteria

- [ ] The `/clients/[id]/conversations` route shows ONLY conversations for the specified client
- [ ] Conversations are filtered to show only those with `status_category: 'open'`
- [ ] Conversations are sorted by `waiting_since_timestamp` in descending order (newest first)
- [ ] The view updates reactively when conversations are added/removed
- [ ] Query-like wrapper object properly implements the ReactiveQuery interface
- [ ] ConversationsListView component renders without errors or warnings
- [ ] Page remains responsive for clients with up to 500 conversations
- [ ] No regression in existing conversation list functionality

## Technical Approach

### Current Implementation Issues
- Query fetches all open conversations regardless of client
- TODO comment indicates missing client filtering
- Unnecessary client-side filtering function that doesn't actually filter by client

### Proposed Solution

Use the `ReactiveClient` model's `frontConversations` relationship to fetch client-specific conversations:

```typescript
// Get client with their conversations
const clientQuery = $derived(
  ReactiveClient
    .includes('frontConversations')
    .find(clientId)
);

// Filter for open conversations and sort client-side
const openConversations = $derived(() => {
  const conversations = clientQuery.data?.frontConversations || [];
  return conversations
    .filter(conv => conv.status_category === 'open')
    .sort((a, b) => {
      const aTime = a.waiting_since_timestamp || 0;
      const bTime = b.waiting_since_timestamp || 0;
      return bTime - aTime;
    });
});

// Create a query-like object for ConversationsListView compatibility
const conversationsQuery = $derived(() => ({
  data: openConversations,
  isLoading: clientQuery.isLoading,
  error: clientQuery.error,
  resultType: clientQuery.resultType,
  isCollection: true,
  present: openConversations.length > 0,
  blank: openConversations.length === 0,
  refresh: () => clientQuery.refresh(),
  destroy: () => clientQuery.destroy(),
  subscribe: (callback) => clientQuery.subscribe(() => callback(openConversations))
}));
```

### Why This Approach?

1. **Leverages Existing Relationships**: Uses the `frontConversations` relationship already defined in ReactiveClient
2. **Client-Side Filtering**: Since Zero.js doesn't support where conditions in includes(), we filter after loading
3. **Client-Side Sorting**: Sorts the filtered results by timestamp
4. **Maintains Reactivity**: Updates automatically when data changes through the query-like wrapper
5. **ConversationsListView Compatible**: The query-like object ensures compatibility with the existing component

## Implementation Tasks

### Task 1: Update Query Logic
**Priority**: High  
**Estimate**: 2 hours

Update `/frontend/src/routes/(authenticated)/clients/[id]/conversations/+page.svelte`:

1. Replace the current `conversationsQuery` with client relationship query using `ReactiveClient.includes('frontConversations')`
2. Implement client-side filtering for `status_category: 'open'`
3. Implement client-side sorting for `waiting_since_timestamp`
4. Create a query-like object that implements the ReactiveQuery interface for ConversationsListView compatibility

**Acceptance Criteria**:
- [ ] Query uses `ReactiveClient.includes('frontConversations')`
- [ ] Client-side filtering shows only open conversations
- [ ] Conversations are sorted by timestamp (newest first)
- [ ] Query-like object properly implements all ReactiveQuery properties and methods
- [ ] ConversationsListView renders without errors

### Task 2: Remove Unnecessary Code
**Priority**: Medium  
**Estimate**: 30 minutes

Clean up the component:

1. Remove the `filterClientConversations` function
2. Remove TODO comments
3. Simplify the data flow

**Acceptance Criteria**:
- [ ] No unused functions remain
- [ ] Code is clean and self-documenting

### Task 3: Handle Edge Cases
**Priority**: Medium  
**Estimate**: 1 hour

Ensure proper handling of:

1. Client not found
2. Client with no conversations
3. Loading states
4. Error states

**Acceptance Criteria**:
- [ ] 404 handling for invalid client IDs
- [ ] Appropriate empty state messaging
- [ ] Loading indicators during data fetch
- [ ] Error messages for failed queries

### Task 4: Add Tests
**Priority**: Medium  
**Estimate**: 2 hours

Create tests for:

1. Correct conversation filtering
2. Sorting behavior
3. Reactive updates
4. Edge case handling

**Test Cases**:
- [ ] Shows only conversations for the specified client
- [ ] Filters out closed conversations
- [ ] Sorts by timestamp correctly
- [ ] Updates when new conversations are added
- [ ] Handles missing client gracefully

### Task 5: Performance Monitoring
**Priority**: Medium  
**Estimate**: 1 hour

Add performance monitoring to track the impact of client-side filtering:

1. Add timing measurements for the filtering operation
2. Log warnings when conversation count exceeds thresholds
3. Monitor memory usage for large datasets
4. Consider adding a performance indicator in development mode

**Acceptance Criteria**:
- [ ] Console warnings appear when client has 500+ total conversations
- [ ] Filtering operation time is logged in development mode
- [ ] Performance metrics are easily accessible for future optimization

## Alternative Approaches Considered

### Direct Join Table Query (Not Viable)
Query `ClientsFrontConversation` directly to get conversation IDs, then fetch conversations:
- **Pros**: Would provide more control over the query
- **Cons**: Zero.js doesn't support where conditions in includes(), making this approach impractical

### Server-Side View
Create a server endpoint that returns filtered conversations:
- **Pros**: Complete control over sorting and filtering, better performance for large datasets
- **Cons**: Breaks reactivity pattern, requires API changes, adds complexity

### Zero.js Direct Query
Use `getZero()` for a custom query:
- **Pros**: Full SQL capabilities
- **Cons**: Bypasses ReactiveRecord patterns, harder to maintain, loses type safety

## Performance Considerations

### Current Approach Limitations
The client-side filtering approach has performance implications:

1. **Full Data Load**: All conversations for a client are loaded, then filtered client-side
2. **Memory Usage**: For clients with thousands of conversations, this could impact memory
3. **Network Transfer**: Unnecessary data is transferred for closed conversations

### Performance Thresholds
- **Acceptable**: Up to 500 total conversations per client
- **Degraded**: 500-2000 conversations (noticeable lag)
- **Problematic**: 2000+ conversations (may require pagination)

### Future Optimization Options
If performance becomes an issue:

1. **Server-Side Filtering**: Create a dedicated API endpoint for client conversations
2. **Pagination**: Implement virtual scrolling or pagination in ConversationsListView
3. **Caching Strategy**: Cache filtered results to avoid repeated filtering
4. **Background Updates**: Defer reactive updates for large datasets

## Dependencies

- Requires the `clients_front_conversations` join table (already implemented)
- Depends on ReactiveClient having the `frontConversations` relationship (confirmed present)
- Zero.js limitations: No support for where conditions in includes()

## Timeline

- **Day 1**: Implement query logic and remove unnecessary code (Tasks 1-2)
- **Day 2**: Handle edge cases and add tests (Tasks 3-4)
- **Day 3**: Performance testing and optimization if needed (Task 5)

## Rollback Plan

If issues arise:
1. Revert to showing all conversations (current behavior)
2. Add client-side filtering as a temporary measure
3. Investigation and fix of the root cause

The change is isolated to a single component, making rollback straightforward.

## Monitoring

Track after deployment:
- Page load times for the conversations view
- Error rates for the client conversations route
- User feedback on conversation filtering accuracy
- Performance metrics for clients with many conversations

## Success Metrics

- **Accuracy**: 100% of displayed conversations belong to the correct client
- **Performance**: 95th percentile load time under 500ms
- **Reliability**: Zero reported issues with missing conversations
- **User Satisfaction**: Positive feedback on the filtered view