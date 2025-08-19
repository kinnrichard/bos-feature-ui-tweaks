# ModelGenerationStage

## Overview

The ModelGenerationStage is a pipeline stage that extracts the core model generation logic from GenerationCoordinator into a dedicated, focused stage. This stage is responsible for generating TypeScript model files from Rails schema data.

## Responsibilities

The ModelGenerationStage handles the generation of three types of TypeScript files:

1. **Data Interface** (`types/{model}-data.ts`) - TypeScript interface matching database schema
2. **ActiveRecord Model** (`{model}.ts`) - Server-side model with mutation capabilities
3. **ReactiveRecord Model** (`reactive-{model}.ts`) - Client-side reactive query model

## Key Features

- **Pipeline Integration**: Follows the standard Stage interface with `process(context)` method
- **Service Integration**: Uses ServiceRegistry to access TemplateRenderer, TypeMapper, and other services
- **Context-Based**: Operates on GenerationContext value objects for clean data flow
- **Error Handling**: Comprehensive error handling with context-aware error messages
- **Relationship Processing**: Handles Rails relationships (belongs_to, has_many, etc.)
- **Type Mapping**: Converts Rails column types to appropriate TypeScript types
- **Pattern Detection**: Supports patterns like soft deletion, polymorphic associations
- **Template Rendering**: Uses ERB templates for flexible code generation

## Usage

```ruby
# Initialize stage with service registry
stage = ModelGenerationStage.new(service_registry)

# Create generation context with table data
context = GenerationContext.new(
  table: table_schema,
  schema: full_schema_data,
  relationships: processed_relationships,
  options: generation_options,
  metadata: { patterns: detected_patterns }
)

# Process context to generate models
result_context = stage.process(context)

# Access generated content from metadata
generated_content = result_context.metadata[:generated_content]
```

## Input Requirements

The stage requires a GenerationContext with:
- `table` - Table schema with columns array
- `relationships` - Processed relationship data
- `patterns` - Optional pattern detection results (soft deletion, etc.)
- `options` - Generation options (dry_run, etc.)

## Output

The stage enriches the context metadata with:
- `generated_content[:data_interface]` - Generated TypeScript interface
- `generated_content[:active_model]` - Generated ActiveRecord model
- `generated_content[:reactive_model]` - Generated ReactiveRecord model
- `generated_content[:filenames]` - Target file paths
- `generation_timestamp` - ISO timestamp of generation
- Stage execution metadata with performance metrics

## Error Handling

The stage provides specific error types:
- `ModelGenerationError` - General model generation failures
- `TemplateRenderingError` - Template processing failures
- `TypeMappingError` - Type conversion failures
- `RelationshipProcessingError` - Relationship handling failures

All errors are wrapped in `StageError` with full context information.

## Integration with GenerationCoordinator

This stage replaces the inline model generation logic in GenerationCoordinator, allowing for:
- Better separation of concerns
- Easier testing and maintenance
- Reusable pipeline architecture
- More flexible generation workflows

## Testing

The stage includes comprehensive unit tests covering:
- Stage initialization and configuration
- Context validation and processing
- Error handling scenarios
- Template context building
- Service integration
- Helper method functionality

## Dependencies

The stage depends on these services from the ServiceRegistry:
- `TemplateRenderer` - ERB template processing
- `TypeMapper` - Rails to TypeScript type mapping
- `RelationshipProcessor` - Relationship handling
- `DefaultValueConverter` - Default value processing
- `PolymorphicModelAnalyzer` - Polymorphic association handling