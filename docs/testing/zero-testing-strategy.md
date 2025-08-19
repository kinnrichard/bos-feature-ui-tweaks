# Zero Database Testing Strategy

## Overview

This document outlines the comprehensive testing strategy for Zero database integration, focusing on environment isolation, port configuration, authentication, and real-time data synchronization.

## Risk Assessment

### Critical Risk Areas
- **Environment Configuration**: Port mismatches causing test failures
- **Authentication Secrets**: Signature verification failures between Rails and Zero
- **Data Isolation**: Test data bleeding into development environment
- **Connection Management**: WebSocket connectivity issues
- **Performance**: Multiple concurrent Zero connections

### Impact Analysis
- **High Impact**: Complete test suite failure if Zero misconfigured
- **Medium Impact**: Flaky tests due to environment bleeding
- **Low Impact**: Performance degradation with poor connection management

## Testing Architecture

### Test Pyramid Structure

```
    🔺 System Tests (E2E)
   ────────────────────────
  🔺🔺 Integration Tests
 ──────────────────────────
🔺🔺🔺 Unit Tests
────────────────────────────
```

### Environment Isolation Strategy

| Environment | Zero Port | Frontend Port | Database | Auth Secret |
|-------------|-----------|---------------|----------|-------------|
| Development | 4848 | 5173 | `bos_development` | `dev-secret-change-in-production` |
| Test | 4850 | 6173 | `bos_test` | `dev-secret-change-in-production` |
| Production | 4848 | 80/443 | `bos_production` | `$ZERO_AUTH_SECRET` |

## Unit Tests

### Frontend Zero Configuration Tests

**File**: `frontend/src/lib/zero/__tests__/zero-config.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ZERO_SERVER_CONFIG } from '../zero-config';

describe('ZERO_SERVER_CONFIG', () => {
  beforeEach(() => {
    // Mock window.location for consistent testing
    delete (window as any).location;
    (window as any).location = { 
      port: '', 
      protocol: 'http:', 
      hostname: 'localhost' 
    };
  });

  describe('getServerUrl()', () => {
    it('should connect to port 4850 in test environment', () => {
      window.location.port = '6173'; // Test frontend port
      expect(ZERO_SERVER_CONFIG.getServerUrl()).toBe('http://localhost:4850');
    });

    it('should connect to port 4848 in development environment', () => {
      window.location.port = '5173'; // Dev frontend port  
      expect(ZERO_SERVER_CONFIG.getServerUrl()).toBe('http://localhost:4848');
    });

    it('should fallback to port 4848 for unknown ports', () => {
      window.location.port = '3000'; // Unknown port
      expect(ZERO_SERVER_CONFIG.getServerUrl()).toBe('http://localhost:4848');
    });

    it('should use HTTPS protocol when frontend uses HTTPS', () => {
      window.location.protocol = 'https:';
      window.location.port = '6173';
      expect(ZERO_SERVER_CONFIG.getServerUrl()).toBe('https://localhost:4850');
    });

    it('should work with custom hostnames', () => {
      window.location.hostname = 'test.example.com';
      window.location.port = '6173';
      expect(ZERO_SERVER_CONFIG.getServerUrl()).toBe('http://test.example.com:4850');
    });
  });

  describe('getTokenEndpoint()', () => {
    it('should return correct token endpoint', () => {
      expect(ZERO_SERVER_CONFIG.getTokenEndpoint()).toBe('/api/v1/zero/token');
    });
  });
});
```

### Backend Authentication Tests

**File**: `test/models/zero_jwt_test.rb`

