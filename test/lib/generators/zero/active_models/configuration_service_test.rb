# frozen_string_literal: true

require "test_helper"
require "tempfile"
require "fileutils"
require "mocha/minitest"
require "generators/zero/active_models/configuration_service"

module Zero
  module Generators
    class ConfigurationServiceTest < ActiveSupport::TestCase
      def setup
        @temp_config_dir = Dir.mktmpdir
        @temp_config_file = File.join(@temp_config_dir, "test_config.yml")
        @config_service = ConfigurationService.new(
          environment: "test",
          config_file_path: @temp_config_file,
          validate_on_load: false
        )
      end

      def teardown
        FileUtils.rm_rf(@temp_config_dir) if @temp_config_dir && Dir.exist?(@temp_config_dir)
      end

      # =============================================================================
      # Configuration Loading & Merging Tests
      # =============================================================================

      test "loads default configuration correctly" do
        assert_not_nil @config_service.configuration
        assert_instance_of Array, @config_service.excluded_tables
        assert_instance_of Hash, @config_service.type_overrides
        assert_instance_of Hash, @config_service.output_config
        assert_instance_of Hash, @config_service.field_mappings
      end

      test "merges file-based configuration with defaults" do
        # First test that type_overrides and output configs merge properly
        config_data = {
          "zero_generator" => {
            "type_overrides" => { "custom_type" => "string" },
            "output" => { "base_dir" => "custom/output" }
          }
        }
        File.write(@temp_config_file, config_data.to_yaml)

        # Create new service that will load the file
        service = ConfigurationService.new(
          environment: "test",
          config_file_path: @temp_config_file,
          validate_on_load: false
        )

        # These should be merged correctly
        assert_equal "string", service.type_overrides[:custom_type]
        assert_equal "custom/output", service.base_output_dir

        # Default excluded tables should still be present since we didn't override them
        assert_includes service.excluded_tables, "schema_migrations"

        # Test that we can also read the type override correctly
        assert_instance_of Hash, service.type_overrides
      end

      test "applies environment-specific overrides" do
        # Test development environment
        dev_service = ConfigurationService.new(
          environment: "development",
          config_file_path: @temp_config_file,
          validate_on_load: false
        )
        assert dev_service.enable_template_caching?
        assert dev_service.enable_prettier?

        # Test production environment
        prod_service = ConfigurationService.new(
          environment: "production",
          config_file_path: @temp_config_file,
          validate_on_load: false
        )
        assert prod_service.enable_template_caching?
        assert_equal 7200, prod_service.cache_ttl

        # Test test environment
        test_service = ConfigurationService.new(
          environment: "test",
          config_file_path: @temp_config_file,
          validate_on_load: false
        )
        assert_not test_service.enable_template_caching?
        assert_not test_service.enable_prettier?
        assert test_service.force_overwrite?
      end

      test "handles missing configuration files gracefully" do
        non_existent_file = File.join(@temp_config_dir, "nonexistent.yml")

        assert_nothing_raised do
          service = ConfigurationService.new(
            environment: "test",
            config_file_path: non_existent_file,
            validate_on_load: false
          )
          assert_not_nil service.configuration
        end
      end

      # =============================================================================
      # Configuration Validation Tests
      # =============================================================================

      test "validates required configuration keys" do
        # Should pass with default configuration
        assert_nothing_raised do
          @config_service.validate_configuration!
        end

        # Remove a required key and test validation failure
        @config_service.configuration.delete(:excluded_tables)
        assert_raises ConfigurationService::ValidationError do
          @config_service.validate_configuration!
        end
      end

      test "validates data types for all configuration values" do
        # Test invalid excluded_tables type
        @config_service.update_config(:excluded_tables, "not_an_array", validate: false)
        assert_raises ConfigurationService::ValidationError do
          @config_service.validate_configuration!
        end

        # Test invalid boolean values
        @config_service.update_config("file_operations.enable_prettier", "not_a_boolean", validate: false)
        assert_raises ConfigurationService::ValidationError do
          @config_service.validate_configuration!
        end
      end

      test "provides detailed validation error messages" do
        @config_service.update_config(:excluded_tables, nil, validate: false)

        error = assert_raises ConfigurationService::ValidationError do
          @config_service.validate_configuration!
        end

        assert_match /excluded_tables must be an array/, error.message
      end

      test "validates path configurations for security" do
        # Test absolute path rejection
        @config_service.update_config("output.base_dir", "/absolute/path", validate: false)

        error = assert_raises ConfigurationService::ValidationError do
          @config_service.validate_configuration!
        end

        assert_match /should be relative/, error.message
      end

      # =============================================================================
      # Dynamic Configuration Updates Tests
      # =============================================================================

      test "updates configuration values dynamically" do
        original_tables = @config_service.excluded_tables.dup
        @config_service.add_excluded_table("new_table")

        assert_includes @config_service.excluded_tables, "new_table"
        assert_not_equal original_tables, @config_service.excluded_tables
      end

      test "persists configuration changes to file" do
        @config_service.add_type_override("custom_type", "CustomType")
        @config_service.save_configuration!

        # Load from file and verify persistence
        new_service = ConfigurationService.new(
          environment: "test",
          config_file_path: @temp_config_file,
          validate_on_load: false
        )

        assert_equal "CustomType", new_service.type_overrides[:custom_type]
      end

      test "validates configuration before applying updates" do
        # Test with validate: false first to confirm value gets set
        @config_service.update_config(:excluded_tables, "invalid_type", validate: false)
        assert_equal "invalid_type", @config_service.configuration[:excluded_tables]

        # Now test validation fails when trying to validate
        assert_raises ConfigurationService::ValidationError do
          @config_service.validate_configuration!
        end

        # Reset to valid state
        @config_service.update_config(:excluded_tables, [ "valid_table" ], validate: false)
        assert_nothing_raised do
          @config_service.validate_configuration!
        end
      end

      # =============================================================================
      # Environment-Specific Behavior Tests
      # =============================================================================

      test "applies development environment optimizations" do
        dev_service = ConfigurationService.new(
          environment: "development",
          config_file_path: @temp_config_file,
          validate_on_load: false
        )

        assert dev_service.enable_template_caching?
        assert_equal "detailed", dev_service.template_error_handling
        assert dev_service.enable_prettier?
      end

      test "applies production environment security settings" do
        prod_service = ConfigurationService.new(
          environment: "production",
          config_file_path: @temp_config_file,
          validate_on_load: false
        )

        assert prod_service.enable_template_caching?
        assert_equal "minimal", prod_service.template_error_handling
        assert_equal 7200, prod_service.cache_ttl
      end

      test "applies test environment isolation settings" do
        test_service = ConfigurationService.new(
          environment: "test",
          config_file_path: @temp_config_file,
          validate_on_load: false
        )

        assert_not test_service.enable_template_caching?
        assert_not test_service.enable_schema_caching?
        assert test_service.force_overwrite?
      end

      test "handles environment switching correctly" do
        # Start with test environment
        assert_not @config_service.enable_template_caching?

        # Create new service with development environment
        dev_service = ConfigurationService.new(
          environment: "development",
          config_file_path: @temp_config_file,
          validate_on_load: false
        )

        assert dev_service.enable_template_caching?
      end

      # =============================================================================
      # Configuration Persistence Tests
      # =============================================================================

      test "saves configuration to YAML file correctly" do
        @config_service.add_excluded_table("test_table")
        @config_service.add_type_override("test_type", "TestType")

        assert_nothing_raised do
          @config_service.save_configuration!
        end

        assert File.exist?(@temp_config_file)

        # Verify YAML structure
        saved_config = YAML.load_file(@temp_config_file)
        assert saved_config.key?("zero_generator")
        assert saved_config.key?("environment")
        assert saved_config.key?("updated_at")
      end

      test "maintains configuration file format and structure" do
        @config_service.save_configuration!

        assert File.exist?(@temp_config_file)

        # Load raw YAML and verify structure
        raw_config = YAML.load_file(@temp_config_file)
        generator_config = raw_config["zero_generator"]

        assert_instance_of Hash, generator_config
        assert generator_config.key?(:excluded_tables)
        assert generator_config.key?(:output)
        assert generator_config.key?(:file_operations)
      end

      test "handles file write permissions and errors" do
        # Make directory read-only to simulate permission error
        File.chmod(0444, @temp_config_dir)

        begin
          assert_raises ConfigurationService::ConfigurationError do
            @config_service.save_configuration!
          end
        ensure
          # Restore permissions for cleanup
          File.chmod(0755, @temp_config_dir)
        end
      end

      test "creates configuration directories as needed" do
        nested_config_path = File.join(@temp_config_dir, "nested", "deep", "config.yml")

        service = ConfigurationService.new(
          environment: "test",
          config_file_path: nested_config_path,
          validate_on_load: false
        )

        service.save_configuration!

        assert File.exist?(nested_config_path)
        assert Dir.exist?(File.dirname(nested_config_path))
      end

      # =============================================================================
      # Performance & Caching Tests
      # =============================================================================

      test "tracks configuration access statistics" do
        # Create a fresh service to ensure clean statistics
        fresh_service = ConfigurationService.new(
          environment: "test",
          config_file_path: @temp_config_file,
          validate_on_load: false
        )

        # Should start with 1 load from initialization
        assert_equal 1, fresh_service.statistics[:loads]

        fresh_service.reload_configuration!

        # Should now have 2 loads
        assert_equal 2, fresh_service.statistics[:loads]
      end

      test "tracks validation statistics" do
        initial_validations = @config_service.statistics[:validations]

        @config_service.validate_configuration!

        assert_equal initial_validations + 1, @config_service.statistics[:validations]
      end

      test "tracks save operations" do
        initial_saves = @config_service.statistics[:saves]

        @config_service.save_configuration!

        assert_equal initial_saves + 1, @config_service.statistics[:saves]
      end

      # =============================================================================
      # Configuration Access Methods Tests
      # =============================================================================

      test "provides access to all configuration sections" do
        # Test direct access methods
        assert_instance_of Array, @config_service.excluded_tables
        assert_instance_of Hash, @config_service.type_overrides
        assert_instance_of Hash, @config_service.field_mappings
        assert_instance_of Hash, @config_service.output_config

        # Test boolean methods
        assert [ TrueClass, FalseClass ].include?(@config_service.enable_prettier?.class)
        assert [ TrueClass, FalseClass ].include?(@config_service.enable_semantic_comparison?.class)
        assert [ TrueClass, FalseClass ].include?(@config_service.create_directories?.class)

        # Test path methods
        assert_instance_of String, @config_service.base_output_dir
        assert_instance_of String, @config_service.types_dir
        assert_instance_of String, @config_service.zero_dir
      end

      test "table management methods work correctly" do
        original_count = @config_service.excluded_tables.size

        # Add table
        @config_service.add_excluded_table("new_test_table")
        assert_equal original_count + 1, @config_service.excluded_tables.size
        assert_includes @config_service.excluded_tables, "new_test_table"

        # Remove table
        @config_service.remove_excluded_table("new_test_table")
        assert_equal original_count, @config_service.excluded_tables.size
        assert_not_includes @config_service.excluded_tables, "new_test_table"
      end

      test "type override methods work correctly" do
        original_count = @config_service.type_overrides.size

        @config_service.add_type_override("custom_rails_type", "CustomTSType")
        assert_equal original_count + 1, @config_service.type_overrides.size
        assert_equal "CustomTSType", @config_service.type_overrides[:custom_rails_type]
      end

      # =============================================================================
      # Health Check Tests
      # =============================================================================

      test "health check returns comprehensive status" do
        health_status = @config_service.health_check

        assert_instance_of Hash, health_status
        assert health_status.key?(:status)
        assert health_status.key?(:environment)
        assert health_status.key?(:config_file)
        assert health_status.key?(:statistics)
        assert health_status.key?(:key_counts)

        assert_equal :healthy, health_status[:status]
        assert_equal "test", health_status[:environment]
      end

      test "health check reports configuration file status" do
        # Test with existing file
        @config_service.save_configuration!
        health_status = @config_service.health_check
        assert health_status[:config_exists]

        # Test with non-existent file
        FileUtils.rm(@temp_config_file)
        health_status = @config_service.health_check
        assert_not health_status[:config_exists]
      end

      test "health check includes key counts" do
        @config_service.add_excluded_table("test_table")
        @config_service.add_type_override("test_type", "TestType")

        health_status = @config_service.health_check
        key_counts = health_status[:key_counts]

        assert key_counts[:excluded_tables] > 0
        assert key_counts[:type_overrides] > 0
        assert_instance_of Integer, key_counts[:field_mappings]
      end

      # =============================================================================
      # Error Handling Tests
      # =============================================================================

      test "handles malformed YAML configuration files" do
        # Write invalid YAML
        File.write(@temp_config_file, "invalid: yaml: content:\n  - malformed")

        assert_raises ConfigurationService::ConfigurationError do
          ConfigurationService.new(
            environment: "test",
            config_file_path: @temp_config_file,
            validate_on_load: true
          )
        end
      end

      test "tracks error statistics" do
        initial_errors = @config_service.statistics[:errors]

        # Cause a validation error
        @config_service.update_config(:excluded_tables, "invalid", validate: false)
        assert_raises ConfigurationService::ValidationError do
          @config_service.validate_configuration!
        end

        assert_equal initial_errors + 1, @config_service.statistics[:errors]
      end

      test "reset to defaults works correctly" do
        # Modify configuration
        @config_service.add_excluded_table("custom_table")
        @config_service.add_type_override("custom_type", "CustomType")

        # Reset to defaults
        @config_service.reset_to_defaults!(preserve_environment: true)

        # Should not include custom modifications
        assert_not_includes @config_service.excluded_tables, "custom_table"
        assert_not @config_service.type_overrides.key?("custom_type")

        # Should still include default excluded tables
        assert_includes @config_service.excluded_tables, "schema_migrations"

        # Should preserve environment settings (test environment)
        assert_not @config_service.enable_template_caching?
      end

      test "export config provides complete configuration data" do
        exported = @config_service.export_config

        assert_instance_of Hash, exported
        assert exported.key?(:base_config)
        assert exported.key?(:environment)
        assert exported.key?(:environment_overrides)
        assert exported.key?(:statistics)

        assert_equal "test", exported[:environment]
        assert_instance_of Hash, exported[:base_config]
      end

      # =============================================================================
      # Edge Cases and Integration Tests
      # =============================================================================

      test "handles nested configuration updates" do
        @config_service.update_config("file_operations.enable_prettier", false)
        assert_not @config_service.enable_prettier?

        @config_service.update_config([ "output", "base_dir" ], "new/base/dir")
        assert_equal "new/base/dir", @config_service.base_output_dir
      end

      test "detects environment correctly when Rails is available" do
        # Mock Rails environment detection
        if defined?(Rails)
          Rails.expects(:env).returns("production")

          service = ConfigurationService.new(
            config_file_path: @temp_config_file,
            validate_on_load: false
          )
          assert_equal "production", service.environment
        else
          # Test fallback to ENV variables
          ENV["RAILS_ENV"] = "staging"
          service = ConfigurationService.new(
            config_file_path: @temp_config_file,
            validate_on_load: false
          )
          # Should use explicitly passed environment or detect from ENV
          assert_not_nil service.environment
        end
      end

      test "handles concurrent configuration access" do
        # This is a basic test for thread safety concerns
        # In a real scenario, you'd want more sophisticated concurrent testing
        threads = []
        results = []

        5.times do
          threads << Thread.new do
            service = ConfigurationService.new(
              environment: "test",
              config_file_path: @temp_config_file,
              validate_on_load: false
            )
            results << service.excluded_tables.size
          end
        end

        threads.each(&:join)

        # All threads should get consistent results
        assert results.all? { |size| size == results.first }
      end
    end
  end
end
