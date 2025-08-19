# Test Infrastructure Troubleshooting Guide

This guide helps resolve common issues with the Playwright test suite, particularly the "zombie server" problem that can cause tests to fail mysteriously.

## 🚨 Quick Fix for Most Issues

If you're experiencing test failures, try this first:

```bash
cd /Users/claude/Projects/bos
bin/test-reset
```

This script will:
- Kill any zombie servers from previous runs
- Clean up stale files and locks  
- Start fresh test servers
- Validate server health

## 🔍 Common Issues & Solutions

### 1. "Zero.js Data Sync Issues" 

**Symptoms:**
- Tests create data but it never appears in the frontend
- Console shows: "Expected 8 jobs but found 0"
- Zero.js-related connection errors

**Root Cause:** Zombie Zero.js server from previous test run with stale state

**Solution:**
```bash
bin/test-reset
# Then run your tests normally
npm test
```

### 2. "Port Already In Use" Errors

**Symptoms:**  
- Test servers fail to start
- Error messages about ports 4000, 4850, or 6173 being in use
- `EADDRINUSE` errors

**Manual Fix:**
```bash
# Kill specific ports
lsof -ti:4000 | xargs kill -9  # Rails
lsof -ti:4850 | xargs kill -9  # Zero.js  
lsof -ti:6173 | xargs kill -9  # Frontend

# Or use the comprehensive script
bin/test-reset
```

### 3. "Database Connection Issues"

**Symptoms:**
- Tests fail with database connection errors
- Rails server not responding to health checks
- API requests timeout

**Solution:**
```bash
# Reset everything including database
bin/test-reset

# If that doesn't work, check Rails separately:
cd backend
rails db:test:prepare
rails server -e test -p 4000 &
```

### 4. "Authentication Failures"

**Symptoms:**
- Tests fail immediately with auth-related errors
- "User not found" or "Authentication required" messages
- Missing authentication state file

**Solution:**
```bash
# Clean auth state and reset
rm -rf frontend/playwright/.auth/
bin/test-reset
```

### 5. "Frontend Build Issues"

**Symptoms:**
- Frontend server starts but pages don't load correctly
- Vite compilation errors
- Missing assets or components

**Solution:**
```bash
cd frontend
npm run build
bin/test-reset
```

## 🛠️ Advanced Troubleshooting

### Server Health Diagnostics

Check individual server health:

```bash
# Rails API health
curl http://localhost:4000/api/v1/health

# Frontend server  
curl http://localhost:6173/

# Zero.js (may not have standard endpoint)
curl http://localhost:4850/
```

### Detailed Server Status

```bash
# Check what's running on test ports
lsof -i :4000  # Rails
lsof -i :4850  # Zero.js
lsof -i :6173  # Frontend

# Check process details
ps aux | grep rails
ps aux | grep zero
ps aux | grep vite
```

### Debug Mode Testing

Enable verbose output for more details:

```bash
# Global debug mode
DEBUG_PAGE_TESTS=true npm test

# Auth setup debugging  
DEBUG_AUTH_SETUP=true npm test

# Zero.js debugging
DEBUG=zero:* npm test
```

## 🔧 Test Infrastructure Details

### Server Health Monitor

The test suite now includes automatic server health monitoring:

- **Global Setup**: Validates all servers before tests run
- **Per-Test Checks**: Quick health validation before each test
- **Zombie Cleanup**: Automatic cleanup of stale processes

### Automatic Recovery

The system tries to recover automatically:

1. **Global Setup**: Detects unhealthy servers and attempts restart
2. **Test Wrapper**: Warns about health issues but continues tests
3. **Error Messages**: Provides clear remediation steps

### Test Server Ports

| Service | Port | Health Endpoint |
|---------|------|-----------------|
| Rails API | 4000 | `/api/v1/health` |
| Zero.js Cache | 4850 | `/` (basic connectivity) |
| Frontend Dev | 6173 | `/` (serves HTML) |

## 📊 Performance Considerations

### Test Timing Issues

If tests are timing out due to slow server startup:

```bash
# Increase timeout for slow systems
PLAYWRIGHT_TIMEOUT=30000 npm test

# Or run with fewer parallel workers
npm test -- --workers=1
```

### Memory Issues

For memory-constrained systems:

```bash
# Reduce parallel test execution
npm test -- --workers=1

# Clean up between test runs
bin/test-reset
```

## 🚀 Best Practices

### Daily Development Workflow

1. **Start of day**: `bin/test-reset`
2. **After making changes**: Run specific tests
3. **Before committing**: Run full test suite
4. **If issues arise**: `bin/test-reset` and retry

### CI/CD Integration

For automated environments:

```bash
# In CI pipeline
bin/test-reset --verbose
npm test -- --reporter=github

# Cleanup after tests
bin/testkill
```

### Team Collaboration

- **Share this guide** with team members
- **Use `bin/test-reset`** as first troubleshooting step
- **Report persistent issues** that aren't resolved by reset

## 🆘 Escalation

If `bin/test-reset` doesn't resolve your issue:

1. **Check system resources** (disk space, memory)
2. **Verify dependencies** (`npm install`, database setup)
3. **Check for port conflicts** with other development tools
4. **Restart your development environment** (Docker, etc.)
5. **Contact the team** with specific error messages

## 📝 Reporting Issues

When reporting test infrastructure issues, include:

- Error messages (full stack traces)
- Output from `bin/test-reset --verbose`
- System information (OS, Node version, etc.)
- Steps to reproduce the issue
- Whether `bin/test-reset` was attempted

This helps the team quickly identify and resolve issues.