```ruby
require 'test_helper'

class ZeroJwtTest < ActiveSupport::TestCase
  test "generates valid JWT token with correct secret" do
    user_id = "test-user-123"
    token = ZeroJwt.generate(user_id: user_id)
    
    assert_not_nil token
    assert token.length > 50, "JWT token should be substantial length"
    
    # Verify token has 3 parts (header.payload.signature)
    assert_equal 3, token.split('.').length
  end

  test "token can be decoded with same secret" do
    user_id = "test-user-123"
    token = ZeroJwt.generate(user_id: user_id)
    
    decoded = ZeroJwt.decode(token)
    
    assert_not_nil decoded
    assert_equal user_id, decoded.user_id
    assert_equal user_id, decoded.sub
  end

  test "uses ZERO_AUTH_SECRET environment variable" do
    original_secret = ENV['ZERO_AUTH_SECRET']
    test_secret = "test-secret-12345"
    
    begin
      ENV['ZERO_AUTH_SECRET'] = test_secret
      
      # Generate token with test secret
      token = ZeroJwt.generate(user_id: "test-user")
      
      # Should be able to decode with same secret
      assert_nothing_raised do
        ZeroJwt.decode(token)
      end
      
      # Should fail with different secret
      ENV['ZERO_AUTH_SECRET'] = "different-secret"
      assert_raises(JWT::VerificationError) do
        ZeroJwt.decode(token)
      end
      
    ensure
      ENV['ZERO_AUTH_SECRET'] = original_secret
    end
  end

  test "falls back to default secret when env var not set" do
    original_secret = ENV['ZERO_AUTH_SECRET']
    
    begin
      ENV.delete('ZERO_AUTH_SECRET')
      
      token = ZeroJwt.generate(user_id: "test-user")
      decoded = ZeroJwt.decode(token)
      
      assert_equal "test-user", decoded.user_id
      
    ensure
      ENV['ZERO_AUTH_SECRET'] = original_secret
    end
  end

  test "token expiration works correctly" do
    token = ZeroJwt.generate(user_id: "test-user", expires_in: 1.second)
    decoded = ZeroJwt.decode(token)
    
    assert_not decoded.expired?, "Token should not be expired immediately"
    
    sleep(2)
    assert decoded.expired?, "Token should be expired after 2 seconds"
  end
end
```

## Integration Tests

### Environment Configuration Tests

**File**: `test/integration/zero_environment_test.rb`

```ruby
require 'test_helper'

class ZeroEnvironmentTest < ActionDispatch::IntegrationTest
  test "test environment uses correct Zero auth secret" do
    # Ensure we're in test environment
    assert Rails.env.test?, "This test must run in test environment"
    
    # Generate token using test environment configuration
    token = ZeroJwt.generate(user_id: 'test-user-123')
    
    # Verify token can be decoded (uses same secret)
    assert_nothing_raised do
      decoded = ZeroJwt.decode(token)
      assert_equal 'test-user-123', decoded.user_id
    end
  end

  test "zero token endpoint returns valid JWT" do
    # Create test user and login
    user = users(:test_owner)
    login_as(user)
    
    get '/api/v1/zero/token'
    
    assert_response :success
    
    json = JSON.parse(response.body)
    assert json['token'].present?, "Response should include token"
    assert_equal user.id.to_s, json['user_id'], "Response should include correct user_id"
    
    # Verify token is valid
    decoded = ZeroJwt.decode(json['token'])
    assert_equal user.id.to_s, decoded.sub
  end

  test "zero token fails for unauthenticated user" do
    get '/api/v1/zero/token'
    
    assert_response :unauthorized
  end

  test "test and development environments use compatible auth secrets" do
    # This ensures tokens generated in test can be used by Zero server
    # which uses the same default secret pattern
    
    test_secret = ENV.fetch("ZERO_AUTH_SECRET", "dev-secret-change-in-production")
    expected_secret = "dev-secret-change-in-production"
    
    assert_equal expected_secret, test_secret, 
      "Test environment should use same auth secret pattern as development"
  end
end
```

### Database Isolation Tests

**File**: `test/integration/zero_data_isolation_test.rb`

```ruby
require 'test_helper'

class ZeroDataIsolationTest < ActionDispatch::IntegrationTest
  test "test database is isolated from development database" do
    # Verify we're using test database
    assert_match /bos_test/, ActiveRecord::Base.connection.current_database
    assert_not_match /bos_development/, ActiveRecord::Base.connection.current_database
  end

  test "zero configuration points to test databases" do
    config_path = Rails.root.join('config', 'zero.yml')
    config = YAML.load_file(config_path)
    
    test_config = config['test']
    assert test_config.present?, "Zero test configuration should exist"
    
    # Verify test database names
    assert_equal 'bos_test', test_config['primary_db']['database']
    assert_equal 'bos_zero_cvr_test', test_config['cvr_db']['database'] 
    assert_equal 'bos_zero_cdb_test', test_config['cdb_db']['database']
  end

  test "test fixtures are properly loaded" do
    # Verify test data exists and is not development data
    test_user = users(:test_owner)
    assert test_user.present?
    assert_match /@bos-test\.local$/, test_user.email
    
    # Verify we have test jobs
    assert Job.count > 0, "Test database should have fixture jobs"
    
    # Verify no development-specific data
    dev_emails = User.where(email: /@(?!bos-test\.local)/)
    assert_equal 0, dev_emails.count, "Test database should not have non-test emails"
  end
end
```

