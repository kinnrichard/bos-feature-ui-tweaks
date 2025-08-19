# bŏs Testing Guide

## Overview

The bŏs project uses a comprehensive testing strategy with two main approaches:
1. **Frontend Testing** - Playwright for UI and integration tests
2. **Backend Testing** - Rails Minitest for API and model tests

## Quick Start

### Frontend Tests (Primary)
```bash
# Basic execution
npm test                     # Run all tests with hybrid strategy
npm run test:headed          # Run with visible browser
npm run test:debug           # Interactive debugging

# Test strategies
npm run test:mocked          # Fast tests with mocked APIs
npm run test:real-db         # Full integration with Rails backend
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests
npm run test:e2e            # End-to-end tests
```

### Backend Setup (Required for Integration Tests)
```bash
# 1. Setup test database
RAILS_ENV=test rails db:test:prepare

# 2. Start Rails test server
RAILS_ENV=test rails server -p 3001

# 3. Verify backend
curl http://localhost:3001/api/v1/health
```

## Test Architecture

### Test Strategies
- **`mocked`**: Fast unit tests with API mocking
- **`real-db`**: Full integration tests with Rails backend  
- **`hybrid`**: Automatic strategy selection based on test content

### Test Categories
```
tests/
├── *.unit.spec.ts          # Unit tests (mocked APIs)
├── *.integration.spec.ts   # Integration tests (real backend)
├── *.e2e.spec.ts          # End-to-end tests (full system)
└── *.spec.ts              # Hybrid tests (auto-strategy)
```

### Browser Projects
Each test runs across multiple browsers:
- `unit-chromium/firefox`
- `integration-chromium/firefox`
- `e2e-chromium`
- `hybrid-chromium/firefox/webkit`

## Writing Tests

### Basic Test Structure
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

### Test Helpers
```typescript
// Authentication
const auth = new AuthHelper(page);
await auth.setupAuthenticatedSession('admin');

// Test data creation
const dataFactory = new DataFactory(page);
const client = await dataFactory.createClient({name: 'Test Client'});

// Database management
const db = new TestDatabase();
await db.cleanup();
```

## Backend Testing (Rails)

### Rails Test Commands
```bash
# Model tests
rails test test/models/

# Controller tests  
rails test test/controllers/

# Integration tests
rails test test/integration/
```

### API Testing Example
```ruby
# test/controllers/api/v1/jobs_controller_test.rb
class Api::V1::JobsControllerTest < ActionDispatch::IntegrationTest
  test "should get index" do
    get api_v1_jobs_url, headers: auth_headers
    assert_response :success
    assert_equal 'application/json', response.content_type
  end

  test "should create job" do
    assert_difference('Job.count') do
      post api_v1_jobs_url, 
        params: { job: { title: 'Test Job' } },
        headers: auth_headers
    end
    assert_response :created
  end
end
```

## Environment Configuration

### Port Configuration
- **Development**: Frontend (5173) → Backend (3000)
- **Testing**: Frontend (4173) → Backend (3001)

### Environment Variables
```bash
# Test environment
PUBLIC_API_URL=http://localhost:3001/api/v1

# Debug modes
DEBUG=true
PLAYWRIGHT_HEADFUL=true
```

## Debugging

### Visual Debugging
```bash
# Run with visible browser
npm run test:headed

# Interactive debugging
npm run test:debug

# Debug specific test
npx playwright test tests/jobs.spec.ts --debug
```

### Debug Output
```bash
# Verbose logging
DEBUG=true npm test

# Generate test report
npm run test:report
```

## Critical Testing Areas

### High Priority
1. **Authentication & Authorization**
   - Login/logout functionality
   - Role-based access control
   - Session management

2. **Job Management**
   - CRUD operations
   - Status transitions
   - Task management

3. **Data Integrity**
   - Form validation
   - Database constraints
   - API error handling

### Medium Priority
1. **UI Components**
   - Responsive design
   - Form interactions
   - Loading states

2. **Performance**
   - Page load times
   - API response times
   - Memory usage

### Low Priority
1. **Edge Cases**
   - Unusual user flows
   - Browser compatibility
   - Accessibility features

## CI/CD Integration

### GitHub Actions Example
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

## Performance Guidelines

### Test Speed Optimization
- **Unit tests**: ~30 seconds (fastest)
- **Integration tests**: ~2-5 minutes (backend required)
- **E2E tests**: ~5-10 minutes (full system)

### Best Practices
```bash
# Before committing
npm run test:unit          # Quick validation
npm run test:integration   # Feature validation

# Before releases
npm test                   # Full test suite
```

## Troubleshooting

### Common Issues

#### Port Configuration Problems
```bash
# Check Rails server
curl http://localhost:3001/api/v1/health

# Verify frontend build
grep -r "localhost:300[0-9]" .svelte-kit/output/client/
```

#### Database Connection
```bash
# Reset test database
RAILS_ENV=test rails db:test:prepare

# Verify test data
RAILS_ENV=test rails runner "puts User.count"
```

#### Authentication Failures
- Ensure Rails test server is running on port 3001
- Check CSRF tokens are generated
- Verify cookie-based authentication

### Debug Commands
```bash
# Environment status
curl http://localhost:3001/api/v1/health
curl http://localhost:4173/

# Clean restart
rm -rf .svelte-kit/ test-results/
npm run build:test
```

## Specialized Testing

### TaskList Testing Framework
For comprehensive TaskList testing, see: [TaskList Testing Guide](tests/README_TASKLIST_TESTING.md)

### Client Acts As List Testing
For position calculation debugging, see: [Client Acts As List Testing](tests/client_acts_as_list_testing.md)

## Summary

This testing framework provides:
- ✅ **Comprehensive coverage** with multiple test strategies
- ✅ **Modern frontend testing** with Playwright
- ✅ **Backend integration** with Rails API
- ✅ **Debug-friendly** tools and visual modes
- ✅ **CI/CD ready** configuration
- ✅ **Maintainable** test organization

**Quick start**: Run `npm test` to execute all tests, or `npm run test:headed` for visual debugging.

---

## 🔗 Related Documentation

### Testing Specialized Areas
- **[TaskList Testing Guide](./readme-tasklist-testing.md)** - Comprehensive TaskList testing framework
- **[Client Acts As List Testing](./client-acts-as-list-testing.md)** - Position calculation debugging
- **[Test Plan Critical Areas](../guides/test-plan-critical-areas.md)** - Testing focus areas

### Development Workflow
- **[Claude Automation Setup](../guides/claude-automation-setup.md)** - Automated testing setup
- **[Feature Request Workflow](../workflows/feature-request-workflow.md)** - Feature development process
- **[Epic Management](../epics/README.md)** - Epic planning and tracking

### Frontend Development
- **[Frontend Debug System](../frontend/epics/epic-014-debug-system-guide.md)** - Debug system for troubleshooting
- **[Frontend Migration Guide](../../frontend/epic-008-migration-guide.md)** - Svelte 5 migration patterns
- **[API Integration](../api/frontend-integration.md)** - Frontend API patterns

### Architecture & Standards
- **[Technical Decisions](../standards/technical-decisions.md)** - Architecture decision records
- **[Style Guide](../standards/style-guide.md)** - Code style and conventions
- **[Performance Guidelines](../architecture/performance-guidelines.md)** - Performance optimization

### See Also
- **[GitHub Setup](../setup/github-setup.md)** - GitHub integration setup
- **[Troubleshooting Guide](../architecture/troubleshooting-guide.md)** - Common issues and solutions
- **[Zero.js Integration](../../frontend/src/lib/zero/README.md)** - Zero.js reactive system