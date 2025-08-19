---
epic_id: EP-0006
title: Implement Task Hierarchy Deletion Logic
description: Hide descendants of deleted tasks from normal task lists while keeping them accessible in deleted task view using calculated property approach
status: planning
priority: high
assignee: claude
created_date: 2025-07-21T18:30:00.000Z
updated_date: 2025-07-21T18:30:00.000Z
estimated_tokens: 30000
actual_tokens: 0
ai_context:
  - app/models/task.rb
  - app/serializers/task_serializer.rb
  - app/services/task_sorting_service.rb
  - frontend/src/lib/stores/task-store.svelte.ts
  - frontend/src/lib/components/tasks/
  - test/models/task_test.rb
sync_status: local
related_issues:
  - ISS-0013
  - ISS-0014
  - ISS-0015
  - ISS-0016
  - ISS-0017
dependencies: []
completion_percentage: 0
---

# Epic: Implement Task Hierarchy Deletion Logic

## Overview
Currently, when a parent task is deleted/discarded, its descendant tasks continue to appear in normal task lists, which can be confusing for users. This epic implements a clean architecture solution that hides descendants of deleted tasks from normal views while keeping them accessible when viewing deleted tasks, using calculated properties rather than cascade deletion to preserve individual task states.

## Problem Statement

### Current Behavior Issues
1. **Orphaned Descendants**: When a parent task is deleted, child and grandchild tasks remain visible in normal task lists
2. **Data Inconsistency**: Task hierarchy appears broken to users when parent tasks are missing
3. **Restoration Complexity**: Currently requires restoring all descendants individually when restoring a parent
4. **User Confusion**: Users see tasks without context when their parents are deleted

### Business Requirements
- Deleted task descendants should not appear in normal task views
- Descendants should be accessible when explicitly viewing deleted tasks
- Only the parent task should need restoration for descendants to reappear
- Individual task states (deleted/active) should be preserved for granular control

## Solution Architecture

### Calculated Property Approach
Use backend calculated properties combined with frontend filtering rather than cascade deletion:

1. **Backend**: Add `has_discarded_ancestor` method to Task model
2. **Serialization**: Include calculated property in API responses
3. **Frontend**: Update filtering logic to respect calculated property
4. **Performance**: Optimize queries in TaskSortingService when needed

### Key Benefits
- **Clean Restoration**: Only parent needs to be restored
- **Individual Control**: Each task retains its own deleted state
- **Data Integrity**: No actual cascade deletion, just calculated visibility
- **Backward Compatible**: Existing task states preserved

## Objectives
- [ ] Implement `has_discarded_ancestor` calculated property in Task model
- [ ] Update TaskSerializer to include discarded_at and ancestor calculation
- [ ] Modify frontend shouldShowTask filtering logic
- [ ] Ensure deleted task view shows descendants when parent is deleted
- [ ] Add comprehensive test coverage for hierarchy deletion behavior
- [ ] Document new behavior in API and frontend code
- [ ] Optional: Optimize performance in TaskSortingService if needed

## Acceptance Criteria

### Backend Requirements
- [ ] Task model has `has_discarded_ancestor` method that checks if any ancestor is discarded
- [ ] TaskSerializer includes `discarded_at` field and calculated `has_discarded_ancestor` property
- [ ] Method efficiently traverses ancestry chain without N+1 queries
- [ ] Handles edge cases (orphaned tasks, circular references, deep hierarchies)

### Frontend Requirements
- [ ] `shouldShowTask` logic updated to check `has_discarded_ancestor` property
- [ ] Normal task lists hide tasks with `has_discarded_ancestor: true`
- [ ] Deleted task view shows tasks with `discarded_at !== null` regardless of ancestor state
- [ ] Task restoration properly triggers recalculation of descendant visibility

### User Experience
- [ ] Deleting a parent task immediately hides all descendants from normal views
- [ ] Descendants appear in deleted task view when their ancestor is deleted
- [ ] Restoring a parent task immediately shows all non-deleted descendants
- [ ] Individual descendant restoration still works independently

### Testing Requirements
- [ ] Unit tests for `has_discarded_ancestor` method with various hierarchy scenarios
- [ ] Integration tests for TaskSerializer including calculated properties
- [ ] Frontend tests for updated shouldShowTask logic
- [ ] End-to-end tests for complete user workflows

## Implementation Plan

### Phase 1: Backend Implementation
1. **Task Model Enhancement**
   - Add `has_discarded_ancestor` instance method
   - Implement efficient ancestry traversal
   - Handle edge cases and performance considerations

