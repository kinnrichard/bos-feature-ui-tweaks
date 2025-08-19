# STORY-EP37-005: Extract ModelGenerationStage

**Story ID**: STORY-EP37-005  
**Epic**: EP-0037 (ReactiveRecord Generation Refactoring)  
**Type**: Refactoring  
**Points**: 5  
**Priority**: P0 - Critical Path  
**Status**: Open  
**Dependencies**: STORY-EP37-004 (SchemaAnalysisStage)  

## User Story

**As a** developer decomposing the GenerationCoordinator  
**I want** model generation logic in a dedicated stage  
**So that** TypeScript model creation is isolated, testable, and follows single responsibility  

## Background

GenerationCoordinator currently handles all model generation:
- TypeScript interface generation
- Class property declarations
- Relationship mapping
- Import statement generation
- Type conversions

This 200+ lines should be a focused stage that transforms schema into TypeScript code.

## Acceptance Criteria

### Implementation Criteria
- [ ] Create `ModelGenerationStage` class extending `Stage`
- [ ] Extract model generation from GenerationCoordinator
- [ ] Generate TypeScript interfaces and classes
- [ ] Handle all relationship types correctly
- [ ] Generate proper import statements

### Code Quality Criteria
- [ ] Stage class aims for ~100 lines (with flexibility for complex generation logic)
- [ ] Uses injected TypeMapper and RelationshipProcessor
- [ ] Pure transformation with no side effects
- [ ] Methods strive for 5 lines where practical, prioritizing readability

### Output Criteria
- [ ] Generated TypeScript matches current output exactly
- [ ] All relationship types supported
- [ ] Proper TypeScript types used
- [ ] Import statements correct

## Technical Design

```ruby
# lib/generators/zero/active_models/pipeline/stages/model_generation_stage.rb
module Zero
  module Generators
    module Pipeline
      module Stages
        class ModelGenerationStage < Stage
          def initialize(type_mapper: nil, relationship_processor: nil)
            @type_mapper = type_mapper || TypeMapper.new
            @relationship_processor = relationship_processor || RelationshipProcessor.new
          end

          def process(context)
            analyzed_tables = context.metadata[:analyzed_tables] || []
            
            generated_models = analyzed_tables.map do |table_info|
              generate_model(table_info, context)
            end
            
            context.with_metadata(
              generated_models: generated_models,
              generation_timestamp: Time.current
            )
          end

          private

          def generate_model(table_info, context)
            {
              table_name: table_info[:table_name],
              file_path: table_info[:typescript_file],
              content: build_typescript_content(table_info),
              imports: collect_imports(table_info),
              exports: [table_info[:model_name]]
            }
          end

          def build_typescript_content(table_info)
            lines = []
            lines << generate_header(table_info)
            lines << generate_imports(table_info)
            lines << generate_interface(table_info)
            lines << generate_class(table_info)
            lines << generate_static_block(table_info)
            
            lines.flatten.compact.join("\n")
          end

          def generate_header(table_info)
            [
              "// Auto-generated from Rails schema",
              "// Table: #{table_info[:table_name]}",
              "// Generated: #{Time.current.iso8601}",
              ""
            ]
          end

          def generate_imports(table_info)
            imports = ["import { BaseModel } from './base-model';"]
            
            # Add relationship imports
            table_info[:relationships][:belongs_to]&.each do |rel|
              model_name = rel[:class_name] || rel[:name].camelize
              file_name = rel[:name].dasherize
              imports << "import { #{model_name} } from './#{file_name}';"
            end
            
            imports << ""
            imports
          end

          def generate_interface(table_info)
            [
              "export interface #{table_info[:model_name]}Data {",
              generate_interface_properties(table_info),
              "}",
              ""
            ]
          end

          def generate_interface_properties(table_info)
            table_info[:schema].columns.map do |column|
              "  #{column.name}: #{typescript_type(column)};"
            end
          end

          def generate_class(table_info)
            [
              "export class #{table_info[:model_name]} extends BaseModel {",
              "  static tableName = '#{table_info[:table_name]}';",
              "",
              generate_class_properties(table_info),
              generate_relationship_properties(table_info),
              "}"
            ]
          end

          def generate_class_properties(table_info)
            table_info[:schema].columns.map do |column|
              "  declare #{column.name}: #{typescript_type(column)};"
            end
          end

          def generate_relationship_properties(table_info)
            props = []
            
            table_info[:relationships][:belongs_to]&.each do |rel|
              if rel[:polymorphic]
                props.concat(generate_polymorphic_properties(rel))
              else
                props << "  declare #{rel[:name]}?: #{rel[:class_name] || rel[:name].camelize};"
              end
            end
            
            props
          end

          def generate_polymorphic_properties(relationship)
            relationship[:types].map do |type|
              "  declare #{relationship[:name]}#{type}?: #{type};"
            end
          end

          def generate_static_block(table_info)
            return [] unless needs_static_block?(table_info)
            
            [
              "",
              "  static {",
              generate_relationship_declarations(table_info),
              "  }"
            ]
          end

          def typescript_type(column)
            @type_mapper.typescript_type_for(column.type, column.name)
          end

          def collect_imports(table_info)
            # Collect all models that need importing
            imports = Set.new
            
            table_info[:relationships][:belongs_to]&.each do |rel|
              if rel[:polymorphic]
                rel[:types].each { |type| imports << type }
              else
                imports << (rel[:class_name] || rel[:name].camelize)
              end
            end
            
            imports.to_a
          end

          def needs_static_block?(table_info)
            # Determine if static block needed for relationships
            table_info[:relationships].values.any?(&:present?)
          end

          def generate_relationship_declarations(table_info)
            # Generate Zero.js relationship declarations
            @relationship_processor.generate_declarations(table_info)
          end
        end
      end
    end
  end
end
```

## Implementation Steps

1. **Create ModelGenerationStage class** (1 hour)
   - Extend Stage base class
   - Initialize with dependencies
   - Implement process method

2. **Extract interface generation** (45 min)
   - Move from GenerationCoordinator
   - Generate TypeScript interfaces
   - Handle all column types

3. **Extract class generation** (45 min)
   - Generate class with properties
   - Add relationship properties
   - Generate static blocks

4. **Extract import generation** (30 min)
   - Analyze relationships for imports
   - Generate import statements
   - Handle circular dependencies

5. **Integrate type mapping** (30 min)
   - Use TypeMapper for conversions
   - Handle custom types
   - Support nullable types

6. **Write comprehensive tests** (2 hours)
   - Test each generation method
   - Test various model types
   - Verify output matches current

## Testing Requirements

### Unit Tests
```ruby
RSpec.describe ModelGenerationStage do
  let(:type_mapper) { double("TypeMapper") }
  let(:stage) { described_class.new(type_mapper: type_mapper) }
  
  describe "#process" do
    it "generates model for each analyzed table"
    it "creates TypeScript interfaces"
    it "creates TypeScript classes"
    it "generates proper imports"
  end

  describe "relationship handling" do
    it "generates belongs_to properties"
    it "handles polymorphic relationships"
    it "generates has_many properties"
  end

  describe "type mapping" do
    it "converts Rails types to TypeScript"
    it "handles nullable types"
    it "supports custom types"
  end
end
```

## Definition of Done

- [ ] ModelGenerationStage implemented
- [ ] All generation logic extracted
- [ ] Stage is under 100 lines
- [ ] 100% test coverage
- [ ] Output matches current exactly
- [ ] Works in pipeline
- [ ] Documentation updated

## Notes

- Keep dependencies injectable
- This stage should be pure transformation
- Consider template approach for complex generation
- Future: Support custom templates