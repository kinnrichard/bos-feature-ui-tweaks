# bŏs API Documentation Index

## Quick Navigation

| Section | Description | Quick Link |
|---------|-------------|------------|
| **Getting Started** | Authentication and quick start guide | [Authentication](./api-authentication.md) |
| **API Specification** | Technical specification and standards | [Specification](./api-specification.md) |
| **Frontend Integration** | Svelte/React/Vue integration patterns | [Frontend Guide](./FRONTEND_INTEGRATION.md) |
| **Interactive Docs** | Swagger UI for testing | [/api-docs.html](../../public/api-docs.html) |
| **Examples** | Working code examples | [Examples](./v1/examples/) |

## Documentation Structure

```
docs/api/
├── README.md                      # Main API documentation overview
├── api-authentication.md         # Authentication methods and security
├── api-specification.md          # Technical API specification
├── FRONTEND_INTEGRATION.md       # Frontend integration guide
├── FRONTEND_API_REFERENCE.md     # ActiveRecord/ReactiveRecord reference
├── LEGACY_API_SPEC.md            # Legacy Rails API (deprecated)
├── index.md                      # This index file
└── v1/                           # Version 1 API documentation
    ├── README_V1_API.md          # V1 API overview
    ├── authentication/           # Authentication flows
    │   └── README.md
    ├── endpoints/                # Endpoint documentation
    │   └── README.md
    ├── examples/                 # Code examples
    │   └── README.md
    ├── guides/                   # Integration guides
    │   └── README.md
    └── reference/                # Type definitions and API reference
        └── README.md
```

## API Overview

### Base Configuration
- **Base URL**: `/api/v1`
- **Format**: JSON:API specification
- **Authentication**: Bearer token (cookies or header)
- **Content-Type**: `application/vnd.api+json`

### Core Resources
- **Jobs** - Job management and tracking
- **Tasks** - Task creation and management
- **Clients** - Client relationship management
- **Users** - User administration
- **Devices** - Device management
- **WebSocket** - Real-time communication

## Quick Start Examples

### 1. Authentication
```bash
# Login
curl -X POST /api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"auth":{"email":"user@example.com","password":"password"}}'

# Logout
curl -X POST /api/v1/auth/logout
```

### 2. Job Management
```bash
# Get all jobs
curl -X GET /api/v1/jobs \
  -H "Accept: application/vnd.api+json"

# Create job
curl -X POST /api/v1/jobs \
  -H "Content-Type: application/vnd.api+json" \
  -d '{
    "data": {
      "type": "job",
      "attributes": {
        "title": "New Job",
        "status": "open"
      }
    }
  }'
```

### 3. Task Management
```bash
# Create task
curl -X POST /api/v1/tasks \
  -H "Content-Type: application/vnd.api+json" \
  -d '{
    "data": {
      "type": "task",
      "attributes": {
        "title": "New Task",
        "job_id": "job-123"
      }
    }
  }'
```

## Frontend Integration (TypeScript/Svelte)

### ActiveRecord API
```typescript
import { Job, Task } from '@/lib/models';

// Promise-based operations
const job = await Job.find('job-id');
const jobs = await Job.where({ status: 'open' }).all();
const newJob = await Job.create({ title: 'New Job' });
```

### ReactiveRecord API (Svelte)
```svelte
<script>
  import { ReactiveJob } from '@/lib/models';
  
  const jobsStore = ReactiveJob.where({ status: 'open' });
  $: jobs = $jobsStore.data;
</script>

{#each jobs as job}
  <div>{job.title}</div>
{/each}
```

## Authentication Methods

### Cookie-Based (Web Apps)
- Automatic cookie management
- CSRF protection
- XSS protection via httpOnly

### Bearer Token (Mobile Apps)
- Manual token management
- Flexible storage options
- Authorization header

## Error Handling

### Standard Error Format
```json
{
  "errors": [{
    "status": "422",
    "code": "VALIDATION_FAILED",
    "title": "Validation Error",
    "detail": "Title is required"
  }]
}
```

