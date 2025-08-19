# frozen_string_literal: true

module Zero
  module Generators
    # SemanticComparator handles intelligent content comparison for generated files
    #
    # This class provides semantic comparison capabilities that ignore timestamp
    # differences and other non-meaningful changes when determining if a file
    # needs to be rewritten. This prevents unnecessary file updates that would
    # trigger file watchers and rebuild processes when only timestamps change.
    #
    # Key Features:
    # - Timestamp pattern detection and normalization
    # - Whitespace normalization for consistent comparison
    # - Configurable ignore patterns for custom timestamp formats
    # - Optimized for TypeScript and JavaScript generated files
    #
    # @example Basic usage
    #   comparator = SemanticComparator.new
    #   if comparator.identical?(existing_content, new_content)
    #     puts "Files are semantically identical"
    #   end
    #
    # @example Custom patterns
    #   custom_patterns = [/Custom timestamp: \d{4}-\d{2}-\d{2}/]
    #   comparator = SemanticComparator.new(custom_patterns)
    #
    class SemanticComparator
      # Default timestamp patterns to ignore during comparison
      DEFAULT_TIMESTAMP_PATTERNS = [
        /^.*Generated from Rails schema: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC.*$/i,
        /^.*Generated: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC.*$/i,
        /^.*Auto-generated: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC.*$/i,
        /^\s*\*\s*Generated.*\d{4}-\d{2}-\d{2}.*$/i,
        /^\s*\/\/.*generated.*\d{4}-\d{2}-\d{2}.*$/i,
        /^\s*\/\/.*Auto-generated.*\d{4}-\d{2}-\d{2}.*$/i
      ].freeze

      attr_reader :timestamp_patterns, :normalizer

      # Initialize SemanticComparator with optional custom patterns
      #
      # @param timestamp_patterns [Array<Regexp>] Custom timestamp patterns to ignore
      def initialize(timestamp_patterns = DEFAULT_TIMESTAMP_PATTERNS)
        @timestamp_patterns = timestamp_patterns
        @normalizer = ContentNormalizer.new(@timestamp_patterns)
      end

      # Check if two content strings are semantically identical
      #
      # Performs normalized comparison that ignores timestamp differences
      # and standardizes whitespace to determine if files contain the
      # same meaningful content.
      #
      # @param content1 [String] First content to compare
      # @param content2 [String] Second content to compare
      # @return [Boolean] True if contents are semantically identical
      def identical?(content1, content2)
        normalized_content1 = normalizer.normalize(content1)
        normalized_content2 = normalizer.normalize(content2)

        normalized_content1 == normalized_content2
      end

      # Check if existing file is semantically identical to new content
      #
      # Convenience method that reads an existing file and compares it
      # to new content using semantic comparison.
      #
      # @param file_path [String] Path to existing file
      # @param new_content [String] New content to compare
      # @return [Boolean] True if file content is semantically identical
      def file_identical?(file_path, new_content)
        return false unless File.exist?(file_path)

        begin
          existing_content = File.read(file_path)
          identical?(existing_content, new_content)
        rescue => e
          # If we can't read the file, assume it's different
          false
        end
      end

      # Content normalizer for semantic file comparison
      #
      # Handles the actual normalization logic by removing timestamps
      # and standardizing formatting to enable meaningful comparison.
      class ContentNormalizer
        attr_reader :timestamp_patterns

        # Initialize normalizer with timestamp patterns to ignore
        #
        # @param timestamp_patterns [Array<Regexp>] Patterns to remove during normalization
        def initialize(timestamp_patterns)
          @timestamp_patterns = timestamp_patterns
        end

        # Normalize content by removing timestamps and standardizing formatting
        #
        # This method performs several normalization steps:
        # 1. Remove lines matching timestamp patterns
        # 2. Standardize whitespace within lines
        # 3. Remove empty lines created by timestamp removal
        # 4. Trim overall content
        #
        # @param content [String] Content to normalize
        # @return [String] Normalized content ready for comparison
        def normalize(content)
          return "" if content.nil? || content.empty?

          # Split into lines and process each line
          lines = content.lines
          normalized_lines = lines.map { |line| normalize_line(line) }

          # Remove empty lines and lines that became empty after normalization
          filtered_lines = normalized_lines.reject(&:empty?)

          # Join back together and trim
          filtered_lines.join("\n").strip
        end

        private

        # Normalize a single line by removing timestamps and standardizing whitespace
        #
        # @param line [String] Line to normalize
        # @return [String] Normalized line (may be empty if line matched timestamp pattern)
        def normalize_line(line)
          # Check if line matches any timestamp pattern
          timestamp_patterns.each do |pattern|
            return "" if line.match?(pattern)
          end

          # Standardize whitespace: convert all whitespace sequences to single spaces
          # and trim leading/trailing whitespace
          line.strip.gsub(/\s+/, " ")
        end
      end
    end
  end
end
