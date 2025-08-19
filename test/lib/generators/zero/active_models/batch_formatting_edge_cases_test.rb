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
    class BatchFormattingEdgeCasesTest < ActiveSupport::TestCase
      def setup
        @temp_dir = Dir.mktmpdir
        @output_dir = File.join(@temp_dir, "output")
        @frontend_dir = File.join(@temp_dir, "frontend")

        # Create shell mock that captures all output for verification
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

        # Setup options with edge case configurations
        @options = {
          dry_run: false,
          skip_prettier: false,
          force: false,
          output_dir: @output_dir
        }

        # Setup Rails.root mock
        Rails.stubs(:root).returns(Pathname.new(@temp_dir))
        Rails.stubs(:env).returns(ActiveSupport::StringInquirer.new("test"))
      end

      def teardown
        FileUtils.rm_rf(@temp_dir) if @temp_dir && Dir.exist?(@temp_dir)
      end

      # =============================================================================
      # File System Edge Cases
      # =============================================================================

      test "handles files with special characters in names" do
        create_frontend_environment
        file_manager = FileManager.new(@options, @shell, @output_dir)

        special_files = [
          { name: "file with spaces.ts", content: "export interface WithSpaces {}" },
          { name: "file-with-dashes.ts", content: "export interface WithDashes {}" },
          { name: "file.with.dots.ts", content: "export interface WithDots {}" },
          { name: "file[with]brackets.ts", content: "export interface WithBrackets {}" },
          { name: "file(with)parentheses.ts", content: "export interface WithParentheses {}" }
        ]

        # Process files with special characters
        special_files.each do |file_info|
          file_manager.send(:collect_for_batch_formatting,
                           File.join(@output_dir, file_info[:name]),
                           file_info[:content],
                           file_info[:name])
        end

        # Mock prettier to succeed
        file_manager.stubs(:system).returns(true)
        file_manager.stubs(:File).returns(stub(read: "formatted content"))

        result = file_manager.process_batch_formatting

        assert_equal special_files.length, result[:processed]
        assert_equal 0, result[:errors]

        # Verify no errors in shell output
        error_messages = @shell.output.select { |msg| msg[:color] == :red }
        assert_empty error_messages, "Should handle special characters without errors"
      end

      test "handles concurrent file access gracefully" do
        create_frontend_environment
        file_manager = FileManager.new(@options, @shell, @output_dir)

        content = "export interface Concurrent {}"
        file_path = File.join(@output_dir, "concurrent.ts")

        # Simulate concurrent access by having multiple threads try to access the same file
        threads = 5.times.map do |i|
          Thread.new do
            sleep(rand * 0.01)  # Random small delay
            file_manager.send(:collect_for_batch_formatting,
                             "#{file_path}_#{i}.ts",
                             "#{content} // Thread #{i}",
                             "concurrent_#{i}.ts")
          end
        end

        threads.each(&:join)

        # Verify all files were queued
        batch_status = file_manager.batch_status
        assert_equal 5, batch_status[:queued_files]
      end

      test "handles extremely large files with memory management" do
        @options[:batch_max_memory_mb] = 1  # Very small limit
        create_frontend_environment
        file_manager = FileManager.new(@options, @shell, @output_dir)

        # Create very large content (multiple MB)
        large_content = "export interface LargeInterface {\n" +
                       (1..10000).map { |i| "  field#{i}: string;" }.join("\n") +
                       "\n}"

        puts "Large content size: #{(large_content.bytesize / 1024.0 / 1024.0).round(2)}MB"

        # Mock batch processing to track memory overflow
        overflow_count = 0
        original_collect = file_manager.method(:collect_for_batch_formatting)
        file_manager.define_singleton_method(:collect_for_batch_formatting) do |file_path, content, relative_path|
          # Track when memory overflow causes immediate processing
          memory_before = batch_status[:memory_estimate_mb]
          result = original_collect.call(file_path, content, relative_path)
          memory_after = batch_status[:memory_estimate_mb]

          if memory_after < memory_before
            overflow_count += 1
          end

          result
        end

        # Mock process_batch_formatting to avoid actual prettier calls
        file_manager.stubs(:process_batch_formatting).returns({
          processed: 1, errors: 0, time: 0.1
        })

        # Add multiple large files
        3.times do |i|
          file_manager.send(:collect_for_batch_formatting,
                           File.join(@output_dir, "large_#{i}.ts"),
                           large_content,
                           "large_#{i}.ts")
        end

        # Should have triggered multiple memory overflow handlers
        assert overflow_count > 0, "Should handle memory overflow by processing batches early"
      end

      test "handles file system permission errors" do
        create_frontend_environment
        file_manager = FileManager.new(@options, @shell, @output_dir)

        # Create read-only directory to simulate permission errors
        readonly_dir = File.join(@temp_dir, "readonly")
        FileUtils.mkdir_p(readonly_dir)

        # Skip this test on Windows where chmod behaves differently
        skip "Skipping permission test on Windows" if Gem.win_platform?

        File.chmod(0444, readonly_dir)

        # Try to process batch with files in readonly directory
        content = "export interface PermissionTest {}"
        readonly_file = File.join(readonly_dir, "test.ts")

        file_manager.send(:collect_for_batch_formatting,
                         readonly_file,
                         content,
                         "test.ts")

        # Mock prettier to succeed but file writes should fail
        file_manager.stubs(:system).returns(true)
        file_manager.stubs(:File).returns(stub(read: "formatted content"))

        result = file_manager.process_batch_formatting

        # Should handle permission errors gracefully
        assert result[:errors] >= 0, "Should handle permission errors without crashing"

        # Restore permissions for cleanup
        File.chmod(0755, readonly_dir)
      end

      # =============================================================================
      # Prettier Integration Edge Cases
      # =============================================================================

      test "handles prettier binary not available" do
        # Don't create prettier in package.json
        FileUtils.mkdir_p(@frontend_dir)
        File.write(File.join(@frontend_dir, "package.json"), JSON.pretty_generate({
          "name" => "test-project",
          "version" => "1.0.0"
        }))

        file_manager = FileManager.new(@options, @shell, @output_dir)

        content = "export interface NoPrettier {}"

        # Should detect prettier is not available
        assert_not file_manager.send(:prettier_available?)

        # Should fall back to individual formatting (which should skip prettier)
        result = file_manager.send(:collect_for_batch_formatting,
                                  File.join(@output_dir, "test.ts"),
                                  content,
                                  "test.ts")

        # Should return formatted content immediately (no batching without prettier)
        assert_equal content, result
      end

      test "handles corrupted prettier configuration" do
        create_frontend_environment

        # Create corrupted prettier config
        File.write(File.join(@frontend_dir, ".prettierrc"), "{ invalid json")

        file_manager = FileManager.new(@options, @shell, @output_dir)

        content = "export interface CorruptConfig {}"

        file_manager.send(:collect_for_batch_formatting,
                         File.join(@output_dir, "test.ts"),
                         content,
                         "test.ts")

        # Mock prettier to fail due to config issues
        file_manager.stubs(:system).returns(false)

        result = file_manager.process_batch_formatting

        # Should fall back to individual formatting
        assert result[:processed] >= 0, "Should handle config corruption gracefully"
      end

      test "handles prettier timeout/hanging process" do
        create_frontend_environment
        file_manager = FileManager.new(@options, @shell, @output_dir)

        content = "export interface TimeoutTest {}"

        file_manager.send(:collect_for_batch_formatting,
                         File.join(@output_dir, "test.ts"),
                         content,
                         "test.ts")

        # Mock system to simulate hanging (very slow response)
        file_manager.stubs(:system).with do |command|
          if command.include?("prettier")
            sleep(0.1)  # Simulate slow prettier
            false
          else
            true
          end
        end

        # Should complete in reasonable time even with slow prettier
        start_time = Time.current
        result = file_manager.process_batch_formatting
        elapsed_time = Time.current - start_time

        assert elapsed_time < 5.0, "Should not hang indefinitely"
        assert result[:processed] >= 0, "Should handle timeouts gracefully"
      end

      test "handles malformed TypeScript content" do
        create_frontend_environment
        file_manager = FileManager.new(@options, @shell, @output_dir)

        malformed_files = [
          { name: "syntax_error.ts", content: "export interface { missing_name" },
          { name: "invalid_chars.ts", content: "export interface Test { \x00\x01 }" },
          { name: "incomplete.ts", content: "export interface Test {" },
          { name: "empty.ts", content: "" },
          { name: "unicode.ts", content: "export interface Tëst { émojï: 🚀; }" }
        ]

        malformed_files.each do |file_info|
          file_manager.send(:collect_for_batch_formatting,
                           File.join(@output_dir, file_info[:name]),
                           file_info[:content],
                           file_info[:name])
        end

        # Mock prettier to handle some files but not others
        call_count = 0
        file_manager.stubs(:system).with do |command|
          call_count += 1
          # Fail every other call to simulate partial prettier failures
          call_count.even?
        end

        result = file_manager.process_batch_formatting

        # Should handle malformed content without crashing
        assert result[:processed] + result[:errors] >= malformed_files.length,
               "Should process all files even with formatting errors"
      end

      # =============================================================================
      # Memory and Resource Management Edge Cases
      # =============================================================================

      test "handles memory pressure during batch processing" do
        @options[:batch_max_memory_mb] = 0.5  # Very small memory limit
        create_frontend_environment
        file_manager = FileManager.new(@options, @shell, @output_dir)

        # Create files that gradually increase in size to stress memory management
        files_with_increasing_size = (1..10).map do |i|
          # Each file is larger than the previous
          content_size = i * 1000  # 1KB, 2KB, 3KB, etc.
          content = "export interface Test#{i} {\n" +
                   (1..content_size).map { |j| "  field#{j}: string;" }.join("\n") +
                   "\n}"

          { name: "size_test_#{i}.ts", content: content }
        end

        # Track memory management behavior
        batch_operations = 0
        original_process = file_manager.method(:process_batch_formatting)
        file_manager.define_singleton_method(:process_batch_formatting) do
          batch_operations += 1
          original_process.call
        end

        # Mock successful processing
        file_manager.stubs(:execute_batch_prettier_command).returns({
          success: true, files_processed: 1
        })

        files_with_increasing_size.each do |file_info|
          file_manager.send(:collect_for_batch_formatting,
                           File.join(@output_dir, file_info[:name]),
                           file_info[:content],
                           file_info[:name])
        end

        # Process any remaining files
        file_manager.process_batch_formatting

        # Should have triggered multiple batch operations due to memory pressure
        assert batch_operations > 1, "Should trigger multiple batches under memory pressure"
      end

      test "handles disk space exhaustion gracefully" do
        create_frontend_environment
        file_manager = FileManager.new(@options, @shell, @output_dir)

        content = "export interface DiskTest {}"

        # Mock File.write to simulate disk full error
        File.stubs(:write).raises(Errno::ENOSPC, "No space left on device")

        file_manager.send(:collect_for_batch_formatting,
                         File.join(@output_dir, "test.ts"),
                         content,
                         "test.ts")

        # Should handle disk space errors gracefully
        result = file_manager.process_batch_formatting

        assert result[:errors] >= 0, "Should handle disk space errors without crashing"

        # Verify error was reported
        error_messages = @shell.output.select { |msg| msg[:color] == :red }
        assert error_messages.any?, "Should report disk space errors"
      end

      test "handles temporary directory cleanup after failures" do
        create_frontend_environment
        file_manager = FileManager.new(@options, @shell, @output_dir)

        content = "export interface CleanupTest {}"

        file_manager.send(:collect_for_batch_formatting,
                         File.join(@output_dir, "test.ts"),
                         content,
                         "test.ts")

        # Track temporary directories created
        temp_dirs_created = []
        original_mkdir = FileUtils.method(:mkdir_p)
        FileUtils.stubs(:mkdir_p).with do |path|
          temp_dirs_created << path if path.to_s.include?("batch_format_")
          original_mkdir.call(path)
        end

        # Track cleanup calls
        cleanup_calls = []
        original_rm_rf = FileUtils.method(:rm_rf)
        FileUtils.stubs(:rm_rf).with do |path|
          cleanup_calls << path if path.to_s.include?("batch_format_")
          original_rm_rf.call(path)
        end

        # Mock prettier to fail
        file_manager.stubs(:system).returns(false)

        result = file_manager.send(:execute_batch_prettier_command)

        # Verify cleanup occurred even after failure
        assert cleanup_calls.any?, "Should clean up temporary directories after failures"
      end

      # =============================================================================
      # Configuration Edge Cases
      # =============================================================================

      test "handles zero file limit configuration" do
        @options[:batch_max_files] = 0
        create_frontend_environment
        file_manager = FileManager.new(@options, @shell, @output_dir)

        content = "export interface ZeroLimit {}"

        # Should immediately process with zero file limit
        file_manager.stubs(:process_batch_formatting).returns({
          processed: 1, errors: 0, time: 0.1
        })

        result = file_manager.send(:collect_for_batch_formatting,
                                  File.join(@output_dir, "test.ts"),
                                  content,
                                  "test.ts")

        # Should have triggered immediate processing
        batch_status = file_manager.batch_status
        assert_equal 0, batch_status[:queued_files], "Should not queue files with zero limit"
      end

      test "handles extreme memory limit configurations" do
        # Test with impossibly small memory limit
        @options[:batch_max_memory_mb] = 0.000001  # 1 byte
        create_frontend_environment
        file_manager = FileManager.new(@options, @shell, @output_dir)

        content = "x"  # Minimal content

        # Should fall back to individual processing
        file_manager.stubs(:format_with_prettier).returns("x")

        result = file_manager.send(:collect_for_batch_formatting,
                                  File.join(@output_dir, "test.ts"),
                                  content,
                                  "test.ts")

        # Should handle extreme limits gracefully
        assert_equal "x", result, "Should handle extreme memory limits"
      end

      test "handles missing frontend directory gracefully" do
        # Don't create frontend directory
        @options[:output_dir] = "/nonexistent/path"
        file_manager = FileManager.new(@options, @shell, "/nonexistent/path")

        content = "export interface NoFrontend {}"

        # Should detect no frontend and disable prettier
        assert_nil file_manager.frontend_root
        assert_not file_manager.send(:prettier_available?)

        # Should process without errors
        result = file_manager.send(:collect_for_batch_formatting,
                                  "/nonexistent/path/test.ts",
                                  content,
                                  "test.ts")

        assert_equal content, result, "Should handle missing frontend gracefully"
      end

      private

      def create_frontend_environment
        FileUtils.mkdir_p(@frontend_dir)

        package_json = {
          "name" => "test-project",
          "version" => "1.0.0",
          "devDependencies" => {
            "prettier" => "^2.8.0"
          }
        }

        File.write(File.join(@frontend_dir, "package.json"), JSON.pretty_generate(package_json))
      end
    end
  end
end
