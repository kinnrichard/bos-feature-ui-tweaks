# bŏs (Business Operating System) - Greenfield Architecture Document

## Introduction

This document captures the CURRENT ARCHITECTURE of the bŏs system, a greenfield Rails + SvelteKit application for small business job and task management. It serves as a comprehensive reference for AI agents working on new development and feature enhancements.

### Document Scope

Comprehensive documentation of the entire greenfield system including:
- ReactiveRecord architecture and Zero.js integration
- Current architectural patterns and conventions
- Development standards and practices  
- Testing strategies and tooling
- Deployment and operational considerations

### Change Log

| Date       | Version | Description                      | Author    |
| ---------- | ------- | -------------------------------- | --------- |
| 2025-07-30 | 1.0     | Initial greenfield architecture  | Claude AI |

## Quick Reference - Key Files and Entry Points

### Critical Files for Understanding the System

- **Rails API Entry**: `config/routes.rb` - Authentication and health endpoints only
- **Frontend Entry**: `frontend/src/app.html` - SvelteKit application root
- **ReactiveRecord**: `frontend/src/lib/models/` - TypeScript models that sync with Rails
- **Zero Configuration**: `zero-config.json` - Real-time sync configuration
- **Core Business Models**: `app/models/job.rb`, `app/models/task.rb`, `app/models/client.rb`
- **Authentication**: `app/controllers/api/v1/auth/` - Only API controllers
- **Frontend Components**: `frontend/src/lib/components/` - Svelte components
- **Database Schema**: `db/schema.rb` - Complete database structure
- **Testing Setup**: `frontend/playwright.config.ts`, `test/test_helper.rb`

### Development Commands Reference

```bash
# Start all development servers
bin/dev                              # Starts Rails, Svelte, and Zero servers

# Individual servers (for debugging)
rails server                         # Rails API server (port 3000)
cd frontend && npm run dev           # SvelteKit dev server (port 5173)
./node_modules/.bin/zero-cache --config zero-config.json  # Zero server (port 4848)

# Database
rails db:migrate                     # Run database migrations
rails db:reset                      # Reset and reseed database

# Testing
cd frontend && npm test              # Playwright tests (ports 4000-4003 for test servers)
rails test                          # Rails test suite

# Code Quality
cd frontend && npm run format        # Prettier formatting
cd frontend && npm run lint          # ESLint
rubocop                             # Ruby style checking
```

### Port Configuration

| Service              | Port | Purpose                           |
| -------------------- | ---- | --------------------------------- |
| Rails API            | 3000 | Main application API              |
| SvelteKit Dev        | 5173 | Frontend development server       |
| Zero Cache           | 4848 | Real-time synchronization server  |
| Test Server 1        | 4000 | Playwright test server instance   |
| Test Server 2        | 4001 | Playwright test server instance   |
| Test Server 3        | 4002 | Playwright test server instance   |
| Test Server 4        | 4003 | Playwright test server instance   |

## High Level Architecture

### System Overview

bŏs is a **modern, greenfield application** built with:
- **Backend**: Rails 8.0+ with minimal API endpoints (auth only)
- **Frontend**: SvelteKit with TypeScript and TailwindCSS
- **Data Layer**: ReactiveRecord - TypeScript models that sync via Zero.js
- **Database**: PostgreSQL with UUID primary keys
- **Real-time**: Zero.js for automatic data synchronization
- **Authentication**: JWT tokens with httpOnly cookies
- **Testing**: Playwright (frontend) + Rails test suite (backend)

### Architecture Principles

1. **ReactiveRecord Pattern**: Rails models automatically become TypeScript reactive objects
2. **Zero-API Architecture**: No custom API endpoints except authentication
3. **Real-time by Default**: All data changes sync automatically across clients
4. **Type Safety**: Full TypeScript coverage with Rails-generated types
5. **Test-Driven**: Comprehensive test coverage with Playwright and Rails tests
6. **Greenfield Standards**: Modern conventions and current best practices

### Technical Stack Summary

