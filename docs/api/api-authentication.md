---
title: "API Authentication Guide"
description: "Complete guide to bŏs API authentication methods and security"
last_updated: "2025-07-17"
status: "active"
category: "api"
tags: ["api", "authentication", "security", "jwt", "cookies"]
---

# API Authentication Guide

The bŏs API supports two authentication methods to accommodate different client types:

## 1. Cookie-Based Authentication (Svelte PWA)

**Use Case**: Web browsers, specifically the Svelte Progressive Web App

**How it works**:
- Tokens are stored in secure `httpOnly` cookies
- Cookies are automatically included in requests by the browser
- Provides protection against XSS attacks
- Uses `SameSite=Strict` to prevent CSRF attacks

**Login Flow**:
```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "auth": {
    "email": "user@example.com",
    "password": "password123"
  }
}

# Response sets cookies:
# - auth_token (15 minutes)
# - refresh_token (7 days)
```

## 2. Bearer Token Authentication (Future Swift App)

**Use Case**: Native mobile applications (planned Swift app)

**How it works**:
- Tokens are returned in the response body
- Client must include tokens in `Authorization` header
- More flexible for mobile app token storage strategies

**Login Flow**:
```bash
POST /api/v1/auth/login
Content-Type: application/json
X-Request-Client: mobile

{
  "auth": {
    "email": "user@example.com",
    "password": "password123"
  }
}

# Response includes tokens in body:
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

**Subsequent Requests**:
```bash
GET /api/v1/jobs
Authorization: Bearer eyJ...
```

## Authentication Priority

The API checks for authentication in this order:
1. `Authorization` header (Bearer token)
2. `auth_token` cookie

This allows both client types to use the same endpoints seamlessly.

## Security Features

- **JWT tokens** with 15-minute access token expiry
- **Refresh token rotation** with family tracking
- **Rate limiting** on authentication endpoints
- **Secure cookie attributes** (httpOnly, secure, sameSite)
- **Token revocation** support for refresh tokens

## Rate Limits

- Login attempts: 10 per hour per IP/email
- Refresh attempts: 5 per hour per IP
- General API: 1000 requests per hour per IP