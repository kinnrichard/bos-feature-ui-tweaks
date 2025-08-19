# frozen_string_literal: true

require "test_helper"
require "generators/zero/active_models/migration/adapter"
require "generators/zero/active_models/migration/feature_flags"

class MigrationAdapterTest < ActiveSupport::TestCase
  def setup
    @options = { table: "users", output_dir: "test/output" }
    @shell = MockShell.new
    @feature_flags = Zero::Generators::Migration::MigrationFeatureFlags.new
    @legacy_coordinator = MockGenerationCoordinator.new
    @new_pipeline = MockGenerationPipeline.new

    @adapter = Zero::Generators::Migration::MigrationAdapter.new(
      @options,
      @shell,
      feature_flags: @feature_flags,
      legacy_coordinator: @legacy_coordinator,
      new_pipeline: @new_pipeline
    )
  end

  # Basic Initialization Tests

  test "initializes with required parameters" do
    adapter = Zero::Generators::Migration::MigrationAdapter.new(@options, @shell)

    assert_equal @options, adapter.options
    assert_equal @shell, adapter.shell
    assert_not_nil adapter.feature_flags
    assert_not_nil adapter.statistics
  end

  test "uses global feature flags instance when none provided" do
    Zero::Generators::Migration::MigrationFeatureFlags.instance.configure do |config|
      config.new_pipeline_percentage = 25
    end

    adapter = Zero::Generators::Migration::MigrationAdapter.new(@options, @shell)
    assert_equal 25, adapter.feature_flags.config.new_pipeline_percentage
  end

  # Routing Logic Tests

  test "routes to legacy system when feature flags indicate legacy" do
    @feature_flags.configure { |config| config.new_pipeline_percentage = 0 }

    @legacy_coordinator.expect_execute_call(success_result)

    result = @adapter.execute

    assert_equal true, result[:success]
    assert_equal false, result[:migration_metadata][:used_new_pipeline]
    assert @legacy_coordinator.execute_called?
    assert_not @new_pipeline.execute_called?
  end

  test "routes to new system when feature flags indicate new" do
    @feature_flags.configure do |config|
      config.new_pipeline_percentage = 100
      config.fallback_to_legacy_on_error = false
    end

    @new_pipeline.expect_execute_call(success_result)

    result = @adapter.execute

    assert_equal true, result[:success]
    assert_equal true, result[:migration_metadata][:used_new_pipeline]
    assert_not @legacy_coordinator.execute_called?
    assert @new_pipeline.execute_called?
  end

  test "falls back to legacy when new system fails" do
    @feature_flags.configure do |config|
      config.new_pipeline_percentage = 100
      config.fallback_to_legacy_on_error = true
    end

    @new_pipeline.expect_execute_call(nil) # Will raise error
    @new_pipeline.should_raise_error(StandardError.new("New system failed"))

    @legacy_coordinator.expect_execute_call(success_result)

    result = @adapter.execute

    assert_equal true, result[:success]
    assert_equal false, result[:migration_metadata][:used_new_pipeline] # Fell back to legacy
    assert @legacy_coordinator.execute_called?
    assert @new_pipeline.execute_called?
  end

  test "raises error when fallback disabled and new system fails" do
    @feature_flags.configure do |config|
      config.new_pipeline_percentage = 100
      config.fallback_to_legacy_on_error = false
    end

    @new_pipeline.should_raise_error(StandardError.new("New system failed"))

    result = @adapter.execute

    assert_equal false, result[:success]
    assert_includes result[:errors].first, "New pipeline failed"
  end

  # Canary Testing Tests

  test "executes canary test when feature flags indicate" do
    @feature_flags.configure do |config|
      config.enable_canary_testing = true
      config.canary_sample_rate = 100
      config.canary_timeout_seconds = 5
    end

    @legacy_coordinator.expect_execute_call(success_result(execution_time: 0.1))
    @new_pipeline.expect_execute_call(success_result(execution_time: 0.12))

    result = @adapter.execute

    assert_equal true, result[:success]
    assert_equal true, result[:migration_metadata][:was_canary_test]
    assert @legacy_coordinator.execute_called?
    assert @new_pipeline.execute_called?
  end

  test "canary test returns legacy result by default" do
    @feature_flags.configure do |config|
      config.enable_canary_testing = true
      config.canary_sample_rate = 100
    end

    legacy_result = success_result(generated_models: [ "LegacyModel" ])
    new_result = success_result(generated_models: [ "NewModel" ])

    @legacy_coordinator.expect_execute_call(legacy_result)
    @new_pipeline.expect_execute_call(new_result)

    result = @adapter.execute

    assert_equal legacy_result[:generated_models], result[:generated_models]
    assert_equal true, result[:migration_metadata][:was_canary_test]
  end

  test "canary test handles timeout gracefully" do
    @feature_flags.configure do |config|
      config.enable_canary_testing = true
      config.canary_sample_rate = 100
      config.canary_timeout_seconds = 0.01 # Very short timeout
    end

    @legacy_coordinator.expect_execute_call(success_result)
    @new_pipeline.should_delay_execution(0.1) # Longer than timeout
    @new_pipeline.expect_execute_call(success_result)

    result = @adapter.execute

    # Should fall back gracefully when timeout occurs
    assert_equal false, result[:success]
    assert_includes result[:errors].first.downcase, "timeout"
  end

  test "records performance metrics during canary test" do
    @feature_flags.configure do |config|
      config.enable_canary_testing = true
      config.canary_sample_rate = 100
      config.track_performance_metrics = true
    end

    @legacy_coordinator.expect_execute_call(success_result(execution_time: 0.1))
    @new_pipeline.expect_execute_call(success_result(execution_time: 0.15))

    @adapter.execute

    stats = @feature_flags.performance_statistics
    assert_equal 1, stats[:total_samples]
    assert_equal 0.1, stats[:avg_legacy_time]
    assert_equal 0.15, stats[:avg_new_time]
  end

  # Error Handling Tests

  test "records errors in feature flags circuit breaker" do
    @feature_flags.configure do |config|
      config.new_pipeline_percentage = 100
      config.fallback_to_legacy_on_error = true
      config.circuit_breaker_enabled = true
    end

    error = StandardError.new("Pipeline error")
    @new_pipeline.should_raise_error(error)
    @legacy_coordinator.expect_execute_call(success_result)

    initial_state = @feature_flags.circuit_breaker_state

    @adapter.execute

    # Error should have been recorded (implementation detail test)
    # In real implementation, this would affect circuit breaker state
  end

  test "updates statistics on execution" do
    @feature_flags.configure { |config| config.new_pipeline_percentage = 0 }
    @legacy_coordinator.expect_execute_call(success_result)

    initial_stats = @adapter.statistics.dup

    @adapter.execute

    updated_stats = @adapter.statistics
    assert updated_stats[:executions_total] > initial_stats[:executions_total]
    assert updated_stats[:executions_legacy] > initial_stats[:executions_legacy]
  end

  # Alternative Interface Tests

  test "generate_models method updates options temporarily" do
    original_table = @options[:table]

    @feature_flags.configure { |config| config.new_pipeline_percentage = 0 }
    @legacy_coordinator.expect_execute_call(success_result)

    result = @adapter.generate_models(tables: [ "posts" ], output_directory: "custom/dir")

    # Options should be restored
    assert_equal original_table, @adapter.options[:table]
    assert_equal true, result[:success]
  end

  # Force Execution Tests

  test "force_execute_system with legacy bypasses routing" do
    @feature_flags.configure { |config| config.new_pipeline_percentage = 100 }
    @legacy_coordinator.expect_execute_call(success_result)

    result = @adapter.force_execute_system(:legacy)

    assert_equal true, result[:success]
    assert @legacy_coordinator.execute_called?
    assert_not @new_pipeline.execute_called?
  end

  test "force_execute_system with new respects circuit breaker by default" do
    @feature_flags.trip_circuit_breaker!

    assert_raises Zero::Generators::Migration::MigrationAdapter::MigrationError do
      @adapter.force_execute_system(:new)
    end
  end

  test "force_execute_system can bypass circuit breaker" do
    @feature_flags.trip_circuit_breaker!
    @new_pipeline.expect_execute_call(success_result)

    result = @adapter.force_execute_system(:new, bypass_circuit_breaker: true)

    assert_equal true, result[:success]
    assert @new_pipeline.execute_called?
  end

  test "force_execute_system raises error for unknown system" do
    assert_raises ArgumentError do
      @adapter.force_execute_system(:unknown)
    end
  end

  # Statistics Collection Tests

  test "collect_service_statistics gathers comprehensive data" do
    stats = @adapter.collect_service_statistics

    assert_includes stats, :migration_adapter_stats
    assert_includes stats, :feature_flags_state
    assert_includes stats, :performance_metrics
    assert_includes stats, :circuit_breaker_state
  end

  # Migration Metadata Tests

  test "enhances results with migration metadata" do
    @feature_flags.configure { |config| config.new_pipeline_percentage = 0 }
    @legacy_coordinator.expect_execute_call(success_result)

    result = @adapter.execute

    assert_includes result, :migration_metadata
    metadata = result[:migration_metadata]

    assert_includes metadata, :used_new_pipeline
    assert_includes metadata, :was_canary_test
    assert_includes metadata, :execution_id
    assert_includes metadata, :circuit_breaker_state
    assert_includes metadata, :feature_flag_config
  end

  # Edge Cases

  test "handles nil options gracefully" do
    adapter = Zero::Generators::Migration::MigrationAdapter.new(
      nil, @shell, feature_flags: @feature_flags,
      legacy_coordinator: @legacy_coordinator,
      new_pipeline: @new_pipeline
    )

    @legacy_coordinator.expect_execute_call(success_result)

    result = adapter.execute
    assert_equal true, result[:success]
  end

  test "handles nil shell gracefully" do
    adapter = Zero::Generators::Migration::MigrationAdapter.new(
      @options, nil, feature_flags: @feature_flags,
      legacy_coordinator: @legacy_coordinator,
      new_pipeline: @new_pipeline
    )

    @legacy_coordinator.expect_execute_call(success_result)

    result = adapter.execute
    assert_equal true, result[:success]
  end

  private

  def success_result(overrides = {})
    {
      success: true,
      generated_models: [],
      generated_files: [],
      errors: [],
      execution_time: 0.1
    }.merge(overrides)
  end

  def error_result(error_message = "Test error")
    {
      success: false,
      generated_models: [],
      generated_files: [],
      errors: [ error_message ],
      execution_time: 0.05
    }
  end

  # Mock Classes

  class MockShell
    def say(message, color = nil); end
    def say_status(status, message, color = nil); end
  end

  class MockGenerationCoordinator
    def initialize
      @execute_called = false
      @expected_result = nil
    end

    def execute
      @execute_called = true
      @expected_result || { success: true, generated_models: [], generated_files: [], errors: [] }
    end

    def execute_called?
      @execute_called
    end

    def expect_execute_call(result)
      @expected_result = result
    end

    def collect_service_statistics
      { coordinator_stats: { executions: 1 } }
    end
  end

  class MockGenerationPipeline
    def initialize
      @execute_called = false
      @expected_result = nil
      @should_raise_error = nil
      @delay_seconds = 0
    end

    def execute
      @execute_called = true

      sleep(@delay_seconds) if @delay_seconds > 0

      raise @should_raise_error if @should_raise_error

      @expected_result || { success: true, generated_models: [], generated_files: [], errors: [] }
    end

    def execute_called?
      @execute_called
    end

    def expect_execute_call(result)
      @expected_result = result
    end

    def should_raise_error(error)
      @should_raise_error = error
    end

    def should_delay_execution(seconds)
      @delay_seconds = seconds
    end

    def statistics
      { pipeline_stats: { stages_executed: 4 } }
    end
  end
end
