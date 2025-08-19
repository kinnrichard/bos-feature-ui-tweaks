# Using Polymorphic Relationships with includes()

## Overview

The polymorphic tracking system integrates seamlessly with the existing Rails-like `includes()` pattern for eager loading relationships. This is the **recommended approach** for working with polymorphic associations.

## Basic Usage

### Loading Polymorphic Associations

```typescript
import { Job } from '@/lib/models/job';
import { Note } from '@/lib/models/note';
import { ActivityLog } from '@/lib/models/activity-log';

// Eager load notes with a job
const job = await Job.includes('notes').find(jobId);
// job.notes is now populated with all related notes

// Eager load multiple polymorphic associations
const jobWithAll = await Job
  .includes('notes', 'activityLogs', 'scheduledDateTimes')
  .find(jobId);

// Access the loaded associations
console.log(`Job has ${jobWithAll.notes?.length || 0} notes`);
console.log(`Job has ${jobWithAll.activityLogs?.length || 0} activity logs`);
```

### Querying Polymorphic Associations Directly

```typescript
// Find all notes for a specific job
const jobNotes = await Note.where({
  notable_type: 'Job',
  notable_id: jobId
}).all();

// Find all activity logs for a task
const taskLogs = await ActivityLog.where({
  loggable_type: 'Task',
  loggable_id: taskId
}).all();

// Find all notes for any jobs
const allJobNotes = await Note.where({
  notable_type: 'Job'
}).all();
```

## Advanced Patterns

### Batch Loading Multiple Records

```typescript
// Load multiple jobs with their polymorphic associations
const jobs = await Job
  .includes('notes', 'activityLogs')
  .where({ status: 'open' })
  .all();

// Each job has its associations populated
jobs.forEach(job => {
  console.log(`Job ${job.id}: ${job.notes?.length || 0} notes`);
});
```

### Conditional Loading

```typescript
// Only load associations when needed
const shouldLoadNotes = userWantsToSeeNotes();

const query = Job;
if (shouldLoadNotes) {
  query.includes('notes');
}
const job = await query.find(jobId);
```

### Using with Reactive Models

```typescript
import { ReactiveJob } from '@/lib/models/reactive-job';

// Works the same with reactive models
const jobQuery = ReactiveJob
  .includes('notes', 'activityLogs')
  .find(jobId);

// In a Svelte component
$: job = jobQuery.data;
$: notes = job?.notes || [];
```

## Working with Different Polymorphic Types

### Notable (Notes)

```typescript
// Job notes
const job = await Job.includes('notes').find(jobId);

// Task notes  
const task = await Task.includes('notes').find(taskId);

// Person notes
const person = await Person.includes('notes').find(personId);
```

### Loggable (Activity Logs)

```typescript
// Job activity logs
const job = await Job.includes('activityLogs').find(jobId);

// Client activity logs
const client = await Client.includes('activityLogs').find(clientId);

// User activity logs
const user = await User.includes('activityLogs').find(userId);
```

### Schedulable (Scheduled Date Times)

```typescript
// Job scheduled times
const job = await Job.includes('scheduledDateTimes').find(jobId);

// Access the scheduled times
job.scheduledDateTimes?.forEach(schedule => {
  console.log(`Scheduled for: ${schedule.scheduled_at}`);
});
```

## Type Safety

The TypeScript types know about polymorphic relationships:

```typescript
import type { JobData } from '@/lib/models/types/job-data';

// JobData includes optional polymorphic associations
interface JobData {
  // ... other fields
  notes?: NoteData[];           // Polymorphic has_many
  activityLogs?: ActivityLogData[];  // Polymorphic has_many  
  scheduledDateTimes?: ScheduledDateTimeData[]; // Polymorphic has_many
}
```

## Performance Considerations

### Use includes() to Avoid N+1 Queries

```typescript
// ❌ BAD: N+1 queries
const jobs = await Job.all().all();
for (const job of jobs) {
  // This makes a separate query for each job!
  const notes = await Note.where({
    notable_type: 'Job',
    notable_id: job.id
  }).all();
}

// ✅ GOOD: Single query with includes
const jobs = await Job.includes('notes').all().all();
// All notes are loaded in one query
```

### Only Include What You Need

```typescript
// If you only need notes, don't load everything
const job = await Job.includes('notes').find(jobId);

// Not this (unless you need all associations)
const job = await Job
  .includes('notes', 'activityLogs', 'scheduledDateTimes', 'tasks')
  .find(jobId);
```

## Common Patterns

### Dashboard View with Multiple Associations

```typescript
// Load everything needed for a job dashboard
async function loadJobDashboard(jobId: string) {
  const job = await Job
    .includes('client', 'notes', 'activityLogs', 'tasks', 'scheduledDateTimes')
    .find(jobId);
    
  return {
    job,
    recentNotes: job.notes?.slice(0, 5) || [],
    recentActivity: job.activityLogs?.slice(0, 10) || [],
    openTasks: job.tasks?.filter(t => t.status === 'open') || [],
    upcomingSchedule: job.scheduledDateTimes?.filter(s => 
      new Date(s.scheduled_at) > new Date()
    ) || []
  };
}
```

### Finding Records by Polymorphic Association

```typescript
// Find all jobs that have notes
const jobsWithNotes = await Job
  .includes('notes')
  .all()
  .then(jobs => jobs.filter(job => job.notes && job.notes.length > 0));

// Find all tasks with recent activity
const tasksWithRecentActivity = await Task
  .includes('activityLogs')
  .all()
  .then(tasks => tasks.filter(task => {
    const lastLog = task.activityLogs?.[0];
    if (!lastLog) return false;
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return new Date(lastLog.created_at) > dayAgo;
  }));
```

## Summary

The `includes()` pattern is the recommended way to work with polymorphic associations because:

1. **It's Rails-like** - Familiar to Rails developers
2. **It's performant** - Avoids N+1 queries through eager loading
3. **It's type-safe** - TypeScript knows what's included
4. **It works today** - No additional implementation needed
5. **It's consistent** - Works the same for all associations, polymorphic or not

The polymorphic system enhances this by:
- Automatically generating the correct schema relationships
- Providing type definitions for all polymorphic associations
- Ensuring the Zero.js schema knows about all valid polymorphic targets

This approach is cleaner than adding methods to objects and follows established Rails patterns.