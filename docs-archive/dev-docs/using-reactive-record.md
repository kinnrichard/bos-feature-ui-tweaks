# Using ReactiveRecord: Converting Layouts to Zero-Native Queries

This guide explains how to convert existing layouts and components from PopulatedJob transformation layers to Zero-native ReactiveRecord patterns.

## Overview

**ReactiveRecord** is our wrapper around Zero.js that provides:
- ActiveRecord-style query interface (`Job.find()`, `Job.all()`, `Job.where()`)
- Automatic relationship loading with `.related()`
- Real-time reactivity via Zero's native listeners
- Progressive loading for optimal performance
- Svelte 5 runes compatibility

## Migration Steps

### 1. Replace Transformation Layers

**❌ Old Pattern (PopulatedJob transformation):**
```javascript
// Old jobs list page
const jobsQuery = Job.all();
const allJobs = $derived(
  jobsQuery.data.map(transformZeroJobToPopulatedJob)
);

function transformZeroJobToPopulatedJob(zeroJob) {
  return {
    id: zeroJob.id,
    attributes: {
      title: zeroJob.title,
      status: mapZeroStatusToString(zeroJob.status)
    },
    client: { name: 'Unknown Client' }  // Manual lookup needed
  };
}
```

**✅ New Pattern (Zero-native with relationships):**
```javascript
// New jobs list page
const jobsQuery = Job.all();
const allJobs = $derived(jobsQuery.data || []);

// Job.all() automatically includes:
// - .related('client')
// - .related('jobAssignments', assignments => assignments.related('user'))
```

### 2. Update ReactiveRecord Model Methods

Add relationship loading to your model methods:

```javascript
// In /lib/zero/models/job.generated.ts

export const Job = {
  // Find single job with all relationships
  find(id: string) {
    return new ReactiveQueryOne<Job>(
      () => {
        const zero = getZero();
        return zero ? zero.query.jobs
          .where('id', id)
          .related('client')
          .related('tasks', tasks => tasks.orderBy('position', 'asc'))
          .related('jobAssignments', assignments => assignments.related('user'))
          .related('notes', notes => notes.related('user').orderBy('created_at', 'desc'))
          .related('scheduledDateTimes')
          .one() : null;
      },
      null
    );
  },

  // List all jobs with relationships for jobs list
  all() {
    return new ReactiveQuery<Job>(
      () => {
        const zero = getZero();
        return zero ? zero.query.jobs
          .related('client')
          .related('jobAssignments', assignments => assignments.related('user'))
          .orderBy('created_at', 'desc') : null;
      },
      []
    );
  }
};
```

### 3. Update Component Props and Data Access

**❌ Old Component Pattern:**
```svelte
<script>
  import type { PopulatedJob } from '$lib/types/job';
  
  export let job: PopulatedJob;
  
  $: statusEmoji = getJobStatusEmoji(job.attributes.status);
  $: clientName = job.client.name;
  $: jobTitle = job.attributes.title;
</script>

<div>
  <h2>{jobTitle}</h2>
  <p>Client: {clientName}</p>
  <span>{statusEmoji}</span>
</div>
```

**✅ New Component Pattern:**
```svelte
<script>
  import type { Job } from '$lib/zero/models/job.generated';
  
  export let job: Job;
  
  // Map Zero's numeric values to strings for display
  function mapZeroStatusToString(status: number | null): string {
    const statusMap: Record<number, string> = {
      0: 'open', 1: 'in_progress', 2: 'waiting_for_customer',
      3: 'waiting_for_scheduled_appointment', 4: 'paused',
      5: 'successfully_completed', 6: 'cancelled'
    };
    return statusMap[status || 0] || 'open';
  }
  
  $: statusString = mapZeroStatusToString(job.status);
  $: statusEmoji = getJobStatusEmoji(statusString);
  $: clientName = job.client?.name || 'Unknown Client';
  $: jobTitle = job.title || 'Untitled Job';
</script>

<div>
  <h2>{jobTitle}</h2>
  <p>Client: {clientName}</p>
  <span>{statusEmoji}</span>
</div>
```

### 4. Handle Technician Data from Relationships

**Extract technicians from job assignments:**
```svelte
<script>
  // Extract technicians from job assignments
  $: technicians = job.jobAssignments?.map(assignment => ({
    id: assignment.user?.id,
    name: assignment.user?.name,
    initials: assignment.user?.name?.split(' ').map(n => n[0]).join('') || '?',
    avatar_style: `background-color: var(--accent-blue);`
  })) || [];
</script>

<!-- Display technician avatars -->
{#if technicians?.length > 0}
  <div class="technician-avatars">
    {#each technicians as technician}
      <span class="avatar" style={technician.avatar_style}>
        {technician.initials}
      </span>
    {/each}
  </div>
{/if}
```

### 5. Implement Progressive Loading

For complex pages, load primary data first, then secondary data:

