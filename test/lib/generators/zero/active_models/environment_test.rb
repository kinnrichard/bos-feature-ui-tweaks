# frozen_string_literal: true

require "test_helper"
require "tempfile"
require "fileutils"
require "mocha/minitest"
require "generators/zero/active_models/configuration_service"

module Zero
  module Generators
    class EnvironmentTest < ActiveSupport::TestCase
      self.use_transactional_tests = false
      self.use_instantiated_fixtures = false
      self.fixture_table_names = []

      def setup
        @temp_config_dir = Dir.mktmpdir
        @temp_config_file = File.join(@temp_config_dir, "environment_test_config.yml")
        cleanup_test_environment
      end

      def teardown
        FileUtils.rm_rf(@temp_config_dir) if @temp_config_dir && Dir.exist?(@temp_config_dir)
        cleanup_test_environment
      end

      # =============================================================================
      # Development Environment Tests
      # =============================================================================

      test "development environment enables debugging features" do
        config_service = create_config_service("development")

        # Development should enable debugging and helpful features
        assert config_service.enable_template_caching?,
          "Development should enable template caching for faster development"
        assert_equal "detailed", config_service.template_error_handling,
          "Development should provide detailed error messages"
        assert config_service.enable_prettier?,
          "Development should enable prettier for better code formatting"

        # Development should have helpful development-specific settings
        refute config_service.force_overwrite?,
          "Development should not force overwrite to prevent accidental data loss"
      end

      test "development environment template caching behavior" do
        config_service = create_config_service("development")

        # Development should cache templates but allow quick updates
        assert config_service.enable_template_caching?
        assert config_service.enable_schema_caching?

        # Cache should be optimized for development workflow
        assert config_service.cache_ttl >= 3600,
          "Development cache should have reasonable TTL"
      end

      test "development environment error handling" do
        config_service = create_config_service("development")

        # Development should provide detailed error information
        assert_equal "detailed", config_service.template_error_handling
      end

      test "development environment performance settings" do
        config_service = create_config_service("development")

        # Development should prioritize developer experience over performance
        assert config_service.enable_prettier?,
          "Development should enable prettier despite performance cost"
        assert config_service.enable_semantic_comparison?,
          "Development should enable semantic comparison for better diffs"
      end

      # =============================================================================
      # Production Environment Tests
      # =============================================================================

      test "production environment security optimizations" do
        config_service = create_config_service("production")

        # Production should prioritize security
        assert_equal "minimal", config_service.template_error_handling,
          "Production should minimize error information disclosure"
      end

      test "production environment performance optimizations" do
        config_service = create_config_service("production")

        # Production should optimize for performance
        assert config_service.enable_template_caching?
        assert config_service.enable_schema_caching?
        assert_equal 7200, config_service.cache_ttl,
          "Production should have long cache TTL for performance"

        # Production should keep prettier enabled based on actual config
        assert config_service.enable_prettier?,
          "Production should enable prettier based on actual configuration"
      end

      test "production environment uses appropriate settings" do
        config_service = create_config_service("production")

        # Production should have conservative defaults
        refute config_service.force_overwrite?
        assert config_service.enable_semantic_comparison?
      end

      # =============================================================================
      # Test Environment Tests
      # =============================================================================

      test "test environment isolation settings" do
        config_service = create_config_service("test")

        # Test environment should prioritize isolation and determinism
        refute config_service.enable_template_caching?,
          "Test environment should disable caching for consistency"
        refute config_service.enable_schema_caching?,
          "Test environment should disable schema caching for clean tests"

        # Test environment should force clean state
        assert config_service.force_overwrite?,
          "Test environment should force overwrite for clean test runs"
      end

      test "test environment debugging capabilities" do
        config_service = create_config_service("test")

        # Test environment should provide comprehensive debugging
        assert_equal "detailed", config_service.template_error_handling,
          "Test environment should provide detailed errors for debugging"
      end

      test "test environment performance settings" do
        config_service = create_config_service("test")

        # Test environment should disable performance optimizations for reliability
        refute config_service.enable_prettier?,
          "Test environment should disable prettier for faster test execution"
      end

      # =============================================================================
      # Environment Switching Tests
      # =============================================================================

      test "environment switching updates configuration correctly" do
        # Start with development
        dev_service = create_config_service("development")
        assert dev_service.enable_prettier?

        # Switch to production
        prod_service = create_config_service("production")
        assert prod_service.enable_prettier? # Production also enables prettier

        # Switch to test
        test_service = create_config_service("test")
        refute test_service.enable_prettier?
        assert test_service.force_overwrite?
      end

      test "environment switching preserves base configuration" do
        base_config = {
          "zero_generator" => {
            "excluded_tables" => [ "custom_excluded_table" ],
            "type_overrides" => { "custom_type" => "CustomType" }
          }
        }
        File.write(@temp_config_file, base_config.to_yaml)

        # Test that base config is preserved across environments
        %w[development production test].each do |env|
          service = create_config_service(env)
          assert_includes service.excluded_tables, "custom_excluded_table"
          assert_equal "CustomType", service.type_overrides[:custom_type]
        end
      end

      test "environment switching maintains service stability" do
        # Create services for different environments
        services = {}
        %w[development production test].each do |env|
          services[env] = create_config_service(env)
          assert_not_nil services[env].configuration
          assert services[env].validate_configuration!
        end

        # All services should remain functional
        services.each do |env, service|
          assert service.health_check[:status] == :healthy,
            "#{env} environment service should remain healthy"
        end
      end

      test "environment switching handles configuration reloading" do
        service = create_config_service("development")
        original_caching = service.enable_template_caching?

        # Simulate environment change by creating new service
        new_service = create_config_service("test")
        assert_not_equal original_caching, new_service.enable_template_caching?,
          "Environment switch should change configuration values"

        # Original service should still be valid
        assert_nothing_raised { service.validate_configuration! }
      end

      # =============================================================================
      # Cross-Environment Compatibility Tests
      # =============================================================================

      test "configuration portability across environments" do
        # Create configuration in development
        dev_service = create_config_service("development")
        dev_service.add_excluded_table("portable_table")
        dev_service.add_type_override("portable_type", "PortableType")
        dev_service.save_configuration!

        # Load in production and test environments
        prod_service = create_config_service("production")
        test_service = create_config_service("test")

        # Custom configuration should be portable
        [ prod_service, test_service ].each do |service|
          assert_includes service.excluded_tables, "portable_table"
          assert_equal "PortableType", service.type_overrides[:portable_type]
        end
      end

      test "environment detection works correctly" do
        # Test explicit environment setting
        service = ConfigurationService.new(
          environment: "production",
          config_file_path: @temp_config_file,
          validate_on_load: false
        )
        assert_equal "production", service.environment

        # Test Rails environment detection (if available)
        if defined?(Rails)
          Rails.expects(:env).returns("staging").at_most_once
          service = ConfigurationService.new(
            config_file_path: @temp_config_file,
            validate_on_load: false
          )
          # Service will either detect staging or fall back to development
          assert_not_nil service.environment
        end
      end

      test "environment validation accepts valid environments" do
        valid_environments = %w[development production test staging]

        valid_environments.each do |env|
          service = ConfigurationService.new(
            environment: env,
            config_file_path: @temp_config_file,
            validate_on_load: false
          )

          assert_equal env, service.environment
          assert_nothing_raised { service.validate_configuration! }
        end
      end

      # =============================================================================
      # Environment-Specific Configuration Validation
      # =============================================================================

      test "validates required configuration keys across environments" do
        %w[development production test].each do |env|
          config_service = create_config_service(env)

          # All environments should have required configuration sections
          assert_not_nil config_service.excluded_tables
          assert_not_nil config_service.output_config
          assert_not_nil config_service.type_overrides
          assert_not_nil config_service.field_mappings

          # Configuration should validate successfully
          assert_nothing_raised do
            config_service.validate_configuration!
          end
        end
      end

      test "validates environment-specific settings are applied" do
        # Test development-specific settings
        dev_service = create_config_service("development")
        assert dev_service.enable_template_caching?
        assert_equal "detailed", dev_service.template_error_handling

        # Test production-specific settings
        prod_service = create_config_service("production")
        assert prod_service.enable_template_caching?
        assert_equal "minimal", prod_service.template_error_handling
        assert_equal 7200, prod_service.cache_ttl

        # Test test-specific settings
        test_service = create_config_service("test")
        refute test_service.enable_template_caching?
        refute test_service.enable_schema_caching?
        assert test_service.force_overwrite?
      end

      test "validates path configurations are secure across environments" do
        %w[development production test].each do |env|
          config_service = create_config_service(env)

          # All paths should be relative for security
          config_service.output_config.each do |key, path|
            next unless path.is_a?(String)
            refute path.start_with?("/"), "#{env} environment #{key} path should not be absolute: #{path}"
            refute path.include?(".."), "#{env} environment #{key} path should not contain traversal: #{path}"
          end
        end
      end

      # =============================================================================
      # Configuration Consistency Tests
      # =============================================================================

      test "validates configuration consistency across environments" do
        # Create base configuration
        base_config = {
          "zero_generator" => {
            "excluded_tables" => [ "consistent_table" ],
            "type_overrides" => { "consistent_type" => "ConsistentType" },
            "output" => {
              "base_dir" => "frontend/src/lib/models"
            }
          }
        }
        File.write(@temp_config_file, base_config.to_yaml)

        # Verify consistency across environments
        %w[development production test].each do |env|
          service = create_config_service(env)

          # Base configuration should be consistent
          assert_includes service.excluded_tables, "consistent_table"
          assert_equal "ConsistentType", service.type_overrides[:consistent_type]
          assert_equal "frontend/src/lib/models", service.base_output_dir

          # Configuration should be valid
          assert_nothing_raised { service.validate_configuration! }
        end
      end

      test "environment overrides work correctly" do
        # Test that environment-specific overrides are applied
        dev_service = create_config_service("development")
        prod_service = create_config_service("production")
        test_service = create_config_service("test")

        # Template caching should differ by environment
        assert dev_service.enable_template_caching?
        assert prod_service.enable_template_caching?
        refute test_service.enable_template_caching?

        # Error handling should differ by environment
        assert_equal "detailed", dev_service.template_error_handling
        assert_equal "minimal", prod_service.template_error_handling
        assert_equal "detailed", test_service.template_error_handling

        # Cache TTL should differ by environment
        assert_equal 3600, dev_service.cache_ttl  # Default
        assert_equal 7200, prod_service.cache_ttl  # Production override
        assert_equal 3600, test_service.cache_ttl  # Default (caching disabled anyway)
      end

      test "configuration health check works across environments" do
        %w[development production test].each do |env|
          service = create_config_service(env)
          health = service.health_check

          assert_equal :healthy, health[:status]
          assert_equal env, health[:environment]
          assert health.key?(:statistics)
          assert health.key?(:key_counts)

          # Verify key counts are reasonable
          assert health[:key_counts][:excluded_tables] > 0
          assert health[:key_counts][:type_overrides] >= 0
        end
      end

      private

      def create_config_service(environment)
        ConfigurationService.new(
          environment: environment,
          config_file_path: @temp_config_file,
          validate_on_load: false
        )
      end

      def cleanup_test_environment
        # Clean up any test artifacts
        ENV.delete("ZERO_ENV_TEST_MODE") if ENV["ZERO_ENV_TEST_MODE"]
      end
    end
  end
end
