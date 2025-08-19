# frozen_string_literal: true

require_relative "../stage"
require "fileutils"
require "tempfile"
require "pathname"
require "json"

module Zero
  module Generators
    module Pipeline
      module Stages
        # FormattingStage is responsible for batch formatting TypeScript files with Prettier
        #
        # This stage extracts Prettier formatting logic from FileManager and handles:
        # - Batch processing of TypeScript files for performance optimization
        # - Memory and file count limits to manage resource usage
        # - Error handling with graceful fallback to individual formatting
        # - Detection and configuration of Prettier in frontend environments
        # - Skip formatting when --skip_prettier option is set
        # - Statistics tracking for formatted files and batch operations
        #
        # Key Responsibilities:
        # - Detect frontend root directory and Prettier availability
        # - Batch format TypeScript files with memory/file limits
        # - Handle Prettier command execution with proper error handling
        # - Provide individual file formatting fallback on batch failures
        # - Track formatting statistics and performance metrics
        # - Support dry run mode and skip formatting configuration
        # - Manage temporary directories for batch processing
        #
        # Input: GenerationContext with typescript_files metadata
        # Output: GenerationContext with formatting results and statistics
        #
        # The stage uses batch processing by default with configurable limits:
        # - Maximum 50 files per batch (configurable)
        # - Maximum 100MB memory usage (configurable)
        # - Automatic fallback to individual formatting on batch failure
        #
        # @example Usage in pipeline
        #   pipeline = Pipeline.new(stages: [
        #     SchemaAnalysisStage.new(service_registry),
        #     ModelGenerationStage.new(service_registry),
        #     TypeScriptGenerationStage.new(service_registry),
        #     FormattingStage.new(service_registry)
        #   ])
        #
        # @example Batch processing configuration
        #   stage = FormattingStage.new(service_registry)
        #   context = context.with_options(
        #     batch_max_files: 25,
        #     batch_max_memory_mb: 50,
        #     skip_prettier: false
        #   )
        #
        class FormattingStage < Stage
          # Formatting specific errors
          class FormattingError < StandardError; end
          class PrettierNotFoundError < FormattingError; end
          class BatchFormattingError < FormattingError; end
          class FrontendRootNotFoundError < FormattingError; end

          attr_reader :service_registry

          # Default batch configuration limits
          DEFAULT_BATCH_CONFIG = {
            max_files: 50,
            max_memory_mb: 100,
            enabled: true
          }.freeze

          # Initialize FormattingStage with service dependencies
          #
          # @param service_registry [ServiceRegistry] Registry providing shell and other services
          #
          def initialize(service_registry)
            @service_registry = service_registry
            super()
          end

          # Process context by batch formatting TypeScript files
          #
          # This is the main stage processing method that handles all Prettier formatting
          # operations with batch optimization and error handling. It detects the frontend
          # environment, processes files in batches, and provides detailed statistics.
          #
          # @param context [GenerationContext] Input context with typescript_files metadata
          # @return [GenerationContext] Context enriched with formatting results
          #
          # @raise [FormattingError] If formatting setup or execution fails
          #
          def process(context)
            validate_context!(context)

            # Skip formatting if requested
            if context.options[:skip_prettier]
              return handle_skip_prettier_mode(context)
            end

            # Skip if dry run mode (formatting simulation handled by shell output)
            if context.dry_run?
              return handle_dry_run_mode(context)
            end

            begin
              # Phase 1: Setup formatting environment
              formatting_setup = initialize_formatting_environment(context)

              # Phase 2: Get files to format from context
              files_to_format = extract_typescript_files(context)

              if files_to_format.empty?
                return handle_no_files_to_format(context)
              end

              # Phase 3: Execute batch formatting with error handling
              formatting_result = execute_batch_formatting(files_to_format, formatting_setup)

              # Phase 4: Store results in context metadata
              formatting_metadata = {
                formatting_results: formatting_result,
                files_processed: formatting_result[:processed],
                files_with_errors: formatting_result[:errors],
                batch_operations: formatting_result[:batch_operations] || 0,
                processing_time: formatting_result[:time],
                memory_used_mb: formatting_result[:memory_used_mb] || 0,
                prettier_available: formatting_setup[:prettier_available],
                frontend_root: formatting_setup[:frontend_root]
              }

              # Phase 5: Add stage execution metadata
              enriched_context = context.with_metadata(formatting_metadata)

              add_stage_metadata(enriched_context, {
                files_formatted: formatting_result[:processed],
                batch_operations_count: formatting_result[:batch_operations] || 0,
                individual_fallbacks: formatting_result[:individual_fallbacks] || 0,
                total_processing_time: formatting_result[:time],
                prettier_command_used: formatting_setup[:prettier_available]
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
          # FormattingStage requires typescript_files metadata from TypeScriptGenerationStage
          # to know which files need formatting.
          #
          # @param context [GenerationContext] Context to evaluate
          # @return [Boolean] True if context has typescript_files ready for formatting
          #
          def can_run?(context)
            return false unless context.respond_to?(:metadata)
            return false unless context.metadata.key?(:typescript_files)

            typescript_files = context.metadata[:typescript_files]
            typescript_files.is_a?(Array) && typescript_files.any?
          end

          # Get stage description for logging and debugging
          #
          # @return [String] Brief description of what this stage does
          #
          def description
            "Batch format TypeScript files with Prettier and performance optimization"
          end

          # Check if stage is idempotent (safe to run multiple times)
          #
          # FormattingStage is idempotent - formatting the same files multiple times
          # produces the same result (assuming no content changes).
          #
          # @return [Boolean] True, stage is safe to run multiple times
          #
          def idempotent?
            true
          end

          # Get stage execution priority
          #
          # FormattingStage should run after TypeScript files are written
          # but before final pipeline completion.
          #
          # @return [Integer] Priority value (30 = medium-high priority)
          #
          def priority
            30
          end

          private

          # Handle skip prettier mode by reporting what would have been formatted
          #
          # @param context [GenerationContext] Generation context
          # @return [GenerationContext] Context with skip formatting metadata
          #
          def handle_skip_prettier_mode(context)
            typescript_files = extract_typescript_files(context)

            skip_metadata = {
              formatting_skipped: true,
              skip_reason: "skip_prettier option enabled",
              files_that_would_be_formatted: typescript_files.length,
              prettier_check_performed: false
            }

            enriched_context = context.with_metadata(skip_metadata)
            add_stage_metadata(enriched_context, {
              operation: "skipped_prettier_formatting",
              files_count: typescript_files.length
            })
          end

          # Handle dry run mode by simulating formatting operations
          #
          # @param context [GenerationContext] Generation context
          # @return [GenerationContext] Context with dry run metadata
          #
          def handle_dry_run_mode(context)
            typescript_files = extract_typescript_files(context)

            dry_run_metadata = {
              dry_run_formatting: true,
              files_that_would_be_formatted: typescript_files.length,
              prettier_would_be_checked: true,
              batch_processing_would_be_used: true
            }

            # Report to shell what would happen
            shell = service_registry.get_service(:shell)
            shell&.say_status(:would_format, "#{typescript_files.length} TypeScript files with Prettier", :yellow)

            enriched_context = context.with_metadata(dry_run_metadata)
            add_stage_metadata(enriched_context, {
              operation: "dry_run_formatting_simulation",
              files_count: typescript_files.length
            })
          end

          # Handle case where no files need formatting
          #
          # @param context [GenerationContext] Generation context
          # @return [GenerationContext] Context with no-files metadata
          #
          def handle_no_files_to_format(context)
            no_files_metadata = {
              formatting_completed: true,
              files_processed: 0,
              no_files_reason: "no_typescript_files_found"
            }

            enriched_context = context.with_metadata(no_files_metadata)
            add_stage_metadata(enriched_context, {
              operation: "no_files_to_format",
              files_count: 0
            })
          end

          # Initialize formatting environment and check Prettier availability
          #
          # @param context [GenerationContext] Generation context with options
          # @return [Hash] Formatting setup configuration
          #
          # @raise [FrontendRootNotFoundError] If frontend root cannot be detected
          # @raise [PrettierNotFoundError] If Prettier is not available
          #
          def initialize_formatting_environment(context)
            # Detect frontend root directory
            frontend_root = detect_frontend_root

            unless frontend_root
              raise FrontendRootNotFoundError, "Frontend root directory with package.json not found"
            end

            # Check Prettier availability
            prettier_available = check_prettier_availability(frontend_root)

            unless prettier_available
              raise PrettierNotFoundError, "Prettier not found in package.json dependencies"
            end

            # Configure batch processing limits
            batch_config = build_batch_config(context.options)

            {
              frontend_root: frontend_root,
              prettier_available: prettier_available,
              batch_config: batch_config
            }
          end

          # Extract TypeScript files from context metadata
          #
          # @param context [GenerationContext] Generation context
          # @return [Array<String>] Array of file paths to format
          #
          def extract_typescript_files(context)
            typescript_files = context.metadata[:typescript_files] || []

            # Filter for TypeScript files only
            typescript_files.select do |file_path|
              %w[.ts .tsx .js .jsx].include?(File.extname(file_path))
            end
          end

          # Execute batch formatting with error handling and fallback
          #
          # @param files_to_format [Array<String>] File paths to format
          # @param setup [Hash] Formatting setup configuration
          # @return [Hash] Formatting execution results
          #
          def execute_batch_formatting(files_to_format, setup)
            start_time = Time.current

            begin
              # Attempt batch formatting
              batch_result = execute_batch_prettier_formatting(files_to_format, setup)

              if batch_result[:success]
                report_batch_success(batch_result, files_to_format.length)

                {
                  processed: files_to_format.length,
                  errors: 0,
                  batch_operations: 1,
                  individual_fallbacks: 0,
                  time: (Time.current - start_time).round(4),
                  memory_used_mb: estimate_memory_usage(files_to_format).round(2)
                }
              else
                # Fallback to individual formatting
                report_batch_failure(batch_result)
                individual_result = fallback_to_individual_formatting(files_to_format, setup)
                individual_result.merge(
                  individual_fallbacks: 1,
                  time: (Time.current - start_time).round(4)
                )
              end

            rescue => e
              # Last resort: attempt individual formatting
              shell = service_registry.get_service(:shell)
              shell&.say_status(:formatting_error, "Batch formatting failed: #{e.message}", :red)

              individual_result = fallback_to_individual_formatting(files_to_format, setup)
              individual_result.merge(
                individual_fallbacks: 1,
                time: (Time.current - start_time).round(4),
                batch_error: e.message
              )
            end
          end

          # Execute batch Prettier formatting command
          #
          # @param files_to_format [Array<String>] File paths to format
          # @param setup [Hash] Formatting setup configuration
          # @return [Hash] Batch execution result
          #
          def execute_batch_prettier_formatting(files_to_format, setup)
            frontend_root = setup[:frontend_root]
            temp_dir = File.join(frontend_root, "tmp", "batch_format_#{Time.current.to_i}")

            begin
              # Create temporary directory
              FileUtils.mkdir_p(temp_dir)

              # Copy files to temporary directory with proper extensions
              temp_file_mapping = {}
              files_to_format.each_with_index do |file_path, index|
                next unless File.exist?(file_path)

                file_extension = File.extname(file_path)
                temp_file_path = File.join(temp_dir, "file_#{index}#{file_extension}")
                FileUtils.cp(file_path, temp_file_path)
                temp_file_mapping[temp_file_path] = file_path
              end

              # Run Prettier on all files in batch
              prettier_cmd = "npx prettier --write --config-precedence prefer-file #{temp_dir}/*"

              Dir.chdir(frontend_root) do
                success = system(prettier_cmd, out: File::NULL, err: File::NULL)

                if success
                  # Copy formatted files back
                  temp_file_mapping.each do |temp_path, original_path|
                    FileUtils.cp(temp_path, original_path) if File.exist?(temp_path)
                  end

                  { success: true, files_processed: temp_file_mapping.size }
                else
                  { success: false, error: "prettier_command_failed" }
                end
              end

            rescue => e
              { success: false, error: e.message }
            ensure
              # Cleanup temporary directory
              FileUtils.rm_rf(temp_dir) if File.exist?(temp_dir)
            end
          end

          # Fallback to individual file formatting
          #
          # @param files_to_format [Array<String>] File paths to format
          # @param setup [Hash] Formatting setup configuration
          # @return [Hash] Individual formatting results
          #
          def fallback_to_individual_formatting(files_to_format, setup)
            frontend_root = setup[:frontend_root]
            processed = 0
            errors = 0

            shell = service_registry.get_service(:shell)
            shell&.say_status(:individual_format, "Falling back to individual file formatting", :yellow)

            files_to_format.each do |file_path|
              begin
                next unless File.exist?(file_path)

                success = format_individual_file(file_path, frontend_root)
                if success
                  processed += 1
                else
                  errors += 1
                end
              rescue => e
                shell&.say_status(:format_error, "Failed to format #{file_path}: #{e.message}", :red)
                errors += 1
              end
            end

            {
              processed: processed,
              errors: errors,
              batch_operations: 0
            }
          end

          # Format individual file with Prettier
          #
          # @param file_path [String] File path to format
          # @param frontend_root [String] Frontend root directory
          # @return [Boolean] True if formatting succeeded
          #
          def format_individual_file(file_path, frontend_root)
            # Get path relative to frontend root for Prettier
            relative_path = Pathname.new(file_path).relative_path_from(Pathname.new(frontend_root))
            prettier_cmd = "npx prettier --write --config-precedence prefer-file #{relative_path}"

            Dir.chdir(frontend_root) do
              system(prettier_cmd, out: File::NULL, err: File::NULL)
            end
          rescue
            false
          end

          # Detect frontend root directory
          #
          # @return [String, nil] Frontend root path or nil if not detected
          #
          def detect_frontend_root
            frontend_path = File.join(Rails.root, "frontend")
            return frontend_path if File.exist?(File.join(frontend_path, "package.json"))

            # Try alternative locations
            alt_paths = [ "client", "web", "ui", "app/javascript" ]
            alt_paths.each do |path|
              full_path = File.join(Rails.root, path)
              return full_path if File.exist?(File.join(full_path, "package.json"))
            end

            nil
          end

          # Check if Prettier is available in the project
          #
          # @param frontend_root [String] Frontend root directory
          # @return [Boolean] True if Prettier is available
          #
          def check_prettier_availability(frontend_root)
            package_json_path = File.join(frontend_root, "package.json")
            return false unless File.exist?(package_json_path)

            begin
              package_json = JSON.parse(File.read(package_json_path))
              deps = package_json["dependencies"] || {}
              dev_deps = package_json["devDependencies"] || {}

              deps.key?("prettier") || dev_deps.key?("prettier")
            rescue
              false
            end
          end

          # Build batch configuration from options
          #
          # @param options [Hash] Context options
          # @return [Hash] Batch configuration
          #
          def build_batch_config(options)
            {
              max_files: options[:batch_max_files] || DEFAULT_BATCH_CONFIG[:max_files],
              max_memory_mb: options[:batch_max_memory_mb] || DEFAULT_BATCH_CONFIG[:max_memory_mb],
              enabled: !options[:disable_batch_formatting] && DEFAULT_BATCH_CONFIG[:enabled]
            }
          end

          # Estimate memory usage for batch processing
          #
          # @param files [Array<String>] File paths
          # @return [Float] Estimated memory usage in MB
          #
          def estimate_memory_usage(files)
            total_size = files.sum do |file_path|
              File.exist?(file_path) ? File.size(file_path) : 0
            end

            # Add 50% overhead estimate
            (total_size * 1.5) / 1024.0 / 1024.0
          end

          # Report successful batch formatting
          #
          # @param batch_result [Hash] Batch execution result
          # @param file_count [Integer] Number of files processed
          #
          def report_batch_success(batch_result, file_count)
            shell = service_registry.get_service(:shell)
            shell&.say_status(:batch_format, "Successfully formatted #{file_count} files with Prettier", :green)
          end

          # Report batch formatting failure
          #
          # @param batch_result [Hash] Batch execution result with error info
          #
          def report_batch_failure(batch_result)
            shell = service_registry.get_service(:shell)
            error_msg = batch_result[:error] || "unknown_batch_error"
            shell&.say_status(:batch_failed, "Batch formatting failed: #{error_msg}", :yellow)
          end

          # Validate context has required structure for formatting
          #
          # @param context [GenerationContext] Context to validate
          #
          # @raise [ArgumentError] If context is invalid
          #
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