## System Tests (End-to-End)

### Zero Connectivity Tests

**File**: `frontend/tests/system/zero-connectivity.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Zero Environment Connectivity', () => {
  test.beforeEach(async ({ page }) => {
    // Set up network monitoring
    await page.route('**/*', (route) => {
      // Log all requests for debugging
      console.log(`Request: ${route.request().method()} ${route.request().url()}`);
      route.continue();
    });
  });

  test('should connect to correct Zero server in test environment', async ({ page }) => {
    // Monitor WebSocket connections
    const webSocketConnections: string[] = [];
    const httpRequests: string[] = [];
    
    page.on('websocket', ws => {
      webSocketConnections.push(ws.url());
    });
    
    page.on('request', request => {
      if (request.url().includes('localhost:') && request.url().includes('zero')) {
        httpRequests.push(request.url());
      }
    });

    await page.goto('http://localhost:6173/jobs');
    
    // Wait for Zero initialization
    await page.waitForTimeout(10000);
    
    // Verify Zero connects to test port 4850, not dev port 4848
    const testConnections = [...webSocketConnections, ...httpRequests]
      .filter(url => url.includes(':4850'));
    expect(testConnections.length).toBeGreaterThan(0);
    
    const devConnections = [...webSocketConnections, ...httpRequests]
      .filter(url => url.includes(':4848'));
    expect(devConnections.length).toBe(0);
  });

  test('should authenticate successfully with Zero test server', async ({ page }) => {
    // Monitor console for auth errors
    const authErrors: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('AuthInvalidated') || 
          text.includes('signature verification failed') ||
          text.includes('Failed to connect')) {
        authErrors.push(text);
      }
    });

    await page.goto('http://localhost:6173/jobs');
    
    // Wait for Zero connection and authentication
    await page.waitForTimeout(15000);
    
    // Should have no authentication errors
    expect(authErrors).toHaveLength(0);
    
    // Should show "Connected" or similar success indicator
    const connectionStatus = await page.evaluate(() => {
      return (window as any).zeroDebug?.getZeroState?.()?.isInitialized || false;
    });
    
    expect(connectionStatus).toBe(true);
  });

  test('should load test data from Zero server', async ({ page }) => {
    await page.goto('http://localhost:6173/jobs');
    
    // Wait for data to load
    await page.waitForSelector('[data-testid="jobs-list"]', { timeout: 20000 });
    
    // Should display test fixture data
    const jobCount = await page.locator('[data-testid="job-item"]').count();
    expect(jobCount).toBeGreaterThan(0);
    
    // Verify we're seeing test data (check for test domain emails)
    const testEmails = await page.locator('text=@bos-test.local').count();
    expect(testEmails).toBeGreaterThan(0);
    
    // Should not see development data
    const devEmails = await page.locator('text=@gmail.com, text=@yahoo.com').count();
    expect(devEmails).toBe(0);
  });

  test('should handle Zero server reconnection', async ({ page }) => {
    await page.goto('http://localhost:6173/jobs');
    
    // Wait for initial connection
    await page.waitForTimeout(5000);
    
    // Simulate network interruption by blocking Zero requests temporarily
    await page.route('**/localhost:4850/**', route => route.abort());
    await page.waitForTimeout(2000);
    
    // Re-enable Zero requests
    await page.unroute('**/localhost:4850/**');
    
    // Should reconnect automatically
    await page.waitForTimeout(10000);
    
    // Verify connection is restored
    const connectionStatus = await page.evaluate(() => {
      return (window as any).zeroDebug?.getZeroState?.()?.isInitialized || false;
    });
    
    expect(connectionStatus).toBe(true);
  });
});
```

### Real-time Data Synchronization Tests

