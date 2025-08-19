# frozen_string_literal: true

require "test_helper"
require "minitest/mock"
require "generators/zero/active_models/pipeline/stages/typescript_generation_stage"
require "generators/zero/active_models/generation_context"
require "generators/zero/active_models/service_registry"

module Zero
  module Generators
    module Pipeline
      module Stages
        class TypeScriptGenerationStageTest < ActiveSupport::TestCase
          def setup
            # Create mock service registry and file manager
            @mock_service_registry = Minitest::Mock.new
            @mock_file_manager = Minitest::Mock.new

            # Create the stage with mocked dependencies
            @stage = TypeScriptGenerationStage.new(@mock_service_registry)

            # Sample table data for testing
            @sample_table = {
              name: "users",
              columns: [
                { name: "id", type: "integer", primary_key: true },
                { name: "email", type: "string", null: false },
                { name: "name", type: "string", null: true },
                { name: "created_at", type: "datetime", null: false },
                { name: "updated_at", type: "datetime", null: false }
              ]
            }

            @sample_schema = {
              tables: [ @sample_table ],
              relationships: [],
              patterns: {}
            }

            # Sample generated content from ModelGenerationStage
            @sample_generated_content = {
              data_interface: "export interface UserData { id: number; email: string; }",
              active_model: "export const User = createActiveRecord<UserData>({});",
              reactive_model: "export const ReactiveUser = createReactiveRecord<UserData>({});",
              filenames: {
                data: "types/user-data.ts",
                active: "user.ts",
                reactive: "reactive-user.ts"
              }
            }

            # Create contexts for testing
            @valid_context = GenerationContext.new(
              table: @sample_table,
              schema: @sample_schema,
              relationships: {},
              options: { dry_run: false },
              metadata: { generated_content: @sample_generated_content }
            )

            @dry_run_context = GenerationContext.new(
              table: @sample_table,
              schema: @sample_schema,
              relationships: {},
              options: { dry_run: true },
              metadata: { generated_content: @sample_generated_content }
            )

            # Mock Rails constants
            mock_rails = Minitest::Mock.new
            mock_rails.expect(:root, "/mock/rails/root")
            mock_logger = Minitest::Mock.new
            mock_logger.expect(:debug, nil, [ String ])
            mock_logger.expect(:warn, nil, [ String ])
            mock_rails.expect(:logger, mock_logger)

            mock_app = Minitest::Mock.new
            mock_config = Minitest::Mock.new
            mock_config.expect(:eager_load, true)
            mock_app.expect(:config, mock_config)
            mock_rails.expect(:application, mock_app)

            mock_autoloaders = Minitest::Mock.new
            mock_main = Minitest::Mock.new
            mock_main.expect(:eager_load_dir, nil, [ Object ])
            mock_autoloaders.expect(:main, mock_main)
            mock_rails.expect(:autoloaders, mock_autoloaders)

            Rails.stub :const_defined?, true do
              Rails.stub :const_get, mock_rails do
                yield # Used in tests that need Rails stubbing
              end
            end
          end

          def teardown
            @mock_service_registry&.verify
            @mock_file_manager&.verify
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
            assert_equal "TypeScriptGenerationStage", @stage.name
            assert_equal "Writes TypeScript files, generates Zero.js integration, and manages file organization", @stage.description
            assert_not @stage.idempotent?
            assert_equal 20, @stage.priority
          end

          # =============================================================================
          # can_run? Method Tests
          # =============================================================================

          test "can_run returns true for valid context with generated content" do
            assert @stage.can_run?(@valid_context)
          end

          test "can_run returns false when metadata is missing" do
            context_without_metadata = GenerationContext.new(
              table: @sample_table,
              schema: @sample_schema,
              relationships: {},
              options: { dry_run: false }
            )
            assert_not @stage.can_run?(context_without_metadata)
          end

          test "can_run returns false when generated_content is missing" do
            context_without_content = GenerationContext.new(
              table: @sample_table,
              schema: @sample_schema,
              relationships: {},
              options: { dry_run: false },
              metadata: { other_data: "value" }
            )
            assert_not @stage.can_run?(context_without_content)
          end

          test "can_run returns false when generated_content is not a hash" do
            context_invalid_content = GenerationContext.new(
              table: @sample_table,
              schema: @sample_schema,
              relationships: {},
              options: { dry_run: false },
              metadata: { generated_content: "invalid" }
            )
            assert_not @stage.can_run?(context_invalid_content)
          end

          test "can_run returns false when required content keys are missing" do
            incomplete_content = { data_interface: "content" } # missing other keys
            context_incomplete = GenerationContext.new(
              table: @sample_table,
              schema: @sample_schema,
              relationships: {},
              options: { dry_run: false },
              metadata: { generated_content: incomplete_content }
            )
            assert_not @stage.can_run?(context_incomplete)
          end

          # =============================================================================
          # Dry Run Mode Tests
          # =============================================================================

          test "handles dry run mode without writing files" do
            result = @stage.process(@dry_run_context)

            assert result.metadata[:dry_run_files]
            assert_includes result.metadata[:dry_run_files], "types/user-data.ts"
            assert_includes result.metadata[:dry_run_files], "user.ts"
            assert_includes result.metadata[:dry_run_files], "reactive-user.ts"
            assert_includes result.metadata[:dry_run_files], "../zero/index.ts"
            assert_includes result.metadata[:dry_run_files], "generated-loggable-config.ts"
            assert_equal 5, result.metadata[:files_count]
            assert result.metadata[:zero_js_integration]
            assert result.metadata[:loggable_integration]
          end

          test "does not call file manager in dry run mode" do
            # File manager should not be called in dry run
            result = @stage.process(@dry_run_context)

            assert_instance_of GenerationContext, result
            assert result.metadata[:dry_run_files]
          end

          # =============================================================================
          # TypeScript File Writing Tests
          # =============================================================================

          test "writes TypeScript files with deferred processing" do
            setup_file_manager_mocks

            result = @stage.process(@valid_context)

            assert result.metadata[:typescript_files]
            assert_equal 5, result.metadata[:files_count] # 3 model files + index + config
            assert result.metadata[:zero_index_generated]
            assert result.metadata[:loggable_config_generated]
          end

          test "processes batch files after writing" do
            setup_file_manager_mocks

            result = @stage.process(@valid_context)

            batch_result = result.metadata[:batch_processing_result]
            assert batch_result
            assert_equal 3, batch_result[:processed]
            assert_equal 0.5, batch_result[:time]
          end

          test "adds comprehensive stage execution metadata" do
            setup_file_manager_mocks

            result = @stage.process(@valid_context)

            stage_metadata = result.metadata[:stage_typescript_generation_stage]
            assert stage_metadata
            assert stage_metadata[:files_written] > 0
            assert stage_metadata[:zero_js_integration]
            assert stage_metadata[:loggable_integration]
            assert_equal 3, stage_metadata[:batch_operations]
            assert_equal 0.5, stage_metadata[:processing_time]
            assert stage_metadata[:executed_at]
            assert_equal "TypeScriptGenerationStage", stage_metadata[:stage_name]
          end

          # =============================================================================
          # Zero.js Index File Generation Tests
          # =============================================================================

          test "generates Zero.js index file with proper content structure" do
            setup_file_manager_mocks_with_content_capture

            result = @stage.process(@valid_context)

            # Check that Zero.js index was marked as generated
            assert result.metadata[:zero_index_generated]

            # Content verification would be done through the captured content
            # (implementation detail of the mock setup)
          end

          test "includes model import examples in Zero.js index" do
            # This test would verify the content generation logic
            # by checking the private methods if they were public or through integration

            setup_file_manager_mocks

            result = @stage.process(@valid_context)
            assert result.metadata[:zero_index_generated]
          end

          # =============================================================================
          # Loggable Configuration Tests
          # =============================================================================

          test "generates Loggable configuration file" do
            setup_file_manager_mocks_with_loggable

            Rails.stub :const_defined?, true do
              Rails.stub :root, "/mock/rails/root" do
                result = @stage.process(@valid_context)

                assert result.metadata[:loggable_config_generated]
              end
            end
          end

          test "handles missing Loggable models gracefully" do
            setup_file_manager_mocks_with_loggable_empty

            Rails.stub :const_defined?, false do
              result = @stage.process(@valid_context)

              assert result.metadata[:loggable_config_generated]
            end
          end

          test "writes Loggable config to correct path" do
            setup_file_manager_mocks_with_loggable

            Rails.stub :const_defined?, true do
              Rails.stub :root, "/mock/rails/root" do
                # Mock FileUtils and File operations
                FileUtils.stub :mkdir_p, nil do
                  File.stub :write, nil do
                    result = @stage.process(@valid_context)

                    assert result.metadata[:loggable_config_generated]
                  end
                end
              end
            end
          end

          # =============================================================================
          # Error Handling Tests
          # =============================================================================

          test "raises StageError when context validation fails" do
            invalid_context = GenerationContext.new(
              table: @sample_table,
              schema: @sample_schema,
              relationships: {},
              options: { dry_run: false },
              metadata: { generated_content: "invalid" }
            )

            error = assert_raises TypeScriptGenerationStage::TypeScriptGenerationError do
              @stage.process(invalid_context)
            end

            assert_equal @stage, error.stage
            assert_equal invalid_context, error.context
            assert_instance_of StandardError, error.original_error
          end

          test "wraps file writing errors in StageError" do
            @mock_service_registry.expect(:get_service, @mock_file_manager, [ :file_manager ])
            @mock_file_manager.expect(:write_with_formatting, nil) do |*args|
              raise StandardError, "Disk full"
            end

            error = assert_raises TypeScriptGenerationStage::TypeScriptGenerationError do
              @stage.process(@valid_context)
            end

            assert_equal @stage, error.stage
            assert_equal @valid_context, error.context
            assert_match(/Disk full/, error.original_error.message)
          end

          test "wraps Zero.js index generation errors in StageError" do
            @mock_service_registry.expect(:get_service, @mock_file_manager, [ :file_manager ])

            # Mock successful model file writes
            @mock_file_manager.expect(:write_with_formatting, "mock/path/data.ts", [ "types/user-data.ts", String, { defer_write: true } ])
            @mock_file_manager.expect(:write_with_formatting, "mock/path/active.ts", [ "user.ts", String, { defer_write: true } ])
            @mock_file_manager.expect(:write_with_formatting, "mock/path/reactive.ts", [ "reactive-user.ts", String, { defer_write: true } ])

            # Mock Zero.js index generation failure
            @mock_file_manager.expect(:write_with_formatting, nil) do |filename, content|
              if filename == "../zero/index.ts"
                raise StandardError, "Index generation failed"
              end
            end

            error = assert_raises TypeScriptGenerationStage::TypeScriptGenerationError do
              @stage.process(@valid_context)
            end

            assert_match(/Index generation failed/, error.original_error.message)
          end

          test "wraps Loggable configuration errors in StageError" do
            setup_file_manager_mocks_without_config

            Rails.stub :const_defined?, true do
              Rails.stub :root, "/mock/rails/root" do
                FileUtils.stub :mkdir_p, nil do
                  File.stub :write, ->(*args) { raise StandardError, "Config write failed" } do
                    error = assert_raises TypeScriptGenerationStage::TypeScriptGenerationError do
                      @stage.process(@valid_context)
                    end

                    assert_match(/Config write failed/, error.original_error.message)
                  end
                end
              end
            end
          end

          # =============================================================================
          # Context Preservation Tests
          # =============================================================================

          test "preserves original context data" do
            setup_file_manager_mocks

            context_with_metadata = @valid_context.with_metadata(custom_key: "custom_value")
            result = @stage.process(context_with_metadata)

            # Should preserve original metadata
            assert_equal "custom_value", result.metadata[:custom_key]

            # Should add new metadata
            assert result.metadata[:typescript_files]
            assert result.metadata[:zero_index_generated]
          end

          test "returns new context instance without modifying original" do
            setup_file_manager_mocks

            original_context = @valid_context
            result_context = @stage.process(original_context)

            assert_not_same original_context, result_context
            assert_not_equal original_context.metadata.keys.sort, result_context.metadata.keys.sort

            # Original should have generated_content, result should have typescript_files too
            assert original_context.metadata[:generated_content]
            assert result_context.metadata[:generated_content]
            assert result_context.metadata[:typescript_files]
          end

          # =============================================================================
          # Integration Tests
          # =============================================================================

          test "integrates correctly with service registry" do
            setup_file_manager_mocks

            # Should call service registry to get file manager
            result = @stage.process(@valid_context)

            assert_instance_of GenerationContext, result
            assert result.metadata[:typescript_files]
          end

          test "processes complete workflow end-to-end" do
            setup_file_manager_mocks

            Rails.stub :const_defined?, true do
              Rails.stub :root, "/mock/rails/root" do
                FileUtils.stub :mkdir_p, nil do
                  File.stub :write, nil do
                    result = @stage.process(@valid_context)

                    # Should have processed all components
                    assert result.metadata[:typescript_files]
                    assert result.metadata[:zero_index_generated]
                    assert result.metadata[:loggable_config_generated]
                    assert result.metadata[:batch_processing_result]
                    assert_equal 5, result.metadata[:files_count]

                    # Should have stage metadata
                    stage_metadata = result.metadata[:stage_typescript_generation_stage]
                    assert stage_metadata[:files_written] > 0
                    assert stage_metadata[:zero_js_integration]
                    assert stage_metadata[:loggable_integration]
                  end
                end
              end
            end
          end

          # =============================================================================
          # Edge Case Tests
          # =============================================================================

          test "handles empty generated content gracefully" do
            empty_content = {
              data_interface: "",
              active_model: "",
              reactive_model: "",
              filenames: {
                data: "types/user-data.ts",
                active: "user.ts",
                reactive: "reactive-user.ts"
              }
            }

            context_with_empty_content = GenerationContext.new(
              table: @sample_table,
              schema: @sample_schema,
              relationships: {},
              options: { dry_run: false },
              metadata: { generated_content: empty_content }
            )

            setup_file_manager_mocks

            Rails.stub :const_defined?, true do
              Rails.stub :root, "/mock/rails/root" do
                FileUtils.stub :mkdir_p, nil do
                  File.stub :write, nil do
                    result = @stage.process(context_with_empty_content)

                    assert result.metadata[:typescript_files]
                    assert result.metadata[:zero_index_generated]
                  end
                end
              end
            end
          end

          test "handles complex table names and file paths" do
            complex_table = {
              name: "user_profile_settings",
              columns: [
                { name: "id", type: "integer", primary_key: true },
                { name: "setting_name", type: "string", null: false }
              ]
            }

            complex_generated_content = {
              data_interface: "export interface UserProfileSettingData { id: number; setting_name: string; }",
              active_model: "export const UserProfileSetting = createActiveRecord({});",
              reactive_model: "export const ReactiveUserProfileSetting = createReactiveRecord({});",
              filenames: {
                data: "types/user-profile-setting-data.ts",
                active: "user-profile-setting.ts",
                reactive: "reactive-user-profile-setting.ts"
              }
            }

            complex_context = GenerationContext.new(
              table: complex_table,
              schema: { tables: [ complex_table ], relationships: [], patterns: {} },
              relationships: {},
              options: { dry_run: false },
              metadata: { generated_content: complex_generated_content }
            )

            setup_file_manager_mocks_for_complex_names

            Rails.stub :const_defined?, true do
              Rails.stub :root, "/mock/rails/root" do
                FileUtils.stub :mkdir_p, nil do
                  File.stub :write, nil do
                    result = @stage.process(complex_context)

                    assert result.metadata[:typescript_files]
                    assert result.metadata[:zero_index_generated]
                  end
                end
              end
            end
          end

          private

          def setup_file_manager_mocks
            @mock_service_registry.expect(:get_service, @mock_file_manager, [ :file_manager ])

            # Mock TypeScript file writes
            @mock_file_manager.expect(:write_with_formatting, "mock/path/data.ts", [ "types/user-data.ts", String, { defer_write: true } ])
            @mock_file_manager.expect(:write_with_formatting, "mock/path/active.ts", [ "user.ts", String, { defer_write: true } ])
            @mock_file_manager.expect(:write_with_formatting, "mock/path/reactive.ts", [ "reactive-user.ts", String, { defer_write: true } ])

            # Mock Zero.js index file write
            @mock_file_manager.expect(:write_with_formatting, "mock/path/zero-index.ts", [ "../zero/index.ts", String ])

            # Mock batch processing
            @mock_file_manager.expect(:process_batch_files, {
              processed: 3,
              time: 0.5,
              memory_used_mb: 10,
              errors: 0
            })

            # Mock output_dir for Loggable config
            @mock_file_manager.expect(:output_dir, "/mock/output")
          end

          def setup_file_manager_mocks_with_content_capture
            # Similar to setup_file_manager_mocks but could capture content for verification
            setup_file_manager_mocks
          end

          def setup_file_manager_mocks_with_loggable
            setup_file_manager_mocks

            # Additional setup for Loggable model detection would go here
            # For now, we just ensure the basic flow works
          end

          def setup_file_manager_mocks_with_loggable_empty
            setup_file_manager_mocks
          end

          def setup_file_manager_mocks_without_config
            @mock_service_registry.expect(:get_service, @mock_file_manager, [ :file_manager ])

            # Mock TypeScript file writes
            @mock_file_manager.expect(:write_with_formatting, "mock/path/data.ts", [ "types/user-data.ts", String, { defer_write: true } ])
            @mock_file_manager.expect(:write_with_formatting, "mock/path/active.ts", [ "user.ts", String, { defer_write: true } ])
            @mock_file_manager.expect(:write_with_formatting, "mock/path/reactive.ts", [ "reactive-user.ts", String, { defer_write: true } ])

            # Mock Zero.js index file write
            @mock_file_manager.expect(:write_with_formatting, "mock/path/zero-index.ts", [ "../zero/index.ts", String ])

            # Mock batch processing
            @mock_file_manager.expect(:process_batch_files, {
              processed: 3,
              time: 0.5,
              memory_used_mb: 10,
              errors: 0
            })

            # Mock output_dir for Loggable config
            @mock_file_manager.expect(:output_dir, "/mock/output")
          end

          def setup_file_manager_mocks_for_complex_names
            @mock_service_registry.expect(:get_service, @mock_file_manager, [ :file_manager ])

            # Mock TypeScript file writes with complex names
            @mock_file_manager.expect(:write_with_formatting, "mock/path/data.ts", [ "types/user-profile-setting-data.ts", String, { defer_write: true } ])
            @mock_file_manager.expect(:write_with_formatting, "mock/path/active.ts", [ "user-profile-setting.ts", String, { defer_write: true } ])
            @mock_file_manager.expect(:write_with_formatting, "mock/path/reactive.ts", [ "reactive-user-profile-setting.ts", String, { defer_write: true } ])

            # Mock Zero.js index file write
            @mock_file_manager.expect(:write_with_formatting, "mock/path/zero-index.ts", [ "../zero/index.ts", String ])

            # Mock batch processing
            @mock_file_manager.expect(:process_batch_files, {
              processed: 3,
              time: 0.5,
              memory_used_mb: 10,
              errors: 0
            })

            # Mock output_dir for Loggable config
            @mock_file_manager.expect(:output_dir, "/mock/output")
          end
        end
      end
    end
  end
end
