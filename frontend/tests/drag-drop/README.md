# Drag-Drop Test Suite

This comprehensive test suite provides safety net coverage for drag-drop functionality in the TaskList component before implementing Story 1 architecture changes.

## 📋 Test Suite Overview

### Test Categories

1. **Bug Reproduction Tests** (`drag-drop-bug-reproduction.spec.ts`)
   - Tests that SHOULD FAIL initially, proving we're testing the actual bugs
   - Will turn green when Story 1 implementation fixes the issues

2. **Feature Preservation Tests** (`drag-drop-feature-preservation.spec.ts`)
   - Tests that SHOULD PASS initially, protecting existing functionality
   - Must continue passing after Story 1 implementation

3. **Data Integrity Tests** (`drag-drop-data-integrity.spec.ts`)
   - Validates data safety and consistency during operations
   - Handles edge cases like null positions, mixed data types

4. **Comprehensive Integration Tests** (`drag-drop-comprehensive.spec.ts`)
   - End-to-end workflows and complex scenarios
   - Performance testing and recovery validation

## 🔧 Test Utilities

### DragDropHelper (`helpers/drag-drop-helper.ts`)
Primary utility class for drag-drop simulation and validation:

```typescript
// Basic usage
const dragDropHelper = new DragDropHelper(page);

// Expand/collapse tasks
await dragDropHelper.expandTask(taskId);
await dragDropHelper.collapseTask(taskId);

// Drag operations
await dragDropHelper.dragTaskBetween(taskId, beforeId, afterId);
await dragDropHelper.dragTaskIntoParent(childId, parentId);
await dragDropHelper.reorderTask(taskId, targetId, 'before'|'after');

// Hierarchy validation
await dragDropHelper.verifyTaskHierarchy([
  { taskId: 'task1', parentId: null, depth: 0 },
  { taskId: 'task2', parentId: 'task1', depth: 1 }
]);

// Multi-select operations
await dragDropHelper.createMultiSelection(['task1', 'task2']);
await dragDropHelper.clearSelection();

// State validation
await dragDropHelper.verifyCleanState();
await dragDropHelper.verifyDragIndicators(false);
```

### TaskHierarchyFactory (`helpers/task-hierarchy-factory.ts`)
Factory for creating complex task hierarchies:

```typescript
const factory = new TaskHierarchyFactory(page, jobId);

// Create complex hierarchy from specification
const hierarchy = await factory.createComplexHierarchy();

// Create simple patterns
const linear = await factory.createLinearHierarchy(5);
const wide = await factory.createWideHierarchy(10, 'Parent Task');
const balanced = await factory.createBalancedTree(3, 2);

// Create problematic data for edge case testing
const problematic = await factory.createProblematicHierarchy();
```

## 🐛 Bug Reproduction Tests

### Core Bug: Parent Adoption Failure

**Issue**: Item 4 dragged between items 2&3 doesn't adopt item 1 as parent

**Test Structure**:
```
Task 1 (parent)
  ├── Task 2 (child)
  ├── Task 3 (child)
Task 4 (root level - BUG TASK)
```

**Expected After Drag**: Task 4 between Tasks 2&3 should become child of Task 1

**Current Behavior**: Task 4 fails to adopt correct parent relationship

### Target Index Bug

**Issue**: `targetIndex: -1` errors when target task not found in siblings array

**Test**: Monitors console errors during problematic drag operations

### Cross-Hierarchy Move Issues

**Issue**: Parent assignment incorrect for cross-hierarchy moves

**Test**: Complex parent-child relationship moves across different branches

## ✅ Feature Preservation Tests

### Protected Functionality

- **Basic nesting operations** - Simple parent-child relationships
- **Root-level drag operations** - Reordering at top level
- **Multi-select drag** - Moving multiple selected tasks together
- **Circular reference prevention** - Preventing invalid parent assignments
- **Visual feedback** - Drag indicators and animations
- **Keyboard shortcuts** - Arrow navigation, Enter for inline creation
- **Task expansion/collapse** - Hierarchy visibility controls
- **Status changes during drag** - Drag operations don't break other features
- **New task creation** - Inline and bottom task creation alongside drag-drop
- **Task deletion** - Delete operations in drag-drop context
- **Performance** - Large task lists maintain acceptable performance

## 🛡️ Data Integrity Tests

### Data Safety Validation

- **Missing position fields** - Graceful handling of null/undefined positions
- **Mixed parent_id types** - Consistent handling of null vs undefined
- **Task data normalization** - Proper handling of whitespace and special characters
- **Data corruption prevention** - Hierarchy relationships maintained during operations
- **Concurrent operations** - Rapid successive operations handled gracefully
- **Network failure recovery** - System maintains consistency during API failures
- **Large hierarchy operations** - Performance and accuracy with complex structures
- **Unicode support** - Special characters and international text handling

## 🚀 Running the Tests

### Prerequisites

```bash
# Ensure test environment is set up
npm install
```

