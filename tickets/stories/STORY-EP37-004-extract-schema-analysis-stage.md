# STORY-EP37-004: Extract SchemaAnalysisStage

**Story ID**: STORY-EP37-004  
**Epic**: EP-0037 (ReactiveRecord Generation Refactoring)  
**Type**: Refactoring  
**Points**: 3  
**Priority**: P0 - Critical Path  
**Status**: Open  
**Dependencies**: STORY-EP37-002 (Pipeline Architecture)  

## User Story

**As a** developer decomposing the GenerationCoordinator  
**I want** schema extraction and analysis in a dedicated stage  
**So that** schema logic is isolated, testable, and reusable  

## Background

Currently, GenerationCoordinator mixes schema extraction with:
- Rails introspection calls
- Table filtering logic
- Relationship discovery
- Type analysis

This 150+ lines of schema logic should be a focused stage that:
- Extracts schema data from Rails
- Filters tables based on patterns
- Discovers relationships
- Outputs enriched context

## Acceptance Criteria

### Implementation Criteria
- [ ] Create `SchemaAnalysisStage` class extending `Stage`
- [ ] Extract schema extraction logic from GenerationCoordinator
- [ ] Process Rails schema and add to context
- [ ] Filter tables based on exclude/include patterns
- [ ] Discover and validate relationships

### Code Quality Criteria
- [ ] Stage class targets ~100 lines for clarity
- [ ] Single responsibility: schema analysis only
- [ ] No direct Rails dependencies (use injected introspector)
- [ ] Pure transformation: context in, enriched context out

### Integration Criteria
- [ ] Stage works in pipeline
- [ ] Preserves current filtering behavior
- [ ] Handles missing tables gracefully
- [ ] Compatible with existing relationship processor

## Technical Design

```ruby
# lib/generators/zero/active_models/pipeline/stages/schema_analysis_stage.rb
module Zero
  module Generators
    module Pipeline
      module Stages
        class SchemaAnalysisStage < Stage
          def initialize(introspector: nil, options: {})
            @introspector = introspector || default_introspector
            @options = options
          end

          def process(context)
            tables = discover_tables(context)
            filtered = filter_tables(tables, context)
            
            enriched_schemas = filtered.map do |table|
              analyze_table_schema(table, context)
            end
            
            context.with_metadata(
              analyzed_tables: enriched_schemas,
              excluded_count: tables.size - filtered.size,
              analysis_timestamp: Time.current
            )
          end

          private

          def discover_tables(context)
            if context.options[:table]
              [context.options[:table]]
            else
              @introspector.get_all_tables
            end
          end

          def filter_tables(tables, context)
            exclude_patterns = context.options[:exclude] || []
            include_patterns = context.options[:include] || []
            
            tables.select do |table|
              should_include_table?(table, exclude_patterns, include_patterns)
            end
          end

          def should_include_table?(table, exclude_patterns, include_patterns)
            # Skip Rails internal tables
            return false if rails_internal_table?(table)
            
            # Apply exclude patterns
            return false if matches_any_pattern?(table, exclude_patterns)
            
            # Apply include patterns if specified
            if include_patterns.any?
              return matches_any_pattern?(table, include_patterns)
            end
            
            true
          end

          def analyze_table_schema(table, context)
            schema = @introspector.get_schema_for(table)
            relationships = discover_relationships(table, schema)
            
            {
              table_name: table,
              schema: schema,
              relationships: relationships,
              model_name: table.singularize.camelize,
              typescript_file: "#{table.singularize.dasherize}.ts"
            }
          end

          def discover_relationships(table, schema)
            # Extract foreign keys and determine relationship types
            belongs_to = schema.columns
              .select { |col| col.name.ends_with?("_id") }
              .map { |col| infer_relationship(col) }
              .compact
            
            { belongs_to: belongs_to }
          end

          def rails_internal_table?(table)
            %w[ar_internal_metadata schema_migrations].include?(table)
          end

          def matches_any_pattern?(table, patterns)
            patterns.any? { |pattern| File.fnmatch(pattern, table) }
          end

          def default_introspector
            require_relative "../../../rails_schema_introspector"
            RailsSchemaIntrospector.new
          end
        end
      end
    end
  end
end
```

## Implementation Steps

1. **Create SchemaAnalysisStage class** (45 min)
   - Extend Stage base class
   - Initialize with introspector
   - Implement process method

2. **Extract table discovery logic** (30 min)
   - Move from GenerationCoordinator
   - Support single table or all tables
   - Handle missing tables

3. **Extract filtering logic** (45 min)
   - Include/exclude patterns
   - Rails internal tables
   - Pattern matching logic

4. **Extract relationship discovery** (45 min)
   - Foreign key detection
   - Relationship type inference
   - Polymorphic detection

5. **Write comprehensive tests** (1.5 hours)
   - Mock introspector for testing
   - Test filtering logic
   - Test relationship discovery
   - Test error cases

## Testing Requirements

### Unit Tests
```ruby
RSpec.describe SchemaAnalysisStage do
  let(:introspector) { double("Introspector") }
  let(:stage) { described_class.new(introspector: introspector) }
  
  describe "#process" do
    it "discovers all tables when no specific table given"
    it "filters excluded tables"
    it "applies include patterns"
    it "skips Rails internal tables"
    it "discovers relationships from foreign keys"
    it "enriches context with schema data"
  end

  describe "relationship discovery" do
    it "identifies belongs_to from _id columns"
    it "detects polymorphic relationships"
    it "handles self-referential relationships"
  end

  describe "error handling" do
    it "handles missing tables gracefully"
    it "continues on introspection errors"
  end
end
```

### Integration Tests
```ruby
it "works in pipeline with other stages" do
  pipeline = Pipeline.new(stages: [
    SchemaAnalysisStage.new,
    ModelGenerationStage.new
  ])
  
  context = GenerationContext.new(table: "users", schema: {})
  result = pipeline.execute(context)
  
  expect(result.metadata[:analyzed_tables]).to be_present
end
```

## Definition of Done

- [ ] SchemaAnalysisStage implemented
- [ ] All schema logic extracted from GenerationCoordinator
- [ ] Stage is under 100 lines
- [ ] 100% test coverage
- [ ] Works in pipeline
- [ ] Performance equal or better than current
- [ ] Documentation updated

## Notes

- Keep introspector injectable for testing
- Consider caching schema for performance
- This stage should be pure - no side effects
- Future: Could parallelize table analysis