# frozen_string_literal: true

require_relative "../stage"

module Zero
  module Generators
    module Pipeline
      module Stages
        # TypeScriptGenerationStage is responsible for generating TypeScript-specific files
        #
        # This stage extracts TypeScript generation logic from GenerationCoordinator and
        # handles all TypeScript-specific setup and file generation including:
        # - Zero.js specific setup (schema generation)
        # - ReactiveRecord integration
        # - Index file generation
        # - Type definitions export
        # - Module organization
        #
        # Key Responsibilities:
        # - Generate TypeScript interfaces from Rails schema data
        # - Create ActiveRecord model classes for mutations
        # - Create ReactiveRecord model classes for reactive queries
        # - Handle Zero.js integration and setup
        # - Generate index files for module exports
        # - Generate Loggable configuration files
        # - Manage TypeScript file organization and naming
        # - Apply deferred file writing for batch processing
        #
        # Input: GenerationContext with schema data and relationships
        # Output: GenerationContext with TypeScript files added to metadata
        #
        # The stage uses the service registry to access:
        # - TemplateRenderer for ERB template processing
        # - TypeMapper for Rails to TypeScript type conversion
        # - RelationshipProcessor for relationship handling
        # - PolymorphicModelAnalyzer for polymorphic associations
        # - DefaultValueConverter for default value processing
        # - FileManager for file writing and formatting
        #
        # @example Usage in pipeline
        #   pipeline = Pipeline.new(stages: [
        #     SchemaAnalysisStage.new(service_registry),
        #     ModelGenerationStage.new(service_registry),
        #     TypeScriptGenerationStage.new(service_registry)
        #   ])
        #
        # @example Generated files for User table
        #   types/user-data.ts        # UserData interface
        #   user.ts                   # User ActiveRecord model
        #   reactive-user.ts          # ReactiveUser model
        #   ../zero/index.ts          # Zero.js integration index
        #   generated-loggable-config.ts # Loggable models configuration
        #
        class TypeScriptGenerationStage < Stage
          # TypeScript generation specific errors
          class TypeScriptGenerationError < StandardError; end
          class FileWritingError < TypeScriptGenerationError; end
          class IndexGenerationError < TypeScriptGenerationError; end
          class ConfigGenerationError < TypeScriptGenerationError; end

          attr_reader :service_registry

          # Initialize TypeScriptGenerationStage with service dependencies
          #
          # @param service_registry [ServiceRegistry] Registry providing file, template, and other services
          #
          def initialize(service_registry)
            @service_registry = service_registry
            super()
          end

          # Process context by generating TypeScript files and managing file operations
          #
          # This is the main stage processing method that handles all TypeScript-specific
          # file generation, including model files, index files, and configuration files.
          # It uses deferred file writing for batch processing optimization.
          #
          # @param context [GenerationContext] Input context with generated model content
          # @return [GenerationContext] Context enriched with TypeScript file paths
          #
          # @raise [TypeScriptGenerationError] If TypeScript generation fails at any stage
          #
          def process(context)
            validate_context!(context, [ :generated_content ])

            begin
              # Skip if dry run mode
              if context.dry_run?
                return handle_dry_run_mode(context)
              end

              # Phase 1: Write TypeScript model files with deferred processing
              generated_files = write_typescript_files(context)

              # Phase 2: Skip index generation in multi-table mode (handled after all tables)
              # Only generate index files if we're processing a single table
              zero_index_file = nil
              loggable_config_file = nil

              if context.options[:single_table_mode] != false
                # Generate Zero.js index file
                zero_index_file = generate_zero_index_file(context)

                # Generate Loggable configuration file
                loggable_config_file = generate_loggable_configuration(context)
              end

              # Phase 3: Skip batch processing here - will be done after all tables
              # batch_result = process_batch_files (moved to pipeline level)
              batch_result = { success: true, processed_count: 0 }

              # Phase 4: Collect all generated file paths
              all_files = [ *generated_files, zero_index_file, loggable_config_file ].compact

              # Phase 6: Store results in context metadata
              typescript_metadata = {
                typescript_files: all_files,
                zero_index_generated: !zero_index_file.nil?,
                loggable_config_generated: !loggable_config_file.nil?,
                batch_processing_result: batch_result,
                files_count: all_files.length
              }

              # Phase 7: Add stage execution metadata
              enriched_context = context.with_metadata(typescript_metadata)

              add_stage_metadata(enriched_context, {
                files_written: all_files.length,
                zero_js_integration: !zero_index_file.nil?,
                loggable_integration: !loggable_config_file.nil?,
                batch_operations: batch_result[:processed] || 0,
                processing_time: batch_result[:time] || 0.0
              })

            rescue StandardError => e
              raise Stage::StageError.new(
                stage: self,
                context: context,
                error: e
              )
            end
          end

          # Check if stage can run with the given context
          #
          # TypeScriptGenerationStage requires generated content from previous stages
          # to write TypeScript files to disk.
          #
          # @param context [GenerationContext] Context to evaluate
          # @return [Boolean] True if context has generated content ready for file writing
          #
          def can_run?(context)
            return false unless context.respond_to?(:metadata)
            return false unless context.metadata.key?(:generated_content)

            generated_content = context.metadata[:generated_content]
            return false unless generated_content.is_a?(Hash)

            # Check that all required TypeScript content is present
            required_keys = [ :data_interface, :active_model, :reactive_model, :filenames ]
            required_keys.all? { |key| generated_content.key?(key) }
          end

          # Get stage description for logging and debugging
          #
          # @return [String] Brief description of what this stage does
          #
          def description
            "Writes TypeScript files, generates Zero.js integration, and manages file organization"
          end

          # Check if stage is idempotent (safe to run multiple times)
          #
          # @return [Boolean] False - file writing operations are not idempotent due to formatting and timestamps
          #
          def idempotent?
            false
          end

          # Get stage execution priority
          #
          # @return [Integer] Priority value (20 = high priority, should run after model generation)
          #
          def priority
            20
          end

          private

          # Handle dry run mode by reporting files that would be created
          #
          # @param context [GenerationContext] Generation context
          # @return [GenerationContext] Context with dry run metadata
          #
          def handle_dry_run_mode(context)
            generated_content = context.metadata[:generated_content]
            filenames = generated_content[:filenames]

            dry_run_files = [
              filenames[:data],
              filenames[:active],
              filenames[:reactive],
              "../zero/index.ts",
              "generated-loggable-config.ts"
            ]

            # Report dry run files (would typically go to shell, but we'll store in metadata)
            dry_run_metadata = {
              dry_run_files: dry_run_files,
              files_count: dry_run_files.length,
              zero_js_integration: true,
              loggable_integration: true
            }

            context.with_metadata(dry_run_metadata)
          end

          # Write TypeScript model files using deferred file writing
          #
          # @param context [GenerationContext] Generation context with content
          # @return [Array<String>] Array of written file paths
          #
          # @raise [FileWritingError] If file writing fails
          #
          def write_typescript_files(context)
            generated_content = context.metadata[:generated_content]
            file_manager = service_registry.get_service(:file_manager)

            begin
              files_written = []
              filenames = generated_content[:filenames]

              # Write data interface file
              data_file_path = file_manager.write_with_formatting(
                filenames[:data],
                generated_content[:data_interface],
                defer_write: true
              )
              files_written << data_file_path

              # Write ActiveRecord model file
              active_file_path = file_manager.write_with_formatting(
                filenames[:active],
                generated_content[:active_model],
                defer_write: true
              )
              files_written << active_file_path

              # Write ReactiveRecord model file
              reactive_file_path = file_manager.write_with_formatting(
                filenames[:reactive],
                generated_content[:reactive_model],
                defer_write: true
              )
              files_written << reactive_file_path

              files_written

            rescue => e
              raise FileWritingError, "Failed to write TypeScript files: #{e.message}"
            end
          end

          # Generate Zero.js index file with model integration examples
          #
          # Creates the Zero.js integration index file that demonstrates how to use
          # the generated models within the Zero.js reactive framework.
          #
          # @param context [GenerationContext] Generation context
          # @return [String, nil] Path to generated index file or nil if skipped
          #
          # @raise [IndexGenerationError] If index generation fails
          #
          def generate_zero_index_file(context)
            begin
              file_manager = service_registry.get_service(:file_manager)

              # Build model import examples (using first 3 models as examples)
              model_import_examples = generate_model_import_examples(context)

              # Generate Zero index content
              zero_index_content = build_zero_index_content(model_import_examples)

              # Write index file
              file_manager.write_with_formatting("../zero/index.ts", zero_index_content)

            rescue => e
              raise IndexGenerationError, "Failed to generate Zero.js index file: #{e.message}"
            end
          end

          # Generate Loggable configuration file
          #
          # Creates a TypeScript configuration file that maps all models
          # that include the Loggable concern for system-wide logging integration.
          #
          # @param context [GenerationContext] Generation context
          # @return [String, nil] Path to generated config file or nil if skipped
          #
          # @raise [ConfigGenerationError] If configuration generation fails
          #
          def generate_loggable_configuration(context)
            begin
              file_manager = service_registry.get_service(:file_manager)

              # Generate Loggable configuration content
              config_content = build_loggable_config_content

              # Force write the file to ensure it's updated
              config_path = File.join(file_manager.output_dir, "generated-loggable-config.ts")
              full_path = if Pathname.new(file_manager.output_dir).absolute?
                            config_path
              else
                            File.join(Rails.root, config_path)
              end

              # Ensure directory exists
              FileUtils.mkdir_p(File.dirname(full_path))

              # Write the file directly (not deferred since it's configuration)
              File.write(full_path, config_content)

              full_path

            rescue => e
              raise ConfigGenerationError, "Failed to generate Loggable configuration: #{e.message}"
            end
          end

          # Process batch file operations for deferred writes
          #
          # @return [Hash] Batch processing results
          #
          def process_batch_files
            # Delegate to FileManager for batch processing
            file_manager = service_registry.get_service(:file_manager)

            if file_manager.respond_to?(:process_batch_files)
              file_manager.process_batch_files
              { success: true, processed_count: file_manager.statistics[:created] }
            else
              # Fallback if FileManager doesn't have batch processing
              { success: true, processed_count: 0 }
            end
          end

          # Generate model import examples for Zero.js documentation
          #
          # @param context [GenerationContext] Generation context
          # @return [String] Generated import examples
          #
          def generate_model_import_examples(context)
            class_name = context.model_name
            kebab_name = context.kebab_name

            # For now, generate example for current model (in practice this might aggregate from multiple models)
            "// import { #{class_name}, Reactive#{class_name} } from '$lib/models/#{kebab_name}';"
          end

          # Build Zero.js index file content with model integration examples
          #
          # @param model_import_examples [String] Generated import examples
          # @return [String] Complete Zero.js index file content
          #
          def build_zero_index_content(model_import_examples)
            <<~TYPESCRIPT
              // Zero - Complete export file
              // All Zero client functionality and Epic-008 model integration
              //
              // Auto-generated: #{Time.current.strftime("%Y-%m-%d %H:%M:%S UTC")}
              //
              // ⚠️  Do not edit this file manually - it will be regenerated
              // To regenerate: rails generate zero:active_models

              // Zero client initialization and management
              export { initZero, getZero, getZeroAsync, getZeroState, closeZero, reinitializeZero } from './zero-client';

              // Zero schema types
              export { schema, type ZeroClient } from './generated-schema';

              // Epic-008 models are now managed in /lib/models/ instead of legacy .generated files
              // Use the Epic-008 models directly for reliable, reactive data access:
              //
              #{model_import_examples}
              //
              // Legacy .generated.ts files have been removed as part of Epic-008 cleanup.
              // This ensures consistent ReactiveRecord patterns and prevents daily regression
              // from legacy fixture generators.

              // Re-export Zero library types for convenience
              export type { Zero } from '@rocicorp/zero';

              /**
               * Epic-008 Migration Notes:
               *
               * Before (Legacy):
               * import { User } from '$lib/zero/user.generated';
               * const usersQuery = User.all(); // Unreliable fixture generator
               *
               * After (Epic-008):
               * import { ReactiveUser as User } from '$lib/models/reactive-user';
               * const usersQuery = User.all(); // Reliable ReactiveRecord pattern
               *
               * Benefits:
               * - Consistent Zero.js ReactiveQuery patterns
               * - No daily regression from legacy generators
               * - Clean separation of concerns
               * - Type-safe Epic-008 architecture
               */
            TYPESCRIPT
          end

          # Build Loggable configuration content
          #
          # @return [String] Generated TypeScript configuration content
          #
          def build_loggable_config_content
            loggable_models = detect_loggable_models

            # Sort models by table name for consistent output
            sorted_models = loggable_models.sort_by { |table_name, _| table_name }

            # Generate model entries
            model_entries = sorted_models.map do |table_name, config|
              "  '#{table_name}': { modelName: '#{config[:modelName]}', includesLoggable: true }"
            end.join(",\n")

            <<~TYPESCRIPT
              // 🤖 AUTO-GENERATED LOGGABLE CONFIGURATION
              //#{' '}
              // ⚠️  DO NOT EDIT THIS FILE DIRECTLY
              // This file is automatically generated by Rails generator
              // Run: rails generate zero:active_models

              export const LOGGABLE_MODELS = {
              #{model_entries}
              } as const;

              export type LoggableModelName = keyof typeof LOGGABLE_MODELS;

              export function isLoggableModel(tableName: string): tableName is LoggableModelName {
                return tableName in LOGGABLE_MODELS;
              }

              export function getLoggableModelInfo(tableName: LoggableModelName) {
                return LOGGABLE_MODELS[tableName];
              }
            TYPESCRIPT
          end

          # Detect models that include the Loggable concern
          #
          # @return [Hash] Map of table names to model info for Loggable models
          #
          def detect_loggable_models
            loggable_models = {}

            # Ensure all models are loaded for introspection
            # In Rails 8.0 with Zeitwerk, only eager load the models directory
            if defined?(Rails) && !Rails.application.config.eager_load
              Rails.autoloaders.main.eager_load_dir(Rails.root.join("app/models"))
            end

            # Check loaded models for Loggable concern
            if defined?(ApplicationRecord)
              ApplicationRecord.descendants.each do |model|
                next unless model.respond_to?(:included_modules)
                next unless model.included_modules.include?(Loggable)

                loggable_models[model.table_name] = {
                  modelName: model.name,
                  includesLoggable: true
                }
              end
            end

            # If still empty, use known models as fallback
            if loggable_models.empty?
              %w[Job Task Client User Person Device ScheduledDateTime].each do |model_name|
                begin
                  model = model_name.constantize
                  if model.included_modules.include?(Loggable)
                    loggable_models[model.table_name] = {
                      modelName: model_name,
                      includesLoggable: true
                    }
                  end
                rescue => e
                  # Silently skip models that can't be loaded
                  Rails.logger.debug "Could not check #{model_name}: #{e.message}" if defined?(Rails)
                end
              end
            end

            loggable_models
          rescue => e
            Rails.logger.warn "Failed to detect Loggable models: #{e.message}" if defined?(Rails)
            {}
          end
        end
      end
    end
  end
end
