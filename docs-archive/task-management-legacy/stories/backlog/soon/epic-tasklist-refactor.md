# TaskList Refactoring Epic

## Overview
This epic breaks down the massive 2,876-line TaskList.svelte component into focused, maintainable Svelte 5 components using modern patterns like runes, snippets, and composable stores.

## Story Point Scale
- **1 point**: ~4 hours
- **2 points**: ~1 day  
- **3 points**: ~2-3 days
- **5 points**: ~1 week

---

## Epic: TaskList Component Refactoring (20 points)

### EPIC-TASKLIST: TaskList Component Architecture Refactoring
**Points**: 20  
**Type**: Technical Refactoring  
**Priority**: High  

**As a** developer  
**I want** to break down the massive TaskList.svelte into focused, reusable components  
**So that** the code is maintainable, testable, and follows Svelte 5 best practices

**Current State Analysis:**
- **File size**: 2,876 lines of code
- **Complexity**: High - handles multiple concerns in single file
- **Maintainability**: Poor - difficult to modify without side effects
- **Testability**: Limited - monolithic structure prevents focused testing
- **Reusability**: None - components can't be used elsewhere

**Target Architecture:**
```
TaskList.svelte (orchestrator)
├── TaskListContainer.svelte (main container with keyboard/click handling)
├── TaskHierarchy.svelte (tree organization and filtering)
├── TaskItem.svelte (individual task row)
│   ├── TaskStatusBadge.svelte (status emoji and click handling)
│   ├── TaskTitle.svelte (title display with inline editing)
│   ├── TaskMetadata.svelte (time tracking, assignment, notes)
│   └── TaskActions.svelte (info popover and actions)
├── TaskCreation/
│   ├── NewTaskForm.svelte (bottom "New Task" row)
│   ├── InlineTaskForm.svelte (inline creation between tasks)
│   └── TaskCreationControls.svelte (shared creation logic)
├── TaskSelection/
│   ├── TaskSelection.svelte (multi-select UI and keyboard nav)
│   ├── SelectionIndicator.svelte (visual selection highlighting)
│   └── SelectionActions.svelte (bulk actions toolbar)
├── DragDrop/
│   ├── DragDropProvider.svelte (drag state management)
│   ├── TaskDropZone.svelte (drop target detection)
│   └── DragPreview.svelte (visual feedback during drag)
└── Modals/
    ├── TaskDeleteModal.svelte (confirmation dialog)
    ├── DevelopmentAlerts.svelte (dev debugging)
    └── TaskInfoPopover.svelte (existing, may need updates)
```

**Composable Stores (Svelte 5 runes):**
```typescript
// State management with $state, $derived, $effect
taskOperations.svelte.ts     // CRUD with optimistic updates
taskHierarchy.svelte.ts      // Tree organization and filtering  
dragAndDrop.svelte.ts        // Drag state and position calculations
taskKeyboardNav.svelte.ts    // Arrow key navigation and shortcuts
taskSelection.svelte.ts      // Multi-select state management
```

**Epic Acceptance Criteria:**
- [ ] All existing functionality preserved during refactoring
- [ ] Components follow single responsibility principle
- [ ] Uses Svelte 5 runes ($state, $derived, $effect, $props)
- [ ] Implements modern event handling (onclick vs on:click)
- [ ] Uses snippets for reusable markup patterns
- [ ] Each component is independently testable
- [ ] Maintains current visual design and UX
- [ ] Preserves all drag & drop functionality
- [ ] Keyboard navigation and accessibility unchanged
- [ ] Performance improvements through granular reactivity
- [ ] TypeScript types throughout
- [ ] Playwright tests pass for all task operations

**Migration Strategy:**
1. **Parallel Development**: Build new components alongside existing code
2. **Feature Flags**: Use conditional rendering to switch between old/new
3. **Incremental Replacement**: Replace sections one at a time
4. **Rollback Plan**: Keep original file as backup until complete
5. **Testing Strategy**: Comprehensive E2E tests before and after

**Risk Mitigation:**
- Maintain feature parity through careful testing
- Use TypeScript to catch interface changes
- Implement gradual migration with rollback capability
- Document component interfaces clearly
- Regular testing during development

**Success Metrics:**
- Lines of code per component < 300
- Component test coverage > 80%
- No regression in Playwright tests
- Improved Lighthouse performance scores
- Reduced coupling between concerns
- Easier to add new task-related features

---

## Sprint Breakdown

### Sprint 1: Foundation (8 points)
- TASKLIST-001: Extract Task State Management (3 points)
- TASKLIST-002: Core Task Components (3 points)
- TASKLIST-003: Hierarchy Management (2 points)

### Sprint 2: Interactions (7 points)
- TASKLIST-004: Drag & Drop Provider (5 points)
- TASKLIST-005: Selection System (3 points)

### Sprint 3: Polish (5 points)
- TASKLIST-006: Creation Forms (2 points)
- TASKLIST-007: Modals & Overlays (2 points)
- Integration testing and final cleanup (1 point)

---

## Dependencies Graph

```
TASKLIST-001 (State Management)
    ↓
TASKLIST-002 (Core Components) → TASKLIST-003 (Hierarchy)
    ↓                                ↓
TASKLIST-004 (Drag & Drop) ← ← ← ← ← ← ↓
    ↓                                ↓
TASKLIST-005 (Selection) → → → → → → → ↓
    ↓                                ↓
TASKLIST-006 (Creation Forms) → → → → ↓
    ↓                                ↓
TASKLIST-007 (Modals) → → → → → → → → ↓
    ↓                                ↓
    Integration & Testing ← ← ← ← ← ← ↓
```

---

## Technical Requirements

**Svelte 5 Features to Use:**
- `$state()` for reactive state management
- `$derived()` for computed values
- `$effect()` for side effects and DOM updates
- `$props()` for component props with destructuring
- `$bindable()` for two-way binding
- `{#snippet}` and `{@render}` for reusable markup
- Modern event handling (`onclick` instead of `on:click`)

**TypeScript Integration:**
- Strict type checking enabled
- Proper typing for all props, stores, and API calls
- Use `import type` for type-only imports
- Leverage Svelte 5's improved TypeScript support

**Performance Considerations:**
- Granular reactivity with runes
- Avoid unnecessary re-renders
- Virtual scrolling for large task lists (future enhancement)
- Lazy loading of heavy components
- Efficient drag & drop with minimal DOM manipulation

**Accessibility Requirements:**
- Maintain all existing ARIA labels and roles
- Keyboard navigation preserved
- Screen reader compatibility
- Focus management during interactions
- High contrast support

---

## Post-Refactoring Benefits

1. **Maintainability**: Each component has clear responsibility
2. **Testability**: Components can be tested in isolation
3. **Reusability**: Components can be used in other contexts
4. **Performance**: Granular reactivity reduces unnecessary updates
5. **Developer Experience**: Easier to understand and modify
6. **Type Safety**: Better TypeScript integration with Svelte 5
7. **Future-Proofing**: Modern Svelte patterns and architecture
8. **Debugging**: Easier to isolate and fix issues