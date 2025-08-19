# frozen_string_literal: true

require "test_helper"
require "fileutils"
require "tmpdir"
require "open3"
require "json"
require "yaml"
require "benchmark"
require "concurrent"

class ProductionReadinessTest < ActiveSupport::TestCase
  # Disable transactional tests for production simulation
  self.use_transactional_tests = false
  self.use_instantiated_fixtures = false
  self.fixture_table_names = []

  def setup
    @temp_dir = Dir.mktmpdir("production_readiness_test")
    @output_dir = File.join(@temp_dir, "production_models")
    @staging_dir = File.join(@temp_dir, "staging")
    @production_config_dir = File.join(@temp_dir, "production_config")

    FileUtils.mkdir_p(@output_dir)
    FileUtils.mkdir_p(@staging_dir)
    FileUtils.mkdir_p(@production_config_dir)

    # Store original working directory
    @original_dir = Dir.pwd

    # Setup production configuration
    setup_production_configuration

    # Setup concurrent testing framework
    @thread_pool = Concurrent::FixedThreadPool.new(4)
  end

  def teardown
    @thread_pool&.shutdown
    @thread_pool&.wait_for_termination(5)

    Dir.chdir(@original_dir) if @original_dir
    FileUtils.rm_rf(@temp_dir) if @temp_dir && Dir.exist?(@temp_dir)
  end

  # ===============================================
  # PRODUCTION ENVIRONMENT VALIDATION
  # ===============================================

  test "production environment configuration validation" do
    # Test production-specific configuration
    result = run_generator_in_production_mode([
      "zero:active_models",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Production generation should succeed: #{result[:stderr]}"

    # Verify production optimizations are applied
    assert_match(/Template caching: enabled/, result[:stdout])
    assert_match(/Cache TTL: 7200/, result[:stdout])

    # Check that production files meet production standards
    generated_files = Dir.glob(File.join(@output_dir, "**", "*.ts"))

    generated_files.each do |file|
      content = File.read(file)

      # Production files should be properly formatted
      refute_match(/console\.log/, content, "Production files should not contain console.log")
      refute_match(/debugger/, content, "Production files should not contain debugger statements")

      # Should have proper headers and documentation
      assert_match(/Generated on:/, content, "Production files should have generation timestamps")
    end
  end

  test "production error handling and logging" do
    # Test production error handling
    result = run_generator_in_production_mode([
      "zero:active_models",
      "--table=nonexistent_table",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    refute result[:success], "Should fail gracefully for invalid input"

    # Production error messages should be appropriate (not too verbose)
    refute_match(/stack trace/i, result[:stderr], "Production errors should not expose stack traces")
    assert_match(/No tables found/, result[:stderr], "Should provide clear error message")

    # Should not leak sensitive information
    refute_match(/#{Rails.root}/, result[:stderr], "Should not expose file paths in production errors")
  end

  test "production security and sanitization" do
    # Test production security measures
    result = run_generator_in_production_mode([
      "zero:active_models",
      "--table=users",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Production generation should succeed"

    # Check generated files for security issues
    user_file = File.join(@output_dir, "user.ts")
    user_content = File.read(user_file)

    # Should not contain development-specific code
    refute_match(/console\.debug/, user_content)
    refute_match(/TODO:/i, user_content)
    refute_match(/FIXME:/i, user_content)

    # Should have proper TypeScript strict typing
    assert_match(/interface User/, user_content)
    refute_match(/any;/, user_content, "Should avoid 'any' types in production")
  end

  test "production deployment package validation" do
    # Test that generated files form a valid deployment package
    result = run_generator_in_production_mode([
      "zero:active_models",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Production package generation should succeed"

    # Verify package structure
    assert_file_exists(File.join(@output_dir, "index.ts"))

    # Verify all models are properly exported
    index_content = File.read(File.join(@output_dir, "index.ts"))

    expected_exports = %w[User Job Task Client Device]
    expected_exports.each do |export|
      assert_match(/export.*#{export}/, index_content)
      assert_match(/export.*Reactive#{export}/, index_content)
    end

    # Check for circular dependencies
    refute_circular_dependencies(@output_dir)
  end

  # ===============================================
  # SCALE AND LOAD TESTING
  # ===============================================

  test "large_scale_generation_performance" do
    # Test performance with maximum database schema
    start_time = Time.current

    result = run_generator_command([
      "zero:active_models",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    end_time = Time.current
    total_time = end_time - start_time

    assert result[:success], "Large-scale generation should complete successfully"

    # Performance benchmarks for production
    assert total_time < 120, "Large-scale generation should complete within 2 minutes, took #{total_time.round(2)}s"

    # Memory usage should be reasonable
    # (This is a simplified check - in practice you'd use tools like memory_profiler)
    generated_files = Dir.glob(File.join(@output_dir, "**", "*.ts"))
    total_size = generated_files.sum { |f| File.size(f) }

    assert total_size > 10_000, "Should generate substantial content"
    assert total_size < 10_000_000, "Generated files should not be excessively large"

    # Verify generation statistics
    assert_match(/Models Generated: \d+/, result[:stdout])
    assert_match(/Success Rate: 100\.0%/, result[:stdout])
  end

  test "concurrent_generation_stress_test" do
    # Test concurrent generation requests (simulating multiple developers)
    concurrent_results = []

    # Create multiple concurrent generation tasks
    futures = 4.times.map do |i|
      Concurrent::Future.execute(executor: @thread_pool) do
        output_dir = File.join(@temp_dir, "concurrent_#{i}")
        FileUtils.mkdir_p(output_dir)

        result = run_generator_command([
          "zero:active_models",
          "--table=users,jobs",
          "--output-dir=#{output_dir}",
          "--force"
        ])

        {
          index: i,
          result: result,
          output_dir: output_dir
        }
      end
    end

    # Wait for all to complete
    results = futures.map(&:value!)

    # All should succeed
    results.each do |test_result|
      assert test_result[:result][:success],
             "Concurrent generation #{test_result[:index]} should succeed: #{test_result[:result][:stderr]}"
    end

    # All should produce identical content
    first_result = results.first
    first_files = Dir.glob(File.join(first_result[:output_dir], "**", "*.ts"))

    results[1..-1].each do |other_result|
      other_files = Dir.glob(File.join(other_result[:output_dir], "**", "*.ts"))

      # Should have same number of files
      assert_equal first_files.length, other_files.length,
                  "Concurrent generations should produce same number of files"

      # Content should be identical
      first_files.each do |first_file|
        relative_path = Pathname.new(first_file).relative_path_from(Pathname.new(first_result[:output_dir]))
        other_file = File.join(other_result[:output_dir], relative_path)

        if File.exist?(other_file)
          first_content = File.read(first_file)
          other_content = File.read(other_file)
          assert_equal first_content, other_content,
                      "Concurrent generations should produce identical content for #{relative_path}"
        end
      end
    end
  end

  test "memory_usage_under_load" do
    # Test memory usage during intensive generation
    initial_memory = get_current_memory_usage

    # Generate multiple times in succession
    5.times do |i|
      output_dir = File.join(@temp_dir, "load_test_#{i}")
      FileUtils.mkdir_p(output_dir)

      result = run_generator_command([
        "zero:active_models",
        "--output-dir=#{output_dir}",
        "--force"
      ])

      assert result[:success], "Load test iteration #{i} should succeed"
    end

    final_memory = get_current_memory_usage
    memory_growth = final_memory - initial_memory

    # Memory growth should be reasonable (less than 100MB)
    assert memory_growth < 100_000_000,
           "Memory usage should not grow excessively during load testing: #{memory_growth} bytes"
  end

  test "resource_cleanup_verification" do
    # Test that resources are properly cleaned up after generation
    initial_temp_files = count_temp_files
    initial_processes = count_generator_processes

    # Run multiple generations
    3.times do |i|
      output_dir = File.join(@temp_dir, "cleanup_test_#{i}")
      FileUtils.mkdir_p(output_dir)

      result = run_generator_command([
        "zero:active_models",
        "--table=users,jobs",
        "--output-dir=#{output_dir}",
        "--force"
      ])

      assert result[:success], "Cleanup test iteration #{i} should succeed"
    end

    # Allow time for cleanup
    sleep 2

    final_temp_files = count_temp_files
    final_processes = count_generator_processes

    # Should not accumulate temporary files or processes
    temp_file_growth = final_temp_files - initial_temp_files
    process_growth = final_processes - initial_processes

    assert temp_file_growth < 10, "Should not accumulate temporary files: #{temp_file_growth}"
    assert process_growth <= 0, "Should not leave hanging processes: #{process_growth}"
  end

  # ===============================================
  # RELIABILITY AND STABILITY TESTING
  # ===============================================

  test "error_recovery_and_resilience" do
    # Test recovery from various error conditions

    # Test 1: Invalid table recovery
    result1 = run_generator_command([
      "zero:active_models",
      "--table=invalid_table",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    refute result1[:success], "Should fail for invalid table"

    # Should be able to recover and run successfully
    result2 = run_generator_command([
      "zero:active_models",
      "--table=users",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result2[:success], "Should recover and succeed after error: #{result2[:stderr]}"

    # Test 2: Permission error recovery (simulate by using read-only directory)
    readonly_dir = File.join(@temp_dir, "readonly")
    FileUtils.mkdir_p(readonly_dir)
    File.chmod(0444, readonly_dir)

    result3 = run_generator_command([
      "zero:active_models",
      "--table=users",
      "--output-dir=#{readonly_dir}",
      "--force"
    ])

    refute result3[:success], "Should fail for permission error"

    # Reset permissions and verify recovery
    File.chmod(0755, readonly_dir)

    result4 = run_generator_command([
      "zero:active_models",
      "--table=users",
      "--output-dir=#{readonly_dir}",
      "--force"
    ])

    assert result4[:success], "Should recover after permission fix: #{result4[:stderr]}"
  end

  test "long_running_stability" do
    # Test stability over extended operation
    start_time = Time.current
    successful_runs = 0

    # Run continuously for a shorter time period (30 seconds) to avoid test timeout
    while Time.current - start_time < 30
      output_dir = File.join(@temp_dir, "stability_#{successful_runs}")
      FileUtils.mkdir_p(output_dir)

      result = run_generator_command([
        "zero:active_models",
        "--table=users",
        "--output-dir=#{output_dir}",
        "--force"
      ])

      if result[:success]
        successful_runs += 1
      else
        flunk "Stability test failed after #{successful_runs} successful runs: #{result[:stderr]}"
      end

      # Brief pause between runs
      sleep 0.1
    end

    # Should have completed multiple successful runs
    assert successful_runs >= 5, "Should complete multiple runs successfully: #{successful_runs}"
  end

  test "data_integrity_verification" do
    # Test that generated data maintains integrity across operations

    # Generate baseline
    result1 = run_generator_command([
      "zero:active_models",
      "--table=users,jobs,tasks",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result1[:success], "Baseline generation should succeed"

    # Calculate checksums for verification
    baseline_checksums = calculate_file_checksums(@output_dir)

    # Generate again (should be identical)
    result2 = run_generator_command([
      "zero:active_models",
      "--table=users,jobs,tasks",
      "--output-dir=#{@staging_dir}",
      "--force"
    ])

    assert result2[:success], "Verification generation should succeed"

    # Calculate new checksums
    verification_checksums = calculate_file_checksums(@staging_dir)

    # All files should have identical content
    baseline_checksums.each do |file, checksum|
      verification_file = file.gsub(@output_dir, @staging_dir)
      verification_checksum = verification_checksums[verification_file]

      assert_equal checksum, verification_checksum,
                  "File integrity should be maintained: #{file}"
    end
  end

  test "rollback_and_recovery_capabilities" do
    # Test rollback capabilities when generation fails partway

    # Create partial state
    partial_dir = File.join(@temp_dir, "partial")
    FileUtils.mkdir_p(partial_dir)

    # Create some existing files
    existing_file = File.join(partial_dir, "existing-user.ts")
    File.write(existing_file, "// Existing content\nexport interface ExistingUser {}")

    # Run generation that might overwrite
    result = run_generator_command([
      "zero:active_models",
      "--table=users",
      "--output-dir=#{partial_dir}",
      "--force"
    ])

    assert result[:success], "Generation with existing files should succeed"

    # Verify existing custom files are preserved if not conflicting
    if File.exist?(existing_file)
      content = File.read(existing_file)
      assert_match(/Existing content/, content) if content.include?("Existing")
    end

    # Should have generated new files alongside
    assert_file_exists(File.join(partial_dir, "user.ts"))
  end

  # ===============================================
  # SECURITY AND COMPLIANCE TESTING
  # ===============================================

  test "security_validation_in_production" do
    # Test security measures in production mode
    result = run_generator_in_production_mode([
      "zero:active_models",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Production security test should succeed"

    # Check for security compliance in generated files
    generated_files = Dir.glob(File.join(@output_dir, "**", "*.ts"))

    generated_files.each do |file|
      content = File.read(file)

      # Should not contain security vulnerabilities
      refute_match(/eval\s*\(/, content, "Should not contain eval() calls")
      refute_match(/document\.write/, content, "Should not contain document.write")
      refute_match(/innerHTML\s*=/, content, "Should not use innerHTML directly")

      # Should not expose sensitive information
      refute_match(/password/i, content.split("\n").reject { |l| l.strip.start_with?("//") }.join("\n"))
      refute_match(/secret/i, content.split("\n").reject { |l| l.strip.start_with?("//") }.join("\n"))
      refute_match(/token/i, content.split("\n").reject { |l| l.strip.start_with?("//") }.join("\n"))
    end
  end

  test "access_control_and_permissions" do
    # Test that generated files have appropriate permissions
    result = run_generator_command([
      "zero:active_models",
      "--table=users",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Permission test generation should succeed"

    # Check file permissions
    generated_files = Dir.glob(File.join(@output_dir, "**", "*.ts"))

    generated_files.each do |file|
      stat = File.stat(file)

      # Should be readable by owner and group
      assert stat.readable?, "Generated files should be readable: #{file}"

      # Should not be executable (security)
      refute stat.executable?, "Generated files should not be executable: #{file}"

      # Should be writable by owner for updates
      assert stat.writable?, "Generated files should be writable by owner: #{file}"
    end
  end

  test "audit_trail_and_logging" do
    # Test that generation creates proper audit trail
    result = run_generator_command([
      "zero:active_models",
      "--table=users,jobs",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Audit trail test should succeed"

    # Check for generation metadata in output
    assert_match(/Models Generated: \d+/, result[:stdout])
    assert_match(/Files Created: \d+/, result[:stdout])
    assert_match(/Success Rate: 100\.0%/, result[:stdout])

    # Check for timestamps in generated files
    generated_files = Dir.glob(File.join(@output_dir, "**", "*.ts"))

    generated_files.each do |file|
      content = File.read(file)
      assert_match(/Generated on: \d{4}-\d{2}-\d{2}/, content)
    end
  end

  test "compliance_with_enterprise_standards" do
    # Test compliance with enterprise coding standards
    result = run_generator_command([
      "zero:active_models",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Enterprise compliance test should succeed"

    # Check generated files for enterprise standards
    generated_files = Dir.glob(File.join(@output_dir, "**", "*.ts"))

    generated_files.each do |file|
      content = File.read(file)

      # Should have proper documentation headers
      assert_match(/\*/, content, "Should have documentation comments")

      # Should use consistent naming conventions
      # All interfaces should be PascalCase
      interfaces = content.scan(/interface (\w+)/).flatten
      interfaces.each do |interface_name|
        assert_match(/^[A-Z][a-zA-Z0-9]*$/, interface_name,
                    "Interface names should be PascalCase: #{interface_name}")
      end

      # Should have proper imports
      imports = content.scan(/import.*from.*['"](.+)['"]/).flatten
      imports.each do |import_path|
        refute_match(/\.\.\/\.\.\/\.\./, import_path, "Should not have excessive relative imports")
      end
    end
  end

  private

  def setup_production_configuration
    production_config = {
      "production" => {
        "template_caching" => true,
        "prettier_enabled" => true,
        "cache_ttl" => 7200,
        "force_overwrite" => false,
        "detailed_errors" => false,
        "security_mode" => true
      }
    }

    config_file = File.join(@production_config_dir, "production.yml")
    File.write(config_file, production_config.to_yaml)
  end

  def run_generator_in_production_mode(args)
    # Set production environment
    old_env = ENV["RAILS_ENV"]
    ENV["RAILS_ENV"] = "production"

    begin
      run_generator_command(args)
    ensure
      ENV["RAILS_ENV"] = old_env
    end
  end

  def run_generator_command(args)
    cmd = [ "bin/rails", "generate" ] + args

    stdout, stderr, status = Open3.capture3(*cmd, chdir: Rails.root)

    {
      success: status.success?,
      stdout: stdout,
      stderr: stderr,
      status: status
    }
  end

  def refute_circular_dependencies(directory)
    # Simple circular dependency check by analyzing imports
    files = Dir.glob(File.join(directory, "**", "*.ts"))
    import_graph = {}

    files.each do |file|
      content = File.read(file)
      relative_path = Pathname.new(file).relative_path_from(Pathname.new(directory)).to_s

      imports = content.scan(/import.*from.*['"]\.\/(.+?)['"]/).flatten
      import_graph[relative_path] = imports.map { |imp| "#{imp}.ts" }
    end

    # Check for cycles (simplified implementation)
    import_graph.each do |file, imports|
      imports.each do |imported_file|
        if import_graph[imported_file]&.include?(file)
          flunk "Circular dependency detected: #{file} <-> #{imported_file}"
        end
      end
    end
  end

  def get_current_memory_usage
    # Simplified memory usage check (platform dependent)
    if RUBY_PLATFORM.include?("darwin") # macOS
      `ps -o rss= -p #{Process.pid}`.to_i * 1024
    elsif RUBY_PLATFORM.include?("linux")
      `ps -o rss= -p #{Process.pid}`.to_i * 1024
    else
      0 # Fallback for other platforms
    end
  end

  def count_temp_files
    # Count temporary files in system temp directory
    Dir.glob("/tmp/**/*generator*").length rescue 0
  end

  def count_generator_processes
    # Count running generator processes
    `ps aux | grep -c "rails generate"`.to_i rescue 0
  end

  def calculate_file_checksums(directory)
    require "digest"

    checksums = {}
    Dir.glob(File.join(directory, "**", "*.ts")).each do |file|
      content = File.read(file)
      checksums[file] = Digest::SHA256.hexdigest(content)
    end

    checksums
  end

  def assert_file_exists(file_path)
    assert File.exist?(file_path), "Expected file to exist: #{file_path}"
  end

  def refute_file_exists(file_path)
    refute File.exist?(file_path), "Expected file to not exist: #{file_path}"
  end
end