| Category          | Technology      | Version | Notes                                    |
| ----------------- | --------------- | ------- | ---------------------------------------- |
| Runtime           | Node.js         | 18+     | Frontend build and dev server            |
| Backend Framework | Rails           | 8.0.2   | Models only, minimal API endpoints       |
| Frontend Framework| SvelteKit       | 2.22+   | SSR/SPA hybrid with TypeScript           |
| Data Sync         | Zero.js         | 0.21+   | Real-time data synchronization           |
| Database          | PostgreSQL      | 13+     | Primary + Zero CVR/CDB databases         |
| CSS Framework     | TailwindCSS     | 3.4+    | Utility-first styling                    |
| Testing           | Playwright      | 1.54+   | E2E and integration testing              |
| Authentication    | JWT             | Custom  | httpOnly cookies, minimal API endpoints  |
| Code Quality      | Prettier/Rubocop| Latest  | Automated formatting and linting         |
| Build System      | Vite            | 6.0+    | Frontend bundling and dev server         |

### Repository Structure

```text
bos/
├── app/                              # Rails application code
│   ├── controllers/api/v1/auth/      # ONLY authentication endpoints
│   ├── models/                       # ActiveRecord models (source of truth)
│   └── serializers/                  # For authentication responses only
├── frontend/                         # SvelteKit frontend application
│   ├── src/lib/                      # Shared frontend libraries
│   │   ├── components/               # Svelte components
│   │   ├── models/                   # ReactiveRecord TypeScript models
│   │   │   ├── reactive-job.ts       # Generated from Rails Job model
│   │   │   ├── reactive-task.ts      # Generated from Rails Task model
│   │   │   └── base/reactive-record.ts # ReactiveRecord base class
│   │   ├── stores/                   # Svelte stores for state management
│   │   └── utils/                    # Utility functions and helpers
│   ├── src/routes/                   # SvelteKit page routes
│   ├── tests/                        # Playwright test suites
│   └── static/                       # Static assets
├── db/                               # Database migrations and schema
├── config/                           # Rails configuration
├── zero-config.json                  # Zero.js configuration
├── docs/                             # Project documentation
└── bin/dev                           # Development server startup script
```

## ReactiveRecord Architecture

### Core Concept

**ReactiveRecord** is the heart of the bŏs data architecture. It automatically converts Rails ActiveRecord models into TypeScript reactive objects that sync in real-time via Zero.js.

```text
Rails Model (app/models/job.rb)
    ↓ (automatic generation)
ReactiveRecord TypeScript (frontend/src/lib/models/reactive-job.ts)
    ↓ (Zero.js sync)
Real-time Updates Across All Clients
```

### How ReactiveRecord Works

1. **Rails Models**: Define business logic and validations
2. **Code Generation**: Rails models automatically generate TypeScript interfaces
3. **ReactiveRecord Classes**: TypeScript classes that mirror Rails model APIs
4. **Zero.js Integration**: Automatic real-time synchronization
5. **Rails-like Syntax**: Familiar ActiveRecord patterns in TypeScript

### ReactiveRecord Example

**Rails Model** (`app/models/job.rb`):
```ruby
class Job < ApplicationRecord
  belongs_to :client
  has_many :tasks
  
  enum :status, {
    open: "open",
    in_progress: "in_progress",
    completed: "completed"
  }
  
  validates :title, presence: true
end
```

**Generated ReactiveRecord** (`frontend/src/lib/models/reactive-job.ts`):
```typescript
import { ReactiveRecord } from './base/reactive-record';
import type { JobData } from './types/job-data';

export class ReactiveJob extends ReactiveRecord<JobData> {
  // Rails-like finders
  static async find(id: string): Promise<ReactiveJob | null>
  static async findBy(attributes: Partial<JobData>): Promise<ReactiveJob | null>
  static async where(conditions: Partial<JobData>): Promise<ReactiveJob[]>
  
  // Rails-like associations
  async client(): Promise<ReactiveClient>
  async tasks(): Promise<ReactiveTask[]>
  
  // Rails-like persistence
  async save(): Promise<boolean>
  async update(attributes: Partial<JobData>): Promise<boolean>
  async destroy(): Promise<boolean>
  
  // Status enum methods (auto-generated)
  isOpen(): boolean
  isInProgress(): boolean
  isCompleted(): boolean
  
  // Reactive properties
  get title(): string
  set title(value: string)
  
  get status(): JobStatus
  set status(value: JobStatus)
}
```

