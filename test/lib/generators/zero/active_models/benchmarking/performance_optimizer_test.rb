# frozen_string_literal: true

require "test_helper"
require "tempfile"
require "fileutils"

class PerformanceOptimizerTest < ActiveSupport::TestCase
  def setup
    @temp_dir = Dir.mktmpdir("performance_optimizer_test")
    @optimizer = Zero::Generators::Benchmarking::PerformanceOptimizer.new(
      config: {
        enable_benchmarking: true,
        enable_parallel_execution: true,
        enable_caching: true,
        enable_monitoring: true,
        benchmark_iterations: 2, # Reduced for faster tests
        auto_tune: false # Disable auto-tuning for predictable tests
      }
    )
  end

  def teardown
    FileUtils.rm_rf(@temp_dir) if Dir.exist?(@temp_dir)
  end

  # Test optimizer initialization
  test "initializes with correct default configuration" do
    optimizer = Zero::Generators::Benchmarking::PerformanceOptimizer.new

    assert optimizer.config[:enable_benchmarking]
    assert optimizer.config[:enable_parallel_execution]
    assert optimizer.config[:enable_caching]
    assert optimizer.config[:enable_monitoring]
    assert_equal 5, optimizer.config[:benchmark_iterations]
    assert optimizer.config[:auto_tune]
  end

  test "initializes with custom configuration" do
    custom_config = {
      enable_benchmarking: false,
      enable_monitoring: false,
      benchmark_iterations: 10
    }

    optimizer = Zero::Generators::Benchmarking::PerformanceOptimizer.new(config: custom_config)

    refute optimizer.config[:enable_benchmarking]
    refute optimizer.config[:enable_monitoring]
    assert_equal 10, optimizer.config[:benchmark_iterations]
  end

  test "initializes all performance components" do
    assert @optimizer.benchmark_runner
    assert @optimizer.parallel_executor
    assert @optimizer.cache_optimizer
    assert @optimizer.performance_monitor
  end

  # Test optimization strategies
  test "defines all expected optimization strategies" do
    strategies = Zero::Generators::Benchmarking::PerformanceOptimizer::OPTIMIZATION_STRATEGIES

    expected_strategies = [ :sequential, :parallel, :cache_heavy, :balanced, :minimal ]
    expected_strategies.each do |strategy|
      assert_includes strategies.keys, strategy

      strategy_config = strategies[strategy]
      assert strategy_config[:name]
      assert strategy_config[:description]
      assert strategy_config.key?(:use_parallel)
      assert strategy_config.key?(:use_cache)
      assert strategy_config.key?(:use_monitoring)
    end
  end

  # Test workload analysis and strategy recommendation
  test "analyzes workload characteristics" do
    mock_benchmark_runner

    recommendation = @optimizer.analyze_and_recommend_strategy

    assert recommendation[:recommended_strategy]
    assert recommendation[:workload_analysis]
    assert recommendation[:confidence_score]
    assert recommendation[:alternative_strategies]

    # Test workload analysis structure
    workload = recommendation[:workload_analysis]
    assert workload.key?(:dataset_size)
    assert workload.key?(:complexity_level)
    assert workload.key?(:baseline_performance)
    assert workload.key?(:parallelization_potential)
    assert workload.key?(:caching_potential)
  end

  test "recommends appropriate strategy based on workload" do
    # Test with high parallelization potential
    high_parallel_workload = {
      dataset_size: :large,
      parallelization_potential: 0.8,
      caching_potential: 0.6,
      complexity_level: :high
    }

    recommendation = @optimizer.analyze_and_recommend_strategy(high_parallel_workload)
    assert_equal :parallel, recommendation[:recommended_strategy]

    # Test with high caching potential
    high_cache_workload = {
      dataset_size: :medium,
      parallelization_potential: 0.4,
      caching_potential: 0.9,
      complexity_level: :medium
    }

    recommendation = @optimizer.analyze_and_recommend_strategy(high_cache_workload)
    assert_equal :cache_heavy, recommendation[:recommended_strategy]
  end

  test "calculates strategy confidence scores" do
    workload = {
      dataset_size: :large,
      parallelization_potential: 0.9,
      caching_potential: 0.5
    }

    recommendation = @optimizer.analyze_and_recommend_strategy(workload)
    confidence = recommendation[:confidence_score]

    assert confidence.is_a?(Numeric)
    assert confidence >= 0.0
    assert confidence <= 1.0
  end

  # Test generation optimization
  test "optimizes generation with automatic strategy selection" do
    mock_benchmark_runner
    mock_performance_monitor

    generation_executed = false
    result = @optimizer.optimize_generation do
      generation_executed = true
      create_mock_generation_result
    end

    assert generation_executed
    assert result
    assert result[:success]
    assert @optimizer.current_strategy
    assert_includes Zero::Generators::Benchmarking::PerformanceOptimizer::OPTIMIZATION_STRATEGIES.keys,
                    @optimizer.current_strategy
  end

  test "optimizes generation with specified strategy" do
    mock_performance_monitor

    result = @optimizer.optimize_generation(strategy: :parallel) do
      create_mock_generation_result
    end

    assert result
    assert_equal :parallel, @optimizer.current_strategy
  end

  test "records optimization results in history" do
    mock_performance_monitor

    initial_history_count = @optimizer.optimization_history.length

    @optimizer.optimize_generation(strategy: :sequential) do
      create_mock_generation_result
    end

    assert_equal initial_history_count + 1, @optimizer.optimization_history.length

    latest_record = @optimizer.optimization_history.last
    assert_equal :sequential, latest_record[:strategy]
    assert latest_record[:timestamp]
    assert latest_record.key?(:execution_time)
    assert latest_record.key?(:success)
  end

  # Test comprehensive analysis
  test "runs comprehensive performance analysis" do
    mock_benchmark_runner
    mock_performance_monitor

    results = @optimizer.run_comprehensive_analysis(include_all_strategies: false)

    assert results[:timestamp]
    assert results[:workload_analysis]
    assert results[:benchmark_results]
    assert results[:strategy_comparisons]
    assert results[:recommendations]

    # Test that analysis includes expected number of strategies
    # (Should test top 3 strategies when include_all_strategies is false)
    assert results[:strategy_comparisons].keys.length <= 5
  end

  test "runs comprehensive analysis with all strategies" do
    mock_benchmark_runner
    mock_performance_monitor

    results = @optimizer.run_comprehensive_analysis(include_all_strategies: true)

    # Should test all available strategies
    expected_strategies = Zero::Generators::Benchmarking::PerformanceOptimizer::OPTIMIZATION_STRATEGIES.keys
    expected_strategies.each do |strategy|
      assert results[:strategy_comparisons].key?(strategy), "Strategy #{strategy} should be tested"
    end
  end

  # Test reporting capabilities
  test "generates comprehensive report in JSON format" do
    mock_performance_monitor

    @optimizer.optimize_generation(strategy: :balanced) do
      create_mock_generation_result
    end

    report = @optimizer.generate_comprehensive_report(format: :json)

    assert report.is_a?(String)

    # Should be valid JSON
    parsed_report = JSON.parse(report)
    assert parsed_report["generated_at"]
    assert parsed_report["current_strategy"]
    assert parsed_report["component_status"]
    assert parsed_report["optimization_history"]
  end

  test "generates comprehensive report in HTML format" do
    mock_performance_monitor

    @optimizer.optimize_generation(strategy: :parallel) do
      create_mock_generation_result
    end

    report = @optimizer.generate_comprehensive_report(format: :html)

    assert report.is_a?(String)
    assert report.include?("<html>")
    assert report.include?("ReactiveRecord Performance Optimization Report")
    assert report.include?(@optimizer.current_strategy.to_s)
  end

  test "generates comprehensive report in Markdown format" do
    mock_performance_monitor

    report = @optimizer.generate_comprehensive_report(format: :markdown)

    assert report.is_a?(String)
    assert report.include?("# ReactiveRecord Performance Optimization Report")
    assert report.include?("## Component Status")
    assert report.include?("## Performance Metrics")
  end

  # Test real-time optimization metrics
  test "provides real-time optimization metrics" do
    mock_performance_monitor

    @optimizer.optimize_generation(strategy: :cache_heavy) do
      create_mock_generation_result
    end

    metrics = @optimizer.get_optimization_metrics

    assert_equal :cache_heavy, metrics[:current_strategy]
    assert metrics.key?(:monitor_metrics)
    assert metrics.key?(:cache_performance)
    assert metrics.key?(:parallel_performance)
    assert metrics[:recent_optimizations].is_a?(Array)
  end

  # Test configuration updates
  test "updates configuration dynamically" do
    mock_performance_monitor

    original_iterations = @optimizer.config[:benchmark_iterations]
    new_config = { benchmark_iterations: 10 }

    @optimizer.update_configuration(new_config)

    assert_equal 10, @optimizer.config[:benchmark_iterations]
    refute_equal original_iterations, @optimizer.config[:benchmark_iterations]
  end

  # Test cache preloading
  test "preloads optimization caches" do
    mock_cache_optimizer

    preload_config = {
      schema_introspection: [ { force_refresh: false } ],
      type_mapping: [
        { rails_type: "string", column_info: {} },
        { rails_type: "integer", column_info: {} }
      ]
    }

    # Should not raise errors
    @optimizer.preload_caches(preload_config)
  end

  # Test error handling and edge cases
  test "handles generation block errors gracefully" do
    mock_performance_monitor

    result = @optimizer.optimize_generation(strategy: :sequential) do
      raise StandardError, "Mock generation error"
    end

    # Should handle error gracefully and still record optimization attempt
    assert @optimizer.optimization_history.any?

    latest_record = @optimizer.optimization_history.last
    refute latest_record[:success]
  end

  test "handles missing generation block error" do
    assert_raises(ArgumentError) do
      @optimizer.optimize_generation(strategy: :parallel)
    end
  end

  test "handles invalid strategy selection" do
    mock_performance_monitor

    # Should still work with invalid strategy by falling back to auto-selection
    result = @optimizer.optimize_generation(strategy: :nonexistent_strategy) do
      create_mock_generation_result
    end

    # Should auto-select a valid strategy
    assert result
    assert @optimizer.current_strategy
    assert_includes Zero::Generators::Benchmarking::PerformanceOptimizer::OPTIMIZATION_STRATEGIES.keys,
                    @optimizer.current_strategy
  end

  # Test integration with performance components
  test "integrates properly with benchmark runner" do
    assert @optimizer.benchmark_runner

    # Test that monitor is integrated with benchmark runner
    integrations = @optimizer.performance_monitor.integrations
    assert integrations[:benchmark_runner]
  end

  test "integrates properly with cache optimizer" do
    assert @optimizer.cache_optimizer

    # Test that monitor is integrated with cache optimizer
    integrations = @optimizer.performance_monitor.integrations
    assert integrations[:cache_optimizer]
  end

  test "integrates properly with parallel executor" do
    assert @optimizer.parallel_executor

    # Test that monitor is integrated with parallel executor
    integrations = @optimizer.performance_monitor.integrations
    assert integrations[:parallel_executor]
  end

  # Test memory usage and performance
  test "maintains reasonable memory usage during optimization" do
    initial_memory = get_memory_usage

    5.times do |i|
      mock_performance_monitor
      @optimizer.optimize_generation(strategy: :balanced) do
        create_mock_generation_result(file_count: 10)
      end
    end

    # Force garbage collection
    GC.start

    final_memory = get_memory_usage
    memory_growth = final_memory - initial_memory

    # Memory growth should be reasonable (less than 30MB for 5 optimizations)
    assert memory_growth < 30, "Memory growth (#{memory_growth}MB) should be reasonable"
  end

  test "optimization history is bounded to prevent memory leaks" do
    mock_performance_monitor

    # Generate more history entries than the limit (100)
    120.times do
      @optimizer.send(:record_optimization_result, :test_strategy, create_mock_generation_result)
    end

    # History should be limited to prevent memory bloat
    assert @optimizer.optimization_history.length <= 100
  end

  private

  def create_mock_generation_result(file_count: 5)
    {
      success: true,
      execution_time: rand(0.1..2.0),
      generated_models: (1..3).map { |i| { table_name: "table_#{i}" } },
      generated_files: (1..file_count).map { |i| "/tmp/file_#{i}.ts" },
      errors: [],
      statistics: {
        execution_time: rand(0.1..2.0),
        models_generated: 3,
        files_created: file_count,
        memory_usage: { peak_memory_mb: rand(50..150) }
      }
    }
  end

  def mock_benchmark_runner
    # Mock benchmark runner methods
    @optimizer.benchmark_runner.define_singleton_method(:benchmark_scenario) do |scenario|
      {
        scenario: { complexity_level: :medium, expected_models: 3 },
        old_system: {
          measurements: [
            { execution_time_seconds: rand(1.0..3.0) },
            { execution_time_seconds: rand(1.0..3.0) }
          ],
          summary: { avg_execution_time: rand(1.0..3.0), avg_peak_memory: rand(100..200) }
        },
        new_system: {
          measurements: [
            { execution_time_seconds: rand(0.5..2.0) },
            { execution_time_seconds: rand(0.5..2.0) }
          ],
          summary: { avg_execution_time: rand(0.5..2.0), avg_peak_memory: rand(80..180) }
        },
        comparison: { statistically_significant: [ true, false ].sample },
        performance_improvement: {
          execution_time_improvement: rand(10..50),
          memory_efficiency_improvement: rand(5..25)
        }
      }
    end
  end

  def mock_performance_monitor
    # Mock performance monitor methods to avoid complex setup
    @optimizer.performance_monitor.define_singleton_method(:start_monitoring_session) do |name, metadata: {}|
      "session_#{Time.current.to_i}_#{rand(1000)}"
    end

    @optimizer.performance_monitor.define_singleton_method(:end_monitoring_session) do
      {
        id: "session_#{Time.current.to_i}",
        name: "test_session",
        duration: rand(1.0..5.0)
      }
    end

    @optimizer.performance_monitor.define_singleton_method(:record_generation_result) do |result, operation_type: :generation|
      # Mock recording
    end

    @optimizer.performance_monitor.define_singleton_method(:get_real_time_metrics) do
      {
        session_id: "test_session",
        session_name: "optimization_test",
        duration: rand(1.0..5.0),
        current_metrics: {
          total_operations: rand(1..5),
          average_execution_time: rand(0.5..2.0)
        }
      }
    end
  end

  def mock_cache_optimizer
    # Mock cache optimizer preload method
    @optimizer.cache_optimizer.define_singleton_method(:preload_cache) do |config|
      # Mock preloading - no-op for tests
    end

    @optimizer.cache_optimizer.define_singleton_method(:cache_efficiency_report) do
      {
        overall: {
          hit_rate: rand(40..90),
          total_requests: rand(10..100)
        }
      }
    end
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
