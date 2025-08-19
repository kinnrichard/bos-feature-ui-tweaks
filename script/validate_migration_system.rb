#!/usr/bin/env ruby
# frozen_string_literal: true

# Migration System Validation Script
#
# This script performs comprehensive validation of the Strangler Fig migration system
# to ensure all components work correctly before deployment.
#
# Usage:
#   ruby script/validate_migration_system.rb
#   ruby script/validate_migration_system.rb --verbose

require 'optparse'
require 'securerandom'
require 'fileutils'
require 'tempfile'

# Parse command line options
options = { verbose: false }
OptionParser.new do |opts|
  opts.banner = "Usage: #{$0} [options]"
  opts.on("-v", "--verbose", "Verbose output") { options[:verbose] = true }
  opts.on("-h", "--help", "Show help") { puts opts; exit }
end.parse!

# Validation results tracking
class ValidationResults
  def initialize
    @results = []
    @passed = 0
    @failed = 0
  end

  def add_test(name, status, message = nil, details = nil)
    @results << {
      name: name,
      status: status,
      message: message,
      details: details,
      timestamp: Time.current
    }

    if status == :pass
      @passed += 1
    else
      @failed += 1
    end
  end

  def passed?
    @failed == 0
  end

  def summary
    {
      total: @results.length,
      passed: @passed,
      failed: @failed,
      success_rate: (@passed.to_f / @results.length * 100).round(1)
    }
  end

  def failed_tests
    @results.select { |r| r[:status] == :fail }
  end

  def report
    puts "\n" + "="*80
    puts "MIGRATION SYSTEM VALIDATION REPORT"
    puts "="*80

    summary = self.summary
    puts "Total Tests: #{summary[:total]}"
    puts "Passed: #{summary[:passed]}"
    puts "Failed: #{summary[:failed]}"
    puts "Success Rate: #{summary[:success_rate]}%"

    if @failed > 0
      puts "\nFAILED TESTS:"
      failed_tests.each do |test|
        puts "❌ #{test[:name]}"
        puts "   #{test[:message]}" if test[:message]
        puts "   #{test[:details]}" if test[:details]
      end
    end

    puts "\nOVERALL RESULT: #{passed? ? '✅ PASSED' : '❌ FAILED'}"
    puts "="*80
  end
end

def verbose_log(message)
  puts "[VERBOSE] #{message}" if $options[:verbose]
end

def run_test(name, results)
  verbose_log("Running: #{name}")
  begin
    yield
    results.add_test(name, :pass)
    puts "✅ #{name}"
  rescue => e
    results.add_test(name, :fail, e.message, e.backtrace&.first(3)&.join("\n"))
    puts "❌ #{name}: #{e.message}"
  end
end

# Store global options for access in verbose_log
$options = options

# Initialize validation results
results = ValidationResults.new

puts "Starting Migration System Validation..."
puts "Timestamp: #{Time.current}"
puts

# Add the lib directory to the load path
$LOAD_PATH.unshift File.expand_path('../lib', __dir__)

begin
  require 'generators/zero/active_models/migration'
rescue LoadError => e
  puts "❌ Failed to load migration system: #{e.message}"
  exit 1
end

# Test 1: Basic Module Loading
run_test("Migration module loads correctly", results) do
  raise "Migration module not defined" unless defined?(Zero::Generators::Migration)
  raise "VERSION not defined" unless Zero::Generators::Migration::VERSION
  verbose_log("Migration version: #{Zero::Generators::Migration::VERSION}")
end

# Test 2: Feature Flags Basic Functionality
run_test("MigrationFeatureFlags basic functionality", results) do
  flags = Zero::Generators::Migration::MigrationFeatureFlags.new
  raise "Feature flags not initialized" unless flags
  raise "Config not accessible" unless flags.config

  # Test configuration
  flags.configure do |config|
    config.new_pipeline_percentage = 25
    config.enable_canary_testing = true
  end

  raise "Configuration not applied" unless flags.config.new_pipeline_percentage == 25
  verbose_log("Feature flags configured successfully")
end

