# Epic: Unified Default System for TypeScript Models

## Epic ID: EP-0012

## Title
Implement Unified Default System for ActiveRecord and ReactiveRecord TypeScript Models

## Status
Complete

## Priority
High

## Overview
Implement a comprehensive system to automatically extract default values from Rails schema.rb and apply them to both ActiveRecord and ReactiveRecord TypeScript models. This ensures frontend objects have the same default values as defined in the database schema, maintaining consistency across the full stack.

## Business Value
- **Consistency**: Frontend models automatically match database defaults
- **Developer Efficiency**: Eliminates manual synchronization of default values
- **Reduced Bugs**: Prevents mismatches between frontend and backend defaults
- **Type Safety**: Compile-time verification of default values
- **Maintainability**: Single source of truth from schema.rb

## Technical Approach

### 1. Default Value Extraction
- Enhance RailsSchemaIntrospector to properly categorize default types
- Parse and classify defaults: literals, functions, expressions
- Handle PostgreSQL-specific defaults (gen_random_uuid, CURRENT_TIMESTAMP)

### 2. Default Value Converter Service
Create a new service to handle Rails → TypeScript conversion:
```ruby
module Zero
  module Generators
    class DefaultValueConverter
      # Convert Rails defaults to TypeScript equivalents
      # Handle type safety and null/undefined cases
    end
  end
end
```

### 3. Template Enhancement
Modify both active_model.ts.erb and reactive_model.ts.erb templates to include:
```typescript
const <%= class_name %>Defaults: Partial<Create<%= class_name %>Data> = {
  <%= default_values_section %>
};
```

### 4. Base Class Updates
Enhance both createActiveRecord and createReactiveRecord to accept and apply defaults:
```typescript
export function createActiveRecord<T>(config: ActiveRecordConfig & { defaults?: Partial<T> }) {
  // Apply defaults during create operations
}
```

## Acceptance Criteria
1. ✅ Default values from schema.rb are automatically extracted during generation
2. ✅ Both ActiveRecord and ReactiveRecord models receive the same defaults
3. ✅ Complex defaults (UUID generation, timestamps) are properly converted
4. ✅ Type safety is maintained with proper TypeScript types
5. ✅ Defaults are applied during model.create() operations
6. ✅ Generated code passes all linting and type checking
7. ✅ Comprehensive tests cover all default value scenarios

## Implementation Stories

### Story 1: Create Default Value Converter Service
- Build DefaultValueConverter class
- Implement type-safe Rails → TypeScript mappings
- Handle all common default patterns
- Add unit tests for converter

### Story 2: Enhance Schema Introspection
- Update RailsSchemaIntrospector for better default extraction
- Categorize default types (literal, function, expression)
- Ensure all default formats are captured

### Story 3: Update Model Templates
- Modify active_model.ts.erb template
- Modify reactive_model.ts.erb template
- Add default values section to both
- Ensure proper TypeScript typing

### Story 4: Update Base Classes
- Enhance createActiveRecord to accept defaults
- Enhance createReactiveRecord to accept defaults
- Apply defaults during create operations
- Maintain backward compatibility

### Story 5: Integration Testing
- Test with real schema.rb examples
- Verify generated TypeScript compiles
- Test runtime behavior of defaults
- Add generator tests

## Dependencies
- Current generator infrastructure (Zero::Generators::ActiveModelsGenerator)
- RailsSchemaIntrospector
- TypeScript model base classes

## Risks & Mitigations
- **Risk**: Complex PostgreSQL expressions may not translate well
  - **Mitigation**: Provide fallback patterns and clear documentation

## Success Metrics
- Zero manual default synchronization required
- All generated models have correct defaults
- No runtime errors from missing defaults
- Developer satisfaction with automated defaults

## Example Output
For a Rails schema with:
```ruby
t.integer "lock_version", default: 0, null: false
t.boolean "due_time_set", default: false, null: false
t.string "status", default: "open", null: false
```

Generated TypeScript:
```typescript
const JobDefaults: Partial<CreateJobData> = {
  lock_version: 0,
  due_time_set: false,
  status: 'open',
};

const JobConfig = {
  tableName: 'jobs',
  className: 'Job',
  primaryKey: 'id',
  defaults: JobDefaults,
};

export const Job = createActiveRecord<JobData>(JobConfig);
```

## Notes
- Coordinate with frontend team on base class changes
- Consider future support for computed defaults
- Document the default conversion mappings
- Consider adding a configuration option to disable defaults if needed
