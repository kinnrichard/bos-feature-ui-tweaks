# frozen_string_literal: true

require "test_helper"
require "generators/zero/active_models/migration/rollback_manager"
require "generators/zero/active_models/migration/feature_flags"

class RollbackManagerTest < ActiveSupport::TestCase
  def setup
    @feature_flags = Zero::Generators::Migration::MigrationFeatureFlags.new
    @state_file = Tempfile.new([ "rollback_state", ".json" ])
    @notifications = []

    @notification_handler = ->(event_type, data) {
      @notifications << { event: event_type, data: data }
    }

    @rollback_manager = Zero::Generators::Migration::RollbackManager.new(
      feature_flags: @feature_flags,
      state_file_path: @state_file.path,
      notification_handler: @notification_handler
    )
  end

  def teardown
    @state_file.close
    @state_file.unlink
  end

  # Initialization Tests

  test "initializes with active state by default" do
    assert_equal :active, @rollback_manager.current_state
    assert_empty @rollback_manager.rollback_history
  end

  test "loads state from existing file" do
    # Write state file
    state_data = {
      current_state: "rolled_back",
      rollback_history: [
        {
          type: :emergency_manual,
          trigger: :emergency_manual,
          reason: "Test rollback",
          timestamp: Time.current.iso8601
        }
      ]
    }

    File.write(@state_file.path, JSON.pretty_generate(state_data))

    # Create new manager to test loading
    manager = Zero::Generators::Migration::RollbackManager.new(
      feature_flags: @feature_flags,
      state_file_path: @state_file.path
    )

    assert_equal :rolled_back, manager.current_state
    assert_equal 1, manager.rollback_history.length
  end

  test "handles corrupted state file gracefully" do
    File.write(@state_file.path, "invalid json")

    # Should not raise error and use default state
    manager = Zero::Generators::Migration::RollbackManager.new(
      feature_flags: @feature_flags,
      state_file_path: @state_file.path
    )

    assert_equal :active, manager.current_state
  end

  # Rollback Recommendation Tests

  test "does not recommend rollback when circuit breaker is closed" do
    @feature_flags.configure { |config| config.circuit_breaker_enabled = true }

    assert_equal false, @rollback_manager.rollback_recommended?

    recommendation = @rollback_manager.rollback_recommendation
    assert_equal false, recommendation[:recommended]
    assert_equal :info, recommendation[:severity]
  end

  test "recommends rollback when circuit breaker is open" do
    @feature_flags.trip_circuit_breaker!

    assert_equal true, @rollback_manager.rollback_recommended?

    recommendation = @rollback_manager.rollback_recommendation
    assert_equal true, recommendation[:recommended]
    assert_equal :critical, recommendation[:severity]
    assert recommendation[:reasons].any? { |r| r[:trigger] == :circuit_breaker_tripped }
  end

  test "does not recommend rollback when already rolled back" do
    # Manually set state to rolled back
    @rollback_manager.instance_variable_set(:@current_state, :rolled_back)

    assert_equal false, @rollback_manager.rollback_recommended?
  end

  # Automatic Rollback Tests

  test "executes automatic rollback when recommended" do
    @feature_flags.trip_circuit_breaker!

    result = @rollback_manager.execute_automatic_rollback

    assert_equal true, result[:success]
    assert_equal :automatic, result[:type]
    assert_equal :rolled_back, @rollback_manager.current_state
    assert_equal :force_legacy, @feature_flags.config.manual_override
  end

  test "does not execute automatic rollback when not recommended" do
    result = @rollback_manager.execute_automatic_rollback

    assert_equal false, result[:success]
    assert_includes result[:reason], "not recommended"
    assert_equal :active, @rollback_manager.current_state
  end

  test "dry run does not change state" do
    @feature_flags.trip_circuit_breaker!

    result = @rollback_manager.execute_automatic_rollback(dry_run: true)

    assert_equal true, result[:success]
    assert_equal true, result[:dry_run]
    assert_equal :active, @rollback_manager.current_state # State unchanged
  end

  # Emergency Rollback Tests

  test "executes emergency rollback successfully" do
    reason = "Critical production issue"
    operator = "oncall-engineer"

    result = @rollback_manager.execute_emergency_rollback!(
      reason: reason,
      operator: operator
    )

    assert_equal true, result[:success]
    assert_equal :emergency_manual, result[:trigger]
    assert_equal :manual, result[:type]
    assert_equal reason, result[:reason]
    assert_equal operator, result[:operator]
    assert_equal :rolled_back, @rollback_manager.current_state
    assert_equal :force_legacy, @feature_flags.config.manual_override
  end

  test "emergency rollback works even when already rolled back with force" do
    # Set initial rolled back state
    @rollback_manager.instance_variable_set(:@current_state, :rolled_back)

    result = @rollback_manager.execute_emergency_rollback!(
      reason: "Second emergency",
      force: true
    )

    assert_equal true, result[:success]
    assert_equal :rolled_back, @rollback_manager.current_state
  end

  test "records rollback in history" do
    reason = "Test rollback"

    @rollback_manager.execute_emergency_rollback!(reason: reason)

    history = @rollback_manager.rollback_history
    assert_equal 1, history.length

    rollback_event = history.last
    assert_equal :emergency_manual, rollback_event[:trigger]
    assert_equal reason, rollback_event[:reason]
    assert_not_nil rollback_event[:timestamp]
  end

  # Planned Rollback Tests

  test "executes planned rollback immediately when scheduled for past/now" do
    result = @rollback_manager.execute_planned_rollback(
      reason: "Maintenance rollback",
      scheduled_at: Time.current - 1.minute
    )

    assert_equal true, result[:success]
    assert_equal :rolled_back, @rollback_manager.current_state
  end

  test "schedules planned rollback for future" do
    future_time = Time.current + 1.hour

    result = @rollback_manager.execute_planned_rollback(
      reason: "Future maintenance",
      scheduled_at: future_time
    )

    assert_equal true, result[:success]
    assert_equal future_time, result[:scheduled_at]
    assert_equal :active, @rollback_manager.current_state # Not executed yet
  end

  # Validation Tests

  test "validates successful rollback" do
    @rollback_manager.execute_emergency_rollback!(reason: "Test")

    validation_result = @rollback_manager.validate_rollback_success

    assert_equal true, validation_result[:success]
    assert_equal :healthy, validation_result[:system_health]
    assert validation_result[:checks_passed].any? { |c| c[:check] == :feature_flags }
  end

  test "validation fails when feature flags not properly set" do
    # Rollback without proper feature flag setting (simulate failure)
    @rollback_manager.instance_variable_set(:@current_state, :rolling_back)

    validation_result = @rollback_manager.validate_rollback_success

    assert_equal false, validation_result[:success]
    assert validation_result[:checks_failed].any? { |c| c[:check] == :feature_flags }
  end

  # Recovery Tests

  test "recovery fails when not in rollback failed state" do
    result = @rollback_manager.attempt_rollback_recovery

    assert_equal false, result[:success]
    assert_includes result[:reason], "Not in rollback failed state"
  end

  test "attempts recovery from failed rollback" do
    # Set to failed state
    @rollback_manager.instance_variable_set(:@current_state, :rollback_failed)

    result = @rollback_manager.attempt_rollback_recovery

    # Should attempt recovery steps
    assert result[:recovery_steps].any?
    assert_not_nil result[:recovery_time_ms]
  end

  # State Management Tests

  test "clear rollback state returns to active" do
    @rollback_manager.execute_emergency_rollback!(reason: "Test")
    assert_equal :rolled_back, @rollback_manager.current_state

    result = @rollback_manager.clear_rollback_state(operator: "admin")

    assert_equal true, result[:success]
    assert_equal :active, @rollback_manager.current_state
    assert_nil @feature_flags.config.manual_override
  end

  test "cannot clear rollback state when not rolled back" do
    result = @rollback_manager.clear_rollback_state

    assert_equal false, result[:success]
    assert_includes result[:reason], "Not in rolled back state"
  end

  # Status and Statistics Tests

  test "current status provides comprehensive information" do
    status = @rollback_manager.current_status

    assert_includes status, :state
    assert_includes status, :is_rolled_back
    assert_includes status, :rollback_count_today
    assert_includes status, :feature_flags_state
    assert_includes status, :circuit_breaker_state
    assert_includes status, :recommendation
    assert_includes status, :health_indicators

    assert_equal :active, status[:state]
    assert_equal false, status[:is_rolled_back]
  end

  test "tracks rollback count for current day" do
    # Execute rollback
    @rollback_manager.execute_emergency_rollback!(reason: "Test 1")
    @rollback_manager.clear_rollback_state
    @rollback_manager.execute_emergency_rollback!(reason: "Test 2")

    status = @rollback_manager.current_status
    assert_equal 2, status[:rollback_count_today]
  end

  # Notification Tests

  test "sends notification when rollback executed" do
    @rollback_manager.execute_emergency_rollback!(reason: "Test notification")

    rollback_notification = @notifications.find { |n| n[:event] == :rollback_executed }

    assert_not_nil rollback_notification
    assert_equal true, rollback_notification[:data][:success]
    assert_equal :emergency_manual, rollback_notification[:data][:trigger]
  end

  test "sends notification when rollback cleared" do
    @rollback_manager.execute_emergency_rollback!(reason: "Test")
    @notifications.clear # Clear rollback notifications

    @rollback_manager.clear_rollback_state(operator: "admin")

    clear_notification = @notifications.find { |n| n[:event] == :rollback_cleared }

    assert_not_nil clear_notification
    assert_equal "admin", clear_notification[:data][:operator]
  end

  # State Persistence Tests

  test "persists state to file" do
    @rollback_manager.execute_emergency_rollback!(reason: "Persistence test")

    # Read state file directly
    state_data = JSON.parse(File.read(@state_file.path), symbolize_names: true)

    assert_equal "rolled_back", state_data[:current_state]
    assert_equal 1, state_data[:rollback_history].length
    assert_not_nil state_data[:last_updated]
  end

  test "handles state file write errors gracefully" do
    # Make state file unwritable
    File.chmod(0444, @state_file.path) # Read-only

    # Should not raise error
    assert_nothing_raised do
      @rollback_manager.execute_emergency_rollback!(reason: "Write error test")
    end

  ensure
    # Restore write permissions for cleanup
    File.chmod(0644, @state_file.path)
  end

  # Error Handling Tests

  test "handles rollback step failures gracefully" do
    # Mock feature flags to fail configuration update
    @feature_flags.define_singleton_method(:update_config) do |updates|
      raise StandardError.new("Configuration update failed")
    end

    result = @rollback_manager.execute_emergency_rollback!(reason: "Test error handling")

    assert_equal false, result[:success]
    assert result[:errors].any? { |e| e.include?("Configuration update failed") }
    assert_equal :rollback_failed, @rollback_manager.current_state
  end

  # Edge Cases

  test "handles empty rollback history" do
    history = @rollback_manager.rollback_history
    assert_empty history

    status = @rollback_manager.current_status
    assert_equal 0, status[:rollback_count_today]
  end

  test "limits rollback history size" do
    # Add more than the limit (100 + some extra)
    manager = @rollback_manager
    history_array = []

    110.times do |i|
      history_array << {
        type: :test,
        trigger: :manual,
        reason: "Test #{i}",
        timestamp: Time.current - i.minutes
      }
    end

    manager.instance_variable_set(:@rollback_history, history_array)

    # Trigger persistence which should limit history
    manager.send(:persist_rollback_state)

    # Reload to verify limit was applied
    new_manager = Zero::Generators::Migration::RollbackManager.new(
      feature_flags: @feature_flags,
      state_file_path: @state_file.path
    )

    assert_equal 100, new_manager.rollback_history.length
  end

  test "validates state transitions" do
    # Test invalid state transition
    assert_raises Zero::Generators::Migration::RollbackManager::RollbackStateError do
      @rollback_manager.send(:transition_to_state, :invalid_state)
    end
  end

  # Integration with Feature Flags

  test "integrates with circuit breaker state" do
    assert_equal :closed, @rollback_manager.current_status[:circuit_breaker_state]

    @feature_flags.trip_circuit_breaker!

    assert_equal :open, @rollback_manager.current_status[:circuit_breaker_state]
  end

  test "rollback sets feature flags correctly" do
    @rollback_manager.execute_emergency_rollback!(reason: "Integration test")

    assert_equal :force_legacy, @feature_flags.config.manual_override
    assert_equal :open, @feature_flags.circuit_breaker_state
  end
end
