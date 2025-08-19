# Frontend Test Helpers - Hybrid Testing Infrastructure

This directory contains utilities for testing frontend components with both mocked APIs and real database integration.

## Overview

The hybrid testing strategy allows you to:
- **Fast unit tests** with mocked API responses
- **Integration tests** with real Rails API and test database
- **Flexible test isolation** with cleanup, transactions, or full resets
- **Seamless switching** between strategies

## Quick Start

### Basic Test with Mocked APIs (Default)
```typescript
import { test, expect } from '../test-helpers';

test('should handle user interaction', async ({ page }) => {
  // Mock API response
  await page.route('**/api/v1/jobs*', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockJobData })
    });
  });

  await page.goto('/jobs');
  await expect(page.locator('.job-card')).toBeVisible();
});
```

### Test with Real Database
```typescript
import { testWithRealDB, expect } from '../test-helpers';

testWithRealDB('should create job via real API', async ({ page, factory, cleanup }) => {
  // Create real data via API
  const job = await factory.createJob({
    title: 'Integration Test Job',
    status: 'active'
  });

  // Track for cleanup
  cleanup.push(() => factory.deleteEntity('jobs', job.id!));

  // Test with real data
  await page.goto('/jobs');
  await expect(page.locator('text=' + job.title)).toBeVisible();
});
```

### Test with Authentication
```typescript
import { testWithAuth, expect } from '../test-helpers';

testWithAuth('should access protected content', async ({ page, auth }) => {
  // Already authenticated as admin user
  await page.goto('/admin/dashboard');
  await expect(page.locator('.admin-content')).toBeVisible();
});
```

## Test Strategies

### 1. Mocked APIs (Default)
- **Fast execution** - no database dependencies
- **Reliable** - consistent mock data
- **Isolated** - no side effects
- **Best for**: UI behavior, error handling, component interactions

```bash
npm run test:mocked
```

### 2. Real Database Integration
- **High confidence** - tests actual API behavior
- **Real data validation** - catches integration bugs
- **Performance insights** - real timing
- **Best for**: data flows, authentication, business logic

```bash
npm run test:real-db
```

### 3. Hybrid Strategy
- **Combine both** - use real DB for critical paths, mocks for UI details
- **Balanced** - speed + confidence
- **Flexible** - choose per test

## File Naming Conventions

- `*.spec.ts` - Default hybrid strategy
- `*.unit.spec.ts` - Always use mocked APIs
- `*.integration.spec.ts` - Always use real database
- `*.e2e.spec.ts` - Full end-to-end with real database

## Test Isolation Strategies

### 1. Cleanup (Recommended)
Tracks created entities and deletes them after each test.

```typescript
import { testWithRealDB } from '../test-helpers';

testWithRealDB('test name', async ({ factory, cleanup }) => {
  const job = await factory.createJob({ title: 'Test Job' });
  
  // Automatic cleanup - no manual tracking needed
  cleanup.push(() => factory.deleteEntity('jobs', job.id!));
});
```

### 2. Transaction Isolation
Wraps each test in a database transaction that's rolled back.

```typescript
import { testWithTransaction } from '../test-helpers';

testWithTransaction('test name', async ({ factory }) => {
  // All database changes automatically rolled back
  await factory.createJob({ title: 'Test Job' });
});
```

### 3. Database Reset
Resets entire database before each test (slow but clean).

```typescript
import { testWithReset } from '../test-helpers';

testWithReset('test name', async ({ factory }) => {
  // Fresh database for each test
  await factory.createJob({ title: 'Test Job' });
});
```

## Available Utilities

### Database Connection (`database.ts`)
- `testDb` - Database connection instance
- `DatabaseLifecycle` - Setup/teardown utilities
- `DatabaseTransaction` - Transaction management

### Authentication (`auth.ts`)
- `AuthHelper` - Login/logout via API
- `UserFactory` - Test user creation
- `AuthTestUtils` - Common auth patterns

### Data Factories (`data-factories.ts`)
- `DataFactory` - Create entities via API
- `TestScenarios` - Predefined test data scenarios
- `TestDataUtils` - Data verification utilities

### Test Isolation (`isolation.ts`)
- `test` - Enhanced Playwright test with utilities
- `testWithRealDB` - Test with real database + cleanup
- `testWithAuth` - Test with authentication
- `TestIsolation` - Isolation strategy management

