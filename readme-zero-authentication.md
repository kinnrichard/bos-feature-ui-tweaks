# Zero Authentication Setup Guide

This guide explains how to properly configure Zero authentication on a new development machine.

## Overview

Zero uses a dual authentication system:
1. **HTTP Authentication**: JWT tokens for pull/push requests to Zero server
2. **WebSocket Authentication**: Cookies returned by Zero server for real-time sync

## Prerequisites

- PostgreSQL running locally
- Node.js and npm installed
- Ruby and Rails environment set up

## 1. Environment Configuration

### Set the Correct Auth Secret

The most critical step is using the correct `ZERO_AUTH_SECRET`. This secret must match between:
- Rails application (for JWT generation)
- Zero cache server (for JWT verification)

**Check your `.env.development` file:**
```bash
# .env.development
ZERO_AUTH_SECRET="zerosecretkey_dev_only_change_in_production"
```

**Verify the secret is loaded:**
```bash
# Source the environment file
source .env.development

# Check the secret
echo $ZERO_AUTH_SECRET
# Should output: zerosecretkey_dev_only_change_in_production
```

### Update Zero Configuration

**Update `zero-config.json`:**
```json
{
  "logLevel": "info",
  "authSecret": "zerosecretkey_dev_only_change_in_production",
  "upstream": {
    "host": "localhost",
    "port": 5432,
    "database": "bos_development",
    "user": "claude"
  },
  "cvr": {
    "host": "localhost", 
    "port": 5432,
    "database": "bos_development_cvr",
    "user": "claude"
  },
  "cdb": {
    "host": "localhost",
    "port": 5432, 
    "database": "bos_development_cdb",
    "user": "claude"
  },
  "port": 4848,
  "change-streamer-port": 4849
}
```

## 2. Database Setup

Ensure all three Zero databases exist:

```bash
# Create Zero databases if they don't exist
createdb bos_development
createdb bos_development_cvr
createdb bos_development_cdb

# Run Rails migrations
bundle exec rails db:migrate
```

## 3. Server Startup (Simple!)

### Install Dependencies

```bash
# Install Ruby gems (includes foreman)
bundle install
```

### Start All Services

```bash
# Single command to start everything!
./bin/dev
```

This automatically:
✅ Loads environment variables from `.env.development`
✅ Starts Rails server on port 3000
✅ Starts Zero cache server on port 4848  
✅ Starts frontend dev server on port 5173
✅ Starts CSS watching

### Manual Startup (if needed)

```bash
# Set the environment variable
export ZERO_AUTH_SECRET="zerosecretkey_dev_only_change_in_production"

# Start Zero server with correct auth secret
npx zero-cache \
  --upstream-db postgres://claude@localhost:5432/bos_development \
  --cvr-db postgres://claude@localhost:5432/bos_development_cvr \
  --change-db postgres://claude@localhost:5432/bos_development_cdb \
  --auth-secret zerosecretkey_dev_only_change_in_production \
  --replica-file /tmp/zero-replica.db \
  --port 4848 \
  --change-streamer-port 4849 \
  --log-level info

# In another terminal:
export ZERO_AUTH_SECRET="zerosecretkey_dev_only_change_in_production"
rails server -b 0.0.0.0

# In another terminal:
cd frontend && npm run dev
```

## 4. Verification Steps

### 1. Check Zero Server Logs

Look for successful startup messages:
```
zero-cache ready (3649.1698340000003 ms)
zero-dispatcher listening at http://[::]:4848
```

**No authentication errors should appear.**

### 2. Test JWT Generation

```bash
# Test JWT generation with correct secret
export ZERO_AUTH_SECRET="zerosecretkey_dev_only_change_in_production"
rails runner "
token = ZeroJwt.generate(user_id: '52b78779-a740-4bbd-bee5-cae88b633f20')
puts 'Generated token: ' + token[0..50] + '...'
puts 'Secret used: ' + (ENV['ZERO_AUTH_SECRET'] || 'dev-secret-change-in-production')
"
```

Expected output:
```
Generated token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI1MmI3ODc3OS1hNzQwLT...
Secret used: zerosecretkey_dev_only_change_in_production
```

### 3. Check Browser Console

