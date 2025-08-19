# frozen_string_literal: true

require "test_helper"
require "tempfile"
require "fileutils"
require "json"
require "pathname"
require "mocha/minitest"
require "generators/zero/active_models/generation_coordinator"
require "generators/zero/active_models/service_registry"
require "generators/zero/active_models/file_manager"

module Zero
  module Generators
    class GenerationCoordinatorBatchTest < ActiveSupport::TestCase
      def setup
        @temp_dir = Dir.mktmpdir
        @output_dir = File.join(@temp_dir, "output")
        @frontend_dir = File.join(@temp_dir, "frontend")

        # Create simple shell mock that tracks output
        @shell_output = []
        @shell = Object.new
        def @shell.say(message, color = nil)
          @output ||= []
          @output << { type: :say, message: message, color: color }
        end
        def @shell.say_status(status, message, color = nil)
          @output ||= []
          @output << { type: :say_status, status: status, message: message, color: color }
        end
        def @shell.output; @output || []; end

        # Setup options for testing batch functionality
        @options = {
          dry_run: false,
          skip_prettier: false,
          force: false,
          batch_max_files: 5,
          batch_max_memory_mb: 10,
          disable_batch_formatting: false,
          output_dir: @output_dir
        }

        # Setup Rails.root mock
        Rails.stubs(:root).returns(Pathname.new(@temp_dir))
        Rails.stubs(:env).returns(ActiveSupport::StringInquirer.new("test"))

        # Create frontend directory with prettier
        create_frontend_environment

        @coordinator = GenerationCoordinator.new(@options, @shell)
      end

      def teardown
        FileUtils.rm_rf(@temp_dir) if @temp_dir && Dir.exist?(@temp_dir)
      end

      # =============================================================================
      # Batch Processing Integration Tests
      # =============================================================================

      test "execute uses batch processing when generating multiple models" do
        # Mock schema service to return multiple tables
        schema_service = mock_schema_service_with_tables(3)

        # Track batch processing calls
        batch_calls = []
        file_manager = @coordinator.service_registry.get_service(:file_manager)

        file_manager.stubs(:process_batch_formatting).with do
          batch_calls << Time.current
          { processed: 3, errors: 0, time: 0.5, memory_used_mb: 2.5 }
        end

        # Mock template rendering to avoid file dependencies
        template_renderer = @coordinator.service_registry.get_service(:template_renderer)
        template_renderer.stubs(:render).returns("// Generated TypeScript content")

        result = @coordinator.execute

        # Verify batch processing was called
        assert batch_calls.size > 0, "Batch processing should have been called"

        # Verify shell output mentions batch processing
        batch_messages = @shell.output.select { |msg| msg[:message].include?("Batch") }
        assert batch_messages.any?, "Should have batch processing status messages"
      end

      test "process_batch_formatting reports comprehensive statistics" do
        # Mock file manager with specific batch results
        file_manager = @coordinator.service_registry.get_service(:file_manager)

        batch_result = {
          processed: 15,
          errors: 2,
          time: 1.25,
          memory_used_mb: 5.8
        }

        file_manager.stubs(:process_batch_formatting).returns(batch_result)

        result = @coordinator.send(:process_batch_formatting)

        assert_equal 15, result[:processed]
        assert_equal 2, result[:errors]
        assert_equal 1.25, result[:time]
        assert_equal 5.8, result[:memory_used_mb]

        # Verify shell output contains all expected metrics
        output_messages = @shell.output.map { |msg| msg[:message] }
        output_text = output_messages.join(" ")

        assert_includes output_text, "15 files"
        assert_includes output_text, "1.25s"
        assert_includes output_text, "5.8MB"
        assert_includes output_text, "2 files"  # Error count
      end

      test "batch processing integrates with file statistics display" do
        # Mock file manager with batch statistics
        file_manager = @coordinator.service_registry.get_service(:file_manager)

        file_manager.stubs(:statistics).returns({
          created: 8,
          identical: 2,
          errors: 1,
          formatted: 7,
          directories_created: 3,
          batch_formatted: 7,
          batch_operations: 2
        })

        # Mock schema and generation
        schema_service = mock_schema_service_with_tables(2)
        template_renderer = @coordinator.service_registry.get_service(:template_renderer)
        template_renderer.stubs(:render).returns("// Generated content")

        result = @coordinator.execute

        # Verify comprehensive statistics were displayed
        output_messages = @shell.output.map { |msg| msg[:message] }
        output_text = output_messages.join(" ")

        assert_includes output_text, "Created: 8 files"
        assert_includes output_text, "Formatted with Prettier: 7 files"
        assert_includes output_text, "Batch operations: 2"
        assert_includes output_text, "Batch formatted: 7 files"
      end

      test "batch processing handles memory and file count limits" do
        # Set very low limits to trigger multiple batch operations
        @options[:batch_max_files] = 2
        @options[:batch_max_memory_mb] = 0.01

        coordinator = GenerationCoordinator.new(@options, @shell)
        file_manager = coordinator.service_registry.get_service(:file_manager)

        # Track all batch processing calls
        batch_call_count = 0
        file_manager.stubs(:process_batch_formatting).with do
          batch_call_count += 1
          { processed: 2, errors: 0, time: 0.1 }
        end

        # Mock schema service with multiple tables
        schema_service = mock_schema_service_with_tables(6)
        template_renderer = coordinator.service_registry.get_service(:template_renderer)
        template_renderer.stubs(:render).returns("// Large content " * 100)  # Simulate large files

        result = coordinator.execute

        # Should have triggered multiple batch operations due to limits
        assert batch_call_count > 1, "Should have triggered multiple batch operations"
      end

      test "batch processing disabled option bypasses batch collection" do
        @options[:disable_batch_formatting] = true
        coordinator = GenerationCoordinator.new(@options, @shell)

        file_manager = coordinator.service_registry.get_service(:file_manager)

        # Verify batch processing is disabled
        batch_status = file_manager.batch_status
        assert_not batch_status[:enabled], "Batch processing should be disabled"

        # Mock schema and generation
        schema_service = mock_schema_service_with_tables(3)
        template_renderer = coordinator.service_registry.get_service(:template_renderer)
        template_renderer.stubs(:render).returns("// Generated content")

        # Mock individual formatting calls
        format_call_count = 0
        file_manager.stubs(:format_with_prettier).with do |content, path|
          format_call_count += 1
          "// Formatted content"
        end

        result = coordinator.execute

        # Should have used individual formatting instead of batch
        assert format_call_count > 0, "Should have used individual formatting"

        # Verify no batch processing output
        output_text = @shell.output.map { |msg| msg[:message] }.join(" ")
        assert_not_includes output_text, "Batch Formatting Results"
      end

      test "batch processing error handling with fallback" do
        file_manager = @coordinator.service_registry.get_service(:file_manager)

        # Mock batch processing to fail initially, then succeed with fallback
        file_manager.stubs(:process_batch_formatting).returns({
          processed: 3,
          errors: 2,
          time: 2.1,
          memory_used_mb: 1.5
        })

        result = @coordinator.send(:process_batch_formatting)

        # Verify error reporting
        output_messages = @shell.output.map { |msg| msg[:message] }
        output_text = output_messages.join(" ")

        assert_includes output_text, "3 files"  # Processed count
        assert_includes output_text, "2 files"  # Error count
        assert result[:errors] > 0, "Should report errors"
      end

      test "generation workflow preserves file creation order with batch processing" do
        # Mock schema service with specific table order
        tables = [
          { name: "users", columns: [ { name: "id", type: "integer", null: false } ] },
          { name: "posts", columns: [ { name: "id", type: "integer", null: false } ] },
          { name: "comments", columns: [ { name: "id", type: "integer", null: false } ] }
        ]

        schema_service = @coordinator.service_registry.get_service(:schema)
        schema_service.stubs(:extract_filtered_schema).returns({
          tables: tables,
          relationships: [],
          patterns: {}
        })

        # Track file generation order
        file_creation_order = []
        file_manager = @coordinator.service_registry.get_service(:file_manager)

        file_manager.stubs(:write_with_formatting).with do |path, content, options|
          file_creation_order << File.basename(path)
          File.join(@output_dir, path)
        end

        # Mock batch processing
        file_manager.stubs(:process_batch_formatting).returns({
          processed: 9, errors: 0, time: 0.8
        })

        # Mock template rendering
        template_renderer = @coordinator.service_registry.get_service(:template_renderer)
        template_renderer.stubs(:render).returns("// Generated content")

        result = @coordinator.execute

        # Verify files were created in expected order (types, active, reactive for each model)
        expected_files = [
          "user-data.ts", "user.ts", "reactive-user.ts",
          "post-data.ts", "post.ts", "reactive-post.ts",
          "comment-data.ts", "comment.ts", "reactive-comment.ts"
        ]

        assert_equal expected_files, file_creation_order
      end

      test "batch processing statistics integration with service registry" do
        # Mock comprehensive service statistics
        file_manager = @coordinator.service_registry.get_service(:file_manager)
        file_manager.stubs(:statistics).returns({
          created: 12,
          identical: 3,
          formatted: 10,
          batch_formatted: 10,
          batch_operations: 3,
          errors: 1
        })

        template_renderer = @coordinator.service_registry.get_service(:template_renderer)
        template_renderer.stubs(:statistics).returns({
          renders: 15,
          total_time: 0.45,
          average_time: 0.03,
          cache_enabled: true,
          cache_hit_ratio: 85.5,
          cache_hits: 12,
          cache_misses: 3
        })

        # Mock schema and generation
        schema_service = mock_schema_service_with_tables(4)
        template_renderer.stubs(:render).returns("// Generated content")

        result = @coordinator.execute

        # Verify comprehensive statistics were collected and displayed
        output_text = @shell.output.map { |msg| msg[:message] }.join(" ")

        # File statistics
        assert_includes output_text, "Created: 12 files"
        assert_includes output_text, "Batch operations: 3"
        assert_includes output_text, "Batch formatted: 10 files"

        # Template statistics
        assert_includes output_text, "Templates rendered: 15"
        assert_includes output_text, "Cache hit ratio: 85.5%"
      end

      test "dry run mode bypasses batch processing entirely" do
        @options[:dry_run] = true
        coordinator = GenerationCoordinator.new(@options, @shell)

        file_manager = coordinator.service_registry.get_service(:file_manager)

        # Track batch processing calls (should be none)
        batch_call_count = 0
        file_manager.stubs(:process_batch_formatting).with do
          batch_call_count += 1
          { processed: 0, errors: 0, time: 0.0 }
        end

        # Mock schema service
        schema_service = mock_schema_service_with_tables(3)
        template_renderer = coordinator.service_registry.get_service(:template_renderer)
        template_renderer.stubs(:render).returns("// Generated content")

        result = coordinator.execute

        # Verify no batch processing occurred
        assert_equal 0, batch_call_count, "Batch processing should not occur in dry run mode"

        # Verify dry run output
        output_text = @shell.output.map { |msg| msg[:message] }.join(" ")
        assert_includes output_text, "DRY RUN MODE"
        assert_includes output_text, "Would create:"
      end

      # =============================================================================
      # Performance and Memory Management Tests
      # =============================================================================

      test "batch processing monitors memory usage effectively" do
        # Set realistic memory limits
        @options[:batch_max_memory_mb] = 5
        coordinator = GenerationCoordinator.new(@options, @shell)

        file_manager = coordinator.service_registry.get_service(:file_manager)

        # Track memory estimates through batch status
        memory_snapshots = []

        original_collect = file_manager.method(:collect_for_batch_formatting)
        file_manager.define_singleton_method(:collect_for_batch_formatting) do |file_path, content, relative_path|
          result = original_collect.call(file_path, content, relative_path)
          memory_snapshots << batch_status[:memory_estimate_mb]
          result
        end

        # Generate content that gradually increases memory usage
        contents = [
          "export interface Small {}",
          "export interface Medium { " + (1..50).map { |i| "field#{i}: string;" }.join(" ") + " }",
          "export interface Large { " + (1..200).map { |i| "field#{i}: string;" }.join(" ") + " }"
        ]

        contents.each_with_index do |content, i|
          file_manager.send(:collect_for_batch_formatting,
                           File.join(@output_dir, "test#{i}.ts"), content, "test#{i}.ts")
        end

        # Verify memory tracking increased over time
        assert memory_snapshots.first < memory_snapshots.last, "Memory usage should increase with larger files"
      end

      test "batch processing cleanup verifies temporary file removal" do
        file_manager = @coordinator.service_registry.get_service(:file_manager)

        # Track temporary directory creation and cleanup
        temp_dirs_created = []
        temp_dirs_cleaned = []

        # Mock FileUtils.rm_rf to track cleanup
        FileUtils.stubs(:rm_rf).with do |path|
          temp_dirs_cleaned << path if path.include?("batch_format_")
          true
        end

        # Mock directory creation
        file_manager.stubs(:ensure_directory_exists).with do |path|
          temp_dirs_created << path if path.include?("batch_format_")
          true
        end

        # Mock successful batch processing
        file_manager.stubs(:system).returns(true)
        file_manager.stubs(:File).returns(stub(read: "formatted content"))

        # Add files to batch queue
        (1..3).each do |i|
          content = "export interface Test#{i} {}"
          file_manager.instance_variable_get(:@batch_queue) << {
            file_path: File.join(@output_dir, "test#{i}.ts"),
            content: content,
            relative_path: "test#{i}.ts",
            size: content.bytesize
          }
        end

        result = file_manager.send(:execute_batch_prettier_command)

        # Verify cleanup occurred (at least one temp directory was cleaned)
        assert temp_dirs_cleaned.any?, "Temporary directories should be cleaned up"
      end

      private

      def create_frontend_environment
        FileUtils.mkdir_p(@frontend_dir)

        package_json = {
          "name" => "test-project",
          "version" => "1.0.0",
          "dependencies" => {
            "prettier" => "^2.8.0"
          }
        }

        File.write(File.join(@frontend_dir, "package.json"), JSON.pretty_generate(package_json))
      end

      def mock_schema_service_with_tables(count)
        tables = (1..count).map do |i|
          {
            name: "table#{i}s",
            columns: [
              { name: "id", type: "integer", null: false, comment: nil },
              { name: "name", type: "string", null: false, comment: nil },
              { name: "created_at", type: "datetime", null: false, comment: nil },
              { name: "updated_at", type: "datetime", null: false, comment: nil }
            ]
          }
        end

        schema_service = @coordinator.service_registry.get_service(:schema)
        schema_service.stubs(:extract_filtered_schema).returns({
          tables: tables,
          relationships: [],
          patterns: {}
        })

        schema_service
      end
    end
  end
end