# Test 3: Feature Flags Routing Logic
run_test("Feature flags routing logic", results) do
  flags = Zero::Generators::Migration::MigrationFeatureFlags.new

  # Test 0% routing
  flags.configure { |config| config.new_pipeline_percentage = 0 }
  10.times do
    result = flags.use_new_pipeline?(table_name: 'test')
    raise "Expected false for 0% routing" if result
  end

  # Test 100% routing
  flags.configure { |config| config.new_pipeline_percentage = 100 }
  10.times do
    result = flags.use_new_pipeline?(table_name: 'test')
    raise "Expected true for 100% routing" unless result
  end

  verbose_log("Routing logic working correctly")
end

# Test 4: Circuit Breaker Functionality
run_test("Circuit breaker functionality", results) do
  flags = Zero::Generators::Migration::MigrationFeatureFlags.new(
    error_threshold: 2,
    circuit_breaker_enabled: true
  )

  raise "Circuit breaker should be closed initially" unless flags.circuit_breaker_state == :closed

  # Record errors to trip circuit breaker
  2.times do
    flags.record_new_pipeline_error(StandardError.new("Test error"))
  end

  raise "Circuit breaker should be open after threshold" unless flags.circuit_breaker_state == :open

  # Test routing with open circuit breaker
  flags.configure { |config| config.new_pipeline_percentage = 100 }
  result = flags.use_new_pipeline?(table_name: 'test')
  raise "Should route to legacy when circuit breaker open" if result

  verbose_log("Circuit breaker working correctly")
end

# Test 5: Environment Configuration
run_test("Environment variable configuration", results) do
  # Save current environment
  original_env = ENV.to_h

  begin
    # Set test environment variables
    ENV['MIGRATION_NEW_PIPELINE_PCT'] = '50'
    ENV['MIGRATION_ENABLE_CANARY'] = 'true'
    ENV['MIGRATION_CIRCUIT_BREAKER'] = 'true'

    # Clear instance to force reconfiguration
    Zero::Generators::Migration::MigrationFeatureFlags.instance_variable_set(:@instance, nil)

    # Configure from environment
    Zero::Generators::Migration.configure_from_environment
    flags = Zero::Generators::Migration::MigrationFeatureFlags.instance

    raise "Environment config failed" unless flags.config.new_pipeline_percentage == 50
    raise "Canary config failed" unless flags.config.enable_canary_testing == true

    verbose_log("Environment configuration working")

  ensure
    # Restore environment
    ENV.clear
    ENV.update(original_env)
    Zero::Generators::Migration::MigrationFeatureFlags.instance_variable_set(:@instance, nil)
  end
end

# Test 6: Output Comparator Basic Functionality
run_test("OutputComparator basic functionality", results) do
  comparator = Zero::Generators::Migration::OutputComparator.new

  # Test identical results
  result1 = {
    success: true,
    generated_models: [ { table_name: 'users', class_name: 'User' } ],
    generated_files: [ { path: 'user.ts', content: 'export class User {}' } ],
    errors: [],
    execution_time: 0.1
  }

  result2 = result1.dup

  comparison = comparator.compare(result1, result2)
  raise "Identical results should match" unless comparison.overall_match
  raise "Should have no discrepancies" unless comparison.discrepancies.empty?

  verbose_log("Output comparator working correctly")
end

# Test 7: Output Comparator Discrepancy Detection
run_test("OutputComparator discrepancy detection", results) do
  comparator = Zero::Generators::Migration::OutputComparator.new

  result1 = {
    success: true,
    generated_models: [ { table_name: 'users' } ],
    generated_files: [ { path: 'user.ts', content: 'export class User {}' } ],
    errors: []
  }

  result2 = {
    success: false, # Different success status
    generated_models: [ { table_name: 'users' } ],
    generated_files: [ { path: 'user.ts', content: 'export class DifferentUser {}' } ], # Different content
    errors: []
  }

  comparison = comparator.compare(result1, result2)
  raise "Different results should not match" if comparison.overall_match
  raise "Should detect discrepancies" if comparison.discrepancies.empty?

  # Should detect success status difference
  success_discrepancy = comparison.discrepancies.find { |d| d[:type] == :success_status }
  raise "Should detect success status discrepancy" unless success_discrepancy

  verbose_log("Discrepancy detection working correctly")
