# Pipeline Architecture for ReactiveRecord Generation

**Story ID**: STORY-EP37-002  
**Epic**: EP-0037 (ReactiveRecord Generation Refactoring)  
**Status**: ✅ Implemented

## Overview

This pipeline architecture replaces the monolithic `GenerationCoordinator` with composable, testable stages. Each stage has a single responsibility and operates on immutable `GenerationContext` objects.

## Architecture

### Core Components

```
Pipeline
├── Stage (base class)
├── StageError (enhanced error handling)
└── Example Stages
    ├── LoggingStage
    ├── ValidationStage
    └── TransformStage
```

### Key Benefits

- **Single Responsibility**: Each stage has one clear purpose
- **Easy Testing**: Stages can be tested in complete isolation
- **Flexible Composition**: Add/remove/reorder stages dynamically
- **Better Error Handling**: Precise error context and recovery options
- **Clear Data Flow**: Context objects show exactly what each stage needs
- **Performance Monitoring**: Per-stage timing and comprehensive metrics
- **Maintainability**: Much smaller, focused classes instead of 1200+ line coordinator

## Usage Examples

### Basic Pipeline

```ruby
require 'generators/zero/active_models/pipeline'

# Create pipeline with stages
pipeline = Zero::Generators::Pipeline::Pipeline.new(stages: [
  Zero::Generators::Pipeline::Stages::ValidationStage.new,
  Zero::Generators::Pipeline::Stages::TransformStage.new,
  CustomProcessingStage.new
])

# Create context with table and schema data
context = Zero::Generators::GenerationContext.new(
  table: table_data,
  schema: schema_data,
  relationships: relationships,
  options: { dry_run: false }
)

# Execute pipeline
result = pipeline.execute(context)
```

### Pipeline Composition

```ruby
# Start with base pipeline
base_pipeline = Zero::Generators::Pipeline.from_types([:validation, :transform])

# Add logging at the beginning
enhanced_pipeline = base_pipeline
  .with_stage(LoggingStage.new, position: 0)
  .with_stage(CustomStage.new)

# Replace validation with strict version
production_pipeline = enhanced_pipeline
  .replace_stage(ValidationStage, StrictValidationStage.new)

# Remove transformation for dry runs
dry_run_pipeline = production_pipeline
  .without_stage(TransformStage)
```

### Error Handling

```ruby
begin
  result = pipeline.execute(context)
rescue Zero::Generators::Pipeline::StageError => e
  puts "Stage #{e.stage_name} failed: #{e.message}"
  puts "Context: #{e.context_info}"
  puts "Category: #{e.error_category}"
  puts "Recoverable: #{e.recoverable?}"
  
  # Get detailed error report
  error_report = e.error_report
  Rails.logger.error(error_report.to_json)
  
  # Attempt recovery for certain error types
  if e.recoverable? && e.error_category == :validation
    fixed_context = fix_validation_issues(context, e)
    result = pipeline.execute(fixed_context)
  end
end
```

### Custom Stages

```ruby
class CustomProcessingStage < Zero::Generators::Pipeline::Stage
  def process(context)
    # Transform context data
    processed_data = perform_custom_processing(context.table)
    
    # Return new context with results
    context.with_metadata(
      custom_processed: true,
      processed_data: processed_data,
      processing_timestamp: Time.current
    )
  end
  
  def can_run?(context)
    # Only run if context has required data
    context.table_name.present? && context.table[:columns].any?
  end
  
  def description
    "Applies custom business logic transformation to context data"
  end
  
  def priority
    50 # Medium priority
  end
  
  private
  
  def perform_custom_processing(table_data)
    # Custom processing logic here
    { processed: true, columns: table_data[:columns].size }
  end
end
```

## Built-in Stages

### LoggingStage

Adds execution metadata and timestamps to track pipeline flow.

```ruby
logging_stage = LoggingStage.new(
  log_level: :info,
  include_context_snapshot: true
)

# Adds to context.metadata:
# - :execution_log (array of execution steps)
# - :last_logged_at (timestamp)
# - :pipeline_step_count (number of logged steps)
```

### ValidationStage

Ensures context has required data for subsequent stages.

```ruby
validation_stage = ValidationStage.new(
  required_fields: [:table, :schema, :table_name],
  validate_table_structure: true,
  validate_relationships: true,
  strict_mode: false
)

# Validates:
# - Required context fields are present
# - Table structure is valid
# - Column definitions are well-formed
# - Relationship data is properly structured
```

### TransformStage

Demonstrates context transformation with configurable rules.

```ruby
transform_stage = TransformStage.new(
  normalize_column_names: true,
  enhance_relationships: true,
  add_computed_properties: true,
  preserve_original: true
)

# Transforms:
# - Column names to standard format
# - Relationship metadata enhancement
# - Computed properties (complexity score, etc.)
# - Original data backup for debugging
```

## Pipeline Factory Methods

### Default Pipeline

```ruby
# Creates pipeline with standard stages
pipeline = Zero::Generators::Pipeline.default_pipeline

# Exclude specific stages
pipeline = Zero::Generators::Pipeline.default_pipeline(
  exclude_stages: [LoggingStage]
)

# Add custom stages
pipeline = Zero::Generators::Pipeline.default_pipeline(
  additional_stages: [CustomStage.new]
)
```

### Type-based Creation

```ruby
# Create from stage type symbols
pipeline = Zero::Generators::Pipeline.from_types(
  [:validation, :logging, :transform],
  stage_options: { strict_mode: true }
)

# Available types
types = Zero::Generators::Pipeline.available_stage_types
# => [:logging, :validation, :transform]
```

### Empty Pipeline

