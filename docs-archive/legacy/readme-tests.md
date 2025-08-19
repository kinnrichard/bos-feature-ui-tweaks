# Testing Guide

This guide covers how to run and work with tests in the BOS project, with comprehensive frontend testing using Playwright and backend testing with Rails.

## Quick Start Commands

### **Frontend Tests (Primary)**
```bash
# Basic test execution
npm test                     # Run all tests with default hybrid strategy
npm run test:headed          # Run with visible browser (debugging)
npm run test:debug           # Interactive debugging mode

# Test strategies
npm run test:mocked          # Fast tests with mocked APIs
npm run test:real-db         # Full integration with real Rails backend
npm run test:unit           # Unit tests only (*.unit.spec.ts)
npm run test:integration    # Integration tests (*.integration.spec.ts)
npm run test:e2e            # End-to-end tests (*.e2e.spec.ts)

# Specific tests
npx playwright test tests/jobs.spec.ts                    # Single test file
npx playwright test tests/jobs.spec.ts --project=hybrid-chromium  # Specific browser
```

### **Backend Setup (Required for Integration Tests)**
```bash
# 1. Setup test database
RAILS_ENV=test rails db:test:prepare

# 2. Start Rails test server (in separate terminal)
RAILS_ENV=test rails server -p 3001

# 3. Verify backend is running
curl http://localhost:3001/api/v1/health
```

## Test Architecture

### **Comprehensive Test Configuration**

Our testing framework uses a **hybrid approach** with multiple strategies:

#### **Test Strategies**
- **`mocked`**: Fast unit tests with API mocking
- **`real-db`**: Full integration tests with Rails backend
- **`hybrid`**: Automatic strategy selection based on test content

#### **Test Categories** 
Tests are automatically categorized by filename:
```
tests/
├── *.unit.spec.ts          # Unit tests (mocked APIs)
├── *.integration.spec.ts   # Integration tests (real backend)
├── *.e2e.spec.ts          # End-to-end tests (full system)
├── *.api.spec.ts          # API-focused tests
└── *.spec.ts              # Hybrid tests (auto-strategy)
```

#### **Browser Projects**
Each test category runs across multiple browsers:
- `unit-chromium/firefox`
- `integration-chromium/firefox` 
- `e2e-chromium`
- `hybrid-chromium/firefox/webkit`

## Environment Configuration

### **Port Configuration**
The system automatically handles port configuration:
- **Development**: Frontend (5173) → Backend (3000)
- **Testing**: Frontend (4173) → Backend (3001)

This is handled by:
- `vite.config.test.ts` - Test-specific Vite configuration
- Environment variables embedded at build time
- No manual port redirection needed

### **Environment Variables**
```bash
# Test environment (automatically loaded)
PUBLIC_API_URL=http://localhost:3001/api/v1

# Debug modes
DEBUG=true                   # Verbose output
PLAYWRIGHT_HEADFUL=true     # Visual browser mode
```

## Test Execution

### **Development Workflow**
```bash
# 1. Start Rails backend
RAILS_ENV=test rails server -p 3001

# 2. Run frontend tests
npm test                    # All tests
npm run test:headed        # Visual debugging
npm run test:integration   # Backend integration only
```

### **Continuous Integration**
```bash
# Headless mode for CI
CI=true npm test

# Specific test suites
npm run test:unit          # Fast unit tests
npm run test:e2e           # Full system tests
```

## File Structure

### **Frontend Test Organization**
```
frontend/
├── tests/                          # Test files
│   ├── jobs.spec.ts               # Job management tests
│   ├── login.spec.ts              # Authentication tests
│   └── *.{unit,integration,e2e}.spec.ts
├── test-helpers/                   # Test utilities
│   ├── config.ts                  # Hybrid test configuration
│   ├── auth.ts                    # Authentication helpers
│   ├── data-factories.ts          # Test data creation
│   └── database.ts                # Database utilities
├── playwright.config.ts           # Main Playwright config
├── vite.config.ts                 # Development Vite config
└── vite.config.test.ts            # Test-specific Vite config
```

### **Test Helper Classes**
```typescript
// Authentication
const auth = new AuthHelper(page);
await auth.setupAuthenticatedSession('admin');

// Test data
const dataFactory = new DataFactory(page);
const client = await dataFactory.createClient({name: 'Test Client'});
const job = await dataFactory.createJob({title: 'Test Job', client_id: client.id});

// Database management
const db = new TestDatabase();
await db.cleanup();
```

## Writing Tests

### **Basic Test Structure**
```typescript
import { test, expect } from '@playwright/test';
import { AuthHelper } from '../test-helpers/auth';
import { DataFactory } from '../test-helpers/data-factories';

test.describe('Feature Tests', () => {
  let auth: AuthHelper;
  let dataFactory: DataFactory;

  test.beforeEach(async ({ page }) => {
    auth = new AuthHelper(page);
    dataFactory = new DataFactory(page);
  });

  test('should test feature functionality', async ({ page }) => {
    // Setup authentication
    await auth.setupAuthenticatedSession('admin');
    
    // Create test data
    const testData = await dataFactory.createJob({
      title: 'Test Job',
      status: 'in_progress'
    });

    // Navigate and test
    await page.goto('/jobs');
    await expect(page.locator('.job-card')).toBeVisible();
  });
});
```

### **Test Categories**

