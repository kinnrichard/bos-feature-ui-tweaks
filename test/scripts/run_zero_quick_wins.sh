#!/bin/bash
set -e

echo "🧪 Running Zero Quick Wins Test Suite"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "${BLUE}📋 Running: $test_name${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASSED: $test_name${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAILED: $test_name${NC}"
        ((TESTS_FAILED++))
    fi
    echo ""
}

# Quick Win 1: Configuration validation script (5 minutes)
echo -e "${YELLOW}🚀 Quick Win 1: Configuration Validation (5 minutes)${NC}"
run_test "Zero Configuration Validation" "./test/scripts/test_zero_config.sh"

# Quick Win 2: Unit tests for port detection (15 minutes)
echo -e "${YELLOW}🚀 Quick Win 2: Unit Tests for Port Detection (15 minutes)${NC}"

# Frontend unit tests
if command -v npm >/dev/null 2>&1 && [ -d "frontend" ]; then
    run_test "Frontend Zero Config Unit Tests" "cd frontend && npm test src/lib/zero/__tests__/zero-config.test.ts"
else
    echo -e "${YELLOW}⚠️  Skipping frontend tests - npm or frontend directory not available${NC}"
fi

# Backend unit tests
if command -v bundle >/dev/null 2>&1; then
    run_test "Backend Zero JWT Unit Tests" "bundle exec rails test test/models/zero_jwt_test.rb"
else
    echo -e "${YELLOW}⚠️  Skipping backend unit tests - bundle not available${NC}"
fi

# Quick Win 3: Integration tests for auth secrets (20 minutes)
echo -e "${YELLOW}🚀 Quick Win 3: Integration Tests for Auth Secrets (20 minutes)${NC}"

if command -v bundle >/dev/null 2>&1; then
    run_test "Zero Environment Integration Tests" "RAILS_ENV=test bundle exec rails test test/integration/zero_environment_test.rb"
    run_test "Zero Data Isolation Tests" "RAILS_ENV=test bundle exec rails test test/integration/zero_data_isolation_test.rb"
else
    echo -e "${YELLOW}⚠️  Skipping integration tests - bundle not available${NC}"
fi

# Quick Win 4: Basic E2E connectivity test (30 minutes)
echo -e "${YELLOW}🚀 Quick Win 4: Basic E2E Connectivity Test (30 minutes)${NC}"

# Check if test servers are running
if lsof -i :4850 >/dev/null 2>&1 && lsof -i :6173 >/dev/null 2>&1; then
    if command -v npx >/dev/null 2>&1 && [ -d "frontend" ]; then
        run_test "Zero E2E Connectivity Tests" "cd frontend && npx playwright test tests/system/zero-connectivity.spec.ts --reporter=line"
    else
        echo -e "${YELLOW}⚠️  Skipping E2E tests - playwright or frontend directory not available${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Skipping E2E tests - test servers not running (ports 4850, 6173)${NC}"
    echo -e "${YELLOW}    Run 'bin/test-servers' to start test environment${NC}"
fi

# Summary
echo "======================================"
echo -e "${BLUE}📊 Test Results Summary${NC}"
echo "======================================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All Zero Quick Wins tests completed successfully!${NC}"
    echo ""
    echo -e "${GREEN}✅ Configuration validation script implemented${NC}"
    echo -e "${GREEN}✅ Unit tests for port detection created${NC}"
    echo -e "${GREEN}✅ Integration tests for auth secrets added${NC}"
    echo -e "${GREEN}✅ Basic E2E connectivity test ready${NC}"
    echo ""
    echo -e "${BLUE}💡 Next steps:${NC}"
    echo "  1. Start test servers: bin/test-servers"
    echo "  2. Run full E2E tests: cd frontend && npx playwright test tests/system/zero-connectivity.spec.ts"
    echo "  3. Integrate into CI/CD pipeline"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the output above.${NC}"
    exit 1
fi