**File**: `frontend/tests/system/zero-realtime.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Zero Real-time Data Sync', () => {
  test('should sync data changes across browser tabs', async ({ browser }) => {
    // Create two browser contexts (simulating different tabs)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Navigate both pages to jobs list
    await page1.goto('http://localhost:6173/jobs');
    await page2.goto('http://localhost:6173/jobs');
    
    // Wait for both pages to load
    await page1.waitForSelector('[data-testid="jobs-list"]');
    await page2.waitForSelector('[data-testid="jobs-list"]');
    
    // Get initial job count on both pages
    const initialCount1 = await page1.locator('[data-testid="job-item"]').count();
    const initialCount2 = await page2.locator('[data-testid="job-item"]').count();
    
    expect(initialCount1).toBe(initialCount2);
    
    // Create a new job on page1
    await page1.click('[data-testid="add-job-button"]');
    await page1.fill('[data-testid="job-title-input"]', 'Test Real-time Job');
    await page1.click('[data-testid="save-job-button"]');
    
    // Wait for job to be created and synced
    await page1.waitForSelector('text=Test Real-time Job');
    
    // Verify job appears on page2 (real-time sync)
    await expect(page2.locator('text=Test Real-time Job')).toBeVisible({ timeout: 10000 });
    
    const finalCount2 = await page2.locator('[data-testid="job-item"]').count();
    expect(finalCount2).toBe(initialCount1 + 1);
    
    await context1.close();
    await context2.close();
  });

  test('should handle offline/online scenarios', async ({ page, context }) => {
    await page.goto('http://localhost:6173/jobs');
    await page.waitForSelector('[data-testid="jobs-list"]');
    
    // Go offline
    await context.setOffline(true);
    
    // Try to create a job while offline
    await page.click('[data-testid="add-job-button"]');
    await page.fill('[data-testid="job-title-input"]', 'Offline Job');
    await page.click('[data-testid="save-job-button"]');
    
    // Should show pending/offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    
    // Go back online
    await context.setOffline(false);
    
    // Should sync pending changes
    await page.waitForTimeout(5000);
    await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible();
    await expect(page.locator('text=Offline Job')).toBeVisible();
  });
});
```

## Configuration Tests

### Infrastructure Validation

**File**: `test/scripts/test_zero_config.sh`

```bash
#!/bin/bash
set -e

echo "🧪 Testing Zero Configuration Infrastructure..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Verify test-servers script configuration
echo "📋 Testing test-servers script configuration..."

# Source the script to check environment variables (dry run)
if [ -f "bin/test-servers" ]; then
    # Extract configuration from script
    ZERO_TEST_PORT_FROM_SCRIPT=$(grep "ZERO_TEST_PORT.*4850" bin/test-servers | wc -l)
    ZERO_AUTH_SECRET_FROM_SCRIPT=$(grep "ZERO_AUTH_SECRET.*dev-secret-change-in-production" bin/test-servers | wc -l)
    
    if [ "$ZERO_TEST_PORT_FROM_SCRIPT" -eq "0" ]; then
        echo -e "${RED}❌ bin/test-servers missing ZERO_TEST_PORT=4850${NC}"
        exit 1
    fi
    
    if [ "$ZERO_AUTH_SECRET_FROM_SCRIPT" -eq "0" ]; then
        echo -e "${RED}❌ bin/test-servers missing correct ZERO_AUTH_SECRET${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ test-servers script configuration valid${NC}"
else
    echo -e "${RED}❌ bin/test-servers not found${NC}"
    exit 1
fi

# Test 2: Verify Zero YAML configuration
echo "📋 Testing Zero YAML configuration..."

if [ -f "config/zero.yml" ]; then
    # Check test environment configuration
    TEST_PORT_CONFIG=$(grep -A 10 "^test:" config/zero.yml | grep "port.*4850" | wc -l)
    TEST_AUTH_CONFIG=$(grep -A 20 "^test:" config/zero.yml | grep "dev-secret-change-in-production" | wc -l)
    
    if [ "$TEST_PORT_CONFIG" -eq "0" ]; then
        echo -e "${RED}❌ config/zero.yml test section missing port 4850${NC}"
        exit 1
    fi
    
    if [ "$TEST_AUTH_CONFIG" -eq "0" ]; then
        echo -e "${RED}❌ config/zero.yml test section missing correct auth_secret${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Zero YAML configuration valid${NC}"
else
    echo -e "${RED}❌ config/zero.yml not found${NC}"
    exit 1
fi

# Test 3: Verify port consistency across files
echo "📋 Testing port consistency..."

# Check testkill script
if [ -f "bin/testkill" ]; then
    TESTKILL_PORT=$(grep "ZERO_PORT=" bin/testkill | cut -d'=' -f2)
    if [ "$TESTKILL_PORT" != "4850" ]; then
        echo -e "${RED}❌ bin/testkill uses wrong port: $TESTKILL_PORT (should be 4850)${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  bin/testkill not found${NC}"
fi

# Check package.json
if [ -f "package.json" ]; then
    PACKAGE_PORT_COUNT=$(grep -c "4850" package.json)
    if [ "$PACKAGE_PORT_COUNT" -eq "0" ]; then
        echo -e "${RED}❌ package.json missing port 4850 reference${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ package.json not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Port consistency verified${NC}"

# Test 4: Verify frontend configuration
echo "📋 Testing frontend Zero configuration..."

if [ -f "frontend/src/lib/zero/zero-config.ts" ]; then
    # Check for environment detection logic
    ENV_DETECTION=$(grep -c "frontendPort.*6173.*4850" frontend/src/lib/zero/zero-config.ts)
    if [ "$ENV_DETECTION" -eq "0" ]; then
        echo -e "${RED}❌ frontend zero-config.ts missing proper environment detection${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Frontend Zero configuration valid${NC}"
else
    echo -e "${RED}❌ frontend/src/lib/zero/zero-config.ts not found${NC}"
    exit 1
fi

# Test 5: Test database configuration
echo "📋 Testing database configuration..."

# Verify test databases are configured
if command -v rails >/dev/null 2>&1; then
    TEST_DB_NAME=$(RAILS_ENV=test bundle exec rails runner "puts ActiveRecord::Base.connection.current_database" 2>/dev/null || echo "")
    if [[ "$TEST_DB_NAME" == *"bos_test"* ]]; then
        echo -e "${GREEN}✅ Test database configuration valid${NC}"
    else
        echo -e "${RED}❌ Test database not properly configured: $TEST_DB_NAME${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Rails not available for database testing${NC}"
fi

echo -e "${GREEN}🎉 All Zero configuration tests passed!${NC}"
```

