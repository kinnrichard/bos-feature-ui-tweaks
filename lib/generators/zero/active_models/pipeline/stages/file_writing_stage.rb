# frozen_string_literal: true

require_relative "../stage"
require_relative "../../file_writer"
require_relative "../../semantic_comparator"

module Zero
  module Generators
    module Pipeline
      module Stages
        # FileWritingStage handles writing generated files to disk
        #
        # This stage is responsible for taking the generated TypeScript artifacts
        # and writing them to the filesystem using the FileWriter class. It provides
        # a clean separation between file generation and file I/O operations.
        #
        # Key Responsibilities:
        # - Write TypeScript model files to disk
        # - Write index files with exports
        # - Use semantic comparison to avoid unnecessary writes
        # - Track file writing statistics
        # - Support dry-run mode
        #
        # Input: GenerationContext with typescript_artifacts metadata
        # Output: GenerationContext with file writing results and statistics
        #
        # The stage expects typescript_artifacts in the context metadata with structure:
        # {
        #   models: [{ file_path: "models/user.ts", typescript_content: "..." }],
        #   index_file: { path: "index.ts", content: "..." }
        # }
        #
        # @example Usage in pipeline
        #   pipeline = Pipeline.new(stages: [
        #     SchemaAnalysisStage.new(service_registry),
        #     ModelGenerationStage.new(service_registry),
        #     TypeScriptGenerationStage.new(service_registry),
        #     FormattingStage.new(service_registry),
        #     FileWritingStage.new(service_registry)
        #   ])
        #
        class FileWritingStage < Stage
          # File writing specific errors
          class FileWritingError < StandardError; end
          class OutputDirectoryError < FileWritingError; end

          attr_reader :service_registry, :file_writer

          # Initialize FileWritingStage with service dependencies
          #
          # @param service_registry [ServiceRegistry] Registry providing shell and other services
          # @param file_writer [FileWriter] Optional custom file writer (for testing)
          def initialize(service_registry, file_writer: nil)
            @service_registry = service_registry
            @file_writer = file_writer
            super()
          end

          # Process context by writing TypeScript artifacts to disk
          #
          # This is the main stage processing method that handles all file writing
          # operations with semantic comparison and proper error handling.
          #
          # @param context [GenerationContext] Input context with typescript_artifacts metadata
          # @return [GenerationContext] Context enriched with file writing results
          #
          # @raise [FileWritingError] If file writing setup or execution fails
          def process(context)
            validate_context!(context)

            begin
              # Phase 1: Setup file writer
              writer = get_or_create_file_writer(context)

              # Phase 2: Extract artifacts to write
              artifacts = extract_typescript_artifacts(context)

              if artifacts.empty?
                return handle_no_artifacts_to_write(context)
              end

              # Phase 3: Write all files
              write_results = write_all_artifacts(writer, artifacts)

              # Phase 4: Build result metadata
              file_writing_metadata = {
                file_writing_results: write_results,
                files_written: write_results.count { |r| r[:result] == :created },
                files_skipped: write_results.count { |r| r[:result] == :identical },
                files_with_errors: write_results.count { |r| r[:result] == :error },
                total_files_processed: write_results.size,
                writer_statistics: writer.statistics
              }

              # Phase 5: Add stage execution metadata
              enriched_context = context.with_metadata(file_writing_metadata)

              add_stage_metadata(enriched_context, {
                files_written_count: file_writing_metadata[:files_written],
                files_skipped_count: file_writing_metadata[:files_skipped],
                errors_count: file_writing_metadata[:files_with_errors],
                total_files: file_writing_metadata[:total_files_processed]
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
          # FileWritingStage requires typescript_artifacts metadata from TypeScriptGenerationStage
          # to know which files need to be written.
          #
          # @param context [GenerationContext] Context to evaluate
          # @return [Boolean] True if context has typescript_artifacts ready for writing
          def can_run?(context)
            return false unless context.respond_to?(:metadata)
            return false unless context.metadata.key?(:typescript_artifacts)

            artifacts = context.metadata[:typescript_artifacts]
            artifacts.is_a?(Hash) && (artifacts[:models] || artifacts[:index_file])
          end

          # Get stage description for logging and debugging
          #
          # @return [String] Brief description of what this stage does
          def description
            "Write TypeScript files to disk with semantic comparison"
          end

          # Check if stage is idempotent (safe to run multiple times)
          #
          # FileWritingStage is idempotent - writing the same files multiple times
          # produces the same result due to semantic comparison.
          #
          # @return [Boolean] True, stage is safe to run multiple times
          def idempotent?
            true
          end

          # Get stage execution priority
          #
          # FileWritingStage should run after all generation and formatting stages
          # as the final step in the pipeline.
          #
          # @return [Integer] Priority value (10 = low priority, runs last)
          def priority
            10
          end

          private

          # Get or create FileWriter for this stage
          #
          # @param context [GenerationContext] Generation context
          # @return [FileWriter] Configured file writer instance
          def get_or_create_file_writer(context)
            return @file_writer if @file_writer

            output_dir = determine_output_directory(context)
            writer_options = build_writer_options(context)

            FileWriter.new(output_dir, writer_options)
          end

          # Determine output directory from context
          #
          # @param context [GenerationContext] Generation context
          # @return [String] Output directory path
          # @raise [OutputDirectoryError] If output directory cannot be determined
          def determine_output_directory(context)
            output_dir = context.options[:output_dir] ||
                        context.metadata[:output_directory] ||
                        "frontend/generated"

            unless output_dir
              raise OutputDirectoryError, "Output directory not specified in context"
            end

            output_dir
          end

          # Build FileWriter options from context
          #
          # @param context [GenerationContext] Generation context
          # @return [Hash] FileWriter options
          def build_writer_options(context)
            {
              dry_run: context.dry_run?,
              force: context.options[:force],
              verbose: should_be_verbose?(context)
            }
          end

          # Determine if verbose output should be enabled
          #
          # @param context [GenerationContext] Generation context
          # @return [Boolean] True if verbose output should be enabled
          def should_be_verbose?(context)
            context.options[:verbose] || service_registry.get_service(:shell)
          end

          # Extract TypeScript artifacts from context metadata
          #
          # @param context [GenerationContext] Generation context
          # @return [Array<Hash>] Array of file artifacts to write
          def extract_typescript_artifacts(context)
            artifacts = context.metadata[:typescript_artifacts] || {}
            files_to_write = []

            # Add model files
            if artifacts[:models]
              artifacts[:models].each do |model|
                files_to_write << {
                  path: model[:file_path],
                  content: model[:typescript_content],
                  type: :model
                }
              end
            end

            # Add index file
            if artifacts[:index_file]
              files_to_write << {
                path: artifacts[:index_file][:path],
                content: artifacts[:index_file][:content],
                type: :index
              }
            end

            files_to_write
          end

          # Write all artifacts using the file writer
          #
          # @param writer [FileWriter] File writer instance
          # @param artifacts [Array<Hash>] Artifacts to write
          # @return [Array<Hash>] Write results
          def write_all_artifacts(writer, artifacts)
            results = []

            artifacts.each do |artifact|
              result = writer.write(artifact[:path], artifact[:content])
              results << {
                path: artifact[:path],
                type: artifact[:type],
                result: result
              }

              # Report to shell if available
              report_file_operation(result, artifact[:path], artifact[:type])
            end

            results
          end

          # Handle case where no artifacts need writing
          #
          # @param context [GenerationContext] Generation context
          # @return [GenerationContext] Context with no-files metadata
          def handle_no_artifacts_to_write(context)
            no_files_metadata = {
              file_writing_completed: true,
              files_written: 0,
              no_files_reason: "no_typescript_artifacts_found"
            }

            enriched_context = context.with_metadata(no_files_metadata)
            add_stage_metadata(enriched_context, {
              operation: "no_files_to_write",
              files_count: 0
            })
          end

          # Report file operation to shell
          #
          # @param result [Symbol] Operation result
          # @param path [String] File path
          # @param type [Symbol] File type (:model, :index)
          def report_file_operation(result, path, type)
            shell = service_registry.get_service(:shell)
            return unless shell

            case result
            when :created
              shell.say_status(:create, "#{path} (#{type})", :green)
            when :identical
              shell.say_status(:identical, "#{path} (#{type})", :blue)
            when :error
              shell.say_status(:error, "#{path} (#{type})", :red)
            end
          end

          # Validate context has required structure for file writing
          #
          # @param context [GenerationContext] Context to validate
          # @raise [ArgumentError] If context is invalid
          def validate_context!(context)
            super(context, [ :metadata ])

            unless context.metadata.is_a?(Hash)
              raise ArgumentError, "Context metadata must be a Hash"
            end
          end
        end
      end
    end
  end
end
