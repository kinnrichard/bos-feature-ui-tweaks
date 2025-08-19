# frozen_string_literal: true

require "test_helper"
require "tempfile"
require "fileutils"
require "generators/zero/active_models/file_writer"

module Zero
  module Generators
    class FileWriterTest < ActiveSupport::TestCase
      def setup
    @temp_dir = Dir.mktmpdir("file_writer_test")
    @writer = FileWriter.new(@temp_dir)
  end

  def teardown
    FileUtils.rm_rf(@temp_dir) if Dir.exist?(@temp_dir)
  end

  test "writes new file successfully" do
    content = "export interface User { id: number; }"
    result = @writer.write("models/user.ts", content)

    assert_equal :created, result
    assert_equal 1, @writer.statistics[:written]

    file_path = File.join(@temp_dir, "models/user.ts")
    assert File.exist?(file_path)
    assert_equal content, File.read(file_path)
  end

  test "creates directories as needed" do
    content = "export interface User { id: number; }"
    @writer.write("nested/deep/models/user.ts", content)

    dir_path = File.join(@temp_dir, "nested/deep/models")
    assert Dir.exist?(dir_path)
    assert_equal 1, @writer.statistics[:directories_created]
  end

  test "skips identical files" do
    content = "export interface User { id: number; }"
    file_path = File.join(@temp_dir, "user.ts")

    # Write file first time
    result1 = @writer.write("user.ts", content)
    assert_equal :created, result1

    # Write same content again
    result2 = @writer.write("user.ts", content)
    assert_equal :identical, result2
    assert_equal 1, @writer.statistics[:written]
    assert_equal 1, @writer.statistics[:skipped]
  end

  test "overwrites when content differs" do
    file_path = File.join(@temp_dir, "user.ts")

    # Write initial content
    result1 = @writer.write("user.ts", "original content")
    assert_equal :created, result1

    # Write different content
    new_content = "new content"
    result2 = @writer.write("user.ts", new_content)
    assert_equal :created, result2

    assert_equal new_content, File.read(file_path)
    assert_equal 2, @writer.statistics[:written]
  end

  test "respects dry run mode" do
    writer = FileWriter.new(@temp_dir, dry_run: true)

    result = writer.write("user.ts", "content")
    assert_equal :identical, result  # dry run always returns identical

    file_path = File.join(@temp_dir, "user.ts")
    refute File.exist?(file_path)
    assert_equal 0, writer.statistics[:written]
  end

  test "respects force mode" do
    content = "export interface User { id: number; }"
    file_path = File.join(@temp_dir, "user.ts")

    writer = FileWriter.new(@temp_dir, force: true)

    # Write file first time
    result1 = writer.write("user.ts", content)
    assert_equal :created, result1

    # Write same content with force - should write anyway
    result2 = writer.write("user.ts", content)
    assert_equal :created, result2
    assert_equal 2, writer.statistics[:written]
    assert_equal 0, writer.statistics[:skipped]
  end

  test "handles write errors gracefully" do
    # Create a directory where we want to write a file to force an error
    conflicting_dir = File.join(@temp_dir, "conflict")
    Dir.mkdir(conflicting_dir)

    result = @writer.write("conflict", "content")
    assert_equal :error, result
    assert_equal 1, @writer.statistics[:errors]
  end

  test "write_batch processes multiple files" do
    files = [
      { path: "models/user.ts", content: "export interface User {}" },
      { path: "models/post.ts", content: "export interface Post {}" },
      { path: "types/index.ts", content: "export * from './models'" }
    ]

    results = @writer.write_batch(files)

    assert_equal 3, results.length
    results.each { |result| assert_equal :created, result[:result] }
    assert_equal 3, @writer.statistics[:written]

    # Verify files exist
    files.each do |file|
      file_path = File.join(@temp_dir, file[:path])
      assert File.exist?(file_path)
      assert_equal file[:content], File.read(file_path)
    end
  end

  test "statistics track all operations" do
    # Create some files
    @writer.write("file1.ts", "content1")
    @writer.write("file2.ts", "content2")

    # Write identical content (should be skipped)
    @writer.write("file1.ts", "content1")

    stats = @writer.statistics
    assert_equal 2, stats[:written]
    assert_equal 1, stats[:skipped]
    assert_equal 0, stats[:errors]
    assert_equal 2, stats[:directories_created]  # root dir for each file
  end

  test "reset_statistics clears counters" do
    @writer.write("file1.ts", "content")
    assert_equal 1, @writer.statistics[:written]

    @writer.reset_statistics
    stats = @writer.statistics
    assert_equal 0, stats[:written]
    assert_equal 0, stats[:skipped]
    assert_equal 0, stats[:errors]
    assert_equal 0, stats[:directories_created]
  end

  test "uses custom semantic comparator" do
    # Create a mock comparator that always says files are identical
    always_identical_comparator = Class.new do
      def file_identical?(file_path, content)
        true
      end
    end.new

    writer = FileWriter.new(@temp_dir, {}, always_identical_comparator)

    # Even though file doesn't exist, comparator says it's identical
    result = writer.write("user.ts", "content")
    assert_equal :identical, result
    assert_equal 1, writer.statistics[:skipped]
  end

  test "verbose logging works" do
    writer = FileWriter.new(@temp_dir, verbose: true)

    # Capture stdout
    output = capture_io do
      writer.write("user.ts", "content")
    end

    assert_match /create.*user\.ts/, output[0]
  end

  test "handles absolute output directory" do
    absolute_path = File.expand_path(@temp_dir)
    writer = FileWriter.new(absolute_path)

    result = writer.write("test.ts", "content")
    assert_equal :created, result

    file_path = File.join(absolute_path, "test.ts")
    assert File.exist?(file_path)
  end

  test "handles relative output directory with Rails root" do
    # Mock Rails.root
    Rails.stub(:root, Pathname.new(@temp_dir)) do
      writer = FileWriter.new("output")

      result = writer.write("test.ts", "content")
      assert_equal :created, result

      file_path = File.join(@temp_dir, "output", "test.ts")
      assert File.exist?(file_path)
    end
  end

  test "directory creation failure is handled" do
    # Mock FileUtils.mkdir_p to raise an error
    FileUtils.stub(:mkdir_p, proc { raise "Permission denied" }) do
      result = @writer.write("nested/file.ts", "content")
      assert_equal :error, result
      assert_equal 1, @writer.statistics[:errors]
    end
  end

  test "semantic comparison with timestamps ignored" do
    content_with_timestamp1 = <<~TYPESCRIPT
      // Generated: 2025-01-15 10:30:00 UTC
      export interface User { id: number; }
    TYPESCRIPT

    content_with_timestamp2 = <<~TYPESCRIPT
      // Generated: 2025-01-16 11:45:00 UTC
      export interface User { id: number; }
    TYPESCRIPT

    # Write first version
    result1 = @writer.write("user.ts", content_with_timestamp1)
    assert_equal :created, result1

    # Write second version with different timestamp - should be skipped
    result2 = @writer.write("user.ts", content_with_timestamp2)
    assert_equal :identical, result2
    assert_equal 1, @writer.statistics[:skipped]
  end

  private

  def capture_io
    old_stdout = $stdout
    old_stderr = $stderr
    $stdout = StringIO.new
    $stderr = StringIO.new

    yield

    [ $stdout.string, $stderr.string ]
  ensure
    $stdout = old_stdout
    $stderr = old_stderr
  end
    end
  end
end
