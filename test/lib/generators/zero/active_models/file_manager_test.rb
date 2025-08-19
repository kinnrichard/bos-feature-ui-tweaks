# frozen_string_literal: true

require "test_helper"
require "tempfile"
require "fileutils"
require "json"
require "pathname"
require "mocha/minitest"
require "generators/zero/active_models/file_manager"

module Zero
  module Generators
    class FileManagerTest < ActiveSupport::TestCase
      def setup
        @temp_dir = Dir.mktmpdir
        @output_dir = File.join(@temp_dir, "output")
        @frontend_dir = File.join(@temp_dir, "frontend")

        # Create simple shell mock that doesn't interfere
        @shell = Object.new
        def @shell.say_status(*args); end

        # Setup basic options
        @options = {
          dry_run: false,
          skip_prettier: false,
          force: false
        }

        # Setup Rails.root mock with Pathname for compatibility
        Rails.stubs(:root).returns(Pathname.new(@temp_dir))

        @file_manager = FileManager.new(@options, @shell, @output_dir)
      end

      def teardown
        FileUtils.rm_rf(@temp_dir) if @temp_dir && Dir.exist?(@temp_dir)
      end

      # =============================================================================
      # Core Functionality Tests
      # =============================================================================

      test "writes new file successfully" do
        content = "export interface User { id: number; }"
        file_path = @file_manager.write_with_formatting("models/user.ts", content, format: false)

        assert File.exist?(file_path)
        assert_equal content, File.read(file_path).strip
        assert_equal 1, @file_manager.statistics[:created]
      end

      test "skips file when content is identical" do
        content = "export interface User { id: number; }"

        # First write
        @file_manager.write_with_formatting("models/user.ts", content, format: false)

        # Second write with identical content
        @file_manager.write_with_formatting("models/user.ts", content, format: false)

        assert_equal 1, @file_manager.statistics[:created]
        assert_equal 1, @file_manager.statistics[:identical]
      end

      test "force option bypasses semantic comparison" do
        @options[:force] = true
        content = "export interface User { id: number; }"

        # First write
        @file_manager.write_with_formatting("models/user.ts", content, format: false)

        # Second write should create file again due to force option
        @file_manager.write_with_formatting("models/user.ts", content, format: false)

        assert_equal 2, @file_manager.statistics[:created]
        assert_equal 0, @file_manager.statistics[:identical]
      end

      test "dry run mode doesn't create actual files" do
        @options[:dry_run] = true
        content = "export interface User { id: number; }"

        file_path = @file_manager.write_with_formatting("models/user.ts", content)

        assert_not File.exist?(file_path)
        assert_equal 1, @file_manager.statistics[:created]
      end

      # =============================================================================
      # Directory Management Tests
      # =============================================================================

      test "creates directories when they don't exist" do
        new_dir = File.join(@temp_dir, "new_directory")

        result = @file_manager.ensure_directory_exists(new_dir)

        assert result
        assert Dir.exist?(new_dir)
        assert_equal 1, @file_manager.statistics[:directories_created]
      end

      test "handles existing directories gracefully" do
        existing_dir = @temp_dir

        result = @file_manager.ensure_directory_exists(existing_dir)

        assert result
        assert_equal 0, @file_manager.statistics[:directories_created]
      end

      test "handles directory creation errors" do
        invalid_path = "/root/cannot_create_here"

        result = @file_manager.ensure_directory_exists(invalid_path)

        assert_not result
        assert_equal 1, @file_manager.statistics[:errors]
      end

      # =============================================================================
      # Frontend Detection Tests
      # =============================================================================

      test "detects frontend root when package.json exists" do
        create_package_json(@frontend_dir)

        file_manager = FileManager.new(@options, @shell, @output_dir)

        assert_equal @frontend_dir, file_manager.frontend_root
      end

      test "tries alternative frontend directories" do
        client_dir = File.join(@temp_dir, "client")
        create_package_json(client_dir)

        file_manager = FileManager.new(@options, @shell, @output_dir)

        assert_equal client_dir, file_manager.frontend_root
      end

      test "returns nil when no frontend directory found" do
        file_manager = FileManager.new(@options, @shell, @output_dir)

        assert_nil file_manager.frontend_root
      end

      # =============================================================================
      # Prettier Detection Tests
      # =============================================================================

      test "detects prettier in dependencies" do
        create_package_json(@frontend_dir, dependencies: { "prettier" => "^2.0.0" })

        file_manager = FileManager.new(@options, @shell, @output_dir)

        assert file_manager.send(:prettier_available?)
      end

      test "detects prettier in devDependencies" do
        create_package_json(@frontend_dir, dev_dependencies: { "prettier" => "^2.0.0" })

        file_manager = FileManager.new(@options, @shell, @output_dir)

        assert file_manager.send(:prettier_available?)
      end

      test "prettier not available when not in package.json" do
        create_package_json(@frontend_dir)

        file_manager = FileManager.new(@options, @shell, @output_dir)

        assert_not file_manager.send(:prettier_available?)
      end

      # =============================================================================
      # Content Normalization Tests
      # =============================================================================

      test "content normalizer removes timestamp patterns" do
        normalizer = FileManager::ContentNormalizer.new

        content_with_timestamps = <<~CONTENT
          // Auto-generated: 2024-01-01 12:00:00 UTC
          export interface User {
            id: number;
          }
          // Generated from Rails schema: 2024-01-01 12:00:00 UTC
        CONTENT

        expected = <<~CONTENT.strip
          export interface User {
            id: number;
          }
        CONTENT

        result = normalizer.normalize(content_with_timestamps)
        assert_equal expected, result
      end

      test "content normalizer preserves non-timestamp content" do
        normalizer = FileManager::ContentNormalizer.new

        content = <<~CONTENT
          export interface User {
            id: number;
            name: string;
            // Regular comment that should be preserved
          }
        CONTENT

        result = normalizer.normalize(content)
        assert_equal content.strip, result
      end

      # =============================================================================
      # Semantic Comparison Tests
      # =============================================================================

      test "semantic comparator identifies identical content ignoring timestamps" do
        comparator = FileManager::SemanticContentComparator.new

        original_content = <<~CONTENT
          // Generated: 2024-01-01 12:00:00 UTC
          export interface User { id: number; }
        CONTENT

        new_content = <<~CONTENT
          // Generated: 2024-01-02 14:30:00 UTC
          export interface User { id: number; }
        CONTENT

        temp_file = Tempfile.new([ "test", ".ts" ])
        temp_file.write(original_content)
        temp_file.close

        result = comparator.identical?(temp_file.path, new_content)

        assert result

        temp_file.unlink
      end

      test "semantic comparator detects different content" do
        comparator = FileManager::SemanticContentComparator.new

        original_content = "export interface User { id: number; }"
        new_content = "export interface User { id: string; }"

        temp_file = Tempfile.new([ "test", ".ts" ])
        temp_file.write(original_content)
        temp_file.close

        result = comparator.identical?(temp_file.path, new_content)

        assert_not result

        temp_file.unlink
      end

      test "semantic comparator handles missing files" do
        comparator = FileManager::SemanticContentComparator.new

        result = comparator.identical?("/nonexistent/file.ts", "content")

        assert_not result
      end

      # =============================================================================
      # Smart File Creator Tests
      # =============================================================================

      test "smart file creator creates file when content differs" do
        comparator = FileManager::SemanticContentComparator.new
        creator = FileManager::SmartFileCreator.new(comparator, @shell)
        file_path = File.join(@temp_dir, "test.ts")

        result = creator.create_or_skip(file_path, "export interface User {}")

        assert_equal :created, result
        assert File.exist?(file_path)
      end

      test "smart file creator skips when content is identical" do
        comparator = FileManager::SemanticContentComparator.new
        creator = FileManager::SmartFileCreator.new(comparator, @shell)
        file_path = File.join(@temp_dir, "test.ts")
        content = "export interface User {}"

        # Create file first
        File.write(file_path, content)

        result = creator.create_or_skip(file_path, content)

        assert_equal :identical, result
      end

      test "smart file creator handles write errors" do
        comparator = FileManager::SemanticContentComparator.new
        creator = FileManager::SmartFileCreator.new(comparator, @shell)
        invalid_path = "/root/cannot_write_here.ts"

        result = creator.create_or_skip(invalid_path, "content")

        assert_equal :error, result
      end

      # =============================================================================
      # Prettier Integration Tests
      # =============================================================================

      test "should format TypeScript files when prettier available" do
        create_package_json(@frontend_dir, dependencies: { "prettier" => "^2.0.0" })
        file_manager = FileManager.new(@options, @shell, @output_dir)

        ts_file = File.join(@temp_dir, "test.ts")
        result = file_manager.send(:should_format?, ts_file)

        assert result
      end

      test "should not format non-TypeScript files" do
        create_package_json(@frontend_dir, dependencies: { "prettier" => "^2.0.0" })
        file_manager = FileManager.new(@options, @shell, @output_dir)

        txt_file = File.join(@temp_dir, "test.txt")
        result = file_manager.send(:should_format?, txt_file)

        assert_not result
      end

      test "should not format when skip_prettier option is true" do
        @options[:skip_prettier] = true
        create_package_json(@frontend_dir, dependencies: { "prettier" => "^2.0.0" })
        file_manager = FileManager.new(@options, @shell, @output_dir)

        ts_file = File.join(@temp_dir, "test.ts")
        result = file_manager.send(:should_format?, ts_file)

        assert_not result
      end

      # =============================================================================
      # Statistics Management Tests
      # =============================================================================

      test "reset statistics clears all counters" do
        # Access statistics hash directly for modification
        stats = @file_manager.statistics
        stats[:created] = 5
        stats[:identical] = 3

        @file_manager.reset_statistics

        # Check the statistics after reset
        reset_stats = @file_manager.statistics
        assert_equal 0, reset_stats[:created]
        assert_equal 0, reset_stats[:identical]
        assert_equal 0, reset_stats[:errors]
      end

      test "semantic comparison enabled returns correct values" do
        # Default options (not force, not dry_run)
        assert @file_manager.semantic_comparison_enabled?

        # Force mode disables semantic comparison
        @options[:force] = true
        assert_not @file_manager.semantic_comparison_enabled?

        # Dry run mode disables semantic comparison
        @options[:force] = false
        @options[:dry_run] = true
        assert_not @file_manager.semantic_comparison_enabled?
      end

      # =============================================================================
      # Always Create Comparator Tests
      # =============================================================================

      test "always create comparator always returns false" do
        comparator = FileManager::AlwaysCreateComparator.new

        result = comparator.identical?("any_path", "any_content")

        assert_not result
      end

      # =============================================================================
      # Edge Cases Tests
      # =============================================================================

      test "handles malformed package.json gracefully" do
        # Create invalid JSON
        FileUtils.mkdir_p(@frontend_dir)
        File.write(File.join(@frontend_dir, "package.json"), "{ invalid json")

        file_manager = FileManager.new(@options, @shell, @output_dir)

        assert_not file_manager.send(:prettier_available?)
      end

      test "handles nested directory creation" do
        nested_path = "deeply/nested/directory/structure/file.ts"
        content = "export interface Nested {}"

        file_path = @file_manager.write_with_formatting(nested_path, content, format: false)

        assert File.exist?(file_path)
        assert_equal content, File.read(file_path).strip
      end

      test "tracks multiple file operations correctly" do
        # Create two different files
        @file_manager.write_with_formatting("models/user.ts", "interface User {}", format: false)
        @file_manager.write_with_formatting("models/post.ts", "interface Post {}", format: false)

        # Try to create user.ts again (should be identical)
        @file_manager.write_with_formatting("models/user.ts", "interface User {}", format: false)

        stats = @file_manager.statistics
        assert_equal 2, stats[:created]
        assert_equal 1, stats[:identical]
        assert_equal 0, stats[:errors]
      end

      test "handles special characters in file paths and content" do
        special_content = "// Special chars: &<>\"'#{}\nexport interface Special {}"

        file_path = @file_manager.write_with_formatting(
          "special/special-chars.ts",
          special_content,
          format: false
        )

        assert File.exist?(file_path)
        assert_includes File.read(file_path), special_content
      end

      # =============================================================================
      # Batch Processing Tests
      # =============================================================================

      test "collect_for_batch_formatting queues files for batch processing" do
        create_package_json(@frontend_dir, dependencies: { "prettier" => "^2.0.0" })
        @options[:batch_max_files] = 10  # Set high limit to prevent auto-processing
        file_manager = FileManager.new(@options, @shell, @output_dir)

        # Use larger content (~10KB) to ensure memory estimate is > 0
        content = "export interface User {\n" +
                 (1..500).map { |i| "  field#{i}: string; // Field #{i} comment with extra text to increase size" }.join("\n") +
                 "\n}"
        file_path = File.join(@output_dir, "user.ts")

        # Mock prettier availability at the instance level
        file_manager.instance_variable_set(:@prettier_available, true)

        # Collect file for batch processing
        result = file_manager.send(:collect_for_batch_formatting, file_path, content, "user.ts")

        # Should return original content and add to batch queue
        assert_equal content, result

        # Verify batch status
        batch_status = file_manager.batch_status
        assert_equal 1, batch_status[:queued_files]
        assert batch_status[:memory_estimate_mb] > 0, "Memory estimate should be > 0 for larger content (got #{batch_status[:memory_estimate_mb]}MB)"
        assert batch_status[:enabled]
      end

      test "batch_ready_for_processing triggers on file count limit" do
        @options[:batch_max_files] = 2  # Set low limit for testing
        create_package_json(@frontend_dir, dependencies: { "prettier" => "^2.0.0" })
        file_manager = FileManager.new(@options, @shell, @output_dir)

        # Mock prettier availability at the instance level
        file_manager.instance_variable_set(:@prettier_available, true)

        # Mock process_batch_formatting to prevent actual processing during collection
        file_manager.stubs(:process_batch_formatting).returns({ processed: 0, errors: 0, time: 0.0 })

        content = "export interface Test {}"

        # Add first file - should not trigger processing
        file_manager.send(:collect_for_batch_formatting,
                         File.join(@output_dir, "test1.ts"), content, "test1.ts")
        assert_not file_manager.batch_ready_for_processing?

        # Manually add second file to queue to test ready condition
        file_manager.instance_variable_get(:@batch_queue) << {
          file_path: File.join(@output_dir, "test2.ts"),
          content: content,
          relative_path: "test2.ts",
          size: content.bytesize
        }

        assert file_manager.batch_ready_for_processing?
      end

      test "batch_ready_for_processing triggers on memory limit" do
        @options[:batch_max_memory_mb] = 0.001  # Set very low memory limit (1KB)
        create_package_json(@frontend_dir, dependencies: { "prettier" => "^2.0.0" })
        file_manager = FileManager.new(@options, @shell, @output_dir)

        # Create large content that exceeds memory limit
        large_content = "export interface LargeInterface {\n" +
                       (1..1000).map { |i| "  field#{i}: string;" }.join("\n") +
                       "\n}"

        # Add file - should trigger memory-based processing
        file_manager.send(:collect_for_batch_formatting,
                         File.join(@output_dir, "large.ts"), large_content, "large.ts")

        assert file_manager.batch_ready_for_processing?
      end

      test "process_batch_formatting handles empty queue gracefully" do
        create_package_json(@frontend_dir, dependencies: { "prettier" => "^2.0.0" })
        file_manager = FileManager.new(@options, @shell, @output_dir)

        result = file_manager.process_batch_formatting

        assert_equal 0, result[:processed]
        assert_equal 0, result[:errors]
        assert_equal 0.0, result[:time]
      end

      test "process_batch_formatting skips processing in dry_run mode" do
        @options[:dry_run] = true
        create_package_json(@frontend_dir, dependencies: { "prettier" => "^2.0.0" })
        file_manager = FileManager.new(@options, @shell, @output_dir)

        # Add file to queue
        content = "export interface User {}"
        file_manager.send(:collect_for_batch_formatting,
                         File.join(@output_dir, "user.ts"), content, "user.ts")

        result = file_manager.process_batch_formatting

        assert_equal 0, result[:processed]
        assert_equal 0, result[:errors]
      end

      test "execute_batch_prettier_command creates temporary directory structure" do
        create_package_json(@frontend_dir, dependencies: { "prettier" => "^2.0.0" })
        file_manager = FileManager.new(@options, @shell, @output_dir)

        # Mock system call to always succeed and File.read to return formatted content
        file_manager.stubs(:system).returns(true)
        File.stubs(:read).returns("formatted content")
        File.stubs(:write).returns(true)

        # Ensure output directory exists
        FileUtils.mkdir_p(@output_dir)

        # Add files to batch queue
        content1 = "export interface User { id: number; }"
        content2 = "export interface Post { title: string; }"

        file_manager.instance_variable_get(:@batch_queue) << {
          file_path: File.join(@output_dir, "user.ts"),
          content: content1,
          relative_path: "user.ts",
          size: content1.bytesize
        }

        file_manager.instance_variable_get(:@batch_queue) << {
          file_path: File.join(@output_dir, "post.ts"),
          content: content2,
          relative_path: "post.ts",
          size: content2.bytesize
        }

        result = file_manager.send(:execute_batch_prettier_command)

        assert result[:success]
        assert_equal 2, result[:files_processed]
      end

      test "execute_batch_prettier_command handles prettier command failure" do
        create_package_json(@frontend_dir, dependencies: { "prettier" => "^2.0.0" })
        file_manager = FileManager.new(@options, @shell, @output_dir)

        # Mock system call to fail
        file_manager.stubs(:system).returns(false)

        # Add file to batch queue
        content = "export interface User {}"
        file_manager.instance_variable_get(:@batch_queue) << {
          file_path: File.join(@output_dir, "user.ts"),
          content: content,
          relative_path: "user.ts",
          size: content.bytesize
        }

        result = file_manager.send(:execute_batch_prettier_command)

        assert_not result[:success]
        assert_equal "Prettier command failed", result[:error]
      end

      test "fallback_to_individual_formatting processes files individually" do
        create_package_json(@frontend_dir, dependencies: { "prettier" => "^2.0.0" })
        file_manager = FileManager.new(@options, @shell, @output_dir)

        # Mock format_with_prettier to avoid actual prettier calls
        file_manager.stubs(:format_with_prettier).returns("formatted content")

        # Add files to batch queue
        content1 = "export interface User {}"
        content2 = "export interface Post {}"
        file_path1 = File.join(@output_dir, "user.ts")
        file_path2 = File.join(@output_dir, "post.ts")

        # Ensure output directory exists
        FileUtils.mkdir_p(@output_dir)

        file_manager.instance_variable_get(:@batch_queue) << {
          file_path: file_path1,
          content: content1,
          relative_path: "user.ts",
          size: content1.bytesize
        }

        file_manager.instance_variable_get(:@batch_queue) << {
          file_path: file_path2,
          content: content2,
          relative_path: "post.ts",
          size: content2.bytesize
        }

        result = file_manager.send(:fallback_to_individual_formatting)

        assert_equal 2, result[:processed]
        assert_equal 0, result[:errors]

        # Verify files were written
        assert File.exist?(file_path1)
        assert File.exist?(file_path2)
      end

      test "fallback_to_individual_formatting handles individual formatting errors" do
        create_package_json(@frontend_dir, dependencies: { "prettier" => "^2.0.0" })
        file_manager = FileManager.new(@options, @shell, @output_dir)

        # Mock format_with_prettier to raise error for first file
        file_manager.stubs(:format_with_prettier).raises(StandardError, "Formatting failed").then.returns("formatted content")

        # Ensure output directory exists
        FileUtils.mkdir_p(@output_dir)

        # Add files to batch queue
        content1 = "export interface User {}"
        content2 = "export interface Post {}"
        file_path1 = File.join(@output_dir, "user.ts")
        file_path2 = File.join(@output_dir, "post.ts")

        file_manager.instance_variable_get(:@batch_queue) << {
          file_path: file_path1,
          content: content1,
          relative_path: "user.ts",
          size: content1.bytesize
        }

        file_manager.instance_variable_get(:@batch_queue) << {
          file_path: file_path2,
          content: content2,
          relative_path: "post.ts",
          size: content2.bytesize
        }

        result = file_manager.send(:fallback_to_individual_formatting)

        assert_equal 1, result[:processed]
        assert_equal 1, result[:errors]

        # Verify both files exist (error file should have original content)
        assert File.exist?(file_path1)
        assert File.exist?(file_path2)
        assert_equal content1, File.read(file_path1)  # Original content due to error
      end

      test "batch_status returns comprehensive status information" do
        @options[:batch_max_files] = 25
        @options[:batch_max_memory_mb] = 50
        create_package_json(@frontend_dir, dependencies: { "prettier" => "^2.0.0" })
        file_manager = FileManager.new(@options, @shell, @output_dir)

        status = file_manager.batch_status

        assert_equal 0, status[:queued_files]
        assert_equal 0.0, status[:memory_estimate_mb]
        assert_equal 25, status[:max_files]
        assert_equal 50, status[:max_memory_mb]
        assert status[:enabled]
      end

      test "batch processing disabled when option set" do
        @options[:disable_batch_formatting] = true
        create_package_json(@frontend_dir, dependencies: { "prettier" => "^2.0.0" })
        file_manager = FileManager.new(@options, @shell, @output_dir)

        status = file_manager.batch_status
        assert_not status[:enabled]

        # Should fall back to individual formatting when batch is disabled
        content = "export interface User {}"

        # Mock prettier availability and ensure directories exist
        file_manager.instance_variable_set(:@prettier_available, true)
        FileUtils.mkdir_p(@output_dir)

        # When batch processing is disabled, write_with_formatting should call format_with_prettier
        file_manager.stubs(:format_with_prettier).returns("formatted content")
        file_manager.stubs(:create_file_with_comparison).returns(:created)

        # Use write_with_formatting instead of collect_for_batch_formatting directly
        result = file_manager.write_with_formatting("user.ts", content)

        # Verify individual formatting was called by checking the file was created
        assert_equal File.join(@output_dir, "user.ts"), result
      end

      test "batch processing handles memory overflow correctly" do
        @options[:batch_max_memory_mb] = 0.01  # Very small limit (10KB)
        @options[:batch_max_files] = 10
        create_package_json(@frontend_dir, dependencies: { "prettier" => "^2.0.0" })
        file_manager = FileManager.new(@options, @shell, @output_dir)

        # Mock prettier availability at the instance level
        file_manager.instance_variable_set(:@prettier_available, true)

        # Mock process_batch_formatting to track calls
        batch_call_count = 0
        file_manager.stubs(:process_batch_formatting).with do
          batch_call_count += 1
          { processed: 1, errors: 0, time: 0.1 }
        end

        # Add multiple large files that exceed memory limit
        (1..3).each do |i|
          # Create content larger than the memory limit (10KB each = 30KB total)
          large_content = "export interface Large#{i} {\n" +
                         (1..1000).map { |j| "  field#{j}: string;" }.join("\n") +
                         "\n}"

          file_manager.send(:collect_for_batch_formatting,
                           File.join(@output_dir, "large#{i}.ts"),
                           large_content, "large#{i}.ts")
        end

        # Should have triggered batch processing multiple times due to memory limit
        assert batch_call_count > 0, "Should have triggered at least one batch processing due to memory overflow"
      end

      test "statistics tracking for batch operations" do
        create_package_json(@frontend_dir, dependencies: { "prettier" => "^2.0.0" })
        file_manager = FileManager.new(@options, @shell, @output_dir)

        # Mock successful batch processing
        file_manager.stubs(:execute_batch_prettier_command).returns({ success: true, files_processed: 3 })

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

        result = file_manager.process_batch_formatting

        assert_equal 3, result[:processed]
        assert_equal 0, result[:errors]

        # Verify statistics were updated
        stats = file_manager.statistics
        assert_equal 3, stats[:batch_formatted]
        assert_equal 3, stats[:formatted]
        assert_equal 1, stats[:batch_operations]
      end

      test "reset_statistics clears batch queue and memory estimate" do
        create_package_json(@frontend_dir, dependencies: { "prettier" => "^2.0.0" })
        @options[:batch_max_files] = 10  # Set high limit to prevent auto-processing
        file_manager = FileManager.new(@options, @shell, @output_dir)

        # Mock prettier availability at the instance level
        file_manager.instance_variable_set(:@prettier_available, true)

        # Add files to batch queue with larger content (~10KB)
        content = "export interface User {\n" +
                 (1..500).map { |i| "  field#{i}: string; // Field #{i} comment with extra text to increase size" }.join("\n") +
                 "\n}"
        file_manager.send(:collect_for_batch_formatting,
                         File.join(@output_dir, "user.ts"), content, "user.ts")

        # Verify queue has content
        assert_equal 1, file_manager.batch_status[:queued_files]
        assert file_manager.batch_status[:memory_estimate_mb] > 0

        # Reset statistics
        file_manager.reset_statistics

        # Verify queue and memory estimate are cleared
        assert_equal 0, file_manager.batch_status[:queued_files]
        assert_equal 0.0, file_manager.batch_status[:memory_estimate_mb]
        assert_equal 0, file_manager.statistics[:batch_formatted]
        assert_equal 0, file_manager.statistics[:batch_operations]
      end

      private

      def create_package_json(dir, dependencies: {}, dev_dependencies: {})
        FileUtils.mkdir_p(dir)

        package_json = {
          "name" => "test-project",
          "version" => "1.0.0"
        }

        package_json["dependencies"] = dependencies if dependencies.any?
        package_json["devDependencies"] = dev_dependencies if dev_dependencies.any?

        File.write(File.join(dir, "package.json"), JSON.pretty_generate(package_json))
      end
    end
  end
end