**Usage in Svelte Components**:
```svelte
<script lang="ts">
  import { ReactiveJob } from '$lib/models/reactive-job';
  
  // Find jobs with Rails-like syntax
  let jobs = $state<ReactiveJob[]>([]);
  
  async function loadJobs() {
    jobs = await ReactiveJob.where({ status: 'open' });
  }
  
  async function completeJob(job: ReactiveJob) {
    job.status = 'completed';
    await job.save(); // Automatically syncs to all clients
  }
</script>
```

### Zero.js Integration

Zero.js handles all the real-time synchronization automatically:

- **Automatic Sync**: Changes propagate to all connected clients
- **Conflict Resolution**: Server-side conflict resolution
- **Offline Support**: Queue changes when disconnected
- **Type Safety**: Generated TypeScript interfaces ensure type safety

## Data Models and Relationships

### Core Business Entities

The system follows a **client → job → task** hierarchy for small business operations:

```text
Client (small business customers)
├── Jobs (work orders/service tickets)
│   ├── Tasks (individual work items)
│   ├── Job Assignments (technician assignments)
│   └── Scheduled Date Times
├── People (client contacts)
├── Devices (client equipment/assets)
└── Contact Methods (phone, email, etc.)
```

### Key Model Files and Relationships

- **Client** (`app/models/client.rb`): Small business customers
  - `has_many :jobs, :people, :devices, :contact_methods`
  
- **Job** (`app/models/job.rb`): Work orders/service tickets
  - `belongs_to :client`
  - `has_many :tasks, :job_assignments, :notes`
  - Status: open, in_progress, paused, completed, cancelled
  - Priority: critical, very_high, high, normal, low, proactive_followup

- **Task** (`app/models/task.rb`): Individual work items
  - `belongs_to :job`
  - Hierarchical with `parent_id` for subtasks
  - Custom positioning system for drag-and-drop ordering
  - Soft deletion with `discard` gem

- **User** (`app/models/user.rb`): System users (technicians, admins)
  - Role-based access: owner, admin, supervisor, technician
  - JWT authentication with refresh tokens

### ReactiveRecord Model Generation

Each Rails model automatically generates:

1. **TypeScript Interface**: `types/job-data.ts`
2. **ReactiveRecord Class**: `reactive-job.ts`
3. **Zero.js Schema**: Integrated into `zero-config.json`
4. **Association Methods**: Automatic relationship handling

## Authentication Architecture

### Minimal API Approach

Unlike traditional Rails APIs, bŏs only has API endpoints for authentication:

```text
# ONLY API endpoints in the system
POST /api/v1/auth/login              # User login
POST /api/v1/auth/refresh            # Token refresh
POST /api/v1/auth/logout             # User logout
GET  /api/v1/health                  # Health check
```

All data operations happen through ReactiveRecord, not API endpoints.

### Authentication Flow

1. **Login**: User submits credentials to `/api/v1/auth/login`
2. **JWT Token**: Server returns JWT in httpOnly cookie
3. **ReactiveRecord**: All subsequent data access via ReactiveRecord
4. **Zero.js**: Automatic authentication with Zero.js server
5. **Real-time**: Authenticated real-time data synchronization

## Frontend Architecture

### SvelteKit Application Structure

The frontend is a **modern SvelteKit application** with:

- **Framework**: SvelteKit with TypeScript
- **Styling**: TailwindCSS with Prettier formatting
- **State Management**: Svelte runes + ReactiveRecord
- **Routing**: File-based routing with layouts
- **Build Tool**: Vite with hot module replacement

### Component Architecture

```text
frontend/src/lib/components/
├── jobs/                    # Job-related components
│   ├── JobsList.svelte      # Job list view
│   ├── JobDetailView.svelte # Individual job details
│   └── TaskList.svelte      # Task management with ReactiveRecord
├── tasks/                   # Task-specific components
│   ├── TaskRow.svelte       # Individual task display
│   ├── NewTaskRow.svelte    # Task creation via ReactiveRecord
│   └── TaskInfoPopover.svelte
├── layout/                  # Layout and navigation
│   ├── AppLayout.svelte     # Main application layout
│   ├── Sidebar.svelte       # Navigation sidebar
│   └── Toolbar.svelte       # Action toolbar
└── ui/                      # Reusable UI components
    ├── BasePopover.svelte   # Popover base component
    ├── StatusBadge.svelte   # Status indicators
    └── LoadingIndicator.svelte
```

### State Management with ReactiveRecord

