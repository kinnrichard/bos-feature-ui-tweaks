# STORY-EP37-002: Create Pipeline Base Architecture

**Story ID**: STORY-EP37-002  
**Epic**: EP-0037 (ReactiveRecord Generation Refactoring)  
**Type**: Architecture  
**Points**: 5  
**Priority**: P0 - Critical Path  
**Status**: Open  
**Dependencies**: STORY-EP37-001 (GenerationContext)  

## User Story

**As a** developer refactoring the generation system  
**I want** a pipeline architecture with composable stages  
**So that** I can break apart the monolithic GenerationCoordinator into focused, testable components  

## Background

The GenerationCoordinator currently handles:
- Schema extraction
- Model generation  
- TypeScript generation
- File writing
- Formatting
- Validation
- Statistics
- Error handling

This violates Single Responsibility Principle. A pipeline pattern allows:
- Each stage to have one responsibility
- Easy testing of individual stages
- Clear data flow
- Simple addition/removal of stages

## Acceptance Criteria

### Architecture Criteria
- [ ] Create `Pipeline` base class with stage management
- [ ] Define `Stage` interface with `process(context)` method
- [ ] Implement stage composition with `reduce` pattern
- [ ] Support stage insertion/removal/reordering
- [ ] Include error handling and stage metadata

### Code Quality Criteria
- [ ] Pipeline class targets ~100 lines for maintainability
- [ ] Stage interface clearly documented
- [ ] Methods aim for 5 lines where it maintains clarity
- [ ] No dependencies on specific stages

### Demonstration Criteria
- [ ] Create example stage that transforms context
- [ ] Show pipeline executing multiple stages
- [ ] Demonstrate error propagation
- [ ] Show how to test stages in isolation

## Technical Design

```ruby
# lib/generators/zero/active_models/pipeline/pipeline.rb
module Zero
  module Generators
    module Pipeline
      class Pipeline
        attr_reader :stages, :metadata

        def initialize(stages: [], metadata: {})
          @stages = stages
          @metadata = metadata
          validate_stages!
        end

        def execute(initial_context)
          log_pipeline_start(initial_context)
          
          result = stages.reduce(initial_context) do |context, stage|
            execute_stage(stage, context)
          end
          
          log_pipeline_complete(result)
          result
        end

        def with_stage(stage, position: -1)
          new_stages = stages.dup.insert(position, stage)
          self.class.new(stages: new_stages, metadata: metadata)
        end

        def without_stage(stage_class)
          new_stages = stages.reject { |s| s.is_a?(stage_class) }
          self.class.new(stages: new_stages, metadata: metadata)
        end

        private

        def execute_stage(stage, context)
          log_stage_start(stage, context)
          
          result = stage.process(context)
          
          log_stage_complete(stage, result)
          result
        rescue StandardError => e
          handle_stage_error(stage, context, e)
        end

        def validate_stages!
          stages.each do |stage|
            unless stage.respond_to?(:process)
              raise ArgumentError, "Stage #{stage.class} must implement #process"
            end
          end
        end

        def log_pipeline_start(context)
          # Optional logging
        end

        def log_stage_start(stage, context)
          # Optional logging
        end

        def handle_stage_error(stage, context, error)
          raise StageError.new(stage: stage, context: context, error: error)
        end
      end

      class StageError < StandardError
        attr_reader :stage, :context, :original_error

        def initialize(stage:, context:, error:)
          @stage = stage
          @context = context
          @original_error = error
          super("Stage #{stage.class} failed: #{error.message}")
        end
      end
    end
  end
end

# lib/generators/zero/active_models/pipeline/stage.rb
module Zero
  module Generators
    module Pipeline
      class Stage
        def process(context)
          raise NotImplementedError, "Subclasses must implement #process"
        end

        def name
          self.class.name.split('::').last
        end

        def can_run?(context)
          true
        end
      end
    end
  end
end
```

## Implementation Steps

1. **Create Pipeline base class** (1 hour)
   - Stage management and validation
   - Execute method with reduce pattern
   - Error handling

2. **Create Stage base class** (30 min)
   - Define interface
   - Add name and can_run? hooks
   - Document contract

3. **Add pipeline composition methods** (45 min)
   - `with_stage` for adding stages
   - `without_stage` for removing
   - Immutable updates

4. **Create example stages** (1 hour)
   - LoggingStage that adds metadata
   - ValidationStage that checks context
   - TransformStage that modifies data

5. **Write comprehensive tests** (1.5 hours)
   - Pipeline execution tests
   - Stage composition tests
   - Error handling tests
   - Example stage tests

6. **Create integration example** (45 min)
   - Small pipeline with 3 stages
   - Show full execution flow
   - Demonstrate testing approach

## Testing Requirements

### Unit Tests
```ruby
RSpec.describe Zero::Generators::Pipeline::Pipeline do
  let(:stage1) { double("Stage1", process: ->(ctx) { ctx.with_metadata(stage1: true) }) }
  let(:stage2) { double("Stage2", process: ->(ctx) { ctx.with_metadata(stage2: true) }) }
  
  describe "#execute" do
    it "processes stages in order"
    it "passes context between stages"
    it "returns final context"
  end

  describe "#with_stage" do
    it "adds stage at position"
    it "returns new pipeline instance"
  end

  describe "error handling" do
    it "wraps stage errors with context"
    it "identifies failing stage"
  end
end
```

### Example Stage Tests
```ruby
RSpec.describe "Example Stages" do
  describe LoggingStage do
    it "adds timestamp to metadata"
    it "preserves existing context"
  end

  describe ValidationStage do
    it "validates required context fields"
    it "raises on invalid context"
  end
end
```

## Definition of Done

- [ ] Pipeline and Stage base classes implemented
- [ ] Stage composition methods working
- [ ] Error handling with clear messages
- [ ] Example stages demonstrating usage
- [ ] 100% test coverage on new code
- [ ] Documentation with usage examples
- [ ] Code reviewed and approved

## Example Usage

```ruby
# Building a pipeline
pipeline = Pipeline.new(stages: [
  SchemaExtractionStage.new,
  ModelGenerationStage.new,
  FormattingStage.new
])

# Executing with context
context = GenerationContext.new(table: "users", schema: {...})
result = pipeline.execute(context)

# Testing individual stages
stage = ModelGenerationStage.new
result = stage.process(test_context)
expect(result.generated_content).to include("class User")
```

## Notes

- Keep pipeline simple - resist adding features
- Stages should be pure transformations when possible
- Consider adding stage timeout support later
- This enables parallel execution in future