# STORY-EP37-007: Extract FormattingStage

**Story ID**: STORY-EP37-007  
**Epic**: EP-0037 (ReactiveRecord Generation Refactoring)  
**Type**: Refactoring  
**Points**: 3  
**Priority**: P1 - Important  
**Status**: Open  
**Dependencies**: STORY-EP37-006 (TypeScriptGenerationStage)  

## User Story

**As a** developer decomposing the FileManager  
**I want** formatting logic in a dedicated stage  
**So that** code formatting is isolated from file operations  

## Background

FileManager currently mixes:
- File writing operations
- Prettier formatting
- Batch formatting optimization
- Content normalization

Formatting should be a separate stage in the pipeline, making it optional and testable.

## Acceptance Criteria

### Implementation Criteria
- [ ] Create `FormattingStage` class extending `Stage`
- [ ] Extract Prettier integration from FileManager
- [ ] Support batch formatting for performance
- [ ] Handle formatting errors gracefully
- [ ] Make formatting optional via configuration

### Code Quality Criteria
- [ ] Stage class aims for ~100 lines
- [ ] Single responsibility: formatting only
- [ ] No file I/O operations
- [ ] Pure transformation of content

### Performance Criteria
- [ ] Batch formatting for multiple files
- [ ] Memory-efficient for large files
- [ ] Skippable when disabled
- [ ] Caching of formatted content

## Technical Design

```ruby
# lib/generators/zero/active_models/pipeline/stages/formatting_stage.rb
module Zero
  module Generators
    module Pipeline
      module Stages
        class FormattingStage < Stage
          DEFAULT_BATCH_SIZE = 50
          DEFAULT_MAX_MEMORY_MB = 100

          def initialize(formatter: nil, options: {})
            @formatter = formatter || PrettierFormatter.new
            @batch_size = options[:batch_size] || DEFAULT_BATCH_SIZE
            @max_memory = options[:max_memory_mb] || DEFAULT_MAX_MEMORY_MB
            @enabled = options.fetch(:enabled, true)
          end

          def process(context)
            return context unless @enabled
            
            artifacts = context.metadata[:typescript_artifacts]
            return context unless artifacts
            
            formatted_artifacts = format_artifacts(artifacts)
            
            context.with_metadata(
              typescript_artifacts: formatted_artifacts,
              formatting_stats: build_stats
            )
          end

          def can_run?(context)
            @enabled && prettier_available?
          end

          private

          def format_artifacts(artifacts)
            models = artifacts[:models] || []
            
            # Format in batches for performance
            formatted_models = format_in_batches(models)
            
            # Format other artifacts
            formatted_index = format_content(artifacts[:index_file])
            formatted_schema = format_content(artifacts[:zero_schema])
            
            artifacts.merge(
              models: formatted_models,
              index_file: formatted_index,
              zero_schema: formatted_schema
            )
          end

          def format_in_batches(models)
            models.each_slice(@batch_size).flat_map do |batch|
              format_batch(batch)
            end
          end

          def format_batch(batch)
            # Prepare batch for formatting
            temp_files = create_temp_files(batch)
            
            # Run Prettier on batch
            format_command = build_format_command(temp_files)
            formatted_content = execute_formatter(format_command)
            
            # Map formatted content back to models
            apply_formatted_content(batch, formatted_content)
          ensure
            cleanup_temp_files(temp_files)
          end

          def format_content(artifact)
            return artifact unless artifact
            
            artifact.merge(
              content: format_string(artifact[:content])
            )
          end

          def format_string(content)
            return content if content.blank?
            
            @formatter.format(content, parser: "typescript")
          rescue FormatterError => e
            log_formatting_error(e)
            content  # Return unformatted on error
          end

          def create_temp_files(batch)
            batch.map do |model|
              temp_file = Tempfile.new(["model", ".ts"])
              temp_file.write(model[:typescript_content])
              temp_file.flush
              temp_file
            end
          end

          def build_format_command(temp_files)
            file_paths = temp_files.map(&:path).join(" ")
            "npx prettier --write #{file_paths}"
          end

          def execute_formatter(command)
            stdout, stderr, status = Open3.capture3(command)
            
            unless status.success?
              raise FormatterError, "Prettier failed: #{stderr}"
            end
            
            stdout
          end

          def apply_formatted_content(batch, formatted_content)
            batch.map.with_index do |model, index|
              model.merge(
                typescript_content: read_formatted_file(formatted_content, index),
                formatted: true
              )
            end
          end

          def cleanup_temp_files(temp_files)
            temp_files.each(&:close!)
          end

          def prettier_available?
            system("which npx > /dev/null 2>&1") &&
              system("npx prettier --version > /dev/null 2>&1")
          end

          def log_formatting_error(error)
            # Log but don't fail
            Rails.logger.warn("Formatting failed: #{error.message}")
          end

          def build_stats
            {
              files_formatted: @formatted_count,
              batch_count: @batch_count,
              errors: @error_count,
              skipped: @skipped_count
            }
          end
        end

        class FormatterError < StandardError; end

        class PrettierFormatter
          def format(content, parser: "typescript")
            with_temp_file(content) do |file|
              run_prettier(file.path, parser)
            end
          end

          private

          def with_temp_file(content)
            file = Tempfile.new(["format", ".ts"])
            file.write(content)
            file.flush
            
            yield file
          ensure
            file.close!
          end

          def run_prettier(file_path, parser)
            command = "npx prettier --parser #{parser} #{file_path}"
            stdout, stderr, status = Open3.capture3(command)
            
            unless status.success?
              raise FormatterError, "Prettier failed: #{stderr}"
            end
            
            stdout
          end
        end
      end
    end
  end
end
```

## Implementation Steps

1. **Create FormattingStage class** (45 min)
   - Extend Stage base class
   - Configure formatter and options
   - Implement can_run? check

2. **Extract Prettier integration** (45 min)
   - Move from FileManager
   - Create PrettierFormatter class
   - Handle formatting errors

3. **Implement batch formatting** (1 hour)
   - Create temp files for batch
   - Run Prettier on batch
   - Apply formatted content

4. **Add performance optimizations** (30 min)
   - Memory limit checking
   - Batch size optimization
   - Content caching

5. **Write comprehensive tests** (1 hour)
   - Test formatting logic
   - Test batch processing
   - Test error handling

## Testing Requirements

### Unit Tests
```ruby
RSpec.describe FormattingStage do
  let(:formatter) { double("Formatter") }
  let(:stage) { described_class.new(formatter: formatter) }
  
  describe "#process" do
    it "formats TypeScript content"
    it "handles batch formatting"
    it "skips when disabled"
    it "handles formatting errors gracefully"
  end

  describe "batch processing" do
    it "formats files in batches"
    it "respects batch size limit"
    it "handles partial batch"
  end

  describe "error handling" do
    it "returns unformatted content on error"
    it "logs formatting errors"
    it "continues processing on error"
  end
end
```

## Definition of Done

- [ ] FormattingStage implemented
- [ ] Prettier integration extracted
- [ ] Batch formatting working
- [ ] Error handling implemented
- [ ] 100% test coverage
- [ ] Performance equal or better
- [ ] Documentation updated

## Notes

- Keep formatter injectable for testing
- Make formatting optional for speed
- Consider adding ESLint stage later
- Batch formatting critical for performance