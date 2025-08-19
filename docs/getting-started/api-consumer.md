---
title: "API Consumer Getting Started Guide"
description: "Complete guide for developers integrating with the bŏs API"
last_updated: "2025-07-17"
status: "active"
category: "getting-started"
tags: ["api", "integration", "authentication", "endpoints"]
---

# API Consumer Getting Started Guide

> **Complete guide for developers integrating with the bŏs API**

## 🎯 Objectives
After completing this guide, you will:
- Understand the bŏs API architecture and capabilities
- Successfully authenticate with the API
- Make your first API calls and handle responses
- Know how to handle errors and edge cases
- Have working code examples for common use cases

## 📋 Prerequisites
- Basic knowledge of REST APIs and HTTP
- Familiarity with JSON data format
- Understanding of API authentication concepts
- Development environment with HTTP client capabilities

## 📚 API Overview

The bŏs API is a RESTful JSON API that provides access to:
- **Clients** - Company and organization management
- **Jobs** - Work order and project tracking
- **Tasks** - Individual work item management
- **Devices** - IT equipment tracking
- **People** - Contact and personnel management
- **Users** - System user management

### API Characteristics
- **REST Architecture**: Standard HTTP verbs (GET, POST, PUT, DELETE)
- **JSON Format**: All requests and responses use JSON
- **JWT Authentication**: Stateless authentication with tokens
- **UUID Identifiers**: All resources use UUID primary keys
- **Pagination**: Large result sets are paginated
- **Rate Limiting**: API calls are rate-limited per client

---

## 🚀 Phase 1: API Access Setup (15-30 minutes)

### 1.1 Base URL and Environment
```javascript
// Production API
const API_BASE_URL = 'https://api.bos.example.com';

// Development API (if applicable)
const DEV_API_BASE_URL = 'https://dev-api.bos.example.com';

// Local development
const LOCAL_API_BASE_URL = 'http://localhost:3000';
```

### 1.2 API Versioning
All API endpoints are versioned:
```
/api/v1/clients
/api/v1/jobs
/api/v1/tasks
```

### 1.3 Required Headers
```javascript
const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Authorization': `Bearer ${jwt_token}`,
  'X-API-Version': 'v1'
};
```

### 1.4 HTTP Client Setup

#### JavaScript/Node.js (Axios)
```javascript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.bos.example.com/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-API-Version': 'v1'
  }
});

// Add auth interceptor
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('bos_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);
```

#### Python (requests)
```python
import requests
import json

class BosAPIClient:
    def __init__(self, base_url, token=None):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-API-Version': 'v1'
        })
        if token:
            self.session.headers['Authorization'] = f'Bearer {token}'
    
    def get(self, endpoint, params=None):
        url = f"{self.base_url}/api/v1/{endpoint}"
        return self.session.get(url, params=params)
    
    def post(self, endpoint, data=None):
        url = f"{self.base_url}/api/v1/{endpoint}"
        return self.session.post(url, json=data)
```

#### cURL Examples
```bash
# GET request
curl -X GET \
  "https://api.bos.example.com/api/v1/clients" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json"

# POST request
curl -X POST \
  "https://api.bos.example.com/api/v1/clients" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Client", "email": "client@example.com"}'
```

---

## 🔐 Phase 2: Authentication (30-45 minutes)

### 2.1 Authentication Flow
The bŏs API uses JWT (JSON Web Token) authentication:

1. **Login** → Receive JWT token
2. **Include token** in Authorization header for all requests
3. **Refresh token** before expiration
4. **Logout** → Invalidate token

### 2.2 Login Authentication

#### Login Request
```javascript
const loginResponse = await apiClient.post('/auth/login', {
  email: 'user@example.com',
  password: 'your_password'
});

// Response structure
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "refresh_token_string",
  "expires_in": 3600,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "User Name",
    "role": "technician"
  }
}
```

#### Store and Use Token
```javascript
// Store tokens securely
localStorage.setItem('bos_token', loginResponse.data.token);
localStorage.setItem('bos_refresh_token', loginResponse.data.refresh_token);

// Use token in subsequent requests
const token = localStorage.getItem('bos_token');
apiClient.defaults.headers.Authorization = `Bearer ${token}`;
```

### 2.3 Token Refresh
```javascript
async function refreshToken() {
  const refreshToken = localStorage.getItem('bos_refresh_token');
  
  try {
    const response = await apiClient.post('/auth/refresh', {
      refresh_token: refreshToken
    });
    
    localStorage.setItem('bos_token', response.data.token);
    localStorage.setItem('bos_refresh_token', response.data.refresh_token);
    
    // Update client default headers
    apiClient.defaults.headers.Authorization = `Bearer ${response.data.token}`;
    
    return response.data.token;
  } catch (error) {
    // Refresh failed, redirect to login
    localStorage.removeItem('bos_token');
    localStorage.removeItem('bos_refresh_token');
    window.location.href = '/login';
  }
}
```

