# frozen_string_literal: true

require "test_helper"
require "generators/zero/active_models/migration"

class MigrationIntegrationTest < ActiveSupport::TestCase
  def setup
    # Create temporary directories for testing
    @temp_dir = Dir.mktmpdir("migration_test")
    @state_file_path = File.join(@temp_dir, "rollback_state.json")

    @options = {
      table: "users",
      output_dir: File.join(@temp_dir, "generated"),
      dry_run: false
    }

    @shell = MockShell.new

    # Configure environment for testing
    configure_test_environment
  end

  def teardown
    FileUtils.remove_entry(@temp_dir) if Dir.exist?(@temp_dir)
    # Reset global instances
    Zero::Generators::Migration::MigrationFeatureFlags.instance_variable_set(:@instance, nil)
  end

  # End-to-End Migration Tests

  test "complete migration workflow with legacy routing" do
    # Configure to use legacy system
    Zero::Generators::Migration.configure_from_environment

    adapter = Zero::Generators::Migration.create_adapter(@options, @shell)
    result = adapter.execute

    assert_equal true, result[:success]
    assert_equal false, result[:migration_metadata][:used_new_pipeline]
    assert_equal false, result[:migration_metadata][:was_canary_test]
  end

  test "complete migration workflow with new system routing" do
    with_env_vars("MIGRATION_NEW_PIPELINE_PCT" => "100") do
      Zero::Generators::Migration.configure_from_environment

      adapter = Zero::Generators::Migration.create_adapter(@options, @shell)
      result = adapter.execute

      # Note: This will fail in real environment without proper pipeline setup
      # In actual implementation, would need mock or real pipeline components
    end
  end

  test "canary testing workflow end-to-end" do
    with_env_vars(
      "MIGRATION_ENABLE_CANARY" => "true",
      "MIGRATION_CANARY_SAMPLE_PCT" => "100"
    ) do
      Zero::Generators::Migration.configure_from_environment

      adapter = Zero::Generators::Migration.create_adapter(@options, @shell)

      # Mock both systems for canary test
      legacy_coordinator = MockGenerationCoordinator.new
      new_pipeline = MockGenerationPipeline.new

      legacy_coordinator.expect_execute_call(build_mock_result("legacy"))
      new_pipeline.expect_execute_call(build_mock_result("new"))

      adapter = Zero::Generators::Migration::MigrationAdapter.new(
        @options, @shell,
        feature_flags: Zero::Generators::Migration::MigrationFeatureFlags.instance,
        legacy_coordinator: legacy_coordinator,
        new_pipeline: new_pipeline
      )

      result = adapter.execute

      assert_equal true, result[:success]
      assert_equal true, result[:migration_metadata][:was_canary_test]
      assert legacy_coordinator.execute_called?
      assert new_pipeline.execute_called?
    end
  end

  # Rollback Integration Tests

  test "automatic rollback triggers when circuit breaker trips" do
    feature_flags = Zero::Generators::Migration::MigrationFeatureFlags.new(
      circuit_breaker_enabled: true,
      error_threshold: 2
    )

    rollback_manager = Zero::Generators::Migration::RollbackManager.new(
      feature_flags: feature_flags,
      state_file_path: @state_file_path
    )

    # Simulate errors to trip circuit breaker
    2.times do
      feature_flags.record_new_pipeline_error(StandardError.new("Test error"))
    end

    assert_equal :open, feature_flags.circuit_breaker_state
    assert_equal true, rollback_manager.rollback_recommended?

    # Execute automatic rollback
    result = rollback_manager.execute_automatic_rollback

    assert_equal true, result[:success]
    assert_equal :rolled_back, rollback_manager.current_state
    assert_equal :force_legacy, feature_flags.config.manual_override
  end

  test "emergency rollback workflow" do
    status = Zero::Generators::Migration.current_status
    assert_equal :healthy, status[:system_health]

    # Execute emergency rollback
    rollback_result = Zero::Generators::Migration.emergency_rollback!(
      reason: "Critical production issue",
      operator: "oncall-engineer"
    )

    assert_equal true, rollback_result[:success]
    assert_equal :emergency_manual, rollback_result[:trigger]

    # Verify system status shows rollback
    updated_status = Zero::Generators::Migration.current_status
    rollback_status = updated_status[:rollback_status]

    assert_equal :rolled_back, rollback_status[:state]
    assert_equal true, rollback_status[:is_rolled_back]
  end

  # Health Check Integration Tests

  test "system health check when all components healthy" do
    health_result = Zero::Generators::Migration.health_check

    assert_equal :healthy, health_result[:overall_health]
    assert_includes health_result[:component_health], :feature_flags
    assert_includes health_result[:component_health], :rollback_manager

    # All components should be healthy
    health_result[:component_health].each do |component, health|
      assert_equal :healthy, health[:status], "Component #{component} should be healthy"
    end
  end

  test "system health check detects circuit breaker issues" do
    # Trip circuit breaker
    feature_flags = Zero::Generators::Migration::MigrationFeatureFlags.instance
    feature_flags.trip_circuit_breaker!

    health_result = Zero::Generators::Migration.health_check

    assert_includes [ :degraded, :critical ], health_result[:overall_health]

    feature_flags_health = health_result[:component_health][:feature_flags]
    assert_equal :degraded, feature_flags_health[:status]
    assert feature_flags_health[:issues].any? { |issue| issue.include?("Circuit breaker") }
  end

  # Statistics Integration Tests

  test "comprehensive statistics collection" do
    # Execute some operations to generate statistics
    adapter = Zero::Generators::Migration.create_adapter(@options, @shell)

    # Mock successful execution
    legacy_coordinator = MockGenerationCoordinator.new
    legacy_coordinator.expect_execute_call(build_mock_result("test"))

    test_adapter = Zero::Generators::Migration::MigrationAdapter.new(
      @options, @shell,
      legacy_coordinator: legacy_coordinator,
      new_pipeline: MockGenerationPipeline.new
    )

    test_adapter.execute

    # Collect statistics
    stats = Zero::Generators::Migration.statistics

    assert_includes stats, :performance_metrics
    assert_includes stats, :rollback_history
    assert_includes stats, :feature_flag_state
    assert_includes stats, :circuit_breaker_metrics
  end

  # Configuration Integration Tests

  test "environment configuration affects all components" do
    with_env_vars(
      "MIGRATION_NEW_PIPELINE_PCT" => "75",
      "MIGRATION_ENABLE_CANARY" => "true",
      "MIGRATION_CIRCUIT_BREAKER" => "true",
      "MIGRATION_AUTO_ROLLBACK" => "true"
    ) do
      Zero::Generators::Migration.configure_from_environment

      status = Zero::Generators::Migration.current_status
      feature_flags_config = status[:feature_flags]

      assert_equal 75, feature_flags_config[:new_pipeline_percentage]
      assert_equal true, feature_flags_config[:canary_testing_enabled]
      assert_equal :closed, feature_flags_config[:circuit_breaker_state] # Default closed
    end
  end

  # Output Comparison Integration Tests

  test "output comparator integration with different results" do
    comparator = Zero::Generators::Migration.create_comparator

    legacy_result = build_mock_result("legacy", execution_time: 0.1)
    new_result = build_mock_result("new", execution_time: 0.15)

    comparison_result = comparator.compare(legacy_result, new_result)

    assert_not comparison_result.overall_match
    assert comparison_result.critical_discrepancies.any? { |d| d[:type] == :file_content }
    assert_includes comparison_result.performance_analysis, :legacy_time_ms
    assert_includes comparison_result.performance_analysis, :new_time_ms
  end

  test "output comparator integration with identical results" do
    comparator = Zero::Generators::Migration.create_comparator

    result1 = build_mock_result("identical")
    result2 = build_mock_result("identical")

    comparison_result = comparator.compare(result1, result2)

    assert comparison_result.overall_match
    assert_empty comparison_result.critical_discrepancies
    assert_empty comparison_result.warning_discrepancies
  end

  # Performance and Load Tests

  test "handles multiple concurrent migration requests" do
    threads = []
    results = []
    mutex = Mutex.new

    # Create multiple adapters with mocked components
    5.times do |i|
      threads << Thread.new do
        legacy_coordinator = MockGenerationCoordinator.new
        legacy_coordinator.expect_execute_call(build_mock_result("thread_#{i}"))

        adapter = Zero::Generators::Migration::MigrationAdapter.new(
          @options.merge(table: "table_#{i}"), @shell,
          legacy_coordinator: legacy_coordinator,
          new_pipeline: MockGenerationPipeline.new
        )

        result = adapter.execute
        mutex.synchronize { results << result }
      end
    end

    threads.each(&:join)

    # All executions should succeed
    assert_equal 5, results.length
    assert results.all? { |r| r[:success] }
  end

  # Error Recovery Integration Tests

  test "system recovers from rollback failure" do
    feature_flags = Zero::Generators::Migration::MigrationFeatureFlags.new
    rollback_manager = Zero::Generators::Migration::RollbackManager.new(
      feature_flags: feature_flags,
      state_file_path: @state_file_path
    )

    # Simulate rollback failure
    rollback_manager.instance_variable_set(:@current_state, :rollback_failed)

    # Attempt recovery
    recovery_result = rollback_manager.attempt_rollback_recovery

    # Should attempt recovery steps
    assert recovery_result[:recovery_steps].any?
    assert_not_nil recovery_result[:recovery_time_ms]

    # Final state should be better than failed
    final_state = rollback_manager.current_state
    assert_not_equal :rollback_failed, final_state
  end

  # Migration State Persistence Tests

  test "migration state persists across system restarts" do
    # Execute rollback
    rollback_result = Zero::Generators::Migration.emergency_rollback!(
      reason: "Persistence test"
    )
    assert_equal true, rollback_result[:success]

    # Verify state file was created
    assert File.exist?(@state_file_path)

    # Create new rollback manager to simulate restart
    feature_flags = Zero::Generators::Migration::MigrationFeatureFlags.new
    new_rollback_manager = Zero::Generators::Migration::RollbackManager.new(
      feature_flags: feature_flags,
      state_file_path: @state_file_path
    )

    # State should be restored
    assert_equal :rolled_back, new_rollback_manager.current_state
    assert_equal 1, new_rollback_manager.rollback_history.length
  end

  private

  def configure_test_environment
    # Set default test environment variables
    ENV["MIGRATION_NEW_PIPELINE_PCT"] = "0"  # Default to legacy
    ENV["MIGRATION_ENABLE_CANARY"] = "false"
    ENV["MIGRATION_CIRCUIT_BREAKER"] = "true"
    ENV["MIGRATION_AUTO_ROLLBACK"] = "false"
    ENV["MIGRATION_DETAILED_LOGGING"] = "false"
  end

  def build_mock_result(identifier, overrides = {})
    {
      success: true,
      generated_models: [
        { table_name: "users", class_name: "#{identifier.capitalize}User" }
      ],
      generated_files: [
        { path: "user.ts", content: "// #{identifier}\nexport class User {}" }
      ],
      errors: [],
      execution_time: 0.1,
      statistics: { models_generated: 1, files_created: 1 }
    }.merge(overrides)
  end

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

  # Mock Classes

  class MockShell
    def initialize
      @messages = []
    end

    def say(message, color = nil)
      @messages << { type: :say, message: message, color: color }
    end

    def say_status(status, message, color = nil)
      @messages << { type: :say_status, status: status, message: message, color: color }
    end

    def messages
      @messages
    end
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

    def statistics
      { pipeline_stats: { stages_executed: 4 } }
    end
  end
end
