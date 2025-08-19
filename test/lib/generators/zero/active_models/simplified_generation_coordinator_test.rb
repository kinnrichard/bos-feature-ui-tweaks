# frozen_string_literal: true

require "test_helper"
require "mocha/minitest"
require "ostruct"
require "generators/zero/active_models/generation_coordinator"
require "generators/zero/active_models/pipeline/generation_pipeline"

module Zero
  module Generators
    class SimplifiedGenerationCoordinatorTest < ActiveSupport::TestCase
      def setup
        @shell = create_mock_shell
        @options = {
          dry_run: false,
          force: false,
          output_dir: "/tmp/test_models",
          exclude_tables: [],
          table: nil
        }
      end

      # =============================================================================
      # Constructor Injection Tests - Following Sandi Metz Principles
      # =============================================================================

      test "accepts custom pipeline via constructor injection" do
        mock_pipeline = double("GenerationPipeline",
          execute: { success: true, generated_models: [], generated_files: [], errors: [] },
          statistics: { execution_time: 0.1 }
        )

        coordinator = GenerationCoordinator.new(@options, @shell, mock_pipeline)

        assert_not_nil coordinator
        assert_equal mock_pipeline, coordinator.generation_pipeline
      end

      test "provides default pipeline when none provided" do
        coordinator = GenerationCoordinator.new(@options, @shell)

        assert_not_nil coordinator.generation_pipeline
        assert_instance_of Pipeline::GenerationPipeline, coordinator.generation_pipeline
      end

      test "no hidden dependencies - all dependencies are explicit" do
        # Mock pipeline to avoid real dependencies
        mock_pipeline = double("GenerationPipeline")
        mock_pipeline.expects(:execute).returns({
          success: true,
          generated_models: [],
          generated_files: [],
          errors: []
        })

        coordinator = GenerationCoordinator.new(@options, @shell, mock_pipeline)

        # Should not have service_registry
        assert_nil coordinator.instance_variable_get(:@service_registry)

        # Should not respond to service registry methods
        assert_not_respond_to coordinator, :get_service
        assert_not_respond_to coordinator, :service_registry
      end

      # =============================================================================
      # Simplified Testing Patterns
      # =============================================================================

      test "executes successfully with mocked pipeline" do
        mock_pipeline = double("GenerationPipeline")
        mock_pipeline.expects(:execute).returns({
          success: true,
          generated_models: [
            { table_name: "users", class_name: "User", kebab_name: "user" }
          ],
          generated_files: [ "user.ts", "reactive-user.ts" ],
          errors: []
        })

        coordinator = GenerationCoordinator.new(@options, @shell, mock_pipeline)

        result = coordinator.execute

        assert result[:success]
        assert_equal 1, result[:generated_models].length
        assert_equal 2, result[:generated_files].length
        assert_empty result[:errors]
      end

      test "handles pipeline errors gracefully" do
        mock_pipeline = double("GenerationPipeline")
        mock_pipeline.expects(:execute).raises(StandardError.new("Pipeline failed"))

        coordinator = GenerationCoordinator.new(@options, @shell, mock_pipeline)

        result = coordinator.execute

        assert_not result[:success]
        assert_not_empty result[:errors]
        assert_includes result[:errors].first, "Pipeline failed"
      end

      test "works with real pipeline for integration testing" do
        # Don't mock the pipeline - use a real one with limited scope
        @options[:dry_run] = true  # Avoid actual file creation

        coordinator = GenerationCoordinator.new(@options, @shell)

        # Should not raise errors with real pipeline
        assert_nothing_raised do
          coordinator.execute
        end
      end

      # =============================================================================
      # Statistics and Monitoring
      # =============================================================================

      test "tracks execution statistics" do
        mock_pipeline = double("GenerationPipeline")
        mock_pipeline.expects(:execute).returns({
          success: true,
          generated_models: [ { table_name: "users" } ],
          generated_files: [ "user.ts" ],
          errors: []
        })

        coordinator = GenerationCoordinator.new(@options, @shell, mock_pipeline)
        result = coordinator.execute

        assert result.key?(:statistics)
        assert result[:statistics].key?(:execution_time)
        assert result[:statistics].key?(:models_generated)
        assert result[:statistics].key?(:files_created)
        assert_equal 1, result[:statistics][:models_generated]
      end

      test "collects service statistics from pipeline" do
        mock_pipeline = double("GenerationPipeline")
        mock_pipeline.expects(:statistics).returns({
          pipeline_stages: 4,
          execution_time: 0.5
        })

        coordinator = GenerationCoordinator.new(@options, @shell, mock_pipeline)
        stats = coordinator.collect_service_statistics

        assert stats.key?(:pipeline_stats)
        assert stats.key?(:coordinator_stats)
        assert_equal 4, stats[:pipeline_stats][:pipeline_stages]
      end

      # =============================================================================
      # Interface Compatibility
      # =============================================================================

      test "maintains generate_models interface for backward compatibility" do
        mock_pipeline_class = Class.new do
          def initialize(options:)
            @options = options
          end

          def execute
            {
              success: true,
              generated_models: [ { table_name: "users" } ],
              generated_files: [ "user.ts" ],
              errors: []
            }
          end
        end

        # Mock Pipeline::GenerationPipeline class
        Pipeline::GenerationPipeline.stubs(:new).returns(mock_pipeline_class.new(options: @options))

        coordinator = GenerationCoordinator.new(@options, @shell)
        result = coordinator.generate_models(tables: [ "users" ], output_directory: "/tmp/test")

        assert result[:success]
        assert_equal 1, result[:generated_models].length
        assert_instance_of Float, result[:execution_time]
      end

      # =============================================================================
      # Dry Run Mode
      # =============================================================================

      test "handles dry run mode correctly" do
        @options[:dry_run] = true
        mock_pipeline = double("GenerationPipeline")
        mock_pipeline.expects(:execute).returns({
          success: true,
          generated_models: [ { table_name: "users" } ],
          generated_files: [],  # No files in dry run
          errors: []
        })

        # Shell should receive dry run message
        @shell.expects(:say).with("🔍 DRY RUN MODE - No files will be created", :yellow)
        @shell.expects(:say).with("\n🔍 DRY RUN COMPLETED", :yellow)
        @shell.expects(:say).with("Run without --dry-run to actually generate files", :yellow)

        coordinator = GenerationCoordinator.new(@options, @shell, mock_pipeline)
        result = coordinator.execute

        assert result[:success]
      end

      # =============================================================================
      # Error Scenarios
      # =============================================================================

      test "handles initialization errors gracefully" do
        # Mock Pipeline::GenerationPipeline to fail on initialization
        Pipeline::GenerationPipeline.stubs(:new).raises(StandardError.new("Init failed"))

        error = assert_raises GenerationCoordinator::ServiceInitializationError do
          GenerationCoordinator.new(@options, @shell)
        end

        assert_match /Failed to initialize generation pipeline/, error.message
      end

      private

      def create_mock_shell
        mock = double("Shell")
        mock.stubs(:say)
        mock.stubs(:say_status)
        mock
      end
    end
  end
end
