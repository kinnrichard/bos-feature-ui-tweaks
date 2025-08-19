---
title: "Frontend Developer Getting Started Guide"
description: "Complete guide for frontend developers working with the bŏs SvelteKit application"
last_updated: "2025-07-17"
status: "active"
category: "getting-started"
tags: ["frontend", "svelte", "typescript", "ui", "components"]
---

# Frontend Developer Getting Started Guide

> **Master the bŏs SvelteKit frontend: from setup to advanced patterns**

## 🎯 Objectives
After completing this guide, you will:
- Have a complete understanding of the bŏs frontend architecture
- Know how to build and style components using our design system
- Understand state management patterns and data flow
- Be able to write comprehensive tests for UI components
- Know how to implement responsive, accessible interfaces

## 📋 Prerequisites
- Solid knowledge of JavaScript/TypeScript
- Understanding of modern web development concepts
- Basic familiarity with component-based frameworks
- Knowledge of CSS and responsive design principles

## 🏗️ Frontend Architecture Overview

### Technology Stack
- **SvelteKit**: Full-stack framework with file-based routing
- **Svelte 4**: Reactive component framework
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Playwright**: End-to-end testing
- **Vite**: Build tool and development server

### Key Architectural Patterns
- **File-based routing**: Pages defined by file structure
- **Component composition**: Reusable UI components
- **Reactive state management**: Svelte stores and reactive statements
- **API integration**: RESTful API consumption
- **Progressive enhancement**: Works without JavaScript

---

## 🚀 Phase 1: Environment Setup (30-45 minutes)

### 1.1 Development Environment
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:5173
```

### 1.2 Essential VS Code Extensions
```json
{
  "recommendations": [
    "svelte.svelte-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-playwright.playwright"
  ]
}
```

### 1.3 Project Structure
```
frontend/
├── src/
│   ├── lib/                    # Reusable components and utilities
│   │   ├── components/         # UI components
│   │   ├── stores/            # Svelte stores
│   │   ├── utils/             # Utility functions
│   │   └── api/               # API client code
│   ├── routes/                # File-based routing
│   │   ├── +layout.svelte     # Root layout
│   │   ├── +page.svelte       # Home page
│   │   └── jobs/              # Job-related pages
│   ├── app.html               # HTML shell
│   └── app.css                # Global styles
├── static/                    # Static assets
├── tests/                     # Playwright tests
├── package.json              # Dependencies and scripts
└── tailwind.config.js        # Tailwind configuration
```

### 1.4 Key NPM Scripts
```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run preview         # Preview production build

# Quality checks
npm run check           # TypeScript type checking
npm run lint            # ESLint code quality
npm run format          # Prettier formatting

# Testing
npm run test            # Run all tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests
```

---

## 🎨 Phase 2: UI Components and Design System (60-90 minutes)

### 2.1 Design System Principles
The bŏs frontend follows **Apple-like design principles**:
- **Precision**: Exact spacing, typography, and layouts
- **Clarity**: Clean interfaces with purposeful hierarchy
- **Deference**: UI supports content, doesn't compete
- **Consistency**: Predictable patterns across the application

### 2.2 Tailwind CSS Configuration
```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        // Apple-inspired color palette
        primary: {
          50: '#f0f9ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8'
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827'
        }
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem'
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem'
      }
    }
  },
  plugins: []
};
```

### 2.3 Component Library Structure
```
src/lib/components/
├── ui/                    # Base UI components
│   ├── Button.svelte
│   ├── Input.svelte
│   ├── Modal.svelte
│   └── Dropdown.svelte
├── forms/                 # Form components
│   ├── FormContainer.svelte
│   ├── FormInput.svelte
│   └── FormErrors.svelte
├── layout/               # Layout components
│   ├── Header.svelte
│   ├── Sidebar.svelte
│   └── PageHeader.svelte
└── business/             # Business-specific components
    ├── JobCard.svelte
    ├── TaskList.svelte
    └── ClientSelector.svelte
