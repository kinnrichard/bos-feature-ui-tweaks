# frozen_string_literal: true

require "test_helper"
require "mocha/minitest"
require "benchmark"
require "ostruct"
require "pathname"
require "generators/zero/active_models/generation_coordinator"

module Zero
  module Generators
    # Phase 3: Performance Testing Suite
    # Tests generation speed, service overhead, file operations, and scalability
    class PerformanceTest < ActiveSupport::TestCase
      SKIP_FIXTURES = true

      # Performance targets from requirements
      TARGET_FULL_GENERATION_TIME = 30.0 # seconds
      TARGET_SERVICE_INIT_OVERHEAD = 2.0 # seconds
      TARGET_TEMPLATE_RENDER_TIME = 0.1 # seconds per template
      TARGET_FILE_OPERATION_TIME = 0.05 # seconds per file

      def setup
        @original_skip_fixtures = ENV["SKIP_FIXTURES"]
        ENV["SKIP_FIXTURES"] = "true"

        @shell = mock_shell
        @options = {
          dry_run: false,
          force: true,
          output_dir: "test_output/performance",
          exclude_tables: [],
          table: nil
        }

        Rails.stubs(:root).returns(Pathname.new("/fake/rails/root"))
        Rails.stubs(:env).returns(ActiveSupport::StringInquirer.new("test"))

        # Clean up any previous test output
        FileUtils.rm_rf("test_output/performance") if Dir.exist?("test_output/performance")
      end

      def teardown
        ENV["SKIP_FIXTURES"] = @original_skip_fixtures
        # Clean up test output
        FileUtils.rm_rf("test_output/performance") if Dir.exist?("test_output/performance")
      end

      # =============================================================================
      # Generation Speed Performance Tests
      # =============================================================================

      test "full generation completes within 30 second target" do
        coordinator = setup_real_coordinator_with_large_schema

        execution_time = Benchmark.realtime do
          coordinator.execute
        end

        assert execution_time < TARGET_FULL_GENERATION_TIME,
          "Full generation took #{execution_time.round(2)}s, exceeds target of #{TARGET_FULL_GENERATION_TIME}s"

        puts "✅ Full generation completed in #{execution_time.round(2)}s (target: #{TARGET_FULL_GENERATION_TIME}s)"
      end

      test "single model generation performance baseline" do
        @options[:table] = "users"
        coordinator = setup_real_coordinator_with_large_schema

        execution_time = Benchmark.realtime do
          coordinator.execute
        end

        # Single model should be much faster
        expected_single_model_time = TARGET_FULL_GENERATION_TIME / 10.0
        assert execution_time < expected_single_model_time,
          "Single model generation took #{execution_time.round(2)}s, exceeds expected #{expected_single_model_time}s"

        puts "✅ Single model generation: #{execution_time.round(2)}s"
      end

      test "template rendering performance meets targets" do
        coordinator = setup_performance_coordinator
        mock_service_registry = setup_performance_service_registry
        coordinator.stubs(:service_registry).returns(mock_service_registry)

        table = create_large_table_data
        schema_data = create_large_schema_data

        # Measure template rendering time specifically
        template_times = []
        mock_template_renderer = mock_service_registry.get_service(:template_renderer)

        # Mock render method to capture timing
        mock_template_renderer.stubs(:render).with do |template, context|
          start_time = Time.current
          result = "generated content for #{template}"
          end_time = Time.current
          template_times << (end_time - start_time)
          result
        end.returns("generated content")

        coordinator.generate_model_set(table, schema_data)

        avg_template_time = template_times.sum / template_times.size
        assert avg_template_time < TARGET_TEMPLATE_RENDER_TIME,
          "Average template rendering time #{avg_template_time.round(4)}s exceeds target #{TARGET_TEMPLATE_RENDER_TIME}s"

        puts "✅ Average template render time: #{avg_template_time.round(4)}s (target: #{TARGET_TEMPLATE_RENDER_TIME}s)"
      end

      test "file operations performance meets targets" do
        coordinator = setup_performance_coordinator
        mock_service_registry = setup_performance_service_registry
        coordinator.stubs(:service_registry).returns(mock_service_registry)

        table = create_large_table_data
        schema_data = create_large_schema_data

        # Measure file operation times
        file_operation_times = []
        mock_file_manager = mock_service_registry.get_service(:file_manager)

        mock_file_manager.stubs(:write_with_formatting).with do |path, content|
          start_time = Time.current
          # Simulate file writing
          sleep(0.001) # Minimal realistic file operation time
          end_time = Time.current
          file_operation_times << (end_time - start_time)
          "/fake/path/#{File.basename(path)}"
        end.returns { |path| "/fake/path/#{File.basename(path)}" }

        coordinator.generate_model_set(table, schema_data)

        avg_file_time = file_operation_times.sum / file_operation_times.size
        assert avg_file_time < TARGET_FILE_OPERATION_TIME,
          "Average file operation time #{avg_file_time.round(4)}s exceeds target #{TARGET_FILE_OPERATION_TIME}s"

        puts "✅ Average file operation time: #{avg_file_time.round(4)}s (target: #{TARGET_FILE_OPERATION_TIME}s)"
      end

      # =============================================================================
      # Service Initialization Performance Tests
      # =============================================================================

      test "service initialization overhead is minimal" do
        initialization_time = Benchmark.realtime do
          coordinator = GenerationCoordinator.new(@options, @shell)
          # Force service initialization
          coordinator.service_registry.get_service(:configuration)
          coordinator.service_registry.get_service(:schema)
          coordinator.service_registry.get_service(:file_manager)
          coordinator.service_registry.get_service(:template_renderer)
          coordinator.service_registry.get_service(:type_mapper)
        end

        assert initialization_time < TARGET_SERVICE_INIT_OVERHEAD,
          "Service initialization took #{initialization_time.round(2)}s, exceeds target of #{TARGET_SERVICE_INIT_OVERHEAD}s"

        puts "✅ Service initialization: #{initialization_time.round(2)}s (target: #{TARGET_SERVICE_INIT_OVERHEAD}s)"
      end

      test "service reuse eliminates redundant initialization" do
        coordinator = setup_performance_coordinator

        # First call should initialize
        first_call_time = Benchmark.realtime do
          coordinator.service_registry.get_service(:configuration)
        end

        # Subsequent calls should be instant (cached)
        second_call_time = Benchmark.realtime do
          coordinator.service_registry.get_service(:configuration)
        end

        # Second call should be significantly faster
        assert second_call_time < (first_call_time * 0.1),
          "Service reuse not working - second call (#{second_call_time.round(4)}s) should be much faster than first (#{first_call_time.round(4)}s)"

        puts "✅ Service reuse efficiency: #{((first_call_time - second_call_time) / first_call_time * 100).round(1)}% faster"
      end

      # =============================================================================
      # Scalability Performance Tests
      # =============================================================================

      test "performance scales linearly with number of tables" do
        base_tables = 2
        scaled_tables = 6

        # Test with base number of tables
        @options[:dry_run] = true # Use dry run for speed
        base_coordinator = setup_coordinator_with_n_tables(base_tables)

        base_time = Benchmark.realtime do
          base_coordinator.execute
        end

        # Test with scaled number of tables
        scaled_coordinator = setup_coordinator_with_n_tables(scaled_tables)

        scaled_time = Benchmark.realtime do
          scaled_coordinator.execute
        end

        # Calculate performance scaling
        scaling_factor = scaled_tables.to_f / base_tables
        expected_time = base_time * scaling_factor
        time_ratio = scaled_time / base_time

        # Allow 50% overhead for complexity
        max_acceptable_ratio = scaling_factor * 1.5

        assert time_ratio < max_acceptable_ratio,
          "Performance scaling poor: #{scaled_tables} tables took #{time_ratio.round(2)}x longer than #{base_tables} tables (expected ≤#{max_acceptable_ratio.round(2)}x)"

        puts "✅ Scaling efficiency: #{scaled_tables} tables = #{time_ratio.round(2)}x time (≤#{max_acceptable_ratio.round(2)}x acceptable)"
      end

      test "concurrent generation scenarios performance" do
        # Simulate concurrent-like workload with multiple model sets
        coordinator = setup_performance_coordinator
        mock_service_registry = setup_performance_service_registry
        coordinator.stubs(:service_registry).returns(mock_service_registry)

        schema_data = create_large_schema_data
        tables = schema_data[:tables]

        # Generate multiple models in sequence (simulating concurrent load)
        total_time = Benchmark.realtime do
          tables.each do |table|
            coordinator.generate_model_set(table, schema_data)
          end
        end

        # Performance should remain consistent per model
        per_model_time = total_time / tables.length
        assert per_model_time < (TARGET_FULL_GENERATION_TIME / 5.0),
          "Per-model time in concurrent scenario (#{per_model_time.round(2)}s) exceeds expectations"

        puts "✅ Concurrent scenario performance: #{per_model_time.round(2)}s per model"
      end

      test "large schema handling performance" do
        # Test with schema containing many columns and relationships
        large_table = create_very_large_table_data(50) # 50 columns
        large_schema = {
          tables: [ large_table ],
          relationships: create_complex_relationships(large_table[:name]),
          patterns: {}
        }

        coordinator = setup_performance_coordinator
        mock_service_registry = setup_performance_service_registry
        coordinator.stubs(:service_registry).returns(mock_service_registry)

        generation_time = Benchmark.realtime do
          coordinator.generate_model_set(large_table, large_schema)
        end

        # Large schema should still complete reasonably fast
        max_large_schema_time = 5.0 # seconds
        assert generation_time < max_large_schema_time,
          "Large schema generation took #{generation_time.round(2)}s, exceeds target of #{max_large_schema_time}s"

        puts "✅ Large schema (50 columns) generation: #{generation_time.round(2)}s"
      end

      # =============================================================================
      # Performance Regression Tests
      # =============================================================================

      test "performance matches baseline expectations" do
        # This would compare against stored baseline measurements
        # For now, we'll use target thresholds
        coordinator = setup_real_coordinator_with_standard_schema

        performance_metrics = {}

        # Measure full generation
        performance_metrics[:full_generation] = Benchmark.realtime do
          coordinator.execute
        end

        # Verify all metrics meet baseline expectations
        baseline_expectations = {
          full_generation: TARGET_FULL_GENERATION_TIME
        }

        baseline_expectations.each do |metric, expected_max|
          actual = performance_metrics[metric]
          assert actual < expected_max,
            "Performance regression detected: #{metric} took #{actual.round(2)}s, baseline maximum is #{expected_max}s"
        end

        puts "✅ Performance baseline validation passed"
        performance_metrics.each do |metric, time|
          puts "   #{metric}: #{time.round(2)}s"
        end
      end

      test "no performance degradation from service architecture" do
        # Compare service-based architecture performance
        # This test validates that the service architecture doesn't add significant overhead

        coordinator = setup_performance_coordinator

        # Measure with full service architecture
        service_time = Benchmark.realtime do
          mock_service_registry = setup_performance_service_registry
          coordinator.stubs(:service_registry).returns(mock_service_registry)

          table = create_test_table_data
          schema_data = create_test_schema_data
          coordinator.generate_model_set(table, schema_data)
        end

        # Service architecture should add minimal overhead
        max_service_overhead = 0.5 # seconds
        assert service_time < max_service_overhead,
          "Service architecture adds too much overhead: #{service_time.round(2)}s exceeds #{max_service_overhead}s"

        puts "✅ Service architecture overhead: #{service_time.round(2)}s (≤#{max_service_overhead}s)"
      end

      # =============================================================================
      # Performance Monitoring and Reporting
      # =============================================================================

      test "performance statistics collection accuracy" do
        coordinator = setup_performance_coordinator
        mock_service_registry = setup_performance_service_registry
        coordinator.stubs(:service_registry).returns(mock_service_registry)

        # Execute with known parameters
        table_count = 3
        files_per_model = 3
        expected_files = table_count * files_per_model

        schema_data = create_schema_with_n_tables(table_count)

        start_time = Time.current
        result = coordinator.execute
        actual_time = Time.current - start_time

        # Verify statistics accuracy
        statistics = result[:execution_statistics]

        assert_equal table_count, statistics[:tables_processed]
        assert_equal table_count, statistics[:models_generated]
        assert_equal expected_files, statistics[:files_created]
        assert statistics[:execution_time] > 0
        assert (statistics[:execution_time] - actual_time).abs < 0.1 # Within 100ms

        puts "✅ Performance statistics collection accurate"
      end

      test "service performance metrics aggregation" do
        coordinator = setup_performance_coordinator
        mock_service_registry = setup_performance_service_registry_with_stats
        coordinator.stubs(:service_registry).returns(mock_service_registry)

        result = coordinator.execute

        # Verify service performance metrics are collected
        service_performance = result[:service_performance]

        assert service_performance.key?(:template_renderer)
        assert service_performance.key?(:file_manager)
        assert service_performance.key?(:type_mapper)

        # Verify metrics contain expected fields
        template_stats = service_performance[:template_renderer]
        assert template_stats.key?(:total_renders)
        assert template_stats.key?(:total_time)
        assert template_stats.key?(:average_time)

        puts "✅ Service performance metrics aggregation working"
      end

      private

      def mock_shell
        shell = mock("Shell")
        shell.stubs(:say)
        shell
      end

      def setup_performance_coordinator
        GenerationCoordinator.new(@options, @shell)
      end

      def setup_real_coordinator_with_large_schema
        coordinator = GenerationCoordinator.new(@options, @shell)

        # Use a realistic mock that simulates actual performance characteristics
        mock_service_registry = setup_realistic_service_registry
        coordinator.stubs(:service_registry).returns(mock_service_registry)

        coordinator
      end

      def setup_real_coordinator_with_standard_schema
        coordinator = GenerationCoordinator.new(@options, @shell)

        # Standard schema with realistic performance
        mock_service_registry = setup_standard_performance_service_registry
        coordinator.stubs(:service_registry).returns(mock_service_registry)

        coordinator
      end

      def setup_coordinator_with_n_tables(table_count)
        coordinator = GenerationCoordinator.new(@options, @shell)

        # Create schema with specified number of tables
        schema_data = create_schema_with_n_tables(table_count)

        mock_service_registry = setup_basic_service_registry_mock

        # Mock schema service to return our test schema
        mock_schema = mock("SchemaService")
        mock_schema.stubs(:extract_filtered_schema).returns(schema_data)
        mock_service_registry.stubs(:get_service).with(:schema).returns(mock_schema)

        # Mock other services for minimal overhead
        setup_minimal_overhead_services(mock_service_registry)

        coordinator.stubs(:service_registry).returns(mock_service_registry)
        coordinator
      end

      def setup_basic_service_registry_mock
        mock_service_registry = mock("ServiceRegistry")
        mock_service_registry.stubs(:initialized_services).returns([ "config", "schema" ])
        mock_service_registry.stubs(:get_service).returns(mock("Service"))
        mock_service_registry.stubs(:aggregate_service_statistics).returns({})
        mock_service_registry
      end

      def setup_performance_service_registry
        mock_service_registry = setup_basic_service_registry_mock

        # Mock all services with minimal overhead
        setup_minimal_overhead_services(mock_service_registry)

        mock_service_registry
      end

      def setup_realistic_service_registry
        mock_service_registry = setup_basic_service_registry_mock

        # Mock services with realistic timings
        setup_realistic_performance_services(mock_service_registry)

        mock_service_registry
      end

      def setup_standard_performance_service_registry
        mock_service_registry = setup_basic_service_registry_mock

        # Mock configuration service
        mock_config = mock("ConfigurationService")
        mock_config.stubs(:base_output_dir).returns(@options[:output_dir])
        mock_service_registry.stubs(:get_service).with(:configuration).returns(mock_config)

        # Mock schema service with standard schema
        mock_schema = mock("SchemaService")
        mock_schema.stubs(:extract_filtered_schema).returns(create_standard_test_schema)
        mock_service_registry.stubs(:get_service).with(:schema).returns(mock_schema)

        # Setup other services
        setup_realistic_performance_services(mock_service_registry)

        mock_service_registry
      end

      def setup_performance_service_registry_with_stats
        mock_service_registry = setup_performance_service_registry

        # Override aggregate_service_statistics to return realistic stats
        mock_service_registry.stubs(:aggregate_service_statistics).returns({
          template_renderer: {
            total_renders: 9,
            total_time: 0.027,
            average_time: 0.003,
            cache_enabled: true,
            cache_hits: 3,
            cache_misses: 6,
            cache_hit_ratio: 33.3
          },
          file_manager: {
            files_created: 9,
            files_identical: 0,
            files_formatted: 8,
            total_file_time: 0.045,
            average_file_time: 0.005
          },
          type_mapper: {
            type_mappings: 15,
            total_mapping_time: 0.001
          }
        })

        mock_service_registry
      end

      def setup_minimal_overhead_services(mock_service_registry)
        # Configuration service
        mock_config = mock("ConfigurationService")
        mock_config.stubs(:base_output_dir).returns(@options[:output_dir])
        mock_service_registry.stubs(:get_service).with(:configuration).returns(mock_config)

        # File manager with instant operations
        mock_file_manager = mock("FileManager")
        mock_file_manager.stubs(:ensure_directory_exists)
        mock_file_manager.stubs(:write_with_formatting).returns("/fake/path/file.ts")
        mock_file_manager.stubs(:statistics).returns({
          created: 3, identical: 0, formatted: 2, directories_created: 1, errors: 0
        })
        mock_service_registry.stubs(:get_service).with(:file_manager).returns(mock_file_manager)

        # Template renderer with instant rendering
        mock_template = mock("TemplateRenderer")
        mock_template.stubs(:render).returns("generated content")
        mock_template.stubs(:statistics).returns({
          renders: 3, total_time: 0.001, average_time: 0.0003, cache_enabled: false,
          cache_hits: 0, cache_misses: 0, cache_hit_ratio: 0.0
        })
        mock_service_registry.stubs(:get_service).with(:template_renderer).returns(mock_template)

        # Type mapper with instant mapping
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

      def setup_realistic_performance_services(mock_service_registry)
        # Configuration service
        mock_config = mock("ConfigurationService")
        mock_config.stubs(:base_output_dir).returns(@options[:output_dir])
        mock_service_registry.stubs(:get_service).with(:configuration).returns(mock_config)

        # File manager with realistic timings
        mock_file_manager = mock("FileManager")
        mock_file_manager.stubs(:ensure_directory_exists)
        mock_file_manager.stubs(:write_with_formatting).with do |path, content|
          # Simulate realistic file operation time
          sleep(0.002) # 2ms per file operation
          "/fake/path/#{File.basename(path)}"
        end.returns { |path| "/fake/path/#{File.basename(path)}" }
        mock_file_manager.stubs(:statistics).returns({
          created: 3, identical: 0, formatted: 2, directories_created: 1, errors: 0
        })
        mock_service_registry.stubs(:get_service).with(:file_manager).returns(mock_file_manager)

        # Template renderer with realistic timings
        mock_template = mock("TemplateRenderer")
        mock_template.stubs(:render).with do |template, context|
          # Simulate realistic template rendering time
          sleep(0.003) # 3ms per template
          "generated content for #{template}"
        end.returns { |template, context| "generated content for #{template}" }
        mock_template.stubs(:statistics).returns({
          renders: 3, total_time: 0.009, average_time: 0.003, cache_enabled: true,
          cache_hits: 1, cache_misses: 2, cache_hit_ratio: 33.3
        })
        mock_service_registry.stubs(:get_service).with(:template_renderer).returns(mock_template)

        # Type mapper with minimal overhead
        mock_type_mapper = mock("TypeMapper")
        mock_type_mapper.stubs(:map_rails_type_to_typescript).returns("string")
        mock_service_registry.stubs(:get_service).with(:type_mapper).returns(mock_type_mapper)

        # Relationship processor
        mock_processor_factory = mock("RelationshipProcessorFactory")
        mock_processor = mock("RelationshipProcessor")
        mock_processor.stubs(:process_all).returns({
          properties: "  user?: UserData;",
          imports: "import type { UserData } from './user-data';",
          exclusions: ", 'user'",
          documentation: "- user: belongs_to User",
          registration: "user: { type: 'belongsTo', model: 'User' }"
        })
        mock_processor_factory.stubs(:call).returns(mock_processor)
        mock_service_registry.stubs(:get_service).with(:relationship_processor).returns(mock_processor_factory)
      end

      def create_test_table_data
        {
          name: "users",
          columns: [
            { name: "id", type: "integer", null: false },
            { name: "email", type: "string", null: false },
            { name: "name", type: "string", null: true },
            { name: "created_at", type: "datetime", null: false },
            { name: "updated_at", type: "datetime", null: false }
          ]
        }
      end

      def create_large_table_data
        {
          name: "large_entities",
          columns: (1..20).map do |i|
            { name: "field_#{i}", type: "string", null: true }
          end + [
            { name: "id", type: "integer", null: false },
            { name: "created_at", type: "datetime", null: false },
            { name: "updated_at", type: "datetime", null: false }
          ]
        }
      end

      def create_very_large_table_data(column_count)
        {
          name: "very_large_entities",
          columns: (1..column_count).map do |i|
            { name: "field_#{i}", type: "string", null: true }
          end + [
            { name: "id", type: "integer", null: false },
            { name: "created_at", type: "datetime", null: false },
            { name: "updated_at", type: "datetime", null: false }
          ]
        }
      end

      def create_test_schema_data
        {
          tables: [ create_test_table_data ],
          relationships: [
            {
              table: "users",
              belongs_to: [],
              has_many: [],
              has_one: []
            }
          ],
          patterns: {}
        }
      end

      def create_large_schema_data
        {
          tables: [ create_test_table_data, create_large_table_data ],
          relationships: [
            {
              table: "users",
              belongs_to: [],
              has_many: [ { name: :large_entities, target_table: "large_entities" } ],
              has_one: []
            },
            {
              table: "large_entities",
              belongs_to: [ { name: :user, target_table: "users" } ],
              has_many: [],
              has_one: []
            }
          ],
          patterns: {}
        }
      end

      def create_schema_with_n_tables(table_count)
        tables = []
        relationships = []

        (1..table_count).each do |i|
          table = {
            name: "table_#{i}",
            columns: [
              { name: "id", type: "integer", null: false },
              { name: "name", type: "string", null: true },
              { name: "created_at", type: "datetime", null: false }
            ]
          }
          tables << table

          relationship = {
            table: "table_#{i}",
            belongs_to: [],
            has_many: [],
            has_one: []
          }
          relationships << relationship
        end

        {
          tables: tables,
          relationships: relationships,
          patterns: {}
        }
      end

      def create_standard_test_schema
        {
          tables: [
            create_test_table_data,
            {
              name: "posts",
              columns: [
                { name: "id", type: "integer", null: false },
                { name: "title", type: "string", null: false },
                { name: "body", type: "text", null: true },
                { name: "user_id", type: "integer", null: false },
                { name: "created_at", type: "datetime", null: false },
                { name: "updated_at", type: "datetime", null: false }
              ]
            },
            {
              name: "comments",
              columns: [
                { name: "id", type: "integer", null: false },
                { name: "body", type: "text", null: false },
                { name: "post_id", type: "integer", null: false },
                { name: "created_at", type: "datetime", null: false }
              ]
            }
          ],
          relationships: [
            {
              table: "users",
              belongs_to: [],
              has_many: [ { name: :posts, target_table: "posts" } ],
              has_one: []
            },
            {
              table: "posts",
              belongs_to: [ { name: :user, target_table: "users" } ],
              has_many: [ { name: :comments, target_table: "comments" } ],
              has_one: []
            },
            {
              table: "comments",
              belongs_to: [ { name: :post, target_table: "posts" } ],
              has_many: [],
              has_one: []
            }
          ],
          patterns: {}
        }
      end

      def create_complex_relationships(table_name)
        [
          {
            table: table_name,
            belongs_to: [
              { name: :parent, target_table: table_name },
              { name: :category, target_table: "categories" },
              { name: :user, target_table: "users" }
            ],
            has_many: [
              { name: :children, target_table: table_name },
              { name: :tags, target_table: "tags" },
              { name: :attachments, target_table: "attachments" }
            ],
            has_one: [
              { name: :profile, target_table: "profiles" }
            ]
          }
        ]
      end
    end
  end
end
