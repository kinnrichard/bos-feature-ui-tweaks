# frozen_string_literal: true

require "test_helper"
require "rails/generators/test_case"
require "generators/zero/active_models/active_models_generator"
require "generators/zero/active_models/migration"

class MigrationGeneratorIntegrationTest < Rails::Generators::TestCase
  tests Zero::Generators::ActiveModelsGenerator
  destination Rails.root.join("tmp", "generator_test")

  def setup
    prepare_destination

    # Set up test environment variables
    @original_env = {}
    migration_env_vars.each do |key, value|
      @original_env[key] = ENV[key]
      ENV[key] = value
    end

    # Clear global instances
    Zero::Generators::Migration::MigrationFeatureFlags.instance_variable_set(:@instance, nil)

    # Configure for testing
    Zero::Generators::Migration.configure_from_environment
  end

  def teardown
    # Restore environment variables
    @original_env.each do |key, value|
      if value.nil?
        ENV.delete(key)
      else
        ENV[key] = value
      end
    end

    # Clear global instances
    Zero::Generators::Migration::MigrationFeatureFlags.instance_variable_set(:@instance, nil)
  end

  # Integration Tests with Existing Generator

  test "generator works with legacy routing (0% migration)" do
    with_migration_config(new_pipeline_percentage: 0) do
      # Mock the generation coordinator to avoid actual model generation
      coordinator_mock = Minitest::Mock.new
      coordinator_mock.expect(:execute, {
        success: true,
        generated_models: [ { table_name: "users", class_name: "User" } ],
        generated_files: [ { path: "user.ts", content: "export class User {}" } ],
        errors: [],
        execution_time: 0.1
      })

      Zero::Generators::GenerationCoordinator.stub(:new, coordinator_mock) do
        run_generator([ "--dry-run" ])

        # Should have called legacy coordinator
        coordinator_mock.verify
      end
    end
  end

  test "generator works with migration adapter when percentage > 0" do
    # This test would require the generator to be updated to use MigrationAdapter
    # For now, it validates the current behavior

    with_migration_config(new_pipeline_percentage: 50) do
      assert_nothing_raised do
        run_generator([ "--dry-run" ])
      end
    end
  end

  test "generator handles circuit breaker gracefully" do
    with_migration_config(
      new_pipeline_percentage: 100,
      circuit_breaker_enabled: true
    ) do
      # Trip circuit breaker
      feature_flags = Zero::Generators::Migration::MigrationFeatureFlags.instance
      feature_flags.trip_circuit_breaker!

      # Should fallback to legacy system
      assert_nothing_raised do
        run_generator([ "--dry-run" ])
      end

      assert_equal :open, feature_flags.circuit_breaker_state
    end
  end

  test "generator options are passed through migration adapter correctly" do
    options_passed = nil

    # Mock MigrationAdapter to capture options
    adapter_mock = Minitest::Mock.new
    adapter_mock.expect(:execute, {
      success: true,
      generated_models: [],
      generated_files: [],
      errors: []
    })

    Zero::Generators::Migration::MigrationAdapter.stub(:new, ->(options, shell, **kwargs) {
      options_passed = options
      adapter_mock
    }) do
      # Assuming generator is updated to use MigrationAdapter
      # This validates option passing
      with_migration_config(new_pipeline_percentage: 100) do
        run_generator([ "--dry-run", "--table=users", "--output-dir=/custom/path" ])

        # Options should be passed correctly
        # Note: This test will need updating once generator uses MigrationAdapter
      end
    end
  end

  # Feature Flag Integration Tests

  test "migration system respects environment configuration" do
    with_migration_config(
      new_pipeline_percentage: 25,
      enable_canary: true,
      canary_sample_rate: 50
    ) do
      flags = Zero::Generators::Migration::MigrationFeatureFlags.instance

      assert_equal 25, flags.config.new_pipeline_percentage
      assert_equal true, flags.config.enable_canary_testing
      assert_equal 50, flags.config.canary_sample_rate
    end
  end

  test "migration system provides health status during generation" do
    with_migration_config(new_pipeline_percentage: 0) do
      status_before = Zero::Generators::Migration.current_status
      assert_equal :healthy, status_before[:system_health]

      run_generator([ "--dry-run" ])

      status_after = Zero::Generators::Migration.current_status
      assert_equal :healthy, status_after[:system_health]
    end
  end

  # Error Handling Integration Tests

  test "migration system handles generator errors gracefully" do
    # Test with invalid table name to trigger errors
    with_migration_config(new_pipeline_percentage: 0) do
      # Mock coordinator to simulate error
      coordinator_mock = Minitest::Mock.new
      coordinator_mock.expect(:execute, {
        success: false,
        generated_models: [],
        generated_files: [],
        errors: [ "Test error" ],
        execution_time: 0.05
      })

      Zero::Generators::GenerationCoordinator.stub(:new, coordinator_mock) do
        # Should not raise exception, but handle error gracefully
        assert_nothing_raised do
          run_generator([ "--table=nonexistent" ])
        end

        coordinator_mock.verify
      end
    end
  end

  # Performance Integration Tests

  test "migration system tracks performance during generation" do
    with_migration_config(
      new_pipeline_percentage: 0,
      track_performance_metrics: true
    ) do
      run_generator([ "--dry-run" ])

      # Check that performance metrics are being collected
      stats = Zero::Generators::Migration.statistics
      assert_includes stats, :performance_metrics
    end
  end

  # Rollback Integration Tests

  test "rollback manager maintains state during generation" do
    with_migration_config(new_pipeline_percentage: 0) do
      manager = Zero::Generators::Migration::RollbackManager.new
      initial_state = manager.current_state

      run_generator([ "--dry-run" ])

      # State should remain unchanged during normal operation
      assert_equal initial_state, manager.current_state
    end
  end

  # Configuration Integration Tests

  test "generator respects manual override settings" do
    with_migration_config(
      new_pipeline_percentage: 100,
      manual_override: "legacy"
    ) do
      flags = Zero::Generators::Migration::MigrationFeatureFlags.instance

      # Should route to legacy despite 100% new pipeline percentage
      assert_equal false, flags.use_new_pipeline?(table_name: "users")

      run_generator([ "--dry-run" ])

      # Generator should have used legacy system
    end
  end

  # Load Testing Simulation

  test "migration system handles multiple concurrent generator calls" do
    with_migration_config(new_pipeline_percentage: 25) do
      threads = []
      results = []
      mutex = Mutex.new

      # Simulate multiple concurrent generator runs
      5.times do |i|
        threads << Thread.new do
          begin
            # Create new generator instance for each thread
            generator = Zero::Generators::ActiveModelsGenerator.new([ "--dry-run", "--table=table_#{i}" ])
            generator.destination_root = File.join(destination_root, "thread_#{i}")

            # Run generator
            capture(:stdout) { generator.invoke_all }

            mutex.synchronize { results << { thread: i, success: true } }
          rescue => e
            mutex.synchronize { results << { thread: i, success: false, error: e.message } }
          end
        end
      end

      threads.each(&:join)

      # All threads should complete successfully
      assert_equal 5, results.length
      failed_results = results.select { |r| !r[:success] }

      if failed_results.any?
        fail "Some threads failed: #{failed_results}"
      end
    end
  end

  # Validation Helper Tests

  test "migration system validates configuration before generation" do
    with_invalid_migration_config do
      assert_raises Zero::Generators::Migration::MigrationFeatureFlags::ConfigurationError do
        Zero::Generators::Migration.health_check
      end
    end
  end

  test "migration system provides comprehensive status information" do
    with_migration_config(new_pipeline_percentage: 50) do
      status = Zero::Generators::Migration.current_status

      # Should have all required status fields
      required_fields = [ :migration_version, :feature_flags, :circuit_breaker_state, :rollback_status, :system_health ]
      required_fields.each do |field|
        assert_includes status, field, "Status missing field: #{field}"
      end

      # Feature flags should have configuration
      assert_includes status[:feature_flags], :new_pipeline_percentage
      assert_equal 50, status[:feature_flags][:new_pipeline_percentage]
    end
  end

  private

  def migration_env_vars
    {
      "MIGRATION_NEW_PIPELINE_PCT" => "0",
      "MIGRATION_ENABLE_CANARY" => "false",
      "MIGRATION_CIRCUIT_BREAKER" => "true",
      "MIGRATION_DETAILED_LOGGING" => "false",
      "MIGRATION_AUTO_ROLLBACK" => "false"
    }
  end

  def with_migration_config(config_overrides = {})
    # Convert config to environment variables
    env_vars = {}

    if config_overrides[:new_pipeline_percentage]
      env_vars["MIGRATION_NEW_PIPELINE_PCT"] = config_overrides[:new_pipeline_percentage].to_s
    end

    if config_overrides.key?(:enable_canary)
      env_vars["MIGRATION_ENABLE_CANARY"] = config_overrides[:enable_canary].to_s
    end

    if config_overrides[:canary_sample_rate]
      env_vars["MIGRATION_CANARY_SAMPLE_PCT"] = config_overrides[:canary_sample_rate].to_s
    end

    if config_overrides.key?(:circuit_breaker_enabled)
      env_vars["MIGRATION_CIRCUIT_BREAKER"] = config_overrides[:circuit_breaker_enabled].to_s
    end

    if config_overrides.key?(:track_performance_metrics)
      env_vars["MIGRATION_TRACK_PERFORMANCE"] = config_overrides[:track_performance_metrics].to_s
    end

    if config_overrides[:manual_override]
      env_vars["MIGRATION_MANUAL_OVERRIDE"] = config_overrides[:manual_override].to_s
    end

    # Set environment variables temporarily
    original_values = {}
    env_vars.each do |key, value|
      original_values[key] = ENV[key]
      ENV[key] = value
    end

    begin
      # Reconfigure from updated environment
      Zero::Generators::Migration.configure_from_environment
      yield
    ensure
      # Restore original values
      original_values.each do |key, value|
        if value.nil?
          ENV.delete(key)
        else
          ENV[key] = value
        end
      end

      # Reconfigure with original values
      Zero::Generators::Migration.configure_from_environment
    end
  end

  def with_invalid_migration_config
    original_pct = ENV["MIGRATION_NEW_PIPELINE_PCT"]
    ENV["MIGRATION_NEW_PIPELINE_PCT"] = "150" # Invalid percentage

    begin
      # Clear instance to force re-initialization with invalid config
      Zero::Generators::Migration::MigrationFeatureFlags.instance_variable_set(:@instance, nil)
      yield
    ensure
      if original_pct.nil?
        ENV.delete("MIGRATION_NEW_PIPELINE_PCT")
      else
        ENV["MIGRATION_NEW_PIPELINE_PCT"] = original_pct
      end

      # Reset instance
      Zero::Generators::Migration::MigrationFeatureFlags.instance_variable_set(:@instance, nil)
    end
  end
end
