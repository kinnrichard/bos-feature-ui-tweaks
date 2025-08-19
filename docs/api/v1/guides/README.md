# API Integration Guides

This directory contains comprehensive guides for integrating with the bŏs API across different scenarios and platforms.

## Available Guides

### Getting Started
- [Quick Start Guide](./quick-start.md) - Get up and running in 5 minutes
- [Authentication Setup](./authentication-setup.md) - Detailed authentication implementation
- [Error Handling](./error-handling.md) - Robust error handling patterns

### Platform-Specific Guides
- [Web Application Integration](./web-integration.md) - Browser-based applications
- [Mobile Application Integration](./mobile-integration.md) - iOS and Android apps
- [Server-to-Server Integration](./server-integration.md) - API-to-API communication

### Advanced Topics
- [Real-time Updates](./realtime-updates.md) - WebSocket integration
- [Offline Support](./offline-support.md) - Handling offline scenarios
- [Performance Optimization](./performance.md) - Scaling and optimization
- [Security Best Practices](./security.md) - Security considerations

### Development Workflow
- [Testing API Integration](./testing.md) - Testing strategies and examples
- [Development Environment Setup](./development-setup.md) - Local development
- [Deployment Considerations](./deployment.md) - Production deployment

## Quick Start

Here's a minimal example to get you started:

```bash
# 1. Authenticate
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"auth":{"email":"user@example.com","password":"password"}}'

# 2. Fetch jobs (cookies automatically included)
curl -X GET http://localhost:3000/api/v1/jobs \
  -H "Accept: application/vnd.api+json"

# 3. Create a task
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/vnd.api+json" \
  -d '{
    "data": {
      "type": "task",
      "attributes": {
        "title": "New Task",
        "status": "pending"
      }
    }
  }'
```

## Integration Patterns

### 1. Authentication Flow
```typescript
// Login and store session
const login = async (email: string, password: string) => {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth: { email, password } })
  });
  
  if (response.ok) {
    // Session stored in httpOnly cookie automatically
    return true;
  }
  
  throw new Error('Login failed');
};
```

### 2. API Client Setup
```typescript
// Reusable API client
class ApiClient {
  private baseUrl = '/api/v1';
  
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new ApiError(response);
    }
    
    return response.json();
  }
}
```

### 3. Error Handling
```typescript
// Centralized error handling
class ApiError extends Error {
  constructor(public response: Response) {
    super(`API Error: ${response.status}`);
  }
}

// Usage with try-catch
try {
  const jobs = await apiClient.get('/jobs');
} catch (error) {
  if (error instanceof ApiError) {
    if (error.response.status === 401) {
      // Handle authentication error
      redirectToLogin();
    }
  }
}
```

## Common Use Cases

### Job Management
```typescript
// Complete job management workflow
const jobWorkflow = {
  async createJob(data: JobData) {
    return apiClient.post('/jobs', { data: { type: 'job', attributes: data } });
  },
  
  async updateStatus(jobId: string, status: string) {
    return apiClient.patch(`/jobs/${jobId}`, {
      data: { type: 'job', id: jobId, attributes: { status } }
    });
  },
  
  async addTask(jobId: string, taskData: TaskData) {
    return apiClient.post('/tasks', {
      data: { 
        type: 'task', 
        attributes: { ...taskData, job_id: jobId }
      }
    });
  }
};
```

### Real-time Updates
```typescript
// WebSocket integration
const subscribeToUpdates = (jobId: string) => {
  const ws = new WebSocket('ws://localhost:3000/cable');
  
  ws.onopen = () => {
    ws.send(JSON.stringify({
      command: 'subscribe',
      identifier: JSON.stringify({
        channel: 'JobChannel',
        job_id: jobId
      })
    }));
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // Handle real-time updates
    updateJobInUI(data);
  };
};
```

## Best Practices Summary

1. **Always handle errors gracefully** - Implement proper error boundaries
2. **Use authentication properly** - Handle token refresh and expiration
3. **Implement caching** - Cache responses to reduce API calls
4. **Handle offline scenarios** - Provide offline functionality where possible
5. **Test thoroughly** - Unit and integration test your API integration
6. **Monitor performance** - Track API response times and errors
7. **Follow security practices** - Use HTTPS, validate inputs, handle tokens securely

## Getting Help

For additional help with API integration:

1. Check the [examples directory](../examples/) for working code
2. Review the [API specification](../../api-specification.md) for technical details
3. Consult the [authentication guide](../../api-authentication.md) for auth setup
4. Look at the [frontend integration guide](../../FRONTEND_INTEGRATION.md) for Svelte-specific patterns

## Contributing

When adding new guides:
1. Follow the existing structure and format
2. Include complete, working examples
3. Add proper error handling
4. Test examples against the actual API
5. Update this README to include the new guide