end

# Test 8: RollbackManager Basic Functionality
run_test("RollbackManager basic functionality", results) do
  # Create temporary state file
  temp_file = Tempfile.new('rollback_state')
  temp_path = temp_file.path
  temp_file.close

  begin
    flags = Zero::Generators::Migration::MigrationFeatureFlags.new
    manager = Zero::Generators::Migration::RollbackManager.new(
      feature_flags: flags,
      state_file_path: temp_path
    )

    raise "Initial state should be active" unless manager.current_state == :active

    # Test rollback recommendation
    flags.trip_circuit_breaker!
    raise "Should recommend rollback when circuit breaker open" unless manager.rollback_recommended?

    verbose_log("Rollback manager working correctly")

  ensure
    File.unlink(temp_path) if File.exist?(temp_path)
  end
end

# Test 9: RollbackManager State Persistence
run_test("RollbackManager state persistence", results) do
  temp_file = Tempfile.new('rollback_state')
  temp_path = temp_file.path
  temp_file.close

  begin
    flags = Zero::Generators::Migration::MigrationFeatureFlags.new
    manager1 = Zero::Generators::Migration::RollbackManager.new(
      feature_flags: flags,
      state_file_path: temp_path
    )

    # Execute rollback
    result = manager1.execute_emergency_rollback!(reason: "Test rollback")
    raise "Rollback should succeed" unless result[:success]

    # Create new manager to test persistence
    manager2 = Zero::Generators::Migration::RollbackManager.new(
      feature_flags: flags,
      state_file_path: temp_path
    )

    raise "State should be persisted" unless manager2.current_state == :rolled_back
    raise "History should be persisted" unless manager2.rollback_history.any?

    verbose_log("State persistence working correctly")

  ensure
    File.unlink(temp_path) if File.exist?(temp_path)
  end
end

# Test 10: Migration Module Health Check
run_test("Migration module health check", results) do
  health_result = Zero::Generators::Migration.health_check

  raise "Health check should return hash" unless health_result.is_a?(Hash)
  raise "Should have overall_health" unless health_result.key?(:overall_health)
  raise "Should have component_health" unless health_result.key?(:component_health)

  verbose_log("Health check result: #{health_result[:overall_health]}")
end

# Test 11: Migration Module Current Status
run_test("Migration module current status", results) do
  status = Zero::Generators::Migration.current_status

  raise "Status should return hash" unless status.is_a?(Hash)
  raise "Should have migration_version" unless status.key?(:migration_version)
  raise "Should have feature_flags" unless status.key?(:feature_flags)
  raise "Should have system_health" unless status.key?(:system_health)

  verbose_log("System health: #{status[:system_health]}")
end

# Test 12: Migration Adapter Creation
run_test("Migration adapter creation", results) do
  options = { table: 'users', dry_run: true }
  shell = Object.new
  shell.define_singleton_method(:say) { |msg, color| nil }

  adapter = Zero::Generators::Migration.create_adapter(options, shell)

  raise "Adapter should be created" unless adapter
  raise "Adapter should be MigrationAdapter" unless adapter.is_a?(Zero::Generators::Migration::MigrationAdapter)
  raise "Adapter should have options" unless adapter.options == options

  verbose_log("Migration adapter created successfully")
end

# Test 13: File Syntax Validation
run_test("All Ruby files have valid syntax", results) do
  base_path = File.expand_path('../lib/generators/zero/active_models/migration', __dir__)

  Dir.glob("#{base_path}/**/*.rb").each do |file|
    result = `ruby -c "#{file}" 2>&1`
    unless $?.success?
      raise "Syntax error in #{file}: #{result}"
    end
  end

  # Check main migration file
  main_file = File.expand_path('../lib/generators/zero/active_models/migration.rb', __dir__)
  result = `ruby -c "#{main_file}" 2>&1`
  unless $?.success?
    raise "Syntax error in #{main_file}: #{result}"
  end

  verbose_log("All Ruby files have valid syntax")
