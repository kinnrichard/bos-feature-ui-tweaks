# frozen_string_literal: true

require "test_helper"
require "generators/zero/active_models/type_mapper"
require "generators/zero/active_models/relationship_processor"

module Zero
  module Generators
    # Tests to demonstrate the new constructor injection pattern
    # following Sandi Metz's principles
    class ConstructorInjectionTest < Minitest::Test
      # =============================================================================
      # TypeMapper Constructor Injection Tests
      # =============================================================================

      def test_type_mapper_works_with_defaults
        mapper = TypeMapper.new

        assert_equal "string", mapper.map_rails_type_to_typescript("string", {})
        assert_equal "number", mapper.map_rails_type_to_typescript("integer", {})
        assert_equal "boolean", mapper.map_rails_type_to_typescript("boolean", {})
        assert_equal "unknown", mapper.map_rails_type_to_typescript("nonexistent_type", {})
      end

      def test_type_mapper_accepts_custom_mappings
        custom_mappings = { special_type: "CustomType" }
        mapper = TypeMapper.new(custom_mappings: custom_mappings)

        # Should use custom mapping
        assert_equal "CustomType", mapper.map_rails_type_to_typescript("special_type", {})

        # Should still work with defaults
        assert_equal "string", mapper.map_rails_type_to_typescript("string", {})
      end

      def test_type_mapper_has_no_hidden_dependencies
        # Should be able to create without any external services
        mapper = TypeMapper.new

        # Should not have any instance variables pointing to services
        refute mapper.instance_variable_get(:@service_registry)
        refute mapper.instance_variable_get(:@configuration_service)
      end

      # =============================================================================
      # RelationshipProcessor Constructor Injection Tests
      # =============================================================================

      def test_relationship_processor_works_with_explicit_dependencies
        relationships = {
          belongs_to: [
            { name: "user", target_table: "users" }
          ],
          has_many: [
            { name: "posts", target_table: "posts" }
          ]
        }

        processor = RelationshipProcessor.new(relationships, "comments")

        # Should process relationships without external services
        result = processor.process_all

        assert result.key?(:properties)
        assert result.key?(:imports)
        assert result.key?(:exclusions)
      end

      def test_relationship_processor_accepts_schema_introspector
        relationships = {}
        mock_introspector = Object.new # Simple mock

        processor = RelationshipProcessor.new(
          relationships,
          "users",
          schema_introspector: mock_introspector
        )

        # Should store the introspector
        assert_equal mock_introspector, processor.instance_variable_get(:@schema_introspector)
      end

      def test_relationship_processor_has_no_hidden_dependencies
        processor = RelationshipProcessor.new({}, "users")

        # Should not have service registry dependencies
        refute processor.instance_variable_get(:@service_registry)
        refute processor.instance_variable_get(:@configuration_service)
      end

      # =============================================================================
      # Testing Pattern Demonstration
      # =============================================================================

      def test_simple_doubles_for_testing
        # Create a simple double - no complex mocking framework needed
        mock_type_mapper = Object.new
        def mock_type_mapper.map_rails_type_to_typescript(rails_type, column)
          case rails_type
          when "string" then "string"
          when "integer" then "number"
          else "unknown"
          end
        end

        # Use the mock directly
        assert_equal "string", mock_type_mapper.map_rails_type_to_typescript("string", {})
        assert_equal "number", mock_type_mapper.map_rails_type_to_typescript("integer", {})
        assert_equal "unknown", mock_type_mapper.map_rails_type_to_typescript("weird_type", {})
      end

      def test_testing_with_real_objects_when_appropriate
        # For simple, well-designed classes, use real objects
        real_type_mapper = TypeMapper.new
        real_processor = RelationshipProcessor.new({}, "users")

        # No mocking needed - these classes are simple and have no side effects
        assert_equal "string", real_type_mapper.map_rails_type_to_typescript("string", {})
        assert_instance_of Hash, real_processor.process_all
      end

      # =============================================================================
      # No ServiceRegistry Pattern Tests
      # =============================================================================

      def test_no_service_registry_pattern_is_obvious
        # These classes should not know about or use a ServiceRegistry

        # TypeMapper
        mapper = TypeMapper.new
        refute_respond_to mapper, :get_service
        refute_respond_to mapper, :service_registry

        # RelationshipProcessor
        processor = RelationshipProcessor.new({}, "users")
        refute_respond_to processor, :get_service
        refute_respond_to processor, :service_registry
      end

      def test_dependencies_are_explicit_in_constructor
        # All dependencies should be visible in the constructor signature

        # TypeMapper constructor shows what it needs
        mapper = TypeMapper.new(
          custom_mappings: { test: "TestType" },
          unknown_type_handler: "fallback"
        )
        assert_equal "TestType", mapper.map_rails_type_to_typescript("test", {})

        # RelationshipProcessor constructor shows what it needs
        processor = RelationshipProcessor.new(
          { belongs_to: [] },  # relationships
          "users",             # current_table_name
          schema_introspector: nil  # optional dependency
        )
        assert_instance_of Hash, processor.process_all
      end
    end
  end
end
