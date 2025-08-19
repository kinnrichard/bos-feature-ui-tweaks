# frozen_string_literal: true

require "test_helper"
require "mocha/minitest"
require "generators/zero/active_models/pipeline/generation_pipeline"
require "generators/zero/active_models/type_mapper"
require "generators/zero/active_models/relationship_processor"

module Zero
  module Generators
    module Pipeline
      class GenerationPipelineTest < ActiveSupport::TestCase
        def setup
          @options = {
            output_dir: "/tmp/test_models",
            dry_run: false,
            force: false
          }
        end

        # =============================================================================
        # Constructor Injection Tests - Following Sandi Metz Principles
        # =============================================================================

        test "accepts all dependencies via constructor injection" do
          # Create mock dependencies with simple doubles
          mock_schema_introspector = double("SchemaIntrospector", get_all_tables: [ "users" ])
          mock_type_mapper = double("TypeMapper", map_rails_type_to_typescript: "string")
          mock_relationship_factory = double("RelationshipProcessorFactory")
          mock_template_renderer = double("TemplateRenderer", render: "template content")
          mock_file_manager = double("FileManager", write_with_formatting: "/path/to/file")
          mock_default_converter = double("DefaultValueConverter", generate_defaults_object: nil)
          mock_polymorphic_analyzer = double("PolymorphicAnalyzer", polymorphic_associations_for_table: [])

          pipeline = GenerationPipeline.new(
            schema_introspector: mock_schema_introspector,
            type_mapper: mock_type_mapper,
            relationship_processor_factory: mock_relationship_factory,
            template_renderer: mock_template_renderer,
            file_manager: mock_file_manager,
            default_value_converter: mock_default_converter,
            polymorphic_analyzer: mock_polymorphic_analyzer,
            options: @options
          )

          assert_not_nil pipeline
          assert_equal @options, pipeline.options
        end

        test "provides sensible defaults when no dependencies provided" do
          pipeline = GenerationPipeline.new(options: @options)

          assert_not_nil pipeline
          assert_equal @options, pipeline.options

          # Should not raise errors - all defaults should work
          assert_nothing_raised do
            pipeline.statistics
          end
        end

        test "has no hidden dependencies - everything is explicit in constructor" do
          # This test verifies that we can create the pipeline with all mocks
          # and it doesn't try to reach out to hidden services or registries

          pipeline = GenerationPipeline.new(
            schema_introspector: double("SchemaIntrospector"),
            type_mapper: double("TypeMapper"),
            relationship_processor_factory: double("RelationshipProcessorFactory"),
            template_renderer: double("TemplateRenderer"),
            file_manager: double("FileManager"),
            default_value_converter: double("DefaultValueConverter"),
            polymorphic_analyzer: double("PolymorphicAnalyzer"),
            options: @options
          )

          # Should initialize without any external dependencies
          assert_not_nil pipeline
          assert_instance_of Hash, pipeline.statistics
        end

        # =============================================================================
        # Simplified Testing Patterns
        # =============================================================================

        test "works with real objects where appropriate" do
          # Use real TypeMapper - no mocking needed for simple, well-designed classes
          real_type_mapper = TypeMapper.new

          pipeline = GenerationPipeline.new(
            type_mapper: real_type_mapper,
            options: @options
          )

          assert_not_nil pipeline
          assert_equal "string", real_type_mapper.map_rails_type_to_typescript("string", {})
        end

        test "works with mix of custom and default dependencies" do
          # Only override what we need to test - let defaults handle the rest
          custom_type_mapper = TypeMapper.new(
            custom_mappings: { special_type: "CustomType" }
          )

          pipeline = GenerationPipeline.new(
            type_mapper: custom_type_mapper,
            options: @options
          )

          # Custom dependency should be used
          assert_equal "CustomType", custom_type_mapper.map_rails_type_to_typescript("special_type", {})
        end

        # =============================================================================
        # Statistics and Monitoring
        # =============================================================================

        test "tracks basic execution statistics" do
          pipeline = GenerationPipeline.new(options: @options)

          stats = pipeline.statistics

          assert_instance_of Hash, stats
          assert stats.key?(:execution_time)
          assert stats.key?(:models_generated)
          assert stats.key?(:files_created)
          assert stats.key?(:errors_encountered)
        end

        test "allows table-specific generation" do
          pipeline = GenerationPipeline.new(options: @options)

          # Should not raise errors even with minimal setup
          assert_nothing_raised do
            # This would normally execute the pipeline but we're just testing the interface
            pipeline.generate_model_for_table("users")
          end
        end

        # =============================================================================
        # Error Handling
        # =============================================================================

        test "handles errors gracefully during execution" do
          # Mock a dependency that will fail
          failing_schema_introspector = double("FailingSchemaIntrospector")
          failing_schema_introspector.expects(:get_all_tables).raises(StandardError.new("Mock failure"))

          pipeline = GenerationPipeline.new(
            schema_introspector: failing_schema_introspector,
            options: @options
          )

          result = pipeline.execute

          assert_not_nil result
          assert_equal false, result[:success]
          assert_not_empty result[:errors]
          assert_includes result[:errors].first, "Mock failure"
        end

        # =============================================================================
        # Integration with Defaults
        # =============================================================================

        test "default relationship processor factory creates working processors" do
          pipeline = GenerationPipeline.new(options: @options)

          # Access the private method for testing
          factory = pipeline.send(:default_relationship_processor_factory)

          # Factory should return a lambda
          assert_respond_to factory, :call

          # Factory should create RelationshipProcessor instances
          processor = factory.call({}, "users")
          assert_instance_of RelationshipProcessor, processor
        end

        test "default type mapper handles standard Rails types" do
          pipeline = GenerationPipeline.new(options: @options)

          # Access the default type mapper
          type_mapper = pipeline.send(:default_type_mapper)

          # Should handle common Rails types correctly
          assert_equal "string", type_mapper.map_rails_type_to_typescript("string", {})
          assert_equal "number", type_mapper.map_rails_type_to_typescript("integer", {})
          assert_equal "boolean", type_mapper.map_rails_type_to_typescript("boolean", {})
          assert_equal "unknown", type_mapper.map_rails_type_to_typescript("nonexistent_type", {})
        end

        # =============================================================================
        # No Magic, Clear Dependencies
        # =============================================================================

        test "no service registry magic - dependencies are obvious" do
          # This test documents that there's no hidden ServiceRegistry
          # All dependencies must be provided explicitly or use defaults

          pipeline = GenerationPipeline.new(options: @options)

          # Should not have any service_registry instance variable
          assert_nil pipeline.instance_variable_get(:@service_registry)

          # Should not respond to service registry methods
          assert_not_respond_to pipeline, :get_service
          assert_not_respond_to pipeline, :service_registry
        end
      end
    end
  end
end
