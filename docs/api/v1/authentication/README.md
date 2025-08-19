# Authentication

## Overview

The bŏs API supports multiple authentication methods to accommodate different client types while maintaining security best practices.

## Authentication Methods

### 1. Cookie-Based Authentication (Default)
**Recommended for**: Web applications, Svelte PWA

- Tokens stored in secure `httpOnly` cookies
- Automatic inclusion in requests
- XSS protection via `httpOnly` flag
- CSRF protection via `SameSite=Strict`

### 2. Bearer Token Authentication
**Recommended for**: Mobile apps, API integrations

- Tokens included in `Authorization` header
- Flexible token storage strategies
- Suitable for native mobile applications

## Authentication Flow

### Login Process

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "auth": {
    "email": "user@example.com",
    "password": "secure_password"
  }
}
```

#### Cookie Response (Web)
```bash
# Response sets cookies automatically
Set-Cookie: auth_token=eyJ...; HttpOnly; Secure; SameSite=Strict; Max-Age=900
Set-Cookie: refresh_token=eyJ...; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
```

#### Token Response (Mobile)
```bash
# Include header: X-Request-Client: mobile
{
  "data": {
    "attributes": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "expiresAt": "2024-01-01T12:00:00Z"
    }
  }
}
```

### Token Refresh

```bash
POST /api/v1/auth/refresh
# For cookie auth: cookies sent automatically
# For token auth: Authorization: Bearer <refresh_token>
```

### Logout

```bash
POST /api/v1/auth/logout
# Invalidates current session and refresh tokens
```

## Using Authentication

### Cookie Authentication
No additional headers required - cookies sent automatically:

```bash
GET /api/v1/jobs
# Cookies included automatically by browser
```

### Bearer Token Authentication
Include token in Authorization header:

```bash
GET /api/v1/jobs
Authorization: Bearer eyJ...
```

## Security Features

### Token Expiration
- **Access Token**: 15 minutes
- **Refresh Token**: 7 days
- **Session Cookie**: 7 days

### Token Rotation
- Refresh tokens are rotated on each use
- Family tracking prevents token reuse attacks
- Automatic cleanup of expired tokens

### Rate Limiting
- **Login attempts**: 10 per hour per IP/email
- **Refresh attempts**: 5 per hour per IP
- **General API**: 1000 requests per hour per user

### Security Headers
- `httpOnly` cookies prevent XSS access
- `Secure` flag ensures HTTPS-only transmission
- `SameSite=Strict` prevents CSRF attacks

## Error Handling

### Authentication Errors

```json
{
  "errors": [{
    "status": "401",
    "code": "UNAUTHORIZED",
    "title": "Authentication Required",
    "detail": "Access token is expired or invalid"
  }]
}
```

### Common Error Codes
- `401 UNAUTHORIZED` - Missing or invalid token
- `403 FORBIDDEN` - Valid token but insufficient permissions
- `429 RATE_LIMITED` - Too many authentication attempts

## Best Practices

### For Web Applications
1. Use cookie authentication for automatic security
2. Implement token refresh before expiration
3. Handle 401 errors by redirecting to login
4. Clear tokens on logout

### For Mobile Applications
1. Use Bearer token authentication
2. Store tokens securely (Keychain/Keystore)
3. Implement automatic token refresh
4. Handle offline scenarios gracefully

### For API Integrations
1. Use Bearer tokens with longer expiration
2. Implement proper token rotation
3. Monitor rate limits
4. Use HTTPS only

## Implementation Examples

See [examples/authentication](../examples/authentication/) for practical implementation examples in various languages and frameworks.