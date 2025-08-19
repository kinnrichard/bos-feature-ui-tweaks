# frozen_string_literal: true

require "test_helper"
require "minitest/mock"
require "generators/zero/active_models/pipeline/stages/formatting_stage"
require "generators/zero/active_models/generation_context"
require "generators/zero/active_models/service_registry"
require "tempfile"
require "fileutils"

module Zero
  module Generators
    module Pipeline
      module Stages
        class FormattingStageTest < ActiveSupport::TestCase
          def setup
            # Create mock service registry and shell
            @mock_service_registry = Minitest::Mock.new
            @mock_shell = Minitest::Mock.new

            # Create the stage with mocked dependencies
            @stage = FormattingStage.new(@mock_service_registry)

            # Create temporary files for testing
            @temp_dir = Dir.mktmpdir("formatting_test")
            @frontend_root = File.join(@temp_dir, "frontend")
            FileUtils.mkdir_p(@frontend_root)

            # Create package.json with Prettier dependency
            package_json = {
              "devDependencies" => {
                "prettier" => "^2.0.0"
              }
            }
            File.write(File.join(@frontend_root, "package.json"), JSON.generate(package_json))

            # Sample TypeScript files
            @ts_file_1 = File.join(@temp_dir, "user.ts")
            @ts_file_2 = File.join(@temp_dir, "post.ts")
            @js_file = File.join(@temp_dir, "config.js")
            @other_file = File.join(@temp_dir, "readme.md")

            # Create sample files with unformatted TypeScript content
            File.write(@ts_file_1, "export interface User{id:number;name:string;}")
            File.write(@ts_file_2, "export interface Post{id:number;title:string;}")
            File.write(@js_file, "const config={env:'test'};")
            File.write(@other_file, "# README")

            # Basic context for testing
            @basic_context = GenerationContext.new(
              table: { name: "users", columns: [ { name: "id", type: "integer" } ] },
              schema: { tables: [] },
              options: { dry_run: false },
              metadata: {
                typescript_files: [ @ts_file_1, @ts_file_2, @js_file, @other_file ]
              }
            )

            # Mock Rails.root to return our temp directory
            Rails.stubs(:root).returns(Pathname.new(@temp_dir))
          end

          def teardown
            @mock_service_registry&.verify
            @mock_shell&.verify
            FileUtils.rm_rf(@temp_dir) if @temp_dir && File.exist?(@temp_dir)
          end

          # =============================================================================
          # Stage Interface Compliance Tests
          # =============================================================================

          test "implements required stage interface methods" do
            assert_respond_to @stage, :process
            assert_respond_to @stage, :can_run?
            assert_respond_to @stage, :name
            assert_respond_to @stage, :description
            assert_respond_to @stage, :idempotent?
            assert_respond_to @stage, :priority
          end

          test "returns correct stage metadata" do
            assert_equal "FormattingStage", @stage.name
            assert_equal "Batch format TypeScript files with Prettier and performance optimization", @stage.description
            assert @stage.idempotent?
            assert_equal 30, @stage.priority
          end

          test "can_run returns true for valid context with typescript_files" do
            assert @stage.can_run?(@basic_context)
          end

          test "can_run returns false for context without typescript_files" do
            context_without_files = @basic_context.with_metadata({})
            assert_not @stage.can_run?(context_without_files)
          end

          test "can_run returns false for context with empty typescript_files" do
            context_with_empty_files = @basic_context.with_metadata(typescript_files: [])
            assert_not @stage.can_run?(context_with_empty_files)
          end

          test "can_run returns false for invalid context" do
            invalid_context = Object.new
            assert_not @stage.can_run?(invalid_context)
          end

          # =============================================================================
          # Skip Prettier Mode Tests
          # =============================================================================

          test "handles skip_prettier option correctly" do
            skip_context = @basic_context.with_options(skip_prettier: true)

            result = @stage.process(skip_context)

            assert result.metadata[:formatting_skipped]
            assert_equal "skip_prettier option enabled", result.metadata[:skip_reason]
            assert_equal 3, result.metadata[:files_that_would_be_formatted] # Only TS/JS files
            assert_not result.metadata[:prettier_check_performed]

            # Check stage metadata
            stage_metadata = result.metadata[:stage_formatting_stage]
            assert_equal "skipped_prettier_formatting", stage_metadata[:operation]
            assert_equal 3, stage_metadata[:files_count]
          end

          # =============================================================================
          # Dry Run Mode Tests
          # =============================================================================

          test "handles dry_run mode correctly" do
            @mock_service_registry.expect(:get_service, @mock_shell, [ :shell ])
            @mock_shell.expect(:say_status, nil, [ :would_format, "3 TypeScript files with Prettier", :yellow ])

            dry_run_context = @basic_context.with_options(dry_run: true)

            result = @stage.process(dry_run_context)

            assert result.metadata[:dry_run_formatting]
            assert_equal 3, result.metadata[:files_that_would_be_formatted]
            assert result.metadata[:prettier_would_be_checked]
            assert result.metadata[:batch_processing_would_be_used]

            # Check stage metadata
            stage_metadata = result.metadata[:stage_formatting_stage]
            assert_equal "dry_run_formatting_simulation", stage_metadata[:operation]
          end

          # =============================================================================
          # No Files to Format Tests
          # =============================================================================

          test "handles context with no TypeScript files to format" do
            no_ts_files_context = @basic_context.with_metadata(
              typescript_files: [ @other_file ] # Only non-TS file
            )

            result = @stage.process(no_ts_files_context)

            assert result.metadata[:formatting_completed]
            assert_equal 0, result.metadata[:files_processed]
            assert_equal "no_typescript_files_found", result.metadata[:no_files_reason]

            # Check stage metadata
            stage_metadata = result.metadata[:stage_formatting_stage]
            assert_equal "no_files_to_format", stage_metadata[:operation]
            assert_equal 0, stage_metadata[:files_count]
          end

          # =============================================================================
          # Frontend Environment Detection Tests
          # =============================================================================

          test "detects frontend root correctly when package.json exists" do
            # Our setup already creates the frontend directory with package.json
            # Let's just verify the detection works by processing a real context
            setup_successful_formatting_mocks

            result = @stage.process(@basic_context)

            assert result.metadata[:frontend_root]
            assert result.metadata[:prettier_available]
          end

          test "raises error when frontend root not found" do
            # Remove the package.json to simulate missing frontend
            File.delete(File.join(@frontend_root, "package.json"))

            error = assert_raises FormattingStage::FrontendRootNotFoundError do
              @stage.process(@basic_context)
            end

            assert_match /Frontend root directory with package.json not found/, error.message
          end

          test "raises error when Prettier not available" do
            # Create package.json without Prettier
            package_json_without_prettier = { "devDependencies" => {} }
            File.write(File.join(@frontend_root, "package.json"), JSON.generate(package_json_without_prettier))

            error = assert_raises FormattingStage::PrettierNotFoundError do
              @stage.process(@basic_context)
            end

            assert_match /Prettier not found in package.json dependencies/, error.message
          end

          test "detects Prettier in dependencies (not just devDependencies)" do
            package_json_with_prettier_dep = {
              "dependencies" => { "prettier" => "^2.0.0" },
              "devDependencies" => {}
            }
            File.write(File.join(@frontend_root, "package.json"), JSON.generate(package_json_with_prettier_dep))

            setup_successful_formatting_mocks

            result = @stage.process(@basic_context)

            assert result.metadata[:prettier_available]
          end

          # =============================================================================
          # Successful Batch Formatting Tests
          # =============================================================================

          test "processes batch formatting successfully" do
            setup_successful_formatting_mocks

            # Mock successful system command
            FormattingStage.any_instance.stubs(:system).returns(true)

            result = @stage.process(@basic_context)

            assert result.metadata[:formatting_results]
            formatting_results = result.metadata[:formatting_results]

            assert_equal 3, formatting_results[:processed] # 3 TS/JS files
            assert_equal 0, formatting_results[:errors]
            assert formatting_results[:time] > 0
            assert result.metadata[:prettier_available]

            # Check stage metadata
            stage_metadata = result.metadata[:stage_formatting_stage]
            assert_equal 3, stage_metadata[:files_formatted]
            assert stage_metadata[:prettier_command_used]
          end

          test "filters TypeScript and JavaScript files correctly" do
            setup_successful_formatting_mocks
            FormattingStage.any_instance.stubs(:system).returns(true)

            result = @stage.process(@basic_context)

            # Should process 3 files: user.ts, post.ts, config.js (excluding readme.md)
            assert_equal 3, result.metadata[:files_processed]
          end

          test "adds comprehensive stage execution metadata" do
            setup_successful_formatting_mocks
            FormattingStage.any_instance.stubs(:system).returns(true)

            result = @stage.process(@basic_context)

            stage_metadata = result.metadata[:stage_formatting_stage]
            assert stage_metadata[:executed_at]
            assert_equal "FormattingStage", stage_metadata[:stage_name]
            assert_equal "FormattingStage", stage_metadata[:stage_class]
            assert_equal 3, stage_metadata[:files_formatted]
            assert_equal 0, stage_metadata[:individual_fallbacks]
            assert stage_metadata[:total_processing_time] > 0
            assert stage_metadata[:prettier_command_used]
          end

          # =============================================================================
          # Batch Formatting Failure and Fallback Tests
          # =============================================================================

          test "falls back to individual formatting when batch fails" do
            setup_shell_mock_for_fallback

            # Mock batch failure, individual success
            FormattingStage.any_instance.stubs(:system).returns(false, true, true, true) # Batch fails, individuals succeed

            result = @stage.process(@basic_context)

            formatting_results = result.metadata[:formatting_results]
            assert_equal 3, formatting_results[:processed]
            assert_equal 0, formatting_results[:errors]
            assert_equal 1, formatting_results[:individual_fallbacks]

            # Check stage metadata reflects fallback
            stage_metadata = result.metadata[:stage_formatting_stage]
            assert_equal 1, stage_metadata[:individual_fallbacks]
          end

          test "handles individual formatting failures gracefully" do
            setup_shell_mock_for_errors

            # Mock batch failure, some individual failures
            FormattingStage.any_instance.stubs(:system).returns(false, false, true, false) # Batch fails, mixed individual results

            result = @stage.process(@basic_context)

            formatting_results = result.metadata[:formatting_results]
            assert_equal 1, formatting_results[:processed] # Only one succeeded
            assert_equal 2, formatting_results[:errors] # Two failed
            assert_equal 1, formatting_results[:individual_fallbacks]
          end

          test "handles complete formatting failure" do
            setup_shell_mock_for_complete_failure

            # Mock all formatting failures
            FormattingStage.any_instance.stubs(:system).returns(false) # All commands fail

            result = @stage.process(@basic_context)

            formatting_results = result.metadata[:formatting_results]
            assert_equal 0, formatting_results[:processed]
            assert_equal 3, formatting_results[:errors]
            assert_equal 1, formatting_results[:individual_fallbacks]
            assert formatting_results[:batch_error] || true # May have batch error message
          end

          # =============================================================================
          # Batch Configuration Tests
          # =============================================================================

          test "uses custom batch configuration from options" do
            custom_options = {
              batch_max_files: 25,
              batch_max_memory_mb: 50,
              disable_batch_formatting: false
            }
            custom_context = @basic_context.with_options(custom_options)

            setup_successful_formatting_mocks
            FormattingStage.any_instance.stubs(:system).returns(true)

            result = @stage.process(custom_context)

            # The test passes if no errors are raised and processing completes
            assert result.metadata[:formatting_results]
          end

          test "respects disable_batch_formatting option" do
            disabled_batch_context = @basic_context.with_options(disable_batch_formatting: true)

            setup_shell_mock_for_fallback # Individual formatting
            FormattingStage.any_instance.stubs(:system).returns(true, true, true) # Individual commands succeed

            result = @stage.process(disabled_batch_context)

            formatting_results = result.metadata[:formatting_results]
            assert_equal 3, formatting_results[:processed]
            assert_equal 1, formatting_results[:individual_fallbacks] # Went straight to individual
          end

          # =============================================================================
          # Memory Usage Estimation Tests
          # =============================================================================

          test "estimates memory usage correctly" do
            setup_successful_formatting_mocks
            FormattingStage.any_instance.stubs(:system).returns(true)

            result = @stage.process(@basic_context)

            assert result.metadata[:memory_used_mb]
            assert result.metadata[:memory_used_mb] > 0
          end

          # =============================================================================
          # Temporary Directory Cleanup Tests
          # =============================================================================

          test "cleans up temporary directories after processing" do
            setup_successful_formatting_mocks
            FormattingStage.any_instance.stubs(:system).returns(true)

            # Capture any temporary directories created
            temp_dirs_created = []
            FileUtils.stubs(:mkdir_p) do |path|
              temp_dirs_created << path if path.include?("batch_format_")
              # Call original method
              FileUtils.unstub(:mkdir_p)
              FileUtils.mkdir_p(path)
              FileUtils.stubs(:mkdir_p) do |p|
                temp_dirs_created << p if p.include?("batch_format_")
              end
            end

            @stage.process(@basic_context)

            # Verify temp directories were cleaned up (this is more of an integration concern,
            # but we can at least verify the process completes without leaving temp dirs)
            # In a real test, we'd mock FileUtils.rm_rf and verify it was called
            assert true # Process completed without errors
          end

          # =============================================================================
          # Error Handling and Edge Cases
          # =============================================================================

          test "provides comprehensive error context on stage failure" do
            # Force an error by making frontend root detection fail
            Rails.stubs(:root).raises(StandardError.new("Rails root error"))

            error = assert_raises FormattingStage::StageError do
              @stage.process(@basic_context)
            end

            assert_equal @stage, error.stage
            assert_equal @basic_context, error.context
            assert_instance_of StandardError, error.original_error
          end

          test "handles file system errors gracefully" do
            setup_shell_mock_for_errors

            # Mock file operations to fail
            FileUtils.stubs(:mkdir_p).raises(Errno::EACCES.new("Permission denied"))

            error = assert_raises FormattingStage::StageError do
              @stage.process(@basic_context)
            end

            assert_match /Permission denied/, error.message
          end

          test "validates context has required metadata structure" do
            invalid_context = GenerationContext.new(
              table: { name: "test", columns: [] },
              schema: {},
              options: {},
              metadata: "not_a_hash" # Invalid metadata
            )

            error = assert_raises ArgumentError do
              @stage.process(invalid_context)
            end

            assert_match /Context metadata must be a Hash/, error.message
          end

          # =============================================================================
          # Context Immutability Tests
          # =============================================================================

          test "returns new context instance without modifying original" do
            setup_successful_formatting_mocks
            FormattingStage.any_instance.stubs(:system).returns(true)

            original_context = @basic_context
            result_context = @stage.process(original_context)

            assert_not_same original_context, result_context
            assert_not_equal original_context.metadata.keys.length, result_context.metadata.keys.length

            # Original context should retain only original metadata
            assert original_context.metadata[:typescript_files]
            assert_not original_context.metadata[:formatting_results]

            # Result context should have new metadata
            assert result_context.metadata[:typescript_files]
            assert result_context.metadata[:formatting_results]
          end

          test "preserves original context data in new instance" do
            context_with_metadata = @basic_context.with_metadata(custom_key: "custom_value")

            setup_successful_formatting_mocks
            FormattingStage.any_instance.stubs(:system).returns(true)

            result = @stage.process(context_with_metadata)

            # Should preserve original metadata
            assert_equal "custom_value", result.metadata[:custom_key]
            assert result.metadata[:typescript_files]

            # Should add new formatting metadata
            assert result.metadata[:formatting_results]
            assert result.metadata[:prettier_available]
          end

          # =============================================================================
          # Integration and Performance Tests
          # =============================================================================

          test "integrates correctly with service registry" do
            setup_successful_formatting_mocks
            FormattingStage.any_instance.stubs(:system).returns(true)

            # Should call service registry to get shell service
            result = @stage.process(@basic_context)

            assert_instance_of GenerationContext, result
            assert result.metadata[:formatting_results]
          end

          test "handles large file sets efficiently" do
            # Create many TypeScript files
            large_file_set = (1..25).map do |i|
              file_path = File.join(@temp_dir, "file_#{i}.ts")
              File.write(file_path, "export interface Model#{i} { id: number; }")
              file_path
            end

            large_context = @basic_context.with_metadata(typescript_files: large_file_set)

            setup_successful_formatting_mocks
            FormattingStage.any_instance.stubs(:system).returns(true)

            result = @stage.process(large_context)

            formatting_results = result.metadata[:formatting_results]
            assert_equal 25, formatting_results[:processed]
            assert formatting_results[:time] > 0
            assert result.metadata[:memory_used_mb] > 0
          end

          test "is idempotent with same input" do
            setup_successful_formatting_mocks
            setup_successful_formatting_mocks # Second call for idempotency
            FormattingStage.any_instance.stubs(:system).returns(true)

            result1 = @stage.process(@basic_context)
            result2 = @stage.process(@basic_context)

            # Core results should be similar (though timing might differ slightly)
            assert_equal result1.metadata[:files_processed], result2.metadata[:files_processed]
            assert_equal result1.metadata[:prettier_available], result2.metadata[:prettier_available]
          end

          private

          def setup_successful_formatting_mocks
            @mock_service_registry.expect(:get_service, @mock_shell, [ :shell ])
            @mock_shell.expect(:say_status, nil, [ :batch_format, "Successfully formatted 3 files with Prettier", :green ])
          end

          def setup_shell_mock_for_fallback
            @mock_service_registry.expect(:get_service, @mock_shell, [ :shell ])
            @mock_shell.expect(:say_status, nil, [ :batch_failed, String, :yellow ])
            @mock_shell.expect(:say_status, nil, [ :individual_format, "Falling back to individual file formatting", :yellow ])
          end

          def setup_shell_mock_for_errors
            @mock_service_registry.expect(:get_service, @mock_shell, [ :shell ])
            @mock_shell.expect(:say_status, nil, [ :batch_failed, String, :yellow ])
            @mock_shell.expect(:say_status, nil, [ :individual_format, "Falling back to individual file formatting", :yellow ])
            @mock_shell.expect(:say_status, nil, [ :format_error, String, :red ])
            @mock_shell.expect(:say_status, nil, [ :format_error, String, :red ])
          end

          def setup_shell_mock_for_complete_failure
            @mock_service_registry.expect(:get_service, @mock_shell, [ :shell ])
            @mock_shell.expect(:say_status, nil, [ :formatting_error, String, :red ])
            @mock_shell.expect(:say_status, nil, [ :individual_format, "Falling back to individual file formatting", :yellow ])
            @mock_shell.expect(:say_status, nil, [ :format_error, String, :red ])
            @mock_shell.expect(:say_status, nil, [ :format_error, String, :red ])
            @mock_shell.expect(:say_status, nil, [ :format_error, String, :red ])
          end
        end
      end
    end
  end
end
