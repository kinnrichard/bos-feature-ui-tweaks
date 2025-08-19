# bŏs REST API Specification

## Overview

The bŏs application primarily serves HTML responses using Phlex components, but also supports JSON responses for AJAX interactions and potential future API clients. This document describes the available endpoints and their JSON response formats.

## Authentication

All API endpoints require authentication via session cookies. There is no token-based API authentication at this time.

```http
Cookie: _bos_session=<session_id>
```

## Response Formats

### Standard Response Headers

```http
Content-Type: application/json
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
```

### Error Responses

```json
{
  "error": "Not found",
  "status": 404
}
```

## Endpoints

### Authentication

#### POST /login
Authenticate user and create session.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** Redirect to root path on success

#### DELETE /logout
End user session.

**Response:** Redirect to login page

### Clients

#### GET /clients
List all clients (HTML only).

#### GET /clients/search.json
Search clients by name.

**Query Parameters:**
- `q` - Search query (required)

**Response:**
```json
[
  {
    "id": 1,
    "name": "Acme Corporation",
    "client_type": "business",
    "name_normalized": "acme corporation",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
]
```

#### GET /clients/:id
Get client details (HTML only).

#### POST /clients
Create new client.

**Request:**
```json
{
  "client": {
    "name": "New Client Inc",
    "client_type": "business"
  }
}
```

**Response:** Redirect to client page on success

#### PATCH/PUT /clients/:id
Update client.

**Request:**
```json
{
  "client": {
    "name": "Updated Client Name",
    "client_type": "individual"
  }
}
```

**Response:** Redirect to client page on success

#### DELETE /clients/:id
Delete client.

**Response:** Redirect to clients index

### People

#### GET /clients/:client_id/people
List people for a client (HTML only).

#### GET /clients/:client_id/people/:id
Get person details (HTML only).

#### POST /clients/:client_id/people
Create new person.

**Request:**
```json
{
  "person": {
    "name": "John Doe",
    "notes": "Primary contact"
  }
}
```

#### PATCH/PUT /clients/:client_id/people/:id
Update person.

**Request:**
```json
{
  "person": {
    "name": "Jane Doe",
    "notes": "Updated notes"
  }
}
```

#### DELETE /clients/:client_id/people/:id
Delete person.

### Devices

#### GET /clients/:client_id/devices
List devices for a client (HTML only).

#### GET /clients/:client_id/devices/:id
Get device details (HTML only).

#### POST /clients/:client_id/devices
Create new device.

**Request:**
```json
{
  "device": {
    "name": "Server-01",
    "model": "Dell PowerEdge R740",
    "serial_number": "ABC123",
    "location": "Server Room A",
    "notes": "Production database server"
  }
}
```

#### PATCH/PUT /clients/:client_id/devices/:id
Update device.

#### DELETE /clients/:client_id/devices/:id
Delete device.

### Jobs

#### GET /jobs
List all jobs across all clients (HTML only).

#### GET /clients/:client_id/jobs
List jobs for a specific client (HTML only).

#### GET /clients/:client_id/jobs/:id
Get job details (HTML only).

#### POST /clients/:client_id/jobs
Create new job.

**Request:**
```json
{
  "job": {
    "title": "Monthly Maintenance",
    "description": "Regular system updates and checks",
    "status": 0,
    "priority": 1,
    "due_on": "2024-02-15",
    "due_time": "14:00:00",
    "start_on": "2024-02-15",
    "start_time": "09:00:00"
  }
}
```

**Status Values:**
- 0: Open
- 1: In Progress  
- 2: Paused
- 3: Waiting for Customer
- 4: Waiting for Scheduled Appointment
- 5: Successfully Completed
- 6: Cancelled

**Priority Values:**
- 0: Critical
- 1: High
- 2: Normal
- 3: Low
- 4: Proactive Followup

#### PATCH/PUT /clients/:client_id/jobs/:id
Update job.

#### DELETE /clients/:client_id/jobs/:id
Delete job.

### Tasks

#### GET /clients/:client_id/jobs/:job_id/tasks
List tasks for a job (HTML only).

#### GET /clients/:client_id/jobs/:job_id/tasks/:id
Get task details (HTML only).

#### POST /clients/:client_id/jobs/:job_id/tasks
Create new task.

**Request:**
```json
{
  "task": {
    "title": "Update firewall rules",
    "status": 0,
    "position": 1,
    "assigned_to_id": 2
  }
}
```

