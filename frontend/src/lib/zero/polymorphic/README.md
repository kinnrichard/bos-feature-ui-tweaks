# Polymorphic Tracking System

A comprehensive polymorphic relationship tracking system for the BOS frontend, designed to replace hardcoded polymorphic relationships with a dynamic, configurable system.

## Overview

The polymorphic tracking system manages dynamic polymorphic associations like:
- **notable**: Notes belong to jobs, tasks, clients
- **loggable**: Activity logs track changes to multiple models 
- **schedulable**: Scheduled date times belong to jobs, tasks
- **target**: Job targets reference clients, people, people groups
- **parseable**: Parsed emails belong to jobs, tasks

## Architecture

### Core Components

1. **PolymorphicTracker** (`tracker.ts`) - Core tracking class
   - Loads/saves configuration from JSON
   - Manages polymorphic type discovery and validation
   - Provides methods to get valid types for associations

2. **PolymorphicRegistry** (`registry.ts`) - Integration with RelationshipRegistry
   - Registers polymorphic relationships
   - Tracks which models can be targets
   - Integrates with existing RelationshipRegistry infrastructure

3. **PolymorphicDiscovery** (`discovery.ts`) - Auto-discovery utilities
   - Scans hardcoded schema for polymorphic patterns
   - Discovers relationships from naming conventions
   - Converts existing hardcoded relationships to configuration

4. **Utilities** (`utils.ts`) - Helper functions
   - Type conversion (snake_case ↔ PascalCase)
   - Relationship name generation
   - Validation utilities
   - Configuration management

## Usage

### Basic Setup

```typescript
import { initializePolymorphicSystem, getPolymorphicTracker } from './polymorphic';

// Initialize the system
await initializePolymorphicSystem();

// Get valid targets for a polymorphic type
const tracker = getPolymorphicTracker();
const validTargets = tracker.getValidTargets('loggable');
// Returns: ['jobs', 'tasks', 'clients', 'users', 'people']
```

### Adding New Targets

```typescript
const tracker = getPolymorphicTracker();

// Add a new valid target for loggable relationships
await tracker.addTarget('loggable', 'projects', 'Project', {
  source: 'manual'
});
```

### Registry Integration

```typescript
import { getPolymorphicRegistry } from './polymorphic';

const registry = getPolymorphicRegistry();

// Register polymorphic target relationships for activity_logs
registry.registerPolymorphicTargetRelationships(
  'activity_logs',
  'loggable',
  'loggable_id',
  'loggable_type'
);
// Creates: loggableJob, loggableTask, loggableClient, etc.
```

### Auto-Discovery

```typescript
import { autoDiscoverAndConfigure } from './polymorphic';

// Automatically discover and configure from existing schema
await autoDiscoverAndConfigure({
  autoDiscover: true,
  source: 'auto-discovery'
});
```

## Configuration

### JSON Format

Configuration is stored in JSON format (`config.json`) with this structure:

```json
{
  "associations": {
    "loggable": {
      "type": "loggable",
      "description": "Activity logs track changes to various models",
      "validTargets": {
        "jobs": {
          "modelName": "Job",
          "tableName": "jobs",
          "discoveredAt": "2025-08-06T00:00:00.000Z",
          "lastVerifiedAt": "2025-08-06T00:00:00.000Z",
          "active": true,
          "source": "generated-schema"
        }
      },
      "metadata": {
        "createdAt": "2025-08-06T00:00:00.000Z",
        "updatedAt": "2025-08-06T00:00:00.000Z",
        "configVersion": "1.0.0",
        "generatedBy": "PolymorphicTracker"
      }
    }
  },
  "metadata": {
    "totalAssociations": 5,
    "totalTargets": 20,
    "configVersion": "1.0.0"
  }
}
```

### Field Patterns

Each polymorphic type follows standard Rails conventions:

| Type | ID Field | Type Field |
|------|----------|------------|
| notable | `notable_id` | `notable_type` |
| loggable | `loggable_id` | `loggable_type` |
| schedulable | `schedulable_id` | `schedulable_type` |
| target | `target_id` | `target_type` |
| parseable | `parseable_id` | `parseable_type` |

## Integration with Existing System

### RelationshipRegistry

The polymorphic system integrates seamlessly with the existing RelationshipRegistry:

```typescript
// Existing pattern
registerModelRelationships('activity_logs', {
  user: { type: 'belongsTo', model: 'User' },
  // Polymorphic relationships are handled automatically
});

// Enhanced pattern
registerModelRelationshipsWithPolymorphic('activity_logs', {
  user: { type: 'belongsTo', model: 'User' },
  loggable: {
    type: 'belongsTo',
    model: 'Polymorphic',
    polymorphic: true,
    polymorphicType: 'loggable',
    polymorphicIdField: 'loggable_id',
    polymorphicTypeField: 'loggable_type',
    validTargets: ['jobs', 'tasks', 'clients']
  }
});
```

### Zero.js Schema Generation

The system can generate Zero.js relationships from polymorphic configuration:

```typescript
import { IntegrationUtils } from './polymorphic';

// Generate Zero.js relationships for loggable type
const relationships = IntegrationUtils.generateZeroJsRelationships(
  'loggable',
  'activity_logs'
);
// Returns: { loggableJob: {...}, loggableTask: {...}, ... }
```

## Migration Path

### From Hardcoded to Dynamic

1. **Analyze existing relationships** in `generated-schema.ts`
2. **Extract polymorphic patterns** using discovery utilities
3. **Generate configuration** from discovered patterns
4. **Replace hardcoded relationships** with dynamic generation
5. **Update model registrations** to use polymorphic registry

### Example Migration

```typescript
// Before: Hardcoded in generated-schema.ts
const activity_logsRelationships = relationships(activity_logs, ({ one }) => ({
  loggableJob: one({
    sourceField: ['loggable_id'],
    destField: ['id'],
    destSchema: jobs,
  }),
  loggableTask: one({
    sourceField: ['loggable_id'],
    destField: ['id'],
    destSchema: tasks,
  }),
  // ... more hardcoded relationships
}));

// After: Dynamic generation
const activity_logsRelationships = relationships(activity_logs, ({ one }) => ({
  user: one({
    sourceField: ['user_id'],
    destField: ['id'],
    destSchema: users,
  }),
  ...IntegrationUtils.generateZeroJsRelationships('loggable', 'activity_logs')
}));
```

## Benefits

1. **Maintainability**: No more manual updates when adding new polymorphic targets
2. **Consistency**: Standardized naming and field patterns
3. **Flexibility**: Easy to add/remove targets or entire polymorphic types
4. **Type Safety**: Full TypeScript support with validation
5. **Integration**: Seamless integration with existing RelationshipRegistry
6. **Discovery**: Automatic detection of polymorphic patterns
7. **Tracking**: Metadata and timestamps for all changes

## Future Enhancements

- Schema validation against database
- Runtime relationship discovery
- Performance optimizations with caching
- Migration utilities for existing codebases
- Admin interface for configuration management