#### **Unit Tests** (`*.unit.spec.ts`)
- Fast execution with mocked APIs
- Focus on component logic and UI interactions
- No backend dependencies

#### **Integration Tests** (`*.integration.spec.ts`)
- Real API calls to test backend
- Database interactions
- Full request/response cycle

#### **E2E Tests** (`*.e2e.spec.ts`)
- Complete user workflows
- Cross-page navigation
- Real data persistence

## Debugging

### **Visual Debugging**
```bash
# Run with visible browser
npm run test:headed

# Interactive debugging with pause
npm run test:debug

# Debug specific test
npx playwright test tests/jobs.spec.ts --debug
```

### **Debug Output**
```bash
# Verbose logging
DEBUG=true npm test

# Network request logging
DEBUG=true npm run test:headed
```

### **Screenshots and Reports**
```bash
# Generate test report
npm run test:report

# Screenshots saved automatically on failure to:
# test-results/[test-name]/test-failed-*.png
```

## Troubleshooting

### **Common Issues**

#### **Port Configuration Problems**
```bash
# Check if Rails server is running on correct port
curl http://localhost:3001/api/v1/health

# Verify built frontend uses correct API URL
grep -r "localhost:300[0-9]" .svelte-kit/output/client/

# Should show: localhost:3001 (not 3000)
```

#### **Frontend Build Issues**
```bash
# Rebuild with test configuration
npm run build:test

# Verify environment variables
npm run preview:test
# Should show: [Vite Test] API Target: http://localhost:3001
```

#### **Database Connection Problems**
```bash
# Reset test database
RAILS_ENV=test rails db:test:prepare

# Verify test data
RAILS_ENV=test rails runner "puts User.count"
```

#### **Authentication Failures**
- Ensure Rails test server is running on port 3001
- Check that CSRF tokens are being generated
- Verify cookie-based authentication is working

### **Debug Commands**
```bash
# Environment status
curl http://localhost:3001/api/v1/health
curl http://localhost:4173/

# Test configuration verification
DEBUG=true npm test -- --list

# Clean and restart
rm -rf .svelte-kit/ test-results/
npm run build:test
```

## Backend Testing (Rails)

### **Traditional Rails Tests**
```bash
# Model tests
rails test test/models/

# Controller tests
rails test test/controllers/

# Integration tests
rails test test/integration/
```

### **TaskList Testing Framework**
```bash
# Comprehensive TaskList tests
rake test:tasklist:comprehensive
rake test:tasklist:smoke
rake test:tasklist:regression

# Debug mode
DEBUG=true PLAYWRIGHT_HEADFUL=true rake test:tasklist:comprehensive
```

### **Database Management**
```bash
# Setup test database
rake test:db:setup
rake db:test:seed

# Verify test data
rake test:db:verify

# Reset if needed
rake test:db:reset
```

## CI/CD Integration

### **GitHub Actions Example**
```yaml
- name: Setup Test Database
  run: RAILS_ENV=test rails db:test:prepare

- name: Start Rails Test Server
  run: RAILS_ENV=test rails server -p 3001 &

- name: Install Playwright
  run: npx playwright install

- name: Run Frontend Tests
  run: CI=true npm test
  env:
    RAILS_ENV: test

- name: Run Rails Tests
  run: rails test
  env:
    RAILS_ENV: test
```

### **Parallel Testing**
```bash
# Control test parallelization
PARALLEL_WORKERS=2 npm test

# CI-optimized settings automatically applied when CI=true
```

## Performance

### **Test Speed Optimization**
- **Unit tests**: ~30 seconds (fastest)
- **Integration tests**: ~2-5 minutes (backend required)
- **E2E tests**: ~5-10 minutes (full system)

### **Best Practices**
```bash
# Before committing
npm run test:unit          # Quick validation
npm run test:integration   # Feature validation

# Before major releases
npm test                   # Full test suite
```

## Advanced Configuration

### **Custom Test Environments**
```typescript
// test-helpers/config.ts
export const HYBRID_CONFIG = {
  defaultStrategy: 'hybrid',
  database: {
    host: 'localhost',
    port: 3001,
    resetBetweenTests: false
  },
  performance: {
    parallelWorkers: 2,
    timeout: 30000
  }
};
```

### **Environment Overrides**
```bash
# Force specific strategy
TEST_STRATEGY=real_db npm test

# Debug mode
DEBUG=true PLAYWRIGHT_HEADFUL=true npm test

# CI mode
CI=true npm test
```

## Migration Notes

### **From Old Test Setup**
If you're migrating from the old port redirection setup:
1. Remove any `page.route()` request interception
2. Use the new comprehensive test configuration
3. Build tests with `npm run build:test` instead of manual environment variables

### **Updated Commands**
- ❌ Old: `PUBLIC_API_URL=... npm test`
- ✅ New: `npm run test:real-db`

## Summary

This testing framework provides:
- ✅ **Comprehensive port configuration** with automatic environment handling
- ✅ **Multiple test strategies** (mocked, real-db, hybrid)
- ✅ **Modern frontend testing** with Playwright
- ✅ **Backend integration** with Rails API
- ✅ **Debug-friendly** tools and visual modes
- ✅ **CI/CD ready** configuration
- ✅ **Maintainable** test organization

**Quick start**: Run `npm test` to execute all tests, or `npm run test:headed` for visual debugging.