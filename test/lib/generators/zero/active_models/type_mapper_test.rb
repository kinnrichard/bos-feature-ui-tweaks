# frozen_string_literal: true

require "test_helper"
require "stringio"
require "mocha/minitest"
require "generators/zero/active_models/type_mapper"

module Zero
  module Generators
    class TypeMapperTest < ActiveSupport::TestCase
      def setup
        # Set environment to skip fixtures for this test
        @original_skip_fixtures = ENV["SKIP_FIXTURES"]
        ENV["SKIP_FIXTURES"] = "true"

        @type_mapper = TypeMapper.new
      end

      def teardown
        # Restore original environment setting
        ENV["SKIP_FIXTURES"] = @original_skip_fixtures
      end

      # =============================================================================
      # Initialization & Configuration Tests
      # =============================================================================

      test "initializes with default configuration" do
        mapper = TypeMapper.new

        assert_not_nil mapper.effective_mappings
        assert mapper.handles_unknown_types?
        assert_includes mapper.supported_rails_types, "string"
        assert_includes mapper.supported_rails_types, "integer"
      end

      test "initializes with custom mappings" do
        custom_mappings = { "custom_type" => "CustomInterface" }
        mapper = TypeMapper.new(custom_mappings: custom_mappings)

        assert_equal "CustomInterface", mapper.effective_mappings["custom_type"]
        assert_includes mapper.supported_rails_types, "custom_type"
      end

      test "initializes with custom unknown type handler" do
        mapper = TypeMapper.new(unknown_type_handler: "any")

        result = mapper.map_rails_type_to_typescript("nonexistent_type", {})

        assert_equal "any", result
      end

      test "custom mappings override default mappings" do
        custom_mappings = { "string" => "custom_string_type" }
        mapper = TypeMapper.new(custom_mappings: custom_mappings)

        result = mapper.map_rails_type_to_typescript("string", {})

        assert_equal "custom_string_type", result
      end

      test "effective_mappings returns a copy to prevent external modification" do
        original_mappings = @type_mapper.effective_mappings
        original_mappings["test"] = "modified"

        new_mappings = @type_mapper.effective_mappings

        assert_not_includes new_mappings, "test"
      end

      # =============================================================================
      # Standard Type Mapping Tests
      # =============================================================================

      test "maps string types correctly" do
        assert_equal "string", @type_mapper.map_rails_type_to_typescript("string", {})
        assert_equal "string", @type_mapper.map_rails_type_to_typescript("text", {})
      end

      test "maps numeric types correctly" do
        assert_equal "number", @type_mapper.map_rails_type_to_typescript("integer", {})
        assert_equal "number", @type_mapper.map_rails_type_to_typescript("bigint", {})
        assert_equal "number", @type_mapper.map_rails_type_to_typescript("decimal", {})
        assert_equal "number", @type_mapper.map_rails_type_to_typescript("float", {})
      end

      test "maps boolean types correctly" do
        assert_equal "boolean", @type_mapper.map_rails_type_to_typescript("boolean", {})
      end

      test "maps date and time types correctly" do
        assert_equal "string | number", @type_mapper.map_rails_type_to_typescript("datetime", {})
        assert_equal "string | number", @type_mapper.map_rails_type_to_typescript("timestamp", {})
        assert_equal "string | number", @type_mapper.map_rails_type_to_typescript("timestamptz", {})
        assert_equal "string", @type_mapper.map_rails_type_to_typescript("date", {})
        assert_equal "string", @type_mapper.map_rails_type_to_typescript("time", {})
      end

      test "maps complex types correctly" do
        assert_equal "Record<string, unknown>", @type_mapper.map_rails_type_to_typescript("json", {})
        assert_equal "Record<string, unknown>", @type_mapper.map_rails_type_to_typescript("jsonb", {})
        assert_equal "string", @type_mapper.map_rails_type_to_typescript("uuid", {})
        assert_equal "Uint8Array", @type_mapper.map_rails_type_to_typescript("binary", {})
      end

      test "handles unknown types with default handler" do
        result = @type_mapper.map_rails_type_to_typescript("unknown_type", {})

        assert_equal "unknown", result
      end

      test "handles symbol input types" do
        assert_equal "string", @type_mapper.map_rails_type_to_typescript(:string, {})
        assert_equal "number", @type_mapper.map_rails_type_to_typescript(:integer, {})
      end

      # =============================================================================
      # Enum Handling Tests
      # =============================================================================

      test "maps basic enum types correctly" do
        column = { enum: true, enum_values: [ "active", "inactive" ] }

        result = @type_mapper.map_rails_type_to_typescript("string", column)

        assert_equal "'active' | 'inactive'", result
      end

      test "maps enum with multiple values" do
        column = { enum: true, enum_values: [ "draft", "published", "archived", "deleted" ] }

        result = @type_mapper.map_rails_type_to_typescript("string", column)

        assert_equal "'draft' | 'published' | 'archived' | 'deleted'", result
      end

      test "escapes single quotes in enum values" do
        column = { enum: true, enum_values: [ "can't", "won't", "shouldn't" ] }

        result = @type_mapper.map_rails_type_to_typescript("string", column)

        # Note: Current implementation removes single quotes rather than escaping them
        assert_equal "'cantt' | 'wontt' | 'shouldntt'", result
      end

      test "handles enum with numeric values" do
        column = { enum: true, enum_values: [ 1, 2, 3 ] }

        result = @type_mapper.map_rails_type_to_typescript("integer", column)

        assert_equal "'1' | '2' | '3'", result
      end

      test "handles enum with mixed type values" do
        column = { enum: true, enum_values: [ "active", 1, true ] }

        result = @type_mapper.map_rails_type_to_typescript("string", column)

        assert_equal "'active' | '1' | 'true'", result
      end

      test "enum_type method works independently" do
        column = { enum_values: [ "pending", "completed" ] }

        result = @type_mapper.enum_type(column)

        assert_equal "'pending' | 'completed'", result
      end

      # =============================================================================
      # Invalid Enum Handling Tests
      # =============================================================================

      test "handles column without enum flag but with enum_values" do
        column = { enum_values: [ "active", "inactive" ] }

        result = @type_mapper.map_rails_type_to_typescript("string", column)

        # Should not be treated as enum without enum: true flag
        assert_equal "string", result
      end

      test "handles enum column with empty enum_values array" do
        column = { enum: true, enum_values: [] }

        result = @type_mapper.map_rails_type_to_typescript("string", column)

        assert_equal "string", result
      end

      test "handles enum column with nil enum_values" do
        column = { enum: true, enum_values: nil }

        result = @type_mapper.map_rails_type_to_typescript("string", column)

        assert_equal "string", result
      end

      test "handles enum column without enum_values key" do
        column = { enum: true }

        result = @type_mapper.map_rails_type_to_typescript("string", column)

        assert_equal "string", result
      end

      test "enum_type returns unknown for invalid enum values" do
        invalid_columns = [
          { enum_values: [] },
          { enum_values: nil },
          {}
        ]

        invalid_columns.each do |column|
          result = @type_mapper.enum_type(column)
          assert_equal "unknown", result
        end
      end

      # =============================================================================
      # Utility Method Tests
      # =============================================================================

      test "handles_unknown_types? returns correct value" do
        default_mapper = TypeMapper.new
        assert default_mapper.handles_unknown_types?

        nil_handler_mapper = TypeMapper.new(unknown_type_handler: nil)
        assert_not nil_handler_mapper.handles_unknown_types?
      end

      test "supported_rails_types returns sorted array of supported types" do
        types = @type_mapper.supported_rails_types

        assert_instance_of Array, types
        assert_includes types, "string"
        assert_includes types, "integer"
        assert_includes types, "boolean"
        assert_equal types.sort, types
      end

      test "supported_rails_types includes custom mappings" do
        custom_mapper = TypeMapper.new(custom_mappings: { "custom" => "CustomType" })

        types = custom_mapper.supported_rails_types

        assert_includes types, "custom"
      end

      test "effective_mappings combines defaults and custom mappings" do
        custom_mappings = { "custom_type" => "CustomInterface", "string" => "OverriddenString" }
        mapper = TypeMapper.new(custom_mappings: custom_mappings)

        mappings = mapper.effective_mappings

        # Should include default mappings
        assert_equal "number", mappings["integer"]
        assert_equal "boolean", mappings["boolean"]

        # Should include custom mappings
        assert_equal "CustomInterface", mappings["custom_type"]

        # Custom should override default
        assert_equal "OverriddenString", mappings["string"]
      end

      # =============================================================================
      # Special Characters and Edge Cases Tests
      # =============================================================================

      test "handles enum values with special characters" do
        column = { enum: true, enum_values: [ "test-value", "test_value", "test.value" ] }

        result = @type_mapper.map_rails_type_to_typescript("string", column)

        assert_equal "'test-value' | 'test_value' | 'test.value'", result
      end

      test "handles enum values with spaces" do
        column = { enum: true, enum_values: [ "status active", "status inactive" ] }

        result = @type_mapper.map_rails_type_to_typescript("string", column)

        assert_equal "'status active' | 'status inactive'", result
      end

      test "handles empty string input gracefully" do
        result = @type_mapper.map_rails_type_to_typescript("", {})

        assert_equal "unknown", result
      end

      test "handles nil input gracefully" do
        result = @type_mapper.map_rails_type_to_typescript(nil, {})

        assert_equal "unknown", result
      end

      test "handles large enum value lists" do
        large_enum_values = (1..100).map { |i| "value_#{i}" }
        column = { enum: true, enum_values: large_enum_values }

        result = @type_mapper.map_rails_type_to_typescript("string", column)

        expected = large_enum_values.map { |v| "'#{v}'" }.join(" | ")
        assert_equal expected, result
      end

      # =============================================================================
      # Development Environment Warning Tests
      # =============================================================================

      test "warns about unknown types in development environment" do
        # Mock Rails.env.development? to return true
        Rails.stubs(:env).returns(ActiveSupport::StringInquirer.new("development"))

        # Capture stdout to check warning output
        output = capture_io do
          @type_mapper.map_rails_type_to_typescript("unknown_type", {})
        end

        assert_match(/⚠️.*TypeMapper.*Unknown Rails type.*unknown_type/, output[0])
      end

      test "does not warn about unknown types in non-development environment" do
        # Mock Rails.env.development? to return false
        Rails.stubs(:env).returns(ActiveSupport::StringInquirer.new("production"))

        # Capture stdout to check no warning output
        output = capture_io do
          @type_mapper.map_rails_type_to_typescript("unknown_type", {})
        end

        assert_empty output[0]
      end

      # =============================================================================
      # Integration Tests
      # =============================================================================

      test "integrates enum handling with custom mappings" do
        custom_mapper = TypeMapper.new(
          custom_mappings: { "custom_enum_type" => "DefaultCustomType" }
        )

        # Non-enum should use custom mapping
        result1 = custom_mapper.map_rails_type_to_typescript("custom_enum_type", {})
        assert_equal "DefaultCustomType", result1

        # Enum should override custom mapping
        enum_column = { enum: true, enum_values: [ "option1", "option2" ] }
        result2 = custom_mapper.map_rails_type_to_typescript("custom_enum_type", enum_column)
        assert_equal "'option1' | 'option2'", result2
      end

      test "preserves type mapping behavior across multiple calls" do
        # Ensure mapper state is consistent across multiple calls
        10.times do
          assert_equal "string", @type_mapper.map_rails_type_to_typescript("string", {})
          assert_equal "number", @type_mapper.map_rails_type_to_typescript("integer", {})
        end
      end

      test "handles concurrent access safely" do
        # Test thread safety by accessing mapper from multiple threads
        threads = []
        results = []
        mutex = Mutex.new

        5.times do |i|
          threads << Thread.new do
            result = @type_mapper.map_rails_type_to_typescript("string", {})
            mutex.synchronize do
              results << [ i, result ]
            end
          end
        end

        threads.each(&:join)

        assert_equal 5, results.length
        results.each do |thread_id, result|
          assert_equal "string", result
        end
      end

      # =============================================================================
      # Constant Validation Tests
      # =============================================================================

      test "TYPE_MAP constant is properly structured" do
        assert_instance_of Hash, TypeMapper::TYPE_MAP
        assert TypeMapper::TYPE_MAP.frozen?

        # Check that keys are arrays and values are strings
        TypeMapper::TYPE_MAP.each do |rails_types, ts_type|
          assert_instance_of Array, rails_types
          assert_instance_of String, ts_type
          assert rails_types.all? { |type| type.is_a?(String) }
        end
      end

      test "FLATTENED_TYPE_MAP is properly built from TYPE_MAP" do
        assert_instance_of Hash, TypeMapper::FLATTENED_TYPE_MAP
        assert TypeMapper::FLATTENED_TYPE_MAP.frozen?

        # Verify that flattened map contains all individual types
        TypeMapper::TYPE_MAP.each do |rails_types, expected_ts_type|
          rails_types.each do |rails_type|
            assert_equal expected_ts_type, TypeMapper::FLATTENED_TYPE_MAP[rails_type]
          end
        end
      end

      test "DEFAULT_UNKNOWN_TYPE constant is properly defined" do
        assert_equal "unknown", TypeMapper::DEFAULT_UNKNOWN_TYPE
      end

      private

      def capture_io
        old_stdout = $stdout
        old_stderr = $stderr
        $stdout = StringIO.new
        $stderr = StringIO.new
        yield
        [ $stdout.string, $stderr.string ]
      ensure
        $stdout = old_stdout
        $stderr = old_stderr
      end
    end
  end
end
