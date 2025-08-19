# STORY-EP37-006: Extract TypeScriptGenerationStage

**Story ID**: STORY-EP37-006  
**Epic**: EP-0037 (ReactiveRecord Generation Refactoring)  
**Type**: Refactoring  
**Points**: 3  
**Priority**: P1 - Important  
**Status**: Open  
**Dependencies**: STORY-EP37-005 (ModelGenerationStage)  

## User Story

**As a** developer decomposing the GenerationCoordinator  
**I want** TypeScript-specific generation in a dedicated stage  
**So that** TypeScript concerns are isolated from model logic  

## Background

Currently, TypeScript-specific logic is mixed with model generation:
- Zero.js integration
- ReactiveRecord setup
- Index file generation
- TypeScript module organization

This should be a separate stage focused on TypeScript-specific concerns.

## Acceptance Criteria

### Implementation Criteria
- [ ] Create `TypeScriptGenerationStage` class extending `Stage`
- [ ] Handle Zero.js specific setup
- [ ] Generate index files
- [ ] Configure TypeScript module exports
- [ ] Handle ReactiveRecord initialization

### Code Quality Criteria
- [ ] Stage class targets ~100 lines for maintainability
- [ ] Focused on TypeScript concerns only
- [ ] No model logic (uses generated models from context)
- [ ] Pure transformation

### Output Criteria
- [ ] Proper Zero.js integration code
- [ ] Correct index file exports
- [ ] TypeScript module configuration
- [ ] ReactiveRecord setup code

## Technical Design

```ruby
# lib/generators/zero/active_models/pipeline/stages/typescript_generation_stage.rb
module Zero
  module Generators
    module Pipeline
      module Stages
        class TypeScriptGenerationStage < Stage
          def process(context)
            generated_models = context.metadata[:generated_models] || []
            
            typescript_artifacts = {
              models: enhance_with_typescript(generated_models),
              index_file: generate_index_file(generated_models),
              zero_schema: generate_zero_schema(generated_models),
              type_definitions: generate_type_definitions(generated_models)
            }
            
            context.with_metadata(
              typescript_artifacts: typescript_artifacts,
              typescript_config: build_config(context)
            )
          end

          private

          def enhance_with_typescript(models)
            models.map do |model|
              model.merge(
                typescript_content: add_typescript_features(model[:content]),
                zero_integration: add_zero_integration(model)
              )
            end
          end

          def add_typescript_features(content)
            enhanced = []
            enhanced << add_strict_mode_comment
            enhanced << content
            enhanced << add_reactive_record_setup
            
            enhanced.flatten.join("\n")
          end

          def add_zero_integration(model)
            [
              "// Zero.js integration",
              "import { initializeReactiveRecord } from '@/lib/zero/client';",
              "",
              "initializeReactiveRecord(#{model[:exports].first}, {",
              "  tableName: '#{model[:table_name]}',",
              "  relationships: #{relationship_config(model)}",
              "});"
            ].join("\n")
          end

          def generate_index_file(models)
            {
              path: "index.ts",
              content: build_index_content(models)
            }
          end

          def build_index_content(models)
            lines = ["// Auto-generated model index"]
            lines << ""
            
            # Export all models
            models.each do |model|
              model_name = model[:exports].first
              file_name = model[:file_path].gsub('.ts', '')
              lines << "export { #{model_name} } from './#{file_name}';"
            end
            
            # Export types
            lines << ""
            lines << "// Type exports"
            models.each do |model|
              model_name = model[:exports].first
              file_name = model[:file_path].gsub('.ts', '')
              lines << "export type { #{model_name}Data } from './#{file_name}';"
            end
            
            lines.join("\n")
          end

          def generate_zero_schema(models)
            {
              path: "zero-schema.ts",
              content: build_zero_schema_content(models)
            }
          end

          def build_zero_schema_content(models)
            [
              "// Zero.js schema configuration",
              "import { Schema } from '@rocicorp/zero';",
              "",
              "export const schema = new Schema({",
              build_schema_tables(models),
              "});"
            ].join("\n")
          end

          def build_schema_tables(models)
            models.map do |model|
              "  #{model[:table_name]}: #{model[:exports].first}"
            end.join(",\n")
          end

          def generate_type_definitions(models)
            {
              path: "types.d.ts",
              content: build_type_definitions_content(models)
            }
          end

          def build_type_definitions_content(models)
            [
              "// TypeScript type definitions",
              "declare module '@/lib/zero/models' {",
              models.map { |m| "  export class #{m[:exports].first} extends BaseModel {}" },
              "}"
            ].flatten.join("\n")
          end

          def add_strict_mode_comment
            "// @ts-strict"
          end

          def add_reactive_record_setup
            [
              "",
              "// ReactiveRecord setup",
              "ReactiveRecord.register(this);"
            ]
          end

          def relationship_config(model)
            # Generate Zero.js relationship configuration
            "{}"  # Simplified for example
          end

          def build_config(context)
            {
              strict_mode: context.options[:strict] || false,
              module_type: "ES2020",
              target: "ES2020",
              jsx: "react"
            }
          end
        end
      end
    end
  end
end
```

## Implementation Steps

1. **Create TypeScriptGenerationStage class** (45 min)
   - Extend Stage base class
   - Implement process method
   - Set up TypeScript configuration

2. **Extract Zero.js integration** (45 min)
   - Move Zero.js setup from GenerationCoordinator
   - Generate schema configuration
   - Handle ReactiveRecord initialization

3. **Extract index file generation** (30 min)
   - Generate model exports
   - Generate type exports
   - Handle barrel exports

4. **Extract type definitions** (30 min)
   - Generate .d.ts files
   - Module declarations
   - Type augmentation

5. **Write comprehensive tests** (1 hour)
   - Test Zero.js integration
   - Test index generation
   - Test type definitions

## Testing Requirements

### Unit Tests
```ruby
RSpec.describe TypeScriptGenerationStage do
  describe "#process" do
    it "enhances models with TypeScript features"
    it "generates index file with all exports"
    it "generates Zero.js schema configuration"
    it "generates type definitions"
  end

  describe "Zero.js integration" do
    it "adds ReactiveRecord initialization"
    it "configures relationships properly"
    it "generates valid schema"
  end

  describe "index file generation" do
    it "exports all models"
    it "exports type definitions"
    it "maintains alphabetical order"
  end
end
```

## Definition of Done

- [ ] TypeScriptGenerationStage implemented
- [ ] Zero.js integration extracted
- [ ] Index file generation working
- [ ] Type definitions generated
- [ ] 100% test coverage
- [ ] Works in pipeline
- [ ] Documentation updated

## Notes

- This stage focuses on TypeScript/Zero.js specifics
- Keep separate from model generation logic
- Consider making Zero.js integration optional
- Future: Support different TypeScript configurations