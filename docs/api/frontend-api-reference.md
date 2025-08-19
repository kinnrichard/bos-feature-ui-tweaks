# Epic-008 API Reference
*Complete ActiveRecord/ReactiveRecord Method Documentation*

**Version**: 1.0  
**Generated**: 2025-07-13  
**Epic**: Epic-008 - ActiveRecord Implementation  

---

## 📚 API Overview

Epic-008 provides two complementary APIs:

- **ActiveRecord<T>** - Promise-based CRUD operations for non-reactive contexts
- **ReactiveRecord<T>** - Reactive queries with Svelte 5 integration

Both APIs maintain Rails compatibility while providing TypeScript safety and Zero.js integration.

---

## 📋 Table of Contents

1. [ActiveRecord API](#activerecord-api)
2. [ReactiveRecord API](#reactiverecord-api)
3. [Query Building API](#query-building-api)
4. [Error Classes](#error-classes)
5. [Type Definitions](#type-definitions)
6. [Configuration Options](#configuration-options)
7. [Method Chaining Examples](#method-chaining-examples)

---

## ActiveRecord API

### Class: `ActiveRecord<T>`

Promise-based model class for non-reactive contexts. Perfect for server-side operations, utilities, and tests.

```typescript
class ActiveRecord<T extends BaseRecord> {
  constructor(config: ActiveRecordConfig)
}
```

---

### Finding Records

#### `find(id: string, options?: QueryOptions): Promise<T>`

Find a record by ID. Throws `RecordNotFoundError` if not found.

**Parameters:**
- `id: string` - The UUID of the record
- `options?: QueryOptions` - Query options

**Returns:** `Promise<T>` - The found record

**Throws:** `RecordNotFoundError` if record doesn't exist

**Example:**
```typescript
// Find task by ID
const task = await Task.find('task-uuid-123')
console.log(task.title)

// Find with options
const task = await Task.find('task-uuid-123', { withDiscarded: true })
```

**Rails Equivalent:**
```ruby
task = Task.find(123)
```

---

#### `findBy(conditions: Partial<T>, options?: QueryOptions): Promise<T | null>`

Find a record by conditions. Returns `null` if not found (doesn't throw).

**Parameters:**
- `conditions: Partial<T>` - Object with field/value pairs to match
- `options?: QueryOptions` - Query options

**Returns:** `Promise<T | null>` - The found record or null

**Example:**
```typescript
// Find by single condition
const task = await Task.findBy({ title: 'Important task' })

// Find by multiple conditions
const task = await Task.findBy({ 
  status: 1, 
  priority: 1 
})

if (task) {
  console.log('Found:', task.title)
} else {
  console.log('Not found')
}
```

**Rails Equivalent:**
```ruby
task = Task.find_by(title: 'Important task')
```

---

### Query Building

#### `all(): ScopedQuery<T>`

Get all records. Returns a `ScopedQuery` for method chaining.

**Returns:** `ScopedQuery<T>` - Chainable query object

**Example:**
```typescript
// Get all records
const tasks = await Task.all().all()

// Chain with ordering
const tasks = await Task.all()
  .orderBy('created_at', 'desc')
  .limit(50)
  .all()
```

**Rails Equivalent:**
```ruby
tasks = Task.all
```

---

#### `where(conditions: Partial<T>): ScopedQuery<T>`

Filter records by conditions. Returns a `ScopedQuery` for method chaining.

**Parameters:**
- `conditions: Partial<T>` - Object with field/value pairs to match

**Returns:** `ScopedQuery<T>` - Chainable query object

**Example:**
```typescript
// Single condition
const activeTasks = await Task.where({ status: 1 }).all()

// Multiple conditions
const urgentTasks = await Task.where({ 
  status: 1, 
  priority: 1 
}).all()

// Chaining
const recentUrgentTasks = await Task
  .where({ status: 1, priority: 1 })
  .orderBy('created_at', 'desc')
  .limit(10)
  .all()
```

**Rails Equivalent:**
```ruby
tasks = Task.where(status: 1)
```

---

### Discard Gem Support

#### `kept(): ScopedQuery<T>`

Get only non-discarded records.

**Returns:** `ScopedQuery<T>` - Chainable query object

**Example:**
```typescript
const keptTasks = await Task.kept().all()
```

**Rails Equivalent:**
```ruby
tasks = Task.kept
```

---

#### `discarded(): ScopedQuery<T>`

Get only discarded records.

**Returns:** `ScopedQuery<T>` - Chainable query object

**Example:**
```typescript
const discardedTasks = await Task.discarded().all()
```

**Rails Equivalent:**
```ruby
tasks = Task.discarded
```

---

#### `withDiscarded(): ScopedQuery<T>`

Include discarded records in query.

**Returns:** `ScopedQuery<T>` - Chainable query object

**Example:**
```typescript
const allTasks = await Task.withDiscarded().all()
```

**Rails Equivalent:**
```ruby
tasks = Task.with_discarded
```

---

### CRUD Operations

#### `create(data: CreateData<T>, options?: QueryOptions): Promise<T>`

Create a new record.

**Parameters:**
- `data: CreateData<T>` - Data for creating the record
- `options?: QueryOptions` - Query options

**Returns:** `Promise<T>` - The created record

**Example:**
```typescript
const task = await Task.create({
  title: 'New task',
  description: 'Task description',
  status: 1,
  priority: 2,
  applies_to_all_targets: false,
  lock_version: 1
})

console.log('Created task:', task.id)
```

**Rails Equivalent:**
```ruby
task = Task.create(
  title: 'New task',
  status: 1
)
```

---

#### `update(id: string, data: UpdateData<T>, options?: QueryOptions): Promise<T>`

Update an existing record.

**Parameters:**
- `id: string` - The UUID of the record to update
- `data: UpdateData<T>` - Data for updating the record
- `options?: QueryOptions` - Query options

**Returns:** `Promise<T>` - The updated record

**Throws:** `RecordNotFoundError` if record doesn't exist

**Example:**
```typescript
const updatedTask = await Task.update('task-uuid-123', {
  title: 'Updated title',
  priority: 1
})

console.log('Updated:', updatedTask.title)
```

**Rails Equivalent:**
```ruby
task = Task.find(123)
task.update(title: 'Updated title')
```

---

#### `destroy(id: string, options?: QueryOptions): Promise<CrudResult>`

Hard delete a record (permanently removes from database).

**Parameters:**
- `id: string` - The UUID of the record to delete
- `options?: QueryOptions` - Query options

**Returns:** `Promise<CrudResult>` - Result object with success status

**Example:**
```typescript
const result = await Task.destroy('task-uuid-123')

if (result.success) {
  console.log('Task deleted permanently')
} else {
  console.error('Delete failed:', result.error)
}
```

**Rails Equivalent:**
```ruby
task = Task.find(123)
task.destroy
```

---

#### `discard(id: string, options?: QueryOptions): Promise<T>`

Soft delete a record (sets `discarded_at` timestamp).

**Parameters:**
- `id: string` - The UUID of the record to discard
- `options?: QueryOptions` - Query options

**Returns:** `Promise<T>` - The discarded record

**Example:**
```typescript
const discardedTask = await Task.discard('task-uuid-123')
console.log('Discarded at:', discardedTask.discarded_at)
```

**Rails Equivalent:**
```ruby
task = Task.find(123)
task.discard
```

---

#### `undiscard(id: string, options?: QueryOptions): Promise<T>`

Restore a discarded record (clears `discarded_at` timestamp).

**Parameters:**
- `id: string` - The UUID of the record to restore
- `options?: QueryOptions` - Query options

**Returns:** `Promise<T>` - The restored record

**Example:**
```typescript
const restoredTask = await Task.undiscard('task-uuid-123')
console.log('Restored task:', restoredTask.title)
```

**Rails Equivalent:**
```ruby
task = Task.find(123)
task.undiscard
```

---

#### `upsert(data: CreateData<T> | UpdateData<T>, options?: QueryOptions): Promise<T>`

Create or update a record (upsert operation).

**Parameters:**
- `data: CreateData<T> | UpdateData<T>` - Data with optional ID
- `options?: QueryOptions` - Query options

**Returns:** `Promise<T>` - The created or updated record

**Example:**
```typescript
// Create new record (no ID provided)
const newTask = await Task.upsert({
  title: 'New task',
  status: 1,
  priority: 2,
  applies_to_all_targets: false,
  lock_version: 1
})

// Update existing record (ID provided)
const updatedTask = await Task.upsert({
  id: 'task-uuid-123',
  title: 'Updated task',
  priority: 1
})
```

**Rails Equivalent:**
```ruby
# Rails doesn't have built-in upsert, but similar to:
task = Task.find_or_initialize_by(id: 123)
task.update(attributes)
```

---

## ReactiveRecord API

### ReactiveTask Object

Reactive model object with methods that return reactive queries for Svelte 5 integration.

```typescript
const ReactiveTask = {
  find, all, where, kept, discarded,
  create, update, discard, undiscard
}
```

---

### Reactive Queries

#### `find(id: string): ReactiveQueryOne<T>`

Find a single record with reactive updates.

**Parameters:**
- `id: string` - The UUID of the record

**Returns:** `ReactiveQueryOne<T>` - Reactive query for single record

**Example:**
```svelte
<script>
  import { ReactiveTask } from '$lib/models'
  
  export let taskId: string
  
  const taskQuery = ReactiveTask.find(taskId)
  
  $: task = taskQuery.data
  $: isLoading = taskQuery.isLoading
  $: error = taskQuery.error
</script>

{#if isLoading}
  Loading...
{:else if error}
  Error: {error.message}
{:else if task}
  <h1>{task.title}</h1>
  <p>{task.description}</p>
{/if}
```

---

#### `all(): ReactiveQuery<T>`

Get all records with reactive updates.

**Returns:** `ReactiveQuery<T>` - Reactive query for collection

**Example:**
```svelte
<script>
  import { ReactiveTask } from '$lib/models'
  
  const tasksQuery = ReactiveTask.all()
  
  $: tasks = tasksQuery.data
  $: count = tasks.length
</script>

<h2>All Tasks ({count})</h2>
{#each tasks as task}
  <div>{task.title}</div>
{/each}
```

---

#### `where(conditions: Partial<T>): ReactiveQuery<T>`

Filter records with reactive updates.

**Parameters:**
- `conditions: Partial<T>` - Object with field/value pairs to match

**Returns:** `ReactiveQuery<T>` - Reactive query for collection

**Example:**
```svelte
<script>
  import { ReactiveTask } from '$lib/models'
  
  export let jobId: string
  
  const activeTasksQuery = ReactiveTask.where({ 
    job_id: jobId, 
    status: 1 
  })
  
  $: activeTasks = activeTasksQuery.data
</script>

{#each activeTasks as task}
  <div class="task-card">{task.title}</div>
{/each}
```

---

#### `kept(): ReactiveQuery<T>`

Get only non-discarded records with reactive updates.

**Returns:** `ReactiveQuery<T>` - Reactive query for collection

**Example:**
```svelte
<script>
  import { ReactiveTask } from '$lib/models'
  
  const keptTasksQuery = ReactiveTask.kept()
  
  $: keptTasks = keptTasksQuery.data
</script>
```

---

#### `discarded(): ReactiveQuery<T>`

Get only discarded records with reactive updates.

**Returns:** `ReactiveQuery<T>` - Reactive query for collection

**Example:**
```svelte
<script>
  import { ReactiveTask } from '$lib/models'
  
  const discardedTasksQuery = ReactiveTask.discarded()
  
  $: discardedTasks = discardedTasksQuery.data
</script>
```

---

### Reactive Query Methods

Both `ReactiveQuery<T>` and `ReactiveQueryOne<T>` have the following methods:

#### `refresh(): void`

Force immediate refresh of the query.

**Example:**
```svelte
<script>
  const tasksQuery = ReactiveTask.where({ status: 1 })
  
  function handleRefresh() {
    tasksQuery.refresh()
  }
</script>

<button on:click={handleRefresh}>Refresh</button>
```

---

#### `enable(): void`

Enable automatic updates for the query.

**Example:**
```svelte
<script>
  const tasksQuery = ReactiveTask.where({ status: 1 })
  
  let autoUpdate = true
  
  $: {
    if (autoUpdate) {
      tasksQuery.enable()
    } else {
      tasksQuery.disable()
    }
  }
</script>
```

---

#### `disable(): void`

Disable automatic updates but keep current data.

**Example:**
```svelte
<script>
  const tasksQuery = ReactiveTask.where({ status: 1 })
  
  function pauseUpdates() {
    tasksQuery.disable()
  }
</script>
```

---

#### `destroy(): void`

Clean up the reactive query and release resources.

**Example:**
```svelte
<script>
  import { onDestroy } from 'svelte'
  
  const tasksQuery = ReactiveTask.where({ status: 1 })
  
  onDestroy(() => {
    tasksQuery.destroy()
  })
</script>
```

---

### Reactive State Properties

#### `data: T | T[]`

The current data from the query.

**Type:** 
- `T` for `ReactiveQueryOne<T>` (single record)
- `T[]` for `ReactiveQuery<T>` (collection)

**Example:**
```svelte
<script>
  const taskQuery = ReactiveTask.find(taskId)
  const tasksQuery = ReactiveTask.where({ status: 1 })
  
  $: task = taskQuery.data        // Single TaskData or null
  $: tasks = tasksQuery.data      // Array of TaskData
</script>
```

---

#### `isLoading: boolean`

Indicates if the query is currently loading.

**Example:**
```svelte
<script>
  const tasksQuery = ReactiveTask.where({ status: 1 })
  
  $: isLoading = tasksQuery.isLoading
</script>

{#if isLoading}
  <div class="spinner">Loading...</div>
{/if}
```

---

#### `error: Error | null`

Current error state of the query.

**Example:**
```svelte
<script>
  const tasksQuery = ReactiveTask.where({ status: 1 })
  
  $: error = tasksQuery.error
</script>

{#if error}
  <div class="error-message">
    Error: {error.message}
  </div>
{/if}
```

---

## Query Building API

### Class: `ScopedQuery<T>`

Chainable query builder returned by `where()`, `all()`, etc.

---

### Filtering Methods

#### `where(conditions: Partial<T>): ScopedQuery<T>`

Add WHERE conditions to the query.

**Parameters:**
- `conditions: Partial<T>` - Object with field/value pairs

**Returns:** `ScopedQuery<T>` - Chainable query object

**Example:**
```typescript
const query = Task
  .where({ status: 1 })
  .where({ priority: 1 })
  .where({ job_id: 'job-123' })
```

---

#### `whereNull(field: keyof T): ScopedQuery<T>`

Filter records where field is NULL.

**Parameters:**
- `field: keyof T` - Field name to check for NULL

**Returns:** `ScopedQuery<T>` - Chainable query object

**Example:**
```typescript
const tasksWithoutDueDate = await Task
  .where({ status: 1 })
  .whereNull('due_date')
  .all()
```

---

#### `whereNotNull(field: keyof T): ScopedQuery<T>`

Filter records where field is NOT NULL.

**Parameters:**
- `field: keyof T` - Field name to check for NOT NULL

**Returns:** `ScopedQuery<T>` - Chainable query object

**Example:**
```typescript
const assignedTasks = await Task
  .where({ status: 1 })
  .whereNotNull('assigned_to_id')
  .all()
```

---

### Ordering Methods

#### `orderBy(field: keyof T, direction?: 'asc' | 'desc'): ScopedQuery<T>`

Add ORDER BY clause to the query.

**Parameters:**
- `field: keyof T` - Field name to order by
- `direction?: 'asc' | 'desc'` - Sort direction (default: 'asc')

**Returns:** `ScopedQuery<T>` - Chainable query object

**Example:**
```typescript
const orderedTasks = await Task
  .where({ status: 1 })
  .orderBy('priority', 'desc')
  .orderBy('created_at', 'asc')
  .all()
```

---

### Limiting Methods

#### `limit(count: number): ScopedQuery<T>`

Limit the number of results.

**Parameters:**
- `count: number` - Maximum number of records to return

**Returns:** `ScopedQuery<T>` - Chainable query object

**Example:**
```typescript
const recentTasks = await Task
  .orderBy('created_at', 'desc')
  .limit(10)
  .all()
```

---

#### `offset(count: number): ScopedQuery<T>`

Skip a number of records.

**Parameters:**
- `count: number` - Number of records to skip

**Returns:** `ScopedQuery<T>` - Chainable query object

**Example:**
```typescript
// Pagination: page 2, 20 items per page
const page2Tasks = await Task
  .orderBy('created_at', 'desc')
  .limit(20)
  .offset(20)
  .all()
```

---

### Discard Methods

#### `kept(): ScopedQuery<T>`

Filter to only non-discarded records.

**Returns:** `ScopedQuery<T>` - Chainable query object

**Example:**
```typescript
const activeTasks = await Task
  .where({ status: 1 })
  .kept()
  .all()
```

---

#### `discarded(): ScopedQuery<T>`

Filter to only discarded records.

**Returns:** `ScopedQuery<T>` - Chainable query object

**Example:**
```typescript
const deletedTasks = await Task
  .discarded()
  .orderBy('discarded_at', 'desc')
  .all()
```

---

#### `withDiscarded(): ScopedQuery<T>`

Include discarded records in results.

**Returns:** `ScopedQuery<T>` - Chainable query object

**Example:**
```typescript
const allTasks = await Task
  .where({ job_id: 'job-123' })
  .withDiscarded()
  .all()
```

---

### Execution Methods

#### `all(options?: QueryOptions): Promise<T[]>`

Execute query and return all matching records.

**Parameters:**
- `options?: QueryOptions` - Query execution options

**Returns:** `Promise<T[]>` - Array of matching records

**Example:**
```typescript
const tasks = await Task
  .where({ status: 1 })
  .orderBy('created_at', 'desc')
  .all()

console.log(`Found ${tasks.length} tasks`)
```

---

#### `first(options?: QueryOptions): Promise<T | null>`

Execute query and return first matching record.

**Parameters:**
- `options?: QueryOptions` - Query execution options

**Returns:** `Promise<T | null>` - First matching record or null

**Example:**
```typescript
const newestTask = await Task
  .where({ status: 1 })
  .orderBy('created_at', 'desc')
  .first()

if (newestTask) {
  console.log('Newest task:', newestTask.title)
}
```

---

#### `last(options?: QueryOptions): Promise<T | null>`

Execute query and return last matching record.

**Parameters:**
- `options?: QueryOptions` - Query execution options

**Returns:** `Promise<T | null>` - Last matching record or null

**Example:**
```typescript
const oldestTask = await Task
  .where({ status: 1 })
  .orderBy('created_at', 'desc')
  .last()
```

---

#### `count(options?: QueryOptions): Promise<number>`

Execute query and return count of matching records.

**Parameters:**
- `options?: QueryOptions` - Query execution options

**Returns:** `Promise<number>` - Count of matching records

**Example:**
```typescript
const activeTaskCount = await Task
  .where({ status: 1 })
  .kept()
  .count()

console.log(`${activeTaskCount} active tasks`)
```

---

#### `exists(options?: QueryOptions): Promise<boolean>`

Check if any records match the query.

**Parameters:**
- `options?: QueryOptions` - Query execution options

**Returns:** `Promise<boolean>` - True if records exist

**Example:**
```typescript
const hasOverdueTasks = await Task
  .where({ status: 1 })
  .where('due_date', '<', Date.now())
  .exists()

if (hasOverdueTasks) {
  console.log('There are overdue tasks!')
}
```

---

## Error Classes

### `RecordNotFoundError`

Thrown when `find()` cannot locate a record.

**Properties:**
- `message: string` - Error message
- `modelName: string` - Name of the model class
- `searchCriteria: any` - The search criteria used

**Example:**
```typescript
try {
  const task = await Task.find('invalid-id')
} catch (error) {
  if (error instanceof RecordNotFoundError) {
    console.log('Task not found:', error.searchCriteria)
  }
}
```

**Static Methods:**
```typescript
RecordNotFoundError.forId(id: string, modelName: string): RecordNotFoundError
```

---

### `RecordInvalidError`

Thrown when validation fails during create/update operations.

**Properties:**
- `message: string` - Error message
- `record: any` - The invalid record data
- `validationErrors: Record<string, string[]>` - Field-specific validation errors

**Example:**
```typescript
try {
  await Task.create({
    title: '', // Invalid: required field
    status: 1
  })
} catch (error) {
  if (error instanceof RecordInvalidError) {
    console.log('Validation errors:', error.validationErrors)
    // { title: ['Title is required'] }
  }
}
```

---

## Type Definitions

### `BaseRecord`

Base interface for all record types.

```typescript
interface BaseRecord {
  id: string
  created_at?: number
  updated_at?: number
  discarded_at?: number | null
}
```

---

### `TaskData`

Complete task record interface.

```typescript
interface TaskData extends BaseRecord {
  id: string
  title: string
  description?: string
  status: number
  priority: number
  job_id?: string
  assigned_to_id?: string | null
  due_date?: number | null
  position?: number
  applies_to_all_targets: boolean
  lock_version: number
  created_at: number
  updated_at: number
  discarded_at?: number | null
}
```

---

### `CreateTaskData`

Interface for creating new tasks.

```typescript
interface CreateTaskData {
  title: string
  description?: string
  status: number
  priority: number
  job_id?: string
  assigned_to_id?: string | null
  due_date?: number | null
  position?: number
  applies_to_all_targets: boolean
  lock_version: number
  // Note: id, created_at, updated_at added automatically
}
```

---

### `UpdateTaskData`

Interface for updating existing tasks.

```typescript
interface UpdateTaskData {
  title?: string
  description?: string
  status?: number
  priority?: number
  job_id?: string
  assigned_to_id?: string | null
  due_date?: number | null
  position?: number
  applies_to_all_targets?: boolean
  lock_version?: number
  // Note: updated_at set automatically
}
```

---

### `QueryOptions`

Options for query execution.

```typescript
interface QueryOptions {
  withDiscarded?: boolean    // Include discarded records
  timeout?: number          // Query timeout in milliseconds
}
```

---

### `CrudResult`

Result object for destructive operations.

```typescript
interface CrudResult {
  id: string
  success: boolean
  error?: string
}
```

---

### `ActiveRecordConfig`

Configuration for ActiveRecord instances.

```typescript
interface ActiveRecordConfig {
  tableName: string         // Table name in Zero.js schema
  className: string         // Model class name for errors
  primaryKey?: string       // Primary key field (default: 'id')
}
```

---

## Configuration Options

### TTL (Time To Live) for Reactive Queries

Default TTL for reactive queries is 5 minutes. This can be configured:

```typescript
// In reactive-query.svelte.ts
const DEFAULT_TTL = '5m' // 5 minutes

// Custom TTL per query
const shortLivedQuery = ReactiveTask.where({ status: 1 }) // Uses default 5m
// TTL configuration is handled internally
```

---

### Connection Retry Settings

Zero.js connection retries are handled automatically:

```typescript
// Built-in retry logic in ActiveRecord base class
const RETRY_ATTEMPTS = 3
const RETRY_DELAY = 1000 // 1 second
```

---

### Validation Settings

Validation is built into the type system and ActiveRecord operations:

```typescript
// Required fields validation
const REQUIRED_FIELDS = ['lock_version', 'applies_to_all_targets']

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
```

---

## Method Chaining Examples

### Complex Filtering

```typescript
// Find high-priority active tasks assigned to specific user
const urgentUserTasks = await Task
  .where({ status: 1 })           // Active tasks
  .where({ priority: 1 })         // High priority
  .where({ assigned_to_id: userId }) // Assigned to user
  .whereNotNull('due_date')       // Has due date
  .kept()                         // Not discarded
  .orderBy('due_date', 'asc')     // Order by due date
  .orderBy('created_at', 'desc')  // Then by creation time
  .limit(20)                      // Max 20 results
  .all()
```

---

### Pagination

```typescript
// Page-based pagination
async function getTasksPage(page: number, pageSize: number = 20) {
  const offset = (page - 1) * pageSize
  
  const tasks = await Task
    .where({ status: 1 })
    .kept()
    .orderBy('created_at', 'desc')
    .limit(pageSize)
    .offset(offset)
    .all()
  
  const totalCount = await Task
    .where({ status: 1 })
    .kept()
    .count()
  
  return {
    tasks,
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / pageSize),
    hasNextPage: page * pageSize < totalCount,
    hasPreviousPage: page > 1
  }
}
```

---

### Reactive Dashboard Queries

```svelte
<script>
  import { ReactiveTask } from '$lib/models'
  
  export let jobId: string
  
  // Multiple reactive queries for dashboard
  const activeQuery = ReactiveTask
    .where({ job_id: jobId, status: 1 })
    .kept()
  
  const completedTodayQuery = ReactiveTask
    .where({ job_id: jobId, status: 2 })
    .where('updated_at', '>', startOfToday())
    .kept()
  
  const overdueQuery = ReactiveTask
    .where({ job_id: jobId, status: 1 })
    .where('due_date', '<', Date.now())
    .whereNotNull('due_date')
    .kept()
  
  const highPriorityQuery = ReactiveTask
    .where({ job_id: jobId, priority: 1 })
    .kept()
  
  // Reactive state
  $: activeTasks = activeQuery.data
  $: completedToday = completedTodayQuery.data
  $: overdueTasks = overdueQuery.data
  $: highPriorityTasks = highPriorityQuery.data
  
  $: isLoading = activeQuery.isLoading || 
                 completedTodayQuery.isLoading || 
                 overdueQuery.isLoading || 
                 highPriorityQuery.isLoading
</script>

{#if isLoading}
  <div class="loading">Loading dashboard...</div>
{:else}
  <div class="dashboard-stats">
    <div class="stat">Active: {activeTasks.length}</div>
    <div class="stat">Completed Today: {completedToday.length}</div>
    <div class="stat urgent">Overdue: {overdueTasks.length}</div>
    <div class="stat">High Priority: {highPriorityTasks.length}</div>
  </div>
{/if}
```

---

### Conditional Queries

```typescript
// Build queries conditionally
function buildTaskQuery(filters: {
  status?: number
  priority?: number
  assignedTo?: string
  hasDeadline?: boolean
  isOverdue?: boolean
}) {
  let query = Task.kept()
  
  if (filters.status !== undefined) {
    query = query.where({ status: filters.status })
  }
  
  if (filters.priority !== undefined) {
    query = query.where({ priority: filters.priority })
  }
  
  if (filters.assignedTo) {
    query = query.where({ assigned_to_id: filters.assignedTo })
  }
  
  if (filters.hasDeadline) {
    query = query.whereNotNull('due_date')
  }
  
  if (filters.isOverdue) {
    query = query
      .whereNotNull('due_date')
      .where('due_date', '<', Date.now())
  }
  
  return query.orderBy('created_at', 'desc')
}

// Usage
const filteredTasks = await buildTaskQuery({
  status: 1,
  priority: 1,
  hasDeadline: true,
  isOverdue: true
}).all()
```

---

**This completes the Epic-008 API Reference. You now have comprehensive documentation for all ActiveRecord and ReactiveRecord methods, with Rails comparisons and practical examples. 🚀**