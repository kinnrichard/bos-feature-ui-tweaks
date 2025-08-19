# frozen_string_literal: true

require "test_helper"
require "generators/zero/active_models/semantic_comparator"

module Zero
  module Generators
    class SemanticComparatorTest < ActiveSupport::TestCase
      def setup
        @comparator = SemanticComparator.new
      end

  test "identical content returns true" do
    content1 = "export interface User { id: number; name: string; }"
    content2 = "export interface User { id: number; name: string; }"

    assert @comparator.identical?(content1, content2)
  end

  test "different content returns false" do
    content1 = "export interface User { id: number; name: string; }"
    content2 = "export interface User { id: number; email: string; }"

    refute @comparator.identical?(content1, content2)
  end

  test "ignores timestamp differences" do
    content1 = <<~TYPESCRIPT
      // Generated from Rails schema: 2025-01-15 10:30:00 UTC
      export interface User {
        id: number;
        name: string;
      }
    TYPESCRIPT

    content2 = <<~TYPESCRIPT
      // Generated from Rails schema: 2025-01-16 11:45:30 UTC
      export interface User {
        id: number;
        name: string;
      }
    TYPESCRIPT

    assert @comparator.identical?(content1, content2)
  end

  test "ignores various timestamp patterns" do
    patterns = [
      "// Generated from Rails schema: 2025-01-15 10:30:00 UTC",
      "// Generated: 2025-01-15 10:30:00 UTC",
      "// Auto-generated: 2025-01-15 10:30:00 UTC",
      "/* Generated 2025-01-15 */",
      "// generated 2025-01-15",
      "// Auto-generated 2025-01-15"
    ]

    base_content = "export interface User { id: number; }"

    patterns.each do |pattern|
      content_with_timestamp = "#{pattern}\n#{base_content}"
      assert @comparator.identical?(base_content, content_with_timestamp),
             "Should ignore timestamp pattern: #{pattern}"
    end
  end

  test "ignores whitespace differences" do
    content1 = <<~TYPESCRIPT
      export interface User {
        id: number;
        name: string;
      }
    TYPESCRIPT

    content2 = <<~TYPESCRIPT
      export interface User {
          id: number;
          name:   string;
      }
    TYPESCRIPT

    assert @comparator.identical?(content1, content2)
  end

  test "handles empty content" do
    assert @comparator.identical?("", "")
    assert @comparator.identical?(nil, nil)
    refute @comparator.identical?("content", "")
    refute @comparator.identical?("", "content")
  end

  test "file_identical? with existing file" do
    content = "export interface User { id: number; }"

    with_temp_file(content) do |file_path|
      assert @comparator.file_identical?(file_path, content)
      refute @comparator.file_identical?(file_path, "different content")
    end
  end

  test "file_identical? with non-existent file" do
    refute @comparator.file_identical?("/non/existent/file.ts", "content")
  end

  test "file_identical? with unreadable file" do
    # Create a temp file and make it unreadable
    with_temp_file("content") do |file_path|
      File.chmod(0000, file_path)

      refute @comparator.file_identical?(file_path, "content")

      # Restore permissions for cleanup
      File.chmod(0644, file_path)
    end
  end

  test "custom timestamp patterns" do
    custom_patterns = [ /Custom timestamp: \d{4}-\d{2}-\d{2}/ ]
    custom_comparator = SemanticComparator.new(custom_patterns)

    content1 = <<~TYPESCRIPT
      // Custom timestamp: 2025-01-15
      export interface User { id: number; }
    TYPESCRIPT

    content2 = <<~TYPESCRIPT
      // Custom timestamp: 2025-01-16#{'  '}
      export interface User { id: number; }
    TYPESCRIPT

    assert custom_comparator.identical?(content1, content2)
  end

  test "content normalizer handles complex content" do
    normalizer = @comparator.normalizer

    content = <<~TYPESCRIPT
      // Generated from Rails schema: 2025-01-15 10:30:00 UTC

      export interface User {
        id:     number;
        name:   string;
      }

      // Auto-generated: 2025-01-15 10:30:00 UTC
      export interface Post {
        id: number;
      }
    TYPESCRIPT

    normalized = normalizer.normalize(content)

    # Should remove timestamp lines and normalize whitespace
    expected_lines = [
      "export interface User {",
      "id: number;",
      "name: string;",
      "}",
      "export interface Post {",
      "id: number;",
      "}"
    ]

    assert_equal expected_lines.join("\n"), normalized
  end

  test "normalizer preserves meaningful content structure" do
    normalizer = @comparator.normalizer

    content = <<~TYPESCRIPT
      export interface User {
        // This is an important comment
        id: number;
        name: string;
      }
    TYPESCRIPT

    normalized = normalizer.normalize(content)

    assert_includes normalized, "// This is an important comment"
  end

  private

  def with_temp_file(content)
    file = Tempfile.new([ "test", ".ts" ])
    file.write(content)
    file.close

    yield file.path
  ensure
    file&.unlink
  end
    end
  end
end
