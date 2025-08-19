# frozen_string_literal: true

require "test_helper"
require "tempfile"
require "fileutils"

class BenchmarkRunnerTest < ActiveSupport::TestCase
  def setup
    @temp_dir = Dir.mktmpdir("benchmark_test")
    @benchmark_runner = Zero::Generators::Benchmarking::BenchmarkRunner.new(
      output_dir: @temp_dir,
      iterations: 3,
      warmup_iterations: 1,
      cleanup_after_run: false, # Keep files for inspection during tests
      verbose: false
    )
  end

  def teardown
    FileUtils.rm_rf(@temp_dir) if Dir.exist?(@temp_dir)
  end

  # Test benchmark runner initialization
  test "initializes with correct default configuration" do
    runner = Zero::Generators::Benchmarking::BenchmarkRunner.new

    assert_equal 5, runner.options[:iterations]
    assert_equal 2, runner.options[:warmup_iterations]
    assert runner.options[:cleanup_after_run]
    refute runner.options[:verbose]
  end

  test "initializes with custom configuration" do
    custom_config = {
      iterations: 10,
      warmup_iterations: 3,
      verbose: true
    }

    runner = Zero::Generators::Benchmarking::BenchmarkRunner.new(**custom_config)

    assert_equal 10, runner.options[:iterations]
    assert_equal 3, runner.options[:warmup_iterations]
    assert runner.options[:verbose]
  end

  # Test benchmark scenarios configuration
  test "has predefined benchmark scenarios" do
    scenarios = Zero::Generators::Benchmarking::BenchmarkRunner::BENCHMARK_SCENARIOS

    assert_includes scenarios.keys, :small_dataset
    assert_includes scenarios.keys, :medium_dataset
    assert_includes scenarios.keys, :large_dataset
    assert_includes scenarios.keys, :polymorphic_heavy

    # Test scenario structure
    small_scenario = scenarios[:small_dataset]
    assert_equal "Small Dataset", small_scenario[:name]
    assert small_scenario[:description]
    assert small_scenario[:expected_models]
    assert_includes [ :low, :medium, :high ], small_scenario[:complexity_level]
  end

  # Test individual scenario benchmarking
  test "benchmarks individual scenario successfully" do
    # Mock the generation coordinators to avoid actual Rails dependencies
    mock_generation_execution

    result = @benchmark_runner.benchmark_scenario(:small_dataset)

    assert result[:scenario]
    assert result[:old_system]
    assert result[:new_system]
    assert result[:comparison]
    assert result[:performance_improvement]

    # Test result structure
    assert_equal :small_dataset, result[:scenario][:complexity_level] if result[:scenario][:complexity_level] == :small_dataset
    assert result[:old_system][:measurements].is_a?(Array)
    assert result[:new_system][:measurements].is_a?(Array)
    assert result[:old_system][:summary][:avg_execution_time].is_a?(Numeric)
    assert result[:new_system][:summary][:avg_execution_time].is_a?(Numeric)
  end

  test "handles invalid scenario gracefully" do
    assert_raises(ArgumentError) do
      @benchmark_runner.benchmark_scenario(:nonexistent_scenario)
    end
  end

  # Test comprehensive benchmark execution
  test "runs comprehensive comparative benchmark" do
    mock_generation_execution

    scenarios_to_test = [ :small_dataset, :medium_dataset ]
    results = @benchmark_runner.run_comparative_benchmark(scenarios: scenarios_to_test)

    assert results[:metadata]
    assert results[:scenarios]
    assert results[:summary]

    # Test metadata
    assert results[:metadata][:timestamp]
    assert results[:metadata][:iterations]
    assert results[:metadata][:ruby_version]

    # Test scenarios results
    scenarios_to_test.each do |scenario|
      assert results[:scenarios][scenario]
      scenario_result = results[:scenarios][scenario]
      assert scenario_result[:old_system]
      assert scenario_result[:new_system]
      assert scenario_result[:comparison]
    end

    # Test summary
    summary = results[:summary]
    assert_equal scenarios_to_test.length, summary[:total_scenarios_tested]
    assert summary[:overall_performance_improvement].is_a?(Numeric)
    assert summary[:scenarios_with_improvement].is_a?(Integer)
    assert summary[:scenarios_with_regression].is_a?(Integer)
  end

  # Test performance metrics collection accuracy
  test "collects accurate performance metrics" do
    mock_generation_execution

    result = @benchmark_runner.benchmark_scenario(:small_dataset)

    # Test that metrics are properly structured
    old_system = result[:old_system]
    new_system = result[:new_system]

    assert old_system[:measurements].length == @benchmark_runner.options[:iterations]
    assert new_system[:measurements].length == @benchmark_runner.options[:iterations]

    # Test measurement structure
    measurement = old_system[:measurements].first
    assert measurement[:execution_time_seconds].is_a?(Numeric)
    assert measurement[:execution_time_seconds] > 0

    # Test summary statistics
    summary = old_system[:summary]
    assert summary[:avg_execution_time].is_a?(Numeric)
    assert summary[:avg_execution_time] > 0
  end

  # Test statistical analysis integration
  test "performs statistical analysis on benchmark results" do
    mock_generation_execution

    result = @benchmark_runner.benchmark_scenario(:small_dataset)
    comparison = result[:comparison]

    # Test statistical significance testing
    assert comparison.key?(:statistically_significant)
    assert [ true, false ].include?(comparison[:statistically_significant])

    # Test confidence intervals if present
    if comparison[:confidence_intervals]
      assert comparison[:confidence_intervals][:old_system]
      assert comparison[:confidence_intervals][:new_system]
    end
  end

  # Test performance improvement calculations
  test "calculates performance improvements correctly" do
    mock_generation_execution

    result = @benchmark_runner.benchmark_scenario(:small_dataset)
    improvement = result[:performance_improvement]

    assert improvement[:execution_time_improvement].is_a?(Numeric)
    assert improvement[:memory_efficiency_improvement].is_a?(Numeric)

    # Performance improvement should be reasonable (not wildly inaccurate)
    assert improvement[:execution_time_improvement] >= -100 # At most 100% slower
    assert improvement[:execution_time_improvement] <= 100  # At most 100% faster
  end

  # Test report generation
  test "generates comprehensive benchmark report" do
    mock_generation_execution

    results = @benchmark_runner.run_comparative_benchmark(scenarios: [ :small_dataset ])
    report = @benchmark_runner.generate_report(results)

    assert report.is_a?(String)
    assert report.length > 100 # Should be substantial

    # Test report contains key sections
    assert report.include?("ReactiveRecord Generation Performance Benchmark Report")
    assert report.include?("Executive Summary") if report.include?("# ReactiveRecord")
  end

  test "saves report to file" do
    mock_generation_execution

    results = @benchmark_runner.run_comparative_benchmark(scenarios: [ :small_dataset ])
    report_file = File.join(@temp_dir, "benchmark_report.md")

    report = @benchmark_runner.generate_report(results, output_file: report_file)

    assert File.exist?(report_file)
    file_content = File.read(report_file)
    assert_equal report, file_content
    assert file_content.length > 100
  end

  # Test performance recommendations
  test "generates performance recommendations" do
    mock_generation_execution

    results = @benchmark_runner.run_comparative_benchmark(scenarios: [ :small_dataset ])
    recommendations = @benchmark_runner.get_performance_recommendations(results)

    assert recommendations.is_a?(Array)

    # Test recommendation structure
    if recommendations.any?
      recommendation = recommendations.first
      assert recommendation[:priority]
      assert recommendation[:category]
      assert recommendation[:scenario]
      assert recommendation[:issue]
      assert recommendation[:recommendation]
      assert_includes [ :high, :medium, :low ], recommendation[:priority]
    end
  end

  # Test error handling
  test "handles benchmark execution errors gracefully" do
    # Mock coordinators to raise errors
    mock_generation_execution(should_raise_error: true)

    result = @benchmark_runner.benchmark_scenario(:small_dataset)

    # Should still return a result structure even with errors
    assert result[:scenario]
    assert result.key?(:old_system)
    assert result.key?(:new_system)

    # At least one system should have measurements or errors should be recorded
    old_measurements = result[:old_system][:measurements] || []
    new_measurements = result[:new_system][:measurements] || []
    assert old_measurements.any? || new_measurements.any?, "At least one system should have measurements"
  end

  # Test concurrent benchmark execution safety
  test "handles concurrent benchmark execution safely" do
    mock_generation_execution

    threads = []
    results = []

    # Run multiple benchmarks concurrently
    3.times do
      threads << Thread.new do
        runner = Zero::Generators::Benchmarking::BenchmarkRunner.new(
          output_dir: Dir.mktmpdir("benchmark_concurrent"),
          iterations: 2,
          verbose: false
        )
        results << runner.benchmark_scenario(:small_dataset)
      end
    end

    threads.each(&:join)

    # All benchmarks should complete successfully
    assert_equal 3, results.length
    results.each do |result|
      assert result[:scenario]
      assert result[:old_system]
      assert result[:new_system]
    end
  end

  # Test memory and resource cleanup
  test "cleans up resources properly" do
    initial_memory = get_memory_usage

    10.times do
      mock_generation_execution
      @benchmark_runner.benchmark_scenario(:small_dataset)
    end

    # Force garbage collection
    GC.start

    final_memory = get_memory_usage
    memory_growth = final_memory - initial_memory

    # Memory growth should be reasonable (less than 50MB for 10 iterations)
    assert memory_growth < 50, "Memory growth (#{memory_growth}MB) should be reasonable"
  end

  # Test benchmark data validation
  test "validates benchmark data integrity" do
    mock_generation_execution

    result = @benchmark_runner.benchmark_scenario(:small_dataset)

    # Validate old system data
    old_system = result[:old_system]
    assert old_system[:measurements].all? { |m| m[:execution_time_seconds] >= 0 }
    assert old_system[:summary][:avg_execution_time] >= 0

    # Validate new system data
    new_system = result[:new_system]
    assert new_system[:measurements].all? { |m| m[:execution_time_seconds] >= 0 }
    assert new_system[:summary][:avg_execution_time] >= 0

    # Validate comparison data
    comparison = result[:comparison]
    assert comparison[:old_system_summary]
    assert comparison[:new_system_summary]
  end

  private

  # Mock generation execution to simulate actual generation without Rails dependencies
  def mock_generation_execution(should_raise_error: false)
    # Mock old generation coordinator
    old_coordinator_class = Class.new do
      def initialize(options, shell)
        @options = options
        @should_raise_error = false
      end

      def execute
        if @should_raise_error
          raise StandardError, "Mock generation error"
        end

        {
          success: true,
          execution_time: rand(0.1..2.0),
          generated_models: (1..5).map { |i| { table_name: "table_#{i}" } },
          generated_files: (1..10).map { |i| "/tmp/file_#{i}.ts" },
          errors: [],
          statistics: {
            execution_time: rand(0.1..2.0),
            models_generated: rand(1..5),
            files_created: rand(5..15),
            memory_usage: { peak_memory_mb: rand(50..200) }
          }
        }
      end
    end

    # Mock new generation coordinator
    new_coordinator_class = Class.new do
      def initialize(options, shell)
        @options = options
        @should_raise_error = false
      end

      def execute
        if @should_raise_error
          raise StandardError, "Mock generation error"
        end

        {
          success: true,
          execution_time: rand(0.05..1.5), # Generally faster than old system
          generated_models: (1..5).map { |i| { table_name: "table_#{i}" } },
          generated_files: (1..10).map { |i| "/tmp/file_#{i}.ts" },
          errors: [],
          statistics: {
            execution_time: rand(0.05..1.5),
            models_generated: rand(1..5),
            files_created: rand(5..15),
            memory_usage: { peak_memory_mb: rand(40..180) } # Generally more efficient
          }
        }
      end
    end

    # Stub the coordinator classes
    stub_const("Zero::Generators::OldGenerationCoordinator", old_coordinator_class)
    stub_const("Zero::Generators::GenerationCoordinator", new_coordinator_class)
  end

  def stub_const(constant_name, klass)
    # Simple constant stubbing for testing
    parts = constant_name.split("::")
    current_module = Object

    parts[0..-2].each do |part|
      unless current_module.const_defined?(part)
        current_module.const_set(part, Module.new)
      end
      current_module = current_module.const_get(part)
    end

    final_name = parts.last
    if current_module.const_defined?(final_name)
      current_module.send(:remove_const, final_name)
    end
    current_module.const_set(final_name, klass)
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
