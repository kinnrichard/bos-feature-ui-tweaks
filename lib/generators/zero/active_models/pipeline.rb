# frozen_string_literal: true

# Pipeline architecture for ReactiveRecord generation refactoring
#
# This module implements the Pipeline pattern to replace the monolithic
# GenerationCoordinator with composable, testable stages. Each stage has
# a single responsibility and operates on GenerationContext objects.
#
# Key Components:
# - Pipeline: Orchestrates stage execution with error handling and metrics
# - Stage: Base class for all pipeline stages with standard interface
# - StageError: Enhanced error handling with execution context
# - Example Stages: LoggingStage, ValidationStage, TransformStage
#
# @example Basic pipeline usage
#   require 'generators/zero/active_models/pipeline'
#
#   pipeline = Zero::Generators::Pipeline::Pipeline.new(stages: [
#     Zero::Generators::Pipeline::Stages::ValidationStage.new,
#     Zero::Generators::Pipeline::Stages::TransformStage.new,
#     CustomProcessingStage.new
#   ])
#
#   context = Zero::Generators::GenerationContext.new(
#     table: table_data,
#     schema: schema_data
#   )
#
#   result = pipeline.execute(context)
#
# @example Pipeline composition
#   enhanced_pipeline = pipeline
#     .with_stage(LoggingStage.new, position: 0)
#     .without_stage(TransformStage)
#     .replace_stage(ValidationStage, StrictValidationStage.new)
#
# @example Error handling
#   begin
#     result = pipeline.execute(context)
#   rescue Zero::Generators::Pipeline::StageError => e
#     puts "Stage #{e.stage_name} failed: #{e.message}"
#     puts "Error category: #{e.error_category}"
#     puts "Recoverable: #{e.recoverable?}"
#
#     # Get full error report for logging
#     Rails.logger.error(e.error_report.to_json)
#   end
#

require_relative "pipeline/stage_error"
require_relative "pipeline/stage"
require_relative "pipeline/pipeline"

# Load example stages
require_relative "pipeline/stages/logging_stage"
require_relative "pipeline/stages/validation_stage"
require_relative "pipeline/stages/transform_stage"

module Zero
  module Generators
    module Pipeline
      # Pipeline architecture version for compatibility tracking
      VERSION = "1.0.0"

      # Default pipeline configuration for common use cases
      DEFAULT_STAGES = [
        Stages::LoggingStage,
        Stages::ValidationStage,
        Stages::TransformStage
      ].freeze

      # Quick access to common stage types
      STAGE_TYPES = {
        logging: Stages::LoggingStage,
        validation: Stages::ValidationStage,
        transform: Stages::TransformStage
      }.freeze

      class << self
        # Create pipeline with default stages for common generation tasks
        #
        # @param additional_stages [Array<Stage>] Additional stages to include
        # @param exclude_stages [Array<Class>] Stage classes to exclude from defaults
        # @param enable_logging [Boolean] Whether to enable pipeline execution logging
        # @return [Pipeline] Configured pipeline ready for execution
        #
        def default_pipeline(additional_stages: [], exclude_stages: [], enable_logging: false)
          stages = DEFAULT_STAGES.map(&:new).reject do |stage|
            exclude_stages.any? { |excluded_class| stage.is_a?(excluded_class) }
          end

          stages.concat(additional_stages)

          Pipeline.new(
            stages: stages,
            metadata: { type: :default, created_at: Time.current },
            enable_logging: enable_logging
          )
        end

        # Create empty pipeline for custom configuration
        #
        # @param metadata [Hash] Optional pipeline metadata
        # @param enable_logging [Boolean] Whether to enable execution logging
        # @return [Pipeline] Empty pipeline ready for stage addition
        #
        def empty_pipeline(metadata: {}, enable_logging: false)
          Pipeline.new(
            stages: [],
            metadata: metadata.merge(type: :custom, created_at: Time.current),
            enable_logging: enable_logging
          )
        end

        # Create pipeline from stage type symbols
        #
        # @param stage_types [Array<Symbol>] Stage type symbols from STAGE_TYPES
        # @param stage_options [Hash] Options to pass to stage constructors
        # @param enable_logging [Boolean] Whether to enable execution logging
        # @return [Pipeline] Pipeline with specified stage types
        #
        # @example
        #   pipeline = Pipeline.from_types(
        #     [:validation, :transform],
        #     stage_options: { strict_mode: true }
        #   )
        #
        def from_types(stage_types, stage_options: {}, enable_logging: false)
          stages = stage_types.map do |type|
            stage_class = STAGE_TYPES[type]
            raise ArgumentError, "Unknown stage type: #{type}" unless stage_class

            stage_class.new(**stage_options)
          end

          Pipeline.new(
            stages: stages,
            metadata: {
              type: :from_types,
              stage_types: stage_types,
              created_at: Time.current
            },
            enable_logging: enable_logging
          )
        end

        # Get available stage types
        #
        # @return [Array<Symbol>] Available stage type symbols
        #
        def available_stage_types
          STAGE_TYPES.keys
        end

        # Get pipeline architecture version
        #
        # @return [String] Current pipeline version
        #
        def version
          VERSION
        end

        # Validate stage implements required interface
        #
        # @param stage [Object] Stage object to validate
        # @return [Boolean] True if stage implements required interface
        # @raise [ArgumentError] If stage is invalid
        #
        def valid_stage?(stage)
          unless stage.respond_to?(:process)
            raise ArgumentError, "Stage #{stage.class} must implement #process method"
          end

          unless stage.respond_to?(:can_run?)
            raise ArgumentError, "Stage #{stage.class} must implement #can_run? method"
          end

          true
        end
      end
    end
  end
end
