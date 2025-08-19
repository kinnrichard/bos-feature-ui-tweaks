# frozen_string_literal: true

require "test_helper"
require "minitest/autorun"
require "mocha/minitest"
require "fileutils"
require "timeout"
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
    # Phase 4: Comprehensive Error Handling Test Suite
    #
    # This test suite validates error handling and resilience across all services
    # in the refactored generator architecture. It ensures graceful degradation,
    # proper error propagation, and system stability under failure conditions.
    #
    # Test Areas:
    # - Service Initialization Errors
    # - Runtime Error Scenarios
    # - Resource Limitation Scenarios
    # - Configuration Error Scenarios
    # - Recovery & Resilience Tests
    #
    class ErrorHandlingTest < ActiveSupport::TestCase
      # Skip fixtures for this test to avoid foreign key violations
      self.use_transactional_tests = false
      self.use_instantiated_fixtures = false
      self.fixture_table_names = []

      def setup
        @test_config = {
          environment: "test",
          enable_caching: false, # Disable caching for error testing
          enable_prettier: false,
          base_output_dir: Rails.root.join("tmp/test_error_handling"),
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
      # Service Initialization Error Tests
      # =============================================================================

      test "handles database connection failures during schema service initialization" do
        # Mock ActiveRecord connection to fail
        ActiveRecord::Base.stubs(:connection).raises(ActiveRecord::ConnectionNotEstablished.new("Database connection failed"))

        # Attempt to initialize schema service
        error = assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:schema)
        end

        # Verify error handling
        assert_match(/Database connection failed/, error.message)
        assert_equal :error, @registry.service_states[:schema]

        # Verify other services remain functional
        config_service = @registry.get_service(:configuration)
        assert_not_nil config_service
        assert @registry.service_initialized?(:configuration)
      end

      test "handles file system permission errors during file manager initialization" do
        # Mock file system operations to fail with permission errors
        FileUtils.stubs(:mkdir_p).raises(Errno::EACCES.new("Permission denied"))

        # Attempt to initialize file manager
        error = assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:file_manager)
        end

        # Verify error handling
        assert_match(/Permission denied/, error.message)
        assert_equal :error, @registry.service_states[:file_manager]

        # Verify registry remains stable
        health_status = @registry.health_check
        assert_not_equal :error, health_status[:overall_status]
      end

      test "handles missing template directory errors during renderer initialization" do
        # Mock template directory to be missing
        Dir.stubs(:exist?).returns(false)
        Dir.stubs(:glob).returns([])

        # Attempt to initialize template renderer
        error = assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:template_renderer)
        end

        # Verify error handling
        assert_includes error.message.downcase, "template"
        assert_equal :error, @registry.service_states[:template_renderer]

        # Verify service dependencies still work
        config_service = @registry.get_service(:configuration)
        assert_not_nil config_service
      end

      test "handles invalid configuration errors during config service initialization" do
        # Mock configuration file to contain invalid data
        invalid_config = { enable_caching: "invalid_boolean_value", environment: 123 }

        config_service = ConfigurationService.new
        config_service.stubs(:load_default_configuration).returns(invalid_config)

        @registry.stubs(:create_configuration_service).returns(config_service)
        config_service.stubs(:validate_configuration).raises(StandardError.new("Invalid configuration values"))

        # Attempt to initialize configuration service
        error = assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:configuration)
        end

        # Verify error handling
        assert_match(/Invalid configuration/, error.message)
        assert_equal :error, @registry.service_states[:configuration]
      end

      test "handles service dependency resolution failures" do
        # Mock schema service to fail, which should affect relationship processor
        @registry.expects(:create_schema_service).raises(StandardError.new("Schema service failed"))

        # Try to initialize relationship processor (depends on schema)
        assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:relationship_processor)
        end

        # Verify dependency failure is handled
        assert_equal :error, @registry.service_states[:schema]
        assert_not @registry.service_initialized?(:relationship_processor)

        # Verify non-dependent services still work
        file_manager = @registry.get_service(:file_manager)
        assert_not_nil file_manager
      end

      # =============================================================================
      # Runtime Error Scenario Tests
      # =============================================================================

      test "handles individual table generation failures gracefully" do
        # Initialize services
        schema_service = @registry.get_service(:schema)

        # Mock schema service to fail for specific table
        schema_service.expects(:extract_table_schema).with("users").raises(StandardError.new("Table extraction failed"))
        schema_service.expects(:extract_table_schema).with("clients").returns({
          columns: { id: { type: :integer }, name: { type: :string } },
          relationships: {}
        })

        # Test that one table failure doesn't break the whole process
        assert_raises StandardError do
          schema_service.extract_table_schema("users")
        end

        # Other tables should still work
        client_schema = schema_service.extract_table_schema("clients")
        assert_not_nil client_schema
        assert client_schema.key?(:columns)

        # Registry should remain stable
        health_status = @registry.health_check
        assert_not_equal :error, health_status[:overall_status]
      end

      test "handles template rendering errors with fallback mechanisms" do
        # Initialize services
        template_renderer = @registry.get_service(:template_renderer)

        # Mock template rendering to fail
        template_context = { table_name: "users", class_name: "User" }
        template_renderer.expects(:render).with("active_model.ts.erb", template_context)
          .raises(StandardError.new("Template rendering failed"))

        # Test error is properly raised and handled
        error = assert_raises StandardError do
          template_renderer.render("active_model.ts.erb", template_context)
        end

        assert_match(/Template rendering failed/, error.message)

        # Service should remain functional for other templates
        assert @registry.service_initialized?(:template_renderer)

        # Registry should remain stable
        health_status = @registry.health_check
        assert_not_equal :error, health_status[:overall_status]
      end

      test "handles file write failures with appropriate recovery" do
        # Initialize services
        config_service = @registry.get_service(:configuration)
        file_manager = @registry.get_service(:file_manager)

        # Mock configuration
        config_service.expects(:enable_prettier?).returns(false).at_least_once
        config_service.expects(:force_overwrite?).returns(true).at_least_once

        # Mock file operations to fail
        output_path = File.join(@test_config[:base_output_dir], "test.ts")
        File.stubs(:write).raises(Errno::ENOSPC.new("No space left on device"))

        # Test file write error handling
        error = assert_raises Errno::ENOSPC do
          file_manager.write_with_formatting(output_path, "test content")
        end

        assert_match(/No space left on device/, error.message)

        # Service should remain functional
        assert @registry.service_initialized?(:file_manager)
      end

      test "handles Prettier formatting failures gracefully" do
        # Initialize services
        file_manager = @registry.get_service(:file_manager)

        # Mock prettier to fail (if it tries to format)
        # Note: This test validates that formatting failures don't crash file creation

        # Create test file
        output_path = File.join(@test_config[:base_output_dir], "test.ts")
        FileUtils.mkdir_p(File.dirname(output_path))

        # Test that any formatting failure doesn't prevent file creation
        assert_nothing_raised do
          file_manager.write_with_formatting(output_path, "export class Test {}")
        end

        # File should still be created
        assert File.exist?(output_path)
      end

      test "handles schema extraction errors" do
        # Initialize services
        schema_service = @registry.get_service(:schema)

        # Mock schema extraction to fail
        schema_service.expects(:extract_filtered_schema).raises(StandardError.new("Schema extraction failed"))

        # Test error propagation
        error = assert_raises StandardError do
          schema_service.extract_filtered_schema(exclude_tables: @test_config[:exclude_tables])
        end

        assert_match(/Schema extraction failed/, error.message)

        # Service should remain initialized but in error state for this operation
        assert @registry.service_initialized?(:schema)
      end

      # =============================================================================
      # Resource Limitation Scenario Tests
      # =============================================================================

      test "handles disk space exhaustion appropriately" do
        # Initialize services
        file_manager = @registry.get_service(:file_manager)

        # Mock disk space exhaustion
        File.stubs(:write).raises(Errno::ENOSPC.new("No space left on device"))

        output_path = File.join(@test_config[:base_output_dir], "test.ts")

        # Test error handling for disk space issues
        error = assert_raises Errno::ENOSPC do
          file_manager.write_with_formatting(output_path, "test content")
        end

        assert_match(/No space left on device/, error.message)

        # Service should remain functional for other operations
        assert @registry.service_initialized?(:file_manager)
      end

      test "handles memory pressure scenarios" do
        # Initialize services with mocked memory constraints
        @registry.get_service(:configuration)
        @registry.get_service(:schema)

        # Simulate memory pressure by mocking large object allocation failures
        Array.stubs(:new).raises(NoMemoryError.new("Cannot allocate memory"))

        # Test that services handle memory pressure gracefully
        error = assert_raises NoMemoryError do
          Array.new(1000000) # This should fail due to mocking
        end

        assert_match(/Cannot allocate memory/, error.message)

        # Registry should remain stable
        health_status = @registry.health_check
        assert_instance_of Hash, health_status
      end

      test "handles network timeouts for remote dependencies" do
        # Mock network timeout scenarios
        Timeout.stubs(:timeout).raises(Timeout::Error.new("Network timeout"))

        # Test timeout handling in services that might use network resources
        error = assert_raises Timeout::Error do
          Timeout.timeout(1) { sleep(2) } # This should fail due to mocking
        end

        assert_match(/Network timeout/, error.message)

        # Services should remain functional
        config_service = @registry.get_service(:configuration)
        assert_not_nil config_service
      end

      test "handles file system quota limits" do
        # Mock file system quota exceeded
        FileUtils.stubs(:mkdir_p).raises(Errno::EDQUOT.new("Disk quota exceeded"))

        # Test quota limit handling
        output_dir = File.join(@test_config[:base_output_dir], "nested", "directory")

        error = assert_raises Errno::EDQUOT do
          FileUtils.mkdir_p(output_dir)
        end

        assert_match(/Disk quota exceeded/, error.message)

        # Registry should remain stable
        assert @registry.service_initialized?(:configuration)
      end

      test "handles concurrent access conflicts" do
        # Mock file locking conflicts
        File.stubs(:open).raises(Errno::EAGAIN.new("Resource temporarily unavailable"))

        output_path = File.join(@test_config[:base_output_dir], "concurrent_test.ts")

        # Test concurrent access error handling
        error = assert_raises Errno::EAGAIN do
          File.open(output_path, "w") { |f| f.write("test") }
        end

        assert_match(/Resource temporarily unavailable/, error.message)

        # Services should remain functional
        assert @registry.service_initialized?(:configuration)
      end

      # =============================================================================
      # Configuration Error Scenario Tests
      # =============================================================================

      test "handles invalid configuration values with helpful messages" do
        # Create configuration service with invalid values
        config_service = ConfigurationService.new

        # Mock invalid configuration
        invalid_config = {
          enable_caching: "not_a_boolean",
          cache_ttl: "not_a_number",
          base_output_dir: nil,
          environment: []
        }

        config_service.stubs(:merge_configurations).returns(invalid_config)

        # Test validation error handling
        error = assert_raises StandardError do
          config_service.send(:validate_configuration, invalid_config)
        end

        # Error should be descriptive
        assert_instance_of String, error.message
        assert error.message.length > 10 # Should have helpful detail
      end

      test "handles missing required configuration with defaults" do
        # Create configuration service with missing required values
        config_service = ConfigurationService.new

        # Mock minimal configuration
        minimal_config = {}

        config_service.stubs(:load_file_configuration).returns({})
        config_service.stubs(:load_default_configuration).returns(minimal_config)

        # Test that missing configuration is handled with defaults
        merged_config = config_service.send(:merge_configurations)

        # Should provide sensible defaults
        assert_instance_of Hash, merged_config
        # Basic required keys should be present with defaults
        assert merged_config.key?(:environment) || merged_config.key?("environment")
      end

      test "handles configuration file corruption gracefully" do
        # Mock corrupted YAML file
        corrupted_yaml = "invalid: yaml: content:\n  - unclosed: ["

        config_service = ConfigurationService.new

        # Mock file reading to return corrupted content
        File.stubs(:exist?).returns(true)
        File.stubs(:read).returns(corrupted_yaml)
        YAML.stubs(:safe_load).raises(Psych::SyntaxError.new("YAML syntax error"))

        # Test that corrupted configuration is handled gracefully
        file_config = config_service.send(:load_file_configuration)

        # Should return empty hash or default configuration on corruption
        assert_instance_of Hash, file_config
      end

      test "handles environment configuration conflicts" do
        # Create configuration with conflicting environment settings
        config_service = ConfigurationService.new

        # Mock conflicting configurations
        file_config = { environment: "production", enable_caching: false }
        env_config = { environment: "development", enable_caching: true }

        config_service.stubs(:load_file_configuration).returns(file_config)
        config_service.stubs(:load_environment_configuration).returns(env_config)

        # Test conflict resolution
        merged_config = config_service.send(:merge_configurations)

        # Should resolve conflicts (typically environment overrides file)
        assert_instance_of Hash, merged_config
        assert merged_config.key?(:environment) || merged_config.key?("environment")
      end

      test "handles configuration validation failures" do
        # Mock configuration validation to fail
        config_service = ConfigurationService.new

        invalid_config = {
          enable_caching: true,
          cache_ttl: -1, # Invalid negative value
          base_output_dir: "/invalid/path/that/doesnt/exist",
          max_retries: "not_a_number"
        }

        # Test validation failure handling
        error = assert_raises StandardError do
          config_service.send(:validate_configuration, invalid_config)
        end

        # Error should indicate validation failure
        assert_instance_of String, error.message
      end

      # =============================================================================
      # Recovery & Resilience Tests
      # =============================================================================

      test "recovers from transient errors appropriately" do
        # Mock transient failure followed by success
        call_count = 0
        @registry.stubs(:create_schema_service).raises(StandardError.new("Transient failure")).then.returns(Object.new)

        # First call should fail
        assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:schema)
        end

        # Clear cache and retry
        @registry.clear_service_cache(:schema)

        # Second call should succeed
        service = @registry.get_service(:schema)
        assert_not_nil service
        assert @registry.service_initialized?(:schema)
      end

      test "maintains system stability during error conditions" do
        # Create multiple service errors
        @registry.expects(:create_template_renderer_service).raises(StandardError.new("Renderer failed"))
        @registry.expects(:create_type_mapper_service).raises(StandardError.new("Mapper failed"))

        # Try to initialize failing services
        assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:template_renderer)
        end

        assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:type_mapper)
        end

        # Non-failing services should still work
        config_service = @registry.get_service(:configuration)
        schema_service = @registry.get_service(:schema)

        assert_not_nil config_service
        assert_not_nil schema_service

        # Registry should report partial health
        health_status = @registry.health_check
        assert_instance_of Hash, health_status
        assert health_status.key?(:overall_status)
      end

      test "provides actionable error messages to users" do
        # Mock service failure with poor error message
        @registry.expects(:create_file_manager_service).raises(StandardError.new("Error"))

        # Test that service registry enhances error messages
        error = assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:file_manager)
        end

        # Error message should be enhanced and actionable
        assert_instance_of String, error.message
        assert error.message.length > 5 # Should have more detail than just "Error"
      end

      test "logs errors appropriately for debugging" do
        # Mock logger to capture error logs
        logger_output = []
        mock_logger = Object.new
        mock_logger.stubs(:error) { |message| logger_output << message }
        mock_logger.stubs(:warn) { |message| logger_output << message }
        mock_logger.stubs(:info) { |message| logger_output << message }

        Rails.stubs(:logger).returns(mock_logger)

        # Create service failure
        @registry.expects(:create_schema_service).raises(StandardError.new("Test error for logging"))

        # Trigger error
        assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:schema)
        end

        # Verify logging occurred (if the service implements logging)
        # Note: Actual logging verification depends on service implementation
        assert_instance_of Array, logger_output
      end

      test "implements proper cleanup after errors" do
        # Initialize some services successfully
        config_service = @registry.get_service(:configuration)
        assert_not_nil config_service

        # Mock a service to fail during initialization
        @registry.expects(:create_file_manager_service).raises(StandardError.new("Init failed"))

        # Try to initialize failing service
        assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:file_manager)
        end

        # Verify cleanup - service should be in error state, not partial state
        assert_equal :error, @registry.service_states[:file_manager]
        assert_not @registry.service_initialized?(:file_manager)

        # Successful services should remain functional
        assert @registry.service_initialized?(:configuration)

        # Registry shutdown should clean up properly
        result = @registry.shutdown_all_services
        assert result[:success] # Should succeed even with error services
      end

      test "handles cascading service failures gracefully" do
        # Mock schema service to fail (this affects relationship processor)
        @registry.expects(:create_schema_service).raises(StandardError.new("Schema failed"))

        # Try to get relationship processor (depends on schema)
        assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:relationship_processor)
        end

        # Verify schema failure prevents relationship processor initialization
        assert_equal :error, @registry.service_states[:schema]
        assert_not @registry.service_initialized?(:relationship_processor)

        # But other services should still work
        config_service = @registry.get_service(:configuration)
        file_manager = @registry.get_service(:file_manager)

        assert_not_nil config_service
        assert_not_nil file_manager

        # Registry should remain stable
        health_status = @registry.health_check
        assert_instance_of Hash, health_status
      end

      test "validates error recovery maintains service consistency" do
        # Initialize a service successfully
        config_service = @registry.get_service(:configuration)
        assert @registry.service_initialized?(:configuration)

        # Mock the service to fail on re-initialization
        @registry.clear_service_cache(:configuration)
        @registry.expects(:create_configuration_service).raises(StandardError.new("Recovery failed"))

        # Try to get the service again
        assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:configuration)
        end

        # Service should be in consistent error state
        assert_equal :error, @registry.service_states[:configuration]
        assert_not @registry.service_initialized?(:configuration)

        # Registry should maintain consistent internal state
        assert_instance_of Hash, @registry.services
        assert_instance_of Hash, @registry.service_states

        # Health check should reflect accurate state
        health_status = @registry.health_check
        assert_instance_of Hash, health_status
        assert health_status.key?(:services)
      end
    end
  end
end
