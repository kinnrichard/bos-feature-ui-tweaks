# TypeScript Model Default Values

This document describes how default values from Rails schema.rb are automatically converted and applied to TypeScript models in the BOS project.

## Overview

The unified default system ensures that TypeScript models have the same default values as defined in the database schema, maintaining consistency across the full stack. Default values are extracted from Rails schema.rb during model generation and automatically applied when creating new records via ActiveRecord.

## How It Works

### 1. Schema Extraction
The `RailsSchemaIntrospector` extracts default values from each column definition in the database schema. It categorizes defaults into types like:
- String literals (e.g., `"open"`, `"normal"`)
- Numeric literals (e.g., `0`, `1`)
- Boolean literals (e.g., `true`, `false`)
- Runtime functions (e.g., `gen_random_uuid()`, `CURRENT_TIMESTAMP`)

### 2. Value Conversion
The `DefaultValueConverter` service converts Rails default values to TypeScript-safe equivalents:

| Rails Type | Rails Default | TypeScript Output |
|------------|---------------|-------------------|
| string | `"open"` | `'open'` |
| integer | `0` | `0` |
| boolean | `false` | `false` |
| boolean | `true` | `true` |
| string | `"it's open"` | `'it\'s open'` (escaped) |
| uuid | `gen_random_uuid()` | `null` (handled by database) |
| datetime | `CURRENT_TIMESTAMP` | `null` (handled by database) |
| json | `{}` | `{}` |
| json | `[]` | `[]` |

### 3. Code Generation
During model generation, defaults are included in the generated TypeScript files:

```typescript
// Example: Task model with defaults
const TaskDefaults: Partial<CreateTaskData> = {
  applies_to_all_targets: true,
  lock_version: 0,
  position_finalized: false,
  repositioned_to_top: false,
  subtasks_count: 0,
};

const TaskConfig = {
  tableName: 'tasks',
  className: 'Task',
  primaryKey: 'id',
  supportsDiscard: true,
  defaults: TaskDefaults,
};

export const Task = createActiveRecord<TaskData>(TaskConfig);
```

### 4. Runtime Application
When creating new records, defaults are automatically applied:

```typescript
// Creating a task without specifying all fields
const task = await Task.create({
  title: 'New Task',
  job_id: jobId,
});

// The created task will have these default values:
// {
//   title: 'New Task',
//   job_id: jobId,
//   applies_to_all_targets: true,    // from defaults
//   lock_version: 0,                  // from defaults
//   position_finalized: false,        // from defaults
//   repositioned_to_top: false,       // from defaults
//   subtasks_count: 0,                // from defaults
//   id: '...uuid...',                 // generated
//   created_at: timestamp,            // generated
//   updated_at: timestamp,            // generated
// }
```

## Default Value Rules

### Values That Convert to TypeScript Defaults
- **Literal values**: Strings, numbers, booleans
- **Empty collections**: `{}` for JSON objects, `[]` for JSON arrays
- **Enum defaults**: String values for Rails enums

### Values Handled by the Database
These are not included in TypeScript defaults as they're generated at the database level:
- **UUID functions**: `gen_random_uuid()`, `uuid_generate_v4()`
- **Timestamp functions**: `CURRENT_TIMESTAMP`, `now()`
- **Complex expressions**: Any SQL functions or expressions

### Important Notes

1. **ReactiveRecord is Read-Only**: Default values only apply to ActiveRecord (for mutations). ReactiveRecord is used exclusively for reactive queries in Svelte components and doesn't perform create/update operations.

2. **Override Behavior**: Explicitly provided values always override defaults:
   ```typescript
   const task = await Task.create({
     title: 'Task',
     lock_version: 5,  // Overrides default of 0
   });
   ```

3. **Type Safety**: All defaults are type-checked against the model's CreateData interface to ensure type safety.

## Regenerating Models

To regenerate models with updated defaults:

```bash
# Regenerate all models
rails generate zero:active_models

# Regenerate specific table
rails generate zero:active_models --table tasks
```

## Testing Defaults

Defaults are tested at multiple levels:

1. **Unit Tests**: `test/lib/generators/zero/active_models/default_value_converter_test.rb`
2. **Integration Tests**: Actual model generation with real schema
3. **TypeScript Tests**: `frontend/src/lib/models/__tests__/default-values.test.ts`

## Troubleshooting

### Defaults Not Applied
- Ensure the model was regenerated after schema changes
- Check that the default value is a literal (not a function)
- Verify the DefaultValueConverter supports the column type

### Type Errors
- Regenerate models if schema types have changed
- Check that default values match the column type

### Missing Defaults
- Database functions (UUID, timestamps) are intentionally excluded
- Complex SQL expressions cannot be converted to TypeScript