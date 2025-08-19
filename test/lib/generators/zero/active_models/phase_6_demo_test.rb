# frozen_string_literal: true

require "test_helper"
require "fileutils"
require "tmpdir"
require "open3"

class Phase6DemoTest < ActiveSupport::TestCase
  # Disable transactional tests for external command testing
  self.use_transactional_tests = false
  self.use_instantiated_fixtures = false
  self.fixture_table_names = []

  def setup
    @temp_dir = Dir.mktmpdir("phase_6_demo_test")
    @output_dir = File.join(@temp_dir, "generated_models")
    FileUtils.mkdir_p(@output_dir)

    # Store original working directory
    @original_dir = Dir.pwd
  end

  def teardown
    Dir.chdir(@original_dir) if @original_dir
    FileUtils.rm_rf(@temp_dir) if @temp_dir && Dir.exist?(@temp_dir)
  end

  # ===============================================
  # PHASE 6 DEMONSTRATION TESTS
  # ===============================================

  test "end_to_end_workflow_generator_dry_run_validation" do
    # Test that the generator can be invoked and reports expected files
    result = run_generator_command([
      "zero:active_models",
      "--dry-run"
    ])

    assert result[:success], "Generator dry run should succeed: #{result[:stderr]}"

    # Verify expected output patterns
    assert_match(/DRY RUN MODE/, result[:stdout])
    assert_match(/Would create:.*user\.ts/, result[:stdout])
    assert_match(/Would create:.*reactive-user\.ts/, result[:stdout])
    assert_match(/Would create:.*types\/user-data\.ts/, result[:stdout])
    assert_match(/Would create:.*job\.ts/, result[:stdout])
    assert_match(/Would create:.*task\.ts/, result[:stdout])

    # Verify multiple models are detected
    model_count = result[:stdout].scan(/Would create:.*\.ts/).length
    assert model_count >= 30, "Should detect substantial number of files to generate: #{model_count}"
  end

  test "end_to_end_workflow_specific_table_filtering" do
    # Test table-specific generation workflow
    result = run_generator_command([
      "zero:active_models",
      "--table=users",
      "--dry-run"
    ])

    assert result[:success], "Table-specific generation should succeed: #{result[:stderr]}"

    # Should only show user-related files
    assert_match(/Would create:.*user\.ts/, result[:stdout])
    assert_match(/Would create:.*reactive-user\.ts/, result[:stdout])
    assert_match(/Would create:.*types\/user-data\.ts/, result[:stdout])

    # Should not show other tables
    refute_match(/Would create:.*job\.ts/, result[:stdout])
    refute_match(/Would create:.*task\.ts/, result[:stdout])
  end

  test "production_readiness_validation_dry_run" do
    # Test production environment configuration
    old_env = ENV["RAILS_ENV"]
    ENV["RAILS_ENV"] = "production"

    begin
      result = run_generator_command([
        "zero:active_models",
        "--dry-run"
      ])

      assert result[:success], "Production dry run should succeed: #{result[:stderr]}"

      # Verify production mode execution
      assert_match(/DRY RUN MODE/, result[:stdout])

      # Should still generate expected files in production
      assert_match(/Would create:.*\.ts/, result[:stdout])

    ensure
      ENV["RAILS_ENV"] = old_env
    end
  end

  test "error_handling_invalid_table_workflow" do
    # Test error handling for invalid tables
    result = run_generator_command([
      "zero:active_models",
      "--table=nonexistent_table",
      "--dry-run"
    ])

    refute result[:success], "Should fail gracefully for invalid table"

    # Should provide clear error message
    assert_match(/No tables found/, result[:stderr])

    # Should not crash or expose sensitive information
    refute_match(/Exception|Error:|Traceback/i, result[:stderr])
  end

  test "external_tool_integration_validation" do
    # Test that generator supports external tool integration patterns
    result = run_generator_command([
      "zero:active_models",
      "--skip-prettier",
      "--dry-run"
    ])

    assert result[:success], "Skip-prettier option should work: #{result[:stderr]}"

    # Should still generate TypeScript files
    assert_match(/Would create:.*\.ts/, result[:stdout])

    # Test custom output directory (simulating external tool integration)
    result2 = run_generator_command([
      "zero:active_models",
      "--output-dir=custom/path",
      "--dry-run"
    ])

    assert result2[:success], "Custom output directory should work: #{result2[:stderr]}"
    assert_match(/Output directory:.*custom\/path/, result2[:stdout])
  end

  test "workflow_consistency_across_multiple_runs" do
    # Test that multiple dry runs produce consistent output
    results = []

    3.times do
      result = run_generator_command([
        "zero:active_models",
        "--table=users",
        "--dry-run"
      ])

      assert result[:success], "Each run should succeed"
      results << result[:stdout]
    end

    # All runs should produce identical output
    results[1..-1].each_with_index do |output, index|
      assert_equal results[0], output,
                  "Run #{index + 1} should produce identical output to first run"
    end
  end

  test "comprehensive_table_coverage_validation" do
    # Test that generator covers all expected Rails models
    result = run_generator_command([
      "zero:active_models",
      "--dry-run"
    ])

    assert result[:success], "Comprehensive generation should succeed"

    # Verify expected models are included
    expected_models = %w[user job task client device person note]

    expected_models.each do |model|
      assert_match(/Would create:.*#{model}\.ts/, result[:stdout])
      assert_match(/Would create:.*reactive-#{model}\.ts/, result[:stdout])
      assert_match(/Would create:.*types\/#{model}-data\.ts/, result[:stdout])
    end
  end

  test "performance_benchmarking_validation" do
    # Test performance characteristics of the generator
    start_time = Time.current

    result = run_generator_command([
      "zero:active_models",
      "--dry-run"
    ])

    end_time = Time.current
    execution_time = end_time - start_time

    assert result[:success], "Performance test should succeed"

    # Dry run should complete quickly (within 10 seconds)
    assert execution_time < 10, "Dry run should complete quickly, took #{execution_time.round(2)}s"

    # Should process multiple models
    model_count = result[:stdout].scan(/Would create:.*\.ts/).length
    assert model_count >= 30, "Should process multiple models: #{model_count}"
  end

  test "generator_help_and_documentation_accessibility" do
    # Test that generator provides accessible help and documentation
    result = run_generator_command([
      "zero:active_models",
      "--help"
    ])

    assert result[:success], "Help command should work"

    # Should provide clear usage information
    assert_match(/Usage:/, result[:stdout])
    assert_match(/Options:/, result[:stdout])
    assert_match(/--table/, result[:stdout])
    assert_match(/--output-dir/, result[:stdout])
    assert_match(/--skip-prettier/, result[:stdout])
    assert_match(/--dry-run/, result[:stdout])
  end

  private

  def run_generator_command(args)
    cmd = [ "bin/rails", "generate" ] + args

    stdout, stderr, status = Open3.capture3(*cmd, chdir: Rails.root)

    {
      success: status.success?,
      stdout: stdout,
      stderr: stderr,
      status: status
    }
  end
end
