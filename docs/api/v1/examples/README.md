# API Examples

This directory contains practical code examples for integrating with the bŏs API.

## Example Categories

### Authentication Examples
- [JavaScript/TypeScript](./authentication/javascript.md) - Browser and Node.js examples
- [Swift](./authentication/swift.md) - iOS mobile app integration
- [cURL](./authentication/curl.md) - Command-line examples

### Core Operations
- [Job Management](./jobs.md) - Creating, updating, and managing jobs
- [Task Management](./tasks.md) - Task operations and reordering
- [Client Management](./clients.md) - Client CRUD operations
- [User Management](./users.md) - User administration

### Advanced Integration
- [WebSocket Integration](./websocket.md) - Real-time updates
- [Offline Support](./offline.md) - Handling offline scenarios
- [Batch Operations](./batch.md) - Bulk operations and sync
- [Error Handling](./error-handling.md) - Robust error handling patterns

### Frontend Integration
- [Svelte Integration](./frontend/svelte.md) - Using with Svelte/SvelteKit
- [React Integration](./frontend/react.md) - React integration patterns
- [Vue Integration](./frontend/vue.md) - Vue.js integration

## Quick Start Example

Here's a complete example of authenticating and fetching jobs:

```typescript
// Authentication and basic job fetching
async function example() {
  // 1. Login
  const loginResponse = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth: {
        email: 'user@example.com',
        password: 'password123'
      }
    })
  });

  if (!loginResponse.ok) {
    throw new Error('Login failed');
  }

  // 2. Fetch jobs (cookies automatically included)
  const jobsResponse = await fetch('/api/v1/jobs', {
    headers: {
      'Accept': 'application/vnd.api+json',
    }
  });

  const jobsData = await jobsResponse.json();
  
  // 3. Process jobs
  jobsData.data.forEach(job => {
    console.log(`Job: ${job.attributes.title} (${job.attributes.status})`);
  });
}
```

## Using the Examples

Each example includes:
- Complete, runnable code
- Error handling patterns
- Best practices
- Common pitfalls to avoid
- Performance considerations

## Testing Examples

All examples can be tested against the development server:
```bash
# Start the development server
rails server

# Run examples against localhost:3000
```

## Contributing Examples

When adding new examples:
1. Include complete, working code
2. Add proper error handling
3. Document any prerequisites
4. Include expected responses
5. Test against the actual API