```ruby
# Start with empty pipeline for complete customization
pipeline = Zero::Generators::Pipeline.empty_pipeline
  .with_stage(ValidationStage.new)
  .with_stage(CustomStage.new)
```

## Testing Stages

### Individual Stage Testing

```ruby
RSpec.describe CustomProcessingStage do
  let(:stage) { described_class.new }
  let(:context) { build_test_context }
  
  describe "#process" do
    it "transforms context data" do
      result = stage.process(context)
      
      expect(result.metadata[:custom_processed]).to be(true)
      expect(result.metadata[:processed_data]).to be_present
    end
  end
  
  describe "#can_run?" do
    it "returns true for valid context" do
      expect(stage.can_run?(context)).to be(true)
    end
    
    it "returns false for invalid context" do
      invalid_context = build_context_without_table
      expect(stage.can_run?(invalid_context)).to be(false)
    end
  end
end
```

### Pipeline Integration Testing

```ruby
RSpec.describe "Pipeline Integration" do
  let(:pipeline) do
    Pipeline.new(stages: [
      ValidationStage.new,
      CustomProcessingStage.new
    ])
  end
  
  it "executes all stages successfully" do
    result = pipeline.execute(context)
    
    # Check validation stage ran
    expect(result.metadata[:stage_validation_stage][:validated]).to be(true)
    
    # Check custom stage ran
    expect(result.metadata[:custom_processed]).to be(true)
    
    # Check context integrity
    expect(result.table_name).to eq(context.table_name)
  end
end
```

## Performance Monitoring

```ruby
# Execute pipeline
result = pipeline.execute(context)

# Get execution statistics
stats = pipeline.execution_statistics
puts "Executions: #{stats[:executions_count]}"
puts "Total time: #{stats[:total_execution_time]}s"
puts "Average time: #{stats[:average_execution_time]}s"
puts "Stages executed: #{stats[:stages_executed]}"
puts "Stages skipped: #{stats[:stages_skipped]}"
puts "Errors: #{stats[:errors_encountered]}"
```

## Migration from GenerationCoordinator

### Current State (GenerationCoordinator)

- 1200+ lines handling multiple responsibilities
- Schema extraction, model generation, file writing, formatting, validation
- Difficult to test individual components
- Hard to modify or extend functionality

### Migration Strategy

#### Phase 1: Pipeline Architecture ✅ (STORY-EP37-002)
- Implement Pipeline, Stage, and example stages
- Create comprehensive tests and documentation
- Establish patterns for future stages

#### Phase 2: Extract Schema Analysis (STORY-EP37-004)
- Create `SchemaAnalysisStage` from coordinator logic
- Test stage in isolation
- Integrate with existing coordinator as fallback

#### Phase 3: Extract Generation Stages
- `ModelGenerationStage` (STORY-EP37-005)
- `TypeScriptGenerationStage` (STORY-EP37-006)
- `FormattingStage` (STORY-EP37-007)

#### Phase 4: Strangler Fig Migration (STORY-EP37-010)
- Gradually replace coordinator methods with pipeline
- Keep coordinator as thin orchestration wrapper
- Maintain backward compatibility

#### Phase 5: Complete Replacement
- Remove old coordinator logic
- Pipeline becomes primary execution path
- Performance optimization and monitoring

### Example Future Stage

```ruby
class SchemaExtractionStage < Stage
  def process(context)
    schema_service = get_service_from_context(context, :schema)
    
    extracted_schema = schema_service.extract_filtered_schema(
      exclude_tables: context.options[:exclude_tables] || [],
      include_only: context.options[:table] ? [context.options[:table]] : nil
    )
    
    context.class.new(
      table: context.table,
      schema: extracted_schema,
      relationships: context.relationships,
      options: context.options,
      metadata: context.metadata.merge(
        schema_extracted: true,
        extracted_at: Time.current
      )
    )
  end
  
  def can_run?(context)
    context.options.present?
  end
  
  def description
    "Extracts and filters schema data from Rails models"
  end
end
```

## File Structure

```
lib/generators/zero/active_models/pipeline/
├── README.md                    # This documentation
├── pipeline.rb                  # Main Pipeline class
├── stage.rb                     # Base Stage class
├── stage_error.rb               # Enhanced error handling
├── stages/
│   ├── logging_stage.rb         # Execution logging
│   ├── validation_stage.rb      # Context validation
│   └── transform_stage.rb       # Data transformation
└── examples/
    └── generation_pipeline_example.rb  # Usage examples
```

## Dependencies

- Ruby 3.0+
- Rails 7.0+ (for GenerationContext integration)
- RSpec (for testing)

## Contributing

When creating new stages:

1. Inherit from `Zero::Generators::Pipeline::Stage`
2. Implement `#process(context)` method
3. Override `#can_run?(context)` for conditional execution
4. Provide meaningful `#description`
5. Set appropriate `#priority` for stage ordering
6. Mark as `#idempotent?` if safe to run multiple times
7. Write comprehensive tests for isolation and integration
8. Update this README with usage examples

## Related Stories

- ✅ **STORY-EP37-001**: Extract GenerationContext (dependency)
- ✅ **STORY-EP37-002**: Create Pipeline Architecture (this story)
- 🔄 **STORY-EP37-003**: Characterization Tests (upcoming)
- 🔄 **STORY-EP37-004**: Extract Schema Analysis Stage (upcoming)
- 🔄 **STORY-EP37-005**: Extract Model Generation Stage (upcoming)
- 🔄 **STORY-EP37-006**: Extract TypeScript Generation Stage (upcoming)
- 🔄 **STORY-EP37-007**: Extract Formatting Stage (upcoming)
- 🔄 **STORY-EP37-010**: Strangler Fig Migration (upcoming)