```

### 2.4 Base UI Components

#### Button Component
```svelte
<!-- src/lib/components/ui/Button.svelte -->
<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'danger' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled = false;
  export let loading = false;
  export let href: string | undefined = undefined;
  
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };
  
  $: classes = `
    inline-flex items-center justify-center
    font-medium rounded-lg
    transition-colors duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    ${variants[variant]}
    ${sizes[size]}
  `;
</script>

{#if href}
  <a {href} class={classes} class:opacity-50={disabled} on:click>
    {#if loading}
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    {/if}
    <slot />
  </a>
{:else}
  <button class={classes} {disabled} on:click>
    {#if loading}
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    {/if}
    <slot />
  </button>
{/if}
```

#### Input Component
```svelte
<!-- src/lib/components/ui/Input.svelte -->
<script lang="ts">
  export let label: string = '';
  export let placeholder: string = '';
  export let value: string = '';
  export let type: 'text' | 'email' | 'password' | 'number' | 'tel' = 'text';
  export let required: boolean = false;
  export let disabled: boolean = false;
  export let error: string = '';
  export let id: string = '';
  
  let inputElement: HTMLInputElement;
  
  export function focus() {
    inputElement?.focus();
  }
  
  $: inputClasses = `
    block w-full rounded-lg border-gray-300 
    shadow-sm focus:border-blue-500 focus:ring-blue-500
    disabled:bg-gray-50 disabled:text-gray-500
    ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
  `;
</script>

<div class="space-y-1">
  {#if label}
    <label for={id} class="block text-sm font-medium text-gray-700">
      {label}
      {#if required}
        <span class="text-red-500">*</span>
      {/if}
    </label>
  {/if}
  
  <input
    bind:this={inputElement}
    bind:value
    {id}
    {type}
    {placeholder}
    {required}
    {disabled}
    class={inputClasses}
    on:input
    on:blur
    on:focus
    on:keydown
  />
  
  {#if error}
    <p class="text-sm text-red-600">{error}</p>
  {/if}
</div>
```

### 2.5 Layout Components

#### Header Component
```svelte
<!-- src/lib/components/layout/Header.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { currentUser } from '$lib/stores/auth';
  import Button from '$lib/components/ui/Button.svelte';
  
  let showUserMenu = false;
  
  function toggleUserMenu() {
    showUserMenu = !showUserMenu;
  }
  
  function logout() {
    // Logout logic
  }
</script>

<header class="bg-white shadow-sm border-b border-gray-200">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center h-16">
      <!-- Logo -->
      <div class="flex items-center">
        <a href="/" class="flex items-center space-x-2">
          <img src="/icon.svg" alt="bŏs" class="h-8 w-8" />
          <span class="text-xl font-semibold text-gray-900">bŏs</span>
        </a>
      </div>
      
      <!-- Navigation -->
      <nav class="hidden md:flex space-x-8">
        <a
          href="/jobs"
          class="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
          class:text-gray-900={$page.url.pathname.startsWith('/jobs')}
        >
          Jobs
        </a>
        <a
          href="/clients"
          class="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
          class:text-gray-900={$page.url.pathname.startsWith('/clients')}
        >
          Clients
        </a>
        <a
          href="/devices"
          class="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
          class:text-gray-900={$page.url.pathname.startsWith('/devices')}
        >
          Devices
        </a>
      </nav>
      
      <!-- User menu -->
      <div class="relative">
        <button
          on:click={toggleUserMenu}
          class="flex items-center space-x-2 p-2 rounded-full hover:bg-gray-50"
        >
          <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span class="text-white text-sm font-medium">
              {$currentUser?.name?.charAt(0) || 'U'}
            </span>
          </div>
        </button>
        
        {#if showUserMenu}
          <div class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
            <div class="py-1">
              <a href="/profile" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                Profile
              </a>
              <a href="/settings" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                Settings
              </a>
              <button
                on:click={logout}
                class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Sign out
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</header>
```

---

## 🔄 Phase 3: State Management and Data Flow (60-75 minutes)

### 3.1 Svelte Stores Architecture
```
src/lib/stores/
├── auth.ts              # Authentication state
├── jobs.ts              # Job data and operations
├── clients.ts           # Client data and operations
├── ui.ts                # UI state (modals, notifications)
└── websocket.ts         # Real-time data updates
```

### 3.2 Authentication Store
```typescript
// src/lib/stores/auth.ts
import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type { User } from '$lib/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: browser ? localStorage.getItem('bos_token') : null,
  isLoading: false,
  error: null
};

export const authStore = writable<AuthState>(initialState);

// Derived stores
export const currentUser = derived(authStore, $auth => $auth.user);
export const isAuthenticated = derived(authStore, $auth => !!$auth.user);
export const isLoading = derived(authStore, $auth => $auth.isLoading);

// Actions
export const authActions = {
  async login(email: string, password: string) {
    authStore.update(state => ({ ...state, isLoading: true, error: null }));
    
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (!response.ok) {
        throw new Error('Login failed');
      }
      
      const data = await response.json();
      
      // Store token
      if (browser) {
        localStorage.setItem('bos_token', data.token);
      }
      
      authStore.update(state => ({
        ...state,
        user: data.user,
        token: data.token,
        isLoading: false
      }));
      
      return data;
    } catch (error) {
      authStore.update(state => ({
        ...state,
        isLoading: false,
        error: error.message
      }));
      throw error;
    }
  },
  
  async logout() {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${get(authStore).token}`
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    if (browser) {
      localStorage.removeItem('bos_token');
    }
    
    authStore.set(initialState);
  },
  
  async refreshToken() {
    const token = get(authStore).token;
    if (!token) return;
    
    try {
      const response = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (browser) {
          localStorage.setItem('bos_token', data.token);
        }
        
        authStore.update(state => ({
          ...state,
          token: data.token,
          user: data.user
        }));
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      authActions.logout();
    }
  }
};
```

### 3.3 Jobs Store with Optimistic Updates
```typescript
// src/lib/stores/jobs.ts
import { writable, derived } from 'svelte/store';
import { apiClient } from '$lib/api/client';
import type { Job, CreateJobData, UpdateJobData } from '$lib/types';

interface JobsState {
  jobs: Job[];
  selectedJob: Job | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: JobsState = {
  jobs: [],
  selectedJob: null,
  isLoading: false,
  error: null
};

export const jobsStore = writable<JobsState>(initialState);

// Derived stores
export const activeJobs = derived(jobsStore, $jobs => 
  $jobs.jobs.filter(job => job.status === 'active')
);

export const completedJobs = derived(jobsStore, $jobs => 
  $jobs.jobs.filter(job => job.status === 'completed')
);

export const selectedJob = derived(jobsStore, $jobs => $jobs.selectedJob);

// Actions
export const jobsActions = {
  async fetchJobs() {
    jobsStore.update(state => ({ ...state, isLoading: true, error: null }));
    
    try {
      const response = await apiClient.get('/jobs');
      
      jobsStore.update(state => ({
        ...state,
        jobs: response.jobs,
        isLoading: false
      }));
    } catch (error) {
      jobsStore.update(state => ({
        ...state,
        isLoading: false,
        error: error.message
      }));
    }
  },
  
  async createJob(jobData: CreateJobData) {
    // Optimistic update
    const tempJob: Job = {
      id: `temp-${Date.now()}`,
      ...jobData,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tasks_count: 0
    };
    
    jobsStore.update(state => ({
      ...state,
      jobs: [...state.jobs, tempJob]
    }));
    
    try {
      const response = await apiClient.post('/jobs', jobData);
      
      // Replace temporary job with real one
      jobsStore.update(state => ({
        ...state,
        jobs: state.jobs.map(job => 
          job.id === tempJob.id ? response.job : job
        )
      }));
      
      return response.job;
    } catch (error) {
      // Revert optimistic update
      jobsStore.update(state => ({
        ...state,
        jobs: state.jobs.filter(job => job.id !== tempJob.id),
        error: error.message
      }));
      throw error;
    }
  },
  
  async updateJob(jobId: string, updates: UpdateJobData) {
    // Optimistic update
    jobsStore.update(state => ({
      ...state,
      jobs: state.jobs.map(job =>
        job.id === jobId ? { ...job, ...updates } : job
      )
    }));
    
    try {
      const response = await apiClient.put(`/jobs/${jobId}`, updates);
      
      jobsStore.update(state => ({
        ...state,
        jobs: state.jobs.map(job =>
          job.id === jobId ? response.job : job
        )
      }));
      
      return response.job;
    } catch (error) {
      // Revert optimistic update - would need to store previous state
      jobsStore.update(state => ({
        ...state,
        error: error.message
      }));
      throw error;
    }
  },
  
  selectJob(job: Job | null) {
    jobsStore.update(state => ({
      ...state,
      selectedJob: job
    }));
  }
};
```

### 3.4 UI State Management
```typescript
// src/lib/stores/ui.ts
import { writable } from 'svelte/store';

interface UIState {
  sidebarOpen: boolean;
  notifications: Notification[];
  modals: {
    createJob: boolean;
    deleteConfirmation: boolean;
  };
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  timeout?: number;
}

const initialState: UIState = {
  sidebarOpen: false,
  notifications: [],
  modals: {
    createJob: false,
    deleteConfirmation: false
  }
};

export const uiStore = writable<UIState>(initialState);

export const uiActions = {
  toggleSidebar() {
    uiStore.update(state => ({
      ...state,
      sidebarOpen: !state.sidebarOpen
    }));
  },
  
  openModal(modalName: keyof UIState['modals']) {
    uiStore.update(state => ({
      ...state,
      modals: {
        ...state.modals,
        [modalName]: true
      }
    }));
  },
  
  closeModal(modalName: keyof UIState['modals']) {
    uiStore.update(state => ({
      ...state,
      modals: {
        ...state.modals,
        [modalName]: false
      }
    }));
  },
  
  showNotification(notification: Omit<Notification, 'id'>) {
    const id = `notification-${Date.now()}`;
    const fullNotification: Notification = {
      id,
      ...notification
    };
    
    uiStore.update(state => ({
      ...state,
      notifications: [...state.notifications, fullNotification]
    }));
    
    // Auto-remove after timeout
    if (notification.timeout !== 0) {
      setTimeout(() => {
        uiActions.removeNotification(id);
      }, notification.timeout || 5000);
    }
  },
  
  removeNotification(id: string) {
    uiStore.update(state => ({
      ...state,
      notifications: state.notifications.filter(n => n.id !== id)
    }));
  }
};
```

---

## 🌐 Phase 4: API Integration and Data Fetching (45-60 minutes)

### 4.1 API Client Setup
```typescript
// src/lib/api/client.ts
import { authStore } from '$lib/stores/auth';
import { get } from 'svelte/store';

class APIClient {
  private baseURL = '/api/v1';
  
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = get(authStore).token;
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers
      }
    };
    
    const response = await fetch(`${this.baseURL}${endpoint}`, config);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    
    return response.json();
  }
  
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = params 
      ? `${endpoint}?${new URLSearchParams(params)}`
      : endpoint;
    
    return this.request<T>(url);
  }
  
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
  
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE'
    });
  }
}

export const apiClient = new APIClient();
```

### 4.2 Data Loading Patterns

#### Page-level Data Loading
```typescript
// src/routes/jobs/+page.ts
import type { PageLoad } from './$types';
import { apiClient } from '$lib/api/client';

export const load: PageLoad = async ({ url }) => {
  const page = url.searchParams.get('page') || '1';
  const status = url.searchParams.get('status') || 'active';
  
  try {
    const response = await apiClient.get('/jobs', {
      page: parseInt(page),
      per_page: 20,
      status
    });
    
    return {
      jobs: response.jobs,
      meta: response.meta
    };
  } catch (error) {
    return {
      jobs: [],
      meta: { total_count: 0, total_pages: 0 },
      error: error.message
    };
  }
};
```

#### Component-level Data Loading
```svelte
<!-- src/lib/components/JobsList.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { jobsStore, jobsActions } from '$lib/stores/jobs';
  import { uiActions } from '$lib/stores/ui';
  import JobCard from './JobCard.svelte';
  import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
  
  export let clientId: string | null = null;
  
  $: jobs = $jobsStore.jobs;
  $: isLoading = $jobsStore.isLoading;
  $: error = $jobsStore.error;
  
  onMount(async () => {
    try {
      await jobsActions.fetchJobs();
    } catch (error) {
      uiActions.showNotification({
        type: 'error',
        message: 'Failed to load jobs'
      });
    }
  });
  
  // Filter jobs by client if specified
  $: filteredJobs = clientId 
    ? jobs.filter(job => job.client_id === clientId)
    : jobs;
</script>

<div class="space-y-4">
  {#if isLoading}
    <LoadingSpinner />
  {:else if error}
    <div class="bg-red-50 border border-red-200 rounded-md p-4">
      <p class="text-red-600">{error}</p>
    </div>
  {:else if filteredJobs.length === 0}
    <div class="text-center py-8">
      <p class="text-gray-500">No jobs found</p>
    </div>
  {:else}
    {#each filteredJobs as job (job.id)}
      <JobCard {job} />
    {/each}
  {/if}
</div>
```

### 4.3 Real-time Updates with WebSockets
```typescript
// src/lib/api/websocket.ts
import { authStore } from '$lib/stores/auth';
import { jobsStore } from '$lib/stores/jobs';
import { get } from 'svelte/store';

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  connect() {
    const token = get(authStore).token;
    if (!token) return;
    
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/cable`;
    this.ws = new WebSocket(`${wsUrl}?token=${token}`);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      
      // Subscribe to job updates
      this.subscribe('JobChannel');
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.reconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  
  private subscribe(channel: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        command: 'subscribe',
        identifier: JSON.stringify({ channel })
      }));
    }
  }
  
  private handleMessage(data: any) {
    if (data.type === 'job_update') {
      jobsStore.update(state => ({
        ...state,
        jobs: state.jobs.map(job =>
          job.id === data.job.id ? data.job : job
        )
      }));
    }
  }
  
  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect();
      }, 1000 * this.reconnectAttempts);
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const websocketClient = new WebSocketClient();
```

---

## 🧪 Phase 5: Testing Frontend Components (60-75 minutes)

### 5.1 Testing Strategy Overview
- **Unit Tests**: Individual component testing
- **Integration Tests**: Component interaction testing
- **End-to-End Tests**: Full user workflow testing
- **Visual Regression Tests**: UI consistency testing

### 5.2 Playwright Configuration
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI
  }
});
```

### 5.3 Component Testing Examples

#### Basic Component Test
```typescript
// tests/components/Button.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Button Component', () => {
  test('renders with correct text', async ({ page }) => {
    await page.goto('/components/button-test');
    
    const button = page.getByRole('button', { name: 'Click Me' });
    await expect(button).toBeVisible();
  });
  
  test('handles click events', async ({ page }) => {
    await page.goto('/components/button-test');
    
    const button = page.getByRole('button', { name: 'Click Me' });
    await button.click();
    
    await expect(page.getByText('Button clicked!')).toBeVisible();
  });
  
  test('shows loading state', async ({ page }) => {
    await page.goto('/components/button-test');
    
    const loadingButton = page.getByRole('button', { name: 'Loading Button' });
    await expect(loadingButton).toHaveAttribute('disabled');
    await expect(loadingButton.locator('.animate-spin')).toBeVisible();
  });
  
  test('applies correct variant styles', async ({ page }) => {
    await page.goto('/components/button-test');
    
    const primaryButton = page.getByRole('button', { name: 'Primary' });
    const secondaryButton = page.getByRole('button', { name: 'Secondary' });
    
    await expect(primaryButton).toHaveClass(/bg-blue-600/);
    await expect(secondaryButton).toHaveClass(/bg-gray-100/);
  });
});
```

#### Form Testing
```typescript
// tests/components/JobForm.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Job Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/jobs/new');
  });
  
  test('validates required fields', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: 'Create Job' });
    await submitButton.click();
    
    await expect(page.getByText('Title is required')).toBeVisible();
    await expect(page.getByText('Client is required')).toBeVisible();
  });
  
  test('creates job successfully', async ({ page }) => {
    await page.fill('input[name="title"]', 'Test Job');
    await page.selectOption('select[name="client_id"]', 'client-123');
    await page.selectOption('select[name="priority"]', 'high');
    await page.fill('textarea[name="description"]', 'Test description');
    
    await page.getByRole('button', { name: 'Create Job' }).click();
    
    await expect(page.getByText('Job created successfully')).toBeVisible();
    await expect(page).toHaveURL(/\/jobs\/\w+/);
  });
  
  test('handles API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('/api/v1/jobs', route => {
      route.fulfill({
        status: 422,
        body: JSON.stringify({
          error: {
            message: 'Validation failed',
            details: { title: ['is too short'] }
          }
        })
      });
    });
    
    await page.fill('input[name="title"]', 'X');
    await page.selectOption('select[name="client_id"]', 'client-123');
    await page.getByRole('button', { name: 'Create Job' }).click();
    
    await expect(page.getByText('Title is too short')).toBeVisible();
  });
});
```

#### List Component Testing
```typescript
// tests/components/JobsList.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Jobs List', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API response
    await page.route('/api/v1/jobs', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          jobs: [
            {
              id: 'job-1',
              title: 'Server Maintenance',
              client: { name: 'Acme Corp' },
              status: 'active',
              priority: 'high',
              due_at: '2025-01-15T10:00:00Z'
            },
            {
              id: 'job-2',
              title: 'Network Upgrade',
              client: { name: 'Tech Inc' },
              status: 'pending',
              priority: 'medium',
              due_at: '2025-01-20T14:00:00Z'
            }
          ],
          meta: { total_count: 2, total_pages: 1 }
        })
      });
    });
    
    await page.goto('/jobs');
  });
  
  test('displays jobs correctly', async ({ page }) => {
    await expect(page.getByText('Server Maintenance')).toBeVisible();
    await expect(page.getByText('Network Upgrade')).toBeVisible();
    await expect(page.getByText('Acme Corp')).toBeVisible();
    await expect(page.getByText('Tech Inc')).toBeVisible();
  });
  
  test('filters jobs by status', async ({ page }) => {
    await page.selectOption('select[name="status"]', 'active');
    
    await expect(page.getByText('Server Maintenance')).toBeVisible();
    await expect(page.getByText('Network Upgrade')).toBeHidden();
  });
  
  test('navigates to job detail', async ({ page }) => {
    await page.getByText('Server Maintenance').click();
    
    await expect(page).toHaveURL('/jobs/job-1');
  });
});
```

### 5.4 End-to-End Testing
```typescript
// tests/e2e/job-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Job Management Workflow', () => {
  test('complete job management flow', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Navigate to jobs
    await page.click('nav a[href="/jobs"]');
    await expect(page).toHaveURL('/jobs');
    
    // Create new job
    await page.click('button:text("New Job")');
    await page.fill('input[name="title"]', 'E2E Test Job');
    await page.selectOption('select[name="client_id"]', { label: 'Test Client' });
    await page.fill('textarea[name="description"]', 'This is a test job created by E2E tests');
    await page.click('button:text("Create Job")');
    
    // Verify job was created
    await expect(page.getByText('Job created successfully')).toBeVisible();
    await expect(page.getByText('E2E Test Job')).toBeVisible();
    
    // Add a task
    await page.click('button:text("Add Task")');
    await page.fill('input[name="title"]', 'Test Task');
    await page.click('button:text("Add")');
    
    // Verify task was added
    await expect(page.getByText('Test Task')).toBeVisible();
    
    // Complete the task
    await page.click('button[aria-label="Complete task"]');
    await expect(page.getByText('Test Task')).toHaveClass(/line-through/);
    
    // Update job status
    await page.click('button:text("Mark Complete")');
    await expect(page.getByText('Job completed successfully')).toBeVisible();
  });
});
```

---

## 🎯 Phase 6: Advanced Frontend Patterns (45-60 minutes)

### 6.1 Accessibility Implementation
```svelte
<!-- src/lib/components/AccessibleModal.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { trapFocus } from '$lib/utils/focus-trap';
  
  export let title: string;
  export let open: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  let modalElement: HTMLElement;
  let previouslyFocusedElement: HTMLElement | null = null;
  
  $: if (open) {
    previouslyFocusedElement = document.activeElement as HTMLElement;
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      close();
    }
  }
  
  function close() {
    dispatch('close');
    previouslyFocusedElement?.focus();
  }
  
  onMount(() => {
    if (open) {
      trapFocus(modalElement);
    }
  });
  
  $: if (open && modalElement) {
    trapFocus(modalElement);
  }
</script>

{#if open}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    on:click={close}
    on:keydown={handleKeydown}
  >
    <div
      bind:this={modalElement}
      class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      on:click|stopPropagation
    >
      <div class="flex justify-between items-center mb-4">
        <h2 id="modal-title" class="text-lg font-semibold">
          {title}
        </h2>
        <button
          on:click={close}
          class="text-gray-400 hover:text-gray-600"
          aria-label="Close modal"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div class="modal-content">
        <slot />
      </div>
    </div>
  </div>
{/if}
```

### 6.2 Performance Optimization
```typescript
// src/lib/utils/performance.ts
import { onMount } from 'svelte';

// Lazy loading utility
export function lazyLoad(node: HTMLElement, src: string) {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        node.src = src;
        observer.disconnect();
      }
    },
    { threshold: 0.1 }
  );
  
  observer.observe(node);
  
  return {
    destroy() {
      observer.disconnect();
    }
  };
}

// Debounce utility
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

// Virtual scrolling for large lists
export function virtualScroll(container: HTMLElement, items: any[], itemHeight: number) {
  let scrollTop = 0;
  let containerHeight = container.clientHeight;
  
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    items.length
  );
  
  return {
    visibleItems: items.slice(visibleStart, visibleEnd),
    offsetY: visibleStart * itemHeight,
    totalHeight: items.length * itemHeight
  };
}
```

### 6.3 Error Boundaries
```svelte
<!-- src/lib/components/ErrorBoundary.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  
  export let fallback: string = 'Something went wrong';
  
  const dispatch = createEventDispatcher();
  
  let error: Error | null = null;
  let errorInfo: string = '';
  
  onMount(() => {
    const handleError = (event: ErrorEvent) => {
      error = event.error;
      errorInfo = event.error?.stack || '';
      
      dispatch('error', {
        error: event.error,
        errorInfo
      });
    };
    
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      error = new Error(event.reason);
      errorInfo = event.reason?.stack || '';
      
      dispatch('error', {
        error: event.reason,
        errorInfo
      });
    };
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  });
  
  function retry() {
    error = null;
    errorInfo = '';
  }
</script>

{#if error}
  <div class="bg-red-50 border border-red-200 rounded-lg p-6 m-4">
    <div class="flex">
      <svg class="w-5 h-5 text-red-400 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
      </svg>
      <div class="flex-1">
        <h3 class="text-sm font-medium text-red-800">
          {fallback}
        </h3>
        <div class="mt-2 text-sm text-red-700">
          <p>{error.message}</p>
        </div>
        <div class="mt-4">
          <button
            on:click={retry}
            class="bg-red-100 text-red-800 px-3 py-1 rounded text-sm hover:bg-red-200"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  </div>
{:else}
  <slot />
{/if}
```

---

## 📚 Phase 7: Documentation and Resources (15-30 minutes)

### 7.1 Component Documentation
```svelte
<!-- src/lib/components/Button.stories.svelte -->
<script>
  import Button from './Button.svelte';
  
  let clickCount = 0;
  
  function handleClick() {
    clickCount++;
  }
</script>

<div class="space-y-8 p-6">
  <h1 class="text-3xl font-bold">Button Component</h1>
  
  <section>
    <h2 class="text-xl font-semibold mb-4">Basic Usage</h2>
    <div class="space-x-4">
      <Button on:click={handleClick}>Primary Button</Button>
      <Button variant="secondary" on:click={handleClick}>Secondary Button</Button>
      <Button variant="danger" on:click={handleClick}>Danger Button</Button>
    </div>
    <p class="mt-4 text-gray-600">Clicked {clickCount} times</p>
  </section>
  
  <section>
    <h2 class="text-xl font-semibold mb-4">Sizes</h2>
    <div class="space-x-4 flex items-center">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  </section>
  
  <section>
    <h2 class="text-xl font-semibold mb-4">States</h2>
    <div class="space-x-4">
      <Button>Normal</Button>
      <Button disabled>Disabled</Button>
      <Button loading>Loading</Button>
    </div>
  </section>
  
  <section>
    <h2 class="text-xl font-semibold mb-4">As Link</h2>
    <Button href="/jobs">Go to Jobs</Button>
  </section>
</div>
```

### 7.2 Essential Resources
- **[Svelte Documentation](https://svelte.dev/docs)** - Official Svelte documentation
- **[SvelteKit Documentation](https://kit.svelte.dev/docs)** - SvelteKit framework docs
- **[Tailwind CSS Documentation](https://tailwindcss.com/docs)** - Utility-first CSS framework
- **[TypeScript Handbook](https://www.typescriptlang.org/docs/)** - TypeScript documentation
- **[Playwright Testing](https://playwright.dev/)** - End-to-end testing framework

### 7.3 Development Tools
- **Svelte DevTools**: Browser extension for debugging Svelte components
- **Tailwind CSS IntelliSense**: VS Code extension for Tailwind autocompletion
- **TypeScript**: Built-in type checking and IntelliSense
- **ESLint**: Code quality and style checking
- **Prettier**: Code formatting

---

## ✅ Success Criteria

You've successfully completed frontend developer onboarding when you can:
- [ ] Build responsive, accessible UI components following the design system
- [ ] Implement proper state management with Svelte stores
- [ ] Integrate with backend APIs and handle data fetching
- [ ] Write comprehensive tests for components and user interactions
- [ ] Understand and apply performance optimization techniques
- [ ] Follow the team's coding standards and best practices

---

## 🔧 Troubleshooting

### Common Issues

#### Build Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run check

# Fix ESLint issues
npm run lint -- --fix
```

#### Styling Issues
```bash
# Rebuild Tailwind CSS
npm run build:css

# Check Tailwind configuration
npx tailwindcss -i src/app.css -o dist/app.css --watch
```

#### Component State Issues
```typescript
// Debug reactive statements
$: console.log('State changed:', someState);

// Check store subscriptions
import { get } from 'svelte/store';
console.log('Current store value:', get(someStore));
```

---

**You're now ready to build amazing frontend experiences with the bŏs system!**

*Remember: Focus on user experience, accessibility, and performance in everything you build.*