# EP-0017: ZeroDataView to ReactiveView Migration

**Status**: Completed
**Priority**: High  
**Created**: 2025-08-01  
**Updated**: 2025-08-01  

## Summary

Migrate all components using the legacy `ZeroDataView` container to use the modern `ReactiveView` component. This standardizes our data container approach and provides enhanced features like progressive loading, flash prevention, and better state management.

## Background

The codebase currently has two data container components:
- **ZeroDataView**: Legacy component with basic state management
- **ReactiveView**: Modern component with ReactiveCoordinator integration

ReactiveView offers significant advantages:
- Progressive loading strategy (show stale data during refresh)
- Flash prevention for better UX
- Built-in display filtering
- Loading overlays for non-blocking updates
- Modern Svelte 5 snippet syntax
- Integrated with ReactiveCoordinator for advanced state management

## Goals

1. **Standardize on ReactiveView** for all data container needs
2. **Improve UX** with progressive loading and flash prevention
3. **Simplify codebase** by removing redundant components
4. **Modernize** to Svelte 5 patterns

## Technical Approach

### Phase 1: Jobs Page Migration
Convert `/jobs` page as the pilot implementation to validate the approach.

### Phase 2: Identify All ZeroDataView Usage
Scan codebase for all components using ZeroDataView.

### Phase 3: Systematic Migration
Convert each component following the established pattern.

### Phase 4: Deprecate ZeroDataView
Remove ZeroDataView component and update documentation.

## Migration Pattern

### Before (ZeroDataView):
```svelte
<ZeroDataView
  query={{
    data: jobsQuery.data,
    resultType: jobsQuery.resultType,
    error: jobsQuery.error,
  }}
  displayData={filteredData}
  emptyMessage="No items found"
  filteredEmptyMessage="No items match your filters"
>
  {#snippet content(data)}
    <!-- content -->
  {/snippet}
</ZeroDataView>
```

### After (ReactiveView):
```svelte
<ReactiveView 
  query={jobsQuery}
  displayFilters={filters}
  strategy="progressive"
>
  {#snippet content({ data })}
    <!-- content -->
  {/snippet}
  
  {#snippet empty({ data, displayFilters })}
    <div class="empty-state">
      <h2>{Object.keys(displayFilters).length > 0 
        ? "No items match your filters" 
        : "No items found"}</h2>
    </div>
  {/snippet}
</ReactiveView>
```

## Key Differences

1. **Props Structure**:
   - ZeroDataView: Takes separate `query` and `displayData`
   - ReactiveView: Takes only `query` with built-in `displayFilters`

2. **Filtering**:
   - ZeroDataView: External filtering with `$derived`
   - ReactiveView: Built-in `displayFilters` prop or custom filtering in content

3. **Empty State**:
   - ZeroDataView: Separate props for messages
   - ReactiveView: Full control via empty snippet

4. **Loading Strategy**:
   - ZeroDataView: Always blocks on loading
   - ReactiveView: Configurable progressive/blocking strategy

## Success Criteria

- [ ] All ZeroDataView instances migrated to ReactiveView
- [ ] No regression in functionality
- [ ] Improved loading UX with progressive strategy where appropriate
- [ ] ZeroDataView component removed from codebase
- [ ] Documentation updated

## Dependencies

- ReactiveView component (already implemented)
- ReactiveCoordinator (already implemented)
- ReactiveRecord models (already in use)

## Related Work

- EP-0010: ReactiveRecord V2 implementation
- EP-0012: Unified Default System

## Stories

1. **STORY-001**: Migrate /jobs page to ReactiveView
2. **STORY-002**: Audit codebase for ZeroDataView usage
3. **STORY-003**: Migrate remaining components
4. **STORY-004**: Remove ZeroDataView and update docs

## Notes

- Start with /jobs as it's a straightforward case
- Consider creating a codemod for automated migration if many instances exist
- Ensure proper testing of filtered empty states
- Document the migration pattern for team reference