# Authentication System Design

## Overview

The bŏs application uses a JWT-based authentication system with HTTP-only cookies for web clients and Bearer token support for future mobile/API clients. The system implements secure token rotation, automatic refresh, and comprehensive CSRF protection.

## Architecture Components

### 1. Authentication Flow

#### Login Process
1. User submits credentials to `/api/v1/auth/sessions` (POST)
2. Server validates credentials against User model
3. Server generates JWT access token (30-minute expiry) and refresh token (7-day expiry)
4. Tokens are set as HTTP-only, secure, SameSite=strict cookies
5. Client is redirected to authenticated area

#### Token Structure
- **Access Token**: Short-lived JWT (30 minutes) containing user_id and token type
- **Refresh Token**: Long-lived JWT (7 days) with rotation on use
- Both tokens include JTI (JWT ID) for revocation tracking

### 2. Token Management

#### JWT Service (`app/services/jwt_service.rb`)
- Centralized JWT encoding/decoding with HS256 algorithm
- Configurable secret key from environment
- Proper error handling for expired and invalid tokens

#### Token Storage
- **Web Clients**: HTTP-only cookies (`auth_token` and `refresh_token`)
- **Future Mobile Clients**: Bearer tokens in Authorization header
- **Security Flags**: `httponly: true`, `secure: true` (production), `same_site: :strict`

#### Token Revocation
- `RevokedToken` model tracks revoked JTIs
- Tokens checked against revocation list on each request
- Family-based revocation for refresh token theft detection

### 3. Background Token Refresh

#### Client-Side Service (`frontend/src/lib/auth/background-refresh.ts`)
- Automatic refresh every 10 minutes (configurable)
- Session timeout enforcement:
  - Idle timeout: 24 hours (no refresh activity)
  - Absolute timeout: 31 days (maximum session age)
- LocalStorage tracking for session metadata
- Graceful handling of refresh failures

#### Configuration
```typescript
REFRESH_INTERVAL_MINUTES: 10 (default)
MAX_IDLE_HOURS: 24 (default)  
MAX_SESSION_HOURS: 744 (31 days default)
```

### 4. CSRF Protection

#### Token Management (`frontend/src/lib/api/csrf.ts`)
- Automatic CSRF token inclusion in API requests
- 4-minute cache with 2-minute proactive refresh
- Token distributed via response headers and meta tags

#### Server-Side Validation
- `ApiCsrfProtection` concern validates tokens
- Tokens required for cookie-based authentication
- Skipped for Bearer token authentication

### 5. API Client Integration

#### Axios Interceptors (`frontend/src/lib/api/client.ts`)
- Automatic retry on 401 with token refresh
- Request queuing during refresh
- CSRF token automatic inclusion
- Comprehensive error handling

#### Authentication Retry Flow
1. Request fails with 401
2. Client attempts token refresh via `/api/v1/auth/refresh`
3. On success: retry original request
4. On failure: redirect to login

### 6. Zero Integration

#### Zero Token Endpoint (`/api/v1/zero/token`)
- Generates Zero-specific JWT for real-time sync
- Uses same authentication as main API
- Decodes JWT auth token to identify user

## Security Features

### Token Security
- ✅ HTTP-only cookies prevent XSS attacks
- ✅ Signed cookies ensure integrity
- ✅ SameSite=strict prevents CSRF
- ✅ No localStorage token storage
- ✅ JWT rotation with family-based revocation
- ✅ Automatic token revocation on logout

### Session Management
- ✅ Configurable timeout policies
- ✅ Idle and absolute session limits
- ✅ Graceful session expiration
- ✅ Clear logout reasons

### Request Security
- ✅ CSRF token validation
- ✅ SSL enforcement in production
- ✅ Request ID tracking
- ✅ Comprehensive error handling

## API Endpoints

### Authentication Endpoints
- `POST /api/v1/auth/sessions` - Login
- `POST /api/v1/auth/refresh` - Refresh tokens
- `DELETE /api/v1/auth/sessions` - Logout
- `GET /api/v1/auth/current` - Get current user

### Token Endpoints
- `GET /api/v1/zero/token` - Get Zero sync token
- `GET /api/auth/csrf-token` - Get CSRF token

## Configuration

### Environment Variables
```bash
# JWT Configuration
JWT_SECRET_KEY=<secret-key>

# Session Timeouts (Frontend)
VITE_AUTH_REFRESH_INTERVAL_MINUTES=10
VITE_AUTH_MAX_IDLE_HOURS=24
VITE_AUTH_MAX_SESSION_HOURS=744
VITE_AUTH_COOKIE_EXPIRATION_MINUTES=30

# Zero Configuration
ZERO_AUTH_SECRET=<zero-secret>
```

### Cookie Configuration
```ruby
cookies.signed[:auth_token] = {
  value: token,
  httponly: true,
  secure: Rails.env.production?,
  same_site: :strict,
  expires: 30.minutes.from_now
}
```

## Error Handling

### Client-Side
- 401: Automatic refresh attempt
- 403: CSRF token refresh
- 429: Rate limiting with backoff
- 5xx: Retry with exponential backoff

### Server-Side
- Invalid credentials: 401 with error message
- Missing token: 400 with MISSING_TOKEN code
- Expired token: 401 triggers client refresh
- Revoked token: 401 with immediate logout

## Future Enhancements

### Planned Features
1. **Device Management**: Track and manage user sessions across devices
2. **Remember Me**: Optional extended sessions
3. **2FA Support**: Two-factor authentication integration
4. **Session Analytics**: Usage patterns and security monitoring
5. **Mobile SDK**: Native mobile authentication support

### Security Improvements
1. **Token Binding**: Bind tokens to device fingerprints
2. **Anomaly Detection**: Detect suspicious login patterns
3. **Geolocation Checks**: Alert on unusual locations
4. **Concurrent Session Limits**: Configurable per-user limits

## Development Notes

### Testing Authentication
```javascript
// Browser console helpers
window.authLayoutDebug.backgroundRefresh // Check refresh status
window.testBackgroundRefresh() // Run manual tests
```

### Debug Logging
- Rails: `AUTH DEBUG` and `ZERO RESOLVE DEBUG` prefixes
- Frontend: `debugAuth` and `debugAPI` utilities
- CSRF: Token validation logging in development

### Common Issues
1. **Login 401**: Usually missing refresh token or Zero token endpoint
2. **CSRF Errors**: Token expiry or missing header
3. **Refresh Loops**: Token family revocation or corruption
4. **Session Timeout**: Check idle/absolute limits

## Best Practices

### Security
1. Never store tokens in localStorage
2. Always use HTTPS in production
3. Implement proper logout with token revocation
4. Monitor failed authentication attempts
5. Use secure random secrets in production

### Performance
1. Cache CSRF tokens appropriately
2. Implement request queuing during refresh
3. Use connection pooling for database
4. Monitor token refresh frequency

### User Experience
1. Transparent token refresh
2. Clear session timeout warnings
3. Graceful error handling
4. Persistent sessions within limits
5. Quick login/logout transitions