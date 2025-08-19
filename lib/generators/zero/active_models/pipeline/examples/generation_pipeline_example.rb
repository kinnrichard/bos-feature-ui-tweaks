# frozen_string_literal: true

require_relative "../../pipeline"
require_relative "../../generation_context"

module Zero
  module Generators
    module Pipeline
      module Examples
        # Example demonstrating how pipeline architecture will replace GenerationCoordinator
        #
        # This example shows how the current monolithic generation process can be
        # broken down into focused stages that are easier to test, modify, and reason about.
        #
        # Current GenerationCoordinator (1200+ lines) handles:
        # - Schema extraction → SchemaExtractionStage
        # - Model generation → ModelGenerationStage
        # - TypeScript generation → TypeScriptGenerationStage
        # - File writing → FileWritingStage
        # - Formatting → FormattingStage
        # - Validation → ValidationStage (already implemented)
        # - Statistics → LoggingStage (already implemented)
        #
        # Benefits of Pipeline Architecture:
        # - Single Responsibility Principle for each stage
        # - Easy testing of individual components
        # - Clear data flow through GenerationContext
        # - Simple addition/removal of processing steps
        # - Better error isolation and handling
        #
        class GenerationPipelineExample
          class << self
            # Example of future schema extraction stage
            def schema_extraction_stage_example
              Class.new(Stage) do
                def process(context)
                  # Extract schema data from Rails models
                  schema_service = get_schema_service_from_context(context)
                  extracted_schema = schema_service.extract_filtered_schema(
                    exclude_tables: context.options[:exclude_tables] || [],
                    include_only: context.options[:table] ? [ context.options[:table] ] : nil
                  )

                  # Update context with extracted schema
                  context.class.new(
                    table: context.table,
                    schema: extracted_schema,
                    relationships: context.relationships,
                    options: context.options,
                    metadata: context.metadata.merge(
                      schema_extracted: true,
                      extracted_tables_count: extracted_schema[:tables].size,
                      extracted_relationships_count: extracted_schema[:relationships].size
                    )
                  )
                end

                def can_run?(context)
                  context.options.present?
                end

                def description
                  "Extracts and filters schema data from Rails models"
                end

                def priority
                  20 # Should run after validation but before model generation
                end

                private

                def get_schema_service_from_context(context)
                  # In real implementation, would get from service registry
                  # This is just an example pattern
                  context.metadata[:service_registry]&.get_service(:schema) ||
                    RailsSchemaIntrospector.new
                end
              end
            end

            # Example of future model generation stage
            def model_generation_stage_example
              Class.new(Stage) do
                def process(context)
                  # Generate TypeScript model content
                  data_interface = generate_data_interface(context)
                  active_model = generate_active_model(context)
                  reactive_model = generate_reactive_model(context)

                  # Store generated content in metadata
                  context.with_metadata(
                    generated_content: {
                      data_interface: data_interface,
                      active_model: active_model,
                      reactive_model: reactive_model
                    },
                    content_generated: true,
                    generation_timestamp: Time.current
                  )
                end

                def can_run?(context)
                  context.respond_to?(:table_name) &&
                    context.table_name.present? &&
                    context.metadata[:schema_extracted] == true
                end

                def description
                  "Generates TypeScript model content from context data"
                end

                def priority
                  40 # Should run after schema extraction and transformation
                end

                private

                def generate_data_interface(context)
                  # Placeholder for actual template rendering
                  "// Generated #{context.model_name}Data interface\nexport interface #{context.model_name}Data {\n  // columns...\n}"
                end

                def generate_active_model(context)
                  "// Generated #{context.model_name} ActiveRecord model"
                end

                def generate_reactive_model(context)
                  "// Generated Reactive#{context.model_name} ReactiveRecord model"
                end
              end
            end

            # Example of future file writing stage
            def file_writing_stage_example
              Class.new(Stage) do
                def process(context)
                  return context if context.dry_run?

                  generated_content = context.metadata[:generated_content]
                  return context unless generated_content

                  # Write files using FileManager service
                  file_manager = get_file_manager_from_context(context)
                  written_files = []

                  filenames = context.typescript_filenames

                  # Write data interface
                  if generated_content[:data_interface]
                    data_file = file_manager.write_with_formatting(
                      filenames[:data],
                      generated_content[:data_interface]
                    )
                    written_files << data_file
                  end

                  # Write active model
                  if generated_content[:active_model]
                    active_file = file_manager.write_with_formatting(
                      filenames[:active],
                      generated_content[:active_model]
                    )
                    written_files << active_file
                  end

                  # Write reactive model
                  if generated_content[:reactive_model]
                    reactive_file = file_manager.write_with_formatting(
                      filenames[:reactive],
                      generated_content[:reactive_model]
                    )
                    written_files << reactive_file
                  end

                  # Update context with file information
                  context.with_metadata(
                    files_written: written_files,
                    files_written_count: written_files.size,
                    write_timestamp: Time.current
                  )
                end

                def can_run?(context)
                  context.metadata[:content_generated] == true
                end

                def description
                  "Writes generated TypeScript content to files"
                end

                def priority
                  60 # Should run after content generation
                end

                def idempotent?
                  # File writing with semantic comparison can be idempotent
                  true
                end

                private

                def get_file_manager_from_context(context)
                  context.metadata[:service_registry]&.get_service(:file_manager)
                end
              end
            end

            # Demonstrate complete generation pipeline
            def create_complete_generation_pipeline
              Pipeline.new(
                stages: [
                  Stages::LoggingStage.new,
                  Stages::ValidationStage.new(
                    required_fields: [ :table, :schema, :options ],
                    validate_table_structure: true
                  ),
                  schema_extraction_stage_example.new,
                  Stages::TransformStage.new(
                    normalize_column_names: true,
                    enhance_relationships: true,
                    add_computed_properties: true
                  ),
                  model_generation_stage_example.new,
                  file_writing_stage_example.new,
                  Stages::LoggingStage.new # Final logging for completion
                ],
                metadata: {
                  type: :complete_generation,
                  description: "Full model generation pipeline",
                  replaces: "GenerationCoordinator#execute"
                }
              )
            end

            # Example of how to run the pipeline
            def run_generation_example
              # Create sample data (normally comes from Rails schema)
              table_data = {
                name: "users",
                columns: [
                  { name: "id", type: "integer", primary_key: true },
                  { name: "email", type: "string", null: false },
                  { name: "name", type: "string", null: true },
                  { name: "created_at", type: "datetime", null: false },
                  { name: "updated_at", type: "datetime", null: false }
                ]
              }

              schema_data = {
                tables: [ table_data ],
                relationships: [],
                patterns: {}
              }

              # Create generation context
              context = GenerationContext.new(
                table: table_data,
                schema: schema_data,
                relationships: {},
                options: {
                  dry_run: false,
                  output_dir: "frontend/src/lib/models",
                  exclude_tables: []
                },
                metadata: {
                  service_registry: nil # Would be actual ServiceRegistry instance
                }
              )

              # Execute pipeline
              pipeline = create_complete_generation_pipeline
              result = pipeline.execute(context)

              # Display results
              puts "\n=== Generation Pipeline Results ==="
              puts "Table: #{result.table_name}"
              puts "Model: #{result.model_name}"
              puts "Files: #{result.typescript_filenames.values.join(', ')}"
              puts "Stages executed: #{pipeline.execution_statistics[:stages_executed]}"
              puts "Total time: #{pipeline.execution_statistics[:last_execution_time]}s"

              if result.metadata[:files_written]
                puts "Files written: #{result.metadata[:files_written_count]}"
              end

              result

            rescue StageError => e
              puts "\n=== Pipeline Error ==="
              puts "Failed stage: #{e.stage_name}"
              puts "Error: #{e.message}"
              puts "Category: #{e.error_category}"
              puts "Recoverable: #{e.recoverable?}"
              puts "Context: #{e.context_info}"

              # In real implementation, might attempt recovery
              if e.recoverable?
                puts "Attempting recovery..."
                # Could retry with modified pipeline or context
              end

              raise
            end

            # Demonstrate pipeline testing approach
            def test_individual_stage_example
              # Test schema extraction in isolation
              stage = schema_extraction_stage_example.new
              test_context = GenerationContext.new(
                table: { name: "test", columns: [] },
                schema: { tables: [], relationships: [], patterns: {} },
                options: { table: "test" }
              )

              # Mock the service dependency
              mock_service = double("SchemaService")
              allow(mock_service).to receive(:extract_filtered_schema).and_return({
                tables: [ { name: "test", columns: [] } ],
                relationships: [],
                patterns: {}
              })

              test_context = test_context.with_metadata(
                service_registry: double("ServiceRegistry", get_service: mock_service)
              )

              # Test stage in isolation
              result = stage.process(test_context)

              puts "\n=== Individual Stage Test ==="
              puts "Stage: #{stage.description}"
              puts "Can run: #{stage.can_run?(test_context)}"
              puts "Schema extracted: #{result.metadata[:schema_extracted]}"
              puts "Tables count: #{result.metadata[:extracted_tables_count]}"

              result
            end

            # Show migration path from GenerationCoordinator
            def migration_strategy_example
              puts "\n=== Migration Strategy ==="
              puts
              puts "Phase 1: Create Pipeline Architecture (STORY-EP37-002) ✓"
              puts "- Implement Pipeline, Stage, and example stages"
              puts "- Create comprehensive tests"
              puts "- Document usage patterns"
              puts
              puts "Phase 2: Extract First Stage (STORY-EP37-004)"
              puts "- Create SchemaAnalysisStage from GenerationCoordinator"
              puts "- Test stage in isolation"
              puts "- Integrate with existing coordinator as fallback"
              puts
              puts "Phase 3: Extract More Stages"
              puts "- ModelGenerationStage (STORY-EP37-005)"
              puts "- TypeScriptGenerationStage (STORY-EP37-006)"
              puts "- FormattingStage (STORY-EP37-007)"
              puts
              puts "Phase 4: Replace Coordinator (STORY-EP37-010)"
              puts "- Strangler Fig pattern: gradually replace coordinator methods"
              puts "- Pipeline becomes primary execution path"
              puts "- Keep coordinator as thin orchestration wrapper initially"
              puts
              puts "Phase 5: Complete Migration"
              puts "- Remove old coordinator logic"
              puts "- Pipeline becomes the only execution path"
              puts "- Optimize pipeline performance"

              puts "\n=== Benefits After Migration ==="
              puts "✓ Single Responsibility: Each stage has one clear purpose"
              puts "✓ Easy Testing: Stages can be tested in isolation"
              puts "✓ Flexible Composition: Add/remove/reorder stages easily"
              puts "✓ Better Error Handling: Precise error context and recovery"
              puts "✓ Clear Data Flow: Context objects show what each stage needs"
              puts "✓ Performance Monitoring: Per-stage timing and metrics"
              puts "✓ Maintainability: Much smaller, focused classes"
            end
          end
        end
      end
    end
  end
end

# Example usage (can be run in Rails console):
#
# require_relative 'lib/generators/zero/active_models/pipeline/examples/generation_pipeline_example'
#
# # Run complete example
# Zero::Generators::Pipeline::Examples::GenerationPipelineExample.run_generation_example
#
# # Test individual stage
# Zero::Generators::Pipeline::Examples::GenerationPipelineExample.test_individual_stage_example
#
# # Show migration strategy
# Zero::Generators::Pipeline::Examples::GenerationPipelineExample.migration_strategy_example