### Port Availability Tests

**File**: `test/scripts/test_port_availability.sh`

```bash
#!/bin/bash

echo "🔍 Testing Zero port availability..."

# Function to check if port is available
check_port() {
    local port=$1
    local service=$2
    
    if lsof -ti tcp:$port >/dev/null 2>&1; then
        echo "⚠️  Port $port is in use ($service)"
        return 1
    else
        echo "✅ Port $port is available ($service)"
        return 0
    fi
}

# Check development ports (should not be running during tests)
check_port 4848 "Zero Development"
check_port 4849 "Zero Development WebSocket"
check_port 5173 "Frontend Development"

# Check test ports (should be available for test use)
check_port 4850 "Zero Test"
check_port 4851 "Zero Test WebSocket"  
check_port 6173 "Frontend Test"
check_port 4000 "Rails Test"

echo "🔍 Port availability check complete"
```

## Performance Tests

### Load Testing

**File**: `test/performance/zero_load_test.rb`

```ruby
require 'test_helper'

class ZeroLoadTest < ActionDispatch::IntegrationTest
  test "zero server handles multiple concurrent connections" do
    threads = []
    results = []
    
    # Simulate 10 concurrent clients
    10.times do |i|
      threads << Thread.new do
        begin
          # Each thread makes a request for Zero token
          get '/api/v1/zero/token', headers: auth_headers_for(users(:test_owner))
          results << { thread: i, status: response.status, time: Time.current }
        rescue => e
          results << { thread: i, error: e.message, time: Time.current }
        end
      end
    end
    
    # Wait for all threads to complete
    threads.each(&:join)
    
    # Verify all requests succeeded
    successes = results.count { |r| r[:status] == 200 }
    assert_equal 10, successes, "All concurrent requests should succeed"
    
    # Verify reasonable response times
    max_response_time = results.map { |r| r[:time] }.max - results.map { |r| r[:time] }.min
    assert max_response_time < 5.seconds, "Response time should be reasonable under load"
  end

  test "zero jwt token generation performance" do
    start_time = Time.current
    
    # Generate 100 tokens
    100.times do
      ZeroJwt.generate(user_id: "test-user-#{rand(1000)}")
    end
    
    end_time = Time.current
    total_time = end_time - start_time
    
    # Should generate 100 tokens in under 1 second
    assert total_time < 1.second, "Token generation should be fast: #{total_time}s"
    
    # Average time per token should be reasonable
    avg_time = total_time / 100
    assert avg_time < 0.01, "Average token generation time should be under 10ms: #{avg_time}s"
  end
end
```

