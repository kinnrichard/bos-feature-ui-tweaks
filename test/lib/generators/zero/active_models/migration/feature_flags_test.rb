# frozen_string_literal: true

require "test_helper"
require "generators/zero/active_models/migration/feature_flags"

class MigrationFeatureFlagsTest < ActiveSupport::TestCase
  def setup
    @flags = Zero::Generators::Migration::MigrationFeatureFlags.new
    # Clear any global instance state
    Zero::Generators::Migration::MigrationFeatureFlags.instance_variable_set(:@instance, nil)
  end

  def teardown
    # Reset global instance
    Zero::Generators::Migration::MigrationFeatureFlags.instance_variable_set(:@instance, nil)
  end

  # Configuration Tests

  test "initializes with default configuration" do
    flags = Zero::Generators::Migration::MigrationFeatureFlags.new

    assert_equal 0, flags.config.new_pipeline_percentage
    assert_equal false, flags.config.enable_canary_testing
    assert_equal true, flags.config.circuit_breaker_enabled
    assert_equal true, flags.config.fallback_to_legacy_on_error
  end

  test "accepts initial configuration overrides" do
    flags = Zero::Generators::Migration::MigrationFeatureFlags.new(
      new_pipeline_percentage: 25,
      enable_canary_testing: true
    )

    assert_equal 25, flags.config.new_pipeline_percentage
    assert_equal true, flags.config.enable_canary_testing
  end

  test "validates percentage configuration" do
    assert_raises Zero::Generators::Migration::MigrationFeatureFlags::InvalidPercentageError do
      Zero::Generators::Migration::MigrationFeatureFlags.new(new_pipeline_percentage: 150)
    end

    assert_raises Zero::Generators::Migration::MigrationFeatureFlags::InvalidPercentageError do
      Zero::Generators::Migration::MigrationFeatureFlags.new(new_pipeline_percentage: -10)
    end
  end

  test "validates canary sample rate configuration" do
    assert_raises Zero::Generators::Migration::MigrationFeatureFlags::InvalidPercentageError do
      Zero::Generators::Migration::MigrationFeatureFlags.new(canary_sample_rate: 150)
    end
  end

  test "validates error threshold configuration" do
    assert_raises Zero::Generators::Migration::MigrationFeatureFlags::ConfigurationError do
      Zero::Generators::Migration::MigrationFeatureFlags.new(error_threshold: 0)
    end
  end

  # Routing Logic Tests

  test "routes to legacy system when percentage is 0" do
    @flags.configure { |config| config.new_pipeline_percentage = 0 }

    10.times do
      assert_equal false, @flags.use_new_pipeline?(table_name: "users")
    end
  end

  test "routes to new system when percentage is 100" do
    @flags.configure { |config| config.new_pipeline_percentage = 100 }

    10.times do
      assert_equal true, @flags.use_new_pipeline?(table_name: "users")
    end
  end

  test "routes consistently for same table name" do
    @flags.configure { |config| config.new_pipeline_percentage = 50 }

    table_name = "consistent_table"
    first_result = @flags.use_new_pipeline?(table_name: table_name)

    # Should get same result for same table on same day
    5.times do
      assert_equal first_result, @flags.use_new_pipeline?(table_name: table_name)
    end
  end

  test "forces new pipeline for specified tables" do
    @flags.configure do |config|
      config.new_pipeline_percentage = 0
      config.use_new_pipeline_for_tables = [ "special_table" ]
    end

    assert_equal false, @flags.use_new_pipeline?(table_name: "normal_table")
    assert_equal true, @flags.use_new_pipeline?(table_name: "special_table")
  end

  test "respects manual override settings" do
    # Force legacy
    @flags.configure do |config|
      config.new_pipeline_percentage = 100
      config.manual_override = :force_legacy
    end

    assert_equal false, @flags.use_new_pipeline?(table_name: "any_table")

    # Force new
    @flags.configure { |config| config.manual_override = :force_new }
    assert_equal true, @flags.use_new_pipeline?(table_name: "any_table")
  end

  # Circuit Breaker Tests

  test "routes to legacy when circuit breaker is open" do
    @flags.configure { |config| config.new_pipeline_percentage = 100 }

    # Trip circuit breaker
    @flags.trip_circuit_breaker!

    assert_equal false, @flags.use_new_pipeline?(table_name: "any_table")
    assert_equal :open, @flags.circuit_breaker_state
  end

  test "records errors and trips circuit breaker at threshold" do
    @flags.configure do |config|
      config.error_threshold = 3
      config.circuit_breaker_enabled = true
    end

    assert_equal :closed, @flags.circuit_breaker_state

    # Record errors up to threshold
    2.times do |i|
      @flags.record_new_pipeline_error(StandardError.new("Error #{i}"))
      assert_equal :closed, @flags.circuit_breaker_state
    end

    # This should trip the circuit breaker
    @flags.record_new_pipeline_error(StandardError.new("Final error"))
    assert_equal :open, @flags.circuit_breaker_state
  end

  test "circuit breaker recovery after timeout" do
    @flags.configure do |config|
      config.error_threshold = 1
      config.circuit_recovery_timeout = 0.1 # 100ms for testing
    end

    # Trip circuit breaker
    @flags.record_new_pipeline_error(StandardError.new("Test error"))
    assert_equal :open, @flags.circuit_breaker_state

    # Wait for recovery timeout
    sleep(0.2)

    # Should transition to half-open
    assert_equal :half_open, @flags.circuit_breaker_state
  end

  test "resets circuit breaker" do
    @flags.trip_circuit_breaker!
    assert_equal :open, @flags.circuit_breaker_state

    @flags.reset_circuit_breaker!
    assert_equal :closed, @flags.circuit_breaker_state
  end

  # Canary Testing Tests

  test "canary testing disabled by default" do
    assert_equal false, @flags.should_run_canary_test?(table_name: "any_table")
  end

  test "canary testing respects sample rate" do
    @flags.configure do |config|
      config.enable_canary_testing = true
      config.canary_sample_rate = 0
    end

    5.times do
      assert_equal false, @flags.should_run_canary_test?(table_name: "any_table")
    end

    @flags.configure { |config| config.canary_sample_rate = 100 }

    5.times do
      assert_equal true, @flags.should_run_canary_test?(table_name: "any_table")
    end
  end

  test "canary testing disabled when circuit breaker open" do
    @flags.configure do |config|
      config.enable_canary_testing = true
      config.canary_sample_rate = 100
    end

    @flags.trip_circuit_breaker!

    assert_equal false, @flags.should_run_canary_test?(table_name: "any_table")
  end

  test "force canary mode overrides sample rate" do
    @flags.configure do |config|
      config.enable_canary_testing = true
      config.canary_sample_rate = 0
      config.force_canary_mode = true
    end

    assert_equal true, @flags.should_run_canary_test?(table_name: "any_table")
  end

  # Performance Metrics Tests

  test "records performance metrics when enabled" do
    @flags.configure { |config| config.track_performance_metrics = true }

    metrics = {
      legacy_execution_time: 0.1,
      new_execution_time: 0.15,
      canary_overhead: 0.05
    }

    @flags.record_performance_metrics(metrics)

    stats = @flags.performance_statistics
    assert_equal 1, stats[:total_samples]
    assert_equal 0.1, stats[:avg_legacy_time]
    assert_equal 0.15, stats[:avg_new_time]
  end

  test "limits performance data to prevent memory bloat" do
    @flags.configure { |config| config.track_performance_metrics = true }

    # Add more than the limit (1000 + some extra)
    1050.times do |i|
      @flags.record_performance_metrics({
        legacy_execution_time: 0.1 + (i * 0.001),
        new_execution_time: 0.15
      })
    end

    stats = @flags.performance_statistics
    assert_equal 1000, stats[:total_samples] # Should be limited
  end

  # Environment Configuration Tests

  test "configures from environment variables" do
    # Mock environment variables
    with_env_vars(
      "MIGRATION_NEW_PIPELINE_PCT" => "75",
      "MIGRATION_ENABLE_CANARY" => "true",
      "MIGRATION_CIRCUIT_BREAKER" => "false"
    ) do
      Zero::Generators::Migration::MigrationFeatureFlags.configure_from_env
      flags = Zero::Generators::Migration::MigrationFeatureFlags.instance

      assert_equal 75, flags.config.new_pipeline_percentage
      assert_equal true, flags.config.enable_canary_testing
      assert_equal false, flags.config.circuit_breaker_enabled
    end
  end

  test "parses table list from environment" do
    with_env_vars(
      "MIGRATION_NEW_PIPELINE_TABLES" => "users,posts,comments"
    ) do
      Zero::Generators::Migration::MigrationFeatureFlags.configure_from_env
      flags = Zero::Generators::Migration::MigrationFeatureFlags.instance

      assert_equal [ "users", "posts", "comments" ], flags.config.use_new_pipeline_for_tables
    end
  end

  test "parses manual override from environment" do
    with_env_vars(
      "MIGRATION_MANUAL_OVERRIDE" => "legacy"
    ) do
      Zero::Generators::Migration::MigrationFeatureFlags.configure_from_env
      flags = Zero::Generators::Migration::MigrationFeatureFlags.instance

      assert_equal :force_legacy, flags.config.manual_override
    end
  end

  # Configuration Summary Tests

  test "provides configuration summary" do
    @flags.configure do |config|
      config.new_pipeline_percentage = 25
      config.enable_canary_testing = true
    end

    summary = @flags.configuration_summary

    assert_equal 25, summary[:new_pipeline_percentage]
    assert_equal true, summary[:canary_testing_enabled]
    assert_equal :closed, summary[:circuit_breaker_state]
    assert_equal 0, summary[:error_count]
  end

  # Edge Cases and Error Conditions

  test "handles nil table names gracefully" do
    @flags.configure { |config| config.new_pipeline_percentage = 50 }

    # Should not raise error
    assert_nothing_raised do
      result = @flags.use_new_pipeline?(table_name: nil)
      assert_includes [ true, false ], result
    end
  end

  test "handles empty request context" do
    @flags.configure { |config| config.new_pipeline_percentage = 50 }

    assert_nothing_raised do
      @flags.use_new_pipeline?(table_name: "test", request_context: {})
    end
  end

  test "circuit breaker error window validation" do
    @flags.configure do |config|
      config.error_threshold = 2
      config.error_window_seconds = 1
    end

    # Record error
    @flags.record_new_pipeline_error(StandardError.new("Error 1"))

    # Wait beyond window
    sleep(1.1)

    # Record another error - should not trip because first is outside window
    @flags.record_new_pipeline_error(StandardError.new("Error 2"))
    assert_equal :closed, @flags.circuit_breaker_state
  end

  # Thread Safety Tests (basic)

  test "handles concurrent access gracefully" do
    @flags.configure { |config| config.new_pipeline_percentage = 50 }

    threads = []
    results = []
    mutex = Mutex.new

    10.times do
      threads << Thread.new do
        result = @flags.use_new_pipeline?(table_name: "concurrent_test")
        mutex.synchronize { results << result }
      end
    end

    threads.each(&:join)

    # All results should be consistent for same table
    assert results.uniq.length == 1, "Expected consistent results, got: #{results.uniq}"
  end

  private

  def with_env_vars(vars)
    old_values = {}

    vars.each do |key, value|
      old_values[key] = ENV[key]
      ENV[key] = value
    end

    yield

  ensure
    vars.each_key do |key|
      if old_values[key].nil?
        ENV.delete(key)
      else
        ENV[key] = old_values[key]
      end
    end
  end
end