```svelte
<script lang="ts">
  import { ReactiveJob, ReactiveTask } from '$lib/models';
  
  // Reactive data that auto-syncs
  let jobs = $state<ReactiveJob[]>([]);
  let selectedJob = $state<ReactiveJob | null>(null);
  
  // Load data with Rails-like syntax
  async function loadJobs() {
    jobs = await ReactiveJob.where({ status: 'open' });
  }
  
  // Create new task with automatic sync
  async function createTask(title: string) {
    if (!selectedJob) return;
    
    const task = new ReactiveTask({
      title,
      job_id: selectedJob.id,
      status: 'pending'
    });
    
    await task.save(); // Automatically syncs across all clients
  }
</script>
```

## Testing Strategy

### Frontend Testing (Playwright)

```text
frontend/tests/
├── e2e/                     # End-to-end user workflows
├── integration/             # ReactiveRecord integration tests
├── components/              # Component-specific tests
└── helpers/                 # Test utilities and fixtures
```

**Test Ports**: Playwright uses ports 4000-4003 for parallel test server instances.

**Test Types**:
- **E2E Tests**: Complete user workflows with ReactiveRecord
- **Integration Tests**: ReactiveRecord functionality with Zero.js
- **Component Tests**: Individual component behavior
- **Performance Tests**: Real-time sync performance testing

### Backend Testing (Rails)

```text
test/
├── models/                  # Model behavior and validation
├── services/                # Business logic testing
├── integration/             # ReactiveRecord generation tests
└── lib/                     # Zero schema generation tests
```

**Test Patterns**:
- **Model Tests**: Data validation and business rules
- **Service Tests**: ReactiveRecord generation logic
- **Integration Tests**: Zero.js schema generation
- **Authentication Tests**: JWT and session handling

### Testing Commands

```bash
# Frontend testing (uses ports 4000-4003)
cd frontend && npm test              # Run all Playwright tests
cd frontend && npm run test:e2e      # E2E tests only
cd frontend && npm run test:headed   # Visual test execution

# Backend testing
rails test                          # Run all Rails tests
rails test:models                   # Model tests only
```

## Development Patterns and Conventions

### Code Organization Principles

1. **ReactiveRecord-First**: All data access through ReactiveRecord, not APIs
2. **Rails Models as Source**: Rails models define schema and business logic
3. **Automated Generation**: TypeScript models auto-generated from Rails
4. **Real-time by Default**: All changes sync automatically
5. **Type Safety**: Full TypeScript coverage with generated types

### Code Quality Standards

**Frontend**:
- **Prettier**: Automatic code formatting for TypeScript/Svelte
- **ESLint**: Code quality and consistency checking
- **TypeScript Strict**: Full type coverage required

**Backend**:
- **Rubocop**: Ruby style guide enforcement
- **Rails Standards**: Follow Rails conventions
- **Model-Centric**: Business logic in models, minimal controllers

### Development Workflow

1. **Model Changes**: Modify Rails models in `app/models/`
2. **Auto-Generation**: ReactiveRecord classes auto-update
3. **Frontend Development**: Use ReactiveRecord in Svelte components
4. **Testing**: Write tests for both Rails models and frontend components
5. **Code Quality**: Run Prettier and Rubocop before commits

## ReactiveRecord Development Patterns

### Creating New Models

**Step 1**: Create Rails model
```ruby
# app/models/service_request.rb
class ServiceRequest < ApplicationRecord
  belongs_to :client
  has_many :service_items
  
  enum :status, { pending: "pending", approved: "approved", completed: "completed" }
  
  validates :title, presence: true
end
```

**Step 2**: ReactiveRecord auto-generates
```typescript
// frontend/src/lib/models/reactive-service-request.ts (auto-generated)
export class ReactiveServiceRequest extends ReactiveRecord<ServiceRequestData> {
  static async find(id: string): Promise<ReactiveServiceRequest | null>
  static async where(conditions: Partial<ServiceRequestData>): Promise<ReactiveServiceRequest[]>
  
  async client(): Promise<ReactiveClient>
  async serviceItems(): Promise<ReactiveServiceItem[]>
  
  isPending(): boolean
  isApproved(): boolean
  isCompleted(): boolean
}
```

**Step 3**: Use in Svelte components
```svelte
<script lang="ts">
  import { ReactiveServiceRequest } from '$lib/models/reactive-service-request';
  
  let requests = $state<ReactiveServiceRequest[]>([]);
  
  async function loadPendingRequests() {
    requests = await ReactiveServiceRequest.where({ status: 'pending' });
  }
</script>
```

