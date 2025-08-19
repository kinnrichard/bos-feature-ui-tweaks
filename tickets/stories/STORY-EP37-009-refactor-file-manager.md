# STORY-EP37-009: Refactor FileManager to Single Responsibility

**Story ID**: STORY-EP37-009  
**Epic**: EP-0037 (ReactiveRecord Generation Refactoring)  
**Type**: Refactoring  
**Points**: 3  
**Priority**: P1 - Important  
**Status**: Open  
**Dependencies**: STORY-EP37-007 (FormattingStage)  

## User Story

**As a** developer following single responsibility principle  
**I want** FileManager to only handle file operations  
**So that** file I/O is separated from formatting and content manipulation  

## Background

FileManager (777 lines) currently handles:
- File writing
- Directory creation
- Prettier formatting (moved to FormattingStage)
- Batch processing (moved to FormattingStage)
- Semantic comparison
- Statistics tracking

Should be simplified to just file operations.

## Acceptance Criteria

### Implementation Criteria
- [ ] Create simple `FileWriter` class aims for ~100 lines
- [ ] Remove formatting logic (now in FormattingStage)
- [ ] Remove batch processing (now in FormattingStage)
- [ ] Keep only file I/O operations
- [ ] Extract semantic comparison to separate class

### Code Quality Criteria
- [ ] Class targets ~100 lines
- [ ] Methods strive for 5 lines where practical
- [ ] Single responsibility: file I/O only
- [ ] No content transformation

### Functionality Criteria
- [ ] Write files to disk
- [ ] Create directories as needed
- [ ] Handle dry-run mode
- [ ] Report file operations

## Technical Design

### New FileWriter (Simple and Focused)
```ruby
# lib/generators/zero/active_models/file_writer.rb
module Zero
  module Generators
    class FileWriter
      attr_reader :output_dir, :options, :statistics

      def initialize(output_dir, options = {})
        @output_dir = normalize_path(output_dir)
        @options = options
        @statistics = { written: 0, skipped: 0, errors: 0 }
      end

      def write(relative_path, content)
        full_path = build_full_path(relative_path)
        
        ensure_directory_exists(File.dirname(full_path))
        
        if should_write?(full_path, content)
          write_file(full_path, content)
          :created
        else
          @statistics[:skipped] += 1
          :identical
        end
      rescue => e
        @statistics[:errors] += 1
        handle_error(e, relative_path)
        :error
      end

      def write_batch(files)
        files.map do |file|
          write(file[:path], file[:content])
        end
      end

      private

      def normalize_path(path)
        if Pathname.new(path).absolute?
          path
        else
          Rails.root.join(path).to_s
        end
      end

      def build_full_path(relative_path)
        File.join(@output_dir, relative_path)
      end

      def ensure_directory_exists(dir_path)
        return if File.directory?(dir_path)
        
        FileUtils.mkdir_p(dir_path) unless @options[:dry_run]
      end

      def should_write?(path, content)
        return false if @options[:dry_run]
        return true if @options[:force]
        return true unless File.exist?(path)
        
        !identical_content?(path, content)
      end

      def identical_content?(path, new_content)
        existing = File.read(path)
        normalize_content(existing) == normalize_content(new_content)
      end

      def normalize_content(content)
        # Simple normalization - delegate complex comparison
        content.strip.gsub(/\s+/, " ")
      end

      def write_file(path, content)
        File.write(path, content)
        @statistics[:written] += 1
        log_write(path)
      end

      def log_write(path)
        return unless @options[:verbose]
        
        relative = path.sub(@output_dir, "")
        puts "  create  #{relative}"
      end

      def handle_error(error, path)
        return unless @options[:verbose]
        
        puts "  error   #{path}: #{error.message}"
      end
    end
  end
end
```

### Extract SemanticComparator
```ruby
# lib/generators/zero/active_models/semantic_comparator.rb
module Zero
  module Generators
    class SemanticComparator
      # Timestamp patterns to ignore
      IGNORE_PATTERNS = [
        /Generated.*\d{4}-\d{2}-\d{2}/i,
        /Auto-generated.*\d{4}-\d{2}-\d{2}/i,
        /^\s*\/\/.*\d{4}-\d{2}-\d{2}/
      ].freeze

      def identical?(content1, content2)
        normalize(content1) == normalize(content2)
      end

      private

      def normalize(content)
        lines = content.lines.map do |line|
          normalize_line(line)
        end.reject(&:blank?)
        
        lines.join("\n").strip
      end

      def normalize_line(line)
        # Remove timestamp comments
        IGNORE_PATTERNS.each do |pattern|
          return "" if line.match?(pattern)
        end
        
        # Normalize whitespace
        line.strip.gsub(/\s+/, " ")
      end
    end
  end
end
```

### New FileWritingStage (Uses FileWriter)
```ruby
# lib/generators/zero/active_models/pipeline/stages/file_writing_stage.rb
module Zero
  module Generators
    module Pipeline
      module Stages
        class FileWritingStage < Stage
          def initialize(file_writer: nil, options: {})
            @file_writer = file_writer || FileWriter.new(options[:output_dir], options)
            @comparator = SemanticComparator.new
          end

          def process(context)
            artifacts = context.metadata[:typescript_artifacts]
            return context unless artifacts
            
            write_results = write_all_files(artifacts)
            
            context.with_metadata(
              write_results: write_results,
              statistics: @file_writer.statistics
            )
          end

          private

          def write_all_files(artifacts)
            results = []
            
            # Write model files
            artifacts[:models]&.each do |model|
              result = @file_writer.write(
                model[:file_path],
                model[:typescript_content]
              )
              results << { path: model[:file_path], result: result }
            end
            
            # Write index file
            if artifacts[:index_file]
              result = @file_writer.write(
                artifacts[:index_file][:path],
                artifacts[:index_file][:content]
              )
              results << { path: "index.ts", result: result }
            end
            
            results
          end
        end
      end
    end
  end
end
```

## Implementation Steps

1. **Create simple FileWriter** (45 min)
   - Basic file writing
   - Directory creation
   - Dry-run support
   - Simple statistics

2. **Extract SemanticComparator** (30 min)
   - Move comparison logic
   - Timestamp pattern handling
   - Content normalization

3. **Create FileWritingStage** (30 min)
   - Use FileWriter
   - Process artifacts
   - Return results

4. **Remove old FileManager** (30 min)
   - Delete complex code
   - Update references
   - Clean up tests

5. **Write tests** (45 min)
   - Test FileWriter
   - Test SemanticComparator
   - Test FileWritingStage

## Testing Requirements

### Unit Tests
```ruby
RSpec.describe FileWriter do
  let(:writer) { described_class.new("/tmp/test") }
  
  describe "#write" do
    it "writes file to disk"
    it "creates directories as needed"
    it "respects dry-run mode"
    it "skips identical files"
    it "forces overwrite when forced"
  end
end

RSpec.describe SemanticComparator do
  describe "#identical?" do
    it "ignores timestamp differences"
    it "ignores whitespace differences"
    it "detects real changes"
  end
end
```

## Definition of Done

- [ ] FileWriter implemented (under 100 lines)
- [ ] SemanticComparator extracted
- [ ] FileWritingStage created
- [ ] Old FileManager removed
- [ ] All tests passing
- [ ] Documentation updated

## Benefits

### Before (FileManager)
- 777 lines
- 6+ responsibilities
- Complex batch logic
- Hard to test

### After (FileWriter)
- Under 100 lines
- Single responsibility
- Simple interface
- Easy to test

## Notes

- Keep it simple - just file I/O
- Semantic comparison is separate concern
- Formatting already extracted
- This completes the separation of concerns