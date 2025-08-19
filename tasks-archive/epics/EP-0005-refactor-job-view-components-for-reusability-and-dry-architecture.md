---
epic_id: EP-0005
title: Refactor job view components for reusability and DRY architecture
description: Refactor the modern Svelte frontend job-related components to eliminate code duplication, improve reusability, and establish consistent patterns across the application
status: completed
priority: medium
assignee: claude
created_date: 2025-07-19T19:58:23.875Z
updated_date: 2025-07-21T18:46:00.000Z
estimated_tokens: 50000
actual_tokens: 45000
ai_context:
  - frontend/src/lib/components/jobs/
  - frontend/src/lib/components/tasks/
  - frontend/src/lib/components/ui/
  - frontend/src/lib/components/layout/
  - frontend/src/lib/utils/
  - frontend/src/lib/stores/
sync_status: local
related_issues:
  - ISS-0006
  - ISS-0007
  - ISS-0008
  - ISS-0009
  - ISS-0010
  - ISS-0011
dependencies: []
completion_percentage: 100
---

# Epic: Refactor job view components for reusability and DRY architecture

## Overview
The modern Svelte frontend has grown organically and now contains significant code duplication across job-related components. This epic focuses on refactoring these components to follow DRY principles, improve reusability, and establish consistent patterns that can scale with the application.

## Current State Analysis

### Key Findings
1. **Component Duplication**:
   - Multiple popover implementations (JobStatusButton, TechnicianAssignmentButton, SchedulePriorityEditPopover, TaskInfoPopover, FilterPopover)
   - Repeated status/priority emoji logic across components
   - Similar editing patterns in JobDetailView and TaskRow
   - Duplicated validation and error handling

2. **Inconsistent Patterns**:
   - Mixed approaches to state management (some use stores, others local state)
   - Different popover positioning strategies
   - Inconsistent event handling patterns
   - Varied approaches to contenteditable elements

3. **Large Component Files**:
   - TaskList.svelte: 1300+ lines with mixed responsibilities
   - Complex nested logic that could be extracted
   - Inline styles mixed with external CSS

4. **Missing Abstractions**:
   - No shared form field components
   - No consistent loading/error states
   - No shared data fetching patterns
   - Limited use of Svelte 5 runes for shared logic

## Objectives
- [ ] Extract common UI patterns into reusable components
- [ ] Consolidate popover implementations into a unified system
- [ ] Create shared utilities for common operations
- [ ] Establish consistent state management patterns
- [ ] Reduce component file sizes through proper separation of concerns
- [ ] Improve type safety with proper TypeScript interfaces
- [ ] Document component APIs and usage patterns

## Acceptance Criteria
- [ ] All popover components use a single, configurable base implementation
- [ ] Status and priority rendering logic is centralized
- [ ] ContentEditable behavior is abstracted into a reusable action/component
- [ ] TaskList.svelte is broken down into smaller, focused components
- [ ] Common form patterns are extracted into shared components
- [ ] All components have proper TypeScript types
- [ ] Component documentation is added
- [ ] No regression in functionality
- [ ] Performance is maintained or improved
- [ ] All existing tests pass

## Related Issues

### Phase 1 Issues (Created)
- **[ISS-0006](../issues/ISS-0006-create-status-badge-component.md)**: Create StatusBadge component for consistent status display
- **[ISS-0007](../issues/ISS-0007-create-priority-badge-component.md)**: Create PriorityBadge component for consistent priority display
- **[ISS-0008](../issues/ISS-0008-enhance-base-popover-component.md)**: Enhance BasePopover to handle all popover use cases
- **[ISS-0009](../issues/ISS-0009-create-editable-title-component.md)**: Create EditableTitle component for consistent inline editing
- **[ISS-0010](../issues/ISS-0010-create-popover-menu-component.md)**: Create PopoverMenu component for consistent option lists
- **[ISS-0011](../issues/ISS-0011-extract-user-avatar-component.md)**: Extract UserAvatar component for consistent user display

## Implementation Plan

### Phase 1: Extract Common UI Components (Week 1)
1. **Create Shared Popover System**
   - Enhance BasePopover.svelte to handle all use cases
   - Create PopoverButton component for trigger patterns
   - Implement PopoverMenu for option lists
   - Add proper arrow positioning for all placements

2. **Extract Status/Priority Components**
   - Create StatusBadge component
   - Create PriorityBadge component
   - Centralize emoji configuration
   - Add proper TypeScript enums

3. **Create Form Components**
   - EditableTitle component (for job/task titles)
   - InlineInput component
   - FormField wrapper component
   - Consistent validation patterns

### Phase 2: Refactor Job Components (Week 2)
1. **Simplify JobDetailView**
   - Extract title editing to EditableTitle component
   - Use new popover system
   - Improve prop types

2. **Enhance JobCard**
   - Use StatusBadge/PriorityBadge
   - Extract technician avatar logic
   - Improve responsive behavior

3. **Consolidate JobInfo**
   - Use shared components
   - Improve data fetching patterns

### Phase 3: Refactor Task Components (Week 3)
1. **Break Down TaskList.svelte**
   - Extract TaskTree component
   - Create TaskDragHandler utility
   - Extract TaskKeyboardHandler
   - Create TaskCreationForm component
   - Separate deletion logic

2. **Simplify TaskRow**
   - Use EditableTitle component
   - Integrate with new popover system
   - Improve event handling

3. **Create Task Utilities**
   - Task hierarchy manager improvements
   - Shared task validation
   - Common task operations

### Phase 4: Establish Patterns & Documentation (Week 4)
1. **State Management**
   - Document store patterns
   - Create store factories for common patterns
   - Improve type safety

2. **Component Guidelines**
   - Document component APIs
   - Create usage examples
   - Add Storybook stories (if applicable)

3. **Performance Optimization**
   - Implement proper memoization
   - Optimize re-renders
   - Add performance monitoring

## Technical Considerations

### Svelte 5 Runes
- Leverage `$props()` for better prop handling
- Use `$derived()` for computed values
- Implement `$effect()` for side effects
- Create custom runes for shared logic

### TypeScript
- Define proper interfaces for all data types
- Use discriminated unions for status/priority
- Add generic types where appropriate
- Ensure strict type checking

### Testing
- Maintain existing test coverage
- Add unit tests for new utilities
- Update integration tests as needed
- Add visual regression tests for UI changes

### Performance
- Monitor bundle size impact
- Ensure no performance regressions
- Optimize component re-renders
- Implement code splitting where beneficial

## Related Issues
- Task creation workflow improvements
- Drag and drop enhancements
- Mobile responsiveness improvements
- Accessibility improvements

## Success Metrics
- Reduce total lines of code by 30%+
- Improve component reusability score
- Maintain or improve performance metrics
- Zero functional regressions
- Improved developer experience

## Risks & Mitigation
1. **Risk**: Breaking existing functionality
   - **Mitigation**: Comprehensive testing, incremental changes

2. **Risk**: Performance degradation
   - **Mitigation**: Performance monitoring, careful optimization

3. **Risk**: Over-abstraction
   - **Mitigation**: Focus on actual duplication, avoid premature optimization

## Notes
- This refactoring should be done incrementally to avoid large, risky changes
- Each phase should be tested thoroughly before moving to the next
- Consider feature flags for gradual rollout
- Maintain backward compatibility where possible