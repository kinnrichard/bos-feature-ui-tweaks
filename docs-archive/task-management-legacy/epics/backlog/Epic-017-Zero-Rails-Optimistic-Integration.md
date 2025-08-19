# Epic-017: Zero.js Client with Rails Backend Integration for Optimistic Updates

## Epic Overview

**Epic ID**: Epic-017  
**Title**: Zero.js Client with Rails Backend Integration for Optimistic Updates  
**Status**: Backlog  
**Priority**: High  
**Estimated Effort**: 16-20 hours (4-5 sprints)  
**Sprint**: To be determined  
**Epic Type**: Technical Infrastructure  

### Business Value

Transform the existing Rails application into a modern, real-time collaborative platform by integrating Zero.js client with optimistic updates while preserving all existing Rails business logic, validations, and complex domain patterns. This brownfield integration approach maintains system stability while delivering cutting-edge user experience.

**Key Benefits:**
- **Instant UI responsiveness** - Zero latency for user interactions through optimistic updates
- **Real-time collaboration** - Multiple users can work on jobs/tasks simultaneously
- **Preserved business logic** - Keep Rails callbacks, validations, positioning logic intact
- **Contract safety** - Frontend/backend mutation alignment through automated testing
- **Progressive enhancement** - Gradual migration from existing UI to Zero-powered components
- **Developer productivity** - Type-safe client generated from Rails schema

### Success Metrics

- **<100ms perceived response time** for all CRUD operations
- **100% business logic preservation** - All Rails validations, callbacks, and positioning logic maintained
- **Zero data loss** during optimistic updates and conflict resolution
- **Contract compliance** - 100% passing contract tests between frontend mutations and Rails API
- **Type safety** - Zero TypeScript errors in generated client code
- **Progressive migration** - Ability to migrate individual UI components incrementally

## Current State Analysis

### Existing Rails Architecture Strengths
- **Rich business logic**: Complex task positioning, counter caches, job workflows
- **Robust validations**: Server-side validation with comprehensive error handling
- **Established patterns**: ActiveRecord callbacks, service objects, serializers
- **Complex relationships**: Jobs → Tasks (positioning), Users ↔ Jobs (assignments), Clients ↔ Jobs
- **Audit trails**: Activity logging with comprehensive metadata tracking
- **Authentication/Authorization**: JWT-based auth with user role management

### Current UI Patterns
- **Server-rendered views** with Phlex components
- **Stimulus controllers** for client-side interactions
- **Manual optimistic updates** via custom JavaScript (optimistic_ui_manager.js)
- **AJAX form submissions** with error handling
- **Real-time updates** via ActionCable for basic synchronization

### Pain Points Requiring Zero.js
1. **Manual optimistic updates** - Complex rollback logic and race conditions
2. **Limited real-time sync** - ActionCable overhead for frequent updates
3. **State management complexity** - Manual coordination between UI components
4. **Network dependency** - Poor offline/poor network experience
5. **Collaboration limitations** - Conflicts when multiple users edit same entities
6. **Development overhead** - Repetitive AJAX patterns for each entity type

### Field Permission Analysis
Based on `proposed_field_permissions.csv`, the system has complex server-calculated fields:
- **Server-only fields**: `activity_logs.*`, `updated_at`, `name_normalized`, `formatted_value`
- **Sequence fields**: `instance_number` (auto-incremented)
- **Derived fields**: Positioning logic, counter caches, relationship validations
- **Client-writable fields**: Entity names, descriptions, relationships, status enums

## Target State Vision

### Zero-Rails Hybrid Architecture
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Browser Client                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐ │
│  │   Svelte UI     │    │   Zero Client   │    │   Generated Types       │ │
│  │                 │    │                 │    │                         │ │
│  │ - Optimistic    │◄──►│ - Local Store   │◄──►│ - Rails Schema Types    │ │
│  │ - Real-time     │    │ - Conflict Res. │    │ - Mutation Interfaces   │ │
│  │ - Collaborative │    │ - Offline Cache │    │ - Validation Rules      │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                           HTTPS/WebSocket
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Rails Backend                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐ │
│  │   Zero API      │    │  Rails Models   │    │   Business Logic        │ │
│  │                 │    │                 │    │                         │ │
│  │ - Mutation Endpoints │ - Validations   │    │ - Callbacks             │ │
│  │ - Type Generation    │ - Relationships │    │ - Positioning Logic     │ │
│  │ - Conflict Resolution│ - Scopes        │    │ - Counter Caches        │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐ │
│  │ PostgreSQL      │    │   Zero CVR      │    │   Zero CDB              │ │
│  │ Primary DB      │    │ Conflict-free   │    │ Change Database         │ │
│  │                 │    │ Replicated      │    │                         │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Capabilities Post-Integration
- **Instant UI updates** with automatic rollback on server rejection
- **Real-time collaboration** with conflict-free merged resolution (CRDT)
- **Offline-first operation** with automatic sync when connection restored
- **Type-safe mutations** generated from Rails schema with validation rules
- **Progressive enhancement** - migrate individual components without breaking existing functionality
- **Contract testing** ensuring frontend mutations match Rails API expectations