```javascript
// Progressive loading pattern
export const Job = {
  findProgressive(id: string) {
    // Primary query: Job + client + tasks + technicians (loads first)
    const job = new ReactiveQueryOne<Job>(
      () => {
        const zero = getZero();
        return zero ? zero.query.jobs
          .where('id', id)
          .related('client')
          .related('tasks', tasks => tasks.orderBy('position', 'asc'))
          .related('jobAssignments', assignments => assignments.related('user'))
          .one() : null;
      },
      null
    );

    // Progressive query: Notes/history (loads after primary data)
    const notes = new ReactiveQuery<any>(
      () => {
        const zero = getZero();
        // Only start loading notes if we have job data
        if (!zero || !job.data) return null;
        
        return zero.query.notes
          .where('notable_id', id)
          .related('user')
          .orderBy('created_at', 'desc');
      },
      []
    );

    return { job, notes };
  }
};
```

**Usage in component:**
```svelte
<script>
  const { job: jobQuery, notes: notesQuery } = $derived(Job.findProgressive(jobId));
  
  const job = $derived(jobQuery.data);
  const isLoading = $derived(jobQuery.isLoading);
  const notes = $derived(notesQuery.data);
  const notesLoading = $derived(notesQuery.isLoading);
</script>

{#if isLoading}
  <LoadingSkeleton />
{:else if job}
  <JobDetailView {job} {notes} {notesLoading} />
{/if}
```

## Common Patterns

### 1. Filtering with Relationships

**Technician filtering:**
```javascript
// Filter jobs by technician via job assignments
const jobs = $derived(
  allJobs.filter(job => {
    if (technicianId) {
      return job.jobAssignments?.some(assignment => 
        assignment.user?.id === technicianId
      );
    }
    return true;
  })
);
```

### 2. Status/Priority Mapping

Create reusable mapping functions:

```javascript
// /lib/utils/zero-mappings.ts
export function mapZeroStatusToString(status: number | null): string {
  const statusMap: Record<number, string> = {
    0: 'open', 1: 'in_progress', 2: 'waiting_for_customer',
    3: 'waiting_for_scheduled_appointment', 4: 'paused',
    5: 'successfully_completed', 6: 'cancelled'
  };
  return statusMap[status || 0] || 'open';
}

export function mapZeroPriorityToString(priority: number | null): string {
  const priorityMap: Record<number, string> = {
    0: 'low', 1: 'normal', 2: 'high',
    3: 'critical', 4: 'proactive_followup'
  };
  return priorityMap[priority || 1] || 'normal';
}
```

### 3. Task Batch Details

Extract task statistics from relationships:

```javascript
const taskBatchDetails = $derived(job?.tasks ? {
  total: job.tasks.length,
  completed: job.tasks.filter(task => task.status === 'completed').length,
  pending: job.tasks.filter(task => task.status === 'pending').length,
  in_progress: job.tasks.filter(task => task.status === 'in_progress').length
} : undefined);
```

## TTL and Performance

### Default Behavior (Recommended)
ReactiveRecord uses Zero's default TTL behavior (immediate expiry on unmount):

```javascript
// Respects Zero's default - expires immediately when component unmounts
const jobs = Job.all();
```

### Custom TTL (When Needed)
For queries that should persist in background:

```javascript
// Custom TTL - persists for 2 hours after component unmounts
const jobs = new ReactiveQuery(
  () => zero?.query.jobs.related('client'),
  [],
  '2h'  // TTL parameter
);
```

## Migration Checklist

- [ ] Remove `transformZeroJobToPopulatedJob` functions
- [ ] Update Job model methods to include `.related()` calls
- [ ] Change component props from `PopulatedJob` to Zero native types
- [ ] Update data access from `job.attributes.field` to `job.field`
- [ ] Add status/priority mapping for display
- [ ] Extract technicians from `job.jobAssignments`
- [ ] Add defensive null checks for relationships
- [ ] Implement progressive loading for complex pages
- [ ] Test filtering functionality with relationships
- [ ] Verify real-time updates work correctly

## Benefits of Zero-Native Approach

1. **Real-time Updates**: Automatic WebSocket synchronization
2. **Better Performance**: No manual transformation overhead
3. **Type Safety**: Direct TypeScript integration
4. **Relationship Loading**: Built-in `.related()` system
5. **Offline Support**: Zero's offline-first architecture
6. **Memory Efficiency**: Zero's 20MB client limit with LRU eviction
7. **Simpler Code**: No transformation layer to maintain

## Troubleshooting

### Common Issues

**1. `job.attributes.status` undefined**
- **Cause**: Using old PopulatedJob structure
- **Fix**: Change to `job.status` (Zero native field)

**2. Missing client/technician data**
- **Cause**: Missing `.related()` calls in query
- **Fix**: Add relationship loading to model methods

**3. `ttl.slice is not a function`**
- **Cause**: Invalid TTL parameter
- **Fix**: Use `undefined` for default behavior or valid string like `'2h'`

**4. Data not updating in real-time**
- **Cause**: Using `.run()` instead of materialized queries
- **Fix**: ReactiveRecord automatically uses `materialize()` for real-time updates

### Debugging Tips

```javascript
// Enable debug logging
console.log('Job data:', $state.snapshot(job));
console.log('Client:', job.client?.name);
console.log('Technicians:', job.jobAssignments?.map(ja => ja.user?.name));
```

This guide should help you successfully migrate any layout from PopulatedJob transformation layers to Zero-native ReactiveRecord patterns!