### 2.4 Automatic Token Refresh
```javascript
// Add response interceptor for automatic token refresh
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        await refreshToken();
        originalRequest.headers.Authorization = `Bearer ${localStorage.getItem('bos_token')}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Handle refresh failure
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
```

### 2.5 Logout
```javascript
async function logout() {
  try {
    await apiClient.post('/auth/logout');
  } catch (error) {
    console.error('Logout failed:', error);
  } finally {
    // Clear local storage regardless of API call result
    localStorage.removeItem('bos_token');
    localStorage.removeItem('bos_refresh_token');
    window.location.href = '/login';
  }
}
```

---

## 📊 Phase 3: Core API Operations (45-60 minutes)

### 3.1 Clients API

#### List Clients
```javascript
// GET /api/v1/clients
const clientsResponse = await apiClient.get('/clients', {
  params: {
    page: 1,
    per_page: 20,
    search: 'company name'
  }
});

// Response structure
{
  "clients": [
    {
      "id": "client-uuid",
      "name": "Company Name",
      "email": "contact@company.com",
      "phone": "+1-555-0123",
      "address": "123 Main St, City, State 12345",
      "client_type": "business",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 20,
    "total_pages": 5,
    "total_count": 95
  }
}
```

#### Create Client
```javascript
// POST /api/v1/clients
const newClient = await apiClient.post('/clients', {
  name: 'New Company',
  email: 'contact@newcompany.com',
  phone: '+1-555-0199',
  address: '456 Oak Ave, City, State 12345',
  client_type: 'business'
});
```

#### Get Client Details
```javascript
// GET /api/v1/clients/:id
const client = await apiClient.get(`/clients/${clientId}`);

// Response includes related data
{
  "client": {
    "id": "client-uuid",
    "name": "Company Name",
    // ... other client fields
    "jobs_count": 15,
    "devices_count": 8,
    "people_count": 3
  },
  "recent_jobs": [...],
  "devices": [...],
  "people": [...]
}
```

### 3.2 Jobs API

#### List Jobs
```javascript
// GET /api/v1/jobs
const jobsResponse = await apiClient.get('/jobs', {
  params: {
    client_id: 'client-uuid',
    status: 'active',
    priority: 'high',
    page: 1,
    per_page: 10
  }
});

// Response structure
{
  "jobs": [
    {
      "id": "job-uuid",
      "title": "Server Maintenance",
      "description": "Monthly server maintenance and updates",
      "client_id": "client-uuid",
      "status": "active",
      "priority": "high",
      "due_at": "2025-01-15T10:00:00Z",
      "created_at": "2025-01-01T00:00:00Z",
      "tasks_count": 5,
      "client": {
        "id": "client-uuid",
        "name": "Company Name"
      }
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 10,
    "total_pages": 3,
    "total_count": 28
  }
}
```

#### Create Job
```javascript
// POST /api/v1/jobs
const newJob = await apiClient.post('/jobs', {
  title: 'Network Upgrade',
  description: 'Upgrade network infrastructure',
  client_id: 'client-uuid',
  priority: 'high',
  due_at: '2025-02-01T12:00:00Z'
});
```

### 3.3 Tasks API

#### List Tasks for Job
```javascript
// GET /api/v1/jobs/:job_id/tasks
const tasksResponse = await apiClient.get(`/jobs/${jobId}/tasks`);

// Response structure
{
  "tasks": [
    {
      "id": "task-uuid",
      "job_id": "job-uuid",
      "title": "Backup current configuration",
      "description": "Create full backup before changes",
      "status": "pending",
      "position": 1,
      "parent_id": null,
      "created_at": "2025-01-01T00:00:00Z",
      "subtasks": [
        {
          "id": "subtask-uuid",
          "parent_id": "task-uuid",
          "title": "Verify backup integrity",
          "status": "pending",
          "position": 1
        }
      ]
    }
  ]
}
```

#### Create Task
```javascript
// POST /api/v1/jobs/:job_id/tasks
const newTask = await apiClient.post(`/jobs/${jobId}/tasks`, {
  title: 'Install new equipment',
  description: 'Install and configure new network equipment',
  parent_id: null, // or parent task UUID for subtasks
  position: 1
});
```

#### Update Task Status
```javascript
// PUT /api/v1/tasks/:id
const updatedTask = await apiClient.put(`/tasks/${taskId}`, {
  status: 'completed'
});
```

### 3.4 Real-time Data with WebSockets

#### WebSocket Connection
```javascript
const wsUrl = 'wss://api.bos.example.com/cable';
const token = localStorage.getItem('bos_token');

const ws = new WebSocket(`${wsUrl}?token=${token}`);

ws.onopen = () => {
  console.log('WebSocket connected');
  
  // Subscribe to job updates
  ws.send(JSON.stringify({
    command: 'subscribe',
    identifier: JSON.stringify({
      channel: 'JobChannel',
      job_id: 'job-uuid'
    })
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'job_update') {
    console.log('Job updated:', data.job);
    // Update UI accordingly
  }
};
```

---

## 🛠️ Phase 4: Error Handling and Best Practices (30-45 minutes)

### 4.1 Error Response Format
```javascript
// Standard error response
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "name": ["can't be blank"],
      "email": ["is not a valid email address"]
    }
  },
  "status": 422
}
```

### 4.2 Common Error Codes
- **400 Bad Request**: Invalid request format
- **401 Unauthorized**: Authentication required or invalid token
- **403 Forbidden**: Access denied for this resource
- **404 Not Found**: Resource not found
- **422 Unprocessable Entity**: Validation errors
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

### 4.3 Error Handling Implementation
```javascript
class APIError extends Error {
  constructor(response) {
    super(response.data?.error?.message || 'API Error');
    this.status = response.status;
    this.code = response.data?.error?.code;
    this.details = response.data?.error?.details;
  }
}

// Error handling wrapper
async function apiCall(requestFn) {
  try {
    const response = await requestFn();
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new APIError(error.response);
    } else {
      throw new Error('Network error or API unavailable');
    }
  }
}

