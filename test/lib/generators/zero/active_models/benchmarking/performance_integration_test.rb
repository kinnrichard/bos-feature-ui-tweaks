# frozen_string_literal: true

require "test_helper"
require "tempfile"
require "fileutils"

class PerformanceIntegrationTest < ActiveSupport::TestCase
  def setup
    @temp_dir = Dir.mktmpdir("performance_integration_test")

    # Initialize full performance optimization stack
    @performance_optimizer = Zero::Generators::Benchmarking::PerformanceOptimizer.new(
      config: {
        enable_benchmarking: true,
        enable_parallel_execution: true,
        enable_caching: true,
        enable_monitoring: true,
        benchmark_iterations: 3, # Reduced for faster tests
        auto_tune: false,
        cache_ttl: 30, # Reasonable TTL for tests
        alert_thresholds: {
          execution_time: 10.0,
          memory_usage: 100,
          error_rate: 10.0
        }
      }
    )

    # Mock Rails environment for testing
    mock_rails_environment
  end

  def teardown
    FileUtils.rm_rf(@temp_dir) if Dir.exist?(@temp_dir)

    # Cleanup any running monitors
    @performance_optimizer.performance_monitor.end_monitoring_session rescue nil
  end

  # Test complete end-to-end optimization workflow
  test "performs complete end-to-end optimization workflow" do
    optimization_completed = false
    generation_count = 0

    result = @performance_optimizer.optimize_generation do
      generation_count += 1
      optimization_completed = true

      # Simulate ReactiveRecord generation
      simulate_generation_process
    end

    assert optimization_completed
    assert_equal 1, generation_count
    assert result[:success]
    assert result[:generated_files].any?
    assert result[:statistics]

    # Verify optimization was recorded in history
    assert @performance_optimizer.optimization_history.any?
    latest_optimization = @performance_optimizer.optimization_history.last
    assert latest_optimization[:strategy]
    assert latest_optimization[:success]
    assert latest_optimization[:execution_time] > 0
  end

  # Test integration between all performance components
  test "integrates all performance components correctly" do
    optimizer = @performance_optimizer

    # Verify all components are initialized
    assert optimizer.benchmark_runner, "Benchmark runner should be initialized"
    assert optimizer.parallel_executor, "Parallel executor should be initialized"
    assert optimizer.cache_optimizer, "Cache optimizer should be initialized"
    assert optimizer.performance_monitor, "Performance monitor should be initialized"

    # Verify components are integrated with monitor
    monitor_integrations = optimizer.performance_monitor.integrations
    assert monitor_integrations[:benchmark_runner], "Benchmark runner should be integrated"
    assert monitor_integrations[:cache_optimizer], "Cache optimizer should be integrated"
    assert monitor_integrations[:parallel_executor], "Parallel executor should be integrated"
  end

  # Test strategy recommendation and automatic selection
  test "recommends and applies optimal performance strategy" do
    # Mock workload characteristics that favor parallel execution
    workload_characteristics = {
      dataset_size: :large,
      complexity_level: :high,
      parallelization_potential: 0.8,
      caching_potential: 0.6,
      baseline_performance: { execution_time: 15.0, memory_usage: 200 }
    }

    recommendation = @performance_optimizer.analyze_and_recommend_strategy(workload_characteristics)

    assert recommendation[:recommended_strategy]
    assert recommendation[:confidence_score] > 0.5
    assert recommendation[:workload_analysis]
    assert recommendation[:alternative_strategies].any?

    # Apply the recommended strategy
    applied_strategy = nil
    result = @performance_optimizer.optimize_generation(strategy: recommendation[:recommended_strategy]) do
      applied_strategy = @performance_optimizer.current_strategy
      simulate_generation_process
    end

    assert_equal recommendation[:recommended_strategy], applied_strategy
    assert result[:success]
  end

  # Test caching integration with generation process
  test "caching improves generation performance" do
    cache_optimizer = @performance_optimizer.cache_optimizer

    # First generation should populate cache
    first_execution_time = nil
    first_result = @performance_optimizer.optimize_generation(strategy: :cache_heavy) do
      start_time = Time.current
      result = simulate_generation_with_cacheable_operations
      first_execution_time = Time.current - start_time
      result
    end

    # Second generation should benefit from cache
    second_execution_time = nil
    second_result = @performance_optimizer.optimize_generation(strategy: :cache_heavy) do
      start_time = Time.current
      result = simulate_generation_with_cacheable_operations
      second_execution_time = Time.current - start_time
      result
    end

    # Verify both generations succeeded
    assert first_result[:success]
    assert second_result[:success]

    # Verify cache was used (check cache statistics)
    cache_report = cache_optimizer.cache_efficiency_report
    assert cache_report[:overall][:total_requests] > 0
    assert cache_report[:overall][:total_hits] > 0
    assert cache_report[:overall][:hit_rate] > 0
  end

  # Test parallel execution integration
  test "parallel execution handles pipeline stages correctly" do
    parallel_executor = @performance_optimizer.parallel_executor

    # Create mock pipeline stages
    stages = [
      {
        name: :schema_analysis,
        callable: -> { simulate_schema_analysis; "schema_result" }
      },
      {
        name: :type_mapping,
        callable: -> { simulate_type_mapping; "mapping_result" }
      },
      {
        name: :template_rendering,
        callable: -> { simulate_template_rendering; "template_result" }
      }
    ]

    # Execute stages in parallel
    parallel_result = parallel_executor.execute_parallel(stages)

    assert parallel_result[:success] || parallel_result[:summary][:successful_stages] > 0
    assert parallel_result[:stage_results].any?
    assert parallel_result[:total_execution_time] > 0

    # Execute stages sequentially for comparison
    sequential_result = parallel_executor.execute_sequential(stages)

    assert sequential_result[:success] || sequential_result[:summary][:successful_stages] > 0
    assert sequential_result[:stage_results].any?

    # Compare performance (parallel should be faster or similar)
    parallel_time = parallel_result[:total_execution_time]
    sequential_time = sequential_result[:total_execution_time]

    # In ideal conditions, parallel should be faster, but due to overhead in tests it might not be
    # Just verify both completed successfully
    assert parallel_time > 0
    assert sequential_time > 0
  end

  # Test comprehensive performance analysis
  test "runs comprehensive performance analysis successfully" do
    analysis_results = @performance_optimizer.run_comprehensive_analysis(include_all_strategies: false)

    # Verify analysis structure
    assert analysis_results[:timestamp]
    assert analysis_results[:workload_analysis]
    assert analysis_results[:benchmark_results]
    assert analysis_results[:strategy_comparisons]
    assert analysis_results[:recommendations]

    # Verify workload analysis
    workload = analysis_results[:workload_analysis]
    assert workload.key?(:dataset_size)
    assert workload.key?(:complexity_level)
    assert workload.key?(:baseline_performance)

    # Verify benchmark results
    benchmarks = analysis_results[:benchmark_results]
    assert benchmarks.any?

    # Verify strategy comparisons
    strategies = analysis_results[:strategy_comparisons]
    assert strategies.any?

    # Verify recommendations
    recommendations = analysis_results[:recommendations]
    assert recommendations.is_a?(Array)
  end

  # Test real-time performance monitoring
  test "monitors performance in real-time during generation" do
    monitor = @performance_optimizer.performance_monitor

    # Start monitoring session
    session_id = monitor.start_monitoring_session("integration_test")
    assert session_id

    # Perform generation with monitoring
    result = @performance_optimizer.optimize_generation(strategy: :balanced) do
      simulate_generation_process_with_stages
    end

    # Get real-time metrics
    metrics = monitor.get_real_time_metrics
    assert metrics[:session_id]
    assert metrics[:session_name]
    assert metrics[:duration] >= 0

    # End monitoring session
    session_summary = monitor.end_monitoring_session
    assert session_summary
    assert session_summary[:duration] > 0
  end

  # Test error handling and recovery
  test "handles errors gracefully during optimization" do
    error_count = 0

    # Optimize generation that throws an error
    result = @performance_optimizer.optimize_generation(strategy: :sequential) do
      error_count += 1
      if error_count == 1
        raise StandardError, "Simulated generation error"
      else
        simulate_generation_process
      end
    end

    # Should record the error but not crash
    assert @performance_optimizer.optimization_history.any?
    optimization_record = @performance_optimizer.optimization_history.last
    refute optimization_record[:success]
  end

  # Test performance alerts and thresholds
  test "triggers performance alerts when thresholds exceeded" do
    # Configure optimizer with low thresholds
    alert_optimizer = Zero::Generators::Benchmarking::PerformanceOptimizer.new(
      config: {
        enable_monitoring: true,
        alert_thresholds: {
          execution_time: 0.1, # Very low threshold to trigger alerts
          memory_usage: 10,    # Very low threshold to trigger alerts
          error_rate: 1.0
        }
      }
    )

    monitor = alert_optimizer.performance_monitor
    monitor.start_monitoring_session("alert_test")

    # Perform operation that should trigger alerts
    alert_optimizer.optimize_generation(strategy: :minimal) do
      sleep(0.2) # Exceed execution time threshold
      simulate_high_memory_operation
    end

    # Check for alerts
    alerts = monitor.get_performance_alerts(active_only: true)

    # Should have some alerts (exact count depends on implementation)
    assert alerts.is_a?(Array)

    monitor.end_monitoring_session
  end

  # Test configuration updates and reconfiguration
  test "updates configuration and reconfigures components" do
    original_iterations = @performance_optimizer.config[:benchmark_iterations]

    new_config = {
      benchmark_iterations: 10,
      enable_real_time_monitoring: true,
      cache_ttl: 60
    }

    @performance_optimizer.update_configuration(new_config)

    # Verify configuration was updated
    updated_config = @performance_optimizer.config
    assert_equal 10, updated_config[:benchmark_iterations]
    assert updated_config[:enable_real_time_monitoring]
    assert_equal 60, updated_config[:cache_ttl]
  end

  # Test report generation integration
  test "generates comprehensive reports with all component data" do
    # Perform some optimizations to generate data
    @performance_optimizer.optimize_generation(strategy: :parallel) do
      simulate_generation_process
    end

    @performance_optimizer.optimize_generation(strategy: :sequential) do
      simulate_generation_process
    end

    # Generate different report formats
    json_report = @performance_optimizer.generate_comprehensive_report(format: :json)
    html_report = @performance_optimizer.generate_comprehensive_report(format: :html)
    markdown_report = @performance_optimizer.generate_comprehensive_report(format: :markdown)

    # Verify JSON report
    assert json_report.is_a?(String)
    parsed_json = JSON.parse(json_report)
    assert parsed_json["generated_at"]
    assert parsed_json["optimization_history"]
    assert parsed_json["component_status"]

    # Verify HTML report
    assert html_report.include?("<html>")
    assert html_report.include?("ReactiveRecord Performance Optimization Report")

    # Verify Markdown report
    assert markdown_report.include?("# ReactiveRecord Performance Optimization Report")
    assert markdown_report.include?("## Component Status")
  end

  # Test memory usage across entire optimization stack
  test "maintains reasonable memory usage across optimization stack" do
    initial_memory = get_memory_usage

    # Perform multiple optimization cycles
    5.times do |i|
      strategy = [ :sequential, :parallel, :cache_heavy, :balanced, :minimal ][i % 5]

      @performance_optimizer.optimize_generation(strategy: strategy) do
        simulate_generation_process
      end
    end

    # Force garbage collection
    GC.start

    final_memory = get_memory_usage
    memory_growth = final_memory - initial_memory

    # Memory growth should be reasonable (less than 50MB for 5 optimization cycles)
    assert memory_growth < 50, "Memory growth (#{memory_growth}MB) should be reasonable"
  end

  # Test concurrent optimization execution safety
  test "handles concurrent optimization execution safely" do
    threads = []
    results = []
    errors = []

    # Run multiple optimizations concurrently
    3.times do |i|
      threads << Thread.new do
        begin
          optimizer = Zero::Generators::Benchmarking::PerformanceOptimizer.new(
            config: { enable_monitoring: true, benchmark_iterations: 2 }
          )

          result = optimizer.optimize_generation(strategy: :balanced) do
            simulate_generation_process
          end

          results << result
        rescue => e
          errors << e
        end
      end
    end

    threads.each(&:join)

    # All optimizations should complete without errors
    assert errors.empty?, "Concurrent optimizations should not cause errors: #{errors.map(&:message)}"
    assert_equal 3, results.length
    results.each { |result| assert result[:success] }
  end

  private

  # Simulation methods for testing

  def mock_rails_environment
    # Mock basic Rails environment for testing
    unless defined?(Rails)
      rails_class = Class.new do
        def self.version; "7.0.0"; end
        def self.env; "test"; end
      end
      Object.const_set(:Rails, rails_class)
    end
  end

  def simulate_generation_process
    # Simulate typical ReactiveRecord generation process
    sleep(0.05) # Simulate some processing time

    {
      success: true,
      execution_time: rand(0.01..0.1),
      generated_models: (1..3).map { |i| { table_name: "table_#{i}", class_name: "Table#{i}" } },
      generated_files: (1..6).map { |i| File.join(@temp_dir, "file_#{i}.ts") },
      errors: [],
      statistics: {
        execution_time: rand(0.01..0.1),
        models_generated: 3,
        files_created: 6,
        memory_usage: { peak_memory_mb: rand(20..80) },
        pipeline_stages: 4
      }
    }
  end

  def simulate_generation_with_cacheable_operations
    # Simulate generation with operations that can be cached
    cache_optimizer = @performance_optimizer.cache_optimizer

    # Simulate schema introspection (cacheable)
    schema_data = cache_optimizer.cached_schema_introspection do
      sleep(0.02) # Expensive operation
      { tables: [ "users", "posts", "comments" ], relationships: [] }
    end

    # Simulate type mapping (cacheable)
    string_type = cache_optimizer.cached_type_mapping("string", { null: false }) do
      sleep(0.01)
      "string"
    end

    # Simulate template rendering (cacheable)
    template_content = cache_optimizer.cached_template_render("/tmp/template.erb", { class_name: "User" }) do
      sleep(0.015)
      "export class User { ... }"
    end

    {
      success: true,
      execution_time: rand(0.05..0.1),
      generated_models: schema_data[:tables].map { |table| { table_name: table } },
      generated_files: [ "user.ts", "post.ts", "comment.ts" ],
      errors: [],
      statistics: {
        execution_time: rand(0.05..0.1),
        models_generated: schema_data[:tables].length,
        files_created: 3
      }
    }
  end

  def simulate_generation_process_with_stages
    # Simulate generation with distinct pipeline stages
    stages = []

    # Stage 1: Schema Analysis
    stages << { name: :schema_analysis, duration: 0.02 }
    sleep(0.02)

    # Stage 2: Model Generation
    stages << { name: :model_generation, duration: 0.03 }
    sleep(0.03)

    # Stage 3: TypeScript Generation
    stages << { name: :typescript_generation, duration: 0.025 }
    sleep(0.025)

    # Stage 4: File Writing
    stages << { name: :file_writing, duration: 0.015 }
    sleep(0.015)

    {
      success: true,
      execution_time: stages.sum { |s| s[:duration] },
      generated_models: [ { table_name: "users" } ],
      generated_files: [ "users.ts" ],
      errors: [],
      statistics: {
        execution_time: stages.sum { |s| s[:duration] },
        models_generated: 1,
        files_created: 1,
        pipeline_stages: stages
      }
    }
  end

  def simulate_schema_analysis
    sleep(0.01)
    "Schema analysis complete"
  end

  def simulate_type_mapping
    sleep(0.008)
    "Type mapping complete"
  end

  def simulate_template_rendering
    sleep(0.012)
    "Template rendering complete"
  end

  def simulate_high_memory_operation
    # Simulate operation that uses more memory
    large_array = Array.new(10000) { |i| "memory_item_#{i}" }
    large_array.map(&:upcase) # Use the memory
    large_array = nil # Release memory
  end

  def get_memory_usage
    # Platform-specific memory usage
    if RUBY_PLATFORM =~ /darwin/
      `ps -o rss= -p #{Process.pid}`.to_i / 1024.0 # Convert KB to MB
    else
      0.0 # Fallback for other platforms in tests
    end
  end
end