## Technical Objectives

### Primary Goals
1. **Zero.js Client Integration**: Set up Zero client with Rails backend synchronization
2. **Rails API Optimization**: Create Zero-optimized endpoints while preserving business logic
3. **Type Generation Pipeline**: Automated TypeScript generation from Rails schema
4. **Contract Testing Infrastructure**: Ensure frontend/backend mutation alignment
5. **Progressive Migration Strategy**: Incremental adoption without breaking existing functionality

### Success Criteria
- **Zero regression** in existing Rails functionality
- **All Playwright tests** continue passing throughout migration
- **Real-time sync** working for all major entities (Jobs, Tasks, Clients, Users)
- **Optimistic updates** with proper conflict resolution
- **Type safety** with zero TypeScript errors in generated client code
- **Contract tests** passing for all critical mutation scenarios

## Implementation Strategy

### Phase 1: Foundation Infrastructure (Sprint 1) - 4-5 hours

#### 1.1 Zero.js Backend Configuration
**Rails Zero Integration Setup**
```ruby
# config/zero.yml enhancement
development:
  # Enhanced configuration for Rails integration
  mutation_endpoints:
    jobs: '/api/v1/zero/jobs'
    tasks: '/api/v1/zero/tasks'
    clients: '/api/v1/zero/clients'
    users: '/api/v1/zero/users'
  
  conflict_resolution:
    strategy: 'last_writer_wins'  # For development
    timestamp_field: 'updated_at'
    
  type_generation:
    output_path: 'frontend/src/lib/types/generated'
    mutation_path: 'frontend/src/lib/mutations/generated'
```

**Enhanced API Controllers for Zero**
```ruby
# app/controllers/api/v1/zero/base_controller.rb
class Api::V1::Zero::BaseController < Api::V1::BaseController
  include ZeroOptimizedMutations
  include ConflictResolution
  include TypeSafeValidation
  
  # Zero-specific mutation handling with Rails business logic preservation
  def zero_create
    # Preserve all Rails validations, callbacks, and business logic
    # Add Zero-specific conflict resolution
  end
  
  def zero_update
    # Handle optimistic updates with server-side validation
    # Preserve positioning logic, counter caches, and relationships
  end
end
```

#### 1.2 Frontend Zero Client Setup
**Zero Client Configuration**
```typescript
// frontend/src/lib/zero/zero-client.ts
import { zero } from '@rocicorp/zero';
import type { Schema } from './types/generated/schema';

export const zeroClient = zero<Schema>({
  server: 'http://localhost:4848',
  auth: () => fetch('/api/v1/zero_tokens').then(r => r.text()),
  schema: {
    // Generated from Rails schema
    jobs: {
      tableName: 'jobs',
      columns: { /* Auto-generated from Rails */ },
      relationships: { /* Auto-generated from Rails associations */ }
    },
    tasks: {
      tableName: 'tasks', 
      columns: { /* Auto-generated from Rails */ },
      relationships: { /* Auto-generated from Rails associations */ }
    }
    // ... other entities
  }
});
```

#### 1.3 Type Generation Pipeline
**Rails Schema Introspection Generator**
```ruby
# lib/generators/zero/types/types_generator.rb
class Zero::TypesGenerator < Rails::Generators::Base
  def generate_typescript_types
    # Introspect Rails models for schema generation
    rails_models.each do |model|
      generate_model_types(model)
      generate_mutation_interfaces(model) 
      generate_validation_rules(model)
    end
  end
  
  private
  
  def generate_model_types(model)
    # Generate TypeScript interfaces from ActiveRecord schema
    # Include field permissions from proposed_field_permissions.csv
    # Generate proper enum types from Rails enums
  end
end
```

### Phase 2: Core Entity Zero Integration (Sprint 2) - 5-6 hours

