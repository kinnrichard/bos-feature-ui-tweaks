# frozen_string_literal: true

require "test_helper"
require "tempfile"
require "fileutils"
require "generators/zero/active_models/file_manager"

module Zero
  module Generators
    class RefactoredFileManagerTest < ActiveSupport::TestCase
      def setup
    @temp_dir = Dir.mktmpdir("file_manager_test")
    @shell = MockShell.new
    @options = { verbose: true }
    @file_manager = FileManager.new(@options, @shell, @temp_dir)
  end

  def teardown
    FileUtils.rm_rf(@temp_dir) if Dir.exist?(@temp_dir)
  end

  # Mock shell class for testing
  class MockShell
    attr_reader :messages

    def initialize
      @messages = []
    end

    def say_status(type, message, color = nil)
      @messages << { type: type, message: message, color: color }
    end
  end

  test "delegates to FileWriter for file operations" do
    content = "export interface User { id: number; }"
    file_path = @file_manager.write_with_formatting("models/user.ts", content)

    # Verify file was created
    expected_path = File.join(@temp_dir, "models/user.ts")
    assert File.exist?(expected_path)
    assert_equal content, File.read(expected_path)
    assert_equal expected_path, file_path
  end

  test "provides shell feedback for operations" do
    @file_manager.write_with_formatting("user.ts", "content")

    create_message = @shell.messages.find { |m| m[:type] == :create }
    assert create_message
    assert_equal "user.ts", create_message[:message]
    assert_equal :green, create_message[:color]
  end

  test "reports identical files correctly" do
    content = "export interface User { id: number; }"

    # Write file first time
    @file_manager.write_with_formatting("user.ts", content)
    @shell.messages.clear

    # Write same content again
    @file_manager.write_with_formatting("user.ts", content)

    identical_message = @shell.messages.find { |m| m[:type] == :identical }
    assert identical_message
    assert_equal "user.ts", identical_message[:message]
    assert_equal :blue, identical_message[:color]
  end

  test "statistics return legacy format" do
    @file_manager.write_with_formatting("file1.ts", "content1")
    @file_manager.write_with_formatting("file2.ts", "content2")
    @file_manager.write_with_formatting("file1.ts", "content1")  # identical

    stats = @file_manager.statistics

    # Legacy format compatibility
    assert_equal 2, stats[:created]
    assert_equal 1, stats[:identical]
    assert_equal 0, stats[:errors]
    assert_equal 2, stats[:directories_created]

    # Legacy formatting stats (no longer used)
    assert_equal 0, stats[:formatted]
    assert_equal 0, stats[:batch_formatted]
    assert_equal 0, stats[:batch_operations]
  end

  test "reset_statistics works" do
    @file_manager.write_with_formatting("user.ts", "content")
    assert_equal 1, @file_manager.statistics[:created]

    @file_manager.reset_statistics
    stats = @file_manager.statistics
    assert_equal 0, stats[:created]
    assert_equal 0, stats[:identical]
  end

  test "ensure_directory_exists legacy method" do
    dir_path = File.join(@temp_dir, "nested", "directory")
    refute Dir.exist?(dir_path)

    result = @file_manager.ensure_directory_exists(dir_path)
    assert result
    assert Dir.exist?(dir_path)
  end

  test "semantic_comparison_enabled respects options" do
    # Default behavior (semantic comparison enabled)
    assert @file_manager.semantic_comparison_enabled?

    # Force mode disables semantic comparison
    force_manager = FileManager.new({ force: true }, @shell, @temp_dir)
    refute force_manager.semantic_comparison_enabled?

    # Dry run mode disables semantic comparison
    dry_run_manager = FileManager.new({ dry_run: true }, @shell, @temp_dir)
    refute dry_run_manager.semantic_comparison_enabled?
  end

  test "ignores format and defer_write parameters" do
    content = "export interface User { id: number; }"

    # These parameters should be ignored in the new implementation
    file_path = @file_manager.write_with_formatting(
      "user.ts",
      content,
      format: false,  # Ignored
      defer_write: true  # Ignored
    )

    # File should still be written normally
    expected_path = File.join(@temp_dir, "user.ts")
    assert File.exist?(expected_path)
    assert_equal content, File.read(expected_path)
  end

  test "backward compatibility with existing interface" do
    # Test that all expected methods exist
    assert_respond_to @file_manager, :write_with_formatting
    assert_respond_to @file_manager, :statistics
    assert_respond_to @file_manager, :reset_statistics
    assert_respond_to @file_manager, :ensure_directory_exists
    assert_respond_to @file_manager, :semantic_comparison_enabled?

    # Test that expected attributes are accessible
    assert_equal @options, @file_manager.options
    assert_equal @shell, @file_manager.shell
    assert_equal @temp_dir, @file_manager.output_dir
    assert_respond_to @file_manager, :file_writer
  end

  test "handles dry run mode" do
    dry_run_manager = FileManager.new({ dry_run: true }, @shell, @temp_dir)

    file_path = dry_run_manager.write_with_formatting("user.ts", "content")

    # File should not be created in dry run
    expected_path = File.join(@temp_dir, "user.ts")
    refute File.exist?(expected_path)

    # But should still return the expected path
    assert_equal expected_path, file_path
  end

  test "handles force mode" do
    force_manager = FileManager.new({ force: true }, @shell, @temp_dir)
    content = "export interface User { id: number; }"

    # Write file twice with same content
    force_manager.write_with_formatting("user.ts", content)
    force_manager.write_with_formatting("user.ts", content)

    # Both should be written (not skipped) in force mode
    stats = force_manager.statistics
    assert_equal 2, stats[:created]
    assert_equal 0, stats[:identical]
  end

  test "error handling reports to shell" do
    # Create a scenario that will cause an error
    # Write to a path where directory creation will fail
    conflicting_file = File.join(@temp_dir, "conflict")
    File.write(conflicting_file, "existing file")

    @file_manager.write_with_formatting("conflict/user.ts", "content")

    error_message = @shell.messages.find { |m| m[:type] == :error }
    assert error_message
    assert_equal "conflict/user.ts", error_message[:message]
    assert_equal :red, error_message[:color]
  end

  test "no shell provided works without errors" do
    no_shell_manager = FileManager.new(@options, nil, @temp_dir)

    # Should work without errors even with no shell
    assert_nothing_raised do
      no_shell_manager.write_with_formatting("user.ts", "content")
    end

    file_path = File.join(@temp_dir, "user.ts")
    assert File.exist?(file_path)
  end

  test "FileWriter is properly initialized with options" do
    file_writer = @file_manager.file_writer

    assert_instance_of FileWriter, file_writer
    assert_equal @temp_dir, file_writer.output_dir
  end

  test "maintains compatibility with old constants" do
    # Legacy constants should still exist
    assert_equal :created, FileManager::OPERATION_RESULTS[:created]
    assert_equal :identical, FileManager::OPERATION_RESULTS[:identical]
    assert_equal :error, FileManager::OPERATION_RESULTS[:error]
  end

  test "semantic comparison works with timestamps" do
    content_with_timestamp1 = <<~TYPESCRIPT
      // Generated from Rails schema: 2025-01-15 10:30:00 UTC
      export interface User { id: number; name: string; }
    TYPESCRIPT

    content_with_timestamp2 = <<~TYPESCRIPT
      // Generated from Rails schema: 2025-01-16 11:45:30 UTC
      export interface User { id: number; name: string; }
    TYPESCRIPT

    # Write first version
    @file_manager.write_with_formatting("user.ts", content_with_timestamp1)
    @shell.messages.clear

    # Write second version with different timestamp - should be skipped
    @file_manager.write_with_formatting("user.ts", content_with_timestamp2)

    identical_message = @shell.messages.find { |m| m[:type] == :identical }
    assert identical_message, "Expected identical message for timestamp-only change"

    stats = @file_manager.statistics
    assert_equal 1, stats[:created]
    assert_equal 1, stats[:identical]
  end

  test "complex directory structures are handled" do
    deep_path = "very/deep/nested/directory/structure/file.ts"
    content = "export interface Deep { level: number; }"

    file_path = @file_manager.write_with_formatting(deep_path, content)

    expected_path = File.join(@temp_dir, deep_path)
    assert File.exist?(expected_path)
    assert_equal content, File.read(expected_path)
    assert_equal expected_path, file_path
  end
    end
  end
end
