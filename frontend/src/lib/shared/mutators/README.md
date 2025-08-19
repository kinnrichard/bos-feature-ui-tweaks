# Custom Mutator System

This directory contains the custom mutator system that provides automatic data transformations and audit logging for the bŏs application.

## Overview

The mutator system provides two main capabilities:

1. **Positioning** - Automatic position assignment with offline conflict resolution (for tasks)
2. **Activity Logging** - Comprehensive audit trails for all data changes with user attribution

## Architecture

### Model Mutator Pipelines

Each model has a specific mutator pipeline that runs in sequence:

```typescript
// Task pipeline: Positioning → Activity Logging
taskMutatorPipeline

// Job pipeline: Activity Logging
jobMutatorPipeline

// Client pipeline: Activity Logging
clientMutatorPipeline
```

### Integration with ActiveRecord

The mutator system integrates transparently with ActiveRecord operations:

```typescript
// This automatically applies the task mutator pipeline
const task = await Task.create({
  title: 'New Task',
  job_id: 'job-123'
});

// Result includes:
// - position: automatically assigned
// - Activity log entry created with user attribution
```

## Activity Logging

### Automatic Logging

Activity logging happens automatically for all CRUD operations:

- **Create**: Logs "created" action
- **Update**: Logs specific actions based on what changed:
  - Status changes → "status_changed" 
  - Name/title changes → "renamed"
  - Assignment changes → "assigned"/"unassigned"
  - Other updates → "updated"
- **Delete/Discard**: Logs "deleted"/"discarded"

### Change Tracking

For updates, the system automatically tracks what fields changed:

```typescript
// Original task: { title: "Old Title", status: "pending" }
// Updated to: { title: "New Title", status: "completed" }

// Activity log includes:
{
  action: "status_changed",
  metadata: {
    changes: {
      title: ["Old Title", "New Title"],
      status: ["pending", "completed"] 
    },
    old_status: "pending",
    new_status: "completed",
    new_status_label: "Completed"
  }
}
```

### Custom Activity Logging

For custom activities not tied to CRUD operations:

```typescript
import { logCustomActivity } from './mutators/activity-logging';

await logCustomActivity(
  'Job',           // Model type
  'job-123',       // Record ID
  'viewed',        // Action
  { page: 'details' }, // Metadata
  { userId: 'user-456' } // Options
);
```

## Positioning

### Automatic Positioning

- **Create**: Assigns next available position in scope
- **Update**: Preserves existing position unless explicitly changed
- **Scoped**: Positions are scoped by configured fields (e.g., tasks scoped by `job_id`)

### Offline Support

- **Offline**: Uses incremental counters (1, 2, 3...)
- **Online**: Uses timestamps to avoid conflicts
- **Conflict Resolution**: Server-side resolution handles conflicts when coming back online

### Manual Positioning

```typescript
import { TaskPositionManager } from './mutators/positioning';

// Move task to specific position
const updateData = TaskPositionManager.moveTo(5);
await Task.update(taskId, updateData);

// Move to top
const topData = TaskPositionManager.moveToTop();
await Task.update(taskId, topData);
```

## Configuration

### Model Configuration

Models are configured in `model-mutators.ts`:

```typescript
export const MODEL_MUTATORS: Record<string, MutatorFunction<any>> = {
  tasks: taskMutatorPipeline,
  jobs: jobMutatorPipeline,
  clients: clientMutatorPipeline,
  // ... other models
};
```

### Custom Model Mutators

To add a custom mutator for a new model:

```typescript
import { registerModelMutator } from './model-mutators';
import { createActivityLoggingMutator } from './activity-logging';

const customMutator = async (data, context) => {
  // Apply custom logic
  if (context.action === 'create') {
    data.custom_field = 'default_value';
  }
  
  // Apply activity logging
  const activityMutator = createActivityLoggingMutator({
    loggableType: 'CustomModel'
  });
  const result = await activityMutator(data, context);
  
  return result;
};

registerModelMutator('custom_models', customMutator);
```

## Testing

### Test Environment

Activity logging is automatically skipped in test environments by setting:

```typescript
const context: MutatorContext = {
  environment: 'test',
  skipActivityLogging: true
};
```

### Running Tests

```bash
# Run all mutator tests
npm run test:vitest:run src/lib/shared/mutators/__tests__/

# Run specific test
npm run test:vitest:run src/lib/shared/mutators/__tests__/integration-demo.test.ts
```

## Rails Integration

The frontend activity logging integrates with the existing Rails `Loggable` concern:

### Rails Side (Already Implemented)
- `ActivityLog` model with polymorphic associations
- `Loggable` concern for automatic logging
- Human-readable message generation
- Emoji and status label support

### Frontend Side (This Implementation)
- TypeScript mutators that create activity log entries
- Integration with Zero.js for real-time sync
- Change tracking and metadata generation
- Offline-capable logging

## Performance Considerations

- **Async Logging**: Activity logging runs asynchronously and won't block CRUD operations
- **Error Handling**: Logging failures don't affect the main operation
- **Batching**: Multiple mutators run in sequence efficiently
- **Offline Support**: Logs are queued and sync when connection is restored

## Troubleshooting

### Common Issues

1. **No Activity Logs Created**
   - Check that `getCurrentUser()` returns a valid user
   - Verify the user is authenticated
   - Ensure `skipActivityLogging` is not set to `true`

2. **Missing Change Tracking**
   - Verify `trackChanges: true` is set for updates
   - Check that original data is passed to `executeMutatorWithTracking`

3. **Positioning Not Working**
   - Verify the model uses positioning mutator
   - Check scope configuration (e.g., tasks need `job_id`)
   - Ensure offline/online context is correct

### Debug Logging

Enable debug logging to see mutator execution:

```typescript
// In browser console
localStorage.setItem('DEBUG', 'bos:mutators');
```

## Migration from Rails Loggable

If migrating from Rails-only logging:

1. **Existing Logs**: All existing activity logs remain unchanged
2. **Dual Logging**: Frontend and Rails can log activities simultaneously
3. **Consistent Format**: Frontend logs use the same format as Rails logs
4. **Zero.js Sync**: All logs sync in real-time via Zero.js