# STORY-EP37-008: Simplify ServiceRegistry to Constructor Injection

**Story ID**: STORY-EP37-008  
**Epic**: EP-0037 (ReactiveRecord Generation Refactoring)  
**Type**: Refactoring  
**Points**: 5  
**Priority**: P1 - Important  
**Status**: Open  
**Dependencies**: STORY-EP37-004 through STORY-EP37-007 (All stages)  

## User Story

**As a** developer following Sandi Metz's principles  
**I want** simple constructor injection instead of ServiceRegistry  
**So that** dependencies are explicit and testing is straightforward  

## Background

ServiceRegistry (570 lines) violates Sandi's principles:
- Hidden dependencies (magic registration)
- Complex lifecycle management
- Circular dependency detection overkill
- Testing requires extensive mocking

Sandi's approach: "Use constructor injection with defaults. Keep it simple."

## Acceptance Criteria

### Implementation Criteria
- [ ] Replace ServiceRegistry with constructor injection
- [ ] Each stage declares dependencies explicitly
- [ ] Default implementations provided
- [ ] No service lifecycle management
- [ ] Remove circular dependency checking

### Code Quality Criteria
- [ ] No service registry class
- [ ] Dependencies visible in constructor
- [ ] Each class targets ~100 lines
- [ ] Testing with simple doubles

### Migration Criteria
- [ ] All stages use constructor injection
- [ ] Existing functionality preserved
- [ ] Tests simplified
- [ ] No performance degradation

## Technical Design

### Before (ServiceRegistry)
```ruby
class GenerationCoordinator
  def initialize(options, shell)
    @service_registry = ServiceRegistry.new
    @type_mapper = @service_registry.get_service(:type_mapper)
    @file_manager = @service_registry.get_service(:file_manager)
    # Hidden dependencies, unclear what's needed
  end
end
```

### After (Constructor Injection)
```ruby
# lib/generators/zero/active_models/pipeline/generation_pipeline.rb
module Zero
  module Generators
    module Pipeline
      class GenerationPipeline
        def initialize(
          introspector: nil,
          type_mapper: nil,
          relationship_processor: nil,
          formatter: nil,
          file_writer: nil,
          options: {}
        )
          @introspector = introspector || default_introspector
          @type_mapper = type_mapper || default_type_mapper
          @relationship_processor = relationship_processor || default_relationship_processor
          @formatter = formatter || default_formatter
          @file_writer = file_writer || default_file_writer
          @options = options
          
          @pipeline = build_pipeline
        end

        def execute(initial_context = nil)
          context = initial_context || build_initial_context
          @pipeline.execute(context)
        end

        private

        def build_pipeline
          Pipeline.new(stages: [
            SchemaAnalysisStage.new(
              introspector: @introspector,
              options: @options
            ),
            ModelGenerationStage.new(
              type_mapper: @type_mapper,
              relationship_processor: @relationship_processor
            ),
            TypeScriptGenerationStage.new,
            FormattingStage.new(
              formatter: @formatter,
              options: @options
            ),
            FileWritingStage.new(
              file_writer: @file_writer,
              options: @options
            )
          ])
        end

        def default_introspector
          require_relative "../rails_schema_introspector"
          RailsSchemaIntrospector.new
        end

        def default_type_mapper
          require_relative "../type_mapper"
          TypeMapper.new
        end

        def default_relationship_processor
          require_relative "../relationship_processor"
          RelationshipProcessor.new
        end

        def default_formatter
          require_relative "stages/formatting_stage"
          PrettierFormatter.new
        end

        def default_file_writer
          require_relative "../file_writer"
          FileWriter.new(@options[:output_dir])
        end

        def build_initial_context
          GenerationContext.new(
            table: @options[:table],
            schema: {},
            options: @options
          )
        end
      end
    end
  end
end
```

### Simplified Dependencies
```ruby
# Each service becomes simpler with explicit dependencies
class TypeMapper
  def initialize(custom_mappings: {})
    @custom_mappings = custom_mappings
    @default_mappings = build_default_mappings
  end

  def typescript_type_for(rails_type, column_name = nil)
    @custom_mappings[rails_type] ||
      @default_mappings[rails_type] ||
      "any"
  end

  private

  def build_default_mappings
    {
      string: "string",
      text: "string",
      integer: "number",
      bigint: "number",
      float: "number",
      decimal: "number",
      boolean: "boolean",
      date: "string",
      datetime: "string",
      json: "Record<string, any>",
      jsonb: "Record<string, any>"
    }
  end
end

class RelationshipProcessor
  def initialize(schema_introspector: nil)
    @schema_introspector = schema_introspector || RailsSchemaIntrospector.new
  end

  def process_relationships(table_name, schema)
    {
      belongs_to: extract_belongs_to(schema),
      has_many: extract_has_many(table_name),
      has_one: extract_has_one(table_name)
    }
  end

  private

  def extract_belongs_to(schema)
    # Simple relationship extraction
  end
end
```

### Testing Becomes Simple
```ruby
RSpec.describe GenerationPipeline do
  it "accepts custom dependencies" do
    mock_introspector = double("Introspector", get_all_tables: ["users"])
    mock_mapper = double("TypeMapper", typescript_type_for: "string")
    
    pipeline = GenerationPipeline.new(
      introspector: mock_introspector,
      type_mapper: mock_mapper
    )
    
    result = pipeline.execute
    # Simple, clear testing
  end

  it "uses defaults when not provided" do
    pipeline = GenerationPipeline.new
    # Works with defaults
  end
end
```

## Implementation Steps

1. **Remove ServiceRegistry class** (30 min)
   - Delete service_registry.rb
   - Remove all references

2. **Update each service with defaults** (1 hour)
   - Add default initialization
   - Remove registry dependencies
   - Simplify interfaces

3. **Create GenerationPipeline orchestrator** (1 hour)
   - Constructor with all dependencies
   - Default implementations
   - Pipeline building

4. **Update all stages** (1.5 hours)
   - Constructor injection for each
   - Remove service lookups
   - Add defaults

5. **Simplify tests** (1.5 hours)
   - Remove ServiceRegistry mocks
   - Use simple doubles
   - Test with real objects where possible

6. **Update generator entry point** (30 min)
   - Use GenerationPipeline
   - Pass options through
   - Remove coordinator

## Testing Requirements

### Unit Tests
```ruby
RSpec.describe "Constructor Injection" do
  describe TypeMapper do
    it "works with defaults"
    it "accepts custom mappings"
    it "has no hidden dependencies"
  end

  describe GenerationPipeline do
    it "accepts all dependencies"
    it "provides sensible defaults"
    it "builds pipeline correctly"
  end
end
```

### Integration Tests
```ruby
it "works with mix of custom and default dependencies" do
  pipeline = GenerationPipeline.new(
    type_mapper: CustomTypeMapper.new,
    # Other defaults used
  )
  
  expect(pipeline.execute).to be_successful
end
```

## Definition of Done

- [ ] ServiceRegistry removed completely
- [ ] All dependencies use constructor injection
- [ ] Default implementations provided
- [ ] Tests simplified and passing
- [ ] No hidden dependencies
- [ ] Documentation updated
- [ ] Performance unchanged

## Benefits

### Before
- 570 lines of ServiceRegistry
- Complex dependency graph
- Hidden dependencies
- Hard to test
- Magical behavior

### After
- No service registry
- Explicit dependencies
- Simple defaults
- Easy testing
- Clear, obvious code

## Notes

- This is what Sandi means by "simple"
- No magic, just constructor parameters
- Defaults make it convenient
- Testing becomes trivial
- Future developers will thank us