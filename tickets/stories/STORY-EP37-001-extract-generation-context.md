# STORY-EP37-001: Extract GenerationContext Value Object

**Story ID**: STORY-EP37-001  
**Epic**: EP-0037 (ReactiveRecord Generation Refactoring)  
**Type**: Refactoring  
**Points**: 3  
**Priority**: P0 - Critical Path  
**Status**: Open  

## User Story

**As a** developer maintaining the TypeScript generation system  
**I want** data to be encapsulated in a GenerationContext value object  
**So that** I can eliminate primitive obsession and data clumps throughout the codebase  

## Background

Currently, generation data is passed around as loose parameters:
- `table`, `schema`, `relationships`, `options` appear together in 15+ methods
- Hash structures used instead of proper objects
- No type safety or validation on generation data
- Difficult to add new context without changing method signatures

## Acceptance Criteria

### Implementation Criteria
- [ ] Create `GenerationContext` class in `lib/generators/zero/active_models/value_objects/`
- [ ] Encapsulate: table, schema, relationships, options, metadata
- [ ] Implement immutable update pattern with `#with_*` methods
- [ ] Add validation for required fields
- [ ] Include helpful inspection/debugging methods

### Code Quality Criteria
- [ ] Class aims for ~100 lines (pragmatic application of Sandi's guideline)
- [ ] Methods strive for 5 lines where practical, prioritizing clarity
- [ ] 100% test coverage
- [ ] No mutable state after initialization

### Integration Criteria
- [ ] Replace loose parameters in at least 3 existing methods
- [ ] Existing tests still pass without modification
- [ ] New tests demonstrate value object usage

## Technical Design

```ruby
# lib/generators/zero/active_models/value_objects/generation_context.rb
module Zero
  module Generators
    module ValueObjects
      class GenerationContext
        attr_reader :table, :schema, :relationships, :options, :metadata

        def initialize(table:, schema:, relationships: {}, options: {}, metadata: {})
          @table = table.freeze
          @schema = schema.freeze
          @relationships = relationships.freeze
          @options = options.freeze
          @metadata = metadata.freeze
          validate!
        end

        # Immutable update methods
        def with_relationships(new_relationships)
          self.class.new(
            table: table,
            schema: schema,
            relationships: new_relationships,
            options: options,
            metadata: metadata
          )
        end

        def with_generated_content(content)
          with_metadata(metadata.merge(generated_content: content))
        end

        def model_name
          @model_name ||= table.singularize.camelize
        end

        def typescript_filename
          @typescript_filename ||= "#{table.singularize.dasherize}.ts"
        end

        private

        def validate!
          raise ArgumentError, "table is required" if table.nil? || table.empty?
          raise ArgumentError, "schema is required" if schema.nil?
        end
      end
    end
  end
end
```

## Implementation Steps

1. **Create value object class** (30 min)
   - Define attributes and initialization
   - Implement freeze for immutability
   - Add validation

2. **Add immutable update methods** (45 min)
   - `with_relationships`, `with_options`, `with_metadata`
   - Ensure all return new instances

3. **Add computed properties** (30 min)
   - `model_name`, `typescript_filename`, `has_relationships?`
   - Memoize for performance

4. **Write comprehensive tests** (1 hour)
   - Initialization tests
   - Immutability tests
   - Update method tests
   - Validation tests

5. **Integrate with one method** (45 min)
   - Choose `GenerationCoordinator#generate_model_set`
   - Replace parameters with context object
   - Verify tests still pass

## Testing Requirements

### Unit Tests
```ruby
RSpec.describe Zero::Generators::ValueObjects::GenerationContext do
  describe "#initialize" do
    it "requires table"
    it "requires schema"
    it "freezes all attributes"
    it "allows optional relationships and options"
  end

  describe "#with_relationships" do
    it "returns new instance"
    it "preserves other attributes"
    it "updates relationships"
  end

  describe "computed properties" do
    it "generates model_name from table"
    it "generates typescript_filename"
    it "memoizes computed values"
  end
end
```

### Integration Tests
- Verify existing GenerationCoordinator tests pass
- Add test showing context flowing through pipeline

## Definition of Done

- [ ] Code implemented and passes all tests
- [ ] Test coverage at 100% for new code
- [ ] Integrated with at least one existing method
- [ ] Code reviewed and approved
- [ ] No performance degradation (benchmark before/after)
- [ ] Documentation updated with usage examples

## Notes

- This is the foundation for the entire refactoring
- Keep it simple - resist adding features not immediately needed
- Focus on immutability to prevent subtle bugs
- Consider using `dry-struct` gem if team is comfortable with dependency