2. **Serializer Updates**
   - Add `discarded_at` to serialized attributes
   - Include `has_discarded_ancestor` calculated property
   - Ensure proper JSON API format

### Phase 2: Frontend Implementation  
1. **Store Logic Updates**
   - Update `shouldShowTask` in task store
   - Ensure proper reactive updates when tasks change
   - Handle deleted task view separately

2. **Component Integration**
   - Update task list components to use new filtering
   - Ensure deleted task views work correctly
   - Test task restoration flows

### Phase 3: Testing & Optimization
1. **Comprehensive Testing**
   - Unit tests for backend logic
   - Integration tests for API responses
   - Frontend testing for filtering behavior
   - E2E tests for complete workflows

2. **Performance Optimization** (if needed)
   - Analyze query performance with large hierarchies
   - Consider caching strategies for calculated properties
   - Optimize TaskSortingService if bottlenecks identified

## Technical Considerations

### Backend Implementation Details

#### Task Model Method
```ruby
def has_discarded_ancestor
  return false unless parent_id
  
  # Traverse up the hierarchy checking for discarded ancestors
  current_parent = parent
  while current_parent
    return true if current_parent.discarded_at.present?
    current_parent = current_parent.parent
  end
  
  false
end
```

#### Serializer Enhancement
```ruby
# In TaskSerializer
attribute :discarded_at
attribute :has_discarded_ancestor

def has_discarded_ancestor
  object.has_discarded_ancestor
end
```

### Frontend Implementation Details

#### Updated Filtering Logic
```typescript
const shouldShowTask = (task: Task, showDeleted: boolean = false): boolean => {
  // When showing deleted tasks, show if task itself is deleted
  if (showDeleted) {
    return task.discarded_at !== null;
  }
  
  // For normal views, hide if task or any ancestor is deleted
  return task.discarded_at === null && !task.has_discarded_ancestor;
};
```

### Database Performance
- Consider indexing strategies for parent_id traversal
- Monitor query performance with deep hierarchies
- Evaluate need for materialized path or nested set models if performance becomes critical

### Caching Considerations
- Calculated properties may benefit from caching for frequently accessed tasks
- Consider cache invalidation strategies when task hierarchy changes
- Monitor memory usage with large task sets

## Risks & Mitigation

### Performance Risk
**Risk**: Ancestor traversal could be expensive for deep hierarchies
**Mitigation**: 
- Implement query optimization in TaskSortingService
- Consider hierarchy depth limits
- Add performance monitoring and alerting

### Data Consistency Risk
**Risk**: Race conditions when updating hierarchy and deletion states
**Mitigation**:
- Use database transactions for related operations
- Implement proper locking mechanisms
- Add data validation and integrity checks

### UI Complexity Risk
**Risk**: User confusion about why tasks disappear when parents are deleted
**Mitigation**:
- Add clear UI indicators when tasks are hidden due to deleted ancestors
- Provide easy navigation to deleted task view
- Document behavior in user help system

## Success Metrics
- All acceptance criteria met
- Zero performance regression in task list rendering
- Improved user satisfaction with task hierarchy management
- Clean, maintainable code with comprehensive test coverage
- Successful deployment without data migration requirements

## Related Issues

### Created Issues for Implementation
- **[ISS-0013](../issues/ISS-0013-add-has-discarded-ancestor-method-to-task-model.md)**: Add has_discarded_ancestor method to Task model
- **[ISS-0014](../issues/ISS-0014-update-task-serializer-include-calculated-properties.md)**: Update TaskSerializer to include calculated properties  
- **[ISS-0015](../issues/ISS-0015-update-frontend-shouldShowTask-filtering-logic.md)**: Update frontend shouldShowTask filtering logic
- **[ISS-0016](../issues/ISS-0016-comprehensive-test-coverage-hierarchy-deletion.md)**: Add comprehensive test coverage for hierarchy deletion
- **[ISS-0017](../issues/ISS-0017-optimize-task-sorting-service-hierarchy-performance.md)**: Optional performance optimization for TaskSortingService

## Related Work
- Task deletion and restoration workflows
- Task hierarchy management improvements
- Performance optimization initiatives
- API consistency improvements

## Future Enhancements
- Consider implementing similar logic for other hierarchical data
- Evaluate materialized path or nested set models for complex hierarchies
- Add bulk operations for hierarchy management
- Implement audit trail for hierarchy changes

## Notes
- This implementation preserves all existing data and is fully backward compatible
- No database migrations required beyond existing discarded_at column
- Solution can be implemented incrementally with feature flags if needed
- Consider adding user preference for showing/hiding orphaned descendants