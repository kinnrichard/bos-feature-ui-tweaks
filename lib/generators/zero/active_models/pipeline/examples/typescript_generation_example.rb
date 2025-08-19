# frozen_string_literal: true

require_relative "../pipeline"
require_relative "../stages/schema_analysis_stage"
require_relative "../stages/model_generation_stage"
require_relative "../stages/typescript_generation_stage"
require_relative "../../generation_context"
require_relative "../../service_registry"

# Example demonstrating how to use TypeScriptGenerationStage in a complete pipeline
#
# This example shows the typical pipeline flow:
# 1. SchemaAnalysisStage: Extract and analyze Rails schema
# 2. ModelGenerationStage: Generate TypeScript model content
# 3. TypeScriptGenerationStage: Write files, create Zero.js integration, handle Loggable config
#
# @example Usage in GenerationCoordinator
#   service_registry = ServiceRegistry.new
#   pipeline = build_typescript_generation_pipeline(service_registry)
#   result = pipeline.execute(initial_context)
#
module Zero
  module Generators
    module Pipeline
      module Examples
        # Build a complete pipeline with TypeScriptGenerationStage
        #
        # @param service_registry [ServiceRegistry] Registry with initialized services
        # @return [Pipeline] Configured pipeline ready for execution
        #
        def self.build_typescript_generation_pipeline(service_registry)
          Pipeline.new(stages: [
            # Stage 1: Extract and analyze schema data
            Stages::SchemaAnalysisStage.new(service_registry),

            # Stage 2: Generate TypeScript model content
            Stages::ModelGenerationStage.new(service_registry),

            # Stage 3: Write TypeScript files, handle Zero.js integration
            Stages::TypeScriptGenerationStage.new(service_registry)
          ], metadata: {
            type: :typescript_generation,
            description: "Complete TypeScript model generation with Zero.js integration",
            version: "1.0.0"
          })
        end

        # Build a TypeScript-only pipeline (assuming schema analysis is done elsewhere)
        #
        # @param service_registry [ServiceRegistry] Registry with initialized services
        # @return [Pipeline] Configured pipeline for TypeScript generation only
        #
        def self.build_typescript_only_pipeline(service_registry)
          Pipeline.new(stages: [
            # Stage 1: Generate TypeScript model content
            Stages::ModelGenerationStage.new(service_registry),

            # Stage 2: Write TypeScript files, handle Zero.js integration
            Stages::TypeScriptGenerationStage.new(service_registry)
          ], metadata: {
            type: :typescript_only,
            description: "TypeScript generation and file writing pipeline"
          })
        end

        # Example of using TypeScriptGenerationStage in isolation
        #
        # @param service_registry [ServiceRegistry] Registry with initialized services
        # @param generated_content [Hash] Pre-generated TypeScript content
        # @return [GenerationContext] Context with written files
        #
        def self.typescript_generation_example(service_registry, generated_content)
          # Create context with pre-generated TypeScript content
          context = GenerationContext.new(
            table: {
              name: "users",
              columns: [
                { name: "id", type: "integer", primary_key: true },
                { name: "email", type: "string", null: false }
              ]
            },
            schema: {
              tables: [],
              relationships: [],
              patterns: {}
            },
            relationships: {},
            options: { dry_run: false },
            metadata: { generated_content: generated_content }
          )

          # Create and run TypeScriptGenerationStage
          stage = Stages::TypeScriptGenerationStage.new(service_registry)
          result = stage.process(context)

          # Result will contain:
          # - result.metadata[:typescript_files] - Array of written file paths
          # - result.metadata[:zero_index_generated] - Boolean indicating Zero.js integration
          # - result.metadata[:loggable_config_generated] - Boolean indicating Loggable config
          # - result.metadata[:batch_processing_result] - File processing metrics

          result
        end

        # Dry run example showing what files would be created
        #
        # @param service_registry [ServiceRegistry] Registry with initialized services
        # @param generated_content [Hash] Pre-generated TypeScript content
        # @return [Array<String>] List of files that would be created
        #
        def self.dry_run_example(service_registry, generated_content)
          # Create dry run context
          context = GenerationContext.new(
            table: {
              name: "tasks",
              columns: [
                { name: "id", type: "integer", primary_key: true },
                { name: "title", type: "string", null: false },
                { name: "completed", type: "boolean", null: false, default: false }
              ]
            },
            schema: { tables: [], relationships: [], patterns: {} },
            relationships: {},
            options: { dry_run: true }, # Enable dry run mode
            metadata: { generated_content: generated_content }
          )

          # Run TypeScriptGenerationStage in dry run mode
          stage = Stages::TypeScriptGenerationStage.new(service_registry)
          result = stage.process(context)

          # Return list of files that would be created
          result.metadata[:dry_run_files]
        end

        # Error handling example
        #
        # @param service_registry [ServiceRegistry] Registry with initialized services
        # @return [Hash] Error handling result
        #
        def self.error_handling_example(service_registry)
          # Create context with invalid generated content to trigger error
          context = GenerationContext.new(
            table: { name: "invalid", columns: [] },
            schema: { tables: [], relationships: [], patterns: {} },
            relationships: {},
            options: { dry_run: false },
            metadata: { generated_content: "invalid_content" } # This will cause validation to fail
          )

          stage = Stages::TypeScriptGenerationStage.new(service_registry)

          begin
            result = stage.process(context)
            { success: true, result: result }
          rescue Stage::StageError => e
            {
              success: false,
              error: e.message,
              stage: e.stage.name,
              context_info: e.context_info
            }
          end
        end
      end
    end
  end
end