## Monitoring and Health Checks

### Runtime Health Monitoring

**File**: `app/controllers/api/v1/health_controller.rb` (additions)

```ruby
class Api::V1::HealthController < ApplicationController
  # ... existing code ...

  private

  def detailed_health_check
    {
      timestamp: Time.current.iso8601,
      environment: Rails.env,
      database: database_health,
      zero: zero_health,
      # ... existing checks ...
    }
  end

  def zero_health
    return { status: 'skipped', reason: 'not in test environment' } unless Rails.env.test?
    
    checks = {}
    
    # Check Zero test server connectivity
    checks[:test_server] = check_zero_server_connectivity
    
    # Check auth secret configuration
    checks[:auth_config] = check_zero_auth_configuration
    
    # Check database connectivity for Zero
    checks[:database] = check_zero_database_connectivity
    
    {
      status: checks.values.all? { |check| check[:status] == 'ok' } ? 'ok' : 'error',
      checks: checks
    }
  end

  def check_zero_server_connectivity
    begin
      uri = URI("http://localhost:4850/health")
      response = Net::HTTP.get_response(uri)
      
      if response.code == "200"
        { status: 'ok', port: 4850 }
      else
        { status: 'error', message: "Zero server returned #{response.code}" }
      end
    rescue => e
      { status: 'error', message: e.message }
    end
  end

  def check_zero_auth_configuration
    begin
      # Test JWT generation and verification
      token = ZeroJwt.generate(user_id: 'health-check')
      decoded = ZeroJwt.decode(token)
      
      if decoded&.user_id == 'health-check'
        { status: 'ok', message: 'JWT generation and verification working' }
      else
        { status: 'error', message: 'JWT verification failed' }
      end
    rescue => e
      { status: 'error', message: e.message }
    end
  end

  def check_zero_database_connectivity
    begin
      # Verify we can connect to test databases
      test_db = ActiveRecord::Base.connection.current_database
      
      if test_db.include?('bos_test')
        { status: 'ok', database: test_db }
      else
        { status: 'error', message: "Wrong database: #{test_db}" }
      end
    rescue => e
      { status: 'error', message: e.message }
    end
  end
end
```

## CI/CD Integration

### GitHub Actions Workflow

**File**: `.github/workflows/zero-tests.yml`

```yaml
name: Zero Database Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  zero-config-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: 3.4.4
          bundler-cache: true
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install frontend dependencies
        run: cd frontend && npm ci
      
      - name: Setup test database
        run: |
          bundle exec rails db:create RAILS_ENV=test
          bundle exec rails db:migrate RAILS_ENV=test
          bundle exec rails db:fixtures:load RAILS_ENV=test
        env:
          RAILS_ENV: test
      
      - name: Run Zero configuration tests
        run: |
          chmod +x test/scripts/test_zero_config.sh
          ./test/scripts/test_zero_config.sh
      
      - name: Run Zero unit tests
        run: |
          bundle exec rails test test/models/zero_jwt_test.rb
          cd frontend && npm run test src/lib/zero
      
      - name: Run Zero integration tests
        run: |
          bundle exec rails test test/integration/zero_environment_test.rb
          bundle exec rails test test/integration/zero_data_isolation_test.rb
        env:
          RAILS_ENV: test
          ZERO_AUTH_SECRET: dev-secret-change-in-production

  zero-system-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: 3.4.4
          bundler-cache: true
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        run: |
          cd frontend && npm ci
          npm install -g @rocicorp/zero
      
      - name: Setup databases
        run: |
          bundle exec rails db:create RAILS_ENV=test
          bundle exec rails db:migrate RAILS_ENV=test
          bundle exec rails db:fixtures:load RAILS_ENV=test
        env:
          RAILS_ENV: test
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/bos_test
      
      - name: Start test servers
        run: |
          bin/test-servers &
          sleep 30  # Wait for servers to start
        env:
          RAILS_ENV: test
          ZERO_AUTH_SECRET: dev-secret-change-in-production
      
      - name: Verify server startup
        run: |
          # Check that all required servers are running
          lsof -i :4000 | grep rails || (echo "Rails test server not running" && exit 1)
          lsof -i :4850 | grep zero || (echo "Zero test server not running" && exit 1)
          lsof -i :6173 | grep node || (echo "Frontend test server not running" && exit 1)
      
      - name: Run Playwright tests
        run: |
          cd frontend
          npx playwright install --with-deps chromium
          npx playwright test tests/system/zero-connectivity.spec.ts
        env:
          RAILS_ENV: test
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: zero-test-results
          path: |
            frontend/test-results/
            frontend/playwright-report/
```