Navigate to `http://localhost:5173` and check browser console logs:

✅ **Successful authentication looks like:**
```
[Zero] Successfully fetched JWT token: eyJhbGciOiJIUzI1NiJ9...
[Zero] Using cached token: eyJhbGciOiJIUzI1NiJ9...
[Zero] Client initialized successfully
"Connected" {"navigatorOnline":true,"timeToConnectMs":65,...}
```

✅ **Successful WebSocket URLs:**
- First connection: `baseCookie=` (empty - normal)
- Second connection: `baseCookie=5h1pdw8` (populated - this is the key!)

❌ **Authentication failures look like:**
```
"AuthInvalidated: Failed to decode auth token: JWSSignatureVerificationFailed: signature verification failed"
```

## 5. Common Issues and Solutions

### Issue: `JWSSignatureVerificationFailed`

**Cause**: Secret mismatch between Rails and Zero server

**Solution**: 
1. Check both servers are using the same `ZERO_AUTH_SECRET`
2. Restart both servers with the correct environment variable
3. Verify the secret in `zero-config.json` matches

### Issue: `baseCookie` always empty

**Cause**: Zero server not returning authentication cookies

**Solution**:
1. Ensure JWT tokens are valid (check browser console)
2. Verify Zero server started with correct auth secret
3. Check Zero server logs for authentication errors

### Issue: Environment variable not loaded

**Cause**: Rails not loading the correct `ZERO_AUTH_SECRET`

**Solution**:
```bash
# Explicitly set the environment variable before starting Rails
export ZERO_AUTH_SECRET="zerosecretkey_dev_only_change_in_production"
rails server -b 0.0.0.0
```

### Issue: Database connection errors

**Cause**: Zero databases don't exist or wrong user permissions

**Solution**:
```bash
# Create missing databases
createdb bos_development_cvr
createdb bos_development_cdb

# Check PostgreSQL user permissions
psql -U claude -d bos_development -c "SELECT current_user;"
```

## 6. Development Workflow

### Daily Startup (Recommended)

```bash
# Single command starts everything with correct environment
./bin/dev
```

### Daily Startup (Manual)

If you prefer manual control:

1. **Start Zero server** (must start first):
```bash
export ZERO_AUTH_SECRET="zerosecretkey_dev_only_change_in_production"
npx zero-cache --upstream-db postgres://claude@localhost:5432/bos_development --cvr-db postgres://claude@localhost:5432/bos_development_cvr --change-db postgres://claude@localhost:5432/bos_development_cdb --auth-secret zerosecretkey_dev_only_change_in_production --replica-file /tmp/zero-replica.db --port 4848 --change-streamer-port 4849 --log-level info
```

2. **Start Rails server**:
```bash
export ZERO_AUTH_SECRET="zerosecretkey_dev_only_change_in_production"
rails server -b 0.0.0.0
```

3. **Start frontend**:
```bash
cd frontend && npm run dev
```

### Stopping Services

```bash
# With foreman (./bin/dev): Just press Ctrl+C

# Manual cleanup if needed:
pkill -f zero-cache
pkill -f puma
```

## 7. Production Considerations

- **Change the auth secret** in production
- Use strong, randomly generated secrets
- Store secrets in secure environment variable management
- Consider using dedicated JWT signing keys instead of shared secrets

## 8. Architecture Notes

### Authentication Flow

1. **Client** requests JWT token from Rails API (`/api/v1/zero/token`)
2. **Rails** generates JWT with `ZERO_AUTH_SECRET` and returns to client
3. **Client** calls Zero auth function, which returns the JWT token
4. **Zero server** validates JWT with same `ZERO_AUTH_SECRET`
5. **Zero server** returns authentication cookie in pull response
6. **Client** uses cookie for WebSocket `baseCookie` parameter
7. **Real-time sync** works with authenticated WebSocket connection

### Key Files

- `app/models/zero_jwt.rb` - JWT generation logic
- `app/controllers/api/v1/zero_tokens_controller.rb` - Token endpoint
- `frontend/src/lib/zero/client.ts` - Zero client configuration
- `zero-config.json` - Zero server configuration
- `.env.development` - Environment variables

This setup ensures secure, reliable Zero authentication for local development.