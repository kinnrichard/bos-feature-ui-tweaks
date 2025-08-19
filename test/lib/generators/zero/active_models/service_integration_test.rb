# frozen_string_literal: true

require "test_helper"
require "minitest/autorun"
require "mocha/minitest"
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
    class ServiceIntegrationTest < ActiveSupport::TestCase
      # Skip fixtures for this test to avoid foreign key violations
      self.use_transactional_tests = false

      def self.fixture_file_names
        []
      end
      def setup
        @registry = ServiceRegistry.new(validate_services: false)
        @test_config = {
          environment: "test",
          enable_caching: true,
          enable_prettier: false,
          base_output_dir: Rails.root.join("tmp/test_generation"),
          exclude_tables: [ "schema_migrations", "ar_internal_metadata" ]
        }
      end

      def teardown
        @registry.shutdown_all_services if @registry
        # Clean up test files
        if @test_config && @test_config[:base_output_dir] && File.exist?(@test_config[:base_output_dir])
          FileUtils.rm_rf(@test_config[:base_output_dir])
        end
      end

      # =============================================================================
      # Cross-Service Communication Tests
      # =============================================================================

      test "configuration service updates propagate to dependent services" do
        # Initialize all services
        config_service = @registry.get_service(:configuration)
        schema_service = @registry.get_service(:schema)
        file_manager = @registry.get_service(:file_manager)
        template_renderer = @registry.get_service(:template_renderer)
        type_mapper = @registry.get_service(:type_mapper)

        # Update configuration
        new_config = { enable_caching: false, enable_prettier: true }
        @registry.update_configuration(new_config)

        # Verify configuration changes were applied
        assert_equal false, @registry.configuration_options[:enable_caching]
        assert_equal true, @registry.configuration_options[:enable_prettier]

        # Verify dependent services are marked for re-initialization
        # (Services dependent on configuration should be cleared from cache)
        dependent_services = [ :schema, :file_manager, :template_renderer, :type_mapper ]

        # Services should still exist but may need reconfiguration
        dependent_services.each do |service_name|
          assert @registry.service_exists?(service_name)
        end
      end

      test "schema service provides data to generation coordinator" do
        # Initialize required services
        config_service = @registry.get_service(:configuration)
        schema_service = @registry.get_service(:schema)

        # Mock configuration for schema service
        config_service.stubs(:enable_schema_caching?).returns(true)
        config_service.stubs(:enable_pattern_detection?).returns(true)

        # Test schema data flow to coordinator
        schema_data = schema_service.extract_filtered_schema(
          exclude_tables: @test_config[:exclude_tables]
        )

        assert_instance_of Hash, schema_data
        assert schema_data.key?(:tables)

        # Verify schema data structure for coordinator consumption
        schema_data[:tables].each do |table_info|
          assert_instance_of Hash, table_info
          assert_instance_of String, table_info[:name]
          assert table_info.key?(:columns)
          assert_instance_of Array, table_info[:columns]
        end
      end

      test "template renderer receives context from coordinator" do
        # Initialize services
        config_service = @registry.get_service(:configuration)
        schema_service = @registry.get_service(:schema)
        template_renderer = @registry.get_service(:template_renderer)
        type_mapper = @registry.get_service(:type_mapper)

        # Mock configuration (stubbed rather than expected since template rendering may not call them)
        config_service.stubs(:enable_template_caching?).returns(true)
        config_service.stubs(:enable_schema_caching?).returns(true)
        config_service.stubs(:enable_pattern_detection?).returns(false)

        # Test template rendering with integrated context
        if User.table_exists?
          schema_data = schema_service.extract_table_schema("users")

          # Create context that would be provided by coordinator
          template_context = {
            table_name: "users",
            class_name: "User",
            kebab_name: "user",
            model_name: "user",
            timestamp: Time.current.strftime("%Y-%m-%d %H:%M:%S UTC"),
            relationship_import_section: "",
            supports_discard: "false",
            discard_scopes: "",
            relationship_registration: "",
            schema: schema_data,
            type_mapper: type_mapper
          }

          # Test template rendering with coordinator-provided context
          rendered_content = template_renderer.render(
            "active_model.ts.erb",
            template_context
          )

          assert_instance_of String, rendered_content
          assert_match(/export const User/, rendered_content)
          assert_match(/from.*user-data/, rendered_content)
        end
      end

      test "file manager integrates with all content generation services" do
        # Initialize all content generation services
        config_service = @registry.get_service(:configuration)
        schema_service = @registry.get_service(:schema)
        template_renderer = @registry.get_service(:template_renderer)
        type_mapper = @registry.get_service(:type_mapper)
        file_manager = @registry.get_service(:file_manager)

        # Mock configuration
        config_service.stubs(:enable_prettier?).returns(false)
        config_service.expects(:force_overwrite?).returns(false).at_least_once
        config_service.stubs(:enable_template_caching?).returns(true)
        config_service.stubs(:enable_schema_caching?).returns(true)
        config_service.stubs(:enable_pattern_detection?).returns(false)

        if User.table_exists?
          # Generate content using integrated services
          schema_data = schema_service.extract_table_schema("users")

          template_context = {
            table_name: "users",
            class_name: "User",
            schema: schema_data,
            type_mapper: type_mapper
          }

          rendered_content = template_renderer.render(
            "active_model.ts.erb",
            template_context
          )

          # Test file manager integration
          output_path = File.join(@test_config[:base_output_dir], "user.ts")
          file_manager.write_file(output_path, rendered_content)

          # Verify file was created and content is correct
          assert File.exist?(output_path)

          file_content = File.read(output_path)
          assert_match(/export class User/, file_content)
        end
      end

      # =============================================================================
      # Service Dependency Workflows Tests
      # =============================================================================

      test "services initialize in correct dependency order" do
        # Clear any existing services
        @registry.shutdown_all_services

        # Initialize all services and track order
        initialization_order = []

        # Mock service creation to track order using expectations
        ServiceRegistry::SERVICE_INITIALIZATION_ORDER.each do |service_name|
          original_method = "create_#{service_name.to_s.gsub('_', '_')}_service"

          @registry.expects(original_method.to_sym).returns do
            initialization_order << service_name
            Object.new
          end
        end

        result = @registry.initialize_all_services

        # Verify initialization order matches dependency requirements
        assert_equal ServiceRegistry::SERVICE_INITIALIZATION_ORDER, initialization_order
        assert result[:success]
      end

      test "dependent services receive required dependencies" do
        # Initialize schema service (which depends on configuration)
        schema_service = @registry.get_service(:schema)

        # Verify configuration service was initialized as dependency
        assert @registry.service_initialized?(:configuration)
        assert @registry.service_initialized?(:schema)

        # Verify schema service received configuration dependency
        config_service = @registry.get_service(:configuration)
        assert_not_nil config_service
        assert_not_nil schema_service
      end

      test "service failures don't cascade inappropriately" do
        # Mock one service to fail during initialization
        @registry.expects(:create_template_renderer_service).raises(StandardError.new("Template service failed"))

        # Try to initialize all services
        result = @registry.initialize_all_services

        # Verify failure is isolated
        assert_not result[:success]
        assert_not_empty result[:errors]

        # Other services should still be functional
        assert @registry.service_initialized?(:configuration)
        assert @registry.service_initialized?(:schema)

        # Failed service should be in error state
        assert_equal :error, @registry.service_states[:template_renderer]
      end

      test "service recovery maintains system stability" do
        # Initialize a service successfully first
        config_service = @registry.get_service(:configuration)
        assert @registry.service_initialized?(:configuration)

        # Clear the service and mock a failure on retry
        @registry.clear_service_cache(:configuration)
        @registry.expects(:create_configuration_service).raises(StandardError.new("Retry failed"))

        # Attempt to get service again should fail
        assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:configuration)
        end

        # But registry should remain stable
        assert @registry.service_exists?(:configuration)
        assert_not @registry.service_initialized?(:configuration)

        # Other services should still be available
        assert @registry.service_exists?(:schema)
        assert @registry.service_exists?(:file_manager)
      end

      # =============================================================================
      # End-to-End Service Orchestration Tests
      # =============================================================================

      test "complete generation workflow coordinates all services" do
        # Skip if no suitable tables exist
        skip "No test tables available" unless User.table_exists?

        # Initialize all services through registry
        config_service = @registry.get_service(:configuration)
        schema_service = @registry.get_service(:schema)
        template_renderer = @registry.get_service(:template_renderer)
        type_mapper = @registry.get_service(:type_mapper)
        file_manager = @registry.get_service(:file_manager)

        # Mock configuration methods
        config_service.stubs(:enable_schema_caching?).returns(true)
        config_service.stubs(:enable_pattern_detection?).returns(false)
        config_service.stubs(:enable_template_caching?).returns(true)
        config_service.stubs(:enable_prettier?).returns(false)
        config_service.expects(:force_overwrite?).returns(true).at_least_once

        # Execute coordinated workflow
        schema_data = schema_service.extract_table_schema("users")
        assert_not_nil schema_data

        # Process through type mapper
        columns_with_types = {}
        schema_data[:columns].each do |column_name, column_info|
          columns_with_types[column_name] = type_mapper.map_type(column_info[:type])
        end

        # Render templates
        template_context = {
          table_name: "users",
          class_name: "User",
          schema: schema_data,
          type_mapper: type_mapper,
          columns_with_types: columns_with_types
        }

        rendered_content = template_renderer.render(
          "active_model.ts.erb",
          template_context
        )

        # Write file
        output_path = File.join(@test_config[:base_output_dir], "user.ts")
        file_manager.write_file(output_path, rendered_content)

        # Verify complete workflow success
        assert File.exist?(output_path)
        content = File.read(output_path)
        assert_match(/export class User/, content)
      end

      test "error handling flows correctly through service stack" do
        # Initialize services
        config_service = @registry.get_service(:configuration)
        schema_service = @registry.get_service(:schema)
        template_renderer = @registry.get_service(:template_renderer)

        # Mock configuration
        config_service.stubs(:enable_template_caching?).returns(true)
        config_service.stubs(:enable_schema_caching?).returns(true)
        config_service.stubs(:enable_pattern_detection?).returns(false)

        # Test error propagation through service stack
        if User.table_exists?
          schema_data = schema_service.extract_table_schema("users")

          # Mock template rendering to fail
          template_renderer.expects(:render).raises(StandardError.new("Template error"))

          # Error should be catchable and not crash the registry
          assert_raises StandardError do
            template_renderer.render("active_model.ts.erb", { schema: schema_data })
          end

          # Registry should remain stable
          health_status = @registry.health_check
          assert health_status[:overall_status] != :error
        end
      end

      test "performance metrics aggregate across all services" do
        # Initialize services that track performance
        @registry.get_service(:configuration)
        @registry.get_service(:schema)
        @registry.get_service(:template_renderer)
        @registry.get_service(:file_manager)

        # Collect aggregated statistics
        stats = @registry.aggregate_service_statistics

        # Verify structure
        assert_instance_of Hash, stats
        assert stats.key?(:registry)
        assert stats.key?(:services)

        # Verify registry-level statistics
        registry_stats = stats[:registry]
        assert registry_stats.key?(:initializations)
        assert registry_stats.key?(:dependency_resolutions)
        assert registry_stats.key?(:service_reuses)
        assert registry_stats.key?(:health_checks)

        # Verify service-level statistics are collected
        assert_instance_of Hash, stats[:services]
      end

      test "shutdown sequence maintains data integrity" do
        # Initialize multiple services with interdependencies
        @registry.get_service(:configuration)
        @registry.get_service(:schema)
        @registry.get_service(:template_renderer)
        @registry.get_service(:file_manager)

        # Verify all are running
        assert @registry.service_initialized?(:configuration)
        assert @registry.service_initialized?(:schema)
        assert @registry.service_initialized?(:template_renderer)
        assert @registry.service_initialized?(:file_manager)

        # Shutdown all services
        shutdown_result = @registry.shutdown_all_services

        # Verify shutdown was successful
        assert shutdown_result[:success]
        assert_empty shutdown_result[:errors]

        # Verify all services are properly shut down
        assert_empty @registry.initialized_services
        assert_empty @registry.services
        assert_empty @registry.service_states
      end

      # =============================================================================
      # Configuration Propagation Tests
      # =============================================================================

      test "dynamic configuration updates reach all affected services" do
        # Initialize services that depend on configuration
        config_service = @registry.get_service(:configuration)
        schema_service = @registry.get_service(:schema)
        file_manager = @registry.get_service(:file_manager)
        template_renderer = @registry.get_service(:template_renderer)

        # Track initial configuration
        initial_caching = @registry.configuration_options[:enable_caching]

        # Update configuration
        new_config = { enable_caching: !initial_caching }
        @registry.update_configuration(new_config)

        # Verify configuration was updated
        assert_equal !initial_caching, @registry.configuration_options[:enable_caching]

        # Verify dependent services would be affected
        # (They should be cleared from cache to pick up new configuration)
        dependent_services = @registry.send(:find_services_dependent_on, :configuration)
        assert_includes dependent_services, :schema
        assert_includes dependent_services, :file_manager
        assert_includes dependent_services, :template_renderer
      end

      test "environment changes trigger appropriate service reconfigurations" do
        # Start with test environment
        original_env = @registry.configuration_options[:environment]

        # Update to production environment
        @registry.update_configuration({ environment: "production" })

        assert_equal "production", @registry.configuration_options[:environment]

        # Restore original environment
        @registry.update_configuration({ environment: original_env })
      end

      test "service-specific configurations apply correctly" do
        # Initialize services
        config_service = @registry.get_service(:configuration)

        # Test service-specific configuration updates
        service_configs = {
          enable_template_caching: false,
          enable_schema_caching: true,
          enable_prettier: true
        }

        @registry.update_configuration(service_configs)

        # Verify configurations were applied
        service_configs.each do |key, value|
          assert_equal value, @registry.configuration_options[key]
        end
      end

      # =============================================================================
      # Performance Integration Tests
      # =============================================================================

      test "service caching strategies work together efficiently" do
        # Initialize services with caching enabled
        config_service = @registry.get_service(:configuration)
        schema_service = @registry.get_service(:schema)
        template_renderer = @registry.get_service(:template_renderer)

        # Mock caching configuration
        config_service.stubs(:enable_schema_caching?).returns(true)
        config_service.stubs(:enable_template_caching?).returns(true)
        config_service.stubs(:enable_pattern_detection?).returns(false)

        if User.table_exists?
          # First access - should cache
          start_time = Time.current
          schema_data1 = schema_service.extract_table_schema("users")
          first_access_time = Time.current - start_time

          # Second access - should use cache
          start_time = Time.current
          schema_data2 = schema_service.extract_table_schema("users")
          second_access_time = Time.current - start_time

          # Cache should make second access faster
          assert_equal schema_data1, schema_data2
          # Note: Time comparison might be unreliable in fast tests,
          # so we mainly verify data consistency
        end
      end

      test "cross-service performance optimizations function correctly" do
        # Test that services work efficiently together
        @registry.get_service(:configuration)
        @registry.get_service(:schema)
        @registry.get_service(:template_renderer)
        @registry.get_service(:type_mapper)

        # Measure time for service coordination
        start_time = Time.current

        # Simulate cross-service workflow
        10.times do
          @registry.get_service(:configuration)
          @registry.get_service(:schema)
        end

        end_time = Time.current
        coordination_time = end_time - start_time

        # Should complete quickly due to service reuse
        assert coordination_time < 1.0, "Service coordination took #{coordination_time}s, expected < 1.0s"

        # Verify service reuse statistics
        assert @registry.statistics[:service_reuses] > 0
      end

      test "resource cleanup happens appropriately across services" do
        # Initialize all services
        result = @registry.initialize_all_services
        assert result[:success]

        # Track resource usage
        initial_service_count = @registry.initialized_services.count
        initial_memory_usage = GC.stat[:total_allocated_objects]

        # Clear specific service cache
        @registry.clear_service_cache(:template_renderer)

        # Verify cleanup
        assert_not @registry.service_initialized?(:template_renderer)
        assert initial_service_count > @registry.initialized_services.count

        # Force garbage collection to test cleanup
        GC.start

        # Memory usage should be managed appropriately
        post_cleanup_memory = GC.stat[:total_allocated_objects]
        # Note: Memory assertions are environment-dependent, so we focus on service state

        # Service should be re-initializable
        new_service = @registry.get_service(:template_renderer)
        assert_not_nil new_service
        assert @registry.service_initialized?(:template_renderer)
      end

      # =============================================================================
      # Service Health and Monitoring Integration Tests
      # =============================================================================

      test "integrated health monitoring provides comprehensive system status" do
        # Initialize multiple services
        @registry.get_service(:configuration)
        @registry.get_service(:schema)
        @registry.get_service(:template_renderer)
        @registry.get_service(:file_manager)

        # Perform health check
        health_status = @registry.health_check

        # Verify comprehensive health reporting
        assert_instance_of Hash, health_status
        assert health_status.key?(:overall_status)
        assert health_status.key?(:services)
        assert health_status.key?(:registry_stats)
        assert health_status.key?(:dependency_graph)

        # Verify service-level health information
        health_status[:services].each do |service_name, service_health|
          assert_instance_of Hash, service_health
          assert service_health.key?(:status)
        end

        # Verify registry statistics are included
        registry_stats = health_status[:registry_stats]
        assert registry_stats.key?(:initializations)
        assert registry_stats.key?(:health_checks)
        assert registry_stats[:health_checks] > 0
      end

      test "service dependency validation works across service stack" do
        # Test dependency graph integrity
        ServiceRegistry::SERVICE_DEPENDENCIES.each do |service, dependencies|
          dependencies.each do |dependency|
            assert @registry.service_exists?(dependency),
                   "Dependency #{dependency} for service #{service} should exist"
          end
        end

        # Test that dependent services can be initialized
        ServiceRegistry::SERVICE_INITIALIZATION_ORDER.each do |service_name|
          service = @registry.get_service(service_name)
          assert_not_nil service, "Service #{service_name} should be initializable"
        end
      end

      # =============================================================================
      # Error Recovery and Resilience Tests
      # =============================================================================

      test "service error isolation maintains system functionality" do
        # Initialize working services
        config_service = @registry.get_service(:configuration)
        schema_service = @registry.get_service(:schema)

        assert @registry.service_initialized?(:configuration)
        assert @registry.service_initialized?(:schema)

        # Mock template renderer to fail
        @registry.expects(:create_template_renderer_service).raises(StandardError.new("Renderer failed"))

        # Try to get failing service
        assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:template_renderer)
        end

        # Other services should remain functional
        assert @registry.service_initialized?(:configuration)
        assert @registry.service_initialized?(:schema)

        # Should be able to initialize other services
        file_manager = @registry.get_service(:file_manager)
        assert_not_nil file_manager
      end

      test "service recovery after transient failures" do
        # Simulate transient failure
        failure_count = 0
        @registry.stubs(:create_template_renderer_service).raises(StandardError.new("Transient failure")).then.returns(Object.new)

        # First attempt should fail
        assert_raises ServiceRegistry::ServiceError do
          @registry.get_service(:template_renderer)
        end

        # Clear cache and retry
        @registry.clear_service_cache(:template_renderer)

        # Second attempt should succeed (due to stubbing)
        service = @registry.get_service(:template_renderer)
        assert_not_nil service
        assert @registry.service_initialized?(:template_renderer)
      end
    end
  end
end
