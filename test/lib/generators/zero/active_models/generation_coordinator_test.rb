# frozen_string_literal: true

require "test_helper"
require "mocha/minitest"
require "ostruct"
require "pathname"
require "generators/zero/active_models/generation_coordinator"

module Zero
  module Generators
    class GenerationCoordinatorTest < ActiveSupport::TestCase
      # Disable fixtures for this test since GenerationCoordinator is a service orchestrator
      SKIP_FIXTURES = true

      def setup
        # Set environment to skip fixtures for this test
        @original_skip_fixtures = ENV["SKIP_FIXTURES"]
        ENV["SKIP_FIXTURES"] = "true"

        @shell = mock_shell
        @options = {
          dry_run: false,
          force: false,
          output_dir: "frontend/src/lib/models",
          exclude_tables: [],
          table: nil
        }

        # Mock Rails.root to return a Pathname object
        Rails.stubs(:root).returns(Pathname.new("/fake/rails/root"))
        Rails.stubs(:env).returns(ActiveSupport::StringInquirer.new("test"))

        # Mock ServiceRegistry to avoid real service initialization
        setup_default_service_registry_mock

        @coordinator = GenerationCoordinator.new(@options, @shell)
      end

      def teardown
        # Restore original environment setting
        ENV["SKIP_FIXTURES"] = @original_skip_fixtures
      end

      # =============================================================================
      # Initialization Tests
      # =============================================================================

      test "initializes with valid options and shell" do
        coordinator = GenerationCoordinator.new(@options, @shell)

        assert_not_nil coordinator
        assert_equal @options, coordinator.options
        assert_equal @shell, coordinator.shell
        assert_not_nil coordinator.service_registry
        assert_instance_of Hash, coordinator.statistics
      end

      test "initializes with minimal options" do
        minimal_options = {}
        coordinator = GenerationCoordinator.new(minimal_options, @shell)

        assert_equal minimal_options, coordinator.options
        assert_not_nil coordinator.service_registry
        assert_instance_of Hash, coordinator.statistics
      end

      test "initializes with nil options" do
        coordinator = GenerationCoordinator.new(nil, @shell)

        assert_equal({}, coordinator.options)
        assert_not_nil coordinator.service_registry
      end

      test "initializes statistics with correct default values" do
        expected_keys = [
          :execution_time, :tables_processed, :models_generated,
          :files_created, :errors_encountered, :services_initialized
        ]

        statistics = @coordinator.statistics

        expected_keys.each do |key|
          assert statistics.key?(key), "Statistics should include #{key}"
          if key == :execution_time
            assert_equal 0.0, statistics[key]
          elsif key == :services_initialized
            # This gets set during initialization based on mock service registry
            assert statistics[key] >= 0
          else
            assert_equal 0, statistics[key]
          end
        end
      end

      test "initializes service registry successfully" do
        # Mock ServiceRegistry behavior
        mock_service_registry = mock("ServiceRegistry")
        mock_service_registry.stubs(:initialized_services).returns([ "config", "schema", "file_manager" ])

        ServiceRegistry.stubs(:new).returns(mock_service_registry)
        mock_service_registry.expects(:get_service).with(:configuration).returns(mock("config"))
        mock_service_registry.expects(:get_service).with(:schema).returns(mock("schema"))
        mock_service_registry.expects(:get_service).with(:file_manager).returns(mock("file_manager"))
        mock_service_registry.expects(:get_service).with(:template_renderer).returns(mock("template"))
        mock_service_registry.expects(:get_service).with(:type_mapper).returns(mock("type_mapper"))

        coordinator = GenerationCoordinator.new(@options, @shell)

        assert_not_nil coordinator.service_registry
        assert_equal 3, coordinator.statistics[:services_initialized]
      end

      # =============================================================================
      # Error Class Tests
      # =============================================================================

      test "defines custom error classes correctly" do
        assert_kind_of Class, GenerationCoordinator::GenerationError
        assert_kind_of Class, GenerationCoordinator::SchemaExtractionError
        assert_kind_of Class, GenerationCoordinator::ServiceInitializationError
        assert_kind_of Class, GenerationCoordinator::ModelGenerationError

        # Test inheritance hierarchy
        assert GenerationCoordinator::SchemaExtractionError < GenerationCoordinator::GenerationError
        assert GenerationCoordinator::ServiceInitializationError < GenerationCoordinator::GenerationError
        assert GenerationCoordinator::ModelGenerationError < GenerationCoordinator::GenerationError
      end

      # =============================================================================
      # Execute Method Tests
      # =============================================================================

      test "execute method runs complete workflow successfully" do
        setup_successful_execution_mocks

        result = @coordinator.execute

        assert_instance_of Hash, result
        assert result.key?(:generated_models)
        assert result.key?(:generated_files)
        assert result.key?(:execution_statistics)
        assert result.key?(:service_performance)
        assert result.key?(:summary)
      end

      test "execute method handles dry run mode" do
        @options[:dry_run] = true
        coordinator = GenerationCoordinator.new(@options, @shell)

        setup_dry_run_execution_mocks(coordinator)

        result = coordinator.execute

        assert_instance_of Hash, result
        # In dry run mode, no actual files should be created
        assert_empty result[:generated_files]
      end

      test "execute method handles schema extraction errors" do
        mock_service_registry = setup_basic_service_registry_mock
        coordinator = GenerationCoordinator.new(@options, @shell)
        coordinator.stubs(:service_registry).returns(mock_service_registry)

        # Mock other required services
        mock_config = mock("ConfigurationService")
        mock_config.stubs(:base_output_dir).returns("frontend/src/lib/models")
        mock_service_registry.stubs(:get_service).with(:configuration).returns(mock_config)

        mock_file_manager = mock("FileManager")
        mock_file_manager.stubs(:ensure_directory_exists)
        mock_service_registry.stubs(:get_service).with(:file_manager).returns(mock_file_manager)

        # Mock schema service to raise error
        mock_schema_service = mock("SchemaService")
        mock_schema_service.stubs(:extract_filtered_schema).raises(StandardError.new("Schema error"))
        mock_service_registry.stubs(:get_service).with(:schema).returns(mock_schema_service)

        error = assert_raises GenerationCoordinator::GenerationError do
          coordinator.execute
        end

        assert_includes error.message, "Generation failed"
        assert_equal 1, coordinator.statistics[:errors_encountered]
      end

      test "execute method tracks execution time" do
        setup_successful_execution_mocks

        start_time = Time.current
        result = @coordinator.execute
        end_time = Time.current

        execution_time = result[:execution_statistics][:execution_time]
        assert execution_time > 0
        assert execution_time <= (end_time - start_time)
      end

      test "execute method reports progress to shell" do
        setup_successful_execution_mocks

        @shell.expects(:say).with(regexp_matches(/Generating ReactiveRecord models/), :green)
        @shell.expects(:say).with(regexp_matches(/Output directory/), :blue).at_least_once

        @coordinator.execute
      end

      # =============================================================================
      # Model Generation Tests
      # =============================================================================

      test "generate_model_set creates model files successfully" do
        table = create_test_table_data
        schema_data = create_test_schema_data

        setup_model_generation_mocks

        result = @coordinator.generate_model_set(table, schema_data)

        assert_equal "users", result[:table_name]
        assert_equal "user", result[:model_name]
        assert_equal "User", result[:class_name]
        assert_equal "user", result[:kebab_name]
        assert_instance_of Array, result[:files_generated]
        assert_instance_of Hash, result[:model_metadata]
      end

      test "generate_model_set handles dry run mode" do
        @options[:dry_run] = true
        coordinator = GenerationCoordinator.new(@options, @shell)
        table = create_test_table_data
        schema_data = create_test_schema_data

        setup_dry_run_model_generation_mocks(coordinator)

        result = coordinator.generate_model_set(table, schema_data)

        assert_empty result[:files_generated]
        assert_instance_of Array, result[:dry_run_files]
        assert_equal 3, result[:dry_run_files].length
      end

      test "generate_model_set tracks statistics correctly" do
        table = create_test_table_data
        schema_data = create_test_schema_data

        setup_model_generation_mocks
        initial_models = @coordinator.statistics[:models_generated]
        initial_files = @coordinator.statistics[:files_created]

        @coordinator.generate_model_set(table, schema_data)

        assert_equal initial_models + 1, @coordinator.statistics[:models_generated]
        assert_equal initial_files + 3, @coordinator.statistics[:files_created]
      end

      test "generate_model_set handles generation errors" do
        table = create_test_table_data
        schema_data = create_test_schema_data

        # Mock service registry with proper services
        mock_service_registry = setup_basic_service_registry_mock

        # Mock type mapper to avoid method errors
        mock_type_mapper = mock("TypeMapper")
        mock_type_mapper.stubs(:map_rails_type_to_typescript).returns("string")
        mock_service_registry.stubs(:get_service).with(:type_mapper).returns(mock_type_mapper)

        # Mock relationship processor factory
        mock_processor_factory = mock("RelationshipProcessorFactory")
        mock_processor = mock("RelationshipProcessor")
        mock_processor.stubs(:process_all).returns({
          properties: "", imports: "", exclusions: "", documentation: "", registration: ""
        })
        mock_processor_factory.stubs(:call).returns(mock_processor)
        mock_service_registry.stubs(:get_service).with(:relationship_processor).returns(mock_processor_factory)

        # Mock template renderer
        mock_template = mock("TemplateRenderer")
        mock_template.stubs(:render).returns("content")
        mock_service_registry.stubs(:get_service).with(:template_renderer).returns(mock_template)

        # Mock file manager that raises error
        mock_file_manager = mock("FileManager")
        mock_file_manager.stubs(:write_with_formatting).raises(StandardError.new("File error"))
        mock_service_registry.stubs(:get_service).with(:file_manager).returns(mock_file_manager)

        @coordinator.stubs(:service_registry).returns(mock_service_registry)

        error = assert_raises GenerationCoordinator::ModelGenerationError do
          @coordinator.generate_model_set(table, schema_data)
        end

        assert_includes error.message, "Failed to generate model for users"
        assert_equal 1, @coordinator.statistics[:errors_encountered]
      end

      # =============================================================================
      # Service Coordination Tests
      # =============================================================================

      test "coordinates with service registry correctly" do
        # Test that coordinator properly interacts with service registry
        setup_successful_execution_mocks

        result = @coordinator.execute

        # Verify that execution completed successfully
        assert_instance_of Hash, result
        assert result.key?(:generated_models)
        assert result.key?(:service_performance)
        assert result.key?(:execution_statistics)

        # Verify statistics are tracked
        assert @coordinator.statistics[:services_initialized] > 0
      end

      test "aggregates service statistics correctly" do
        mock_service_registry = setup_basic_service_registry_mock
        expected_stats = { total_renders: 10, total_cache_hits: 5 }
        mock_service_registry.expects(:aggregate_service_statistics).returns(expected_stats)

        @coordinator.stubs(:service_registry).returns(mock_service_registry)

        result = @coordinator.send(:aggregate_service_statistics)
        assert_equal expected_stats, result
      end

      # =============================================================================
      # Template Context Building Tests
      # =============================================================================

      test "builds data interface context correctly" do
        table = create_test_table_data
        class_name = "User"
        relationships = create_test_relationships

        setup_context_building_mocks

        context = @coordinator.send(:build_data_interface_context, table, class_name, relationships)

        assert_equal class_name, context[:class_name]
        assert_equal table, context[:table]
        assert_includes context[:timestamp], Time.current.year.to_s
        assert_instance_of String, context[:all_properties]
        assert_includes context[:create_exclusions], "Omit<#{class_name}Data"
        assert_includes context[:update_exclusions], "Partial<Omit<#{class_name}Data"
      end

      test "builds active model context correctly" do
        table = create_test_table_data
        class_name = "User"
        kebab_name = "user"
        relationships = create_test_relationships
        patterns = { soft_deletion: { gem: "discard", column: "discarded_at" } }

        setup_context_building_mocks

        context = @coordinator.send(:build_active_model_context, table, class_name, kebab_name, relationships, patterns)

        assert_equal class_name, context[:class_name]
        assert_equal table[:name], context[:table_name]
        assert_equal kebab_name, context[:kebab_name]
        assert_equal "user", context[:model_name]
        assert_includes context[:timestamp], Time.current.year.to_s
        assert_equal "true", context[:supports_discard]
        assert_not_empty context[:discard_scopes]
      end

      test "builds reactive model context correctly" do
        table = create_test_table_data
        class_name = "User"
        kebab_name = "user"
        relationships = create_test_relationships
        patterns = {}

        setup_context_building_mocks

        context = @coordinator.send(:build_reactive_model_context, table, class_name, kebab_name, relationships, patterns)

        # Should be identical to active model context
        assert_equal class_name, context[:class_name]
        assert_equal table[:name], context[:table_name]
        assert_equal kebab_name, context[:kebab_name]
        assert_equal "false", context[:supports_discard]
      end

      # =============================================================================
      # Helper Method Tests
      # =============================================================================

      test "find_relationships_for_table returns correct relationships" do
        relationships = [
          { table: "users", belongs_to: [ { name: :account, target_table: "accounts" } ] },
          { table: "posts", belongs_to: [ { name: :user, target_table: "users" } ] }
        ]

        result = @coordinator.send(:find_relationships_for_table, "users", relationships)

        assert_equal relationships[0], result
      end

      test "find_relationships_for_table returns default for missing table" do
        relationships = [
          { table: "posts", belongs_to: [ { name: :user, target_table: "users" } ] }
        ]

        result = @coordinator.send(:find_relationships_for_table, "missing_table", relationships)

        expected_default = {
          belongs_to: [],
          has_many: [],
          has_one: [],
          polymorphic: []
        }
        assert_equal expected_default, result
      end

      test "supports_discard? detects discard gem correctly" do
        discard_patterns = { soft_deletion: { gem: "discard", column: "discarded_at" } }
        other_patterns = { soft_deletion: { gem: "paranoia", column: "deleted_at" } }
        no_patterns = {}

        assert_equal "true", @coordinator.send(:supports_discard?, discard_patterns)
        assert_equal "false", @coordinator.send(:supports_discard?, other_patterns)
        assert_equal "false", @coordinator.send(:supports_discard?, no_patterns)
      end

      test "build_discard_scopes generates correct scopes" do
        discard_patterns = { soft_deletion: { gem: "discard", column: "discarded_at" } }
        class_name = "User"

        result = @coordinator.send(:build_discard_scopes, discard_patterns, class_name)

        assert_includes result, "discarded#{class_name}s"
        assert_includes result, "#{class_name}.discarded().all()"
      end

      test "generate_relationship_import returns import when relationships exist" do
        relationships = {
          belongs_to: [ { name: :user, target_table: "users" } ]
        }

        result = @coordinator.send(:generate_relationship_import, relationships)

        assert_includes result, "import { registerModelRelationships }"
      end

      test "generate_relationship_import returns empty when no relationships" do
        empty_relationships = {
          belongs_to: [],
          has_many: [],
          has_one: []
        }

        result = @coordinator.send(:generate_relationship_import, empty_relationships)

        assert_equal "", result
      end

      test "enable_caching_for_environment? returns correct values" do
        Rails.stubs(:env).returns(ActiveSupport::StringInquirer.new("development"))
        assert @coordinator.send(:enable_caching_for_environment?)

        Rails.stubs(:env).returns(ActiveSupport::StringInquirer.new("production"))
        assert @coordinator.send(:enable_caching_for_environment?)

        Rails.stubs(:env).returns(ActiveSupport::StringInquirer.new("test"))
        assert_not @coordinator.send(:enable_caching_for_environment?)
      end

      # =============================================================================
      # Statistics and Reporting Tests
      # =============================================================================

      test "compile_results creates comprehensive result hash" do
        generation_result = {
          generated_models: [ { table_name: "users", model_name: "user" } ],
          generated_files: [ "/path/to/user.ts" ],
          skipped_tables: [],
          errors: []
        }
        start_time = Time.current - 1.5

        mock_service_registry = setup_basic_service_registry_mock
        mock_service_registry.expects(:aggregate_service_statistics).returns({})
        @coordinator.stubs(:service_registry).returns(mock_service_registry)

        result = @coordinator.send(:compile_results, generation_result, start_time)

        assert_instance_of Hash, result
        assert_equal generation_result[:generated_models], result[:generated_models]
        assert_equal generation_result[:generated_files], result[:generated_files]
        assert_instance_of Hash, result[:execution_statistics]
        assert_instance_of Hash, result[:service_performance]
        assert_instance_of Hash, result[:summary]
        assert result[:execution_statistics][:execution_time] > 0
      end

      test "calculate_success_rate computes correctly" do
        # 100% success
        perfect_result = {
          generated_models: [ { name: "user" }, { name: "post" } ],
          skipped_tables: []
        }
        assert_equal 100.0, @coordinator.send(:calculate_success_rate, perfect_result)

        # 50% success
        mixed_result = {
          generated_models: [ { name: "user" } ],
          skipped_tables: [ "posts" ]
        }
        assert_equal 50.0, @coordinator.send(:calculate_success_rate, mixed_result)

        # 0% success (edge case)
        failed_result = {
          generated_models: [],
          skipped_tables: [ "users", "posts" ]
        }
        assert_equal 0.0, @coordinator.send(:calculate_success_rate, failed_result)

        # No tables attempted (edge case)
        empty_result = {
          generated_models: [],
          skipped_tables: []
        }
        assert_equal 100.0, @coordinator.send(:calculate_success_rate, empty_result)
      end

      # =============================================================================
      # Index File Generation Tests
      # =============================================================================

      test "generate_zero_index_content creates correct content" do
        model_examples = "// import { User } from '$lib/models/user';\n// import { Post } from '$lib/models/post';"

        content = @coordinator.send(:generate_zero_index_content, model_examples)

        assert_includes content, "Zero - Complete export file"
        assert_includes content, model_examples
        assert_includes content, "initZero, getZero"
        assert_includes content, "Epic-008"
        assert_includes content, Time.current.year.to_s
      end

      # =============================================================================
      # Error Handling Tests
      # =============================================================================

      test "handles service initialization errors" do
        ServiceRegistry.stubs(:new).raises(StandardError.new("Registry error"))

        assert_raises GenerationCoordinator::ServiceInitializationError do
          GenerationCoordinator.new(@options, @shell)
        end
      end

      test "handles execution errors with proper reporting" do
        # Mock services to get past initial setup
        mock_service_registry = setup_basic_service_registry_mock
        mock_config = mock("ConfigurationService")
        mock_config.stubs(:base_output_dir).returns("frontend/src/lib/models")
        mock_service_registry.stubs(:get_service).with(:configuration).returns(mock_config)

        mock_file_manager = mock("FileManager")
        mock_file_manager.stubs(:ensure_directory_exists)
        mock_service_registry.stubs(:get_service).with(:file_manager).returns(mock_file_manager)

        coordinator = GenerationCoordinator.new(@options, @shell)
        coordinator.stubs(:service_registry).returns(mock_service_registry)
        coordinator.stubs(:extract_and_filter_schema).raises(StandardError.new("Test error"))

        @shell.expects(:say).with(regexp_matches(/Generation failed/), :red)

        error = assert_raises GenerationCoordinator::GenerationError do
          coordinator.execute
        end

        assert_includes error.message, "Generation failed"
        assert_equal 1, coordinator.statistics[:errors_encountered]
      end

      # =============================================================================
      # Integration Tests
      # =============================================================================

      test "handles empty schema gracefully" do
        setup_empty_schema_mocks

        result = @coordinator.execute

        assert_instance_of Hash, result
        assert_empty result[:generated_models]
        assert_empty result[:generated_files]
        assert_instance_of Hash, result[:summary]
        assert_equal 0, result[:summary][:total_models]
        assert_equal 0, result[:summary][:total_files]
      end

      test "processes multiple tables correctly" do
        setup_multi_table_execution_mocks

        result = @coordinator.execute

        assert result[:generated_models].length > 1
        # Note: tables_processed is not automatically tracked, so check models_generated instead
        assert @coordinator.statistics[:models_generated] > 1
        assert result[:summary][:total_models] > 1
      end

      test "handles mixed success and failure scenarios" do
        setup_mixed_results_execution_mocks

        result = @coordinator.execute

        assert result[:generated_models].length > 0
        assert result[:skipped_tables].length > 0
        assert result[:errors].length > 0
        success_rate = result[:summary][:success_rate]
        assert success_rate > 0
        assert success_rate < 100
      end

      private

      def setup_default_service_registry_mock
        # Create a basic mock service registry that doesn't fail during initialization
        mock_service_registry = mock("ServiceRegistry")
        mock_service_registry.stubs(:initialized_services).returns([ "config", "schema", "file_manager", "template_renderer", "type_mapper" ])
        mock_service_registry.stubs(:get_service).returns(mock("DefaultService"))
        mock_service_registry.stubs(:aggregate_service_statistics).returns({})

        ServiceRegistry.stubs(:new).returns(mock_service_registry)
      end

      def mock_shell
        shell = mock("Shell")
        shell.stubs(:say)
        shell
      end

      def create_test_table_data
        {
          name: "users",
          columns: [
            { name: "id", type: "integer", null: false },
            { name: "email", type: "string", null: false, comment: "User email address" },
            { name: "name", type: "string", null: true },
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
              belongs_to: [ { name: :account, target_table: "accounts" } ],
              has_many: [ { name: :posts, target_table: "posts" } ],
              has_one: []
            }
          ],
          patterns: {
            "users" => { soft_deletion: { gem: "discard", column: "discarded_at" } }
          }
        }
      end

      def create_test_relationships
        {
          belongs_to: [ { name: :account, target_table: "accounts" } ],
          has_many: [ { name: :posts, target_table: "posts" } ],
          has_one: []
        }
      end

      def setup_basic_service_registry_mock
        mock_service_registry = mock("ServiceRegistry")
        mock_service_registry.stubs(:initialized_services).returns([ "config", "schema" ])
        mock_service_registry.stubs(:get_service).returns(mock("Service"))
        mock_service_registry.stubs(:aggregate_service_statistics).returns({})
        mock_service_registry
      end

      def setup_comprehensive_service_registry_mock
        mock_service_registry = setup_basic_service_registry_mock

        # Mock configuration service
        mock_config = mock("ConfigurationService")
        mock_config.stubs(:base_output_dir).returns("frontend/src/lib/models")
        mock_service_registry.stubs(:get_service).with(:configuration).returns(mock_config)

        # Mock schema service
        mock_schema = mock("SchemaService")
        mock_schema.stubs(:extract_filtered_schema).returns(create_test_schema_data)
        mock_service_registry.stubs(:get_service).with(:schema).returns(mock_schema)

        # Mock file manager
        mock_file_manager = mock("FileManager")
        mock_file_manager.stubs(:ensure_directory_exists)
        mock_file_manager.stubs(:write_with_formatting).returns("/fake/path/file.ts")
        mock_file_manager.stubs(:statistics).returns({
          created: 3, identical: 0, formatted: 2, directories_created: 1, errors: 0
        })
        mock_service_registry.stubs(:get_service).with(:file_manager).returns(mock_file_manager)

        # Mock template renderer
        mock_template = mock("TemplateRenderer")
        mock_template.stubs(:render).returns("generated content")
        mock_template.stubs(:statistics).returns({
          renders: 3, total_time: 0.1, average_time: 0.033, cache_enabled: false,
          cache_hits: 0, cache_misses: 0, cache_hit_ratio: 0.0
        })
        mock_service_registry.stubs(:get_service).with(:template_renderer).returns(mock_template)

        # Mock type mapper
        mock_type_mapper = mock("TypeMapper")
        mock_type_mapper.stubs(:map_rails_type_to_typescript).returns("string")
        mock_service_registry.stubs(:get_service).with(:type_mapper).returns(mock_type_mapper)

        # Mock relationship processor factory
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

        mock_service_registry
      end

      def setup_successful_execution_mocks
        mock_service_registry = setup_comprehensive_service_registry_mock
        @coordinator.stubs(:service_registry).returns(mock_service_registry)
      end

      def setup_dry_run_execution_mocks(coordinator)
        mock_service_registry = setup_basic_service_registry_mock

        # Mock configuration service
        mock_config = mock("ConfigurationService")
        mock_config.stubs(:base_output_dir).returns("frontend/src/lib/models")
        mock_service_registry.stubs(:get_service).with(:configuration).returns(mock_config)

        # Mock schema service
        mock_schema = mock("SchemaService")
        mock_schema.stubs(:extract_filtered_schema).returns(create_test_schema_data)
        mock_service_registry.stubs(:get_service).with(:schema).returns(mock_schema)

        # Mock file manager
        mock_file_manager = mock("FileManager")
        mock_file_manager.stubs(:ensure_directory_exists)
        mock_service_registry.stubs(:get_service).with(:file_manager).returns(mock_file_manager)

        coordinator.stubs(:service_registry).returns(mock_service_registry)
      end

      def setup_model_generation_mocks
        mock_service_registry = setup_comprehensive_service_registry_mock
        @coordinator.stubs(:service_registry).returns(mock_service_registry)
      end

      def setup_dry_run_model_generation_mocks(coordinator)
        mock_service_registry = setup_basic_service_registry_mock
        coordinator.stubs(:service_registry).returns(mock_service_registry)
      end

      def setup_context_building_mocks
        mock_service_registry = setup_comprehensive_service_registry_mock
        @coordinator.stubs(:service_registry).returns(mock_service_registry)
      end

      def setup_empty_schema_mocks
        mock_service_registry = setup_basic_service_registry_mock

        # Mock configuration service
        mock_config = mock("ConfigurationService")
        mock_config.stubs(:base_output_dir).returns("frontend/src/lib/models")
        mock_service_registry.stubs(:get_service).with(:configuration).returns(mock_config)

        # Mock schema service to return empty schema
        mock_schema = mock("SchemaService")
        mock_schema.stubs(:extract_filtered_schema).returns({
          tables: [], relationships: [], patterns: {}
        })
        mock_service_registry.stubs(:get_service).with(:schema).returns(mock_schema)

        # Mock file manager
        mock_file_manager = mock("FileManager")
        mock_file_manager.stubs(:ensure_directory_exists)
        mock_file_manager.stubs(:statistics).returns({
          created: 0, identical: 0, formatted: 0, directories_created: 1, errors: 0
        })
        mock_service_registry.stubs(:get_service).with(:file_manager).returns(mock_file_manager)

        # Mock template renderer
        mock_template = mock("TemplateRenderer")
        mock_template.stubs(:statistics).returns({
          renders: 0, total_time: 0.0, average_time: 0.0, cache_enabled: false,
          cache_hits: 0, cache_misses: 0, cache_hit_ratio: 0.0
        })
        mock_service_registry.stubs(:get_service).with(:template_renderer).returns(mock_template)

        @coordinator.stubs(:service_registry).returns(mock_service_registry)
      end

      def setup_multi_table_execution_mocks
        mock_service_registry = setup_comprehensive_service_registry_mock

        # Override schema service to return multiple tables
        multi_table_schema = {
          tables: [
            create_test_table_data,
            { name: "posts", columns: [ { name: "id", type: "integer" } ] },
            { name: "comments", columns: [ { name: "id", type: "integer" } ] }
          ],
          relationships: [],
          patterns: {}
        }

        mock_schema = mock("SchemaService")
        mock_schema.stubs(:extract_filtered_schema).returns(multi_table_schema)
        mock_service_registry.stubs(:get_service).with(:schema).returns(mock_schema)

        @coordinator.stubs(:service_registry).returns(mock_service_registry)
      end

      def setup_mixed_results_execution_mocks
        mock_service_registry = setup_comprehensive_service_registry_mock

        # Override file manager to sometimes fail
        mock_file_manager = mock("FileManager")
        mock_file_manager.stubs(:ensure_directory_exists)
        mock_file_manager.stubs(:statistics).returns({
          created: 3, identical: 0, formatted: 2, directories_created: 1, errors: 1
        })

        # Make file manager fail on second call
        call_count = 0
        mock_file_manager.stubs(:write_with_formatting).with do |path, content|
          call_count += 1
          if call_count == 5  # Fail on 5th call (second model, second file)
            raise StandardError.new("Simulated file error")
          else
            true
          end
        end.returns("/fake/path/file.ts")

        mock_service_registry.stubs(:get_service).with(:file_manager).returns(mock_file_manager)

        # Use multi-table schema
        multi_table_schema = {
          tables: [
            create_test_table_data,
            { name: "posts", columns: [ { name: "id", type: "integer" } ] }
          ],
          relationships: [],
          patterns: {}
        }

        mock_schema = mock("SchemaService")
        mock_schema.stubs(:extract_filtered_schema).returns(multi_table_schema)
        mock_service_registry.stubs(:get_service).with(:schema).returns(mock_schema)

        @coordinator.stubs(:service_registry).returns(mock_service_registry)
      end
    end
  end
end
