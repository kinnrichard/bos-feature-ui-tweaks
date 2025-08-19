# bŏs API Documentation

## Overview

The bŏs (Business Operating System) API is a RESTful API that provides endpoints for managing jobs, tasks, clients, and technician collaboration. The API uses JWT for authentication and follows JSON:API specification for responses.

## Authentication

The API supports two authentication methods:

1. **Bearer Token**: Include the JWT token in the Authorization header
   ```
   Authorization: Bearer <your-jwt-token>
   ```

2. **Cookie Authentication**: The JWT token is automatically stored in an httpOnly cookie named `auth_token`

### Getting Started

1. **Login**: POST to `/api/v1/auth/login` with email and password
2. **Use Token**: Include the returned access token in subsequent requests
3. **Refresh Token**: POST to `/api/v1/auth/refresh` when the access token expires
4. **Logout**: POST to `/api/v1/auth/logout` to invalidate the session

## Interactive Documentation

Visit `/api-docs.html` in your browser for interactive API documentation powered by Swagger UI.

## Base URL

```
https://your-domain.com/api/v1
```

## Response Format

All responses follow the JSON:API specification:

```json
{
  "data": {
    "type": "resource-type",
    "id": "resource-id",
    "attributes": {
      // Resource attributes
    },
    "relationships": {
      // Related resources
    }
  }
}
```

## Error Handling

Errors are returned in JSON:API error format:

```json
{
  "errors": [{
    "status": "404",
    "code": "NOT_FOUND",
    "title": "Resource Not Found",
    "detail": "The requested job was not found"
  }]
}
```

## Common Status Codes

- `200 OK` - Successful request
- `201 Created` - Resource created successfully
- `204 No Content` - Successful request with no response body
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Authentication required or invalid token
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `422 Unprocessable Entity` - Validation errors
- `500 Internal Server Error` - Server error

## WebSocket Support

For real-time features, connect to the WebSocket endpoint:

1. GET `/api/v1/websocket/connection_info` to retrieve connection details
2. Connect to the WebSocket URL with the provided auth token
3. Subscribe to channels for real-time updates

### Available Channels

- **JobChannel**: Real-time job updates and task reordering
- **TechnicianChannel**: Technician collaboration (messaging, presence, location)

## Rate Limiting

API requests are rate-limited to prevent abuse:
- 100 requests per minute for authenticated users
- 20 requests per minute for unauthenticated requests

## Pagination

List endpoints support pagination using query parameters:
- `page`: Page number (default: 1)
- `per_page`: Items per page (default: 25, max: 100)

## Filtering and Search

Many endpoints support filtering and search:
- Use query parameters to filter results
- Search functionality varies by endpoint

## Versioning

The API is versioned via the URL path (e.g., `/api/v1/`). Breaking changes will result in a new version.

## Support

For API support, contact: support@example.com