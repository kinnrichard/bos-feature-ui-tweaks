# SchemaAnalysisStage Implementation

## Overview

SchemaAnalysisStage is a pipeline stage that extracts schema analysis logic from GenerationCoordinator into a focused, reusable, and testable component. This implements STORY-EP37-004 as part of the ReactiveRecord generation refactoring epic.

## Key Features

### 🔍 Schema Analysis Responsibilities
- **Rails Schema Introspection**: Uses SchemaService to extract complete database schema
- **Table Filtering**: Applies exclude/include filtering based on configuration options
- **Relationship Discovery**: Identifies belongs_to, has_many, has_one, and polymorphic relationships
- **Column and Type Extraction**: Processes column definitions with metadata
- **Pattern Detection**: Discovers soft deletion, timestamping, and other table patterns
- **Schema Validation**: Validates schema integrity and structure

### 🏗️ Pipeline Architecture Compliance
- **Stage Interface**: Implements proper pipeline Stage interface
- **Immutable Context**: Uses GenerationContext for immutable data flow
- **Error Handling**: Provides comprehensive error handling with context preservation
- **Conditional Execution**: Supports conditional execution via `can_run?` method
- **Idempotent Operation**: Safe to run multiple times with same input

### 📊 Context Enrichment
- **Single Table Mode**: Enriches context with specific table data and relationships
- **Multi-Table Mode**: Provides complete schema data for batch processing
- **Stage Metadata**: Adds execution metrics and analysis statistics
- **Data Validation**: Ensures schema data integrity before enrichment

## Usage

### In Pipeline
```ruby
pipeline = Pipeline.new(stages: [
  SchemaAnalysisStage.new(service_registry),
  ModelGenerationStage.new,
  FormattingStage.new
])
```

### Direct Usage
```ruby
stage = SchemaAnalysisStage.new(service_registry)
context = GenerationContext.new(
  table: { name: "placeholder", columns: [] },
  schema: {},
  options: { table: "users", exclude_tables: ["logs"] },
  metadata: {}
)

enriched_context = stage.process(context)
```

## Integration

### GenerationCoordinator Integration
The `extract_and_filter_schema` method in GenerationCoordinator has been updated to use SchemaAnalysisStage instead of direct SchemaService calls. This provides:
- Consistent error handling
- Structured context enrichment  
- Pipeline compatibility
- Better separation of concerns

### Service Dependencies
- **ServiceRegistry**: For dependency injection
- **SchemaService**: For actual schema extraction and filtering
- **GenerationContext**: For immutable data flow

## Testing

Comprehensive test suite covers:
- Stage interface compliance
- Schema extraction with various filtering options
- Relationship discovery and processing
- Pattern detection and validation
- Error handling scenarios
- Context enrichment and immutability
- Integration patterns

## Error Handling

The stage provides specific error types:
- `SchemaAnalysisError`: General schema analysis failures
- `SchemaExtractionError`: Schema extraction failures  
- `TableFilteringError`: Table filtering failures
- `RelationshipDiscoveryError`: Relationship processing failures

All errors preserve full context for debugging and include the original error for root cause analysis.

## Performance

- **High Priority**: Priority 10 for early pipeline execution
- **Idempotent**: Safe for repeated execution
- **Optimized Filtering**: Delegates to SchemaService for efficient filtering
- **Metadata Tracking**: Provides execution metrics and statistics

## Files Modified

1. **Created**: `lib/generators/zero/active_models/pipeline/stages/schema_analysis_stage.rb`
2. **Created**: `test/lib/generators/zero/active_models/pipeline/stages/schema_analysis_stage_test.rb`
3. **Modified**: `lib/generators/zero/active_models/generation_coordinator.rb`
   - Added SchemaAnalysisStage import
   - Updated `extract_and_filter_schema` to use the stage

## Benefits

- **Separation of Concerns**: Schema analysis logic isolated from orchestration
- **Reusability**: Stage can be used in different pipeline configurations  
- **Testability**: Focused unit tests for schema analysis functionality
- **Maintainability**: Clear responsibilities and interfaces
- **Extensibility**: Easy to add new schema analysis features
- **Pipeline Integration**: Follows established pipeline patterns

This implementation successfully extracts schema analysis responsibilities while maintaining full compatibility with existing GenerationCoordinator functionality.