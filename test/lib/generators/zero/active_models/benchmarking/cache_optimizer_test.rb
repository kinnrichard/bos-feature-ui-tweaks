# frozen_string_literal: true

require "test_helper"
require "tempfile"
require "fileutils"
require "digest"

class CacheOptimizerTest < ActiveSupport::TestCase
  def setup
    @temp_cache_dir = Dir.mktmpdir("cache_optimizer_test")
    @cache_optimizer = Zero::Generators::Benchmarking::CacheOptimizer.new(
      config: {
        memory_cache_size: 50, # Smaller for testing
        file_cache_enabled: true,
        file_cache_directory: @temp_cache_dir,
        default_ttl: 10, # Shorter TTL for testing
        schema_cache_ttl: 20,
        template_cache_ttl: 15,
        type_mapping_cache_ttl: 25
      }
    )
  end

  def teardown
    FileUtils.rm_rf(@temp_cache_dir) if Dir.exist?(@temp_cache_dir)
  end

  # Test cache optimizer initialization
  test "initializes with correct default configuration" do
    optimizer = Zero::Generators::Benchmarking::CacheOptimizer.new

    assert_equal 100, optimizer.config[:memory_cache_size]
    assert optimizer.config[:file_cache_enabled]
    assert_equal 3600, optimizer.config[:default_ttl]
    assert optimizer.cache_statistics
    assert optimizer.cache_policies
  end

  test "initializes with custom configuration" do
    custom_config = {
      memory_cache_size: 25,
      file_cache_enabled: false,
      default_ttl: 1800
    }

    optimizer = Zero::Generators::Benchmarking::CacheOptimizer.new(config: custom_config)

    assert_equal 25, optimizer.config[:memory_cache_size]
    refute optimizer.config[:file_cache_enabled]
    assert_equal 1800, optimizer.config[:default_ttl]
  end

  # Test schema introspection caching
  test "caches schema introspection results" do
    call_count = 0
    expensive_operation = lambda do
      call_count += 1
      { tables: [ "users", "posts" ], relationships: [] }
    end

    # First call should execute the block
    result1 = @cache_optimizer.cached_schema_introspection(&expensive_operation)
    assert_equal 1, call_count
    assert_equal [ "users", "posts" ], result1[:tables]

    # Second call should use cached result
    result2 = @cache_optimizer.cached_schema_introspection(&expensive_operation)
    assert_equal 1, call_count # Should not increment
    assert_equal result1, result2

    # Verify cache hit statistics
    stats = @cache_optimizer.cache_statistics
    assert_equal 2, stats[:total_requests]
    assert_equal 1, stats[:total_hits]
    assert_equal 1, stats[:total_misses]
  end

  test "schema cache respects TTL expiration" do
    # Set very short TTL for this test
    short_ttl_optimizer = Zero::Generators::Benchmarking::CacheOptimizer.new(
      config: {
        schema_cache_ttl: 0.1, # 0.1 seconds
        file_cache_enabled: false
      }
    )

    call_count = 0
    operation = lambda do
      call_count += 1
      { timestamp: Time.current.to_f }
    end

    # First call
    result1 = short_ttl_optimizer.cached_schema_introspection(&operation)
    assert_equal 1, call_count

    # Second call immediately should be cached
    result2 = short_ttl_optimizer.cached_schema_introspection(&operation)
    assert_equal 1, call_count
    assert_equal result1, result2

    # Wait for TTL expiration and try again
    sleep 0.2
    result3 = short_ttl_optimizer.cached_schema_introspection(&operation)
    assert_equal 2, call_count # Should execute again
    refute_equal result1[:timestamp], result3[:timestamp]
  end

  # Test template rendering caching
  test "caches template rendering results" do
    template_path = "/tmp/test_template.erb"
    context = { class_name: "User", table_name: "users" }

    call_count = 0
    render_operation = lambda do
      call_count += 1
      "class #{context[:class_name]} < ApplicationRecord\nend"
    end

    # First call should execute
    result1 = @cache_optimizer.cached_template_render(template_path, context, &render_operation)
    assert_equal 1, call_count
    assert result1.include?("class User")

    # Second call with same template and context should be cached
    result2 = @cache_optimizer.cached_template_render(template_path, context, &render_operation)
    assert_equal 1, call_count
    assert_equal result1, result2

    # Third call with different context should execute
    different_context = { class_name: "Post", table_name: "posts" }
    result3 = @cache_optimizer.cached_template_render(template_path, different_context, &render_operation)
    assert_equal 2, call_count # Should increment
    refute_equal result1, result3
  end

  # Test type mapping caching
  test "caches type mapping results" do
    rails_type = "string"
    column_info = { null: false, default: nil }

    call_count = 0
    type_mapping_operation = lambda do
      call_count += 1
      "string"
    end

    # First call should execute
    result1 = @cache_optimizer.cached_type_mapping(rails_type, column_info, &type_mapping_operation)
    assert_equal 1, call_count
    assert_equal "string", result1

    # Second call with same parameters should be cached
    result2 = @cache_optimizer.cached_type_mapping(rails_type, column_info, &type_mapping_operation)
    assert_equal 1, call_count
    assert_equal result1, result2

    # Call with different column info should execute
    different_column_info = { null: true, default: "test" }
    result3 = @cache_optimizer.cached_type_mapping(rails_type, different_column_info, &type_mapping_operation)
    assert_equal 2, call_count
  end

  # Test relationship processing caching
  test "caches relationship processing results" do
    table_name = "users"
    relationships = { belongs_to: [ "profile" ], has_many: [ "posts" ] }

    call_count = 0
    relationship_operation = lambda do
      call_count += 1
      { processed_relationships: relationships, properties: "profile?: Profile" }
    end

    # First call should execute
    result1 = @cache_optimizer.cached_relationship_processing(table_name, relationships, &relationship_operation)
    assert_equal 1, call_count

    # Second call should be cached
    result2 = @cache_optimizer.cached_relationship_processing(table_name, relationships, &relationship_operation)
    assert_equal 1, call_count
    assert_equal result1, result2

    # Verify cache statistics for relationship processing
    stats = @cache_optimizer.cache_statistics
    relationship_stats = stats[:categories][:relationship_processing]
    assert_equal 1, relationship_stats[:hits]
    assert_equal 1, relationship_stats[:misses]
  end

  # Test polymorphic analysis caching
  test "caches polymorphic analysis results" do
    table_name = "comments"

    call_count = 0
    polymorphic_operation = lambda do
      call_count += 1
      [ { name: :commentable, type_field: "commentable_type", id_field: "commentable_id" } ]
    end

    result1 = @cache_optimizer.cached_polymorphic_analysis(table_name, &polymorphic_operation)
    assert_equal 1, call_count

    result2 = @cache_optimizer.cached_polymorphic_analysis(table_name, &polymorphic_operation)
    assert_equal 1, call_count
    assert_equal result1, result2
  end

  # Test file comparison caching
  test "caches file comparison results" do
    file_path = "/tmp/test_file.ts"
    content = "export class User {}"

    call_count = 0
    comparison_operation = lambda do
      call_count += 1
      false # File doesn't exist yet
    end

    result1 = @cache_optimizer.cached_file_comparison(file_path, content, &comparison_operation)
    assert_equal 1, call_count
    assert_equal false, result1

    result2 = @cache_optimizer.cached_file_comparison(file_path, content, &comparison_operation)
    assert_equal 1, call_count
    assert_equal result1, result2
  end

  # Test force refresh functionality
  test "force refresh bypasses cache" do
    call_count = 0
    operation = lambda do
      call_count += 1
      { data: Time.current.to_f }
    end

    # First call
    result1 = @cache_optimizer.cached_schema_introspection(&operation)
    assert_equal 1, call_count

    # Second call should be cached
    result2 = @cache_optimizer.cached_schema_introspection(&operation)
    assert_equal 1, call_count
    assert_equal result1, result2

    # Third call with force refresh should execute
    result3 = @cache_optimizer.cached_schema_introspection(force_refresh: true, &operation)
    assert_equal 2, call_count
    refute_equal result1[:data], result3[:data]
  end

  # Test cache size limits
  test "respects memory cache size limits" do
    # Set very small cache size for testing
    small_cache_optimizer = Zero::Generators::Benchmarking::CacheOptimizer.new(
      config: {
        memory_cache_size: 2,
        file_cache_enabled: false
      }
    )

    # Fill cache beyond limit
    5.times do |i|
      small_cache_optimizer.cached_type_mapping("type_#{i}", {}) do
        "mapped_type_#{i}"
      end
    end

    # Cache should be limited in size
    memory_cache = small_cache_optimizer.instance_variable_get(:@memory_cache)
    assert memory_cache.size <= 2, "Memory cache should respect size limit"
  end

  # Test file cache functionality
  test "uses file cache when enabled" do
    file_cache_enabled_optimizer = Zero::Generators::Benchmarking::CacheOptimizer.new(
      config: {
        file_cache_enabled: true,
        file_cache_directory: @temp_cache_dir
      }
    )

    call_count = 0
    operation = lambda do
      call_count += 1
      { file_cached_data: "test_data" }
    end

    # First call should create file cache
    result1 = file_cache_enabled_optimizer.cached_schema_introspection(&operation)
    assert_equal 1, call_count

    # Clear memory cache to test file cache
    file_cache_enabled_optimizer.instance_variable_get(:@memory_cache).clear

    # Second call should use file cache
    result2 = file_cache_enabled_optimizer.cached_schema_introspection(&operation)
    assert_equal 1, call_count # Should not increment
    assert_equal result1, result2

    # Verify cache files were created
    cache_files = Dir.glob(File.join(@temp_cache_dir, "*.json"))
    assert cache_files.any?, "Cache files should be created"
  end

  # Test cache clearing functionality
  test "clears all caches" do
    # Populate caches
    @cache_optimizer.cached_schema_introspection { { schema: "data" } }
    @cache_optimizer.cached_type_mapping("string", {}) { "string" }

    # Verify caches have data
    stats_before = @cache_optimizer.cache_statistics
    assert stats_before[:total_requests] > 0

    # Clear caches
    @cache_optimizer.clear_all_caches

    # Verify caches are cleared
    stats_after = @cache_optimizer.cache_statistics
    assert_equal 0, stats_after[:total_requests]
    assert_equal 0, stats_after[:total_hits]
    assert_equal 0, stats_after[:total_misses]

    # Verify memory cache is empty
    memory_cache = @cache_optimizer.instance_variable_get(:@memory_cache)
    assert memory_cache.empty?
  end

  test "clears specific cache category" do
    # Populate different cache categories
    @cache_optimizer.cached_schema_introspection { { schema: "data" } }
    @cache_optimizer.cached_type_mapping("string", {}) { "string" }

    # Clear only schema introspection cache
    @cache_optimizer.clear_cache_category(:schema_introspection)

    # Schema cache should be cleared
    schema_stats = @cache_optimizer.cache_statistics[:categories][:schema_introspection]
    assert_equal 0, schema_stats[:hits]
    assert_equal 0, schema_stats[:misses]

    # Type mapping cache should still have data
    type_stats = @cache_optimizer.cache_statistics[:categories][:type_mapping]
    assert type_stats[:hits] > 0 || type_stats[:misses] > 0
  end

  # Test cache efficiency reporting
  test "generates cache efficiency report" do
    # Populate cache with hits and misses
    @cache_optimizer.cached_schema_introspection { { schema: "data" } }
    @cache_optimizer.cached_schema_introspection { { schema: "data" } } # Should be a hit
    @cache_optimizer.cached_type_mapping("string", {}) { "string" }

    report = @cache_optimizer.cache_efficiency_report

    # Test overall statistics
    overall = report[:overall]
    assert_equal 3, overall[:total_requests]
    assert_equal 1, overall[:total_hits]
    assert_equal 2, overall[:total_misses]
    assert_equal 33.33, overall[:hit_rate]

    # Test category statistics
    categories = report[:categories]
    assert categories.any?

    schema_category = categories.find { |cat| cat[:category] == :schema_introspection }
    assert schema_category
    assert_equal 1, schema_category[:hits]
    assert_equal 1, schema_category[:misses]
    assert_equal 50.0, schema_category[:hit_rate]

    # Test recommendations
    assert report[:recommendations].is_a?(Array)
  end

  # Test performance impact calculation
  test "calculates cache performance impact" do
    # Setup cache with some hits
    @cache_optimizer.cached_schema_introspection { sleep(0.01); { schema: "data" } }
    @cache_optimizer.cached_schema_introspection { sleep(0.01); { schema: "data" } } # Cache hit

    benchmark_results = { total_execution_time: 5.0 }
    impact = @cache_optimizer.calculate_cache_performance_impact(benchmark_results)

    assert impact[:baseline_execution_time]
    assert impact[:projected_execution_time]
    assert impact[:estimated_time_saved].is_a?(Numeric)
    assert impact[:improvement_percentage].is_a?(Numeric)
    assert impact[:cache_hit_rate].is_a?(Numeric)
    assert impact[:recommendations].is_a?(Array)
  end

  # Test cache preloading
  test "preloads cache entries" do
    preload_config = {
      schema_introspection: [ { force_refresh: false } ],
      type_mapping: [
        { rails_type: "string", column_info: {} },
        { rails_type: "integer", column_info: {} }
      ]
    }

    # Should not raise errors
    @cache_optimizer.preload_cache(preload_config)
  end

  # Test error handling
  test "handles cache operation errors gracefully" do
    # Test with operation that raises an error
    error_operation = lambda { raise StandardError, "Test error" }

    assert_raises(StandardError) do
      @cache_optimizer.cached_schema_introspection(&error_operation)
    end

    # Cache statistics should still be updated for the miss
    stats = @cache_optimizer.cache_statistics
    assert_equal 1, stats[:total_requests]
    assert_equal 0, stats[:total_hits]
    assert_equal 1, stats[:total_misses]
  end

  test "handles corrupted file cache gracefully" do
    # Create a corrupted cache file
    cache_key = "schema_introspection:test"
    cache_file_path = @cache_optimizer.send(:file_cache_path, cache_key, :schema_introspection)
    FileUtils.mkdir_p(File.dirname(cache_file_path))
    File.write(cache_file_path, "invalid json content")

    call_count = 0
    operation = lambda do
      call_count += 1
      { schema: "data" }
    end

    # Should handle corrupted file and execute operation
    result = @cache_optimizer.cached_schema_introspection(&operation)
    assert_equal 1, call_count
    assert_equal "data", result[:schema]

    # Corrupted file should be removed
    refute File.exist?(cache_file_path), "Corrupted cache file should be removed"
  end

  # Test concurrent cache access
  test "handles concurrent cache access safely" do
    call_counts = {}
    threads = []

    # Create multiple threads accessing the same cache key
    5.times do |i|
      threads << Thread.new do
        thread_id = i
        call_counts[thread_id] = 0

        result = @cache_optimizer.cached_schema_introspection do
          call_counts[thread_id] += 1
          sleep(0.01) # Simulate some work
          { thread_id: thread_id, timestamp: Time.current.to_f }
        end

        result
      end
    end

    results = threads.map(&:join).map(&:value)

    # Only one thread should have executed the expensive operation
    total_executions = call_counts.values.sum
    assert_equal 1, total_executions, "Only one thread should execute the expensive operation"

    # All threads should get the same result
    first_result = results.first
    results.each do |result|
      assert_equal first_result[:timestamp], result[:timestamp]
    end
  end

  # Test memory usage
  test "maintains reasonable memory usage" do
    initial_memory = get_memory_usage

    # Perform many cache operations
    100.times do |i|
      @cache_optimizer.cached_type_mapping("type_#{i % 10}", {}) do
        "mapped_type_#{i % 10}"
      end
    end

    # Force garbage collection
    GC.start

    final_memory = get_memory_usage
    memory_growth = final_memory - initial_memory

    # Memory growth should be reasonable (less than 20MB for 100 operations)
    assert memory_growth < 20, "Memory growth (#{memory_growth}MB) should be reasonable"
  end

  private

  def get_memory_usage
    # Platform-specific memory usage
    if RUBY_PLATFORM =~ /darwin/
      `ps -o rss= -p #{Process.pid}`.to_i / 1024.0 # Convert KB to MB
    else
      0.0 # Fallback for other platforms in tests
    end
  end
end
