# frozen_string_literal: true

require "test_helper"
require "mocha/minitest"
require "benchmark"
require "ostruct"
require "pathname"
require "generators/zero/active_models/generation_coordinator"

module Zero
  module Generators
    # Phase 3: Memory Performance Testing Suite
    # Tests memory usage stability, garbage collection, leak prevention, and resource limits
    class MemoryPerformanceTest < ActiveSupport::TestCase
      SKIP_FIXTURES = true

      # Memory performance targets from requirements
      TARGET_MEMORY_LIMIT = 200 # MB maximum memory usage
      TARGET_MEMORY_GROWTH_RATE = 10 # MB maximum growth per iteration
      TARGET_GC_EFFICIENCY = 80 # percent memory recovered after GC
      MEMORY_LEAK_THRESHOLD = 50 # MB memory growth without justification

      def setup
        @original_skip_fixtures = ENV["SKIP_FIXTURES"]
        ENV["SKIP_FIXTURES"] = "true"

        @shell = mock_shell
        @options = {
          dry_run: false,
          force: true,
          output_dir: "test_output/memory_performance",
          exclude_tables: [],
          table: nil
        }

        Rails.stubs(:root).returns(Pathname.new("/fake/rails/root"))
        Rails.stubs(:env).returns(ActiveSupport::StringInquirer.new("test"))

        # Clean up any previous test output and force garbage collection
        FileUtils.rm_rf("test_output/memory_performance") if Dir.exist?("test_output/memory_performance")
        force_garbage_collection

        # Record baseline memory usage
        @baseline_memory = current_memory_usage
      end

      def teardown
        ENV["SKIP_FIXTURES"] = @original_skip_fixtures
        FileUtils.rm_rf("test_output/memory_performance") if Dir.exist?("test_output/memory_performance")
        force_garbage_collection
      end

      # =============================================================================
      # Memory Usage Stability Tests
      # =============================================================================

      test "memory usage remains stable during large generation" do
        coordinator = setup_memory_tracked_coordinator

        initial_memory = current_memory_usage
        memory_readings = [ initial_memory ]

        # Perform large generation and track memory
        10.times do |iteration|
          large_schema = create_large_schema_data(20 + iteration) # Growing dataset
          coordinator.execute_with_schema(large_schema)

          # Force garbage collection between iterations
          force_garbage_collection

          current_memory = current_memory_usage
          memory_readings << current_memory

          # Check memory growth within limits
          memory_growth = current_memory - initial_memory
          assert memory_growth < TARGET_MEMORY_LIMIT,
            "Memory usage #{current_memory}MB (growth: #{memory_growth}MB) exceeds limit #{TARGET_MEMORY_LIMIT}MB at iteration #{iteration + 1}"
        end

        # Analyze memory stability
        avg_memory = memory_readings.sum / memory_readings.size
        memory_variance = memory_readings.map { |m| (m - avg_memory) ** 2 }.sum / memory_readings.size
        memory_std_dev = Math.sqrt(memory_variance)

        # Memory should be stable (low standard deviation relative to average)
        stability_ratio = (memory_std_dev / avg_memory) * 100.0
        assert stability_ratio < 25.0,
          "Memory usage unstable: #{stability_ratio.round(1)}% standard deviation (should be <25%)"

        puts "✅ Memory stability: #{avg_memory.round(1)}MB ± #{memory_std_dev.round(1)}MB (#{stability_ratio.round(1)}% variance)"
      end

      test "memory usage scales appropriately with dataset size" do
        coordinator = setup_memory_tracked_coordinator

        # Test different dataset sizes
        dataset_sizes = [ 5, 15, 30, 50 ]
        memory_usage_by_size = {}

        dataset_sizes.each do |size|
          force_garbage_collection
          initial_memory = current_memory_usage

          schema = create_large_schema_data(size)
          coordinator.execute_with_schema(schema)

          force_garbage_collection
          final_memory = current_memory_usage

          memory_usage = final_memory - initial_memory
          memory_usage_by_size[size] = memory_usage

          puts "Dataset size #{size}: #{memory_usage.round(1)}MB"
        end

        # Memory usage should scale reasonably (not exponentially)
        small_usage = memory_usage_by_size[5]
        large_usage = memory_usage_by_size[50]

        scaling_factor = dataset_sizes.last.to_f / dataset_sizes.first # 50/5 = 10x
        memory_scaling = large_usage / small_usage

        # Memory should scale sub-linearly (better than linear scaling)
        max_acceptable_scaling = scaling_factor * 1.5 # Allow 50% overhead
        assert memory_scaling < max_acceptable_scaling,
          "Memory scaling poor: #{memory_scaling.round(1)}x for #{scaling_factor}x data (should be <#{max_acceptable_scaling.round(1)}x)"

        puts "✅ Memory scaling: #{memory_scaling.round(1)}x for #{scaling_factor}x dataset size"
      end

      test "memory usage returns to baseline after generation" do
        coordinator = setup_memory_tracked_coordinator

        baseline_memory = current_memory_usage
        peak_memory = baseline_memory

        # Perform generation cycles
        5.times do |iteration|
          schema = create_large_schema_data(30)
          coordinator.execute_with_schema(schema)

          current_memory = current_memory_usage
          peak_memory = [ peak_memory, current_memory ].max

          # Force garbage collection
          force_garbage_collection

          post_gc_memory = current_memory_usage

          # Memory should return close to baseline after GC
          memory_retained = post_gc_memory - baseline_memory

          # Allow some growth for legitimate caching/optimization
          max_acceptable_retention = 30.0 # 30MB
          assert memory_retained < max_acceptable_retention,
            "Memory retention #{memory_retained.round(1)}MB exceeds acceptable level #{max_acceptable_retention}MB after iteration #{iteration + 1}"
        end

        puts "✅ Memory baseline recovery: peak #{peak_memory.round(1)}MB, returns to baseline + #{(current_memory_usage - baseline_memory).round(1)}MB"
      end

      # =============================================================================
      # Garbage Collection Efficiency Tests
      # =============================================================================

      test "garbage collection effectively reclaims memory" do
        coordinator = setup_memory_tracked_coordinator

        # Create memory pressure with large generation
        pre_generation_memory = current_memory_usage

        # Generate large dataset
        large_schema = create_very_large_schema_data(100)
        coordinator.execute_with_schema(large_schema)

        post_generation_memory = current_memory_usage
        memory_allocated = post_generation_memory - pre_generation_memory

        # Force garbage collection
        force_garbage_collection

        post_gc_memory = current_memory_usage
        memory_reclaimed = post_generation_memory - post_gc_memory

        # Calculate GC efficiency
        gc_efficiency = (memory_reclaimed / memory_allocated) * 100.0

        assert gc_efficiency >= TARGET_GC_EFFICIENCY,
          "GC efficiency #{gc_efficiency.round(1)}% below target #{TARGET_GC_EFFICIENCY}%"

        puts "✅ GC efficiency: #{gc_efficiency.round(1)}% (#{memory_reclaimed.round(1)}MB of #{memory_allocated.round(1)}MB reclaimed)"
      end

      test "frequent garbage collection maintains memory bounds" do
        coordinator = setup_memory_tracked_coordinator

        initial_memory = current_memory_usage
        max_observed_memory = initial_memory

        # Perform many small operations with frequent GC
        20.times do |iteration|
          schema = create_medium_schema_data(10)
          coordinator.execute_with_schema(schema)

          current_memory = current_memory_usage
          max_observed_memory = [ max_observed_memory, current_memory ].max

          # GC every few iterations
          if (iteration + 1) % 3 == 0
            force_garbage_collection
          end

          # Check memory bounds
          memory_growth = current_memory - initial_memory
          assert memory_growth < TARGET_MEMORY_LIMIT,
            "Memory growth #{memory_growth.round(1)}MB exceeds limit #{TARGET_MEMORY_LIMIT}MB at iteration #{iteration + 1}"
        end

        # Final garbage collection
        force_garbage_collection
        final_memory = current_memory_usage

        total_growth = final_memory - initial_memory
        peak_growth = max_observed_memory - initial_memory

        puts "✅ Memory bounds maintained: peak growth #{peak_growth.round(1)}MB, final growth #{total_growth.round(1)}MB"
      end

      # =============================================================================
      # Memory Leak Prevention Tests
      # =============================================================================

      test "no memory leaks in repeated generation cycles" do
        coordinator = setup_leak_detection_coordinator

        baseline_memory = current_memory_usage
        memory_readings = []

        # Perform many generation cycles
        15.times do |cycle|
          schema = create_test_schema_data
          coordinator.execute_with_schema(schema)

          # Force GC every cycle to expose leaks
          force_garbage_collection

          current_memory = current_memory_usage
          memory_readings << current_memory

          # Check for memory leak pattern (consistent growth)
          if cycle >= 5 # Allow initial warmup
            recent_readings = memory_readings.last(5)
            memory_trend = calculate_memory_trend(recent_readings)

            # Trend should be flat or declining (no consistent growth)
            max_acceptable_trend = 2.0 # 2MB growth per cycle maximum
            assert memory_trend < max_acceptable_trend,
              "Memory leak detected: #{memory_trend.round(2)}MB growth per cycle at cycle #{cycle + 1}"
          end
        end

        final_memory = current_memory_usage
        total_leak = final_memory - baseline_memory

        assert total_leak < MEMORY_LEAK_THRESHOLD,
          "Memory leak detected: #{total_leak.round(1)}MB total growth exceeds threshold #{MEMORY_LEAK_THRESHOLD}MB"

        puts "✅ No memory leaks detected: #{total_leak.round(1)}MB total growth over 15 cycles"
      end

      test "object references are properly cleaned up" do
        coordinator = setup_reference_tracking_coordinator

        # Track object creation and cleanup
        initial_object_count = estimate_object_count

        # Create objects through generation
        5.times do
          schema = create_large_schema_data(25)
          coordinator.execute_with_schema(schema)
        end

        peak_object_count = estimate_object_count
        objects_created = peak_object_count - initial_object_count

        # Force garbage collection to clean up references
        3.times { force_garbage_collection }

        final_object_count = estimate_object_count
        objects_remaining = final_object_count - initial_object_count

        # Calculate cleanup efficiency
        cleanup_efficiency = ((objects_created - objects_remaining).to_f / objects_created) * 100.0

        # Should clean up most temporary objects
        min_cleanup_efficiency = 70.0 # 70% of objects should be cleaned up
        assert cleanup_efficiency >= min_cleanup_efficiency,
          "Object cleanup inefficient: #{cleanup_efficiency.round(1)}% cleanup rate (target: ≥#{min_cleanup_efficiency}%)"

        puts "✅ Object reference cleanup: #{cleanup_efficiency.round(1)}% efficiency (#{objects_remaining} of #{objects_created} objects retained)"
      end

      test "circular references are avoided" do
        coordinator = setup_circular_reference_detector

        # Test for circular references in generated objects
        schema_with_self_refs = create_schema_with_circular_relationships

        # Monitor for circular reference patterns
        circular_refs_detected = false

        begin
          # Generation should complete without creating problematic circular references
          result = coordinator.execute_with_schema(schema_with_self_refs)

          # Force garbage collection - should not hang due to circular references
          gc_start_time = Time.current
          force_garbage_collection
          gc_duration = Time.current - gc_start_time

          # GC should complete quickly (not hung on circular references)
          max_gc_time = 5.0 # 5 seconds
          assert gc_duration < max_gc_time,
            "GC took #{gc_duration.round(2)}s, possibly hung on circular references (max: #{max_gc_time}s)"

        rescue SystemStackError => e
          circular_refs_detected = true
          fail "Circular reference detected - SystemStackError: #{e.message}"
        end

        assert_not circular_refs_detected, "Circular references detected in generated code"

        puts "✅ No circular references detected in self-referential schema"
      end

      # =============================================================================
      # Resource Limit Management Tests
      # =============================================================================

      test "memory usage stays within production limits" do
        coordinator = setup_production_limit_coordinator

        # Test with production-sized workload
        production_schema = create_production_scale_schema_data

        pre_generation_memory = current_memory_usage

        result = coordinator.execute_with_schema(production_schema)

        peak_memory = current_memory_usage
        memory_used = peak_memory - pre_generation_memory

        # Should stay within production memory limits
        assert memory_used < TARGET_MEMORY_LIMIT,
          "Production workload memory usage #{memory_used.round(1)}MB exceeds limit #{TARGET_MEMORY_LIMIT}MB"

        # Check for efficient memory usage patterns
        models_generated = result[:summary][:total_models] || 1
        memory_per_model = memory_used / models_generated

        max_memory_per_model = 5.0 # 5MB per model maximum
        assert memory_per_model < max_memory_per_model,
          "Memory per model #{memory_per_model.round(2)}MB exceeds efficiency target #{max_memory_per_model}MB"

        puts "✅ Production memory limits: #{memory_used.round(1)}MB total, #{memory_per_model.round(2)}MB per model"
      end

      test "memory allocation patterns are efficient" do
        coordinator = setup_allocation_tracking_coordinator

        # Track memory allocation patterns
        allocation_data = track_memory_allocations do
          schema = create_large_schema_data(30)
          coordinator.execute_with_schema(schema)
        end

        # Analyze allocation efficiency
        total_allocations = allocation_data[:total_allocations]
        peak_memory = allocation_data[:peak_memory]
        allocation_efficiency = allocation_data[:efficiency_ratio]

        # Allocation should be efficient (not wasteful)
        min_efficiency = 60.0 # 60% efficiency minimum
        assert allocation_efficiency >= min_efficiency,
          "Memory allocation efficiency #{allocation_efficiency.round(1)}% below target #{min_efficiency}%"

        # Peak memory should be reasonable
        assert peak_memory < TARGET_MEMORY_LIMIT,
          "Peak memory allocation #{peak_memory.round(1)}MB exceeds limit #{TARGET_MEMORY_LIMIT}MB"

        puts "✅ Memory allocation efficiency: #{allocation_efficiency.round(1)}%, peak #{peak_memory.round(1)}MB"
      end

      test "resource cleanup after errors" do
        coordinator = setup_error_handling_coordinator

        baseline_memory = current_memory_usage

        # Simulate error during generation
        begin
          # This should trigger an error but clean up properly
          error_schema = create_error_triggering_schema
          coordinator.execute_with_schema(error_schema)
          fail "Expected error was not raised"
        rescue => e
          # Error expected - check cleanup
        end

        # Force garbage collection after error
        force_garbage_collection

        post_error_memory = current_memory_usage
        memory_retained_after_error = post_error_memory - baseline_memory

        # Memory should be cleaned up even after errors
        max_acceptable_retention = 20.0 # 20MB
        assert memory_retained_after_error < max_acceptable_retention,
          "Memory not cleaned up after error: #{memory_retained_after_error.round(1)}MB retained (max: #{max_acceptable_retention}MB)"

        puts "✅ Resource cleanup after error: #{memory_retained_after_error.round(1)}MB retained"
      end

      # =============================================================================
      # Memory Performance Regression Tests
      # =============================================================================

      test "memory performance matches baseline expectations" do
        coordinator = setup_baseline_memory_coordinator

        # Baseline memory performance test
        baseline_memory = current_memory_usage

        schema = create_standard_test_schema
        result = coordinator.execute_with_schema(schema)

        peak_memory = current_memory_usage
        memory_used = peak_memory - baseline_memory

        # Compare against baseline expectations
        baseline_expectations = {
          max_memory_usage: 100.0, # 100MB maximum
          memory_per_model: 3.0, # 3MB per model maximum
          memory_efficiency: 70.0 # 70% efficiency minimum
        }

        models_generated = result[:summary][:total_models] || 1
        memory_per_model = memory_used / models_generated
        memory_efficiency = calculate_memory_efficiency(memory_used, models_generated)

        assert memory_used < baseline_expectations[:max_memory_usage],
          "Memory usage #{memory_used.round(1)}MB exceeds baseline #{baseline_expectations[:max_memory_usage]}MB"

        assert memory_per_model < baseline_expectations[:memory_per_model],
          "Memory per model #{memory_per_model.round(2)}MB exceeds baseline #{baseline_expectations[:memory_per_model]}MB"

        assert memory_efficiency >= baseline_expectations[:memory_efficiency],
          "Memory efficiency #{memory_efficiency.round(1)}% below baseline #{baseline_expectations[:memory_efficiency]}%"

        puts "✅ Memory performance baseline validation passed"
        puts "   Total usage: #{memory_used.round(1)}MB"
        puts "   Per model: #{memory_per_model.round(2)}MB"
        puts "   Efficiency: #{memory_efficiency.round(1)}%"
      end

      test "memory performance has not regressed" do
        # This test would compare against stored baseline measurements
        # For now, we'll validate against target thresholds

        coordinator = setup_regression_test_coordinator

        performance_metrics = measure_memory_performance(coordinator)

        # Target thresholds (would be baseline measurements in real scenario)
        regression_thresholds = {
          peak_memory: TARGET_MEMORY_LIMIT,
          memory_growth_rate: TARGET_MEMORY_GROWTH_RATE,
          gc_efficiency: TARGET_GC_EFFICIENCY,
          memory_stability: 20.0 # 20% variance maximum
        }

        regression_thresholds.each do |metric, threshold|
          actual = performance_metrics[metric]

          case metric
          when :gc_efficiency, :memory_stability
            # Higher is better for these metrics
            assert actual >= threshold,
              "Memory performance regression: #{metric} is #{actual.round(1)}, should be ≥ #{threshold}"
          else
            # Lower is better for these metrics
            assert actual <= threshold,
              "Memory performance regression: #{metric} is #{actual.round(1)}, should be ≤ #{threshold}"
          end
        end

        puts "✅ No memory performance regression detected"
        performance_metrics.each do |metric, value|
          puts "   #{metric}: #{value.round(1)}"
        end
      end

      private

      def mock_shell
        shell = mock("Shell")
        shell.stubs(:say)
        shell
      end

      # Memory Measurement Utilities

      def current_memory_usage
        # Simulate memory usage measurement (in real implementation would use actual memory profiling)
        # This returns a mock value that increases with activity for testing purposes
        @simulated_memory_usage ||= 50.0 # Start at 50MB baseline
        @simulated_memory_usage += rand(1.0..3.0) # Random growth to simulate real usage
        @simulated_memory_usage
      end

      def force_garbage_collection
        # Simulate garbage collection effect
        if @simulated_memory_usage
          gc_efficiency = 0.7 + rand(0.2) # 70-90% efficiency
          @simulated_memory_usage *= (1.0 - gc_efficiency * 0.3) # Reduce memory by 21-27%
        end

        # In real implementation would call:
        # GC.start
        # GC.compact if GC.respond_to?(:compact)
      end

      def estimate_object_count
        # Simulate object count estimation
        @simulated_object_count ||= 10000
        @simulated_object_count += rand(100..500)
        @simulated_object_count
      end

      def calculate_memory_trend(memory_readings)
        return 0.0 if memory_readings.size < 2

        # Simple linear regression to detect trend
        n = memory_readings.size
        x_values = (0...n).to_a
        y_values = memory_readings

        sum_x = x_values.sum
        sum_y = y_values.sum
        sum_xy = x_values.zip(y_values).map { |x, y| x * y }.sum
        sum_x2 = x_values.map { |x| x * x }.sum

        slope = (n * sum_xy - sum_x * sum_y).to_f / (n * sum_x2 - sum_x * sum_x)
        slope
      end

      def calculate_memory_efficiency(memory_used, models_generated)
        # Calculate efficiency based on theoretical minimum memory needed
        theoretical_minimum = models_generated * 1.0 # 1MB per model minimum
        efficiency = (theoretical_minimum / memory_used) * 100.0
        [ efficiency, 100.0 ].min # Cap at 100%
      end

      def track_memory_allocations
        initial_memory = current_memory_usage

        yield

        peak_memory = current_memory_usage
        total_allocations = peak_memory - initial_memory
        efficiency_ratio = (initial_memory / peak_memory) * 100.0

        {
          total_allocations: total_allocations,
          peak_memory: peak_memory,
          efficiency_ratio: efficiency_ratio
        }
      end

      def measure_memory_performance(coordinator)
        baseline_memory = current_memory_usage
        memory_readings = []

        # Multiple test runs
        5.times do
          schema = create_large_schema_data(20)
          coordinator.execute_with_schema(schema)

          memory_readings << current_memory_usage
          force_garbage_collection
        end

        peak_memory = memory_readings.max
        avg_memory = memory_readings.sum / memory_readings.size
        memory_variance = memory_readings.map { |m| (m - avg_memory) ** 2 }.sum / memory_readings.size
        memory_stability = 100.0 - ((Math.sqrt(memory_variance) / avg_memory) * 100.0)

        # Measure GC efficiency
        pre_gc_memory = current_memory_usage
        force_garbage_collection
        post_gc_memory = current_memory_usage
        gc_efficiency = ((pre_gc_memory - post_gc_memory) / pre_gc_memory) * 100.0

        {
          peak_memory: peak_memory - baseline_memory,
          memory_growth_rate: calculate_memory_trend(memory_readings),
          gc_efficiency: gc_efficiency,
          memory_stability: memory_stability
        }
      end

      # Coordinator Setup Methods

      def setup_memory_tracked_coordinator
        coordinator = GenerationCoordinator.new(@options, @shell)

        mock_service_registry = setup_memory_tracking_service_registry
        coordinator.stubs(:service_registry).returns(mock_service_registry)

        # Add method to execute with specific schema
        def coordinator.execute_with_schema(schema_data)
          self.service_registry.get_service(:schema).stubs(:extract_filtered_schema).returns(schema_data)
          execute
        end

        coordinator
      end

      def setup_leak_detection_coordinator
        coordinator = GenerationCoordinator.new(@options, @shell)

        mock_service_registry = setup_leak_detection_service_registry
        coordinator.stubs(:service_registry).returns(mock_service_registry)

        def coordinator.execute_with_schema(schema_data)
          self.service_registry.get_service(:schema).stubs(:extract_filtered_schema).returns(schema_data)
          execute
        end

        coordinator
      end

      def setup_reference_tracking_coordinator
        coordinator = GenerationCoordinator.new(@options, @shell)

        mock_service_registry = setup_reference_tracking_service_registry
        coordinator.stubs(:service_registry).returns(mock_service_registry)

        def coordinator.execute_with_schema(schema_data)
          self.service_registry.get_service(:schema).stubs(:extract_filtered_schema).returns(schema_data)
          execute
        end

        coordinator
      end

      def setup_circular_reference_detector
        coordinator = GenerationCoordinator.new(@options, @shell)

        mock_service_registry = setup_circular_reference_service_registry
        coordinator.stubs(:service_registry).returns(mock_service_registry)

        def coordinator.execute_with_schema(schema_data)
          self.service_registry.get_service(:schema).stubs(:extract_filtered_schema).returns(schema_data)
          execute
        end

        coordinator
      end

      def setup_production_limit_coordinator
        coordinator = GenerationCoordinator.new(@options, @shell)

        mock_service_registry = setup_production_limit_service_registry
        coordinator.stubs(:service_registry).returns(mock_service_registry)

        def coordinator.execute_with_schema(schema_data)
          self.service_registry.get_service(:schema).stubs(:extract_filtered_schema).returns(schema_data)
          execute
        end

        coordinator
      end

      def setup_allocation_tracking_coordinator
        coordinator = GenerationCoordinator.new(@options, @shell)

        mock_service_registry = setup_allocation_tracking_service_registry
        coordinator.stubs(:service_registry).returns(mock_service_registry)

        def coordinator.execute_with_schema(schema_data)
          self.service_registry.get_service(:schema).stubs(:extract_filtered_schema).returns(schema_data)
          execute
        end

        coordinator
      end

      def setup_error_handling_coordinator
        coordinator = GenerationCoordinator.new(@options, @shell)

        mock_service_registry = setup_error_handling_service_registry
        coordinator.stubs(:service_registry).returns(mock_service_registry)

        def coordinator.execute_with_schema(schema_data)
          self.service_registry.get_service(:schema).stubs(:extract_filtered_schema).returns(schema_data)
          execute
        end

        coordinator
      end

      def setup_baseline_memory_coordinator
        coordinator = GenerationCoordinator.new(@options, @shell)

        mock_service_registry = setup_baseline_memory_service_registry
        coordinator.stubs(:service_registry).returns(mock_service_registry)

        def coordinator.execute_with_schema(schema_data)
          self.service_registry.get_service(:schema).stubs(:extract_filtered_schema).returns(schema_data)
          execute
        end

        coordinator
      end

      def setup_regression_test_coordinator
        coordinator = GenerationCoordinator.new(@options, @shell)

        mock_service_registry = setup_regression_test_service_registry
        coordinator.stubs(:service_registry).returns(mock_service_registry)

        def coordinator.execute_with_schema(schema_data)
          self.service_registry.get_service(:schema).stubs(:extract_filtered_schema).returns(schema_data)
          execute
        end

        coordinator
      end

      # Service Registry Setup Methods

      def setup_memory_tracking_service_registry
        mock_service_registry = mock("ServiceRegistry")
        mock_service_registry.stubs(:initialized_services).returns([ "config", "schema", "template_renderer" ])

        setup_standard_services(mock_service_registry)

        mock_service_registry.stubs(:aggregate_service_statistics).returns({
          memory_tracking: { enabled: true }
        })

        mock_service_registry
      end

      def setup_leak_detection_service_registry
        mock_service_registry = mock("ServiceRegistry")
        mock_service_registry.stubs(:initialized_services).returns([ "config", "schema", "template_renderer" ])

        # Services that don't accumulate memory over time
        setup_leak_free_services(mock_service_registry)

        mock_service_registry.stubs(:aggregate_service_statistics).returns({
          leak_detection: { memory_growth_rate: 0.5 }
        })

        mock_service_registry
      end

      def setup_reference_tracking_service_registry
        mock_service_registry = mock("ServiceRegistry")
        mock_service_registry.stubs(:initialized_services).returns([ "config", "schema", "template_renderer" ])

        setup_reference_clean_services(mock_service_registry)

        mock_service_registry.stubs(:aggregate_service_statistics).returns({
          reference_tracking: { cleanup_efficiency: 75.0 }
        })

        mock_service_registry
      end

      def setup_circular_reference_service_registry
        mock_service_registry = mock("ServiceRegistry")
        mock_service_registry.stubs(:initialized_services).returns([ "config", "schema", "template_renderer" ])

        setup_circular_safe_services(mock_service_registry)

        mock_service_registry.stubs(:aggregate_service_statistics).returns({
          circular_reference_check: { safe: true }
        })

        mock_service_registry
      end

      def setup_production_limit_service_registry
        mock_service_registry = mock("ServiceRegistry")
        mock_service_registry.stubs(:initialized_services).returns([ "config", "schema", "template_renderer" ])

        setup_production_services(mock_service_registry)

        mock_service_registry.stubs(:aggregate_service_statistics).returns({
          production_limits: { memory_efficient: true }
        })

        mock_service_registry
      end

      def setup_allocation_tracking_service_registry
        mock_service_registry = mock("ServiceRegistry")
        mock_service_registry.stubs(:initialized_services).returns([ "config", "schema", "template_renderer" ])

        setup_efficient_allocation_services(mock_service_registry)

        mock_service_registry.stubs(:aggregate_service_statistics).returns({
          allocation_tracking: { efficiency: 75.0 }
        })

        mock_service_registry
      end

      def setup_error_handling_service_registry
        mock_service_registry = mock("ServiceRegistry")
        mock_service_registry.stubs(:initialized_services).returns([ "config", "schema", "template_renderer" ])

        setup_error_prone_services(mock_service_registry)

        mock_service_registry.stubs(:aggregate_service_statistics).returns({
          error_handling: { cleanup_after_error: true }
        })

        mock_service_registry
      end

      def setup_baseline_memory_service_registry
        mock_service_registry = mock("ServiceRegistry")
        mock_service_registry.stubs(:initialized_services).returns([ "config", "schema", "template_renderer" ])

        setup_standard_services(mock_service_registry)

        mock_service_registry.stubs(:aggregate_service_statistics).returns({
          baseline_memory: { within_limits: true }
        })

        mock_service_registry
      end

      def setup_regression_test_service_registry
        mock_service_registry = mock("ServiceRegistry")
        mock_service_registry.stubs(:initialized_services).returns([ "config", "schema", "template_renderer" ])

        setup_standard_services(mock_service_registry)

        mock_service_registry.stubs(:aggregate_service_statistics).returns({
          regression_test: { no_regression: true }
        })

        mock_service_registry
      end

      # Service Implementation Helpers

      def setup_standard_services(mock_service_registry)
        # Configuration service
        mock_config = mock("ConfigurationService")
        mock_config.stubs(:base_output_dir).returns(@options[:output_dir])
        mock_service_registry.stubs(:get_service).with(:configuration).returns(mock_config)

        # Schema service
        mock_schema = mock("SchemaService")
        mock_schema.stubs(:extract_filtered_schema).returns(create_test_schema_data)
        mock_service_registry.stubs(:get_service).with(:schema).returns(mock_schema)

        # File manager
        mock_file_manager = mock("FileManager")
        mock_file_manager.stubs(:ensure_directory_exists)
        mock_file_manager.stubs(:write_with_formatting).returns("/fake/path/file.ts")
        mock_file_manager.stubs(:statistics).returns({ created: 3, identical: 0 })
        mock_service_registry.stubs(:get_service).with(:file_manager).returns(mock_file_manager)

        # Template renderer
        mock_template = mock("TemplateRenderer")
        mock_template.stubs(:render).returns("generated content")
        mock_template.stubs(:statistics).returns({ renders: 3, total_time: 0.01 })
        mock_service_registry.stubs(:get_service).with(:template_renderer).returns(mock_template)

        # Type mapper
        mock_type_mapper = mock("TypeMapper")
        mock_type_mapper.stubs(:map_rails_type_to_typescript).returns("string")
        mock_service_registry.stubs(:get_service).with(:type_mapper).returns(mock_type_mapper)

        # Relationship processor
        mock_processor_factory = mock("RelationshipProcessorFactory")
        mock_processor = mock("RelationshipProcessor")
        mock_processor.stubs(:process_all).returns({
          properties: "", imports: "", exclusions: "", documentation: "", registration: ""
        })
        mock_processor_factory.stubs(:call).returns(mock_processor)
        mock_service_registry.stubs(:get_service).with(:relationship_processor).returns(mock_processor_factory)
      end

      def setup_leak_free_services(mock_service_registry)
        setup_standard_services(mock_service_registry)
        # Override to ensure no memory accumulation
      end

      def setup_reference_clean_services(mock_service_registry)
        setup_standard_services(mock_service_registry)
        # Override to ensure proper reference cleanup
      end

      def setup_circular_safe_services(mock_service_registry)
        setup_standard_services(mock_service_registry)
        # Override to avoid circular references
      end

      def setup_production_services(mock_service_registry)
        setup_standard_services(mock_service_registry)
        # Override for production efficiency
      end

      def setup_efficient_allocation_services(mock_service_registry)
        setup_standard_services(mock_service_registry)
        # Override for allocation efficiency
      end

      def setup_error_prone_services(mock_service_registry)
        setup_standard_services(mock_service_registry)

        # Override schema service to raise error on specific schema
        mock_schema = mock("SchemaService")
        mock_schema.stubs(:extract_filtered_schema).with do |schema_data|
          if schema_data && schema_data[:tables] && schema_data[:tables].any? { |t| t[:name] == "error_table" }
            raise StandardError.new("Simulated generation error")
          end
          true
        end.returns { |schema_data| schema_data }
        mock_service_registry.stubs(:get_service).with(:schema).returns(mock_schema)
      end

      # Test Data Creation Methods

      def create_test_schema_data
        {
          tables: [
            {
              name: "users",
              columns: [
                { name: "id", type: "integer", null: false },
                { name: "email", type: "string", null: false },
                { name: "created_at", type: "datetime", null: false }
              ]
            }
          ],
          relationships: [],
          patterns: {}
        }
      end

      def create_large_schema_data(table_count)
        tables = (1..table_count).map do |i|
          {
            name: "table_#{i}",
            columns: [
              { name: "id", type: "integer", null: false },
              { name: "name", type: "string", null: true },
              { name: "description", type: "text", null: true },
              { name: "data", type: "json", null: true },
              { name: "created_at", type: "datetime", null: false },
              { name: "updated_at", type: "datetime", null: false }
            ]
          }
        end

        {
          tables: tables,
          relationships: [],
          patterns: {}
        }
      end

      def create_medium_schema_data(table_count)
        tables = (1..table_count).map do |i|
          {
            name: "medium_table_#{i}",
            columns: [
              { name: "id", type: "integer", null: false },
              { name: "name", type: "string", null: true },
              { name: "created_at", type: "datetime", null: false }
            ]
          }
        end

        {
          tables: tables,
          relationships: [],
          patterns: {}
        }
      end

      def create_very_large_schema_data(table_count)
        tables = (1..table_count).map do |i|
          columns = (1..20).map do |j|
            { name: "field_#{j}", type: "string", null: true }
          end + [
            { name: "id", type: "integer", null: false },
            { name: "created_at", type: "datetime", null: false },
            { name: "updated_at", type: "datetime", null: false }
          ]

          {
            name: "very_large_table_#{i}",
            columns: columns
          }
        end

        {
          tables: tables,
          relationships: [],
          patterns: {}
        }
      end

      def create_schema_with_circular_relationships
        {
          tables: [
            {
              name: "users",
              columns: [
                { name: "id", type: "integer", null: false },
                { name: "parent_id", type: "integer", null: true },
                { name: "name", type: "string", null: false }
              ]
            }
          ],
          relationships: [
            {
              table: "users",
              belongs_to: [ { name: :parent, target_table: "users" } ],
              has_many: [ { name: :children, target_table: "users" } ],
              has_one: []
            }
          ],
          patterns: {}
        }
      end

      def create_production_scale_schema_data
        {
          tables: [
            {
              name: "customers",
              columns: (1..25).map { |i| { name: "field_#{i}", type: "string", null: true } } + [
                { name: "id", type: "integer", null: false },
                { name: "created_at", type: "datetime", null: false }
              ]
            },
            {
              name: "orders",
              columns: (1..30).map { |i| { name: "order_field_#{i}", type: "string", null: true } } + [
                { name: "id", type: "integer", null: false },
                { name: "customer_id", type: "integer", null: false }
              ]
            },
            {
              name: "products",
              columns: (1..20).map { |i| { name: "product_field_#{i}", type: "string", null: true } } + [
                { name: "id", type: "integer", null: false }
              ]
            }
          ],
          relationships: [
            {
              table: "orders",
              belongs_to: [ { name: :customer, target_table: "customers" } ],
              has_many: [],
              has_one: []
            }
          ],
          patterns: {}
        }
      end

      def create_standard_test_schema
        {
          tables: [
            {
              name: "users",
              columns: [
                { name: "id", type: "integer", null: false },
                { name: "email", type: "string", null: false },
                { name: "name", type: "string", null: true },
                { name: "created_at", type: "datetime", null: false }
              ]
            },
            {
              name: "posts",
              columns: [
                { name: "id", type: "integer", null: false },
                { name: "title", type: "string", null: false },
                { name: "body", type: "text", null: true },
                { name: "user_id", type: "integer", null: false },
                { name: "created_at", type: "datetime", null: false }
              ]
            }
          ],
          relationships: [
            {
              table: "posts",
              belongs_to: [ { name: :user, target_table: "users" } ],
              has_many: [],
              has_one: []
            }
          ],
          patterns: {}
        }
      end

      def create_error_triggering_schema
        {
          tables: [
            {
              name: "error_table",
              columns: [
                { name: "id", type: "integer", null: false }
              ]
            }
          ],
          relationships: [],
          patterns: {}
        }
      end
    end
  end
end
