# Epic-008: Simplify ReactiveRecord Architecture - Version 2

## Executive Summary

**Problem**: Current architecture has unnecessary complexity with multiple patterns (TaskInstance, RecordInstance, factories) that confuse Rails developers and create maintenance burden.

**Solution**: Implement clean Rails-like architecture with exactly two classes per model: `ActiveRecord<T>` (non-reactive) and `ReactiveRecord<T>` (reactive), removing all factory patterns and instance abstractions.

**Impact**: Reduce cognitive load, improve developer experience, eliminate code duplication, and create a Rails-familiar development environment.

---

## Table of Contents

1. [Current Architecture Problems](#current-architecture-problems)
2. [Proposed Simple Architecture](#proposed-simple-architecture)
3. [Zero.js Integration Improvements](#zerojs-integration-improvements)
4. [Implementation Specification](#implementation-specification)
5. [File Structure & Organization](#file-structure--organization)
6. [Generator Updates](#generator-updates)
7. [Testing Strategy](#testing-strategy)
8. [Migration Plan](#migration-plan)
9. [Developer Onboarding](#developer-onboarding)
10. [Success Criteria](#success-criteria)

---

## Current Architecture Problems

### Multiple Competing Patterns
```typescript
// Pattern 1: TaskInstance (standalone)
const taskInstance = createTaskInstance(data);
await taskInstance.update({ title: 'New' });

// Pattern 2: Factory-based
const TaskModel = createActiveModel('task', 'tasks');
const tasks = TaskModel.where({ status: 'active' });

// Pattern 3: RecordInstance inheritance (other models)
class JobInstance extends RecordInstance<Job> { }

// Pattern 4: Direct Zero.js usage
const zero = getZero();
const tasks = zero.query.tasks.where('status', 'active');
```

### Problems This Creates:
- **Developer Confusion**: 4 different ways to do the same thing
- **Code Duplication**: TaskInstance reimplements RecordInstance functionality
- **Maintenance Burden**: Changes require updates across multiple patterns
- **Un-Rails-like**: No clear equivalent to `class Task < ApplicationRecord`
- **Cognitive Load**: Rails developers need to learn custom patterns

---

## Proposed Simple Architecture

### Rails-Familiar Class Structure

```typescript
// Non-reactive (tests, utilities, server-side)
class Task extends ActiveRecord<TaskData> {
  static tableName = 'tasks';
  
  // Rails-style class methods
  static async find(id: string): Promise<Task | null>
  static async where(conditions: object): Promise<Task[]>
  static async all(): Promise<Task[]>
  static async create(data: object): Promise<Task>
  
  // Rails discard gem scopes
  static async kept(): Promise<Task[]>
  static async discarded(): Promise<Task[]>
  static async withDiscarded(): Promise<Task[]>
  
  // Rails-style instance methods
  async update(attrs: object): Promise<boolean>
  async save(): Promise<boolean>
  async discard(): Promise<boolean>
  async undiscard(): Promise<boolean>
  async destroy(): Promise<boolean>
}

// Reactive (Svelte components)
class ReactiveTask extends ReactiveRecord<TaskData> {
  static tableName = 'tasks';
  
  // Same API but returns reactive queries
  static find(id: string): ReactiveQuery<Task>
  static where(conditions: object): ReactiveQuery<Task[]>
  static kept(): ReactiveQuery<Task[]>
  
  // Same instance methods, same API
  async update(attrs: object): Promise<boolean>
  async discard(): Promise<boolean>
}
```

### Usage Patterns

#### Non-Reactive Context (Tests, Utilities)
```typescript
import { Task } from '$lib/models/task';

// Rails-familiar usage
const task = await Task.find('uuid');
await task.update({ title: 'Updated title' });

const activeTasks = await Task.where({ status: 'active' });
const keptTasks = await Task.kept();
```

#### Reactive Context (Svelte Components)
```typescript
import { ReactiveTask as Task } from '$lib/models/reactive-task';

// Same API, reactive behavior
const task = Task.find(taskId);
const activeTasks = Task.where({ status: 'active' });

// Reactive properties for UI
$: if (task.data) {
  console.log('Task loaded:', task.data.title);
}

$: activeTasks.data?.forEach(task => {
  // UI updates automatically when data changes
});
```

---

## Zero.js Integration Improvements

### Current Integration Issues
- Verbose query building with manual null checks
- Repetitive error handling in every method
- Complex reactive query management
- Manual connection availability checking
- Type safety issues with `as any` casts

### Proposed Improvements

#### 1. Rails-Style Query Builder
```typescript
// Current (verbose)
const zero = getZero();
if (!zero) return { current: [], value: [], resultType: 'loading' };
let query = zero.query.tasks;
Object.entries(conditions).forEach(([key, value]) => {
  if (value !== undefined && value !== null) {
    query = query.where(key as any, value);
  }
});

// Improved (Rails-like)
class QueryBuilder<T> {
  where(conditions: Partial<T>): this
  orderBy(field: keyof T, direction: 'asc' | 'desc'): this
  limit(count: number): this
  offset(count: number): this
  
  // Execute query
  async exec(): Promise<T[]>
  reactive(): ReactiveQuery<T[]>
}

// Usage
static where(conditions: Partial<TaskData>) {
  return new QueryBuilder<Task>('tasks').where(conditions);
}
```

#### 2. Centralized Error Handling
```typescript
abstract class ActiveRecord<T> {
  protected static async executeQuery<R>(operation: () => Promise<R>): Promise<R> {
    try {
      const zero = await this.ensureZeroConnection();
      return await operation();
    } catch (error) {
      throw new ActiveRecordError(`${this.name} query failed: ${error.message}`);
    }
  }
  
  private static async ensureZeroConnection() {
    const zero = getZero();
    if (!zero) {
      throw new ConnectionError('Zero.js not available');
    }
    return zero;
  }
}
```

#### 3. Improved Reactive Queries
```typescript
class ReactiveQuery<T> {
  private _data: T | null = null;
  private _isLoading = true;
  private _error: Error | null = null;
  private _view: any = null;
  
  // Svelte-friendly reactive properties
  get data(): T | null { return this._data; }
  get isLoading(): boolean { return this._isLoading; }
  get error(): Error | null { return this._error; }
  
  // Lifecycle management
  destroy(): void { this._view?.destroy(); }
  refresh(): Promise<void> { /* re-execute query */ }
}
```

#### 4. Type-Safe Query Building
```typescript
// Before: Type-unsafe
query = query.where(key as any, value);

// After: Type-safe
where<K extends keyof T>(field: K, value: T[K]): this
where<K extends keyof T>(field: K, operator: Operator, value: T[K]): this
```

---

## Implementation Specification

### Base Classes Architecture

#### ActiveRecord<T> Base Class
```typescript
// src/lib/models/base/active-record.ts
export abstract class ActiveRecord<T extends { id: string }> {
  protected static tableName: string;
  protected data: T;
  
  constructor(data: T) {
    this.data = data;
  }
  
  // Class methods (static)
  static async find<T>(this: ModelConstructor<T>, id: string): Promise<InstanceType<ModelConstructor<T>> | null>
  static async findBy<T>(this: ModelConstructor<T>, conditions: Partial<T>): Promise<InstanceType<ModelConstructor<T>> | null>
  static async where<T>(this: ModelConstructor<T>, conditions: Partial<T>): Promise<InstanceType<ModelConstructor<T>>[]>
  static async all<T>(this: ModelConstructor<T>): Promise<InstanceType<ModelConstructor<T>>[]>
  static async create<T>(this: ModelConstructor<T>, data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<InstanceType<ModelConstructor<T>>>
  
  // Discard gem class methods
  static async kept<T>(this: ModelConstructor<T>): Promise<InstanceType<ModelConstructor<T>>[]>
  static async discarded<T>(this: ModelConstructor<T>): Promise<InstanceType<ModelConstructor<T>>[]>
  static async withDiscarded<T>(this: ModelConstructor<T>): Promise<InstanceType<ModelConstructor<T>>[]>
  
  // Instance methods
  async update(attributes: Partial<T>): Promise<boolean>
  async save(): Promise<boolean>
  async destroy(): Promise<boolean>
  
  // Discard gem instance methods
  async discard(): Promise<boolean>
  async undiscard(): Promise<boolean>
  
  // State checks
  get isDiscarded(): boolean { return !!(this.data as any).discarded_at; }
  get isKept(): boolean { return !(this.data as any).discarded_at; }
  
  // Property access
  get id(): string { return this.data.id; }
  
  // Rails-compatible inspection
  inspect(): string { return `#<${this.constructor.name} id: ${this.id}>`; }
}
```

#### ReactiveRecord<T> Base Class
```typescript
// src/lib/models/base/reactive-record.ts
export abstract class ReactiveRecord<T extends { id: string }> {
  protected static tableName: string;
  
  // Reactive class methods (return ReactiveQuery objects)
  static find<T>(this: ModelConstructor<T>, id: string): ReactiveQuery<InstanceType<ModelConstructor<T>> | null>
  static findBy<T>(this: ModelConstructor<T>, conditions: Partial<T>): ReactiveQuery<InstanceType<ModelConstructor<T>> | null>
  static where<T>(this: ModelConstructor<T>, conditions: Partial<T>): ReactiveQuery<InstanceType<ModelConstructor<T>>[]>
  static all<T>(this: ModelConstructor<T>): ReactiveQuery<InstanceType<ModelConstructor<T>>[]>
  
  // Discard gem reactive methods
  static kept<T>(this: ModelConstructor<T>): ReactiveQuery<InstanceType<ModelConstructor<T>>[]>
  static discarded<T>(this: ModelConstructor<T>): ReactiveQuery<InstanceType<ModelConstructor<T>>[]>
  static withDiscarded<T>(this: ModelConstructor<T>): ReactiveQuery<InstanceType<ModelConstructor<T>>[]>
  
  // Same instance methods as ActiveRecord (when accessed from reactive query data)
}
```

### Generated Model Examples

#### Task Model (Non-Reactive)
```typescript
// src/lib/models/task.ts
export interface TaskData {
  id: string;
  title: string;
  status: 'new_task' | 'in_progress' | 'completed' | 'cancelled';
  position: number;
  job_id: string;
  discarded_at?: number;
  created_at: number;
  updated_at: number;
}

export class Task extends ActiveRecord<TaskData> {
  static tableName = 'tasks';
  
  // Domain-specific methods
  get isCompleted(): boolean {
    return this.data.status === 'completed';
  }
  
  async complete(): Promise<boolean> {
    return this.update({ status: 'completed' });
  }
  
  async markInProgress(): Promise<boolean> {
    return this.update({ status: 'in_progress' });
  }
  
  // Rails-style scopes
  static async completed(): Promise<Task[]> {
    return this.where({ status: 'completed' });
  }
  
  static async forJob(jobId: string): Promise<Task[]> {
    return this.where({ job_id: jobId });
  }
  
  // Positioning methods (acts_as_list integration)
  async moveToTop(): Promise<boolean> {
    // Implementation using existing positioning logic
  }
  
  async moveAfter(otherTask: Task): Promise<boolean> {
    // Implementation using existing positioning logic
  }
}
```

#### Reactive Task Model
```typescript
// src/lib/models/reactive-task.ts
export class ReactiveTask extends ReactiveRecord<TaskData> {
  static tableName = 'tasks';
  
  // Same domain methods available on reactive query data
  static completed(): ReactiveQuery<ReactiveTask[]> {
    return this.where({ status: 'completed' });
  }
  
  static forJob(jobId: string): ReactiveQuery<ReactiveTask[]> {
    return this.where({ job_id: jobId });
  }
}
```

---

## File Structure & Organization

### Directory Structure
```
src/lib/models/
├── base/
│   ├── active-record.ts          # ActiveRecord base class
│   ├── reactive-record.ts        # ReactiveRecord base class
│   ├── query-builder.ts          # Rails-style query builder
│   ├── reactive-query.ts         # Reactive query wrapper
│   ├── zero-integration.ts       # Improved Zero.js integration
│   └── types.ts                  # Shared types and interfaces
├── task.ts                       # Task (non-reactive)
├── reactive-task.ts              # ReactiveTask (reactive)
├── job.ts                        # Job (non-reactive)
├── reactive-job.ts               # ReactiveJob (reactive)
├── user.ts                       # User (non-reactive)
├── reactive-user.ts              # ReactiveUser (reactive)
└── index.ts                      # Barrel exports
```

### Import Patterns

#### For Non-Reactive Contexts
```typescript
// Tests, utilities, server-side code
import { Task, Job, User } from '$lib/models';

const task = await Task.find(id);
await task.update({ title: 'Updated' });
```

#### For Reactive Contexts (Svelte Components)
```typescript
// Svelte components
import { ReactiveTask as Task } from '$lib/models/reactive-task';
import { ReactiveJob as Job } from '$lib/models/reactive-job';

const tasks = Task.where({ status: 'active' });
$: console.log('Active tasks:', tasks.data?.length);
```

### Barrel Exports (index.ts)
```typescript
// Non-reactive exports (default)
export { Task } from './task';
export { Job } from './job';
export { User } from './user';

// Reactive exports (explicit)
export { ReactiveTask } from './reactive-task';
export { ReactiveJob } from './reactive-job';
export { ReactiveUser } from './reactive-user';

// Base classes (for extending)
export { ActiveRecord } from './base/active-record';
export { ReactiveRecord } from './base/reactive-record';
```

---

## Generator Updates

### Rails Generator Modifications

#### Update Zero Schema Generator
```ruby
# lib/zero_schema_generator/model_generator.rb
class ModelGenerator
  def generate_model_files
    generate_interface_file
    generate_active_record_file
    generate_reactive_record_file
  end
  
  private
  
  def generate_active_record_file
    template = ERB.new(active_record_template)
    content = template.result(binding)
    write_file("#{output_dir}/#{model_name.underscore}.ts", content)
  end
  
  def generate_reactive_record_file
    template = ERB.new(reactive_record_template)
    content = template.result(binding)
    write_file("#{output_dir}/reactive-#{model_name.underscore}.ts", content)
  end
end
```

#### ActiveRecord Template
```erb
// AUTO-GENERATED - DO NOT EDIT
// Generated: <%= Time.current %>
// Model: <%= model_name %>

import { ActiveRecord } from '../base/active-record';

export interface <%= model_name %>Data {
<% attributes.each do |attr| %>
  <%= attr.name %>: <%= attr.typescript_type %>;
<% end %>
}

export class <%= model_name %> extends ActiveRecord<<%= model_name %>Data> {
  static tableName = '<%= table_name %>';
  
<% scopes.each do |scope| %>
  static async <%= scope.name %>(): Promise<<%= model_name %>[]> {
    return this.where(<%= scope.conditions %>);
  }
<% end %>

<% if has_discard_gem? %>
  // Discard gem integration
  static async kept(): Promise<<%= model_name %>[]> {
    return this.where({ discarded_at: null });
  }
  
  static async discarded(): Promise<<%= model_name %>[]> {
    return this.where({ discarded_at: { '!=': null } });
  }
<% end %>

<% if has_positioning? %>
  // Acts as list integration
  async moveToTop(): Promise<boolean> {
    return this.updatePosition(1);
  }
  
  async moveAfter(other: <%= model_name %>): Promise<boolean> {
    return this.updatePosition(other.data.position + 1);
  }
<% end %>

<% instance_methods.each do |method| %>
  <%= method.signature %> {
    <%= method.body %>
  }
<% end %>
}
```

#### ReactiveRecord Template
```erb
// AUTO-GENERATED - DO NOT EDIT
// Generated: <%= Time.current %>
// Model: <%= model_name %> (Reactive)

import { ReactiveRecord } from '../base/reactive-record';
import type { <%= model_name %>Data } from './<%= model_name.underscore %>';

export class Reactive<%= model_name %> extends ReactiveRecord<<%= model_name %>Data> {
  static tableName = '<%= table_name %>';
  
<% scopes.each do |scope| %>
  static <%= scope.name %>(): ReactiveQuery<Reactive<%= model_name %>[]> {
    return this.where(<%= scope.conditions %>);
  }
<% end %>

<% if has_discard_gem? %>
  // Discard gem reactive scopes
  static kept(): ReactiveQuery<Reactive<%= model_name %>[]> {
    return this.where({ discarded_at: null });
  }
  
  static discarded(): ReactiveQuery<Reactive<%= model_name %>[]> {
    return this.where({ discarded_at: { '!=': null } });
  }
<% end %>
}
```

---

## Testing Strategy

### Test Organization
```
tests/
├── models/
│   ├── base/
│   │   ├── active-record.test.ts     # Base class functionality
│   │   ├── reactive-record.test.ts   # Reactive functionality
│   │   └── query-builder.test.ts     # Query building
│   ├── task.test.ts                  # Task-specific tests
│   ├── reactive-task.test.ts         # Reactive Task tests
│   └── integration/
│       ├── discard-gem.test.ts       # Discard gem functionality
│       ├── positioning.test.ts       # Acts as list functionality
│       └── zero-integration.test.ts  # Zero.js integration
└── test-helpers/
    ├── model-factory.ts              # Test data factories
    ├── zero-mock.ts                  # Zero.js mocking
    └── reactive-testing.ts           # Reactive query testing
```

### Test Patterns

#### ActiveRecord Tests
```typescript
// tests/models/task.test.ts
import { Task } from '$lib/models/task';
import { createTaskData } from '../test-helpers/model-factory';

describe('Task', () => {
  describe('class methods', () => {
    it('finds task by id', async () => {
      const taskData = createTaskData();
      const task = await Task.find(taskData.id);
      expect(task).toBeInstanceOf(Task);
      expect(task.id).toBe(taskData.id);
    });
    
    it('filters tasks by conditions', async () => {
      const activeTasks = await Task.where({ status: 'active' });
      expect(activeTasks).toBeArray();
      activeTasks.forEach(task => {
        expect(task.data.status).toBe('active');
      });
    });
  });
  
  describe('instance methods', () => {
    it('updates task attributes', async () => {
      const task = await Task.find('test-id');
      const result = await task.update({ title: 'Updated Title' });
      expect(result).toBe(true);
      expect(task.data.title).toBe('Updated Title');
    });
  });
  
  describe('discard gem', () => {
    it('discards and undiscards tasks', async () => {
      const task = await Task.find('test-id');
      
      await task.discard();
      expect(task.isDiscarded).toBe(true);
      
      await task.undiscard();
      expect(task.isKept).toBe(true);
    });
  });
});
```

#### ReactiveRecord Tests
```typescript
// tests/models/reactive-task.test.ts
import { ReactiveTask } from '$lib/models/reactive-task';

describe('ReactiveTask', () => {
  it('provides reactive queries', async () => {
    const tasksQuery = ReactiveTask.where({ status: 'active' });
    
    expect(tasksQuery.isLoading).toBe(true);
    
    // Wait for data to load
    await waitFor(() => !tasksQuery.isLoading);
    
    expect(tasksQuery.data).toBeArray();
    expect(tasksQuery.error).toBeNull();
  });
  
  it('updates reactively when data changes', async () => {
    const tasksQuery = ReactiveTask.all();
    await waitFor(() => !tasksQuery.isLoading);
    
    const initialCount = tasksQuery.data.length;
    
    // Create new task
    await createTaskData();
    
    // Should update automatically
    await waitFor(() => tasksQuery.data.length === initialCount + 1);
  });
});
```

### Test Helpers

#### Model Factory
```typescript
// tests/test-helpers/model-factory.ts
export function createTaskData(overrides: Partial<TaskData> = {}): TaskData {
  return {
    id: crypto.randomUUID(),
    title: 'Test Task',
    status: 'new_task',
    position: 1,
    job_id: crypto.randomUUID(),
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides
  };
}

export async function createTask(overrides: Partial<TaskData> = {}): Promise<Task> {
  const data = createTaskData(overrides);
  return Task.create(data);
}
```

#### Zero.js Mocking
```typescript
// tests/test-helpers/zero-mock.ts
export function mockZero() {
  const mockZero = {
    query: {
      tasks: {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        one: jest.fn(),
        materialize: jest.fn()
      }
    },
    mutate: {
      tasks: {
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      }
    }
  };
  
  (getZero as jest.Mock).mockReturnValue(mockZero);
  
  return mockZero;
}
```

---

## Migration Plan

### Big Bang Migration Strategy

#### Phase 1: Foundation (Days 1-2)
1. **Create base classes**
   - `ActiveRecord<T>` base class
   - `ReactiveRecord<T>` base class
   - `QueryBuilder<T>` for Rails-style querying
   - `ReactiveQuery<T>` for reactive state management
   - Improved Zero.js integration layer

2. **Create test infrastructure**
   - Test helpers and factories
   - Zero.js mocking utilities
   - Reactive testing patterns

#### Phase 2: Model Generation (Day 3)
1. **Update Rails generator**
   - Modify templates to generate simple classes
   - Remove factory generation code
   - Add discard gem and positioning integration

2. **Generate new models**
   - Regenerate all models using new pattern
   - `Task` + `ReactiveTask`
   - `Job` + `ReactiveJob`
   - `User` + `ReactiveUser`
   - All other models

#### Phase 3: Usage Migration (Day 4)
1. **Update imports across codebase**
   ```bash
   # Script to update imports
   find src -name "*.ts" -o -name "*.svelte" | xargs sed -i 's/createTaskInstance/Task.find/g'
   find src -name "*.ts" -o -name "*.svelte" | xargs sed -i 's/createActiveModel/import { Task }/g'
   ```

2. **Update usage patterns**
   - Replace factory patterns with direct class usage
   - Update Svelte components to use reactive aliases
   - Update tests to use new patterns

#### Phase 4: Cleanup (Day 5)
1. **Remove old code**
   - Delete `TaskInstance` class
   - Delete `RecordInstance` abstract class
   - Delete factory system files
   - Delete model factory files
   - Clean up unused imports

2. **Update documentation**
   - Create developer onboarding guide
   - Update API documentation
   - Create migration examples

### Migration Scripts

#### Automated Import Replacement
```bash
#!/bin/bash
# migrate-imports.sh

echo "Migrating TaskInstance usage..."
find src -name "*.ts" -o -name "*.svelte" | xargs sed -i \
  -e 's/import.*createTaskInstance.*from.*task\.generated/import { Task } from "$lib\/models\/task"/g' \
  -e 's/createTaskInstance(\([^)]*\))/Task.find(\1.id)/g' \
  -e 's/taskInstance\.update(/task.update(/g'

echo "Migrating factory patterns..."
find src -name "*.ts" -o -name "*.svelte" | xargs sed -i \
  -e 's/createActiveModel.*task.*tasks/import { Task } from "$lib\/models\/task"/g' \
  -e 's/createReactiveModel.*task.*tasks/import { ReactiveTask as Task } from "$lib\/models\/reactive-task"/g'

echo "Migration complete!"
```

#### Validation Script
```bash
#!/bin/bash
# validate-migration.sh

echo "Checking for old patterns..."
if grep -r "TaskInstance\|RecordInstance\|createActiveModel\|createReactiveModel" src/; then
  echo "❌ Old patterns still found - migration incomplete"
  exit 1
else
  echo "✅ No old patterns found - migration successful"
fi

echo "Running tests..."
npm test

echo "Type checking..."
npm run typecheck

echo "Linting..."
npm run lint

echo "✅ All validations passed!"
```

---

## Developer Onboarding

### Rails Developer Quick Start Guide

#### Coming from Rails? You'll Feel Right at Home

```typescript
// Ruby (Rails)
class Task < ApplicationRecord
  scope :kept, -> { where(discarded_at: nil) }
  scope :completed, -> { where(status: 'completed') }
  
  def complete!
    update!(status: 'completed')
  end
end

# Usage
task = Task.find(123)
task.update!(title: 'New title')
task.complete!

completed_tasks = Task.completed
kept_tasks = Task.kept
```

```typescript
// TypeScript (This System)
class Task extends ActiveRecord<TaskData> {
  static async kept(): Promise<Task[]> {
    return this.where({ discarded_at: null });
  }
  
  static async completed(): Promise<Task[]> {
    return this.where({ status: 'completed' });
  }
  
  async complete(): Promise<boolean> {
    return this.update({ status: 'completed' });
  }
}

// Usage
const task = await Task.find('uuid');
await task.update({ title: 'New title' });
await task.complete();

const completedTasks = await Task.completed();
const keptTasks = await Task.kept();
```

#### When to Use Which Class

| Context | Use | Import | Example |
|---------|-----|--------|---------|
| **Tests** | `Task` | `import { Task } from '$lib/models/task'` | `const task = await Task.find(id)` |
| **Utilities** | `Task` | `import { Task } from '$lib/models/task'` | `await Task.where({ status: 'active' })` |
| **Server-side** | `Task` | `import { Task } from '$lib/models/task'` | `const user = await User.find(userId)` |
| **Svelte Components** | `ReactiveTask` | `import { ReactiveTask as Task } from '$lib/models/reactive-task'` | `const tasks = Task.where({ active: true })` |

#### Reactive Queries in Svelte

```svelte
<script>
  import { ReactiveTask as Task } from '$lib/models/reactive-task';
  
  export let jobId: string;
  
  // Reactive query - automatically updates UI
  const tasks = Task.where({ job_id: jobId, status: 'active' });
  const completedTasks = Task.completed();
  
  async function completeTask(task) {
    // This will automatically update the reactive queries above
    await task.update({ status: 'completed' });
  }
</script>

<!-- Reactive template -->
{#if tasks.isLoading}
  <div>Loading tasks...</div>
{:else if tasks.error}
  <div>Error: {tasks.error.message}</div>
{:else}
  <div>
    <h3>Active Tasks ({tasks.data.length})</h3>
    {#each tasks.data as task}
      <div>
        {task.data.title}
        <button onclick={() => completeTask(task)}>
          Complete
        </button>
      </div>
    {/each}
  </div>
{/if}

<div>
  <h3>Completed Tasks ({completedTasks.data?.length || 0})</h3>
  <!-- Completed tasks list -->
</div>
```

#### Common Patterns

##### Creating Records
```typescript
// Create new task
const task = await Task.create({
  title: 'New task',
  status: 'new_task',
  job_id: jobId
});
```

##### Querying Records
```typescript
// Find by ID
const task = await Task.find(id);

// Find first matching
const task = await Task.findBy({ title: 'Specific task' });

// Find all matching
const tasks = await Task.where({ status: 'active', job_id: jobId });

// Get all
const allTasks = await Task.all();
```

##### Updating Records
```typescript
// Update attributes
await task.update({ title: 'Updated title', status: 'in_progress' });

// Save changes (if you've modified properties directly)
task.data.title = 'New title';
await task.save();
```

##### Soft Deletion (Discard Gem)
```typescript
// Discard (soft delete)
await task.discard();

// Check if discarded
if (task.isDiscarded) {
  console.log('Task is discarded');
}

// Restore
await task.undiscard();

// Query scopes
const keptTasks = await Task.kept();
const discardedTasks = await Task.discarded();
const allTasks = await Task.withDiscarded();
```

#### Error Handling

```typescript
try {
  const task = await Task.find(id);
  await task.update({ title: 'New title' });
} catch (error) {
  if (error instanceof RecordNotFoundError) {
    console.log('Task not found');
  } else if (error instanceof ValidationError) {
    console.log('Validation failed:', error.errors);
  } else {
    console.log('Unexpected error:', error.message);
  }
}
```

#### Testing Your Models

```typescript
import { Task } from '$lib/models/task';
import { createTaskData } from '../test-helpers/model-factory';

describe('Task', () => {
  it('creates and finds tasks', async () => {
    const taskData = createTaskData({ title: 'Test task' });
    const task = await Task.create(taskData);
    
    expect(task).toBeInstanceOf(Task);
    expect(task.data.title).toBe('Test task');
    
    const foundTask = await Task.find(task.id);
    expect(foundTask?.data.title).toBe('Test task');
  });
  
  it('handles discard gem functionality', async () => {
    const task = await Task.create(createTaskData());
    
    expect(task.isKept).toBe(true);
    
    await task.discard();
    expect(task.isDiscarded).toBe(true);
    
    await task.undiscard();
    expect(task.isKept).toBe(true);
  });
});
```

---

## Success Criteria

### Measurable Outcomes

#### Developer Experience Metrics
- ✅ **Reduced cognitive load**: 2 classes per model instead of 4+ patterns
- ✅ **Rails familiarity**: 100% of Rails developers can understand the code immediately
- ✅ **Learning curve**: New developers productive in <1 day instead of 3-5 days
- ✅ **Code discoverability**: IDE autocomplete works perfectly for all methods

#### Code Quality Metrics
- ✅ **Lines of code reduction**: 60%+ reduction in model-related code
- ✅ **File count reduction**: 50%+ fewer files per model
- ✅ **Duplication elimination**: 0 code duplication between models
- ✅ **Type safety**: 100% type-safe queries with no `as any` casts

#### Performance Metrics
- ✅ **Memory usage**: 40%+ reduction in objects per model operation
- ✅ **Query performance**: Faster query building with less object allocation
- ✅ **Bundle size**: Smaller JavaScript bundles due to simpler code

#### Maintainability Metrics
- ✅ **Single responsibility**: Each class has one clear purpose
- ✅ **Consistency**: All models follow identical patterns
- ✅ **Testability**: Simple classes are easy to test
- ✅ **Debuggability**: Clear stack traces, no proxy confusion

### Functional Requirements

#### Must Have
- ✅ **Rails-compatible API**: find, where, all, create, update, save, destroy
- ✅ **Discard gem support**: discard, undiscard, kept, discarded, withDiscarded
- ✅ **Reactive queries**: Automatic UI updates in Svelte components
- ✅ **Type safety**: Full TypeScript support with proper generics
- ✅ **Zero.js integration**: Seamless database operations
- ✅ **Error handling**: Rails-style exceptions with clear messages

#### Should Have
- ✅ **Query building**: Rails-style chaining (where, orderBy, limit)
- ✅ **Positioning support**: Acts as list functionality for ordered models
- ✅ **Validation integration**: Rails-style validation error handling
- ✅ **Association support**: Belongs to, has many relationships

#### Could Have
- ✅ **Caching layer**: Intelligent query result caching
- ✅ **Optimistic updates**: UI updates before server confirmation
- ✅ **Offline support**: Queue operations when offline
- ✅ **Migration utilities**: Tools to migrate from old patterns

### Acceptance Criteria

#### For Rails Developers
```typescript
// This should feel completely natural to Rails developers
const user = await User.find(userId);
await user.update({ name: 'New name' });

const activeTasks = await Task.where({ status: 'active' });
const keptTasks = await Task.kept();

await task.discard();
if (task.isDiscarded) {
  await task.undiscard();
}
```

#### For Svelte Components
```svelte
<script>
  // This should be intuitive for frontend developers
  import { ReactiveTask as Task } from '$lib/models/reactive-task';
  
  const tasks = Task.where({ status: 'active' });
</script>

{#each tasks.data as task}
  <!-- UI updates automatically when data changes -->
  <div>{task.data.title}</div>
{/each}
```

#### For Testing
```typescript
// This should be straightforward for testers
describe('Task model', () => {
  it('creates and updates tasks', async () => {
    const task = await Task.create({ title: 'Test' });
    await task.update({ title: 'Updated' });
    expect(task.data.title).toBe('Updated');
  });
});
```

### Risk Mitigation

#### Technical Risks
- **Migration complexity**: Mitigated by automated scripts and big bang approach
- **Performance regressions**: Mitigated by benchmarking and gradual optimization
- **Type safety issues**: Mitigated by comprehensive TypeScript integration

#### Timeline Risks
- **Underestimated effort**: Mitigated by focusing on essential features first
- **Team availability**: Mitigated by clear documentation and pair programming

#### Adoption Risks
- **Developer resistance**: Mitigated by Rails familiarity and clear benefits
- **Learning curve**: Mitigated by comprehensive onboarding documentation

---

## Conclusion

This Epic will transform the codebase from a complex multi-pattern architecture to a clean, Rails-familiar system that any Rails developer can understand immediately.

**Key Benefits:**
- 🎯 **Rails familiarity**: `class Task extends ActiveRecord` just like Rails
- 🧹 **Simplicity**: 2 classes per model instead of multiple patterns
- 🚀 **Performance**: Fewer objects, faster queries, smaller bundles
- 🔧 **Maintainability**: Clear responsibilities, easy to test and debug
- 📚 **Onboarding**: New developers productive in hours, not days

**Timeline**: 5 days for complete implementation and migration

**Risk Level**: Low (greenfield app, automated migration, clear patterns)

This Epic aligns perfectly with Rails philosophy: convention over configuration, developer happiness, and sustainable productivity.

---

*Epic Owner*: [Your Name]  
*Created*: [Date]  
*Status*: Ready for Implementation  
*Timeline*: 5 days  
*Priority*: High (Technical Debt Reduction)