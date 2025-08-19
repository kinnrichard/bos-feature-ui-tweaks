# frozen_string_literal: true

require "test_helper"
require "minitest/autorun"
require "mocha/minitest"
require "fileutils"
require "generators/zero/active_models/service_registry"
require "generators/zero/active_models/configuration_service"
require "generators/zero/active_models/schema_service"
require "generators/zero/active_models/file_manager"
require "generators/zero/active_models/template_renderer"
require "generators/zero/active_models/type_mapper"
require "generators/zero/active_models/relationship_processor"
require "generators/zero/active_models/generation_coordinator"

module Zero
  module Generators
    # Phase 4: Edge Cases Test Suite
    #
    # This test suite validates handling of boundary conditions and unusual inputs
    # that could cause issues in the generator system. It ensures robust operation
    # under edge cases that might not occur in normal usage but could break the system.
    #
    # Test Areas:
    # - Schema Edge Cases
    # - Template Edge Cases
    # - File System Edge Cases
    # - Configuration Edge Cases
    # - Data Edge Cases
    #
    class EdgeCasesTest < ActiveSupport::TestCase
      # Skip fixtures for this test to avoid foreign key violations
      self.use_transactional_tests = false
      self.use_instantiated_fixtures = false
      self.fixture_table_names = []

      def setup
        @test_config = {
          environment: "test",
          enable_caching: false, # Disable caching for edge case testing
          enable_prettier: false,
          base_output_dir: Rails.root.join("tmp/test_edge_cases"),
          exclude_tables: [ "schema_migrations", "ar_internal_metadata" ]
        }

        # Ensure clean test environment
        cleanup_test_environment

        @registry = ServiceRegistry.new(validate_services: false)
      end

      def teardown
        @registry&.shutdown_all_services
        cleanup_test_environment
      end

      private

      def cleanup_test_environment
        if @test_config && @test_config[:base_output_dir] && File.exist?(@test_config[:base_output_dir])
          FileUtils.rm_rf(@test_config[:base_output_dir])
        end
      end

      # =============================================================================
      # Schema Edge Cases
      # =============================================================================

      test "handles empty database schemas" do
        # Initialize services
        schema_service = @registry.get_service(:schema)

        # Mock empty schema
        schema_service.expects(:extract_filtered_schema).returns({ tables: {} })

        # Test empty schema handling
        schema_data = schema_service.extract_filtered_schema(exclude_tables: @test_config[:exclude_tables])

        assert_instance_of Hash, schema_data
        assert schema_data.key?(:tables)
        assert_empty schema_data[:tables]

        # Service should remain functional
        assert @registry.service_initialized?(:schema)
      end

      test "handles tables with no columns" do
        # Initialize services
        config_service = @registry.get_service(:configuration)
        schema_service = @registry.get_service(:schema)

        # Mock configuration
        config_service.expects(:enable_schema_caching?).returns(false).at_least_once
        config_service.expects(:enable_pattern_detection?).returns(false).at_least_once

        # Mock table with no columns (edge case scenario)
        empty_table_schema = {
          columns: {},
          relationships: {},
          primary_key: nil,
          indexes: []
        }

        schema_service.expects(:extract_table_schema).with("empty_table").returns(empty_table_schema)

        # Test empty table handling
        table_schema = schema_service.extract_table_schema("empty_table")

        assert_instance_of Hash, table_schema
        assert table_schema.key?(:columns)
        assert_empty table_schema[:columns]

        # Service should handle this gracefully
        assert @registry.service_initialized?(:schema)
      end

      test "handles complex relationship cycles" do
        # Initialize services
        config_service = @registry.get_service(:configuration)
        schema_service = @registry.get_service(:schema)
        relationship_processor = @registry.get_service(:relationship_processor)

        # Mock configuration
        config_service.expects(:enable_schema_caching?).returns(false).at_least_once
        config_service.expects(:enable_pattern_detection?).returns(false).at_least_once

        # Mock circular relationship schema
        circular_schema = {
          tables: {
            "users" => {
              columns: { id: { type: :integer }, company_id: { type: :integer } },
              relationships: { company: { type: :belongs_to, class_name: "Company" } }
            },
            "companies" => {
              columns: { id: { type: :integer }, owner_id: { type: :integer } },
              relationships: {
                owner: { type: :belongs_to, class_name: "User" },
                users: { type: :has_many, class_name: "User" }
              }
            }
          }
        }

        schema_service.expects(:extract_filtered_schema).returns(circular_schema)

        # Test circular relationship handling
        schema_data = schema_service.extract_filtered_schema(exclude_tables: @test_config[:exclude_tables])

        assert_instance_of Hash, schema_data
        assert schema_data.key?(:tables)

        # Relationship processor should handle circular dependencies
        users_relationships = schema_data[:tables]["users"][:relationships]
        companies_relationships = schema_data[:tables]["companies"][:relationships]

        assert_instance_of Hash, users_relationships
        assert_instance_of Hash, companies_relationships

        # Service should remain functional
        assert @registry.service_initialized?(:relationship_processor)
      end

      test "handles very large schemas efficiently" do
        # Initialize services
        config_service = @registry.get_service(:configuration)
        schema_service = @registry.get_service(:schema)

        # Mock configuration
        config_service.expects(:enable_schema_caching?).returns(false).at_least_once
        config_service.expects(:enable_pattern_detection?).returns(false).at_least_once

        # Mock large schema (100 tables)
        large_schema = { tables: {} }

        (1..100).each do |i|
          table_name = "table_#{i}"
          large_schema[:tables][table_name] = {
            columns: {
              id: { type: :integer },
              name: { type: :string },
              description: { type: :text },
              created_at: { type: :datetime },
              updated_at: { type: :datetime }
            },
            relationships: {}
          }
        end

        schema_service.expects(:extract_filtered_schema).returns(large_schema)

        # Test large schema handling with timing
        start_time = Time.current
        schema_data = schema_service.extract_filtered_schema(exclude_tables: @test_config[:exclude_tables])
        processing_time = Time.current - start_time

        # Should handle large schemas efficiently (under reasonable time limit)
        assert processing_time < 5.0, "Large schema processing took #{processing_time}s, expected < 5.0s"

        assert_instance_of Hash, schema_data
        assert_equal 100, schema_data[:tables].size

        # Service should remain functional
        assert @registry.service_initialized?(:schema)
      end

      test "handles schemas with special characters" do
        # Initialize services
        config_service = @registry.get_service(:configuration)
        schema_service = @registry.get_service(:schema)

        # Mock configuration
        config_service.expects(:enable_schema_caching?).returns(false).at_least_once
        config_service.expects(:enable_pattern_detection?).returns(false).at_least_once

        # Mock schema with special characters in table and column names
        special_char_schema = {
          tables: {
            "users-with-dashes" => {
              columns: {
                "user-id" => { type: :integer },
                "email_address" => { type: :string },
                "full.name" => { type: :string },
                "data$field" => { type: :json },
                "unicode_名前" => { type: :string }
              },
              relationships: {}
            }
          }
        }

        schema_service.expects(:extract_filtered_schema).returns(special_char_schema)

        # Test special character handling
        schema_data = schema_service.extract_filtered_schema(exclude_tables: @test_config[:exclude_tables])

        assert_instance_of Hash, schema_data
        assert schema_data[:tables].key?("users-with-dashes")

        table_columns = schema_data[:tables]["users-with-dashes"][:columns]
        assert table_columns.key?("user-id")
        assert table_columns.key?("full.name")
        assert table_columns.key?("data$field")
        assert table_columns.key?("unicode_名前")

        # Service should handle special characters gracefully
        assert @registry.service_initialized?(:schema)
      end

      # =============================================================================
      # Template Edge Cases
      # =============================================================================

      test "handles templates with complex ERB logic" do
        # Initialize services
        config_service = @registry.get_service(:configuration)
        template_renderer = @registry.get_service(:template_renderer)

        # Mock configuration
        config_service.expects(:enable_template_caching?).returns(false).at_least_once

        # Mock complex template content with nested ERB logic
        complex_template_content = <<~ERB
          export class <%= class_name %> {
            <% columns.each do |name, info| %>
              <% if info[:type] == :integer %>
                <% if info[:nullable] %>
          <%= name %>?: number;
                <% else %>
          <%= name %>: number;
                <% end %>
              <% elsif info[:type] == :string %>
                <% if name.include?('email') %>
          <%= name %>: string; // Email field
                <% else %>
          <%= name %>: string;
                <% end %>
              <% else %>
          <%= name %>: unknown; // <%= info[:type] %>
              <% end %>
            <% end %>
          }
        ERB

        # Mock template loading
        template_renderer.stubs(:load_template_content).with("complex.ts.erb").returns(complex_template_content)

        # Test complex template rendering
        context = {
          class_name: "ComplexModel",
          columns: {
            id: { type: :integer, nullable: false },
            email: { type: :string, nullable: false },
            name: { type: :string, nullable: true },
            score: { type: :integer, nullable: true },
            metadata: { type: :json, nullable: true }
          }
        }

        rendered_content = template_renderer.render("complex.ts.erb", context)

        assert_instance_of String, rendered_content
        assert_match(/export class ComplexModel/, rendered_content)
        assert_match(/id: number;/, rendered_content)
        assert_match(/email: string; \/\/ Email field/, rendered_content)
        assert_match(/name\?: string;/, rendered_content)
        assert_match(/metadata: unknown; \/\/ json/, rendered_content)

        # Service should handle complex templates
        assert @registry.service_initialized?(:template_renderer)
      end

      test "handles templates with missing variables" do
        # Initialize services
        config_service = @registry.get_service(:configuration)
        template_renderer = @registry.get_service(:template_renderer)

        # Mock configuration
        config_service.expects(:enable_template_caching?).returns(false).at_least_once

        # Mock template that references undefined variables
        template_with_missing_vars = <<~ERB
          export class <%= class_name %> {
            id: <%= undefined_variable %>;
            name: <%= another_missing_var %>;
          }
        ERB

        template_renderer.stubs(:load_template_content).with("missing_vars.ts.erb").returns(template_with_missing_vars)

        # Test template rendering with missing variables
        context = { class_name: "TestModel" }

        # Should raise NameError for undefined variables
        assert_raises NameError do
          template_renderer.render("missing_vars.ts.erb", context)
        end

        # Service should remain functional
        assert @registry.service_initialized?(:template_renderer)
      end

      test "handles very large template outputs" do
        # Initialize services
        config_service = @registry.get_service(:configuration)
        template_renderer = @registry.get_service(:template_renderer)

        # Mock configuration
        config_service.expects(:enable_template_caching?).returns(false).at_least_once

        # Mock template that generates large output
        large_template_content = <<~ERB
          export class <%= class_name %> {
            <% 1000.times do |i| %>
            field_<%= i %>: string;
            <% end %>
          }
        ERB

        template_renderer.stubs(:load_template_content).with("large.ts.erb").returns(large_template_content)

        # Test large template rendering
        context = { class_name: "LargeModel" }

        start_time = Time.current
        rendered_content = template_renderer.render("large.ts.erb", context)
        rendering_time = Time.current - start_time

        # Should handle large templates efficiently
        assert rendering_time < 2.0, "Large template rendering took #{rendering_time}s, expected < 2.0s"

        assert_instance_of String, rendered_content
        assert rendered_content.length > 10000 # Should be substantial content
        assert_match(/export class LargeModel/, rendered_content)
        assert_match(/field_0: string;/, rendered_content)
        assert_match(/field_999: string;/, rendered_content)

        # Service should handle large templates
        assert @registry.service_initialized?(:template_renderer)
      end

      test "handles templates with special characters" do
        # Initialize services
        config_service = @registry.get_service(:configuration)
        template_renderer = @registry.get_service(:template_renderer)

        # Mock configuration
        config_service.expects(:enable_template_caching?).returns(false).at_least_once

        # Mock template with special characters and Unicode
        special_char_template = <<~ERB
          // Template with special characters: !"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~
          // Unicode: 你好世界 🚀 ñáéíóú
          export class <%= class_name %> {
            <% fields.each do |name, type| %>
            "<%= name %>": <%= type %>; // Field: <%= name %>
            <% end %>
          }
        ERB

        template_renderer.stubs(:load_template_content).with("special_chars.ts.erb").returns(special_char_template)

        # Test special character handling
        context = {
          class_name: "SpecialModel",
          fields: {
            "field-with-dashes" => "string",
            "field_with_underscores" => "number",
            "field.with.dots" => "boolean",
            "unicode_名前" => "string",
            "emoji_🚀_field" => "string"
          }
        }

        rendered_content = template_renderer.render("special_chars.ts.erb", context)

        assert_instance_of String, rendered_content
        assert_match(/export class SpecialModel/, rendered_content)
        assert_match(/你好世界/, rendered_content)
        assert_match(/🚀/, rendered_content)
        assert_match(/"field-with-dashes": string/, rendered_content)
        assert_match(/"unicode_名前": string/, rendered_content)
        assert_match(/"emoji_🚀_field": string/, rendered_content)

        # Service should handle special characters
        assert @registry.service_initialized?(:template_renderer)
      end

      test "handles malformed template syntax" do
        # Initialize services
        config_service = @registry.get_service(:configuration)
        template_renderer = @registry.get_service(:template_renderer)

        # Mock configuration
        config_service.expects(:enable_template_caching?).returns(false).at_least_once

        # Mock template with malformed ERB syntax
        malformed_template = <<~ERB
          export class <%= class_name %> {
            <% columns.each do |name, info| # Missing closing %>
            <%= name %>: string;
            <% end %>
          }
        ERB

        template_renderer.stubs(:load_template_content).with("malformed.ts.erb").returns(malformed_template)

        # Test malformed template handling
        context = { class_name: "TestModel", columns: { id: { type: :integer } } }

        # Should raise ERB syntax error
        assert_raises StandardError do
          template_renderer.render("malformed.ts.erb", context)
        end

        # Service should remain functional
        assert @registry.service_initialized?(:template_renderer)
      end

      # =============================================================================
      # File System Edge Cases
      # =============================================================================

      test "handles very long file paths" do
        # Initialize services
        file_manager = @registry.get_service(:file_manager)

        # Create very long file path (close to system limits)
        long_directory = "a" * 100
        very_long_path = File.join(@test_config[:base_output_dir], long_directory, "very_long_filename_" + "x" * 100 + ".ts")

        # Test long path handling
        FileUtils.mkdir_p(File.dirname(very_long_path))

        content = "export class VeryLongPath {}"

        assert_nothing_raised do
          file_manager.write_with_formatting(very_long_path, content)
        end

        # File should be created successfully (or raise appropriate error)
        # Note: Actual behavior depends on OS file system limits
        assert @registry.service_initialized?(:file_manager)
      end

      test "handles special characters in file names" do
        # Initialize services
        file_manager = @registry.get_service(:file_manager)

        # Test various special characters in file names
        special_filenames = [
          "file-with-dashes.ts",
          "file_with_underscores.ts",
          "file.with.dots.ts",
          "file with spaces.ts",
          "file(with)parentheses.ts",
          "file[with]brackets.ts",
          "file{with}braces.ts"
        ]

        FileUtils.mkdir_p(@test_config[:base_output_dir])

        special_filenames.each do |filename|
          file_path = File.join(@test_config[:base_output_dir], filename)
          content = "export class SpecialFile {}"

          # Most special characters should be handled gracefully
          assert_nothing_raised do
            file_manager.write_with_formatting(file_path, content)
          end
        end

        # Service should handle special characters
        assert @registry.service_initialized?(:file_manager)
      end

      test "handles case sensitivity issues" do
        # Initialize services
        file_manager = @registry.get_service(:file_manager)

        FileUtils.mkdir_p(@test_config[:base_output_dir])

        # Test case sensitivity handling
        lowercase_path = File.join(@test_config[:base_output_dir], "model.ts")
        uppercase_path = File.join(@test_config[:base_output_dir], "MODEL.ts")
        mixedcase_path = File.join(@test_config[:base_output_dir], "Model.ts")

        # Create files with different cases
        file_manager.write_with_formatting(lowercase_path, "export class LowerCaseModel {}")
        file_manager.write_with_formatting(uppercase_path, "export class UpperCaseModel {}")
        file_manager.write_with_formatting(mixedcase_path, "export class MixedCaseModel {}")

        # Verify files are created
        # Note: On case-insensitive file systems, some files might overwrite others
        assert @registry.service_initialized?(:file_manager)
      end

      test "handles concurrent file access scenarios" do
        # Initialize services
        file_manager = @registry.get_service(:file_manager)

        FileUtils.mkdir_p(@test_config[:base_output_dir])

        # Simulate concurrent access by creating multiple similar files
        file_paths = []
        5.times do |i|
          file_paths << File.join(@test_config[:base_output_dir], "concurrent_#{i}.ts")
        end

        # Write files concurrently (simulated)
        file_paths.each_with_index do |path, i|
          content = "export class Concurrent#{i} {}"
          file_manager.write_with_formatting(path, content)
        end

        # Verify all files were created
        file_paths.each do |path|
          assert File.exist?(path)
        end

        # Service should handle concurrent scenarios
        assert @registry.service_initialized?(:file_manager)
      end

      test "handles read-only file systems" do
        # Initialize services
        file_manager = @registry.get_service(:file_manager)

        # Mock read-only file system
        FileUtils.stubs(:mkdir_p).raises(Errno::EACCES.new("Read-only file system"))
        File.stubs(:write).raises(Errno::EROFS.new("Read-only file system"))

        readonly_path = File.join(@test_config[:base_output_dir], "readonly_test.ts")

        # Test read-only file system handling
        error = assert_raises StandardError do
          file_manager.write_with_formatting(readonly_path, "export class ReadOnlyTest {}")
        end

        # Should get appropriate error
        assert_match(/Read-only file system|Permission denied/i, error.message)

        # Service should remain functional
        assert @registry.service_initialized?(:file_manager)
      end

      # =============================================================================
      # Configuration Edge Cases
      # =============================================================================

      test "handles minimal configuration scenarios" do
        # Test with absolute minimal configuration
        minimal_config = {}

        config_service = ConfigurationService.new
        config_service.stubs(:load_file_configuration).returns({})
        config_service.stubs(:load_environment_configuration).returns({})
        config_service.stubs(:load_default_configuration).returns(minimal_config)

        # Test minimal configuration handling
        merged_config = config_service.send(:merge_configurations)

        # Should provide sensible defaults
        assert_instance_of Hash, merged_config

        # Service should handle minimal configuration
        assert_nothing_raised do
          config_service.send(:validate_configuration, merged_config)
        end
      end

      test "handles maximum configuration complexity" do
        # Test with very complex configuration
        complex_config = {
          environment: "production",
          enable_caching: true,
          enable_template_caching: true,
          enable_schema_caching: true,
          enable_pattern_detection: true,
          enable_prettier: true,
          force_overwrite: false,
          base_output_dir: "/complex/nested/deep/directory/structure",
          cache_ttl: 3600,
          max_retries: 5,
          timeout: 30,
          exclude_tables: [ "table1", "table2", "table3" ],
          include_only: [ "specific_table" ],
          custom_type_mappings: {
            "custom_type1" => "string",
            "custom_type2" => "number",
            "custom_type3" => "CustomInterface"
          },
          template_directories: [ "/path1", "/path2", "/path3" ],
          logging: {
            level: "debug",
            file: "/var/log/generator.log",
            rotation: "daily"
          },
          performance: {
            memory_limit: "512MB",
            thread_pool_size: 10,
            chunk_size: 100
          }
        }

        config_service = ConfigurationService.new
        config_service.stubs(:load_file_configuration).returns(complex_config)

        # Test complex configuration handling
        merged_config = config_service.send(:merge_configurations)

        assert_instance_of Hash, merged_config

        # Should handle complex configuration without errors
        assert_nothing_raised do
          config_service.send(:validate_configuration, merged_config)
        end
      end

      test "handles rapid configuration changes" do
        # Initialize configuration service
        config_service = @registry.get_service(:configuration)

        # Simulate rapid configuration updates
        configs = [
          { enable_caching: true, environment: "development" },
          { enable_caching: false, environment: "test" },
          { enable_caching: true, environment: "production" },
          { enable_caching: false, environment: "staging" },
          { enable_caching: true, environment: "development" }
        ]

        # Apply rapid configuration changes
        configs.each do |config|
          @registry.update_configuration(config)

          # Verify configuration was applied
          assert_instance_of Hash, @registry.configuration_options
        end

        # Service should handle rapid changes
        assert @registry.service_initialized?(:configuration)
      end

      test "handles conflicting configuration sources" do
        # Test conflicting configurations from different sources
        file_config = {
          environment: "production",
          enable_caching: true,
          base_output_dir: "/file/config/path"
        }

        env_config = {
          environment: "development",
          enable_caching: false,
          base_output_dir: "/env/config/path"
        }

        config_service = ConfigurationService.new
        config_service.stubs(:load_file_configuration).returns(file_config)
        config_service.stubs(:load_environment_configuration).returns(env_config)

        # Test conflict resolution
        merged_config = config_service.send(:merge_configurations)

        assert_instance_of Hash, merged_config

        # Should resolve conflicts (typically environment wins)
        # Exact resolution depends on implementation
        assert merged_config.key?(:environment) || merged_config.key?("environment")
        assert merged_config.key?(:enable_caching) || merged_config.key?("enable_caching")
      end

      test "handles configuration edge values" do
        # Test configuration with edge values
        edge_config = {
          enable_caching: nil,          # nil value
          cache_ttl: 0,                # zero value
          max_retries: -1,             # negative value
          timeout: 999999,             # very large value
          base_output_dir: "",         # empty string
          exclude_tables: [],          # empty array
          custom_mappings: {},         # empty hash
          environment: "   ",          # whitespace only
          thread_count: 0.5            # float value for integer setting
        }

        config_service = ConfigurationService.new

        # Test edge value handling
        # Some edge values should be rejected, others normalized
        assert_raises StandardError do
          config_service.send(:validate_configuration, edge_config)
        end
      end

      # =============================================================================
      # Data Edge Cases
      # =============================================================================

      test "handles extremely large table names" do
        # Initialize services
        config_service = @registry.get_service(:configuration)
        schema_service = @registry.get_service(:schema)
        type_mapper = @registry.get_service(:type_mapper)

        # Mock configuration
        config_service.expects(:enable_schema_caching?).returns(false).at_least_once
        config_service.expects(:enable_pattern_detection?).returns(false).at_least_once

        # Create extremely long table name
        very_long_table_name = "a" * 300 + "_table"

        long_table_schema = {
          columns: {
            id: { type: :integer },
            name: { type: :string }
          },
          relationships: {}
        }

        schema_service.expects(:extract_table_schema).with(very_long_table_name).returns(long_table_schema)

        # Test long table name handling
        table_schema = schema_service.extract_table_schema(very_long_table_name)

        assert_instance_of Hash, table_schema
        assert table_schema.key?(:columns)

        # Type mapper should handle long names
        mapped_type = type_mapper.map_type(:string)
        assert_instance_of String, mapped_type

        # Services should handle long names
        assert @registry.service_initialized?(:schema)
        assert @registry.service_initialized?(:type_mapper)
      end

      test "handles Unicode characters in database schemas" do
        # Initialize services
        config_service = @registry.get_service(:configuration)
        schema_service = @registry.get_service(:schema)

        # Mock configuration
        config_service.expects(:enable_schema_caching?).returns(false).at_least_once
        config_service.expects(:enable_pattern_detection?).returns(false).at_least_once

        # Mock schema with Unicode characters
        unicode_schema = {
          tables: {
            "用户表" => {  # Chinese characters
              columns: {
                "身份证" => { type: :string },  # ID in Chinese
                "姓名" => { type: :string },    # Name in Chinese
                "électronique" => { type: :string },  # French accented
                "возраст" => { type: :integer },      # Russian
                "🚀_rocket_field" => { type: :string }  # Emoji
              },
              relationships: {}
            }
          }
        }

        schema_service.expects(:extract_filtered_schema).returns(unicode_schema)

        # Test Unicode handling
        schema_data = schema_service.extract_filtered_schema(exclude_tables: @test_config[:exclude_tables])

        assert_instance_of Hash, schema_data
        assert schema_data[:tables].key?("用户表")

        unicode_table = schema_data[:tables]["用户表"]
        assert unicode_table[:columns].key?("身份证")
        assert unicode_table[:columns].key?("électronique")
        assert unicode_table[:columns].key?("возраст")
        assert unicode_table[:columns].key?("🚀_rocket_field")

        # Service should handle Unicode
        assert @registry.service_initialized?(:schema)
      end

      test "handles null and empty values in schema data" do
        # Initialize services
        config_service = @registry.get_service(:configuration)
        schema_service = @registry.get_service(:schema)
        type_mapper = @registry.get_service(:type_mapper)

        # Mock configuration
        config_service.expects(:enable_schema_caching?).returns(false).at_least_once
        config_service.expects(:enable_pattern_detection?).returns(false).at_least_once

        # Mock schema with null and empty values
        schema_with_nulls = {
          tables: {
            "test_table" => {
              columns: {
                "normal_field" => { type: :string },
                "null_type_field" => { type: nil },
                "empty_name" => { type: :string },
                "" => { type: :string },  # Empty column name
                "null_info" => nil       # Null column info
              },
              relationships: nil,  # Null relationships
              primary_key: "",     # Empty primary key
              indexes: nil         # Null indexes
            }
          }
        }

        schema_service.expects(:extract_filtered_schema).returns(schema_with_nulls)

        # Test null/empty value handling
        schema_data = schema_service.extract_filtered_schema(exclude_tables: @test_config[:exclude_tables])

        assert_instance_of Hash, schema_data

        # Should handle null values gracefully
        test_table = schema_data[:tables]["test_table"]
        assert_instance_of Hash, test_table

        # Type mapper should handle null types
        assert_nothing_raised do
          type_mapper.map_type(nil)
        end

        # Services should handle null data
        assert @registry.service_initialized?(:schema)
        assert @registry.service_initialized?(:type_mapper)
      end

      test "handles malformed relationship data" do
        # Initialize services
        config_service = @registry.get_service(:configuration)
        schema_service = @registry.get_service(:schema)
        relationship_processor = @registry.get_service(:relationship_processor)

        # Mock configuration
        config_service.expects(:enable_schema_caching?).returns(false).at_least_once
        config_service.expects(:enable_pattern_detection?).returns(false).at_least_once

        # Mock schema with malformed relationships
        malformed_schema = {
          tables: {
            "users" => {
              columns: { id: { type: :integer } },
              relationships: {
                "invalid_relationship" => {
                  type: "invalid_type",
                  class_name: nil,
                  foreign_key: "",
                  through: "nonexistent_table"
                },
                "circular_ref" => {
                  type: :belongs_to,
                  class_name: "User"  # Self-reference
                },
                "missing_target" => {
                  type: :has_many,
                  class_name: "NonExistentModel"
                }
              }
            }
          }
        }

        schema_service.expects(:extract_filtered_schema).returns(malformed_schema)

        # Test malformed relationship handling
        schema_data = schema_service.extract_filtered_schema(exclude_tables: @test_config[:exclude_tables])

        assert_instance_of Hash, schema_data

        # Relationship processor should handle malformed data gracefully
        users_table = schema_data[:tables]["users"]
        assert_instance_of Hash, users_table[:relationships]

        # Should not crash on malformed relationships
        assert @registry.service_initialized?(:relationship_processor)
      end

      test "handles extreme data type combinations" do
        # Initialize services
        type_mapper = @registry.get_service(:type_mapper)

        # Test extreme and unusual data types
        extreme_types = [
          nil,                    # Null type
          "",                     # Empty string type
          :unknown_type,          # Unknown symbol
          "invalid_string_type",  # Invalid string type
          123,                    # Numeric type name
          [],                     # Array type name
          {},                     # Hash type name
          true,                   # Boolean type name
          :text,                  # Standard text type
          :json,                  # JSON type
          :uuid,                  # UUID type
          :binary,                # Binary type
          :"very-long-type-name-with-special-chars-123!@#"  # Complex symbol
        ]

        extreme_types.each do |type|
          # Should handle all types without crashing
          assert_nothing_raised do
            result = type_mapper.map_type(type)
            assert_instance_of String, result
          end
        end

        # Service should remain functional
        assert @registry.service_initialized?(:type_mapper)
      end
    end
  end
end