## Test Data Management

### Test Fixtures

**File**: `test/fixtures/zero_test_data.yml`

```yaml
# User fixtures for Zero testing
zero_test_user_1:
  id: "ae6c10d0-0b13-554c-b976-a05d8a18f0cc"
  email: "testuser1@bos-test.local"
  name: "Zero Test User 1"
  created_at: <%= Time.current %>
  updated_at: <%= Time.current %>

zero_test_user_2:
  id: "52b78779-a740-4bbd-bee5-cae88b633f20"
  email: "testuser2@bos-test.local"
  name: "Zero Test User 2"
  created_at: <%= Time.current %>
  updated_at: <%= Time.current %>
```

### Test Data Factories

**File**: `test/factories/zero_test_factories.rb`

```ruby
FactoryBot.define do
  factory :zero_test_user, class: 'User' do
    sequence(:email) { |n| "zero-test-user-#{n}@bos-test.local" }
    sequence(:name) { |n| "Zero Test User #{n}" }
    
    trait :with_jobs do
      after(:create) do |user|
        create_list(:job, 3, user: user)
      end
    end
  end
  
  factory :zero_test_job, class: 'Job' do
    association :user, factory: :zero_test_user
    sequence(:title) { |n| "Zero Test Job #{n}" }
    status { 'active' }
    description { 'Test job for Zero synchronization testing' }
  end
end
```

## Test Execution Strategy

### Local Development Testing

```bash
#!/bin/bash
# scripts/run_zero_tests.sh

echo "🧪 Running Zero Database Test Suite"

# Step 1: Configuration tests (fast)
echo "📋 Running configuration tests..."
./test/scripts/test_zero_config.sh

# Step 2: Unit tests (fast)
echo "🔬 Running unit tests..."
bundle exec rails test test/models/zero_jwt_test.rb
cd frontend && npm test src/lib/zero && cd ..

# Step 3: Integration tests (medium)
echo "🔗 Running integration tests..."
RAILS_ENV=test bundle exec rails test test/integration/zero_environment_test.rb
RAILS_ENV=test bundle exec rails test test/integration/zero_data_isolation_test.rb

# Step 4: System tests (slow)
echo "🌐 Running system tests..."
bin/test-servers &
SERVER_PID=$!
sleep 30

cd frontend
npx playwright test tests/system/zero-connectivity.spec.ts
PLAYWRIGHT_EXIT_CODE=$?
cd ..

# Cleanup
kill $SERVER_PID 2>/dev/null
bin/testkill

if [ $PLAYWRIGHT_EXIT_CODE -eq 0 ]; then
    echo "✅ All Zero tests passed!"
else
    echo "❌ Some Zero tests failed"
    exit 1
fi
```

### Continuous Integration

```bash
# CI-optimized test execution
npm run test:zero:quick    # Unit + Integration tests
npm run test:zero:full     # Full suite including E2E
npm run test:zero:perf     # Performance tests
```

## Documentation and Maintenance

### Test Documentation

- **README**: Update main README with Zero testing instructions
- **Contributing Guide**: Include Zero test requirements for contributors
- **Deployment Guide**: Document Zero configuration validation steps
- **Troubleshooting**: Common Zero test issues and solutions

### Regular Maintenance Tasks

1. **Weekly**: Review test stability and flakiness metrics
2. **Monthly**: Update test data and fixtures
3. **Quarterly**: Performance baseline reviews
4. **Release**: Full test suite validation

## Success Metrics

### Test Coverage Targets

- **Unit Tests**: 95% coverage for Zero configuration logic
- **Integration Tests**: 100% coverage for environment isolation
- **System Tests**: Critical user paths covered
- **Performance**: Response time baselines maintained

### Quality Gates

- **All tests pass**: Required for merge
- **No flaky tests**: <2% flakiness rate allowed
- **Performance**: No regression in response times
- **Security**: Auth secret validation must pass

---

*This testing strategy ensures robust, reliable Zero database integration across all environments while preventing configuration drift and connectivity issues.*