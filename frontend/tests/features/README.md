# Feature-Based Test Organization

This directory contains tests organized by feature areas rather than implementation details. This structure improves test discoverability, maintenance, and execution efficiency.

## Directory Structure

```
features/
├── jobs/                    # Job management features
│   ├── jobs-list.spec.ts           # Jobs list page functionality
│   └── job-status.spec.ts          # Job status management
│
├── tasks/                   # Task management features
│   ├── task-crud.spec.ts           # Task creation, reading, updating, deletion
│   ├── task-drag-drop.spec.ts      # Drag & drop operations and visual indicators
│   └── task-keyboard.spec.ts       # Keyboard interactions and accessibility
│
├── navigation/              # Site navigation and routing
│   └── homepage.spec.ts            # Homepage structure and navigation
│
└── auth/                    # Authentication and authorization
    └── auth-flows.spec.ts          # Login, logout, session management
```

## Test Organization Principles

### 1. Feature-Focused Grouping
- Tests are grouped by user-facing features, not technical implementation
- Each feature directory contains related test scenarios
- Cross-feature integration tests go in `/integration/` directory

### 2. Descriptive Test Structure
Each test file follows this pattern:
```typescript
test.describe('Feature Name', () => {
  test.describe('Aspect 1', () => {
    test('should do specific thing', async ({ page }) => { ... });
  });
  
  test.describe('Aspect 2', () => {
    test('should handle edge case', async ({ page }) => { ... });
  });
});
```

### 3. Consolidated Related Tests
Instead of separate files for each small variation:
- **OLD**: `task-deletion.spec.ts`, `task-creation.spec.ts`, `task-editing.spec.ts`
- **NEW**: `task-crud.spec.ts` with organized test groups

### 4. Shared Helper Usage
All tests use helpers from `../helpers/` directory:
- `AuthHelper` - Authentication utilities
- `DataFactory` - Test data creation
- `TestDatabase` - Database utilities

## Running Tests

### By Feature Area
```bash
# Run all job-related tests
npm test features/jobs/

# Run all task-related tests  
npm test features/tasks/

# Run specific test file
npm test features/jobs/jobs-list.spec.ts
```

### By Test Category
```bash
# Run all CRUD operations across features
npm test -- --grep "CRUD"

# Run all keyboard interaction tests
npm test -- --grep "keyboard|Keyboard"

# Run all drag and drop tests
npm test -- --grep "drag|drop"
```

## Migration Status

### ✅ Completed
- **Jobs Feature**: Migrated `jobs.spec.ts` → `jobs-list.spec.ts`, consolidated status tests
- **Tasks Feature**: Consolidated multiple task files into organized suites
- **Navigation**: Created homepage navigation tests
- **Auth**: Consolidated authentication flow tests

### 🔄 In Progress
- Integration test consolidation
- Performance test organization
- Security test grouping

### 📋 Remaining
- Legacy test file cleanup
- CI/CD pipeline updates
- Documentation updates

## Benefits of New Structure

### Developer Experience
- ✅ **Faster Test Discovery**: Find tests by feature, not implementation detail
- ✅ **Reduced Duplication**: Related scenarios grouped together
- ✅ **Better Maintenance**: Changes to features affect clearly identified test files

### Test Execution
- ✅ **Targeted Testing**: Run only relevant tests for feature changes
- ✅ **Parallel Execution**: Better isolation between feature groups
- ✅ **CI/CD Optimization**: Run affected feature test suites only

### Code Quality
- ✅ **Consistent Patterns**: Standardized structure across features
- ✅ **Clearer Intent**: Test purpose obvious from directory structure
- ✅ **Reduced Complexity**: Eliminate duplicate setup and utility code

## Contributing

When adding new tests:

1. **Choose the Right Directory**: Place tests in the feature directory they belong to
2. **Follow Naming Conventions**: Use descriptive names like `feature-aspect.spec.ts`
3. **Group Related Scenarios**: Use nested `test.describe()` blocks for organization
4. **Reuse Helpers**: Leverage existing helper classes for common operations
5. **Update This README**: Document new patterns or significant changes

## Legacy Test Files

Legacy tests in the root `/tests/` directory will be gradually migrated to this structure. During migration:

- Old tests remain functional
- New structure is preferred for new tests
- Related tests are consolidated during migration
- Documentation is updated to reflect current patterns

For questions about test organization or migration, see the QA documentation or ask the team.