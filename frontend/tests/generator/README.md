# Rails Generator Integration Tests

This directory contains integration tests that validate the Rails model generator produces high-quality, consistent output.

## Tests

### 1. ESLint Compliance Test
**Purpose**: Ensures all generated model files pass ESLint validation with no warnings or errors.

**What it does**:
- Runs the Rails generator (`rails generate zero:active_models`)
- Collects all generated `.ts` files in the models directory
- Runs ESLint on each file using the project's ESLint configuration
- Fails if any ESLint warnings or errors are found

**Why it matters**: This prevents the generator from creating code that violates our coding standards and naming conventions.

### 2. Generator Idempotency Test
**Purpose**: Verifies the generator doesn't modify files unnecessarily when run multiple times.

**What it does**:
- Collects file statistics (modification time, creation time, size) for all model files
- Runs the Rails generator again
- Compares file statistics before and after
- Fails if any files were modified during the second run

**Why it matters**: An idempotent generator is more reliable and won't cause unnecessary git diffs or file system churn.

## Running the Tests

```bash
# Run generator integration tests
npm run test:generator

# Run all vitest tests (includes generator tests)  
npm run test:vitest:run

# Run with UI for debugging
npm run test:vitest:ui
```

## Test Requirements

### Prerequisites
- Rails application must be properly set up
- Database must be available for Rails introspection
- ESLint must be configured in the frontend directory

### Expected Behavior
- **First test**: All generated files should have zero ESLint warnings/errors
- **Second test**: Generator should be completely idempotent (no file changes on second run)

## Debugging Test Failures

### ESLint Compliance Failures
If the ESLint test fails:
1. Check the specific files and line numbers reported
2. Run ESLint manually on the failing files: `npx eslint src/lib/models/[failing-file].ts`
3. Fix the generator templates in `lib/generators/zero/active_models/`
4. Re-run the generator and test

### Idempotency Failures
If the idempotency test fails:
1. Check which files were modified on the second run
2. Investigate the `SmartFileCreator` and `SemanticContentComparator` logic
3. Ensure timestamp normalization is working correctly
4. Check for any dynamic content (like timestamps) that shouldn't be there

## Integration with CI/CD

These tests should be run in CI/CD pipelines to ensure:
- Code quality is maintained
- Generator reliability is preserved
- No regressions are introduced to the generator

Consider running these tests:
- On pull requests that modify generator code
- Before releases
- Nightly to catch environmental issues

## Related Files

- **Generator**: `lib/generators/zero/active_models/active_models_generator.rb`
- **ESLint Config**: `frontend/eslint.config.js`
- **Custom ESLint Rules**: `frontend/eslint-custom-rules/naming-convention-simple.js`
- **Generated Files**: `frontend/src/lib/models/*.ts` and `frontend/src/lib/models/types/*.ts`