# frozen_string_literal: true

require_relative "stage"

module Zero
  module Generators
    module Pipeline
      # Pipeline orchestrates the execution of composable stages in a generation workflow
      #
      # This class implements the Pipeline pattern to break apart monolithic generation
      # logic into focused, testable stages. Each stage operates on a GenerationContext
      # and returns a potentially modified context for the next stage.
      #
      # Key Responsibilities:
      # - Stage management and validation
      # - Sequential execution with context passing
      # - Error handling and recovery
      # - Pipeline composition and modification
      # - Execution logging and metrics
      #
      # The pipeline uses a reduce pattern where each stage transforms the context:
      #   context -> Stage1 -> Stage2 -> Stage3 -> final_context
      #
      # @example Basic usage
      #   pipeline = Pipeline.new(stages: [
      #     SchemaExtractionStage.new,
      #     ModelGenerationStage.new,
      #     FormattingStage.new
      #   ])
      #
      #   context = GenerationContext.new(table: table_data, schema: schema_data)
      #   result = pipeline.execute(context)
      #
      # @example Pipeline composition
      #   enhanced_pipeline = pipeline
      #     .with_stage(ValidationStage.new, position: 0)
      #     .without_stage(FormattingStage)
      #
      class Pipeline
        # Pipeline execution and configuration errors
        class PipelineError < StandardError; end
        class StageValidationError < PipelineError; end

        attr_reader :stages, :metadata, :statistics

        # Initialize Pipeline with stages and optional metadata
        #
        # @param stages [Array<Stage>] Array of stage objects that implement #process
        # @param metadata [Hash] Optional metadata for pipeline identification and logging
        # @param enable_logging [Boolean] Whether to enable execution logging (default: false)
        #
        # @raise [StageValidationError] If any stage doesn't implement the Stage interface
        #
        def initialize(stages: [], metadata: {}, enable_logging: false)
          @stages = stages.freeze
          @metadata = metadata.freeze
          @enable_logging = enable_logging
          @statistics = initialize_statistics

          validate_stages!
          freeze
        end

        # Execute all stages sequentially with context passing
        #
        # Uses reduce pattern to pass context through each stage, allowing each
        # stage to transform the context for subsequent stages. Provides comprehensive
        # error handling and execution tracking.
        #
        # @param initial_context [GenerationContext] Starting context for pipeline
        # @return [GenerationContext] Final context after all stages complete
        #
        # @raise [StageError] If any stage fails during execution
        #
        def execute(initial_context)
          execution_start_time = Time.current
          log_pipeline_start(initial_context)

          result = stages.reduce(initial_context) do |context, stage|
            execute_stage(stage, context)
          end

          record_execution_time(execution_start_time)
          log_pipeline_complete(result)
          result

        rescue StandardError => e
          @statistics[:errors_encountered] += 1
          handle_pipeline_error(e, initial_context)
        end

        # Create new pipeline with additional stage
        #
        # Returns immutable pipeline instance with stage inserted at specified position.
        # Negative positions count from end (-1 = append to end).
        #
        # @param stage [Stage] Stage object implementing #process method
        # @param position [Integer] Position to insert stage (default: -1 for append)
        # @return [Pipeline] New pipeline instance with added stage
        #
        def with_stage(stage, position: -1)
          new_stages = stages.dup
          new_stages.insert(position, stage)

          self.class.new(
            stages: new_stages,
            metadata: metadata,
            enable_logging: @enable_logging
          )
        end

        # Create new pipeline without specified stage type
        #
        # Returns immutable pipeline instance with all stages of specified class removed.
        #
        # @param stage_class [Class] Stage class to remove from pipeline
        # @return [Pipeline] New pipeline instance without specified stage type
        #
        def without_stage(stage_class)
          new_stages = stages.reject { |stage| stage.is_a?(stage_class) }

          self.class.new(
            stages: new_stages,
            metadata: metadata,
            enable_logging: @enable_logging
          )
        end

        # Create new pipeline by replacing stage of specified type
        #
        # @param stage_class [Class] Stage class to replace
        # @param new_stage [Stage] New stage instance to use as replacement
        # @return [Pipeline] New pipeline instance with replaced stage
        #
        def replace_stage(stage_class, new_stage)
          new_stages = stages.map do |stage|
            stage.is_a?(stage_class) ? new_stage : stage
          end

          self.class.new(
            stages: new_stages,
            metadata: metadata,
            enable_logging: @enable_logging
          )
        end

        # Check if pipeline contains stage of specified type
        #
        # @param stage_class [Class] Stage class to check for
        # @return [Boolean] True if pipeline contains stage of specified type
        #
        def has_stage?(stage_class)
          stages.any? { |stage| stage.is_a?(stage_class) }
        end

        # Get count of stages in pipeline
        #
        # @return [Integer] Number of stages in pipeline
        #
        def stage_count
          stages.count
        end

        # Get pipeline execution statistics
        #
        # @return [Hash] Statistics including execution times, stage counts, and errors
        #
        def execution_statistics
          @statistics.dup
        end

        # Provide detailed string representation for debugging
        #
        # @return [String] Detailed pipeline inspection
        #
        def inspect
          stage_names = stages.map { |s| s.class.name.split("::").last }
          "#<#{self.class.name}:#{object_id.to_s(16)} " \
            "stages=[#{stage_names.join(', ')}] " \
            "metadata=#{metadata.keys.inspect}>"
        end

        private

        # Execute single stage with error handling and logging
        #
        # @param stage [Stage] Stage to execute
        # @param context [GenerationContext] Current context
        # @return [GenerationContext] Context returned by stage
        #
        # @raise [StageError] If stage execution fails
        #
        def execute_stage(stage, context)
          stage_start_time = Time.current
          log_stage_start(stage, context)

          # Check if stage can run with current context
          unless stage.can_run?(context)
            log_stage_skipped(stage, context)
            return context
          end

          result = stage.process(context)
          record_stage_execution(stage, stage_start_time)
          log_stage_complete(stage, result)

          result

        rescue StandardError => e
          @statistics[:stage_errors] += 1
          raise Stage::StageError.new(stage: stage, context: context, error: e)
        end

        # Validate that all stages implement required interface
        #
        # @raise [StageValidationError] If any stage is invalid
        #
        def validate_stages!
          stages.each do |stage|
            unless stage.respond_to?(:process)
              raise StageValidationError,
                "Stage #{stage.class} must implement #process method"
            end

            unless stage.respond_to?(:can_run?)
              raise StageValidationError,
                "Stage #{stage.class} must implement #can_run? method"
            end
          end
        end

        # Initialize execution statistics tracking
        #
        # @return [Hash] Initial statistics structure
        #
        def initialize_statistics
          {
            executions_count: 0,
            total_execution_time: 0.0,
            average_execution_time: 0.0,
            stages_executed: 0,
            stages_skipped: 0,
            errors_encountered: 0,
            stage_errors: 0,
            last_execution_time: nil
          }
        end

        # Record total pipeline execution time
        #
        # @param start_time [Time] Pipeline execution start time
        #
        def record_execution_time(start_time)
          execution_time = Time.current - start_time
          @statistics[:executions_count] += 1
          @statistics[:total_execution_time] += execution_time
          @statistics[:average_execution_time] = @statistics[:total_execution_time] / @statistics[:executions_count]
          @statistics[:last_execution_time] = execution_time
        end

        # Record individual stage execution
        #
        # @param stage [Stage] Executed stage
        # @param start_time [Time] Stage execution start time
        #
        def record_stage_execution(stage, start_time)
          @statistics[:stages_executed] += 1
        end

        # Handle pipeline-level errors with context preservation
        #
        # @param error [StandardError] Original error
        # @param context [GenerationContext] Context when error occurred
        #
        # @raise [PipelineError] Enhanced error with pipeline context
        #
        def handle_pipeline_error(error, context)
          if error.is_a?(Stage::StageError)
            # Re-raise stage errors with full context
            raise error
          else
            # Wrap unexpected errors
            raise PipelineError,
              "Pipeline execution failed with context #{context}: #{error.message}"
          end
        end

        # Log pipeline execution start (if logging enabled)
        #
        # @param context [GenerationContext] Initial context
        #
        def log_pipeline_start(context)
          return unless @enable_logging

          puts "[Pipeline] Starting execution with #{stages.count} stages"
          puts "[Pipeline] Context: #{context}"
        end

        # Log pipeline execution completion (if logging enabled)
        #
        # @param result [GenerationContext] Final context
        #
        def log_pipeline_complete(result)
          return unless @enable_logging

          puts "[Pipeline] Completed successfully"
          puts "[Pipeline] Result: #{result}"
        end

        # Log individual stage start (if logging enabled)
        #
        # @param stage [Stage] Stage being executed
        # @param context [GenerationContext] Current context
        #
        def log_stage_start(stage, context)
          return unless @enable_logging

          puts "[Pipeline] Executing stage: #{stage.class.name}"
        end

        # Log individual stage completion (if logging enabled)
        #
        # @param stage [Stage] Completed stage
        # @param result [GenerationContext] Result context
        #
        def log_stage_complete(stage, result)
          return unless @enable_logging

          puts "[Pipeline] Stage #{stage.class.name} completed"
        end

        # Log stage being skipped (if logging enabled)
        #
        # @param stage [Stage] Skipped stage
        # @param context [GenerationContext] Current context
        #
        def log_stage_skipped(stage, context)
          return unless @enable_logging

          puts "[Pipeline] Skipping stage: #{stage.class.name} (can_run? returned false)"
        end
      end
    end
  end
end