// Usage
try {
  const client = await apiCall(() => apiClient.get(`/clients/${clientId}`));
  console.log('Client:', client);
} catch (error) {
  if (error instanceof APIError) {
    console.error('API Error:', error.message);
    console.error('Status:', error.status);
    console.error('Details:', error.details);
  } else {
    console.error('Network Error:', error.message);
  }
}
```

### 4.4 Retry Logic with Exponential Backoff
```javascript
async function retryableRequest(requestFn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Don't retry client errors (4xx)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        throw error;
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### 4.5 Rate Limiting Handling
```javascript
// Rate limiting headers
const rateLimitHeaders = {
  'X-RateLimit-Limit': '1000',
  'X-RateLimit-Remaining': '999',
  'X-RateLimit-Reset': '1640995200'
};

// Rate limit check
function checkRateLimit(response) {
  const limit = parseInt(response.headers['x-ratelimit-limit']);
  const remaining = parseInt(response.headers['x-ratelimit-remaining']);
  const reset = parseInt(response.headers['x-ratelimit-reset']);
  
  if (remaining < 10) {
    console.warn('Rate limit approaching:', { limit, remaining, reset });
  }
}
```

---

## 🎯 Phase 5: Advanced Integration Patterns (45-60 minutes)

### 5.1 Batch Operations
```javascript
// Batch create multiple tasks
async function createTasksBatch(jobId, tasks) {
  const results = [];
  
  // Process in batches to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    
    const batchPromises = batch.map(task =>
      apiClient.post(`/jobs/${jobId}/tasks`, task)
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}
```

### 5.2 Pagination Helper
```javascript
class PaginatedFetcher {
  constructor(apiClient, endpoint, params = {}) {
    this.apiClient = apiClient;
    this.endpoint = endpoint;
    this.params = params;
  }
  
  async fetchPage(page = 1) {
    const response = await this.apiClient.get(this.endpoint, {
      params: { ...this.params, page }
    });
    return response.data;
  }
  
  async fetchAll() {
    const allItems = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const response = await this.fetchPage(page);
      allItems.push(...response.items);
      
      hasMore = page < response.meta.total_pages;
      page++;
    }
    
    return allItems;
  }
  
  async *fetchIterator() {
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const response = await this.fetchPage(page);
      yield* response.items;
      
      hasMore = page < response.meta.total_pages;
      page++;
    }
  }
}

// Usage
const fetcher = new PaginatedFetcher(apiClient, '/clients', { search: 'company' });
const allClients = await fetcher.fetchAll();

// Or use iterator for memory efficiency
for await (const client of fetcher.fetchIterator()) {
  console.log(client.name);
}
```

### 5.3 Data Caching Strategy
```javascript
class CachedAPIClient {
  constructor(apiClient, cacheTimeout = 300000) { // 5 minutes
    this.apiClient = apiClient;
    this.cache = new Map();
    this.cacheTimeout = cacheTimeout;
  }
  
  getCacheKey(endpoint, params) {
    return `${endpoint}?${new URLSearchParams(params)}`;
  }
  
  async get(endpoint, params = {}) {
    const key = this.getCacheKey(endpoint, params);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    const response = await this.apiClient.get(endpoint, { params });
    this.cache.set(key, {
      data: response.data,
      timestamp: Date.now()
    });
    
    return response.data;
  }
  
  invalidateCache(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}
```

---

## 🧪 Phase 6: Testing Your Integration (30-45 minutes)

### 6.1 Unit Tests for API Client
```javascript
// Jest/Vitest example
import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { BosAPIClient } from './bos-api-client';

vi.mock('axios');

describe('BosAPIClient', () => {
  let client;
  let mockAxios;
  
  beforeEach(() => {
    mockAxios = axios.create = vi.fn().mockReturnValue({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
      }
    });
    
    client = new BosAPIClient('https://api.example.com', 'test-token');
  });
  
  it('should fetch clients successfully', async () => {
    const mockResponse = {
      data: {
        clients: [{ id: '1', name: 'Test Client' }],
        meta: { total_count: 1 }
      }
    };
    
    mockAxios().get.mockResolvedValue(mockResponse);
    
    const result = await client.getClients();
    
    expect(mockAxios().get).toHaveBeenCalledWith('/clients', { params: {} });
    expect(result).toEqual(mockResponse.data);
  });
});
```

### 6.2 Integration Tests
```javascript
// Integration test with real API
describe('API Integration', () => {
  let apiClient;
  
  beforeAll(async () => {
    apiClient = new BosAPIClient(process.env.TEST_API_URL);
    await apiClient.authenticate(
      process.env.TEST_EMAIL,
      process.env.TEST_PASSWORD
    );
  });
  
  it('should create and retrieve a client', async () => {
    const newClient = await apiClient.createClient({
      name: 'Test Integration Client',
      email: 'test@integration.com'
    });
    
    expect(newClient.id).toBeDefined();
    expect(newClient.name).toBe('Test Integration Client');
    
    const retrievedClient = await apiClient.getClient(newClient.id);
    expect(retrievedClient.id).toBe(newClient.id);
    expect(retrievedClient.name).toBe('Test Integration Client');
  });
});
```

### 6.3 API Response Validation
```javascript
// JSON Schema validation
import Ajv from 'ajv';

const ajv = new Ajv();

const clientSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    created_at: { type: 'string', format: 'date-time' }
  },
  required: ['id', 'name', 'email']
};

const validateClient = ajv.compile(clientSchema);

// Use in tests
it('should return valid client data', async () => {
  const client = await apiClient.getClient('client-uuid');
  const isValid = validateClient(client);
  
  if (!isValid) {
    console.error('Validation errors:', validateClient.errors);
  }
  
  expect(isValid).toBe(true);
});
```

---

## 📚 Phase 7: Documentation and Resources (15-30 minutes)

### 7.1 Complete API Reference
- **[API Specification](../api/api-specification.md)** - Complete endpoint documentation
- **[Authentication Guide](../api/api-authentication.md)** - Detailed auth implementation
- **[Error Codes Reference](../api/error-codes.md)** - All error codes and meanings
- **[Rate Limiting Guide](../api/rate-limiting.md)** - Rate limiting policies

### 7.2 Code Examples Repository
```
examples/
├── javascript/
│   ├── basic-client.js
│   ├── react-integration.js
│   └── node-server.js
├── python/
│   ├── basic-client.py
│   ├── django-integration.py
│   └── flask-app.py
├── curl/
│   └── api-examples.sh
└── postman/
    └── bos-api-collection.json
```

### 7.3 SDK Libraries
- **JavaScript/TypeScript**: `@bos/api-client`
- **Python**: `bos-api-python`
- **Ruby**: `bos-api-ruby`
- **PHP**: `bos-api-php`

### 7.4 Community and Support
- **API Documentation**: [docs.bos.example.com](https://docs.bos.example.com)
- **Developer Forum**: [forum.bos.example.com](https://forum.bos.example.com)
- **GitHub Issues**: [github.com/bos/api-issues](https://github.com/bos/api-issues)
- **Stack Overflow**: Tag your questions with `bos-api`

---

## ✅ Success Criteria

You've successfully completed API consumer onboarding when you can:
- [ ] Authenticate with the API and handle token refresh
- [ ] Perform CRUD operations on all major resources
- [ ] Handle errors gracefully with proper error handling
- [ ] Implement pagination for large result sets
- [ ] Write tests for your API integration
- [ ] Understand rate limiting and implement appropriate backoff

---

## 🔧 Troubleshooting

### Common Issues

#### Authentication Problems
```javascript
// Check token validity
const token = localStorage.getItem('bos_token');
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  const isExpired = payload.exp * 1000 < Date.now();
  console.log('Token expired:', isExpired);
}
```

#### CORS Issues
```javascript
// Ensure proper CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};
```

#### Rate Limiting
```javascript
// Implement exponential backoff
async function handleRateLimit(error) {
  if (error.response?.status === 429) {
    const retryAfter = error.response.headers['retry-after'];
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    // Retry the request
  }
}
```

---

**You're now ready to integrate with the bŏs API! Start building amazing applications.**

*Remember: Always test your integration thoroughly and follow API best practices for optimal performance and reliability.*