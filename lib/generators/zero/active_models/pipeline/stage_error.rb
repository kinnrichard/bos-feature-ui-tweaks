# frozen_string_literal: true

module Zero
  module Generators
    module Pipeline
      # Enhanced error class for pipeline stage failures
      #
      # StageError provides detailed context about pipeline stage failures,
      # including the failing stage, the context at time of failure, and
      # the original underlying error. This enables precise error handling
      # and debugging in complex generation pipelines.
      #
      # Key Features:
      # - Preserves complete failure context
      # - Provides stage identification and metadata
      # - Maintains error chain for debugging
      # - Supports error recovery and retry strategies
      # - Enables stage-specific error handling
      #
      # @example Basic error handling
      #   begin
      #     result = pipeline.execute(context)
      #   rescue StageError => e
      #     puts "Stage #{e.stage_name} failed: #{e.message}"
      #     puts "Context: #{e.context_info}"
      #     puts "Original error: #{e.original_error.class}"
      #   end
      #
      # @example Error recovery
      #   begin
      #     result = pipeline.execute(context)
      #   rescue StageError => e
      #     if e.stage.is_a?(OptionalStage) && e.recoverable?
      #       # Skip optional stage and continue
      #       result = pipeline.without_stage(e.stage.class).execute(context)
      #     else
      #       raise
      #     end
      #   end
      #
      class StageError < StandardError
        attr_reader :stage, :context, :original_error, :occurred_at

        # Initialize StageError with complete failure context
        #
        # @param stage [Stage] Stage instance that failed
        # @param context [GenerationContext] Context when failure occurred
        # @param error [StandardError] Original underlying error
        # @param metadata [Hash] Additional error metadata
        #
        def initialize(stage:, context:, error:, metadata: {})
          @stage = stage
          @context = context
          @original_error = error
          @occurred_at = Time.current
          @metadata = metadata.freeze

          super(build_error_message)

          # Preserve backtrace from original error
          set_backtrace(error.backtrace) if error.respond_to?(:backtrace)
        end

        # Get stage name for error reporting
        #
        # @return [String] Stage class name without module path
        #
        def stage_name
          stage.respond_to?(:name) ? stage.name : stage.class.name.split("::").last
        end

        # Get stage class name
        #
        # @return [String] Full stage class name with modules
        #
        def stage_class
          stage.class.name
        end

        # Get context information for debugging
        #
        # @return [String] Context details for error diagnostics
        #
        def context_info
          info_parts = []

          if context.respond_to?(:table_name) && context.table_name
            info_parts << "table: #{context.table_name}"
          end

          if context.respond_to?(:model_name) && context.model_name
            info_parts << "model: #{context.model_name}"
          end

          if context.respond_to?(:dry_run?) && context.dry_run?
            info_parts << "dry_run: true"
          end

          info_parts.empty? ? "context: #{context.class.name}" : info_parts.join(", ")
        end

        # Get formatted timestamp of when error occurred
        #
        # @return [String] Human-readable timestamp
        #
        def occurred_at_formatted
          @occurred_at.strftime("%Y-%m-%d %H:%M:%S UTC")
        end

        # Check if error is potentially recoverable
        #
        # Some errors may be recoverable by skipping the stage, using fallback
        # values, or retrying with modified context.
        #
        # @return [Boolean] True if error might be recoverable
        #
        def recoverable?
          # Check if original error is a known recoverable type
          recoverable_error_types.any? { |type| original_error.is_a?(type) }
        end

        # Check if error is related to missing data
        #
        # @return [Boolean] True if error is due to missing required data
        #
        def missing_data_error?
          missing_data_patterns.any? do |pattern|
            message.match?(pattern) || original_error.message.match?(pattern)
          end
        end

        # Check if error is related to validation failure
        #
        # @return [Boolean] True if error is due to validation failure
        #
        def validation_error?
          validation_error_types.any? { |type| original_error.is_a?(type) } ||
            message.include?("validation") || message.include?("invalid")
        end

        # Get error category for logging and metrics
        #
        # @return [Symbol] Error category (:validation, :data, :processing, :system)
        #
        def error_category
          return :validation if validation_error?
          return :data if missing_data_error?
          return :processing if processing_error?
          :system
        end

        # Get error severity level
        #
        # @return [Symbol] Severity level (:low, :medium, :high, :critical)
        #
        def severity
          return :low if recoverable?
          return :medium if validation_error? || missing_data_error?
          return :high if processing_error?
          :critical
        end

        # Get additional error metadata
        #
        # @return [Hash] Additional metadata provided during error creation
        #
        def metadata
          @metadata
        end

        # Generate comprehensive error report
        #
        # @return [Hash] Detailed error information for logging and analysis
        #
        def error_report
          {
            stage: {
              name: stage_name,
              class: stage_class,
              priority: stage.respond_to?(:priority) ? stage.priority : nil,
              idempotent: stage.respond_to?(:idempotent?) ? stage.idempotent? : nil
            },
            context: {
              info: context_info,
              class: context.class.name,
              table_name: context.respond_to?(:table_name) ? context.table_name : nil,
              model_name: context.respond_to?(:model_name) ? context.model_name : nil
            },
            error: {
              message: message,
              original_class: original_error.class.name,
              original_message: original_error.message,
              category: error_category,
              severity: severity,
              recoverable: recoverable?,
              occurred_at: occurred_at_formatted
            },
            metadata: @metadata
          }
        end

        # Provide detailed string representation for debugging
        #
        # @return [String] Detailed error inspection
        #
        def inspect
          "#<#{self.class.name}: #{stage_name} failed " \
            "(#{context_info}): #{original_error.class.name}>"
        end

        private

        # Build comprehensive error message with context
        #
        # @return [String] Detailed error message
        #
        def build_error_message
          base_message = "Stage '#{stage_name}' failed during execution"
          context_part = context_info.empty? ? "" : " (#{context_info})"
          error_part = ": #{original_error.message}"

          "#{base_message}#{context_part}#{error_part}"
        end

        # Get list of potentially recoverable error types
        #
        # @return [Array<Class>] Error classes that might be recoverable
        #
        def recoverable_error_types
          [
            ArgumentError,      # Missing or invalid arguments
            NoMethodError,      # Method not available (might have fallback)
            KeyError,          # Missing hash key (might have default)
            NameError          # Constant not defined (might be optional)
          ]
        end

        # Get patterns that indicate missing data errors
        #
        # @return [Array<Regexp>] Patterns that match missing data errors
        #
        def missing_data_patterns
          [
            /\bmissing\b/i,
            /\bnot found\b/i,
            /\bundefined\b/i,
            /\bempty\b/i,
            /\brequired\b/i,
            /\bnil\b/i,
            /\bblank\b/i
          ]
        end

        # Get validation error types
        #
        # @return [Array<Class>] Error classes related to validation
        #
        def validation_error_types
          # Define common validation error types
          error_types = [ ArgumentError, TypeError ]

          # Add Rails validation errors if available
          if defined?(ActiveModel::ValidationError)
            error_types << ActiveModel::ValidationError
          end

          if defined?(ActiveRecord::RecordInvalid)
            error_types << ActiveRecord::RecordInvalid
          end

          error_types
        end

        # Check if error is related to processing failure
        #
        # @return [Boolean] True if error is due to processing failure
        #
        def processing_error?
          processing_patterns.any? do |pattern|
            message.match?(pattern) || original_error.message.match?(pattern)
          end
        end

        # Get patterns that indicate processing errors
        #
        # @return [Array<Regexp>] Patterns that match processing errors
        #
        def processing_patterns
          [
            /\bfailed to process\b/i,
            /\bprocessing error\b/i,
            /\btransformation failed\b/i,
            /\bgeneration failed\b/i,
            /\bruntime error\b/i
          ]
        end
      end
    end
  end
end