### Configuration (`config.ts`)
- `HYBRID_CONFIG` - Central configuration
- `TestEnvironment` - Environment detection
- `createHybridPlaywrightConfig` - Playwright configuration

## Environment Variables

### Test Strategy Selection
```bash
TEST_STRATEGY=mocked     # Use mocked APIs
TEST_STRATEGY=real_db    # Use real database
TEST_STRATEGY=hybrid     # Choose per test (default)
```

### Database Configuration
```bash
RAILS_TEST_HOST=localhost    # Rails server host
RAILS_TEST_PORT=3001        # Rails server port
USE_REAL_DB=true           # Force real database usage
SKIP_RAILS_SERVER=true     # Don't start Rails server
```

### Test Execution
```bash
DEBUG=true                 # Enable debug mode
CI=true                   # CI environment optimizations
```

## Examples

### Creating Test Data
```typescript
testWithRealDB('example', async ({ factory, cleanup }) => {
  // Simple entities
  const client = await factory.createClient({ name: 'Test Client' });
  const user = await factory.createUser({ role: 'technician' });
  
  // Complex scenarios
  const { job, tasks } = await factory.createJobWithTasks({
    title: 'Complex Job'
  }, 5);
  
  // Hierarchical data
  const hierarchy = await factory.createTaskHierarchy(job.id!);
  
  // Track all for cleanup
  cleanup.push(async () => {
    await factory.cleanup([
      { type: 'jobs', id: job.id! },
      { type: 'clients', id: client.id! },
      { type: 'users', id: user.id! }
    ]);
  });
});
```

### Testing Authentication Flows
```typescript
testWithRealDB('login flow', async ({ page, auth }) => {
  // Test real login
  await auth.loginViaUI('admin@test.com', 'password123');
  
  // Verify authentication
  const isAuth = await auth.isAuthenticated();
  expect(isAuth).toBeTruthy();
  
  // Test logout
  await auth.logout();
  expect(await auth.isAuthenticated()).toBeFalsy();
});
```

### Hybrid Testing Pattern
```typescript
testWithRealDB('hybrid example', async ({ page, factory }) => {
  // Use real database for core data
  const job = await factory.createJob({ title: 'Real Job' });
  
  // Mock expensive/unreliable services
  await page.route('**/api/v1/notifications**', route => {
    route.fulfill({ 
      status: 200, 
      body: JSON.stringify({ success: true }) 
    });
  });
  
  // Test with combination of real and mocked data
  await page.goto(`/jobs/${job.id}`);
  await expect(page.locator('text=' + job.title)).toBeVisible();
});
```

## Running Tests

```bash
# All tests with default strategy
npm test

# Specific strategies
npm run test:mocked      # Fast, mocked APIs
npm run test:real-db     # Integration, real database
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e        # End-to-end tests only

# Debug mode
npm run test:debug       # Interactive debugging
npm run test:headed      # Show browser
npm run test:report      # View test report
```

## Best Practices

### 1. Choose the Right Strategy
- **Unit tests**: Use mocked APIs for speed
- **Integration tests**: Use real database for confidence
- **Critical user flows**: Use real database
- **Error scenarios**: Often better with mocks for control

### 2. Test Data Management
- **Use factories** for consistent test data
- **Track created entities** for cleanup
- **Prefer cleanup over reset** for speed
- **Use meaningful test data** for debugging

### 3. Authentication
- **Use helper utilities** for common patterns
- **Test both API and UI flows**
- **Clear auth state** between tests
- **Use appropriate test users** for permissions

### 4. Performance
- **Keep most tests fast** with mocks
- **Limit real DB tests** to critical paths
- **Use parallel execution** appropriately
- **Monitor test execution time**

### 5. Debugging
- **Use meaningful test names**
- **Add screenshots** for complex UI tests
- **Log database state** when debugging
- **Use debug mode** for interactive testing

## Architecture

The hybrid testing infrastructure is built on:
- **Playwright** for browser automation
- **TypeScript** for type safety
- **Rails API** for backend integration
- **PostgreSQL** for test database
- **Modular utilities** for flexibility

This enables comprehensive testing that balances speed, reliability, and confidence in your frontend application.