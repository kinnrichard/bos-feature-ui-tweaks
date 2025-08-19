# EP-0021: Fix Authentication Token Mismatch

## Overview
Fix the critical authentication system mismatch where login uses simple tokens but the refresh system expects JWT tokens, causing 404 and 400 errors during background token refresh operations.

## Problem Statement
After implementing EP-0020 (Authentication Refresh System), users experience console errors every 10 minutes:
- `404 (Not Found)` on `/api/auth/csrf-token` 
- `400 (Bad Request)` on `/api/v1/auth/refresh`
- `Error: Refresh failed with status: 400`

Root causes:
1. Login action creates simple tokens (`simple_token_{user_id}_{timestamp}`)
2. Refresh action expects JWT tokens with database-backed refresh tokens
3. Frontend CSRF manager calls non-existent `/api/auth/csrf-token` endpoint
4. No refresh tokens are created during login

## Business Impact
- Poor user experience with console errors every 10 minutes
- Background refresh system is non-functional
- Users may still experience unexpected logouts
- Security features like token rotation are not working

## Solution: Implement JWT Authentication Throughout

### 1. Update Login to Use JWT Tokens

#### Sessions Controller Changes
```ruby
# app/controllers/api/v1/auth/sessions_controller.rb

def create
  user = User.find_by(email: login_params[:email]&.downcase)

  if user&.authenticate(login_params[:password])
    # Generate JWT tokens instead of simple tokens
    tokens = generate_tokens(user)
    set_auth_cookie(tokens[:access_token], tokens[:refresh_token])

    render json: {
      data: {
        type: "auth",
        id: user.id.to_s,
        attributes: {
          message: "Successfully authenticated",
          expires_at: tokens[:expires_at]
        },
        relationships: {
          user: {
            data: { type: "users", id: user.id.to_s }
          }
        }
      },
      included: [{
        type: "users",
        id: user.id.to_s,
        attributes: {
          email: user.email,
          name: user.name,
          role: user.role
        }
      }]
    }, status: :ok
  else
    render json: {
      errors: [{
        status: "401",
        code: "INVALID_CREDENTIALS",
        title: "Authentication Failed",
        detail: "Invalid email or password"
      }]
    }, status: :unauthorized
  end
end
```

### 2. Update Authentication Module

#### Authenticatable Concern Changes
```ruby
# app/controllers/concerns/authenticatable.rb

def current_user_from_token
  # Try JWT authentication first
  token = auth_token
  
  if token.present?
    begin
      payload = JwtService.decode(token)
      
      # Check if token is revoked
      if RevokedToken.revoked?(payload[:jti])
        return nil
      end
      
      user = User.find_by(id: payload[:user_id])
      return user if user
    rescue JWT::DecodeError, JWT::ExpiredSignature
      # Token invalid or expired, try refresh
      nil
    end
  end

  # Fallback to session-based authentication
  if session[:user_id].present?
    return User.find_by(id: session[:user_id])
  end

  nil
rescue StandardError => e
  Rails.logger.info "Authentication error: #{e.message}"
  nil
end
```

### 3. Fix CSRF Token Endpoint

#### Update Frontend CSRF Manager
```typescript
// frontend/src/lib/api/csrf.ts

private async performRefresh(): Promise<string | null> {
  try {
    debugAPI('Performing CSRF token refresh');
    
    // Use the health endpoint which provides CSRF tokens
    const response = await fetch('/api/v1/health', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Extract CSRF token from response headers
    const csrfToken = response.headers.get('X-CSRF-Token');
    
    if (csrfToken) {
      this.token = csrfToken;
      this.tokenExpiry = Date.now() + (this.cacheMinutes * 60 * 1000);
      debugAPI('CSRF token refreshed successfully from health endpoint', { 
        tokenPrefix: csrfToken.substring(0, 10) + '...',
        expiryTime: new Date(this.tokenExpiry).toISOString()
      });
      return csrfToken;
    } else {
      debugAPI('No CSRF token in health response headers');
      return null;
    }
  } catch (error) {
    debugAPI('CSRF token refresh failed', { error });
    return null;
  }
}
```