### Common Status Codes
- `200 OK` - Success
- `201 Created` - Resource created
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `422 Unprocessable Entity` - Validation error
- `429 Too Many Requests` - Rate limited

## Real-time Updates

### WebSocket Connection
```javascript
const ws = new WebSocket('ws://localhost:3000/cable');

ws.onopen = () => {
  ws.send(JSON.stringify({
    command: 'subscribe',
    identifier: JSON.stringify({
      channel: 'JobChannel',
      job_id: 'job-123'
    })
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle real-time updates
};
```

## Rate Limiting

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 10 requests | 1 hour |
| General API | 1000 requests | 1 hour |
| WebSocket | 100 connections | Per IP |

## Security Features

- **JWT tokens** with 15-minute expiry
- **Refresh token rotation** with family tracking
- **CSRF protection** via SameSite cookies
- **Rate limiting** on all endpoints
- **Input validation** and sanitization

## Development Tools

### Interactive Documentation
Visit `/api-docs.html` for Swagger UI with:
- Interactive endpoint testing
- Request/response examples
- Authentication setup
- Parameter documentation

### Testing Endpoints
```bash
# Health check
curl -X GET /api/v1/health

# API documentation
curl -X GET /api/v1/documentation
```

## Integration Patterns

### 1. Simple Integration
```javascript
// Basic fetch with authentication
const response = await fetch('/api/v1/jobs', {
  headers: {
    'Accept': 'application/vnd.api+json'
  }
});
```

### 2. Advanced Integration
```javascript
// With error handling and retry logic
class ApiClient {
  async request(endpoint, options = {}) {
    const response = await fetch(`/api/v1${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      throw new ApiError(response);
    }
    
    return response.json();
  }
}
```

## Best Practices

1. **Always handle errors** - Implement proper error boundaries
2. **Use authentication** - Never skip authentication checks
3. **Validate inputs** - Validate all user inputs before API calls
4. **Handle rate limits** - Implement exponential backoff
5. **Cache responses** - Cache frequent requests appropriately
6. **Use WebSockets** - For real-time features
7. **Test thoroughly** - Unit and integration test API calls
8. **Monitor performance** - Track response times and errors

## Common Workflows

### Job Creation Workflow
1. Authenticate user
2. Get client list
3. Create job with client_id
4. Add tasks to job
5. Assign technicians
6. Set due dates and priorities

### Task Management Workflow
1. Fetch job tasks
2. Update task status
3. Reorder tasks (drag & drop)
4. Add notes and comments
5. Mark tasks complete

### Real-time Collaboration
1. Connect to WebSocket
2. Subscribe to job channel
3. Listen for task updates
4. Update UI in real-time
5. Handle user presence

## Troubleshooting

### Common Issues
- **401 Unauthorized**: Check authentication token
- **403 Forbidden**: Verify user permissions
- **422 Validation Error**: Check required fields
- **429 Rate Limited**: Implement retry with backoff
- **500 Server Error**: Check server logs

### Debug Tools
- Browser DevTools Network tab
- Server logs in development
- WebSocket connection inspector
- API response validation

## Migration Guide

### From Legacy API
The legacy Rails API is deprecated. See [LEGACY_API_SPEC.md](./LEGACY_API_SPEC.md) for old endpoints and [migration guide](./v1/guides/migration.md) for upgrading.

### Version Compatibility
- **v1.0**: Current stable version
- **Legacy**: Deprecated, remove by end of 2024

## Contributing

When updating API documentation:
1. Update relevant section
2. Add examples for new endpoints
3. Update this index if structure changes
4. Test examples against actual API
5. Update interactive documentation

## Support

For API support:
- Check this documentation first
- Review [examples](./v1/examples/) for working code
- Consult [guides](./v1/guides/) for integration help
- Use [interactive documentation](../../public/api-docs.html) for testing

## Related Resources

- [Technical Standards](../standards/technical-decisions.md)
- [Testing Guide](../tests/README-tests.md)
- [Development Setup](../setup/README.md)
- [Style Guide](../standards/style-guide.md)