end

# Test 14: Test Files Syntax Validation
run_test("All test files have valid syntax", results) do
  test_path = File.expand_path('../test/lib/generators/zero/active_models/migration', __dir__)

  Dir.glob("#{test_path}/**/*.rb").each do |file|
    result = `ruby -c "#{file}" 2>&1`
    unless $?.success?
      raise "Syntax error in #{file}: #{result}"
    end
  end

  verbose_log("All test files have valid syntax")
end

# Test 15: Documentation Files Exist
run_test("Documentation files exist and are readable", results) do
  docs_path = File.expand_path('../docs/migration', __dir__)

  required_docs = [
    'strangler-fig-migration-guide.md',
    'operational-runbook.md'
  ]

  required_docs.each do |doc|
    doc_path = File.join(docs_path, doc)
    raise "Missing documentation: #{doc}" unless File.exist?(doc_path)
    raise "Documentation not readable: #{doc}" unless File.readable?(doc_path)

    # Check that file has content
    content = File.read(doc_path)
    raise "Documentation is empty: #{doc}" if content.strip.empty?
  end

  verbose_log("All documentation files exist and are readable")
end

# Test 16: Configuration Validation
run_test("Configuration validation works correctly", results) do
  # Test invalid percentage
  begin
    Zero::Generators::Migration::MigrationFeatureFlags.new(new_pipeline_percentage: 150)
    raise "Should have raised error for invalid percentage"
  rescue Zero::Generators::Migration::MigrationFeatureFlags::InvalidPercentageError
    # Expected
  end

  # Test invalid error threshold
  begin
    Zero::Generators::Migration::MigrationFeatureFlags.new(error_threshold: 0)
    raise "Should have raised error for invalid error threshold"
  rescue Zero::Generators::Migration::MigrationFeatureFlags::ConfigurationError
    # Expected
  end

  verbose_log("Configuration validation working correctly")
end

# Test 17: Performance Metrics Collection
run_test("Performance metrics collection", results) do
  flags = Zero::Generators::Migration::MigrationFeatureFlags.new(
    track_performance_metrics: true
  )

  # Record some metrics
  metrics = {
    legacy_execution_time: 0.1,
    new_execution_time: 0.15,
    canary_overhead: 0.05,
    legacy_pipeline_success: true,
    new_pipeline_success: true
  }

  flags.record_performance_metrics(metrics)

  stats = flags.performance_statistics
  raise "Stats should be returned" unless stats.is_a?(Hash)
  raise "Should have total_samples" unless stats.key?(:total_samples)
  raise "Should record sample" unless stats[:total_samples] > 0

  verbose_log("Performance metrics collection working")
end

# Test 18: Emergency Rollback Functionality
run_test("Emergency rollback functionality", results) do
  temp_file = Tempfile.new('rollback_state')
  temp_path = temp_file.path
  temp_file.close

  begin
    # Set up environment for test
    original_env = ENV.to_h
    ENV['MIGRATION_NEW_PIPELINE_PCT'] = '100'

    # Clear global instance
    Zero::Generators::Migration::MigrationFeatureFlags.instance_variable_set(:@instance, nil)
    Zero::Generators::Migration.configure_from_environment

    result = Zero::Generators::Migration.emergency_rollback!(
      reason: "Validation test rollback"
    )

    raise "Emergency rollback should succeed" unless result[:success]
    raise "Should be manual trigger" unless result[:trigger] == :emergency_manual

    # Check that system is now in rollback state
    status = Zero::Generators::Migration.current_status
    raise "Should be in rollback state" unless status[:rollback_status][:is_rolled_back]

    verbose_log("Emergency rollback working correctly")

  ensure
    File.unlink(temp_path) if File.exist?(temp_path)
    ENV.clear
    ENV.update(original_env)
    Zero::Generators::Migration::MigrationFeatureFlags.instance_variable_set(:@instance, nil)
  end
end

# Generate final report
puts "\nValidation Complete!"
results.report

# Exit with appropriate code
exit(results.passed? ? 0 : 1)