### Run All Drag-Drop Tests

```bash
# Run complete drag-drop test suite
npx playwright test tests/drag-drop/

# Run specific test files
npx playwright test tests/drag-drop/drag-drop-bug-reproduction.spec.ts
npx playwright test tests/drag-drop/drag-drop-feature-preservation.spec.ts
npx playwright test tests/drag-drop/drag-drop-data-integrity.spec.ts
npx playwright test tests/drag-drop/drag-drop-comprehensive.spec.ts

# Run with UI for debugging
npx playwright test tests/drag-drop/ --ui

# Run in headed mode to see browser
npx playwright test tests/drag-drop/ --headed
```

### Test Data Setup

Tests automatically create required test data using the DataFactory helper:
- Test clients, jobs, and tasks are created fresh for each test
- Hierarchical relationships are established programmatically
- Cleanup happens automatically after each test

## 📊 Test Results Interpretation

### Before Story 1 Implementation

**Expected Results**:
- ❌ **Bug Reproduction Tests**: Should FAIL (proving bugs exist)
- ✅ **Feature Preservation Tests**: Should PASS (protecting existing features)
- ✅ **Data Integrity Tests**: Should PASS (validating safety)
- ✅ **Comprehensive Tests**: Should PASS (end-to-end workflows)

### After Story 1 Implementation

**Expected Results**:
- ✅ **Bug Reproduction Tests**: Should PASS (bugs are fixed)
- ✅ **Feature Preservation Tests**: Should PASS (features protected)
- ✅ **Data Integrity Tests**: Should PASS (safety maintained)
- ✅ **Comprehensive Tests**: Should PASS (no regressions)

## 🔍 Debugging Failed Tests

### Common Issues

1. **Timing Issues**
   ```typescript
   // Add explicit waits after drag operations
   await dragDropHelper.reorderTask(taskId, targetId, 'after');
   await page.waitForTimeout(1000); // Wait for operation to complete
   ```

2. **Element Not Found**
   ```typescript
   // Ensure tasks are visible before operations
   await expect(page.locator(`[data-task-id="${taskId}"]`)).toBeVisible();
   ```

3. **Hierarchy State Issues**
   ```typescript
   // Expand parent tasks before validating children
   await dragDropHelper.expandTask(parentId);
   await dragDropHelper.verifyTaskParent(childId, parentId);
   ```

### Debug Utilities

```typescript
// Get visual task order for debugging
const order = await dragDropHelper.getVisualTaskOrder();
console.log('Current task order:', order);

// Get task data for inspection
const taskData = await dragDropHelper.getTaskData(taskId);
console.log('Task data:', taskData);

// Monitor console errors
const errors = await dragDropHelper.monitorConsoleErrors();
console.log('Console errors:', errors);
```

## 📈 Performance Considerations

### Test Performance

- Large hierarchy tests create up to 50 tasks
- Operations should complete within 5 seconds
- Memory usage should remain stable across test runs

### Optimization Tips

- Use `page.waitForTimeout()` judiciously - only when necessary
- Prefer `expect().toBeVisible()` over arbitrary timeouts
- Batch operations when testing multiple scenarios
- Clean up test data properly to avoid interference

## 🔧 Extending the Test Suite

### Adding New Test Cases

1. **Bug Reproduction Tests**: Add new failing tests for discovered bugs
2. **Feature Preservation Tests**: Add tests for new features that need protection
3. **Data Integrity Tests**: Add tests for new edge cases or data scenarios
4. **Comprehensive Tests**: Add integration scenarios combining multiple features

### Test Helper Extensions

```typescript
// Extend DragDropHelper for new operations
export class ExtendedDragDropHelper extends DragDropHelper {
  async customDragOperation(/* parameters */) {
    // Custom drag operation implementation
  }
}

// Extend TaskHierarchyFactory for new patterns
export class ExtendedHierarchyFactory extends TaskHierarchyFactory {
  async createCustomPattern(/* parameters */) {
    // Custom hierarchy pattern implementation
  }
}
```

## 📝 Test Coverage Goals

- **Bug Coverage**: All known drag-drop bugs have failing reproduction tests
- **Feature Coverage**: All existing drag-drop features have preservation tests
- **Edge Case Coverage**: All data integrity scenarios have validation tests
- **Integration Coverage**: All drag-drop + other feature combinations tested
- **Performance Coverage**: Large dataset operations validated for acceptable performance

## 🚨 Critical Success Criteria

1. **Safety Net**: Tests catch regressions before they reach production
2. **Bug Validation**: Failing tests prove bugs exist and are fixed when tests pass
3. **Feature Protection**: Existing functionality remains intact during refactoring
4. **Data Safety**: No data corruption or loss during drag-drop operations
5. **Performance**: Acceptable performance maintained under realistic loads

---

This test suite provides comprehensive coverage for drag-drop functionality, ensuring that Story 1 implementation can proceed safely with confidence that both bugs will be fixed and existing features will be preserved.