### Association Handling

ReactiveRecord automatically handles Rails associations:

```typescript
// Rails-like association access
const job = await ReactiveJob.find(jobId);
const tasks = await job.tasks();           // has_many relationship
const client = await job.client();         // belongs_to relationship

// Automatic real-time updates
job.title = 'Updated Title';
await job.save(); // Syncs to all connected clients immediately
```

## Performance Considerations

### ReactiveRecord Performance

- **Lazy Loading**: Associations loaded on demand
- **Automatic Caching**: Zero.js handles intelligent caching
- **Batch Operations**: Multiple changes batched for efficiency
- **Real-time Optimization**: Only changed fields transmitted

### Frontend Performance

- **Component Reactivity**: Svelte's fine-grained reactivity
- **Code Splitting**: Route-based code splitting
- **Asset Optimization**: Vite handles bundling and minification
- **Real-time Updates**: Efficient WebSocket subscriptions via Zero.js

### Backend Performance

- **Minimal API Surface**: Only authentication endpoints
- **Database Indexing**: Proper indexes on foreign keys
- **Model Optimization**: Efficient Rails model patterns
- **Zero.js Integration**: Optimized real-time data layer

## Deployment Architecture

### Development Environment

**Start with `bin/dev`**:
- Rails server (port 3000)
- SvelteKit dev server (port 5173)  
- Zero cache server (port 4848)
- PostgreSQL database
- Test servers (ports 4000-4003) when testing

### Environment Configuration

- **Environment Variables**: `.env` files for development
- **Rails Credentials**: Encrypted credentials for production
- **Zero Configuration**: `zero-config.json`
- **Database Config**: `config/database.yml` with CVR/CDB databases

## Security Architecture

### Authentication & Authorization

- **JWT Tokens**: Secure token-based authentication (auth endpoints only)
- **httpOnly Cookies**: Prevent XSS token theft
- **Role-Based Access**: User roles control ReactiveRecord permissions
- **No API Surface**: Reduced attack surface (no CRUD APIs)

### Data Protection

- **ReactiveRecord Security**: Built-in authorization patterns
- **Zero.js Security**: Secure real-time data transmission
- **SQL Injection**: Protected via ReactiveRecord abstraction
- **Input Validation**: Rails model validations enforced

## Key Architectural Decisions

### Technology Choices

1. **ReactiveRecord over APIs**: Eliminated custom API development
2. **Zero.js for Real-time**: Automatic synchronization without WebSocket complexity
3. **Rails Models as Source**: Single source of truth for business logic
4. **SvelteKit**: Chosen for performance and developer experience
5. **UUID Primary Keys**: Enables distributed system architecture
6. **Minimal API Surface**: Only authentication, everything else via ReactiveRecord

### Design Patterns

1. **Model-First Architecture**: Rails models drive everything
2. **Auto-Generation**: TypeScript models generated from Rails
3. **Real-time by Default**: All data changes sync automatically
4. **Component Composition**: Reusable UI components
5. **Reactive State**: Svelte runes + ReactiveRecord integration

## Development Resources

### Essential Commands

```bash
# Start everything
bin/dev                              # All development servers

# Development tools
cd frontend && npm run format        # Prettier formatting
cd frontend && npm run lint          # ESLint
rubocop                             # Ruby style checking
cd frontend && npm run check         # TypeScript checking

# Database operations
rails db:migrate                     # Run migrations
rails db:reset                      # Reset and reseed
rails console                       # Rails console for debugging

# Testing
cd frontend && npm test              # Playwright tests (ports 4000-4003)
rails test                          # Rails tests
```

### Key Development Patterns

**Working with ReactiveRecord**:
1. Modify Rails model in `app/models/`
2. ReactiveRecord TypeScript class auto-updates
3. Use Rails-like syntax in Svelte components
4. Changes automatically sync via Zero.js
5. Test both Rails model and frontend integration

**Adding Business Logic**:
1. Add methods to Rails model
2. Auto-generated in ReactiveRecord class
3. Use in frontend with Rails-like syntax
4. Real-time sync handles all updates

This greenfield architecture document provides AI agents with comprehensive understanding of the bŏs ReactiveRecord-based system for effective development work.