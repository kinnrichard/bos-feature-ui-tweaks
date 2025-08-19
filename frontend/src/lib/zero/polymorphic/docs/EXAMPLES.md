# Polymorphic System Examples

## Overview

This document provides real-world usage examples of the Polymorphic Tracking System in the BOS frontend application. Each example includes complete code samples, explanations, and best practices.

## Table of Contents

- [Basic Usage Examples](#basic-usage-examples)
- [Activity Logs (Loggable)](#activity-logs-loggable)
- [Notes (Notable)](#notes-notable)
- [Scheduled Date Times (Schedulable)](#scheduled-date-times-schedulable)
- [Job Targets (Target)](#job-targets-target)
- [Parsed Emails (Parseable)](#parsed-emails-parseable)
- [Advanced Queries](#advanced-queries)
- [Integration with Svelte Components](#integration-with-svelte-components)
- [Performance Optimization](#performance-optimization)

## Basic Usage Examples

### System Initialization

```typescript
// src/app.ts - Application startup
import { initializePolymorphicSystem } from '@/lib/zero/polymorphic';

async function initializeApp() {
  try {
    // Initialize the polymorphic system
    await initializePolymorphicSystem();
    console.log('✅ Polymorphic system initialized');
    
    // Your app initialization continues...
  } catch (error) {
    console.error('❌ Failed to initialize polymorphic system:', error);
    throw error;
  }
}

initializeApp();
```

### Basic Configuration Check

```typescript
// Check what polymorphic types are available
import { getPolymorphicTracker } from '@/lib/zero/polymorphic';

const tracker = getPolymorphicTracker();

// Check available types
const loggableTargets = tracker.getValidTargets('loggable');
console.log('Loggable targets:', loggableTargets);
// Output: ['jobs', 'tasks', 'clients', 'users', 'people']

const notableTargets = tracker.getValidTargets('notable'); 
console.log('Notable targets:', notableTargets);
// Output: ['jobs', 'tasks', 'clients']

// Validate specific targets
console.log('Can jobs be loggable?', tracker.isValidTarget('loggable', 'jobs')); // true
console.log('Can people be notable?', tracker.isValidTarget('notable', 'people')); // false
```

## Activity Logs (Loggable)

Activity logs track changes across multiple model types using the `loggable` polymorphic relationship.

### Basic Activity Log Queries

```typescript
// src/lib/queries/activity-logs.ts
import { createLoggableQuery } from '@/lib/zero/polymorphic';

export async function getRecentActivityLogs(options = {}) {
  const query = createLoggableQuery({
    targetTypes: ['jobs', 'tasks', 'clients'],
    orderBy: 'created_at DESC',
    limit: 20,
    eagerLoad: ['user'], // Also load the user who performed the action
    ...options
  });

  const result = await query.execute();
  
  return {
    logs: result.data,
    total: result.metadata.total,
    byType: result.metadata.targetCounts
  };
}

// Usage example
const { logs, total, byType } = await getRecentActivityLogs();
console.log(`Found ${total} activity logs`);
console.log(`Breakdown: ${byType.jobs} jobs, ${byType.tasks} tasks, ${byType.clients} clients`);
```

### Activity Logs for Specific Entity

```typescript
// Get all activity logs for a specific job
export async function getJobActivityLogs(jobId: string) {
  const query = createLoggableQuery({
    targetTypes: ['jobs'],
    conditions: {
      loggable_id: jobId,
      loggable_type: 'Job'
    },
    orderBy: 'created_at DESC',
    eagerLoad: ['user', 'loggableJob'] // Load the job and user
  });

  return await query.execute();
}

// Get activity logs for multiple entities
export async function getEntityActivityLogs(entityType: string, entityIds: string[]) {
  const query = createLoggableQuery({
    targetTypes: [entityType.toLowerCase() + 's'], // 'jobs', 'tasks', etc.
    conditions: {
      loggable_id: { in: entityIds },
      loggable_type: entityType
    },
    orderBy: 'created_at DESC'
  });

  return await query.execute();
}
```

### Activity Logs with Custom Filtering

```typescript
// Advanced filtering example
export async function getFilteredActivityLogs(filters) {
  const { 
    entityTypes = ['jobs', 'tasks', 'clients'],
    dateRange,
    userIds,
    actions,
    search
  } = filters;

  let conditions: any = {};

  // Date range filtering
  if (dateRange?.start && dateRange?.end) {
    conditions.created_at = {
      gte: dateRange.start,
      lte: dateRange.end
    };
  }

  // User filtering
  if (userIds?.length > 0) {
    conditions.user_id = { in: userIds };
  }

  // Action type filtering
  if (actions?.length > 0) {
    conditions.action = { in: actions };
  }

  // Text search in details
  if (search) {
    conditions.details = { contains: search };
  }

  const query = createLoggableQuery({
    targetTypes: entityTypes,
    conditions,
    orderBy: 'created_at DESC',
    eagerLoad: ['user']
  });

  return await query.execute();
}
```

### Creating Activity Log Entries

```typescript
// src/lib/services/activity-logger.ts
import { getPolymorphicTracker } from '@/lib/zero/polymorphic';
import { ActivityLog } from '@/lib/models/activity-log';

export class ActivityLogger {
  private tracker = getPolymorphicTracker();

  async logActivity(params: {
    entityType: string;
    entityId: string;
    action: string;
    details?: object;
    userId?: string;
  }) {
    const { entityType, entityId, action, details, userId } = params;
    
    // Convert entity type to table name format
    const tableName = entityType.toLowerCase() + 's';
    
    // Validate that this entity type can be logged
    if (!this.tracker.isValidTarget('loggable', tableName)) {
      throw new Error(`Entity type ${entityType} cannot be logged`);
    }

    // Create activity log entry
    const activityLog = await ActivityLog.create({
      loggable_type: entityType,
      loggable_id: entityId,
      action: action,
      details: details || {},
      user_id: userId,
      created_at: new Date().toISOString()
    });

    return activityLog;
  }

  // Convenience methods for common activities
  async logJobStatusChange(jobId: string, oldStatus: string, newStatus: string, userId: string) {
    return this.logActivity({
      entityType: 'Job',
      entityId: jobId,
      action: 'status_changed',
      details: { old_status: oldStatus, new_status: newStatus },
      userId
    });
  }

  async logTaskCompletion(taskId: string, userId: string, notes?: string) {
    return this.logActivity({
      entityType: 'Task',
      entityId: taskId,
      action: 'completed',
      details: { completion_notes: notes },
      userId
    });
  }

  async logClientUpdate(clientId: string, changes: object, userId: string) {
    return this.logActivity({
      entityType: 'Client',
      entityId: clientId,
      action: 'updated',
      details: { changes },
      userId
    });
  }
}

// Usage
const logger = new ActivityLogger();

// Log job status change
await logger.logJobStatusChange('job-123', 'pending', 'in_progress', 'user-456');

// Log task completion
await logger.logTaskCompletion('task-789', 'user-456', 'All requirements met');

// Log client update
await logger.logClientUpdate('client-101', 
  { phone: '+1-555-0123', email: 'new@example.com' }, 
  'user-456'
);
```

## Notes (Notable)

Notes can be attached to jobs, tasks, and clients using the `notable` polymorphic relationship.

### Basic Note Queries

```typescript
// src/lib/queries/notes.ts
import { createNotableQuery } from '@/lib/zero/polymorphic';

export async function getNotesForEntity(entityType: string, entityId: string) {
  const query = createNotableQuery({
    targetTypes: [entityType.toLowerCase() + 's'],
    conditions: {
      notable_id: entityId,
      notable_type: entityType
    },
    orderBy: 'created_at DESC',
    eagerLoad: ['user', `notable${entityType}`] // Load user and the related entity
  });

  return await query.execute();
}

// Get all notes for jobs
export async function getJobNotes() {
  const query = createNotableQuery({
    targetTypes: ['jobs'],
    eagerLoad: ['user', 'notableJob'],
    orderBy: 'created_at DESC'
  });

  return await query.execute();
}

// Search notes across all entity types
export async function searchNotes(searchTerm: string) {
  const query = createNotableQuery({
    targetTypes: ['jobs', 'tasks', 'clients'],
    conditions: {
      content: { contains: searchTerm }
    },
    orderBy: 'relevance DESC, created_at DESC',
    eagerLoad: ['user']
  });

  return await query.execute();
}
```

### Creating and Managing Notes

```typescript
// src/lib/services/note-manager.ts
import { getPolymorphicTracker } from '@/lib/zero/polymorphic';
import { Note } from '@/lib/models/note';

export class NoteManager {
  private tracker = getPolymorphicTracker();

  async createNote(params: {
    entityType: string;
    entityId: string;
    content: string;
    userId: string;
    isPrivate?: boolean;
  }) {
    const { entityType, entityId, content, userId, isPrivate = false } = params;
    
    // Validate entity type
    const tableName = entityType.toLowerCase() + 's';
    if (!this.tracker.isValidTarget('notable', tableName)) {
      throw new Error(`Cannot create notes for entity type ${entityType}`);
    }

    const note = await Note.create({
      notable_type: entityType,
      notable_id: entityId,
      content: content,
      user_id: userId,
      is_private: isPrivate,
      created_at: new Date().toISOString()
    });

    return note;
  }

  async updateNote(noteId: string, content: string, userId: string) {
    const note = await Note.findById(noteId);
    if (!note) throw new Error('Note not found');

    // Check permissions (example)
    if (note.user_id !== userId && !note.is_private) {
      throw new Error('No permission to edit this note');
    }

    note.content = content;
    note.updated_at = new Date().toISOString();
    await note.save();

    return note;
  }

  async deleteNote(noteId: string, userId: string) {
    const note = await Note.findById(noteId);
    if (!note) throw new Error('Note not found');

    // Check permissions
    if (note.user_id !== userId) {
      throw new Error('No permission to delete this note');
    }

    await note.destroy();
  }

  // Get notes with entity context
  async getNotesWithContext(entityType: string, entityId: string) {
    const notes = await getNotesForEntity(entityType, entityId);
    
    return notes.data.map(note => ({
      ...note,
      entityContext: {
        type: note.notable_type,
        id: note.notable_id,
        title: this.getEntityTitle(note)
      }
    }));
  }

  private getEntityTitle(note: any): string {
    // Extract title based on entity type
    const entityType = note.notable_type.toLowerCase();
    const entity = note[`notable${note.notable_type}`];
    
    if (!entity) return 'Unknown Entity';
    
    switch (entityType) {
      case 'job':
        return `Job #${entity.job_number} - ${entity.description}`;
      case 'task':
        return `Task: ${entity.title}`;
      case 'client':
        return `Client: ${entity.name}`;
      default:
        return entity.name || entity.title || `${entityType} #${entity.id}`;
    }
  }
}

// Usage examples
const noteManager = new NoteManager();

// Create a job note
const jobNote = await noteManager.createNote({
  entityType: 'Job',
  entityId: 'job-123',
  content: 'Customer mentioned additional requirements during site visit',
  userId: 'user-456'
});

// Create a private task note
const taskNote = await noteManager.createNote({
  entityType: 'Task',
  entityId: 'task-789',
  content: 'Found potential issue with electrical panel - need to discuss with supervisor',
  userId: 'user-456',
  isPrivate: true
});

// Get notes with context
const notesWithContext = await noteManager.getNotesWithContext('Job', 'job-123');
```

## Scheduled Date Times (Schedulable)

Scheduled date times can be associated with jobs and tasks using the `schedulable` polymorphic relationship.

### Basic Schedule Queries

```typescript
// src/lib/queries/schedules.ts
import { createSchedulableQuery } from '@/lib/zero/polymorphic';

export async function getUpcomingSchedules(days = 7) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const query = createSchedulableQuery({
    targetTypes: ['jobs', 'tasks'],
    conditions: {
      scheduled_at: {
        gte: new Date().toISOString(),
        lte: endDate.toISOString()
      }
    },
    orderBy: 'scheduled_at ASC',
    eagerLoad: ['user'] // Load the assigned user
  });

  return await query.execute();
}

export async function getEntitySchedule(entityType: string, entityId: string) {
  const query = createSchedulableQuery({
    targetTypes: [entityType.toLowerCase() + 's'],
    conditions: {
      schedulable_id: entityId,
      schedulable_type: entityType
    },
    orderBy: 'scheduled_at ASC',
    eagerLoad: ['user', `schedulable${entityType}`]
  });

  return await query.execute();
}

// Get technician's schedule
export async function getTechnicianSchedule(technicianId: string, date?: string) {
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const query = createSchedulableQuery({
    targetTypes: ['jobs', 'tasks'],
    conditions: {
      user_id: technicianId,
      scheduled_at: {
        gte: startOfDay.toISOString(),
        lte: endOfDay.toISOString()
      }
    },
    orderBy: 'scheduled_at ASC',
    eagerLoad: ['schedulableJob', 'schedulableTask']
  });

  return await query.execute();
}
```

### Schedule Management

```typescript
// src/lib/services/schedule-manager.ts
import { getPolymorphicTracker } from '@/lib/zero/polymorphic';
import { ScheduledDateTime } from '@/lib/models/scheduled-date-time';

export class ScheduleManager {
  private tracker = getPolymorphicTracker();

  async scheduleEntity(params: {
    entityType: string;
    entityId: string;
    scheduledAt: string;
    userId?: string;
    duration?: number;
    notes?: string;
  }) {
    const { entityType, entityId, scheduledAt, userId, duration, notes } = params;
    
    // Validate entity type can be scheduled
    const tableName = entityType.toLowerCase() + 's';
    if (!this.tracker.isValidTarget('schedulable', tableName)) {
      throw new Error(`Entity type ${entityType} cannot be scheduled`);
    }

    // Check for scheduling conflicts
    const conflicts = await this.checkSchedulingConflicts(userId, scheduledAt, duration);
    if (conflicts.length > 0) {
      throw new Error(`Scheduling conflict detected: ${conflicts[0].description}`);
    }

    const schedule = await ScheduledDateTime.create({
      schedulable_type: entityType,
      schedulable_id: entityId,
      scheduled_at: scheduledAt,
      user_id: userId,
      duration_minutes: duration,
      notes: notes,
      status: 'scheduled',
      created_at: new Date().toISOString()
    });

    return schedule;
  }

  async updateSchedule(scheduleId: string, updates: {
    scheduledAt?: string;
    userId?: string;
    duration?: number;
    notes?: string;
    status?: string;
  }) {
    const schedule = await ScheduledDateTime.findById(scheduleId);
    if (!schedule) throw new Error('Schedule not found');

    // Check conflicts for time changes
    if (updates.scheduledAt || updates.userId || updates.duration) {
      const conflicts = await this.checkSchedulingConflicts(
        updates.userId || schedule.user_id,
        updates.scheduledAt || schedule.scheduled_at,
        updates.duration || schedule.duration_minutes,
        scheduleId // Exclude current schedule from conflict check
      );
      
      if (conflicts.length > 0) {
        throw new Error(`Scheduling conflict: ${conflicts[0].description}`);
      }
    }

    Object.assign(schedule, updates);
    schedule.updated_at = new Date().toISOString();
    await schedule.save();

    return schedule;
  }

  private async checkSchedulingConflicts(
    userId: string, 
    scheduledAt: string, 
    duration = 60,
    excludeScheduleId?: string
  ) {
    if (!userId) return [];

    const startTime = new Date(scheduledAt);
    const endTime = new Date(startTime.getTime() + duration * 60000);

    let conditions: any = {
      user_id: userId,
      status: { in: ['scheduled', 'in_progress'] },
      scheduled_at: {
        lt: endTime.toISOString()
      },
      // Assuming there's an end time calculation or duration
      // This would need to be adjusted based on your schema
    };

    if (excludeScheduleId) {
      conditions.id = { ne: excludeScheduleId };
    }

    const query = createSchedulableQuery({
      targetTypes: ['jobs', 'tasks'],
      conditions,
      eagerLoad: ['schedulableJob', 'schedulableTask']
    });

    const conflicts = await query.execute();
    
    return conflicts.data.map(conflict => ({
      id: conflict.id,
      scheduledAt: conflict.scheduled_at,
      entityType: conflict.schedulable_type,
      entityId: conflict.schedulable_id,
      description: this.getConflictDescription(conflict)
    }));
  }

  private getConflictDescription(conflict: any): string {
    const entityType = conflict.schedulable_type.toLowerCase();
    const entity = conflict[`schedulable${conflict.schedulable_type}`];
    
    if (!entity) return `${conflict.schedulable_type} #${conflict.schedulable_id}`;
    
    const time = new Date(conflict.scheduled_at).toLocaleTimeString();
    
    switch (entityType) {
      case 'job':
        return `Job #${entity.job_number} at ${time}`;
      case 'task':
        return `Task "${entity.title}" at ${time}`;
      default:
        return `${conflict.schedulable_type} at ${time}`;
    }
  }

  // Bulk schedule operations
  async bulkSchedule(schedules: Array<{
    entityType: string;
    entityId: string;
    scheduledAt: string;
    userId: string;
  }>) {
    const results = [];
    const errors = [];

    for (const schedule of schedules) {
      try {
        const result = await this.scheduleEntity(schedule);
        results.push(result);
      } catch (error) {
        errors.push({ schedule, error: error.message });
      }
    }

    return { results, errors };
  }
}

// Usage examples
const scheduleManager = new ScheduleManager();

// Schedule a job
const jobSchedule = await scheduleManager.scheduleEntity({
  entityType: 'Job',
  entityId: 'job-123',
  scheduledAt: '2025-08-07T10:00:00Z',
  userId: 'tech-456',
  duration: 120, // 2 hours
  notes: 'Bring ladder and specialized tools'
});

// Update schedule
const updatedSchedule = await scheduleManager.updateSchedule(jobSchedule.id, {
  scheduledAt: '2025-08-07T11:00:00Z', // Move 1 hour later
  notes: 'Customer requested later time'
});

// Get technician's daily schedule
const dailySchedule = await getTechnicianSchedule('tech-456', '2025-08-07');
```

## Job Targets (Target)

Job targets represent the relationships between jobs and the entities they target (clients, people, people groups).

### Basic Target Queries

```typescript
// src/lib/queries/job-targets.ts
import { createTargetQuery } from '@/lib/zero/polymorphic';

export async function getJobTargets(jobId: string) {
  const query = createTargetQuery({
    targetTypes: ['clients', 'people', 'people_groups'],
    conditions: {
      job_id: jobId
    },
    eagerLoad: ['targetClient', 'targetPerson', 'targetPeopleGroup']
  });

  return await query.execute();
}

export async function getTargetJobs(targetType: string, targetId: string) {
  const query = createTargetQuery({
    targetTypes: [targetType.toLowerCase()],
    conditions: {
      target_id: targetId,
      target_type: targetType
    },
    eagerLoad: ['job', `target${targetType}`]
  });

  return await query.execute();
}

// Get all jobs for a specific client
export async function getClientJobs(clientId: string) {
  return getTargetJobs('Client', clientId);
}

// Get all jobs for a specific person
export async function getPersonJobs(personId: string) {
  return getTargetJobs('Person', personId);
}
```

### Target Management

```typescript
// src/lib/services/job-target-manager.ts
import { getPolymorphicTracker } from '@/lib/zero/polymorphic';
import { JobTarget } from '@/lib/models/job-target';

export class JobTargetManager {
  private tracker = getPolymorphicTracker();

  async addJobTarget(jobId: string, targetType: string, targetId: string) {
    // Validate target type
    const tableName = targetType.toLowerCase() + 's';
    if (!this.tracker.isValidTarget('target', tableName)) {
      throw new Error(`Invalid target type: ${targetType}`);
    }

    // Check if target already exists for this job
    const existingTarget = await JobTarget.where({
      job_id: jobId,
      target_type: targetType,
      target_id: targetId
    }).first();

    if (existingTarget) {
      return existingTarget; // Already exists
    }

    const target = await JobTarget.create({
      job_id: jobId,
      target_type: targetType,
      target_id: targetId,
      created_at: new Date().toISOString()
    });

    return target;
  }

  async removeJobTarget(jobId: string, targetType: string, targetId: string) {
    const target = await JobTarget.where({
      job_id: jobId,
      target_type: targetType,
      target_id: targetId
    }).first();

    if (target) {
      await target.destroy();
    }
  }

  async setJobTargets(jobId: string, targets: Array<{
    type: string;
    id: string;
  }>) {
    // Remove existing targets
    const existingTargets = await JobTarget.where({ job_id: jobId }).all();
    for (const target of existingTargets) {
      await target.destroy();
    }

    // Add new targets
    const newTargets = [];
    for (const target of targets) {
      const newTarget = await this.addJobTarget(jobId, target.type, target.id);
      newTargets.push(newTarget);
    }

    return newTargets;
  }

  async getJobTargetSummary(jobId: string) {
    const targets = await getJobTargets(jobId);
    
    return {
      total: targets.data.length,
      byType: targets.metadata.targetCounts,
      details: targets.data.map(target => ({
        type: target.target_type,
        id: target.target_id,
        name: this.getTargetName(target),
        createdAt: target.created_at
      }))
    };
  }

  private getTargetName(target: any): string {
    const targetType = target.target_type.toLowerCase();
    const entity = target[`target${target.target_type}`];
    
    if (!entity) return `${target.target_type} #${target.target_id}`;
    
    switch (targetType) {
      case 'client':
        return entity.name || entity.company_name || `Client #${entity.id}`;
      case 'person':
        return `${entity.first_name} ${entity.last_name}`.trim() || `Person #${entity.id}`;
      case 'peoplegroup':
        return entity.name || `Group #${entity.id}`;
      default:
        return entity.name || `${target.target_type} #${entity.id}`;
    }
  }
}

// Usage examples
const targetManager = new JobTargetManager();

// Add client target to job
await targetManager.addJobTarget('job-123', 'Client', 'client-456');

// Add person target to job
await targetManager.addJobTarget('job-123', 'Person', 'person-789');

// Set all targets for a job at once
await targetManager.setJobTargets('job-123', [
  { type: 'Client', id: 'client-456' },
  { type: 'Person', id: 'person-789' },
  { type: 'PeopleGroup', id: 'group-101' }
]);

// Get job target summary
const summary = await targetManager.getJobTargetSummary('job-123');
console.log(summary);
// {
//   total: 3,
//   byType: { clients: 1, people: 1, people_groups: 1 },
//   details: [...]
// }
```

## Parsed Emails (Parseable)

Parsed emails can be associated with jobs and tasks using the `parseable` polymorphic relationship.

### Email Parsing Queries

```typescript
// src/lib/queries/parsed-emails.ts
import { createParseableQuery } from '@/lib/zero/polymorphic';

export async function getEntityEmails(entityType: string, entityId: string) {
  const query = createParseableQuery({
    targetTypes: [entityType.toLowerCase() + 's'],
    conditions: {
      parseable_id: entityId,
      parseable_type: entityType
    },
    orderBy: 'received_at DESC',
    eagerLoad: [`parseable${entityType}`]
  });

  return await query.execute();
}

export async function getRecentEmails(days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const query = createParseableQuery({
    targetTypes: ['jobs', 'tasks'],
    conditions: {
      received_at: { gte: since.toISOString() }
    },
    orderBy: 'received_at DESC',
    limit: 50
  });

  return await query.execute();
}

// Search emails by content
export async function searchEmails(searchTerm: string, entityType?: string) {
  const targetTypes = entityType ? [entityType.toLowerCase() + 's'] : ['jobs', 'tasks'];
  
  const query = createParseableQuery({
    targetTypes,
    conditions: {
      or: [
        { subject: { contains: searchTerm } },
        { body: { contains: searchTerm } },
        { sender: { contains: searchTerm } }
      ]
    },
    orderBy: 'received_at DESC'
  });

  return await query.execute();
}
```

### Email Management

```typescript
// src/lib/services/email-manager.ts
import { getPolymorphicTracker } from '@/lib/zero/polymorphic';
import { ParsedEmail } from '@/lib/models/parsed-email';

export class EmailManager {
  private tracker = getPolymorphicTracker();

  async associateEmail(emailId: string, entityType: string, entityId: string) {
    const email = await ParsedEmail.findById(emailId);
    if (!email) throw new Error('Email not found');

    // Validate entity type
    const tableName = entityType.toLowerCase() + 's';
    if (!this.tracker.isValidTarget('parseable', tableName)) {
      throw new Error(`Cannot associate emails with entity type ${entityType}`);
    }

    email.parseable_type = entityType;
    email.parseable_id = entityId;
    email.updated_at = new Date().toISOString();
    await email.save();

    return email;
  }

  async parseAndAssociate(rawEmail: {
    subject: string;
    body: string;
    sender: string;
    recipient: string;
    receivedAt: string;
  }, entityType: string, entityId: string) {
    // Create parsed email
    const parsedEmail = await ParsedEmail.create({
      subject: rawEmail.subject,
      body: rawEmail.body,
      sender: rawEmail.sender,
      recipient: rawEmail.recipient,
      received_at: rawEmail.receivedAt,
      parseable_type: entityType,
      parseable_id: entityId,
      created_at: new Date().toISOString()
    });

    // Extract and parse email metadata
    await this.extractEmailMetadata(parsedEmail);

    return parsedEmail;
  }

  private async extractEmailMetadata(email: ParsedEmail) {
    // Extract useful information from email content
    const metadata: any = {};

    // Extract phone numbers
    const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    const phones = email.body.match(phoneRegex) || [];
    if (phones.length > 0) {
      metadata.extracted_phones = phones;
    }

    // Extract email addresses
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = email.body.match(emailRegex) || [];
    if (emails.length > 0) {
      metadata.extracted_emails = emails;
    }

    // Extract URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = email.body.match(urlRegex) || [];
    if (urls.length > 0) {
      metadata.extracted_urls = urls;
    }

    // Detect urgency keywords
    const urgencyKeywords = ['urgent', 'asap', 'emergency', 'critical', 'immediate'];
    const isUrgent = urgencyKeywords.some(keyword => 
      email.subject.toLowerCase().includes(keyword) || 
      email.body.toLowerCase().includes(keyword)
    );

    if (isUrgent) {
      metadata.urgent = true;
    }

    // Save extracted metadata
    email.metadata = metadata;
    await email.save();
  }

  async getEmailThreads(entityType: string, entityId: string) {
    const emails = await getEntityEmails(entityType, entityId);
    
    // Group emails by subject thread
    const threads: { [key: string]: any[] } = {};
    
    emails.data.forEach(email => {
      // Normalize subject for threading
      let threadKey = email.subject
        .replace(/^(Re:|Fwd?:)\s*/i, '') // Remove Re: and Fwd: prefixes
        .toLowerCase()
        .trim();
      
      if (!threads[threadKey]) {
        threads[threadKey] = [];
      }
      threads[threadKey].push(email);
    });

    // Sort threads by most recent email
    Object.values(threads).forEach(thread => {
      thread.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
    });

    return Object.entries(threads)
      .map(([subject, emails]) => ({
        subject,
        emailCount: emails.length,
        lastReceived: emails[0].received_at,
        emails: emails
      }))
      .sort((a, b) => new Date(b.lastReceived).getTime() - new Date(a.lastReceived).getTime());
  }
}

// Usage examples
const emailManager = new EmailManager();

// Parse and associate an email with a job
const email = await emailManager.parseAndAssociate({
  subject: 'Re: Job #12345 - Additional requirements',
  body: 'Hi, I need to add one more outlet to the original scope...',
  sender: 'customer@example.com',
  recipient: 'support@company.com',
  receivedAt: '2025-08-06T14:30:00Z'
}, 'Job', 'job-123');

// Get email threads for a job
const threads = await emailManager.getEmailThreads('Job', 'job-123');
console.log(`Found ${threads.length} email threads for this job`);
```

## Advanced Queries

### Multi-Type Queries

Query across multiple polymorphic types simultaneously:

```typescript
// src/lib/queries/cross-polymorphic.ts
import { 
  createPolymorphicQuery,
  executeCachedQueries 
} from '@/lib/zero/polymorphic';

export async function getEntityActivitySummary(entityType: string, entityId: string) {
  // Execute multiple polymorphic queries in parallel
  const queries = [
    {
      key: 'logs',
      query: createLoggableQuery({
        targetTypes: [entityType.toLowerCase() + 's'],
        conditions: {
          loggable_id: entityId,
          loggable_type: entityType
        },
        orderBy: 'created_at DESC',
        limit: 10
      })
    },
    {
      key: 'notes',  
      query: createNotableQuery({
        targetTypes: [entityType.toLowerCase() + 's'],
        conditions: {
          notable_id: entityId,
          notable_type: entityType
        },
        orderBy: 'created_at DESC',
        limit: 5
      })
    },
    {
      key: 'schedules',
      query: createSchedulableQuery({
        targetTypes: [entityType.toLowerCase() + 's'],
        conditions: {
          schedulable_id: entityId,
          schedulable_type: entityType
        },
        orderBy: 'scheduled_at DESC',
        limit: 5
      })
    }
  ];

  const results = await executeCachedQueries(queries, {
    cachePrefix: `entity-summary-${entityType}-${entityId}`,
    ttl: 300 // 5 minutes
  });

  return {
    activityLogs: results.logs.data,
    notes: results.notes.data,
    schedules: results.schedules.data,
    summary: {
      totalLogs: results.logs.metadata.total,
      totalNotes: results.notes.metadata.total,
      totalSchedules: results.schedules.metadata.total
    }
  };
}
```

### Reactive Queries

Create reactive queries that automatically update:

```typescript
// src/lib/stores/reactive-polymorphic.ts
import { 
  createReactiveLoggableQuery,
  createReactiveNotableQuery 
} from '@/lib/zero/polymorphic';

export function createEntityActivityStore(entityType: string, entityId: string) {
  // Create reactive queries
  const activityLogsQuery = createReactiveLoggableQuery({
    targetTypes: [entityType.toLowerCase() + 's'],
    conditions: {
      loggable_id: entityId,
      loggable_type: entityType
    },
    orderBy: 'created_at DESC',
    limit: 20,
    autoRefresh: true,
    refreshInterval: 30000 // 30 seconds
  });

  const notesQuery = createReactiveNotableQuery({
    targetTypes: [entityType.toLowerCase() + 's'],
    conditions: {
      notable_id: entityId,
      notable_type: entityType
    },
    orderBy: 'created_at DESC',
    autoRefresh: true,
    refreshInterval: 60000 // 1 minute
  });

  return {
    activityLogs: activityLogsQuery,
    notes: notesQuery,
    
    // Cleanup method
    cleanup() {
      activityLogsQuery.cleanup();
      notesQuery.cleanup();
    }
  };
}
```

## Integration with Svelte Components

### Activity Log Component

```svelte
<!-- src/lib/components/polymorphic/ActivityLogList.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createReactiveLoggableQuery } from '@/lib/zero/polymorphic';
  import type { PolymorphicQueryResult } from '@/lib/zero/polymorphic';

  export let entityType: string;
  export let entityId: string;
  export let limit: number = 10;

  let activityLogs: any[] = [];
  let loading = true;
  let error: string | null = null;

  // Create reactive query
  const query = createReactiveLoggableQuery({
    targetTypes: [entityType.toLowerCase() + 's'],
    conditions: {
      loggable_id: entityId,
      loggable_type: entityType
    },
    orderBy: 'created_at DESC',
    limit,
    eagerLoad: ['user'],
    autoRefresh: true
  });

  // Subscribe to query updates
  const unsubscribe = query.subscribe((result: PolymorphicQueryResult) => {
    activityLogs = result.data;
    loading = false;
    error = null;
  });

  // Handle errors
  query.onError((err: Error) => {
    error = err.message;
    loading = false;
  });

  onDestroy(() => {
    unsubscribe();
    query.cleanup();
  });

  function formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
  }

  function getActionIcon(action: string): string {
    const iconMap = {
      'created': '✨',
      'updated': '📝',
      'deleted': '🗑️',
      'status_changed': '🔄',
      'assigned': '👤',
      'completed': '✅'
    };
    return iconMap[action] || '📋';
  }
</script>

<div class="activity-log-list">
  <h3>Recent Activity</h3>
  
  {#if loading}
    <div class="loading">Loading activity logs...</div>
  {:else if error}
    <div class="error">Error loading activity logs: {error}</div>
  {:else if activityLogs.length === 0}
    <div class="empty">No activity logs found</div>
  {:else}
    <ul class="activity-items">
      {#each activityLogs as log}
        <li class="activity-item">
          <div class="activity-icon">
            {getActionIcon(log.action)}
          </div>
          <div class="activity-content">
            <div class="activity-header">
              <span class="activity-action">{log.action.replace('_', ' ')}</span>
              <span class="activity-user">{log.user?.name || 'Unknown User'}</span>
              <span class="activity-time">{formatTimestamp(log.created_at)}</span>
            </div>
            {#if log.details}
              <div class="activity-details">
                {JSON.stringify(log.details, null, 2)}
              </div>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .activity-log-list {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 16px;
    background: white;
  }

  .activity-items {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .activity-item {
    display: flex;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid #f0f0f0;
  }

  .activity-item:last-child {
    border-bottom: none;
  }

  .activity-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .activity-content {
    flex: 1;
  }

  .activity-header {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 4px;
  }

  .activity-action {
    font-weight: 600;
    text-transform: capitalize;
  }

  .activity-user {
    color: #666;
    font-size: 0.9em;
  }

  .activity-time {
    color: #999;
    font-size: 0.8em;
    margin-left: auto;
  }

  .activity-details {
    font-size: 0.9em;
    color: #666;
    background: #f5f5f5;
    padding: 8px;
    border-radius: 4px;
    font-family: monospace;
    white-space: pre-wrap;
  }

  .loading, .error, .empty {
    text-align: center;
    padding: 20px;
    color: #666;
  }

  .error {
    color: #d32f2f;
  }
</style>
```

### Note Management Component

```svelte
<!-- src/lib/components/polymorphic/NoteManager.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createReactiveNotableQuery } from '@/lib/zero/polymorphic';
  import { NoteManager } from '@/lib/services/note-manager';

  export let entityType: string;
  export let entityId: string;

  let notes: any[] = [];
  let loading = true;
  let newNoteContent = '';
  let isAddingNote = false;

  const noteManager = new NoteManager();

  // Create reactive query for notes
  const notesQuery = createReactiveNotableQuery({
    targetTypes: [entityType.toLowerCase() + 's'],
    conditions: {
      notable_id: entityId,
      notable_type: entityType
    },
    orderBy: 'created_at DESC',
    eagerLoad: ['user'],
    autoRefresh: true
  });

  // Subscribe to notes updates
  const unsubscribe = notesQuery.subscribe((result) => {
    notes = result.data;
    loading = false;
  });

  onDestroy(() => {
    unsubscribe();
    notesQuery.cleanup();
  });

  async function addNote() {
    if (!newNoteContent.trim() || isAddingNote) return;

    isAddingNote = true;
    try {
      await noteManager.createNote({
        entityType,
        entityId,
        content: newNoteContent.trim(),
        userId: getCurrentUserId() // Implement this function
      });
      
      newNoteContent = '';
      // The reactive query will automatically update the list
    } catch (error) {
      alert('Failed to add note: ' + error.message);
    } finally {
      isAddingNote = false;
    }
  }

  async function deleteNote(noteId: string) {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      await noteManager.deleteNote(noteId, getCurrentUserId());
      // The reactive query will automatically update the list
    } catch (error) {
      alert('Failed to delete note: ' + error.message);
    }
  }

  function getCurrentUserId(): string {
    // Implement user ID retrieval
    return 'current-user-id';
  }

  function formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
  }
</script>

<div class="note-manager">
  <h3>Notes</h3>
  
  <!-- Add new note -->
  <div class="add-note">
    <textarea
      bind:value={newNoteContent}
      placeholder="Add a note..."
      rows="3"
      disabled={isAddingNote}
    ></textarea>
    <button
      on:click={addNote}
      disabled={!newNoteContent.trim() || isAddingNote}
    >
      {isAddingNote ? 'Adding...' : 'Add Note'}
    </button>
  </div>

  <!-- Notes list -->
  {#if loading}
    <div class="loading">Loading notes...</div>
  {:else if notes.length === 0}
    <div class="empty">No notes yet</div>
  {:else}
    <div class="notes-list">
      {#each notes as note}
        <div class="note">
          <div class="note-header">
            <span class="note-author">{note.user?.name || 'Unknown User'}</span>
            <span class="note-time">{formatTimestamp(note.created_at)}</span>
            {#if note.user_id === getCurrentUserId()}
              <button 
                class="delete-btn"
                on:click={() => deleteNote(note.id)}
              >
                Delete
              </button>
            {/if}
          </div>
          <div class="note-content">
            {note.content}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .note-manager {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 16px;
    background: white;
  }

  .add-note {
    margin-bottom: 16px;
  }

  .add-note textarea {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    resize: vertical;
    font-family: inherit;
  }

  .add-note button {
    margin-top: 8px;
    padding: 8px 16px;
    background: #2196f3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .add-note button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .notes-list {
    space-y: 12px;
  }

  .note {
    border: 1px solid #eee;
    border-radius: 4px;
    padding: 12px;
    background: #fafafa;
    margin-bottom: 12px;
  }

  .note-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 0.9em;
    color: #666;
  }

  .note-author {
    font-weight: 600;
  }

  .delete-btn {
    background: #f44336;
    color: white;
    border: none;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.8em;
  }

  .note-content {
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .loading, .empty {
    text-align: center;
    padding: 20px;
    color: #666;
  }
</style>
```

## Performance Optimization

### Query Caching

```typescript
// src/lib/services/polymorphic-cache.ts
import { 
  executeCachedQuery,
  warmPolymorphicCache,
  polymorphicQueryCache 
} from '@/lib/zero/polymorphic';

export class PolymorphicCacheManager {
  async preloadCommonQueries() {
    // Warm cache for frequently accessed queries
    await warmPolymorphicCache([
      {
        type: 'loggable',
        targetTypes: ['jobs', 'tasks'],
        cacheKey: 'recent-activity',
        conditions: {
          created_at: { gte: this.getRecentDate(7) }
        }
      },
      {
        type: 'notable',
        targetTypes: ['jobs', 'clients'],
        cacheKey: 'recent-notes',
        conditions: {
          created_at: { gte: this.getRecentDate(3) }
        }
      }
    ]);
  }

  async getCachedActivityLogs(entityType: string, entityId: string) {
    return executeCachedQuery('loggable', {
      targetTypes: [entityType.toLowerCase() + 's'],
      conditions: {
        loggable_id: entityId,
        loggable_type: entityType
      },
      orderBy: 'created_at DESC',
      limit: 10,
      cacheKey: `activity-${entityType}-${entityId}`,
      ttl: 300 // 5 minutes
    });
  }

  private getRecentDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  }

  // Clear specific cache entries
  clearEntityCache(entityType: string, entityId: string) {
    const patterns = [
      `activity-${entityType}-${entityId}`,
      `notes-${entityType}-${entityId}`,
      `schedules-${entityType}-${entityId}`
    ];

    patterns.forEach(pattern => {
      polymorphicQueryCache.invalidate(pattern);
    });
  }

  // Clear all polymorphic cache
  clearAllCache() {
    polymorphicQueryCache.clear();
  }
}
```

### Batch Operations

```typescript
// src/lib/services/batch-polymorphic.ts
import { 
  executeCachedQueries,
  createLoggableQuery,
  createNotableQuery 
} from '@/lib/zero/polymorphic';

export async function batchLoadEntityData(entities: Array<{
  type: string;
  id: string;
}>) {
  // Create queries for all entities
  const queries = entities.flatMap(entity => [
    {
      key: `logs-${entity.type}-${entity.id}`,
      query: createLoggableQuery({
        targetTypes: [entity.type.toLowerCase() + 's'],
        conditions: {
          loggable_id: entity.id,
          loggable_type: entity.type
        },
        limit: 5
      })
    },
    {
      key: `notes-${entity.type}-${entity.id}`,
      query: createNotableQuery({
        targetTypes: [entity.type.toLowerCase() + 's'],
        conditions: {
          notable_id: entity.id,
          notable_type: entity.type
        },
        limit: 3
      })
    }
  ]);

  // Execute all queries in parallel with caching
  const results = await executeCachedQueries(queries, {
    cachePrefix: 'batch-entity-data',
    ttl: 180 // 3 minutes
  });

  // Organize results by entity
  const entityData: { [key: string]: any } = {};
  
  entities.forEach(entity => {
    const key = `${entity.type}-${entity.id}`;
    entityData[key] = {
      entity,
      logs: results[`logs-${entity.type}-${entity.id}`].data,
      notes: results[`notes-${entity.type}-${entity.id}`].data
    };
  });

  return entityData;
}
```

This comprehensive examples guide provides real-world usage patterns for all aspects of the Polymorphic Tracking System. The examples show how to integrate the system with your existing BOS frontend codebase, including Svelte components, service layers, and performance optimization strategies.