#### 2.1 Jobs Entity Zero Migration
**Zero-Optimized Job Mutations**
```ruby
# app/controllers/api/v1/zero/jobs_controller.rb
class Api::V1::Zero::JobsController < Api::V1::Zero::BaseController
  def create
    # Preserve all existing Rails business logic
    job = Job.new(job_params)
    
    if job.save
      # Zero sync with optimistic update confirmation
      render json: ZeroJobSerializer.new(job), status: :created
    else
      # Return validation errors in Zero-compatible format
      render json: { errors: format_validation_errors(job.errors) }, status: :unprocessable_entity
    end
  end
  
  def update
    # Handle optimistic updates with conflict resolution
    job = Job.find(params[:id])
    
    # Check for optimistic locking conflicts
    if stale_record?(job, params[:updated_at])
      return render json: { error: 'conflict', latest: ZeroJobSerializer.new(job.reload) }, status: :conflict
    end
    
    if job.update(job_params)
      render json: ZeroJobSerializer.new(job)
    else
      render json: { errors: format_validation_errors(job.errors) }, status: :unprocessable_entity
    end
  end
end
```

**Generated Job Types and Mutations**
```typescript
// frontend/src/lib/types/generated/job.ts (auto-generated)
export interface Job {
  readonly id: string;
  title: string;
  description: string | null;
  status: JobStatus;
  priority: JobPriority;
  readonly created_at: string;
  readonly updated_at: string;
  client_id: string;
  // Relationships
  tasks: Task[];
  assigned_users: User[];
  client: Client;
}

// frontend/src/lib/mutations/generated/job.ts (auto-generated)
export const jobMutations = {
  async create(data: CreateJobInput): Promise<Job> {
    return zeroClient.mutate.jobs.create(data);
  },
  
  async update(id: string, data: UpdateJobInput): Promise<Job> {
    return zeroClient.mutate.jobs.update(id, data);
  },
  
  async delete(id: string): Promise<void> {
    return zeroClient.mutate.jobs.delete(id);
  }
};
```

#### 2.2 Tasks Entity with Positioning Logic
**Rails Task Positioning Preservation**
```ruby
# app/models/task.rb (existing logic preserved)
class Task < ApplicationRecord
  acts_as_list scope: [:job_id, :parent_id], add_new_at: :bottom
  
  # Existing callbacks and validations preserved
  before_save :update_reordered_at_if_position_changed
  after_update :resort_sibling_tasks_if_needed
  
  # Zero-specific optimistic update handling
  def self.zero_reorder(task_id, new_position, optimistic_timestamp)
    task = find(task_id)
    
    # Conflict detection based on positioning changes since timestamp
    if positioning_conflict?(task, optimistic_timestamp)
      raise PositioningConflictError.new(task: task, conflicts: detect_conflicts(task, optimistic_timestamp))
    end
    
    # Preserve existing acts_as_list positioning logic
    task.insert_at(new_position)
    task
  end
end
```

### Phase 3: Contract Testing Infrastructure (Sprint 3) - 3-4 hours

#### 3.1 Mutation Contract Testing
**Contract Test Suite**
```typescript
// frontend/tests/contracts/job-mutations.contract.spec.ts
import { test, expect } from '@playwright/test';
import { jobMutations } from '$lib/mutations/generated/job';
import { ApiClient } from '$lib/api/client';

test.describe('Job Mutation Contracts', () => {
  test('create job - Zero client matches Rails API', async () => {
    const jobData = {
      title: 'Test Job',
      description: 'Contract test job',
      status: 'active',
      priority: 'medium',
      client_id: 'test-client-uuid'
    };
    
    // Execute via Zero client
    const zeroResult = await jobMutations.create(jobData);
    
    // Execute via direct Rails API  
    const railsResult = await ApiClient.post('/api/v1/jobs', jobData);
    
    // Verify contract compliance
    expect(zeroResult).toMatchObject({
      id: expect.any(String),
      title: jobData.title,
      description: jobData.description,
      status: jobData.status,
      priority: jobData.priority,
      client_id: jobData.client_id,
      created_at: expect.any(String),
      updated_at: expect.any(String)
    });
    
    // Verify Rails and Zero produce equivalent results
    expect(normalizeResponse(zeroResult)).toEqual(normalizeResponse(railsResult));
  });
  
  test('update job with optimistic conflict resolution', async () => {
    // Create initial job
    const job = await jobMutations.create({ title: 'Original Title', /* ... */ });
    
    // Simulate concurrent updates
    const update1 = jobMutations.update(job.id, { title: 'Update 1' });
    const update2 = jobMutations.update(job.id, { title: 'Update 2' });
    
    // Verify conflict resolution
    const results = await Promise.allSettled([update1, update2]);
    expect(results.some(r => r.status === 'fulfilled')).toBe(true);
    expect(results.some(r => r.status === 'rejected')).toBe(true);
  });
});
```

