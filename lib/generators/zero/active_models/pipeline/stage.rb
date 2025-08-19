# frozen_string_literal: true

require "active_support/core_ext/string/inflections"

module Zero
  module Generators
    module Pipeline
      # Base class for all pipeline stages
      #
      # Stages are the building blocks of the generation pipeline. Each stage
      # implements a single responsibility and operates on a GenerationContext,
      # returning a potentially modified context for subsequent stages.
      #
      # Key Responsibilities:
      # - Define the stage interface (#process method)
      # - Provide stage metadata and identification
      # - Support conditional execution via #can_run?
      # - Enable stage composition and testing
      #
      # Stages should be pure transformations when possible - given the same
      # input context, they should produce the same output context. This makes
      # them highly testable and predictable.
      #
      # @example Implementing a custom stage
      #   class ValidationStage < Stage
      #     def process(context)
      #       unless context.table_name.present?
      #         raise ValidationError, "table_name is required"
      #       end
      #
      #       context.with_metadata(validated: true, validated_at: Time.current)
      #     end
      #
      #     def can_run?(context)
      #       context.table && context.table[:columns].any?
      #     end
      #   end
      #
      # @example Stage with error handling
      #   class TransformStage < Stage
      #     def process(context)
      #       # Transform the context
      #       transformed_data = transform_table_data(context.table)
      #       context.with_metadata(transformed_data: transformed_data)
      #
      #     rescue TransformationError => e
      #       # Add stage-specific context to error
      #       raise StageError.new(
      #         stage: self,
      #         context: context,
      #         error: e
      #       )
      #     end
      #   end
      #
      class Stage
        # Stage execution errors with enhanced context
        class StageError < StandardError
          attr_reader :stage, :context, :original_error

          # Initialize StageError with full execution context
          #
          # @param stage [Stage] Stage instance that failed
          # @param context [GenerationContext] Context when failure occurred
          # @param error [StandardError] Original underlying error
          #
          def initialize(stage:, context:, error:)
            @stage = stage
            @context = context
            @original_error = error

            super(build_error_message)
          end

          # Get stage name for error reporting
          #
          # @return [String] Stage class name without module path
          #
          def stage_name
            stage.name
          end

          # Get context information for debugging
          #
          # @return [String] Context details for error diagnostics
          #
          def context_info
            if context.respond_to?(:table_name)
              "table: #{context.table_name}"
            else
              "context: #{context.class.name}"
            end
          end

          private

          # Build comprehensive error message with context
          #
          # @return [String] Detailed error message
          #
          def build_error_message
            "Stage '#{stage_name}' failed during execution " \
              "(#{context_info}): #{original_error.message}"
          end
        end

        # Process the generation context
        #
        # This is the main interface method that all stages must implement.
        # Stages should transform the input context and return a new context
        # (or the same context if no changes are needed).
        #
        # @param context [GenerationContext] Input context with table, schema, etc.
        # @return [GenerationContext] Output context, potentially modified
        #
        # @raise [NotImplementedError] If not implemented by subclass
        # @raise [StageError] If processing fails
        #
        def process(context)
          raise NotImplementedError,
            "#{self.class.name} must implement #process(context)"
        end

        # Determine if this stage can run with the given context
        #
        # This method allows stages to implement conditional execution based
        # on context state. Stages that return false will be skipped during
        # pipeline execution.
        #
        # @param context [GenerationContext] Context to evaluate
        # @return [Boolean] True if stage can process this context
        #
        def can_run?(context)
          true # Default: stages can always run
        end

        # Get human-readable stage name
        #
        # @return [String] Stage name without module namespacing
        #
        def name
          self.class.name.split("::").last
        end

        # Get stage description for logging and debugging
        #
        # @return [String] Brief description of what this stage does
        #
        def description
          "#{name} stage" # Override in subclasses for better descriptions
        end

        # Get stage metadata for pipeline introspection
        #
        # @return [Hash] Stage metadata including name, type, and capabilities
        #
        def metadata
          {
            name: name,
            class: self.class.name,
            description: description,
            can_skip: responds_to_can_run?
          }
        end

        # Check if stage is idempotent (safe to run multiple times)
        #
        # Idempotent stages produce the same result when run multiple times
        # with the same input. This is useful for pipeline optimization and
        # retry strategies.
        #
        # @return [Boolean] True if stage is idempotent
        #
        def idempotent?
          false # Conservative default - override in subclasses
        end

        # Get stage execution priority
        #
        # Lower numbers indicate higher priority. This can be used for
        # automatic stage ordering in dynamic pipelines.
        #
        # @return [Integer] Priority value (0-100, default: 50)
        #
        def priority
          50 # Neutral priority by default
        end

        # Provide detailed string representation for debugging
        #
        # @return [String] Detailed stage inspection
        #
        def inspect
          "#<#{self.class.name}:#{object_id.to_s(16)} " \
            "name=#{name.inspect} " \
            "priority=#{priority} " \
            "idempotent=#{idempotent?}>"
        end

        # Provide compact string representation
        #
        # @return [String] Compact stage description
        #
        def to_s
          "#{name}(#{description})"
        end

        protected

        # Helper method to validate context structure
        #
        # @param context [GenerationContext] Context to validate
        # @param required_keys [Array<Symbol>] Required context attributes
        #
        # @raise [ArgumentError] If required context data is missing
        #
        def validate_context!(context, required_keys = [])
          unless context.respond_to?(:table) && context.respond_to?(:schema)
            raise ArgumentError,
              "Context must respond to :table and :schema methods"
          end

          required_keys.each do |key|
            unless context.respond_to?(key)
              raise ArgumentError,
                "Context missing required attribute: #{key}"
            end
          end
        end

        # Helper method to safely access context metadata
        #
        # @param context [GenerationContext] Context to read from
        # @param key [Symbol] Metadata key to retrieve
        # @param default [Object] Default value if key not found
        # @return [Object] Metadata value or default
        #
        def context_metadata(context, key, default = nil)
          context.respond_to?(:metadata) ? context.metadata.fetch(key, default) : default
        end

        # Helper method to add stage execution metadata
        #
        # @param context [GenerationContext] Context to modify
        # @param stage_data [Hash] Stage-specific metadata to add
        # @return [GenerationContext] Context with added metadata
        #
        def add_stage_metadata(context, stage_data = {})
          stage_metadata = {
            executed_at: Time.current,
            stage_name: name,
            stage_class: self.class.name
          }.merge(stage_data)

          execution_metadata = { "stage_#{name.underscore}".to_sym => stage_metadata }
          context.with_metadata(execution_metadata)
        end

        private

        # Check if stage implements custom can_run? logic
        #
        # @return [Boolean] True if can_run? is overridden
        #
        def responds_to_can_run?
          method(:can_run?).owner != Stage
        end
      end
    end
  end
end
