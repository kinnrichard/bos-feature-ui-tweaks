# frozen_string_literal: true

require "test_helper"
require "generators/zero/active_models/migration/output_comparator"

class OutputComparatorTest < ActiveSupport::TestCase
  def setup
    @comparator = Zero::Generators::Migration::OutputComparator.new
    @legacy_result = build_legacy_result
    @new_result = build_new_result
  end

  # Basic Comparison Tests

  test "initializes with default configuration" do
    comparator = Zero::Generators::Migration::OutputComparator.new

    assert_equal 50, comparator.config[:performance_tolerance_ms]
    assert_equal true, comparator.config[:compare_file_checksums]
    assert_equal false, comparator.config[:ignore_whitespace_differences]
  end

  test "accepts custom configuration" do
    comparator = Zero::Generators::Migration::OutputComparator.new(
      performance_tolerance_ms: 100,
      ignore_whitespace_differences: true
    )

    assert_equal 100, comparator.config[:performance_tolerance_ms]
    assert_equal true, comparator.config[:ignore_whitespace_differences]
  end

  test "compares identical results successfully" do
    result = @comparator.compare(@legacy_result, @legacy_result.dup)

    assert result.overall_match
    assert_empty result.critical_discrepancies
    assert_empty result.discrepancies
  end

  test "detects success status differences" do
    new_result = @new_result.merge(success: false)

    result = @comparator.compare(@legacy_result, new_result)

    assert_not result.overall_match
    assert_equal 1, result.critical_discrepancies.length
    assert_equal :success_status, result.critical_discrepancies.first[:type]
  end

  # Count Comparison Tests

  test "detects model count differences" do
    new_result = @new_result.merge(
      generated_models: [
        { table_name: "users", class_name: "User" },
        { table_name: "posts", class_name: "Post" },
        { table_name: "comments", class_name: "Comment" } # Extra model
      ]
    )

    result = @comparator.compare(@legacy_result, new_result)

    assert_not result.overall_match
    critical_discrepancies = result.critical_discrepancies
    model_count_discrepancy = critical_discrepancies.find { |d| d[:type] == :model_count }

    assert_not_nil model_count_discrepancy
    assert_includes model_count_discrepancy[:message], "legacy=2, new=3"
  end

  test "detects file count differences" do
    new_result = @new_result.merge(
      generated_files: [
        { path: "user.ts", content: "user content" },
        { path: "post.ts", content: "post content" },
        { path: "extra.ts", content: "extra content" }
      ]
    )

    result = @comparator.compare(@legacy_result, new_result)

    assert_not result.overall_match
    file_count_discrepancy = result.critical_discrepancies.find { |d| d[:type] == :file_count }

    assert_not_nil file_count_discrepancy
    assert_includes file_count_discrepancy[:message], "legacy=2, new=3"
  end

  test "respects acceptable count differences" do
    comparator = Zero::Generators::Migration::OutputComparator.new(
      acceptable_model_count_difference: 1,
      acceptable_file_count_difference: 1
    )

    new_result = @new_result.merge(
      generated_models: @new_result[:generated_models] + [ { table_name: "extra", class_name: "Extra" } ],
      generated_files: @new_result[:generated_files] + [ { path: "extra.ts", content: "extra" } ]
    )

    result = comparator.compare(@legacy_result, new_result)

    # Should not have count discrepancies due to tolerance
    count_discrepancies = result.critical_discrepancies.select { |d| [ :model_count, :file_count ].include?(d[:type]) }
    assert_empty count_discrepancies
  end

  # File Content Comparison Tests

  test "compares file content with checksums" do
    # Files with identical content should match
    result = @comparator.compare(@legacy_result, @new_result)

    file_comparisons = result.file_comparisons
    assert_equal 2, file_comparisons.length
    assert file_comparisons.all? { |fc| fc[:matches] }
  end

  test "detects file content differences" do
    new_result = @new_result.dup
    new_result[:generated_files][0] = { path: "user.ts", content: "DIFFERENT user content" }

    result = @comparator.compare(@legacy_result, new_result)

    assert_not result.overall_match
    file_content_discrepancy = result.critical_discrepancies.find { |d| d[:type] == :file_content }

    assert_not_nil file_content_discrepancy
    assert_includes file_content_discrepancy[:message], "user.ts"
  end

  test "handles files only in one system" do
    legacy_result = @legacy_result.merge(
      generated_files: @legacy_result[:generated_files] + [ { path: "legacy_only.ts", content: "legacy content" } ]
    )

    new_result = @new_result.merge(
      generated_files: @new_result[:generated_files] + [ { path: "new_only.ts", content: "new content" } ]
    )

    result = @comparator.compare(legacy_result, new_result)

    assert_not result.overall_match

    discrepancy_messages = result.critical_discrepancies.map { |d| d[:message] }
    assert discrepancy_messages.any? { |msg| msg.include?("legacy_only.ts") }
    assert discrepancy_messages.any? { |msg| msg.include?("new_only.ts") }
  end

  test "normalizes content when configured" do
    comparator = Zero::Generators::Migration::OutputComparator.new(
      ignore_whitespace_differences: true
    )

    legacy_result = @legacy_result.merge(
      generated_files: [ { path: "test.ts", content: "export  class   User {\n  name: string;\n}" } ]
    )

    new_result = @new_result.merge(
      generated_files: [ { path: "test.ts", content: "export class User { name: string; }" } ]
    )

    result = comparator.compare(legacy_result, new_result)

    # Should match due to whitespace normalization
    file_comparison = result.file_comparisons.first
    assert file_comparison[:matches], "Expected whitespace differences to be ignored"
  end

  test "ignores timestamp differences when configured" do
    comparator = Zero::Generators::Migration::OutputComparator.new(
      ignore_timestamp_differences: true
    )

    legacy_content = "// Generated: 2025-01-01 12:00:00\nexport class User {}"
    new_content = "// Generated: 2025-01-02 15:30:00\nexport class User {}"

    legacy_result = @legacy_result.merge(
      generated_files: [ { path: "test.ts", content: legacy_content } ]
    )

    new_result = @new_result.merge(
      generated_files: [ { path: "test.ts", content: new_content } ]
    )

    result = comparator.compare(legacy_result, new_result)

    file_comparison = result.file_comparisons.first
    assert file_comparison[:matches], "Expected timestamp differences to be ignored"
  end

  # Performance Analysis Tests

  test "analyzes performance differences" do
    legacy_result = @legacy_result.merge(execution_time: 0.1)
    new_result = @new_result.merge(execution_time: 0.15)

    result = @comparator.compare(legacy_result, new_result)

    performance = result.performance_analysis

    assert_equal 100, performance[:legacy_time_ms]
    assert_equal 150, performance[:new_time_ms]
    assert_equal 50, performance[:performance_difference_ms]
    assert performance[:legacy_faster]
    assert_not performance[:new_faster]
  end

  test "detects performance regression" do
    comparator = Zero::Generators::Migration::OutputComparator.new(
      performance_tolerance_ms: 10,
      performance_regression_threshold: 1.3
    )

    legacy_result = @legacy_result.merge(execution_time: 0.1)
    new_result = @new_result.merge(execution_time: 0.2) # 100% slower

    result = comparator.compare(legacy_result, new_result)

    performance_discrepancy = result.warning_discrepancies.find { |d| d[:type] == :performance_regression }

    assert_not_nil performance_discrepancy
    assert_includes performance_discrepancy[:message], "100ms slower"
  end

  test "handles performance within tolerance" do
    legacy_result = @legacy_result.merge(execution_time: 0.1)
    new_result = @new_result.merge(execution_time: 0.12) # 20ms difference, within 50ms tolerance

    result = @comparator.compare(@legacy_result, new_result)

    performance = result.performance_analysis
    assert performance[:within_tolerance]

    # Should not have performance regression discrepancy
    performance_discrepancies = result.discrepancies.select { |d| d[:type] == :performance_regression }
    assert_empty performance_discrepancies
  end

  # Model Structure Comparison Tests

  test "compares model structures" do
    result = @comparator.compare(@legacy_result, @new_result)

    model_comparisons = result.model_comparisons
    assert_equal 2, model_comparisons.length
    assert model_comparisons.all? { |mc| mc[:matches] }
  end

  test "detects model structure differences" do
    new_result = @new_result.dup
    new_result[:generated_models][0] = {
      table_name: "users",
      class_name: "DifferentUser", # Changed class name
      kebab_name: "different-user"
    }

    result = @comparator.compare(@legacy_result, new_result)

    assert_not result.overall_match

    model_structure_discrepancy = result.critical_discrepancies.find { |d| d[:type] == :model_structure }
    assert_not_nil model_structure_discrepancy
  end

  # Large File Handling Tests

  test "handles large files with size-only comparison" do
    large_content = "x" * (2 * 1024 * 1024) # 2MB content

    comparator = Zero::Generators::Migration::OutputComparator.new(
      max_file_size_for_content_comparison: 1024 * 1024 # 1MB limit
    )

    legacy_result = @legacy_result.merge(
      generated_files: [ { path: "large.ts", content: large_content } ]
    )

    new_result = @new_result.merge(
      generated_files: [ { path: "large.ts", content: large_content } ]
    )

    result = comparator.compare(legacy_result, new_result)

    file_comparison = result.file_comparisons.first
    assert_equal "size_only", file_comparison[:comparison_type]
    assert file_comparison[:matches]
  end

  # Report Generation Tests

  test "generates comprehensive comparison report" do
    legacy_result = @legacy_result.merge(execution_time: 0.1)
    new_result = @new_result.merge(
      success: false, # Create discrepancy
      execution_time: 0.15
    )

    result = @comparator.compare(legacy_result, new_result)
    report = @comparator.generate_report(result)

    assert_includes report, "# Canary Test Comparison Report"
    assert_includes report, "OVERALL STATUS: DISCREPANCIES DETECTED"
    assert_includes report, "Critical discrepancies: 1"
    assert_includes report, "## Performance Analysis"
    assert_includes report, "Legacy execution time: 100.0ms"
    assert_includes report, "New execution time: 150.0ms"
  end

  test "generates successful comparison report" do
    result = @comparator.compare(@legacy_result, @new_result)
    report = @comparator.generate_report(result)

    assert_includes report, "OVERALL STATUS: MATCH"
    assert_includes report, "Critical discrepancies: 0"
  end

  # Error Handling Tests

  test "handles comparison errors gracefully" do
    # Simulate an error during comparison by passing invalid data
    invalid_legacy = { invalid: "data" }

    result = @comparator.compare(invalid_legacy, @new_result)

    assert_not result.overall_match
    assert result.discrepancies.any? { |d| d[:type] == :comparison_error }
  end

  # File Path Comparison Tests

  test "compare_files_at_path compares specific files" do
    # Create temporary files for testing
    legacy_file = Tempfile.new([ "legacy", ".ts" ])
    new_file = Tempfile.new([ "new", ".ts" ])

    begin
      legacy_file.write("export class User { name: string; }")
      legacy_file.flush

      new_file.write("export class User { name: string; }")
      new_file.flush

      result = @comparator.compare_files_at_path(legacy_file.path, new_file.path)

      assert result[:matches]
      assert_equal "content", result[:comparison_type]

    ensure
      legacy_file.close
      legacy_file.unlink
      new_file.close
      new_file.unlink
    end
  end

  test "compare_files_at_path handles missing files" do
    result = @comparator.compare_files_at_path("/nonexistent/file1.ts", "/nonexistent/file2.ts")

    assert_includes result, :error
    assert_includes result[:error], "Could not read files"
  end

  # Discrepancy Classification Tests

  test "classifies discrepancies by severity" do
    new_result = @new_result.merge(
      success: false, # Critical
      execution_time: 0.5 # Performance warning
    )

    comparator = Zero::Generators::Migration::OutputComparator.new(
      performance_tolerance_ms: 10,
      performance_regression_threshold: 1.2
    )

    result = comparator.compare(@legacy_result.merge(execution_time: 0.1), new_result)

    assert_equal 1, result.critical_discrepancies.length
    assert_equal 1, result.warning_discrepancies.length
    assert_equal 0, result.info_discrepancies.length
  end

  private

  def build_legacy_result
    {
      success: true,
      generated_models: [
        { table_name: "users", class_name: "User", kebab_name: "user" },
        { table_name: "posts", class_name: "Post", kebab_name: "post" }
      ],
      generated_files: [
        { path: "user.ts", content: "export class User { name: string; }" },
        { path: "post.ts", content: "export class Post { title: string; }" }
      ],
      errors: [],
      execution_time: 0.1,
      statistics: { models_generated: 2, files_created: 2 }
    }
  end

  def build_new_result
    {
      success: true,
      generated_models: [
        { table_name: "users", class_name: "User", kebab_name: "user" },
        { table_name: "posts", class_name: "Post", kebab_name: "post" }
      ],
      generated_files: [
        { path: "user.ts", content: "export class User { name: string; }" },
        { path: "post.ts", content: "export class Post { title: string; }" }
      ],
      errors: [],
      execution_time: 0.12,
      statistics: { models_generated: 2, files_created: 2 }
    }
  end
end
