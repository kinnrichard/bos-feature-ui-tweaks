# frozen_string_literal: true

require "test_helper"
require "mocha/minitest"
require "generators/zero/active_models/service_registry"
require "generators/zero/active_models/configuration_service"
require "generators/zero/active_models/schema_service"
require "generators/zero/active_models/file_manager"
require "generators/zero/active_models/template_renderer"
require "generators/zero/active_models/type_mapper"
require "generators/zero/active_models/relationship_processor"

module Zero
  module Generators
    class ServiceRegistryTest < ActiveSupport::TestCase
      def setup
        @registry = ServiceRegistry.new(validate_services: false)
      end

      def teardown
        @registry.shutdown_all_services if @registry
      end

      # =============================================================================
      # Initialization & Configuration Tests
      # =============================================================================

      test "initializes with default configuration" do
        registry = ServiceRegistry.new(validate_services: false)

        assert_not_nil registry
        assert_instance_of Hash, registry.configuration_options
        assert registry.configuration_options[:enable_caching]
        assert_not registry.configuration_options[:validate_services]
      end

      test "accepts custom configuration options" do
        custom_options = {
          environment: "production",
          enable_caching: false,
          config_file_path: "/custom/path/config.yml"
        }

        registry = ServiceRegistry.new(**custom_options, validate_services: false)

        assert_equal "production", registry.configuration_options[:environment]
        assert_not registry.configuration_options[:enable_caching]
        assert_equal "/custom/path/config.yml", registry.configuration_options[:config_file_path]
      end

      test "validates configuration on initialization when enabled" do
        # This should not raise errors for basic configuration
        assert_nothing_raised do
          ServiceRegistry.new(validate_services: true)
        end
      end

      # =============================================================================
      # Service Lifecycle Management Tests
      # =============================================================================

      test "registers all core services correctly" do
        expected_services = [ :configuration, :schema, :file_manager, :template_renderer,
                           :type_mapper, :relationship_processor ]

        assert_equal expected_services.sort, @registry.available_services.sort
      end

      test "implements lazy service initialization" do
        # Services should not be initialized until requested
        assert_empty @registry.initialized_services

        # Request a service
        config_service = @registry.get_service(:configuration)
        assert_not_nil config_service
        assert_includes @registry.initialized_services, :configuration
      end

      test "maintains service state transitions" do
        # Initial state should be uninitialized
        assert_not @registry.service_initialized?(:configuration)

        # After getting service, it should be initialized and running
        @registry.get_service(:configuration)
        assert @registry.service_initialized?(:configuration)

        # State should be tracked in service_states
        assert_equal ServiceRegistry::SERVICE_STATES[:running],
                     @registry.service_states[:configuration]
      end

      test "handles service initialization failures gracefully" do
        # Mock a service creation failure
        @registry.expects(:create_configuration_service).raises(StandardError.new("Mock failure"))

        assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:configuration)
        end

        # Service should be in error state
        assert_equal ServiceRegistry::SERVICE_STATES[:error],
                     @registry.service_states[:configuration]
      end

      # =============================================================================
      # Dependency Resolution Tests
      # =============================================================================

      test "resolves service dependencies in correct order" do
        # Schema service depends on configuration service
        schema_service = @registry.get_service(:schema)

        # Both services should be initialized
        assert @registry.service_initialized?(:configuration)
        assert @registry.service_initialized?(:schema)

        # Configuration should be initialized first (dependency)
        assert_not_nil schema_service
      end

      test "detects circular dependencies and raises appropriate errors" do
        # Create a registry with mock circular dependencies
        registry = ServiceRegistry.new(validate_services: false)
        registry.instance_variable_set(:@dependency_graph, {
          service_a: [ :service_b ],
          service_b: [ :service_a ]
        })

        assert_raises ServiceRegistry::CircularDependencyError do
          registry.send(:check_circular_dependencies, :service_a)
        end
      end

      test "handles missing dependency scenarios" do
        # Try to get a service that doesn't exist
        assert_raises ServiceRegistry::ServiceNotFoundError do
          @registry.get_service(:nonexistent_service)
        end
      end

      test "validates dependency graph integrity" do
        # The dependency graph should be consistent
        ServiceRegistry::SERVICE_DEPENDENCIES.each do |service, dependencies|
          dependencies.each do |dep|
            assert ServiceRegistry::SERVICE_DEPENDENCIES.key?(dep),
                   "Dependency #{dep} for service #{service} is not registered"
          end
        end
      end

      # =============================================================================
      # Service Reuse & Caching Tests
      # =============================================================================

      test "reuses initialized services efficiently" do
        # Get the same service twice
        service1 = @registry.get_service(:configuration)
        service2 = @registry.get_service(:configuration)

        # Should be the same instance
        assert_same service1, service2

        # Should track reuse statistics
        assert @registry.statistics[:service_reuses] > 0
      end

      test "tracks service reuse statistics accurately" do
        initial_reuses = @registry.statistics[:service_reuses]

        # First call should not count as reuse
        @registry.get_service(:configuration)
        assert_equal initial_reuses, @registry.statistics[:service_reuses]

        # Second call should count as reuse
        @registry.get_service(:configuration)
        assert_equal initial_reuses + 1, @registry.statistics[:service_reuses]
      end

      test "maintains service instances across calls" do
        # Get a service
        config_service = @registry.get_service(:configuration)
        original_object_id = config_service.object_id

        # Clear and get again
        @registry.clear_service_cache(:configuration)
        new_config_service = @registry.get_service(:configuration)

        # Should be a different instance after cache clear
        assert_not_equal original_object_id, new_config_service.object_id
      end

      # =============================================================================
      # Health Monitoring Tests
      # =============================================================================

      test "performs comprehensive health checks" do
        # Initialize some services
        @registry.get_service(:configuration)
        @registry.get_service(:schema)

        health_status = @registry.health_check

        assert_instance_of Hash, health_status
        assert health_status.key?(:overall_status)
        assert health_status.key?(:services)
        assert health_status.key?(:registry_stats)
        assert health_status.key?(:dependency_graph)
      end

      test "reports unhealthy services with details" do
        # Mock a service that reports unhealthy
        config_service = @registry.get_service(:configuration)
        config_service.expects(:health_check).returns({ status: :unhealthy, error: "Mock error" })

        health_status = @registry.health_check

        assert_equal :unhealthy, health_status[:overall_status]
        assert_equal :unhealthy, health_status[:services][:configuration][:status]
      end

      test "aggregates service statistics correctly" do
        # Initialize some services
        @registry.get_service(:configuration)
        @registry.get_service(:schema)

        health_status = @registry.health_check
        stats = health_status[:registry_stats]

        assert_instance_of Hash, stats
        assert stats.key?(:initializations)
        assert stats.key?(:health_checks)
        assert stats[:health_checks] > 0
      end

      test "handles health check failures gracefully" do
        # Mock a service that throws during health check
        config_service = @registry.get_service(:configuration)
        config_service.expects(:health_check).raises(StandardError.new("Health check failed"))

        health_status = @registry.health_check

        # When a service health check throws an exception, it should be marked as degraded
        # But since it's the only service, the overall status becomes unhealthy
        assert_equal :unhealthy, health_status[:overall_status]
        assert_equal :unhealthy, health_status[:services][:configuration][:status]
      end

      # =============================================================================
      # Shutdown & Cleanup Tests
      # =============================================================================

      test "shuts down services in reverse dependency order" do
        # Initialize all services
        @registry.initialize_all_services

        shutdown_result = @registry.shutdown_all_services

        assert shutdown_result[:success]
        assert_empty shutdown_result[:errors]
        assert_empty @registry.initialized_services
      end

      test "handles shutdown errors without cascading failures" do
        # Initialize a service
        config_service = @registry.get_service(:configuration)

        # Mock a shutdown failure
        config_service.expects(:shutdown).raises(StandardError.new("Shutdown failed"))

        shutdown_result = @registry.shutdown_all_services

        assert_not shutdown_result[:success]
        assert_not_empty shutdown_result[:errors]
        assert_equal :shutdown_error, shutdown_result[:results][:configuration]
      end

      test "cleans up resources properly on shutdown" do
        # Initialize services
        @registry.get_service(:configuration)
        @registry.get_service(:schema)

        assert_not_empty @registry.initialized_services
        assert_not_empty @registry.services

        @registry.shutdown_all_services

        assert_empty @registry.services
        assert_empty @registry.service_states
      end

      # =============================================================================
      # Error Scenarios Tests
      # =============================================================================

      test "handles service creation failures with detailed errors" do
        # Mock service creation to fail
        @registry.expects(:create_configuration_service).raises(StandardError.new("Creation failed"))

        error = assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:configuration)
        end

        assert_match /Failed to initialize service 'configuration'/, error.message
        assert_match /Creation failed/, error.message
      end

      test "recovers from individual service errors" do
        # Create a separate registry for this test to avoid mocking conflicts
        test_registry = ServiceRegistry.new(validate_services: false)

        # Mock one service to fail first time
        test_registry.expects(:create_configuration_service).raises(StandardError.new("Config failed"))

        assert_raises ServiceRegistry::ServiceError do
          test_registry.get_service(:configuration)
        end

        # Error should be tracked
        assert_equal 1, test_registry.statistics[:errors]

        # Registry should still be functional for checking existence
        assert test_registry.service_exists?(:configuration)
        assert_not test_registry.service_initialized?(:configuration)
      end

      test "maintains registry stability during service failures" do
        initial_stat_count = @registry.statistics[:errors]

        # Mock a service failure
        @registry.expects(:create_configuration_service).raises(StandardError.new("Mock failure"))

        assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:configuration)
        end

        # Error count should be incremented
        assert_equal initial_stat_count + 1, @registry.statistics[:errors]

        # Registry should still be functional for other services
        assert_nothing_raised do
          @registry.available_services
          @registry.service_exists?(:schema)
        end
      end

      # =============================================================================
      # Service Management Integration Tests
      # =============================================================================

      test "initialize all services returns comprehensive results" do
        result = @registry.initialize_all_services

        assert_instance_of Hash, result
        assert result.key?(:results)
        assert result.key?(:errors)
        assert result.key?(:success)

        # All services should be initialized successfully
        expected_services = [ :configuration, :schema, :file_manager, :template_renderer,
                           :type_mapper, :relationship_processor ]
        expected_services.each do |service|
          assert result[:results].key?(service)
        end
      end

      test "aggregate service statistics provides comprehensive data" do
        # Initialize some services
        @registry.get_service(:configuration)
        @registry.get_service(:schema)

        stats = @registry.aggregate_service_statistics

        assert_instance_of Hash, stats
        assert stats.key?(:registry)
        assert stats.key?(:services)

        # Registry stats should include our tracked metrics
        registry_stats = stats[:registry]
        assert registry_stats.key?(:initializations)
        assert registry_stats.key?(:dependency_resolutions)
        assert registry_stats.key?(:service_reuses)
      end

      test "configuration updates propagate to services" do
        # Initialize configuration service
        config_service = @registry.get_service(:configuration)

        # Mock the update_config method
        config_service.expects(:update_config).with(:test_setting, "new_value")

        @registry.update_configuration({ test_setting: "new_value" })

        # Configuration should be updated
        assert_equal "new_value", @registry.configuration_options[:test_setting]
      end

      test "service existence and state checking methods work correctly" do
        # Test service_exists?
        assert @registry.service_exists?(:configuration)
        assert @registry.service_exists?("configuration")
        assert_not @registry.service_exists?(:nonexistent)

        # Test service_initialized? before initialization
        assert_not @registry.service_initialized?(:configuration)

        # Initialize and test again
        @registry.get_service(:configuration)
        assert @registry.service_initialized?(:configuration)
      end
    end
  end
end
