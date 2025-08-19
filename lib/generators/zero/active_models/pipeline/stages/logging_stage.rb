# frozen_string_literal: true

require_relative "../stage"

module Zero
  module Generators
    module Pipeline
      module Stages
        # LoggingStage adds execution metadata and timestamps to the context
        #
        # This stage demonstrates basic pipeline stage implementation by adding
        # logging information to the context metadata. It's useful for tracking
        # pipeline execution flow and debugging stage interactions.
        #
        # Key Features:
        # - Adds execution timestamps to context
        # - Records stage execution order
        # - Preserves all existing context data
        # - Safe to run multiple times (idempotent)
        #
        # @example Usage in pipeline
        #   pipeline = Pipeline.new(stages: [
        #     LoggingStage.new,
        #     ActualProcessingStage.new,
        #     LoggingStage.new  # Can track execution completion
        #   ])
        #
        # @example Accessing logged data
        #   result = pipeline.execute(context)
        #   execution_log = result.metadata[:execution_log]
        #   puts "Pipeline started at: #{execution_log[:started_at]}"
        #
        class LoggingStage < Stage
          attr_reader :log_level, :include_context_snapshot

          # Initialize LoggingStage with optional configuration
          #
          # @param log_level [Symbol] Logging level (:debug, :info, :warn, :error)
          # @param include_context_snapshot [Boolean] Whether to snapshot context state
          #
          def initialize(log_level: :info, include_context_snapshot: false)
            @log_level = log_level
            @include_context_snapshot = include_context_snapshot
            super()
          end

          # Add execution timestamp and metadata to context
          #
          # @param context [GenerationContext] Input context
          # @return [GenerationContext] Context with added logging metadata
          #
          def process(context)
            execution_metadata = build_execution_metadata(context)

            # Add to existing execution log or create new one
            current_log = context.metadata.fetch(:execution_log, [])
            updated_log = current_log + [ execution_metadata ]

            context.with_metadata(
              execution_log: updated_log,
              last_logged_at: Time.current,
              pipeline_step_count: updated_log.size
            )
          end

          # LoggingStage can always run
          #
          # @param context [GenerationContext] Context to evaluate
          # @return [Boolean] Always true
          #
          def can_run?(context)
            true
          end

          # LoggingStage is safe to run multiple times
          #
          # @return [Boolean] True - logging is idempotent
          #
          def idempotent?
            true
          end

          # LoggingStage should run early in pipeline
          #
          # @return [Integer] Low priority number (10)
          #
          def priority
            10
          end

          # Get stage description
          #
          # @return [String] Description of logging stage functionality
          #
          def description
            "Adds execution metadata and timestamps to context"
          end

          private

          # Build execution metadata for current context
          #
          # @param context [GenerationContext] Current context
          # @return [Hash] Metadata about this execution step
          #
          def build_execution_metadata(context)
            metadata = {
              timestamp: Time.current,
              stage: name,
              log_level: @log_level,
              context_class: context.class.name
            }

            # Add context snapshot if requested
            if @include_context_snapshot
              metadata[:context_snapshot] = build_context_snapshot(context)
            end

            # Add table information if available
            if context.respond_to?(:table_name) && context.table_name
              metadata[:table_name] = context.table_name
            end

            if context.respond_to?(:model_name) && context.model_name
              metadata[:model_name] = context.model_name
            end

            # Add processing flags
            if context.respond_to?(:dry_run?)
              metadata[:dry_run] = context.dry_run?
            end

            metadata
          end

          # Build lightweight context snapshot for debugging
          #
          # @param context [GenerationContext] Context to snapshot
          # @return [Hash] Key context information
          #
          def build_context_snapshot(context)
            snapshot = {
              metadata_keys: context.metadata.keys,
              options_keys: context.options.keys
            }

            # Add table structure info if available
            if context.respond_to?(:table) && context.table
              snapshot[:table_columns_count] = context.table.fetch(:columns, []).size
              snapshot[:table_name] = context.table[:name]
            end

            # Add schema info if available
            if context.respond_to?(:schema) && context.schema
              snapshot[:schema_tables_count] = context.schema.fetch(:tables, []).size
              snapshot[:relationships_count] = context.schema.fetch(:relationships, []).size
            end

            # Add relationships info if available
            if context.respond_to?(:relationships) && context.relationships
              snapshot[:has_relationships] = context.relationships.any? { |_type, relations| relations.any? }
            end

            snapshot
          end
        end
      end
    end
  end
end
