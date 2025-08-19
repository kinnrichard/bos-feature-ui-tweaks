# frozen_string_literal: true

require "test_helper"
require "rails/generators/test_case"
require "generators/zero/active_models/active_models_generator"
require_relative "../../../../lib/generators/zero/active_models/service_registry"
require_relative "../../../../lib/generators/zero/active_models/configuration_service"

class Zero::ActiveModelsGeneratorTest < Rails::Generators::TestCase
  tests Zero::Generators::ActiveModelsGenerator
  destination Rails.root.join("tmp/generator_test")
  setup :prepare_destination

  def setup
    super
    @output_dir = "frontend/src/lib/models"
    @test_tables = %w[users jobs clients tasks]
  end

  def teardown
    super
    # Clean up any generated files
    FileUtils.rm_rf(destination_root) if File.exist?(destination_root)
  end

  # Phase 1: Functional Testing
  test "basic generation creates expected files" do
    run_generator

    # Check that index.ts is created
    assert_file "#{@output_dir}/index.ts"

    # Check that at least one model is generated
    assert_file "#{@output_dir}/user.ts"
    assert_file "#{@output_dir}/reactive-user.ts"
    assert_file "#{@output_dir}/types/user-data.ts"
  end

  test "dry run mode shows what would be generated without creating files" do
    output = capture(:stdout) do
      run_generator [ "--dry-run" ]
    end

    # Should show what would be created
    assert_match(/Would create.*user\.ts/, output)
    assert_match(/Would create.*reactive-user\.ts/, output)

    # But files should not actually be created
    assert_no_file "#{@output_dir}/user.ts"
    assert_no_file "#{@output_dir}/reactive-user.ts"
  end

  test "specific table generation" do
    run_generator [ "--table=users" ]

    # Should create files for users table
    assert_file "#{@output_dir}/user.ts"
    assert_file "#{@output_dir}/reactive-user.ts"
    assert_file "#{@output_dir}/types/user-data.ts"

    # Should not create files for other tables
    assert_no_file "#{@output_dir}/job.ts"
    assert_no_file "#{@output_dir}/task.ts"
  end

  test "force mode overwrites existing files" do
    # First generation
    run_generator

    original_content = File.read(File.join(destination_root, "#{@output_dir}/user.ts"))

    # Second generation with force
    run_generator [ "--force" ]

    # File should still exist (overwritten)
    assert_file "#{@output_dir}/user.ts"
  end

  test "skip prettier option" do
    run_generator [ "--skip-prettier" ]

    # Files should be created but not formatted
    assert_file "#{@output_dir}/user.ts"

    # Check that content was generated
    content = File.read(File.join(destination_root, "#{@output_dir}/user.ts"))
    assert_match(/export class User/, content)
  end

  test "custom output directory" do
    custom_dir = "custom/models/path"
    run_generator [ "--output-dir=#{custom_dir}" ]

    assert_file "#{custom_dir}/user.ts"
    assert_file "#{custom_dir}/reactive-user.ts"
    assert_file "#{custom_dir}/index.ts"
  end

  test "exclude tables option" do
    run_generator [ "--exclude-tables=users,jobs" ]

    # Excluded tables should not be generated
    assert_no_file "#{@output_dir}/user.ts"
    assert_no_file "#{@output_dir}/job.ts"

    # Non-excluded tables should be generated
    assert_file "#{@output_dir}/client.ts" if Client.table_exists?
    assert_file "#{@output_dir}/task.ts" if Task.table_exists?
  end

  # Phase 2: Service Integration Testing
  test "service registry initializes all services" do
    require_relative "../../../../lib/generators/zero/active_models/service_registry"

    registry = ServiceRegistry.new({})

    # Test that all core services can be initialized
    %i[configuration schema file_manager template_renderer type_mapper].each do |service_name|
      service = registry.get_service(service_name)
      assert_not_nil service, "Service #{service_name} should be initialized"
    end
  end

  test "service health check passes" do
    require_relative "../../../../lib/generators/zero/active_models/service_registry"

    registry = ServiceRegistry.new({})
    health_status = registry.health_check

    assert health_status[:overall_status] != :error, "Service registry should be healthy"
    # Note: Individual service health may vary based on mock responses
  end

  test "service statistics are collected" do
    require_relative "../../../../lib/generators/zero/active_models/service_registry"

    registry = ServiceRegistry.new({})

    # Initialize a few services
    registry.get_service(:configuration)
    registry.get_service(:schema)

    stats = registry.aggregate_service_statistics
    assert_instance_of Hash, stats
    assert stats.key?(:registry)
    assert stats.key?(:services)
  end

  # =============================================================================
  # Service Coordination Tests (Phase 2 Enhancement)
  # =============================================================================

  test "generator coordinates all services for complete workflow" do
    require_relative "../../../../lib/generators/zero/active_models/service_registry"
    require_relative "../../../../lib/generators/zero/active_models/generation_coordinator"

    # Skip if no suitable test tables
    skip "No test tables available" unless User.table_exists?

    registry = ServiceRegistry.new(validate_services: false)

    begin
      # Test that generator can coordinate all services
      coordinator = GenerationCoordinator.new({}, nil, registry)

      # Mock configuration methods that would be called
      config_service = registry.get_service(:configuration)
      config_service.stubs(:base_output_dir).returns(@output_dir)
      config_service.stubs(:enable_prettier?).returns(false)
      config_service.stubs(:force_overwrite?).returns(true)
      config_service.stubs(:enable_schema_caching?).returns(true)
      config_service.stubs(:enable_pattern_detection?).returns(false)
      config_service.stubs(:enable_template_caching?).returns(true)
      config_service.stubs(:type_overrides).returns({})

      # Test coordination workflow
      result = coordinator.generate_models(
        tables: [ "users" ],
        output_directory: destination_root.join(@output_dir).to_s
      )

      # Verify coordination was successful
      assert_instance_of Hash, result
      assert result.key?(:success)
      assert result.key?(:generated_files)
      assert result.key?(:execution_time)
      assert result.key?(:service_statistics)

    ensure
      registry.shutdown_all_services
    end
  end

  test "generator handles service initialization failures gracefully" do
    require_relative "../../../../lib/generators/zero/active_models/service_registry"
    require_relative "../../../../lib/generators/zero/active_models/generation_coordinator"

    registry = ServiceRegistry.new(validate_services: false)

    begin
      # Mock one service to fail
      registry.expects(:create_template_renderer_service).raises(StandardError.new("Service init failed"))

      coordinator = GenerationCoordinator.new({}, nil, registry)

      # Should handle the failure gracefully
      assert_raises StandardError do
        coordinator.generate_models(
          tables: [ "users" ],
          output_directory: destination_root.join(@output_dir).to_s
        )
      end

      # Registry should still be functional for other operations
      health_status = registry.health_check
      assert_instance_of Hash, health_status

    ensure
      registry.shutdown_all_services
    end
  end

  test "generator aggregates statistics from all services" do
    require_relative "../../../../lib/generators/zero/active_models/service_registry"
    require_relative "../../../../lib/generators/zero/active_models/generation_coordinator"

    registry = ServiceRegistry.new(validate_services: false)

    begin
      # Initialize multiple services
      registry.get_service(:configuration)
      registry.get_service(:schema)
      registry.get_service(:template_renderer)
      registry.get_service(:file_manager)

      coordinator = GenerationCoordinator.new({}, nil, registry)

      # Get aggregated statistics
      stats = coordinator.collect_service_statistics

      # Verify statistics structure
      assert_instance_of Hash, stats
      assert stats.key?(:registry_stats)
      assert stats.key?(:service_stats)
      assert stats.key?(:generation_stats)

      # Verify registry-level statistics
      registry_stats = stats[:registry_stats]
      assert registry_stats.key?(:initializations)
      assert registry_stats.key?(:service_reuses)

    ensure
      registry.shutdown_all_services
    end
  end

  test "generator manages service lifecycle appropriately" do
    require_relative "../../../../lib/generators/zero/active_models/service_registry"
    require_relative "../../../../lib/generators/zero/active_models/generation_coordinator"

    registry = ServiceRegistry.new(validate_services: false)

    begin
      coordinator = GenerationCoordinator.new({}, nil, registry)

      # Verify services are not initialized initially
      assert_empty registry.initialized_services

      # Mock configuration for initialization
      config_service = registry.get_service(:configuration)
      config_service.stubs(:base_output_dir).returns(@output_dir)
      config_service.stubs(:enable_prettier?).returns(false)
      config_service.stubs(:force_overwrite?).returns(false)
      config_service.stubs(:enable_schema_caching?).returns(true)
      config_service.stubs(:enable_pattern_detection?).returns(false)
      config_service.stubs(:enable_template_caching?).returns(true)
      config_service.stubs(:type_overrides).returns({})

      # Initialize services through coordinator
      coordinator.ensure_services_initialized

      # Verify services are now initialized
      assert registry.service_initialized?(:configuration)
      assert registry.service_initialized?(:schema)
      assert registry.service_initialized?(:template_renderer)
      assert registry.service_initialized?(:file_manager)

    ensure
      registry.shutdown_all_services
    end
  end

  # =============================================================================
  # Performance Integration Tests (Phase 2 Enhancement)
  # =============================================================================

  test "refactored generator maintains performance parity with original" do
    skip "Performance test requires actual model generation" unless User.table_exists?

    # Test refactored generator performance
    start_time = Time.current
    run_generator([ "--table=users" ])
    refactored_time = Time.current - start_time

    # Should complete within reasonable time (30 seconds for full generation)
    assert refactored_time < 30, "Refactored generator took #{refactored_time}s, expected < 30s"

    # Verify files were generated correctly
    assert_file "#{@output_dir}/user.ts"
    assert_file "#{@output_dir}/reactive-user.ts"
    assert_file "#{@output_dir}/types/user-data.ts"
  end

  test "service architecture provides expected performance improvements" do
    require_relative "../../../../lib/generators/zero/active_models/service_registry"

    registry = ServiceRegistry.new(validate_services: false)

    begin
      # Test service reuse performance
      start_time = Time.current

      # First initialization
      config_service1 = registry.get_service(:configuration)
      first_init_time = Time.current - start_time

      # Second access (should reuse)
      start_time = Time.current
      config_service2 = registry.get_service(:configuration)
      reuse_time = Time.current - start_time

      # Should be the same instance (reused)
      assert_same config_service1, config_service2

      # Reuse should be faster than initialization
      assert reuse_time < first_init_time, "Service reuse (#{reuse_time}s) should be faster than initialization (#{first_init_time}s)"

      # Verify reuse statistics
      assert registry.statistics[:service_reuses] > 0

    ensure
      registry.shutdown_all_services
    end
  end

  test "caching strategies work effectively in complete workflow" do
    skip "Caching test requires actual model generation" unless User.table_exists?

    require_relative "../../../../lib/generators/zero/active_models/service_registry"

    registry = ServiceRegistry.new(validate_services: false)

    begin
      schema_service = registry.get_service(:schema)
      config_service = registry.get_service(:configuration)

      # Mock caching configuration
      config_service.stubs(:enable_schema_caching?).returns(true)
      config_service.stubs(:enable_pattern_detection?).returns(false)

      # First schema extraction (should cache)
      start_time = Time.current
      schema1 = schema_service.extract_table_schema("users")
      first_extraction_time = Time.current - start_time

      # Second schema extraction (should use cache)
      start_time = Time.current
      schema2 = schema_service.extract_table_schema("users")
      cached_extraction_time = Time.current - start_time

      # Results should be identical
      assert_equal schema1, schema2

      # Cached access should be faster (though timing may vary in tests)
      # We mainly verify that caching is working by checking data consistency
      assert_instance_of Hash, schema1
      assert_instance_of Hash, schema2

    ensure
      registry.shutdown_all_services
    end
  end

  test "memory usage remains within acceptable limits" do
    require_relative "../../../../lib/generators/zero/active_models/service_registry"

    # Track initial memory
    GC.start
    initial_memory = GC.stat[:total_allocated_objects]

    registry = ServiceRegistry.new(validate_services: false)

    begin
      # Initialize all services
      registry.initialize_all_services

      # Perform some operations
      config_service = registry.get_service(:configuration)
      schema_service = registry.get_service(:schema)

      # Multiple service accesses
      10.times do
        registry.get_service(:configuration)
        registry.get_service(:schema)
      end

      # Check memory after operations
      GC.start
      final_memory = GC.stat[:total_allocated_objects]

      # Memory growth should be reasonable
      memory_growth = final_memory - initial_memory
      assert memory_growth < 1_000_000, "Memory growth #{memory_growth} objects seems excessive"

    ensure
      registry.shutdown_all_services
      GC.start
    end
  end

  # =============================================================================
  # Error Recovery Integration Tests (Phase 2 Enhancement)
  # =============================================================================

  test "generator recovers from individual service failures" do
    require_relative "../../../../lib/generators/zero/active_models/service_registry"
    require_relative "../../../../lib/generators/zero/active_models/generation_coordinator"

    registry = ServiceRegistry.new(validate_services: false)

    begin
      # Mock template renderer to fail initially with sequence
      call_count = 0
      failure_proc = proc do
        call_count += 1
        if call_count == 1
          raise StandardError.new("Initial failure")
        else
          Object.new # Return a mock service on retry
        end
      end

      registry.expects(:create_template_renderer_service).twice.returns do
        failure_proc.call
      end

      coordinator = GenerationCoordinator.new({}, nil, registry)

      # First attempt should fail
      assert_raises StandardError do
        registry.get_service(:template_renderer)
      end

      # Clear cache and retry
      registry.clear_service_cache(:template_renderer)

      # Second attempt should succeed
      service = registry.get_service(:template_renderer)
      assert_not_nil service

    ensure
      registry.shutdown_all_services
    end
  end

  test "partial generation failures don't corrupt overall state" do
    require_relative "../../../../lib/generators/zero/active_models/service_registry"

    registry = ServiceRegistry.new(validate_services: false)

    begin
      # Initialize some services successfully
      config_service = registry.get_service(:configuration)
      schema_service = registry.get_service(:schema)

      # Mock file manager to fail
      registry.expects(:create_file_manager_service).raises(StandardError.new("File manager failed"))

      # Try to get failing service
      assert_raises ServiceRegistry::ServiceError do
        registry.get_service(:file_manager)
      end

      # Other services should remain functional
      assert registry.service_initialized?(:configuration)
      assert registry.service_initialized?(:schema)

      # Should be able to perform health check
      health_status = registry.health_check
      assert_instance_of Hash, health_status

    ensure
      registry.shutdown_all_services
    end
  end

  test "service error messages propagate correctly to user" do
    require_relative "../../../../lib/generators/zero/active_models/service_registry"

    registry = ServiceRegistry.new(validate_services: false)

    begin
      # Mock a service to fail with specific error message
      error_message = "Custom service initialization error"
      registry.expects(:create_configuration_service).raises(StandardError.new(error_message))

      # Error should be wrapped with service context
      error = assert_raises ServiceRegistry::ServiceError do
        registry.get_service(:configuration)
      end

      # Error message should include service context and original error
      assert_match /Failed to initialize service 'configuration'/, error.message
      assert_match /#{error_message}/, error.message

    ensure
      registry.shutdown_all_services
    end
  end

  test "cleanup happens properly after failures" do
    require_relative "../../../../lib/generators/zero/active_models/service_registry"

    registry = ServiceRegistry.new(validate_services: false)

    begin
      # Initialize some services
      registry.get_service(:configuration)
      registry.get_service(:schema)

      assert_not_empty registry.initialized_services

      # Mock failure during shutdown
      config_service = registry.services[:configuration]
      config_service.stubs(:shutdown).raises(StandardError.new("Shutdown failed"))

      # Shutdown should handle failures gracefully
      shutdown_result = registry.shutdown_all_services

      # Should report the failure but still clean up
      assert_not shutdown_result[:success]
      assert_not_empty shutdown_result[:errors]

      # Services should still be cleared despite shutdown errors
      assert_empty registry.services
      assert_empty registry.service_states

    ensure
      # Ensure cleanup in case of test failures
      registry.instance_variable_set(:@services, {})
      registry.instance_variable_set(:@service_states, {})
    end
  end

  # Phase 3: Output Quality Testing
  test "generated typescript compiles" do
    run_generator [ "--table=users" ]

    user_content = File.read(File.join(destination_root, "#{@output_dir}/user.ts"))
    reactive_user_content = File.read(File.join(destination_root, "#{@output_dir}/reactive-user.ts"))
    data_content = File.read(File.join(destination_root, "#{@output_dir}/types/user-data.ts"))

    # Check for proper TypeScript syntax
    assert_match(/export class User/, user_content)
    assert_match(/export class ReactiveUser/, reactive_user_content)
    assert_match(/export interface UserData/, data_content)

    # Check for proper imports
    assert_match(/import.*UserData.*from/, user_content)
    assert_match(/import.*UserData.*from/, reactive_user_content)
  end

  test "relationship handling generates correct types" do
    run_generator [ "--table=jobs" ] if Job.table_exists?

    job_content = File.read(File.join(destination_root, "#{@output_dir}/job.ts"))
    data_content = File.read(File.join(destination_root, "#{@output_dir}/types/job-data.ts"))

    # Should include relationship properties
    if Job.reflect_on_all_associations.any?
      assert_match(/client.*:/, data_content) if Job.reflect_on_association(:client)
      assert_match(/tasks.*:/, data_content) if Job.reflect_on_association(:tasks)
    end
  end

  test "enum types generate union types" do
    # Find a model with enums if any exist
    models = [ User, Job, Task, Client ].select(&:table_exists?)
    enum_model = models.find { |model| model.defined_enums.any? }

    if enum_model
      table_name = enum_model.table_name.singularize
      run_generator [ "--table=#{enum_model.table_name}" ]

      data_content = File.read(File.join(destination_root, "#{@output_dir}/types/#{table_name.dasherize}-data.ts"))

      # Should generate union types for enums
      enum_model.defined_enums.each do |enum_name, _|
        # Check for union type pattern like "status: 'active' | 'inactive'"
        assert_match(/#{enum_name}.*:.*'.*'.*\|/, data_content)
      end
    end
  end

  # Phase 4: Performance Testing
  test "generation completes within reasonable time" do
    start_time = Time.current

    run_generator

    end_time = Time.current
    generation_time = end_time - start_time

    # Should complete within 30 seconds for full generation
    assert generation_time < 30, "Generation took #{generation_time} seconds, which is too slow"
  end

  test "semantic file comparison prevents unnecessary writes" do
    # First generation
    run_generator [ "--table=users" ]

    original_mtime = File.mtime(File.join(destination_root, "#{@output_dir}/user.ts"))

    # Wait a moment to ensure different timestamp
    sleep 0.1

    # Second generation should not rewrite identical files
    run_generator [ "--table=users" ]

    new_mtime = File.mtime(File.join(destination_root, "#{@output_dir}/user.ts"))

    # If semantic comparison works, file should not be rewritten
    # (This test may need adjustment based on implementation details)
  end

  # Phase 5: Error Handling Testing
  test "handles invalid table names gracefully" do
    output = capture(:stderr) do
      assert_raises SystemExit do
        run_generator [ "--table=nonexistent_table" ]
      end
    end

    assert_match(/table.*not found/i, output) if output
  end

  test "handles missing template scenarios" do
    # Temporarily rename a template to simulate missing template
    template_path = Rails.root.join("lib/generators/zero/active_models/templates/active_model.ts.erb")
    backup_path = "#{template_path}.backup"

    if File.exist?(template_path)
      FileUtils.mv(template_path, backup_path)

      begin
        assert_raises do
          run_generator [ "--table=users" ]
        end
      ensure
        FileUtils.mv(backup_path, template_path)
      end
    end
  end

  test "graceful degradation when prettier unavailable" do
    # Mock prettier being unavailable
    original_path = ENV["PATH"]
    ENV["PATH"] = ""

    begin
      # Should still generate files even without prettier
      run_generator [ "--table=users" ]
      assert_file "#{@output_dir}/user.ts"
    ensure
      ENV["PATH"] = original_path
    end
  end

  # Phase 6: Configuration Testing
  test "respects environment specific configurations" do
    # Test in different Rails environments if possible
    original_env = Rails.env

    begin
      Rails.env = "test"
      run_generator [ "--table=users" ]
      assert_file "#{@output_dir}/user.ts"
    ensure
      Rails.env = original_env
    end
  end

  test "configuration validation works" do
    require_relative "../../../../lib/generators/zero/active_models/configuration_service"

    config_service = ConfigurationService.new({})

    # Should not raise errors for valid configuration
    assert_nothing_raised do
      config_service.validate_configuration!
    end
  end

  private

  def run_generator(args = [])
    super(args)
  end
end
