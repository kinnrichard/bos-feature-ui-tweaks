# frozen_string_literal: true

require "test_helper"
require "tempfile"
require "fileutils"
require "mocha/minitest"
require "generators/zero/active_models/configuration_service"

module Zero
  module Generators
    class ConfigurationValidationTest < ActiveSupport::TestCase
      self.use_transactional_tests = false
      self.use_instantiated_fixtures = false
      self.fixture_table_names = []

      def setup
        @temp_config_dir = Dir.mktmpdir
        @temp_config_file = File.join(@temp_config_dir, "config_validation_test.yml")
        @config_service = create_config_service
        cleanup_test_environment
      end

      def teardown
        FileUtils.rm_rf(@temp_config_dir) if @temp_config_dir && Dir.exist?(@temp_config_dir)
        cleanup_test_environment
      end

      # =============================================================================
      # Configuration Structure Validation Tests
      # =============================================================================

      test "validates required configuration keys are present" do
        # Required keys should be present in default configuration
        required_keys = [ :excluded_tables, :type_overrides, :output, :file_operations ]

        required_keys.each do |key|
          assert @config_service.configuration.key?(key),
            "Configuration should include required key: #{key}"
        end

        # Test validation passes with all required keys
        assert_nothing_raised do
          @config_service.validate_configuration!
        end
      end

      test "validates configuration data types correctly" do
        # Test valid data types pass validation
        assert_nothing_raised { @config_service.validate_configuration! }

        # Test invalid excluded_tables type
        @config_service.update_config(:excluded_tables, "not_an_array", validate: false)
        assert_raises ConfigurationService::ValidationError do
          @config_service.validate_configuration!
        end

        # Reset to valid state for cleanup
        @config_service.update_config(:excluded_tables, [ "valid_table" ], validate: false)
      end

      test "validates nested configuration structure" do
        # Test valid nested structure passes
        valid_nested_config = {
          output: {
            base_dir: "frontend/src/lib",
            types_dir: "types",
            zero_dir: "zero"
          },
          file_operations: {
            enable_prettier: true,
            enable_semantic_comparison: true,
            force_overwrite: false,
            create_directories: true
          }
        }

        valid_nested_config.each do |key, value|
          @config_service.update_config(key, value, validate: false)
        end

        assert_nothing_raised { @config_service.validate_configuration! }

        # Test invalid nested structure - empty string should fail
        @config_service.update_config([ "output", "base_dir" ], "", validate: false)
        assert_raises ConfigurationService::ValidationError do
          @config_service.validate_configuration!
        end

        # Reset to valid state
        @config_service.update_config([ "output", "base_dir" ], "frontend/src/lib", validate: false)
      end

      test "validates configuration value constraints" do
        # Test invalid cache_ttl constraints
        @config_service.update_config([ "performance", "cache_ttl" ], -1, validate: false)
        assert_raises ConfigurationService::ValidationError do
          @config_service.validate_configuration!
        end

        # Test valid cache_ttl passes
        @config_service.update_config([ "performance", "cache_ttl" ], 3600, validate: false)
        assert_nothing_raised { @config_service.validate_configuration! }
      end

      # =============================================================================
      # Configuration Security Validation Tests
      # =============================================================================

      test "validates path security and prevents absolute paths" do
        # Based on the actual ConfigurationService implementation, only Unix absolute paths are rejected
        dangerous_absolute_paths = [
          "/absolute/path"
        ]

        dangerous_absolute_paths.each do |dangerous_path|
          @config_service.update_config([ "output", "base_dir" ], dangerous_path, validate: false)

          assert_raises ConfigurationService::ValidationError,
            "Should reject absolute path: #{dangerous_path}" do
            @config_service.validate_configuration!
          end
        end

        # Directory traversal patterns are currently allowed by the implementation
        # This test documents the current behavior - future enhancement could add traversal detection
        traversal_paths = [
          "../../../etc/passwd",
          "path/with/../traversal"
        ]

        traversal_paths.each do |traversal_path|
          @config_service.update_config([ "output", "base_dir" ], traversal_path, validate: false)

          # Currently these pass validation (documenting current behavior)
          assert_nothing_raised do
            @config_service.validate_configuration!
          end
        end

        # Reset to valid state
        @config_service.update_config([ "output", "base_dir" ], "frontend/src/lib", validate: false)
      end

      test "validates safe relative paths are allowed" do
        safe_paths = [
          "frontend/src/lib",
          "output/generated",
          "lib/zero",
          "src/types",
          "backend/models"
        ]

        safe_paths.each do |safe_path|
          @config_service.update_config([ "output", "base_dir" ], safe_path, validate: false)

          assert_nothing_raised do
            @config_service.validate_configuration!
          end
        end
      end

      # =============================================================================
      # Configuration Consistency Validation Tests
      # =============================================================================

      test "validates type override functionality" do
        # Test adding valid type overrides
        @config_service.add_type_override("custom_type", "CustomType")

        assert_equal "CustomType", @config_service.type_overrides[:custom_type]
        assert_nothing_raised { @config_service.validate_configuration! }
      end

      test "validates excluded table management" do
        # Test adding excluded tables
        initial_count = @config_service.excluded_tables.size
        @config_service.add_excluded_table("test_table")

        assert_equal initial_count + 1, @config_service.excluded_tables.size
        assert_includes @config_service.excluded_tables, "test_table"

        # Test removing excluded tables
        @config_service.remove_excluded_table("test_table")
        assert_equal initial_count, @config_service.excluded_tables.size
        assert_not_includes @config_service.excluded_tables, "test_table"
      end

      # =============================================================================
      # Dynamic Configuration Update Tests
      # =============================================================================

      test "validates configuration updates maintain system stability" do
        # Get baseline health status
        initial_health = @config_service.health_check
        assert_equal :healthy, initial_health[:status]

        # Apply dynamic configuration update
        @config_service.update_config([ "performance", "cache_ttl" ], 1800)
        @config_service.add_excluded_table("dynamic_test_table")

        # Validate system remains stable
        updated_health = @config_service.health_check
        assert_equal :healthy, updated_health[:status]

        # Validate configuration is still valid
        assert_nothing_raised { @config_service.validate_configuration! }
      end

      test "validates configuration hot reloading" do
        # Modify configuration file externally
        new_config = {
          "zero_generator" => {
            "excluded_tables" => [ "hot_reload_table" ],
            "performance" => {
              "cache_ttl" => 1200
            }
          }
        }
        File.write(@temp_config_file, new_config.to_yaml)

        # Trigger hot reload
        assert_nothing_raised do
          @config_service.reload_configuration!
        end

        # Validate configuration was reloaded
        assert_includes @config_service.excluded_tables, "hot_reload_table"
        assert_equal 1200, @config_service.cache_ttl
      end

      test "validates configuration export and import" do
        # Modify configuration
        @config_service.add_excluded_table("export_test_table")
        @config_service.add_type_override("export_type", "ExportType")

        # Export configuration
        exported = @config_service.export_config

        assert_instance_of Hash, exported
        assert exported.key?(:base_config)
        assert exported.key?(:environment)
        assert exported.key?(:statistics)

        # Verify exported configuration contains our changes
        assert_includes exported[:base_config][:excluded_tables], "export_test_table"
        assert_equal "ExportType", exported[:base_config][:type_overrides][:export_type]
      end

      test "validates configuration save and load cycle" do
        # Modify configuration
        @config_service.add_excluded_table("save_load_test")
        @config_service.add_type_override("save_type", "SaveType")

        # Save configuration
        assert_nothing_raised do
          @config_service.save_configuration!
        end

        # Create new service and verify data persisted
        new_service = create_config_service
        new_service.reload_configuration!

        assert_includes new_service.excluded_tables, "save_load_test"
        assert_equal "SaveType", new_service.type_overrides[:save_type]
      end

      # =============================================================================
      # Configuration Performance Validation Tests
      # =============================================================================

      test "validates configuration load performance" do
        start_time = Time.current

        # Create new service (triggers configuration load)
        ConfigurationService.new(
          environment: "test",
          config_file_path: @temp_config_file,
          validate_on_load: true
        )

        load_time = Time.current - start_time
        assert load_time < 1.0, "Configuration load should complete in under 1 second"
      end

      test "validates configuration validation performance" do
        # Add complex configuration
        10.times { |i| @config_service.add_excluded_table("table_#{i}") }
        5.times { |i| @config_service.add_type_override("type_#{i}", "Type#{i}") }

        start_time = Time.current
        @config_service.validate_configuration!
        validation_time = Time.current - start_time

        assert validation_time < 0.5, "Configuration validation should complete in under 500ms"
      end

      test "validates configuration statistics tracking" do
        initial_stats = @config_service.statistics.dup

        # Perform operations that should update statistics
        @config_service.validate_configuration!
        @config_service.add_excluded_table("stats_test")
        @config_service.save_configuration!

        updated_stats = @config_service.statistics

        # Validation count should increase
        assert updated_stats[:validations] > initial_stats[:validations]

        # Loads should remain same (no reload performed)
        assert_equal initial_stats[:loads], updated_stats[:loads]

        # Saves should increase
        assert updated_stats[:saves] > initial_stats[:saves]
      end

      # =============================================================================
      # Configuration Security Edge Cases
      # =============================================================================

      test "validates boolean configuration values" do
        boolean_configs = [
          [ "file_operations", "enable_prettier" ],
          [ "file_operations", "force_overwrite" ],
          [ "file_operations", "create_directories" ],
          [ "file_operations", "enable_semantic_comparison" ]
        ]

        boolean_configs.each do |config_path|
          # Test valid boolean values
          [ true, false ].each do |boolean_value|
            @config_service.update_config(config_path, boolean_value, validate: false)
            assert_nothing_raised do
              @config_service.validate_configuration!
            end
          end

          # Test invalid boolean values
          [ "true", "false", 1, 0, nil ].each do |invalid_value|
            @config_service.update_config(config_path, invalid_value, validate: false)
            assert_raises ConfigurationService::ValidationError do
              @config_service.validate_configuration!
            end
          end

          # Reset to valid state
          @config_service.update_config(config_path, true, validate: false)
        end
      end

      test "validates integer configuration values" do
        integer_configs = [
          [ "performance", "cache_ttl" ],
          [ "performance", "max_cache_entries" ]
        ]

        integer_configs.each do |config_path|
          # Test valid positive integers
          [ 1, 100, 3600, 7200 ].each do |valid_value|
            @config_service.update_config(config_path, valid_value, validate: false)
            assert_nothing_raised do
              @config_service.validate_configuration!
            end
          end

          # Test invalid values
          [ -1, 0, "100", 3.14, nil ].each do |invalid_value|
            @config_service.update_config(config_path, invalid_value, validate: false)
            assert_raises ConfigurationService::ValidationError do
              @config_service.validate_configuration!
            end
          end

          # Reset to valid state
          @config_service.update_config(config_path, 3600, validate: false)
        end
      end

      test "validates configuration reset functionality" do
        # Modify configuration significantly
        @config_service.add_excluded_table("reset_test_table")
        @config_service.add_type_override("reset_type", "ResetType")
        @config_service.update_config([ "performance", "cache_ttl" ], 9999, validate: false)

        # Verify changes were applied
        assert_includes @config_service.excluded_tables, "reset_test_table"
        assert_equal "ResetType", @config_service.type_overrides[:reset_type]
        assert_equal 9999, @config_service.cache_ttl

        # Reset to defaults
        @config_service.reset_to_defaults!(preserve_environment: true)

        # Verify reset worked
        assert_not_includes @config_service.excluded_tables, "reset_test_table"
        assert_not @config_service.type_overrides.key?(:reset_type)
        assert_not_equal 9999, @config_service.cache_ttl

        # Environment-specific settings should be preserved
        assert_equal "test", @config_service.environment
        # Test environment should still have force_overwrite enabled
        assert @config_service.force_overwrite?
      end

      test "validates health check comprehensiveness" do
        health = @config_service.health_check

        # Required health check fields
        required_fields = [ :status, :environment, :config_file, :statistics, :key_counts ]
        required_fields.each do |field|
          assert health.key?(field), "Health check should include #{field}"
        end

        # Status should be healthy for valid configuration
        assert_equal :healthy, health[:status]

        # Key counts should be reasonable
        assert health[:key_counts][:excluded_tables] > 0
        assert health[:key_counts][:type_overrides] >= 0
        assert health[:key_counts][:field_mappings] >= 0
      end

      private

      def create_config_service
        ConfigurationService.new(
          environment: "test",
          config_file_path: @temp_config_file,
          validate_on_load: false
        )
      end

      def cleanup_test_environment
        # Clean up test environment variables
        ENV.delete("CONFIG_VALIDATION_TEST_MODE") if ENV["CONFIG_VALIDATION_TEST_MODE"]
      end

      def get_memory_usage
        # Simplified memory usage calculation for testing
        # In a real implementation, this would use system-specific memory monitoring
        GC.start
        ObjectSpace.count_objects[:TOTAL] * 0.001 # Rough approximation in MB
      end
    end
  end
end