#### 3.2 Field Permission Validation
**Permission Contract Testing**
```typescript
// frontend/tests/contracts/field-permissions.contract.spec.ts
test.describe('Field Permission Contracts', () => {
  test('server-calculated fields are read-only via Zero', async () => {
    const job = await jobMutations.create({ title: 'Test Job' });
    
    // Attempt to update server-calculated fields
    await expect(async () => {
      await jobMutations.update(job.id, {
        updated_at: '2025-01-01T00:00:00Z', // Should be rejected
        created_at: '2025-01-01T00:00:00Z'  // Should be rejected
      });
    }).rejects.toThrow(/read.only|forbidden/);
  });
  
  test('client-writable fields accept valid updates', async () => {
    const job = await jobMutations.create({ title: 'Original' });
    
    const updated = await jobMutations.update(job.id, {
      title: 'Updated Title',
      description: 'Updated Description',
      status: 'completed'
    });
    
    expect(updated.title).toBe('Updated Title');
    expect(updated.description).toBe('Updated Description'); 
    expect(updated.status).toBe('completed');
  });
});
```

### Phase 4: Progressive UI Migration (Sprint 4) - 4-5 hours

#### 4.1 Zero-Powered Job Components
**Optimistic Job Management**
```svelte
<!-- frontend/src/lib/components/jobs/ZeroJobCard.svelte -->
<script lang="ts">
  import { zeroClient } from '$lib/zero/zero-client';
  import { jobMutations } from '$lib/mutations/generated/job';
  import type { Job } from '$lib/types/generated/job';
  
  export let jobId: string;
  
  // Real-time reactive job data
  $: job = zeroClient.query.jobs.findUnique({ where: { id: jobId } });
  
  async function updateJobTitle(newTitle: string) {
    try {
      // Optimistic update with automatic rollback on failure
      await jobMutations.update(jobId, { title: newTitle });
    } catch (error) {
      if (error.type === 'conflict') {
        // Handle conflict resolution with user choice
        await handleConflictResolution(error);
      } else {
        // Handle validation errors
        await handleValidationError(error);
      }
    }
  }
  
  async function handleConflictResolution(conflict) {
    // Present user with conflict resolution UI
    // Allow merge, overwrite, or cancel
  }
</script>

<div class="job-card" class:updating={$job.status === 'updating'}>
  <h3 contenteditable 
      bind:textContent={$job.title}
      on:blur={(e) => updateJobTitle(e.target.textContent)}>
    {$job.title}
  </h3>
  
  <!-- Real-time task list with Zero-powered updates -->
  <ZeroTaskList jobId={jobId} />
  
  <!-- Real-time assigned users with Zero-powered updates -->
  <ZeroUserAssignments jobId={jobId} />
</div>
```

#### 4.2 Collaborative Task Management
**Real-time Task Positioning**
```svelte
<!-- frontend/src/lib/components/tasks/ZeroTaskList.svelte -->
<script lang="ts">
  import { zeroClient } from '$lib/zero/zero-client';
  import { taskMutations } from '$lib/mutations/generated/task';
  import { flip } from 'svelte/animate';
  import { dndzone } from 'svelte-dnd-action';
  
  export let jobId: string;
  
  // Real-time reactive task list with proper ordering
  $: tasks = zeroClient.query.tasks.findMany({
    where: { job_id: jobId },
    orderBy: { position: 'asc' }
  });
  
  async function reorderTasks(e) {
    const { items, info } = e.detail;
    
    try {
      // Optimistic reordering with Rails positioning preservation
      await taskMutations.reorder(items.map((item, index) => ({
        id: item.id,
        position: index + 1
      })));
    } catch (error) {
      if (error.type === 'positioning_conflict') {
        // Handle positioning conflicts with automatic resolution
        await resolvePositioningConflict(error);
      }
    }
  }
</script>

<div class="task-list"
     use:dndzone={{items: $tasks, flipDurationMs: 200}}
     on:consider={reorderTasks}
     on:finalize={reorderTasks}>
  {#each $tasks as task (task.id)}
    <div animate:flip={{duration: 200}}>
      <ZeroTaskItem {task} />
    </div>
  {/each}
</div>
```

## Risk Assessment & Mitigation

### High-Risk Areas
1. **Data Migration Complexity**: Existing Rails data must work seamlessly with Zero
   - **Mitigation**: Comprehensive contract testing, gradual migration, rollback procedures
   
2. **Business Logic Preservation**: Complex Rails validations, callbacks, and positioning logic
   - **Mitigation**: Zero API preserves existing Rails model layer, extensive integration testing
   
