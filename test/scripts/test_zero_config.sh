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
    TEST_PORT_CONFIG=$(grep -A 30 "^test:" config/zero.yml | grep "port: 4850" | wc -l)
    TEST_AUTH_CONFIG=$(grep -A 30 "^test:" config/zero.yml | grep "dev-secret-change-in-production" | wc -l)
    
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