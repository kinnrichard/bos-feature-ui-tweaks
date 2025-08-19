# frozen_string_literal: true

require "test_helper"
require "fileutils"
require "tmpdir"
require "open3"
require "json"
require "yaml"

class E2EWorkflowTest < ActiveSupport::TestCase
  # Disable transactional tests for external command testing
  self.use_transactional_tests = false
  self.use_instantiated_fixtures = false
  self.fixture_table_names = []

  def setup
    @temp_dir = Dir.mktmpdir("e2e_workflow_test")
    @output_dir = File.join(@temp_dir, "generated_models")
    @test_config_dir = File.join(@temp_dir, "config")
    @test_config_file = File.join(@test_config_dir, "test_config.yml")

    FileUtils.mkdir_p(@output_dir)
    FileUtils.mkdir_p(@test_config_dir)

    # Create test configuration
    create_test_configuration

    # Store original working directory
    @original_dir = Dir.pwd

    # Setup temporary frontend directory structure
    setup_test_frontend_environment
  end

  def teardown
    Dir.chdir(@original_dir) if @original_dir
    FileUtils.rm_rf(@temp_dir) if @temp_dir && Dir.exist?(@temp_dir)
  end

  # ===============================================
  # COMPLETE GENERATION WORKFLOW TESTS
  # ===============================================

  test "complete database generation workflow produces all expected files" do
    # Test complete database generation with all tables
    result = run_generator_command([
      "zero:active_models",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Generator should complete successfully: #{result[:stderr]}"

    # Verify all expected models are generated
    expected_models = %w[
      activity_log client contact_method device job job_assignment
      job_person job_target note person scheduled_date_time
      scheduled_date_time_user task user
    ]

    expected_models.each do |model|
      # Check for all three file types per model
      assert_file_exists(File.join(@output_dir, "#{model.tr('_', '-')}.ts"))
      assert_file_exists(File.join(@output_dir, "reactive-#{model.tr('_', '-')}.ts"))
      assert_file_exists(File.join(@output_dir, "types", "#{model.tr('_', '-')}-data.ts"))
    end

    # Verify index.ts file
    assert_file_exists(File.join(@output_dir, "index.ts"))

    # Verify generation statistics
    assert_match(/Models Generated: \d+/, result[:stdout])
    assert_match(/Files Created: \d+/, result[:stdout])
    assert_match(/Success Rate: 100\.0%/, result[:stdout])
  end

  test "specific table subset generation with complex filtering" do
    # Test generation with specific table filtering
    tables = %w[users jobs tasks]

    result = run_generator_command([
      "zero:active_models",
      "--table=#{tables.join(',')}",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Subset generation should succeed: #{result[:stderr]}"

    # Verify only specified tables are generated
    tables.each do |table|
      model_name = table.singularize.tr("_", "-")
      assert_file_exists(File.join(@output_dir, "#{model_name}.ts"))
      assert_file_exists(File.join(@output_dir, "reactive-#{model_name}.ts"))
      assert_file_exists(File.join(@output_dir, "types", "#{model_name}-data.ts"))
    end

    # Verify unspecified tables are not generated
    excluded_tables = %w[clients devices notes]
    excluded_tables.each do |table|
      model_name = table.singularize.tr("_", "-")
      refute_file_exists(File.join(@output_dir, "#{model_name}.ts"))
    end
  end

  test "mixed table types and complex relationships workflow" do
    # Test generation with tables that have various relationship types
    result = run_generator_command([
      "zero:active_models",
      "--table=jobs,job_assignments,job_people,tasks",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Mixed relationships generation should succeed"

    # Verify relationship-heavy files are generated
    job_content = File.read(File.join(@output_dir, "job.ts"))

    # Check for proper relationship imports and types
    assert_match(/import.*JobAssignment/, job_content)
    assert_match(/import.*JobPerson/, job_content)
    assert_match(/import.*Task/, job_content)

    # Verify relationship methods exist
    assert_match(/job_assignments/, job_content)
    assert_match(/job_people/, job_content)
    assert_match(/tasks/, job_content)

    # Check reactive model has proper reactive imports
    reactive_job_content = File.read(File.join(@output_dir, "reactive-job.ts"))
    assert_match(/import.*ReactiveJobAssignment/, reactive_job_content)
    assert_match(/import.*ReactiveTask/, reactive_job_content)
  end

  test "valid typescript output compilation workflow" do
    # Generate models
    result = run_generator_command([
      "zero:active_models",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Generation should succeed for compilation test"

    # Copy generated files to test frontend
    copy_generated_files_to_frontend

    # Test TypeScript compilation
    compilation_result = run_typescript_compilation

    assert compilation_result[:success],
           "Generated TypeScript should compile without errors: #{compilation_result[:stderr]}"

    # Verify no compilation errors
    refute_match(/error TS\d+/, compilation_result[:stderr])
    refute_match(/Error:/, compilation_result[:stderr])
  end

  # ===============================================
  # REAL-WORLD SCENARIO TESTS
  # ===============================================

  test "typical rails application schema processing" do
    # Test processing a typical Rails app schema structure
    result = run_generator_command([
      "zero:active_models",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Rails schema processing should succeed"

    # Verify typical Rails patterns are handled
    user_content = File.read(File.join(@output_dir, "user.ts"))

    # Check for common Rails patterns
    assert_match(/id: string/, user_content) # UUID primary key
    assert_match(/created_at: string/, user_content) # Timestamps
    assert_match(/updated_at: string/, user_content)

    # Check enum handling
    assert_match(/role: 'admin' \| 'technician' \| 'customer_specialist' \| 'owner'/, user_content)

    # Check relationship patterns
    client_content = File.read(File.join(@output_dir, "client.ts"))
    assert_match(/users\(\)/, client_content) # has_many relationship
  end

  test "complex relationships scenario handling" do
    # Test complex relationship scenarios (polymorphic, through, etc.)
    result = run_generator_command([
      "zero:active_models",
      "--table=activity_logs,notes",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Complex relationships should be handled"

    # Check polymorphic relationship handling
    note_content = File.read(File.join(@output_dir, "note.ts"))

    # Should handle polymorphic associations
    assert_match(/notable_type: string/, note_content)
    assert_match(/notable_id: string/, note_content)

    # Activity log should handle polymorphic loggable
    activity_log_content = File.read(File.join(@output_dir, "activity-log.ts"))
    assert_match(/loggable_type: string/, activity_log_content)
    assert_match(/loggable_id: string/, activity_log_content)
  end

  test "enum-heavy table structure processing" do
    # Test tables with multiple enum fields
    result = run_generator_command([
      "zero:active_models",
      "--table=jobs,tasks,users,clients",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Enum-heavy generation should succeed"

    # Verify enum handling in multiple models
    models_with_enums = {
      "job.ts" => [ "status", "priority" ],
      "task.ts" => [ "status" ],
      "user.ts" => [ "role" ],
      "client.ts" => [ "client_type" ]
    }

    models_with_enums.each do |file, enums|
      content = File.read(File.join(@output_dir, file))
      enums.each do |enum_field|
        assert_match(/#{enum_field}: '.*' \| '.*'/, content)
      end
    end
  end

  test "large-scale enterprise schema handling" do
    # Test performance with full schema (simulating enterprise scale)
    start_time = Time.current

    result = run_generator_command([
      "zero:active_models",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    end_time = Time.current
    generation_time = end_time - start_time

    assert result[:success], "Large-scale generation should succeed"

    # Verify performance is acceptable (should complete within 60 seconds)
    assert generation_time < 60, "Generation should complete within 60 seconds, took #{generation_time}"

    # Verify all files are generated
    generated_files = Dir.glob(File.join(@output_dir, "**", "*.ts"))

    # Should have 3 files per model plus index (14 models * 3 + 1 = 43)
    assert generated_files.length >= 40, "Should generate substantial number of files"

    # Verify files have reasonable size (not empty, not huge)
    generated_files.each do |file|
      size = File.size(file)
      assert size > 100, "Generated file #{file} should not be empty"
      assert size < 50_000, "Generated file #{file} should not be excessively large"
    end
  end

  # ===============================================
  # EXTERNAL TOOL INTEGRATION TESTS
  # ===============================================

  test "typescript compiler compatibility validation" do
    # Generate models and test TypeScript compilation
    result = run_generator_command([
      "zero:active_models",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Generation for TypeScript test should succeed"

    copy_generated_files_to_frontend

    # Test strict TypeScript compilation
    compilation_result = run_typescript_compilation("--strict --noImplicitAny")

    assert compilation_result[:success],
           "Generated code should pass strict TypeScript compilation: #{compilation_result[:stderr]}"
  end

  test "eslint validation and compliance" do
    # Generate models and test ESLint compliance
    result = run_generator_command([
      "zero:active_models",
      "--table=users,jobs",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Generation for ESLint test should succeed"

    copy_generated_files_to_frontend

    # Run ESLint on generated files
    eslint_result = run_eslint_validation

    assert eslint_result[:success],
           "Generated code should pass ESLint validation: #{eslint_result[:stderr]}"
  end

  test "frontend build system integration" do
    # Test integration with actual frontend build system
    result = run_generator_command([
      "zero:active_models",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Generation should succeed"

    copy_generated_files_to_frontend

    # Test build system integration
    build_result = run_frontend_build

    assert build_result[:success],
           "Frontend build should succeed with generated models: #{build_result[:stderr]}"
  end

  test "zero_js framework compatibility" do
    # Test Zero.js specific compatibility
    result = run_generator_command([
      "zero:active_models",
      "--table=users,clients",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Generation should succeed"

    # Verify Zero.js specific patterns
    user_content = File.read(File.join(@output_dir, "user.ts"))

    # Check for Zero.js compatibility patterns
    assert_match(/export.*User/, user_content)

    # Check reactive model
    reactive_user_content = File.read(File.join(@output_dir, "reactive-user.ts"))
    assert_match(/import.*User/, reactive_user_content)

    # Check index file exports
    index_content = File.read(File.join(@output_dir, "index.ts"))
    assert_match(/export.*User/, index_content)
    assert_match(/export.*ReactiveUser/, index_content)
  end

  test "svelte component integration" do
    # Test Svelte 5 reactive integration
    result = run_generator_command([
      "zero:active_models",
      "--table=tasks",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Generation should succeed"

    # Check reactive model for Svelte 5 patterns
    reactive_task_content = File.read(File.join(@output_dir, "reactive-task.ts"))

    # Should be compatible with Svelte 5 reactivity
    assert_match(/import.*Task/, reactive_task_content)
    # The reactive pattern should extend the base model
    assert_match(/extends.*Task/, reactive_task_content)
  end

  # ===============================================
  # REGRESSION PREVENTION TESTS
  # ===============================================

  test "backward compatibility with existing files" do
    # Create initial generation
    initial_result = run_generator_command([
      "zero:active_models",
      "--table=users",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert initial_result[:success], "Initial generation should succeed"

    # Get initial file content
    initial_content = File.read(File.join(@output_dir, "user.ts"))
    initial_mtime = File.mtime(File.join(@output_dir, "user.ts"))

    # Wait to ensure different timestamp
    sleep 1

    # Run generation again
    repeat_result = run_generator_command([
      "zero:active_models",
      "--table=users",
      "--output-dir=#{@output_dir}"
    ])

    assert repeat_result[:success], "Repeat generation should succeed"

    # Check that files weren't unnecessarily modified
    final_content = File.read(File.join(@output_dir, "user.ts"))
    final_mtime = File.mtime(File.join(@output_dir, "user.ts"))

    assert_equal initial_content, final_content, "File content should remain identical"
    # File modification time should be similar (idempotent)
    assert_in_delta initial_mtime.to_f, final_mtime.to_f, 2.0, "File should not be modified unnecessarily"
  end

  test "consistent output across multiple runs" do
    # Run generation multiple times and verify consistency
    results = []

    3.times do |i|
      output_dir = File.join(@temp_dir, "run_#{i}")
      FileUtils.mkdir_p(output_dir)

      result = run_generator_command([
        "zero:active_models",
        "--table=users,jobs",
        "--output-dir=#{output_dir}",
        "--force"
      ])

      assert result[:success], "Run #{i} should succeed"

      # Collect file contents
      run_results = {}
      Dir.glob(File.join(output_dir, "**", "*.ts")).each do |file|
        relative_path = Pathname.new(file).relative_path_from(Pathname.new(output_dir))
        run_results[relative_path.to_s] = File.read(file)
      end

      results << run_results
    end

    # Verify all runs produced identical output
    results[1..-1].each_with_index do |run_result, index|
      run_result.each do |file, content|
        assert_equal results[0][file], content,
                    "File #{file} should be identical across runs (run #{index + 1})"
      end
    end
  end

  test "schema evolution handling" do
    # Simulate schema changes and verify graceful handling

    # Initial generation
    result = run_generator_command([
      "zero:active_models",
      "--table=users",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Initial generation should succeed"

    # Verify generation handles current schema
    user_content = File.read(File.join(@output_dir, "user.ts"))
    assert_match(/interface User/, user_content)

    # Test that generator handles missing tables gracefully
    missing_table_result = run_generator_command([
      "zero:active_models",
      "--table=nonexistent_table",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    # Should handle gracefully without crashing
    refute missing_table_result[:success], "Should fail gracefully for missing table"
    assert_match(/No tables found/, missing_table_result[:stderr])
  end

  test "manual customization preservation" do
    # Test that manual customizations can coexist

    # Generate initial files
    result = run_generator_command([
      "zero:active_models",
      "--table=users",
      "--output-dir=#{@output_dir}",
      "--force"
    ])

    assert result[:success], "Initial generation should succeed"

    # Create a custom file that shouldn't be overwritten
    custom_file = File.join(@output_dir, "custom-user-extensions.ts")
    File.write(custom_file, "// Custom user extensions\nexport const customUserMethod = () => {};")

    # Run generator again
    repeat_result = run_generator_command([
      "zero:active_models",
      "--table=users",
      "--output-dir=#{@output_dir}"
    ])

    assert repeat_result[:success], "Repeat generation should succeed"

    # Custom file should still exist and be unchanged
    assert_file_exists(custom_file)
    custom_content = File.read(custom_file)
    assert_match(/Custom user extensions/, custom_content)
    assert_match(/customUserMethod/, custom_content)
  end

  private

  def create_test_configuration
    config = {
      "development" => {
        "template_caching" => true,
        "prettier_enabled" => true,
        "cache_ttl" => 3600
      },
      "test" => {
        "template_caching" => false,
        "prettier_enabled" => false,
        "force_overwrite" => true
      },
      "production" => {
        "template_caching" => true,
        "prettier_enabled" => true,
        "cache_ttl" => 7200
      }
    }

    File.write(@test_config_file, config.to_yaml)
  end

  def setup_test_frontend_environment
    @frontend_dir = File.join(@temp_dir, "frontend")
    @frontend_src_dir = File.join(@frontend_dir, "src", "lib", "models")

    FileUtils.mkdir_p(@frontend_src_dir)

    # Create minimal package.json for TypeScript compilation
    package_json = {
      "name" => "test-frontend",
      "version" => "1.0.0",
      "devDependencies" => {
        "typescript" => "^5.0.0",
        "@types/node" => "^20.0.0"
      }
    }

    File.write(File.join(@frontend_dir, "package.json"), JSON.pretty_generate(package_json))

    # Create minimal tsconfig.json
    tsconfig = {
      "compilerOptions" => {
        "target" => "ES2022",
        "module" => "ESNext",
        "strict" => true,
        "esModuleInterop" => true,
        "skipLibCheck" => true,
        "forceConsistentCasingInFileNames" => true,
        "moduleResolution" => "node",
        "outDir" => "./dist"
      },
      "include" => [ "src/**/*" ],
      "exclude" => [ "node_modules", "dist" ]
    }

    File.write(File.join(@frontend_dir, "tsconfig.json"), JSON.pretty_generate(tsconfig))
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

  def copy_generated_files_to_frontend
    Dir.glob(File.join(@output_dir, "**", "*.ts")).each do |file|
      relative_path = Pathname.new(file).relative_path_from(Pathname.new(@output_dir))
      dest_file = File.join(@frontend_src_dir, relative_path)

      FileUtils.mkdir_p(File.dirname(dest_file))
      FileUtils.cp(file, dest_file)
    end
  end

  def run_typescript_compilation(extra_flags = "")
    # Install TypeScript if needed (using npm)
    install_cmd = "npm install --silent"
    Open3.capture3(install_cmd, chdir: @frontend_dir)

    # Run TypeScript compilation
    compile_cmd = "npx tsc #{extra_flags} --noEmit"
    stdout, stderr, status = Open3.capture3(compile_cmd, chdir: @frontend_dir)

    {
      success: status.success?,
      stdout: stdout,
      stderr: stderr
    }
  end

  def run_eslint_validation
    # Create minimal ESLint config
    eslint_config = {
      "env" => {
        "es2022" => true,
        "node" => true
      },
      "extends" => [ "eslint:recommended" ],
      "parserOptions" => {
        "ecmaVersion" => "latest",
        "sourceType" => "module"
      },
      "rules" => {}
    }

    File.write(File.join(@frontend_dir, ".eslintrc.json"), JSON.pretty_generate(eslint_config))

    # Install ESLint
    install_cmd = "npm install --silent eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin"
    Open3.capture3(install_cmd, chdir: @frontend_dir)

    # Run ESLint
    lint_cmd = "npx eslint src/lib/models/**/*.ts"
    stdout, stderr, status = Open3.capture3(lint_cmd, chdir: @frontend_dir)

    {
      success: status.success?,
      stdout: stdout,
      stderr: stderr
    }
  end

  def run_frontend_build
    # Simplified build test - just TypeScript compilation
    run_typescript_compilation
  end

  def assert_file_exists(file_path)
    assert File.exist?(file_path), "Expected file to exist: #{file_path}"
  end

  def refute_file_exists(file_path)
    refute File.exist?(file_path), "Expected file to not exist: #{file_path}"
  end
end