**Status Values:**
- 0: Pending
- 1: In Progress
- 2: Completed

#### PATCH /clients/:client_id/jobs/:job_id/tasks/:id
Update task.

#### PATCH /clients/:client_id/jobs/:job_id/tasks/:id/reorder
Change task position.

**Request:**
```json
{
  "position": 3
}
```

#### PATCH /clients/:client_id/jobs/:job_id/tasks/reorder
Bulk reorder tasks.

**Request:**
```json
{
  "task_ids": [5, 2, 8, 1, 3]
}
```

#### DELETE /clients/:client_id/jobs/:job_id/tasks/:id
Delete task.

### Notes

#### GET /clients/:client_id/jobs/:job_id/notes
List notes for a job (HTML only).

#### POST /clients/:client_id/jobs/:job_id/notes
Create new note.

**Request:**
```json
{
  "note": {
    "content": "Customer requested priority upgrade"
  }
}
```

#### PATCH/PUT /clients/:client_id/jobs/:job_id/notes/:id
Update note.

#### DELETE /clients/:client_id/jobs/:job_id/notes/:id
Delete note.

### Scheduled Date Times

#### POST /clients/:client_id/jobs/:job_id/scheduled_date_times
Create scheduled date/time.

**Request:**
```json
{
  "scheduled_date_time": {
    "scheduled_type": "appointment",
    "scheduled_date": "2024-02-20",
    "scheduled_time": "10:00:00",
    "notes": "On-site visit scheduled"
  }
}
```

#### PATCH/PUT /clients/:client_id/jobs/:job_id/scheduled_date_times/:id
Update scheduled date/time.

#### DELETE /clients/:client_id/jobs/:job_id/scheduled_date_times/:id
Delete scheduled date/time.

### Activity Logs

#### GET /clients/:client_id/logs
Get activity logs for a client (HTML only).

#### GET /logs
Get all activity logs (HTML only).

### Users

#### GET /users
List all users (owner only, HTML only).

#### GET /users/:id
Get user details (owner only, HTML only).

#### POST /users
Create new user (owner only).

**Request:**
```json
{
  "user": {
    "name": "New Technician",
    "email": "tech@example.com",
    "password": "securepassword123",
    "password_confirmation": "securepassword123",
    "role": 1
  }
}
```

**Role Values:**
- 0: Owner
- 1: Administrator
- 2: Member

#### PATCH/PUT /users/:id
Update user (owner only).

#### DELETE /users/:id
Delete user (owner only).

#### GET /settings
Get current user settings (HTML only).

#### PATCH /settings
Update current user settings.

**Request:**
```json
{
  "user": {
    "name": "Updated Name",
    "email": "newemail@example.com",
    "resort_tasks_on_status_change": true
  }
}
```

## Pagination

Currently, the API does not implement pagination. Large result sets are limited in the controller (e.g., search results limited to 10).

## Rate Limiting

No rate limiting is currently implemented.

## CORS

CORS is not configured as the API is intended for same-origin requests only.

## Future Considerations

1. **Token Authentication**: Implement API tokens for external clients
2. **Versioning**: Add `/api/v1/` namespace for versioned endpoints
3. **Pagination**: Add page-based or cursor-based pagination
4. **Rate Limiting**: Implement per-user rate limits
5. **GraphQL**: Consider GraphQL for complex data requirements
6. **Webhooks**: Add webhook support for event notifications
7. **Batch Operations**: Support bulk create/update/delete
8. **Field Selection**: Allow clients to specify which fields to return

## Response Status Codes

- `200 OK` - Successful GET/PATCH/PUT
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE
- `302 Found` - Redirect after successful form submission
- `400 Bad Request` - Invalid parameters
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Authenticated but not authorized
- `404 Not Found` - Resource not found
- `422 Unprocessable Entity` - Validation errors
- `500 Internal Server Error` - Server error

## Example API Usage

### Search for a client and create a job

```bash
# Search for client
curl -X GET "http://localhost:3000/clients/search.json?q=acme" \
  -H "Cookie: _bos_session=..."

# Create job for client ID 1
curl -X POST "http://localhost:3000/clients/1/jobs" \
  -H "Content-Type: application/json" \
  -H "Cookie: _bos_session=..." \
  -H "X-CSRF-Token: ..." \
  -d '{
    "job": {
      "title": "Server Maintenance",
      "status": 0,
      "priority": 2
    }
  }'
```

Note: Most endpoints return HTML by default. JSON responses are currently limited to specific endpoints that explicitly support the format.