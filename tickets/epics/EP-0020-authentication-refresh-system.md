# EP-0020: Authentication Refresh System

## Overview
Implement a background token refresh system to maintain user sessions while browser tabs remain open, addressing the issue of users being logged out after 5-15 minutes of inactivity. The system automatically refreshes authentication tokens in the background while enforcing configurable idle and absolute session timeouts for security.

## Business Value
- Significantly improves user experience by eliminating frequent forced logouts
- Maintains security with HTTP-only cookies and configurable timeout policies
- Reduces user friction and support tickets related to session timeouts
- Balances convenience with security through idle and absolute session limits
- Provides flexibility for different deployment environments via configuration

## Problem Statement
Users were experiencing forced logouts after 5-15 minutes due to:
- Authentication cookies set to expire in exactly 15 minutes
- No mechanism to extend sessions during active use
- Frontend not proactively refreshing tokens before expiration
- Session timeout too aggressive for normal usage patterns

## Requirements

### 1. Background Token Refresh Service

#### Core Functionality
- **Automatic Refresh**: Refresh authentication tokens every 10 minutes (configurable)
- **Smart Timing**: Refresh before token expiration to prevent authentication gaps
- **Browser Lifecycle**: Active only while browser tab is open (no activity detection needed)
- **Graceful Degradation**: Falls back to existing 401 retry logic on failures

#### Session Timeout Management
- **Idle Timeout**: Force re-authentication after 24 hours of no refresh (configurable)
- **Absolute Session Limit**: Force re-authentication after 31 days regardless of activity
- **Session Tracking**: Track session creation time and last refresh time in localStorage
- **Automatic Logout**: Redirect to login with reason when limits exceeded

#### Implementation Details
```typescript
// Configuration (with environment variable support)
REFRESH_INTERVAL_MINUTES: 10 (default)
MAX_IDLE_HOURS: 24 (default)
MAX_SESSION_HOURS: 744 (31 days default)
```

### 2. Backend Session Metadata Enhancement

#### Refresh Endpoint Updates
- Include session creation timestamp in refresh response
- Calculate and return session age in hours
- Maintain existing JWT rotation and security

#### Response Format
```json
{
  "user": { /* user data */ },
  "auth": {
    "message": "Token refreshed successfully",
    "expires_at": "2024-XX-XX",
    "session_created_at": "2024-XX-XX",
    "session_age_hours": 2.5
  }
}
```

### 3. Cookie Expiration Extension

#### Updated Timeouts
- Extend cookie expiration from 15 minutes to 30 minutes
- Match JWT access token expiration to cookie timeout
- Provide buffer for network issues and refresh delays

### 4. Configuration Management

#### Environment Variables
```
VITE_AUTH_REFRESH_INTERVAL_MINUTES - How often to refresh (default: 10)
VITE_AUTH_MAX_IDLE_HOURS - Maximum idle time (default: 24)
VITE_AUTH_MAX_SESSION_HOURS - Absolute session limit (default: 744)
VITE_AUTH_COOKIE_EXPIRATION_MINUTES - Backend cookie expiry (default: 30)
```

### 5. Integration Points

#### Authenticated Layout
- Start background refresh after successful authentication
- Stop refresh timer when leaving authenticated area
- Clean up properly on component unmount

#### Error Handling
- Don't fail entire layout if background refresh fails
- Leverage existing 401 retry logic for token expiration
- Log errors for debugging without disrupting user experience

## Technical Architecture

### Frontend Components
1. **BackgroundRefreshService** (`/lib/auth/background-refresh.ts`)
   - Singleton service managing refresh timer
   - Session validation logic
   - LocalStorage integration for persistence

2. **Auth Configuration** (`/lib/auth/config.ts`)
   - Centralized configuration with env var support
   - Type-safe configuration values

3. **Integration Layer**
   - Authenticated layout lifecycle hooks
   - CSRF token manager integration
   - Debug utilities for monitoring

### Backend Components
1. **Sessions Controller**
   - Extended cookie expiration (30 min)
   - Session metadata in refresh response
   - Maintained security with HTTP-only cookies

## Security Considerations

### Maintained Security Features
- ✅ HTTP-only cookies prevent XSS token theft
- ✅ Signed cookies ensure integrity
- ✅ SameSite=strict prevents CSRF
- ✅ No localStorage token storage
- ✅ JWT rotation with family-based revocation
- ✅ Comprehensive CSRF protection
- ✅ SSL enforcement in production

### New Security Controls
- Configurable idle timeout (default 24 hours)
- Absolute session timeout (default 31 days)
- Session tracking for audit purposes
- Graceful session expiration with clear reasons

## Implementation Learnings

### What Went Well
1. **Reused Existing Infrastructure**: Leveraged existing CSRF token manager and API client
2. **Simple Timer-Based Approach**: Easy to understand and debug
3. **Configuration Flexibility**: Environment variables allow deployment customization
4. **Backward Compatibility**: No breaking changes to existing auth flow

### Adjustments During Implementation
1. **CSRF Token Import**: Used existing `csrfTokenManager` from `$lib/api/csrf` instead of creating new manager
2. **Cookie Timeout**: Extended to 30 minutes (3x refresh interval) for safety margin
3. **Debug Utilities**: Added test helper and console access for easier troubleshooting
4. **Session Metadata**: Enhanced refresh endpoint response with session age information

## Testing Strategy

### Manual Testing
```javascript
// Browser console commands
window.authLayoutDebug.backgroundRefresh // Check status
window.testBackgroundRefresh() // Run full test suite
```

### Test Scenarios
1. Normal refresh cycle (every 10 minutes)
2. Idle timeout behavior (24+ hours)
3. Absolute session timeout (31 days)
4. Network failure resilience
5. Tab close/reopen behavior

## Rollout Plan

### Phase 1: Initial Deployment
- Deploy with default configuration (10/24/744)
- Monitor session duration metrics
- Gather user feedback on experience

### Phase 2: Optimization
- Adjust timeouts based on usage patterns
- Consider different settings for different user types
- Implement session analytics dashboard

### Phase 3: Enhancements
- Add session activity warnings before timeout
- Implement "Remember Me" option for extended sessions
- Add admin controls for organization-level policies

## Success Metrics
- Reduction in session timeout support tickets
- Increased average session duration
- Improved user satisfaction scores
- No increase in security incidents

## Dependencies
- Existing authentication system
- JWT token infrastructure
- CSRF protection mechanism
- Frontend routing and layout system

## Related Documentation
- Authentication system documentation
- JWT implementation details
- Security policy guidelines
- Frontend architecture guide