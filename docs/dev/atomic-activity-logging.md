# Atomic Activity Logging with Zero.js mutateBatch

## Overview

This document describes the atomic activity logging system implemented in EP-0013, which migrates all activity logging from separate transactions to atomic mutateBatch operations. This resolves foreign key constraint violations and race conditions between parent record creation and activity log creation.

## Problem Statement

Previously, when creating records with activity logging, the system would:
1. Insert the parent record (e.g., Job)
2. Insert the activity log in a separate mutation

This caused intermittent foreign key constraint violations when the activity log insert reached PostgreSQL before the parent record, especially during offline/online sync operations.

## Solution Architecture

### 1. Rails Generator Detection

The Rails generator now automatically detects models that include the `Loggable` concern:

```ruby
# lib/generators/zero/active_models/generation_coordinator.rb
def detect_loggable_models
  loggable_models = {}
  
  Rails.application.eager_load!
  ApplicationRecord.descendants.each do |model|
    next unless model.included_modules.include?(Loggable)
    
    loggable_models[model.table_name] = {
      modelName: model.name,
      includesLoggable: true
    }
  end
  
  loggable_models
end
```

### 2. Generated TypeScript Configuration

The generator creates a TypeScript configuration file mapping all Loggable models:

```typescript
// frontend/src/lib/models/generated-loggable-config.ts
export const LOGGABLE_MODELS = {
  'clients': { modelName: 'Client', includesLoggable: true },
  'devices': { modelName: 'Device', includesLoggable: true },
  'jobs': { modelName: 'Job', includesLoggable: true },
  'people': { modelName: 'Person', includesLoggable: true },
  'scheduled_date_times': { modelName: 'ScheduledDateTime', includesLoggable: true },
  'tasks': { modelName: 'Task', includesLoggable: true },
  'users': { modelName: 'User', includesLoggable: true }
} as const;

export function isLoggableModel(tableName: string): tableName is LoggableModelName {
  return tableName in LOGGABLE_MODELS;
}
```

### 3. Activity Logging Mutator Changes

The activity logging mutator now stores data in context instead of creating records directly:

```typescript
// frontend/src/lib/shared/mutators/activity-logging.ts
async function logActivity(
  data: Loggable,
  context: MutatorContext,
  config: ActivityLoggingConfig,
  currentUser: any
): Promise<void> {
  // ... determine action and metadata ...
  
  // Store activity log data in context for batch creation
  context.pendingActivityLog = {
    user_id: currentUser.id,
    action,
    loggable_type: config.loggableType,
    loggable_id: data.id || '',
    metadata,
    client_id: clientId,
    job_id: jobId
  };
  
  // DO NOT create activity log here - let ActiveRecord handle it atomically
}
```

### 4. ActiveRecord mutateBatch Implementation

ActiveRecord now uses mutateBatch for atomic operations when creating Loggable models:

```typescript
// frontend/src/lib/models/base/active-record.ts
async create(data: CreateData<T>): Promise<T> {
  // ... process data through mutators ...
  
  // Check if this model needs activity logging
  const needsActivityLog = await this.isLoggableModel() && context.pendingActivityLog;

  if (needsActivityLog && context.pendingActivityLog) {
    // Use mutateBatch for atomic operation
    await zero.mutateBatch(async (tx) => {
      // Insert the main record
      await tx[this.config.tableName].insert(mutatedData);
      
      // Insert activity log in same transaction
      const activityLogData = {
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
        ...context.pendingActivityLog,
        loggable_id: id // Use the parent record's ID
      };
      
      await tx.activity_logs.insert(activityLogData);
    });
  } else {
    // Regular insert for non-loggable models
    await zero.mutate[this.config.tableName].insert(mutatedData);
  }
}
```

## Benefits

### 1. Atomic Operations
- Parent record and activity log are created in a single transaction
- All-or-nothing semantics prevent partial state

### 2. Foreign Key Integrity
- Activity log always references an existing parent record
- No more constraint violations during sync

### 3. Improved Reliability
- Consistent behavior in online and offline modes
- Proper rollback on any failure

### 4. Automatic Configuration
- Rails generator detects Loggable models automatically
- No manual TypeScript configuration needed

## Migration Guide

### For New Models

1. Include the `Loggable` concern in your Rails model:
```ruby
class NewModel < ApplicationRecord
  include Loggable
  # ... rest of model
end
```

2. Run the generator to update TypeScript configuration:
```bash
rails generate zero:active_models
```

3. The model will automatically use atomic activity logging

### For Existing Code

No changes needed! The system is backward compatible:
- Existing models with Loggable concern automatically use mutateBatch
- Activity logging mutators continue to work as before
- The context-based approach is transparent to calling code

## Testing

### Unit Tests
```typescript
// Test atomic creation
it('should use mutateBatch for creating Jobs with activity logs', async () => {
  const job = await Job.create({ title: 'Test Job', client_id: 'client-123' });
  
  expect(mockMutateBatch).toHaveBeenCalledTimes(1);
  // Verify both inserts happened in the batch
});
```

### Integration Tests
```typescript
// Test offline/online sync
it('should maintain atomicity during offline operations', async () => {
  Object.defineProperty(navigator, 'onLine', { value: false });
  
  const job = await Job.create({ title: 'Offline Job' });
  
  // Verify batch operation was used even offline
  expect(mockMutateBatch).toHaveBeenCalledTimes(1);
});
```

## Performance Considerations

### Positive Impacts
- Single transaction instead of two separate mutations
- Reduced chance of sync conflicts
- Better consistency guarantees

### Considerations
- Slightly larger transaction size
- All-or-nothing means activity log failures block parent creation
- Consider separate error handling for non-critical activity logs

## Error Handling

### Transaction Failures
When mutateBatch fails, the entire transaction is rolled back:
```typescript
try {
  await tx.activity_logs.insert(activityLogData);
} catch (activityLogError) {
  // In mutateBatch, this will rollback the entire transaction
  throw activityLogError;
}
```

### Future Enhancement: Graceful Degradation
For non-critical activity logging, consider post-creation logging:
```typescript
// Create parent record first
await zero.mutate[tableName].insert(data);

// Try to create activity log separately (non-atomic)
try {
  await ActivityLog.create(activityLogData);
} catch (error) {
  console.warn('Activity log creation failed:', error);
  // Parent record still exists
}
```

## Monitoring

Monitor for:
- Foreign key constraint violations (should be eliminated)
- Activity log creation failures
- Transaction rollback frequency
- Sync performance metrics

## Future Improvements

1. **Update Operations**: Extend mutateBatch to update operations
2. **Bulk Operations**: Support batch activity logging for bulk creates
3. **Async Activity Logging**: Option for eventual consistency where appropriate
4. **Activity Log Queuing**: Background job processing for non-critical logs

## Conclusion

The atomic activity logging system provides a robust solution to foreign key constraint violations while maintaining comprehensive audit trails. By leveraging Zero.js mutateBatch, we ensure data consistency across online and offline operations, improving the reliability of the entire system.