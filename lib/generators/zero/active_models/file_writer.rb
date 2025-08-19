# frozen_string_literal: true

require_relative "semantic_comparator"
require "fileutils"
require "pathname"

module Zero
  module Generators
    # FileWriter handles pure file I/O operations for generated content
    #
    # This class is focused solely on writing files to disk with intelligent
    # comparison to avoid unnecessary writes. It delegates content comparison
    # to SemanticComparator and provides a clean interface for file operations.
    #
    # Key Responsibilities:
    # - Write files to disk with directory creation
    # - Skip identical files using semantic comparison
    # - Support dry-run mode for testing
    # - Track basic file operation statistics
    # - Handle file I/O errors gracefully
    #
    # Excluded Responsibilities (handled elsewhere):
    # - Content formatting (FormattingStage)
    # - Batch processing (FormattingStage)
    # - Complex content transformation
    #
    # @example Basic usage
    #   writer = FileWriter.new("/path/to/output")
    #   result = writer.write("models/user.ts", typescript_content)
    #   puts writer.statistics
    #
    # @example Batch writing
    #   files = [
    #     { path: "models/user.ts", content: user_content },
    #     { path: "models/post.ts", content: post_content }
    #   ]
    #   results = writer.write_batch(files)
    #
    class FileWriter
      # File operation result codes
      OPERATION_RESULTS = {
        created: :created,
        identical: :identical,
        error: :error
      }.freeze

      attr_reader :output_dir, :options, :statistics, :comparator

      # Initialize FileWriter with output directory and options
      #
      # @param output_dir [String] Base output directory path
      # @param options [Hash] Writer options (dry_run, force, verbose, etc.)
      # @param comparator [SemanticComparator] Content comparator (optional)
      def initialize(output_dir, options = {}, comparator = nil)
        @output_dir = normalize_path(output_dir)
        @options = options || {}
        @statistics = { written: 0, skipped: 0, errors: 0, directories_created: 0 }
        @comparator = comparator || SemanticComparator.new
      end

      # Write single file with semantic comparison
      #
      # @param relative_path [String] File path relative to output directory
      # @param content [String] File content to write
      # @return [Symbol] Operation result (:created, :identical, :error)
      def write(relative_path, content)
        full_path = build_full_path(relative_path)

        ensure_directory_exists(File.dirname(full_path))

        if should_write?(full_path, content)
          write_file(full_path, content)
          OPERATION_RESULTS[:created]
        else
          @statistics[:skipped] += 1
          log_operation(:identical, relative_path)
          OPERATION_RESULTS[:identical]
        end
      rescue => e
        @statistics[:errors] += 1
        handle_error(e, relative_path)
        OPERATION_RESULTS[:error]
      end

      # Write multiple files in batch
      #
      # @param files [Array<Hash>] Array of {path:, content:} hashes
      # @return [Array<Hash>] Array of {path:, result:} hashes
      def write_batch(files)
        files.map do |file_spec|
          result = write(file_spec[:path], file_spec[:content])
          { path: file_spec[:path], result: result }
        end
      end

      # Reset statistics counters
      #
      # @return [Hash] Reset statistics hash
      def reset_statistics
        @statistics = { written: 0, skipped: 0, errors: 0, directories_created: 0 }
      end

      private

      # Normalize output directory path to absolute path
      #
      # @param path [String] Directory path to normalize
      # @return [String] Normalized absolute path
      def normalize_path(path)
        if Pathname.new(path).absolute?
          path
        else
          Rails.root.join(path).to_s
        end
      end

      # Build full file path from relative path
      #
      # @param relative_path [String] Relative file path
      # @return [String] Full absolute file path
      def build_full_path(relative_path)
        File.join(@output_dir, relative_path)
      end

      # Ensure directory exists, creating it if necessary
      #
      # @param dir_path [String] Directory path to ensure
      # @return [Boolean] True if directory exists or was created
      def ensure_directory_exists(dir_path)
        return true if File.directory?(dir_path)
        return true if @options[:dry_run]

        FileUtils.mkdir_p(dir_path)
        @statistics[:directories_created] += 1
        true
      rescue => e
        handle_error(e, "directory creation: #{dir_path}")
        false
      end

      # Determine if file should be written based on options and content comparison
      #
      # @param path [String] Full file path
      # @param content [String] New content to write
      # @return [Boolean] True if file should be written
      def should_write?(path, content)
        return false if @options[:dry_run]
        return true if @options[:force]
        return true unless File.exist?(path)

        !@comparator.file_identical?(path, content)
      end

      # Write file to disk and update statistics
      #
      # @param path [String] Full file path
      # @param content [String] Content to write
      def write_file(path, content)
        File.write(path, content)
        @statistics[:written] += 1
        log_operation(:create, path)
      end

      # Log file operation for user feedback
      #
      # @param operation [Symbol] Operation type (:create, :identical, :error)
      # @param path [String] File path for logging
      def log_operation(operation, path)
        # Skip logging if quiet mode is enabled
        return if @options[:quiet]

        return unless @options[:verbose] || @options[:dry_run]

        relative_path = path.is_a?(String) && path.start_with?(@output_dir) ?
                       path.sub(@output_dir + "/", "") : path

        case operation
        when :create
          puts "      create  #{relative_path}"
        when :identical
          puts "   identical  #{relative_path}"
        end
      end

      # Handle file operation errors
      #
      # @param error [StandardError] The error that occurred
      # @param context [String] Context information for the error
      def handle_error(error, context)
        return unless @options[:verbose]

        puts "       error  #{context}: #{error.message}"
      end
    end
  end
end