### 4. Update Background Refresh Service

#### Handle Non-Existent Refresh Tokens Gracefully
```typescript
// frontend/src/lib/auth/background-refresh.ts

private async performBackgroundRefresh(): Promise<void> {
  try {
    // Check session age limits before refreshing
    if (!this.isSessionValid()) {
      this.forceLogout('Session expired');
      return;
    }

    // Get CSRF token - will now use health endpoint
    const csrfToken = await csrfTokenManager.getToken();
    
    if (!csrfToken) {
      console.warn('Could not obtain CSRF token for refresh');
      return;
    }

    // Call refresh endpoint
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
    });

    if (!response.ok) {
      // Don't log as error if it's a missing token (first login)
      if (response.status === 400) {
        const data = await response.json();
        if (data.errors?.[0]?.code === 'MISSING_TOKEN') {
          console.debug('No refresh token available yet - likely first login');
          return;
        }
      }
      throw new Error(`Refresh failed with status: ${response.status}`);
    }

    // Update last refresh time
    localStorage.setItem('lastRefreshTime', Date.now().toString());

    // Parse response to potentially update session metadata
    const data = await response.json();
    if (data.auth?.session_created_at) {
      const sessionCreatedAt = new Date(data.auth.session_created_at).getTime();
      this.sessionStartTime = sessionCreatedAt;
      localStorage.setItem('sessionStartTime', sessionCreatedAt.toString());
    }

    console.debug('Background token refresh successful');
  } catch (error) {
    console.error('Background refresh failed:', error);
  }
}
```

## Implementation Steps

1. **Update Sessions Controller**
   - Modify `create` action to use `generate_tokens` method
   - Ensure both access and refresh tokens are set as cookies
   - Remove `set_simple_auth_cookie` method

2. **Update Authenticatable Concern**
   - Add JWT token decoding to `current_user_from_token`
   - Check for revoked tokens
   - Handle JWT exceptions gracefully

3. **Fix CSRF Token Endpoint**
   - Update frontend to use `/api/v1/health` instead of `/api/auth/csrf-token`
   - Extract CSRF token from response headers

4. **Improve Error Handling**
   - Handle missing refresh tokens gracefully on first login
   - Don't log errors for expected scenarios

## Testing Plan

### Unit Tests
1. Test JWT token generation on login
2. Test token validation in authenticatable concern
3. Test refresh token rotation
4. Test CSRF token extraction from health endpoint

### Integration Tests
1. Complete login → refresh → logout flow
2. Test token expiration and refresh
3. Test revoked token handling
4. Test CSRF token refresh via health endpoint

### Manual Testing
```javascript
// Console commands for testing
window.authLayoutDebug.backgroundRefresh // Check status
window.testBackgroundRefresh() // Run test suite

// Verify no console errors appear every 10 minutes
// Verify tokens refresh successfully
// Verify session persists across tab reloads
```

## Rollback Plan
If issues arise:
1. Revert sessions controller to use simple tokens
2. Disable background refresh temporarily
3. Document any data that needs cleanup (refresh tokens, etc.)

## Success Criteria
- No console errors during background refresh
- Tokens refresh successfully every 10 minutes
- Users remain logged in with open tabs
- Security features (token rotation, revocation) work properly

## Dependencies
- Existing JWT infrastructure (JwtService, RefreshToken, RevokedToken models)
- CSRF protection system
- Background refresh service from EP-0020

## Security Considerations
- Maintain HTTP-only cookies
- Implement proper token rotation
- Track and revoke token families on suspicious activity
- Ensure CSRF protection remains intact

## Migration Notes
- Existing users with simple tokens will need to log in again
- No database migrations required (tables already exist)
- Consider communication to users about re-authentication requirement