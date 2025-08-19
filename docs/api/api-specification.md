---
title: "API Specification"
description: "Technical specification for the bŏs JSON:API implementation"
last_updated: "2025-07-17"
status: "active"
category: "api"
tags: ["api", "specification", "json-api", "endpoints", "technical"]
---

# API Specification

## Base Configuration

- **Base URL**: `/api/v1`
- **Format**: JSON:API specification
- **Authentication**: Bearer token via httpOnly cookies
- **Content-Type**: `application/vnd.api+json`

## Standard Response Format

### Success Response
```json
{
  "data": {
    "id": "job-550e8400-e29b-41d4-a716-446655440000",
    "type": "job",
    "attributes": {
      "title": "HVAC Repair",
      "status": "in_progress",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T14:22:00Z"
    },
    "relationships": {
      "technician": {
        "data": { "type": "user", "id": "user-550e8400-e29b-41d4-a716-446655440001" }
      },
      "tasks": {
        "data": [
          { "type": "task", "id": "task-550e8400-e29b-41d4-a716-446655440002" }
        ]
      }
    }
  },
  "included": [...],
  "meta": {
    "request_id": "req-550e8400-e29b-41d4-a716-446655440003",
    "timestamp": "2024-01-15T14:22:00Z"
  }
}
```

### Error Response Format
```json
{
  "errors": [
    {
      "id": "err-550e8400-e29b-41d4-a716-446655440004",
      "status": "422",
      "code": "VALIDATION_FAILED",
      "title": "Validation Error",
      "detail": "The status transition from 'completed' to 'scheduled' is not allowed",
      "source": {
        "pointer": "/data/attributes/status",
        "parameter": "status"
      },
      "meta": {
        "field": "status",
        "rejected_value": "scheduled",
        "allowed_values": ["completed", "archived"]
      }
    }
  ],
  "meta": {
    "request_id": "req-550e8400-e29b-41d4-a716-446655440005",
    "timestamp": "2024-01-15T14:22:00Z"
  }
}
```

## Error Codes

### Client Errors (4xx)

| Status | Code | Description | Example |
|--------|------|-------------|---------|
| 400 | `BAD_REQUEST` | Malformed request syntax | Invalid JSON |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication | Expired token |
| 403 | `FORBIDDEN` | Valid auth but insufficient permissions | Accessing another user's data |
| 404 | `NOT_FOUND` | Resource doesn't exist | Job not found |
| 409 | `CONFLICT` | Request conflicts with current state | Duplicate email |
| 422 | `VALIDATION_FAILED` | Request understood but invalid | Missing required field |
| 429 | `RATE_LIMITED` | Too many requests | Rate limit exceeded |

### Server Errors (5xx)

| Status | Code | Description | Recovery |
|--------|------|-------------|----------|
| 500 | `INTERNAL_ERROR` | Unexpected server error | Retry with backoff |
| 502 | `BAD_GATEWAY` | Invalid upstream response | Retry with backoff |
| 503 | `SERVICE_UNAVAILABLE` | Server temporarily unavailable | Check status page |
| 504 | `TIMEOUT` | Request timeout | Retry with smaller payload |

## Endpoints

### Authentication

#### POST /api/v1/auth/login
```bash
# Request
{
  "email": "tech@example.com",
  "password": "secure_password",
  "device_name": "John's MacBook Pro"
}

# Response (sets httpOnly cookies)
{
  "data": {
    "type": "session",
    "id": "session-550e8400-e29b-41d4-a716-446655440006",
    "attributes": {
      "user_id": "user-550e8400-e29b-41d4-a716-446655440001",
      "expires_at": "2024-01-15T15:22:00Z"
    }
  }
}
```

### Jobs

#### GET /api/v1/jobs
Query parameters:
- `filter[status]`: scheduled,in_progress,completed
- `filter[technician_id]`: GUID
- `sort`: created_at,-priority,title
- `page[number]`: 1
- `page[size]`: 20
- `include`: technician,tasks,client

#### PATCH /api/v1/jobs/:id
Field-level updates using JSON Patch format:
```json
{
  "data": {
    "type": "sync_operation",
    "attributes": {
      "operations": [
        {
          "op": "replace",
          "path": "/status",
          "value": "in_progress",
          "previous_value": "scheduled"
        }
      ],
      "client_timestamp": "2024-01-15T14:22:00Z",
      "base_version": "etag-abc123"
    }
  }
}
```

### Sync Operations

#### POST /api/v1/sync/batch
Batch sync for offline changes:
```json
{
  "data": {
    "type": "sync_batch",
    "attributes": {
      "operations": [
        {
          "entity_type": "job",
          "entity_id": "job-550e8400-e29b-41d4-a716-446655440000",
          "field_path": ["attributes", "status"],
          "operation": "set",
          "value": "in_progress",
          "timestamp": "2024-01-15T14:20:00Z",
          "device_id": "device-550e8400-e29b-41d4-a716-446655440007"
        }
      ]
    }
  }
}
```

Response includes any conflicts:
```json
{
  "data": {
    "type": "sync_result",
    "attributes": {
      "applied": 5,
      "conflicts": [
        {
          "entity_type": "job",
          "entity_id": "job-550e8400-e29b-41d4-a716-446655440000",
          "field": "status",
          "server_value": "completed",
          "client_value": "in_progress",
          "resolution": "server_wins",
          "reason": "Status cannot go backwards"
        }
      ]
    }
  }
}
```

## Rate Limiting

- **Authenticated requests**: 1000/hour per user
- **Auth endpoints**: 10/hour per IP
- **Sync endpoints**: 100/hour per device

Headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642255200
```

## Caching

- **ETag**: Supported on all GET endpoints
- **Cache-Control**: `private, max-age=0, must-revalidate`
- **Conditional requests**: `If-None-Match` returns 304

## WebSocket Events

Connect to: `wss://api.example.com/cable`

Subscription format:
```json
{
  "command": "subscribe",
  "identifier": "{\"channel\":\"JobChannel\",\"job_id\":\"job-550e8400-e29b-41d4-a716-446655440000\"}"
}
```

Event format:
```json
{
  "type": "job.updated",
  "data": {
    "id": "job-550e8400-e29b-41d4-a716-446655440000",
    "changes": {
      "status": ["scheduled", "in_progress"]
    }
  }
}
```