3. **Conflict Resolution Complexity**: Multiple users editing same entities
   - **Mitigation**: Well-defined conflict resolution strategies, user-friendly conflict UI
   
4. **Performance Impact**: Additional Zero infrastructure overhead
   - **Mitigation**: Performance monitoring, gradual rollout, optimization phases

### Medium-Risk Areas
1. **Type Generation Accuracy**: Generated types must match Rails schema exactly
   - **Mitigation**: Automated contract tests, schema validation, continuous integration checks
   
2. **Progressive Migration Coordination**: Old and new systems must coexist
   - **Mitigation**: Feature flags, component-level migration, comprehensive testing

### Low-Risk Areas
1. **Zero.js Integration**: Well-documented integration patterns
2. **Frontend Development**: Existing Svelte expertise
3. **Rails API Extension**: Building on existing API patterns

## Testing Strategy

### Contract Testing
- **Mutation contract tests** ensuring frontend/backend API alignment
- **Field permission tests** validating read-only/read-write enforcement
- **Conflict resolution tests** verifying proper optimistic update handling
- **Type safety tests** ensuring generated types match Rails schema

### Integration Testing  
- **End-to-end workflows** with real-time collaboration scenarios
- **Migration compatibility tests** ensuring old and new systems coexist
- **Performance tests** validating acceptable response times
- **Offline/poor network tests** ensuring graceful degradation

### Business Logic Testing
- **Rails model tests** ensuring existing validations preserved
- **Positioning tests** verifying task reordering works correctly
- **Counter cache tests** ensuring derived fields update properly
- **Activity logging tests** ensuring audit trails maintained

## Success Metrics & KPIs

### User Experience Metrics
- **Response time**: <100ms perceived response time for all mutations
- **Collaboration effectiveness**: Multiple users can edit same job without conflicts
- **Error rate**: <1% optimistic update rollbacks
- **User satisfaction**: Improved perceived performance

### Technical Metrics
- **Contract test coverage**: 100% passing for all critical mutations
- **Type safety**: Zero TypeScript errors in generated code
- **Business logic preservation**: 100% existing Rails test suite passing
- **Migration progress**: Incremental component migration without regression

### Business Metrics
- **Development velocity**: Faster feature development with Zero patterns
- **System reliability**: No increase in production errors
- **User productivity**: Reduced time lost to UI lag and conflicts
- **Technical debt**: Reduced complexity in state management

## Future Enhancements

### Phase 5: Advanced Features (Future Sprints)
- **Advanced conflict resolution**: Merge strategies for complex conflicts
- **Offline mode enhancements**: Extended offline capability
- **Real-time presence indicators**: Show which users are viewing/editing
- **Collaborative cursors**: Real-time user activity visualization
- **Performance optimizations**: Query optimization, caching strategies

### Phase 6: Scale Optimizations (Future Sprints)
- **Horizontal scaling**: Multi-instance Zero deployment
- **Database optimizations**: Query performance for large datasets
- **Network optimizations**: Reduced bandwidth usage
- **Mobile optimizations**: Progressive Web App enhancements

## Implementation Checklist

### Pre-Implementation Requirements
- [ ] Rails application stable with comprehensive test suite
- [ ] Zero.js integration requirements analysis complete
- [ ] Field permissions mapping finalized
- [ ] Contract testing framework selected
- [ ] Development environment prepared

### Phase 1 Deliverables
- [ ] Zero.js backend configuration complete
- [ ] Frontend Zero client setup functional
- [ ] Type generation pipeline operational
- [ ] Basic contract tests passing
- [ ] Development workflow established

### Phase 2 Deliverables  
- [ ] Jobs entity Zero integration complete
- [ ] Tasks entity with positioning logic functional
- [ ] Real-time sync working for core entities
- [ ] Optimistic updates with conflict resolution
- [ ] All existing Rails tests passing

### Phase 3 Deliverables
- [ ] Comprehensive contract test suite
- [ ] Field permission validation complete
- [ ] Conflict resolution scenarios tested
- [ ] Performance benchmarks established
- [ ] Migration compatibility verified

### Phase 4 Deliverables
- [ ] Zero-powered UI components functional
- [ ] Progressive migration strategy proven
- [ ] User acceptance testing complete
- [ ] Production deployment plan finalized
- [ ] Monitoring and alerting configured

---

**Epic Status**: Ready for Sprint Planning  
**Dependencies**: Requires Rails application stability, Zero.js infrastructure setup  
**Success Definition**: Seamless optimistic updates with preserved Rails business logic and real-time collaboration capability