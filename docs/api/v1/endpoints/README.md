# API v1 Endpoints

## Overview

This directory contains detailed documentation for all API v1 endpoints, organized by resource type.

## Endpoint Categories

### Authentication
- [Authentication](./authentication.md) - Login, logout, token refresh, session management

### Core Resources
- [Jobs](./jobs.md) - Job management, status updates, assignment
- [Tasks](./tasks.md) - Task creation, updates, reordering, completion
- [Clients](./clients.md) - Client management, search, CRUD operations
- [Users](./users.md) - User management, roles, settings

### Supporting Resources
- [Devices](./devices.md) - Device management for clients
- [People](./people.md) - Contact management for clients
- [Notes](./notes.md) - Note management for jobs
- [Scheduled Date Times](./scheduled-date-times.md) - Scheduling management

### System Resources
- [Health](./health.md) - Health check and system status
- [WebSocket](./websocket.md) - Real-time communication
- [Documentation](./documentation.md) - API documentation endpoint

## Common Patterns

### Request/Response Format
All endpoints follow JSON:API specification with consistent request/response formats.

### Error Handling
Standardized error responses with appropriate HTTP status codes and detailed error information.

### Authentication
All endpoints (except health and documentation) require authentication via Bearer token or session cookies.

### Rate Limiting
Rate limits are applied per endpoint category with different limits for different types of operations.

## Base URL

All endpoints are prefixed with `/api/v1/`

Example: `GET /api/v1/jobs`

## Quick Reference

| Resource | Methods | Description |
|----------|---------|-------------|
| `/auth/login` | POST | Authenticate user |
| `/auth/logout` | POST | End session |
| `/auth/refresh` | POST | Refresh access token |
| `/jobs` | GET, POST | List and create jobs |
| `/jobs/:id` | GET, PATCH, DELETE | Job operations |
| `/tasks` | GET, POST | List and create tasks |
| `/tasks/:id` | GET, PATCH, DELETE | Task operations |
| `/clients` | GET, POST | List and create clients |
| `/clients/:id` | GET, PATCH, DELETE | Client operations |
| `/users` | GET, POST | List and create users |
| `/users/:id` | GET, PATCH, DELETE | User operations |
| `/health` | GET | Health check |
| `/documentation` | GET | OpenAPI spec |
| `/websocket/connection_info` | GET | WebSocket connection details |