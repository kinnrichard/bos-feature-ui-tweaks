# frozen_string_literal: true

require_relative "../../../zero_schema_generator/rails_schema_introspector"

module Zero
  module Generators
    # SchemaService provides a focused, clean interface for schema operations
    #
    # This service wraps the comprehensive RailsSchemaIntrospector and provides
    # a simplified, business-focused API for schema extraction, filtering, and
    # validation. It separates schema concerns from Rails introspection implementation
    # details and provides consistent error handling and reporting.
    #
    # Key Responsibilities:
    # - Schema data extraction and caching
    # - Table filtering and exclusion logic
    # - Schema validation and integrity checking
    # - Pattern detection aggregation
    # - Performance optimization for repeated operations
    # - Standardized error handling and reporting
    #
    # @example Basic usage
    #   schema_service = SchemaService.new
    #   filtered_schema = schema_service.extract_filtered_schema(exclude_tables: ['logs'])
    #
    # @example Advanced pattern detection
    #   schema_service = SchemaService.new(enable_pattern_detection: true)
    #   patterns = schema_service.detect_patterns_for_table('users')
    #
    class SchemaService
      # Custom error types for better error handling
      class SchemaExtractionError < StandardError; end
      class SchemaValidationError < StandardError; end
      class TableNotFoundError < StandardError; end

      attr_reader :introspector, :cache_enabled, :statistics

      # Initialize SchemaService with configuration options
      #
      # @param introspector [RailsSchemaIntrospector] Optional custom introspector
      # @param cache_enabled [Boolean] Enable schema data caching (default: true)
      # @param enable_pattern_detection [Boolean] Enable pattern detection (default: true)
      def initialize(introspector: nil, cache_enabled: true, enable_pattern_detection: true)
        @introspector = introspector || ZeroSchemaGenerator::RailsSchemaIntrospector.new
        @cache_enabled = cache_enabled
        @enable_pattern_detection = enable_pattern_detection
        @schema_cache = {}
        @statistics = {
          schema_extractions: 0,
          cache_hits: 0,
          cache_misses: 0,
          tables_processed: 0,
          patterns_detected: 0,
          validation_errors: 0
        }
      end

      # Extract complete schema data with optional filtering
      #
      # @param exclude_tables [Array<String>] Additional tables to exclude
      # @param include_only [Array<String>] Only include these tables (overrides exclude)
      # @param skip_validation [Boolean] Skip schema validation (default: false)
      # @return [Hash] Complete filtered schema data
      # @raise [SchemaExtractionError] If schema extraction fails
      #
      def extract_filtered_schema(exclude_tables: [], include_only: nil, skip_validation: false)
        cache_key = build_cache_key(exclude_tables, include_only)

        # Return cached data if available
        if @cache_enabled && @schema_cache[cache_key]
          @statistics[:cache_hits] += 1
          return @schema_cache[cache_key]
        end

        @statistics[:cache_misses] += 1
        @statistics[:schema_extractions] += 1

        begin
          # Extract raw schema data
          raw_schema = @introspector.extract_schema

          # Validate raw schema integrity unless skipped (before filtering)
          validate_schema_integrity(raw_schema) unless skip_validation

          # Apply filtering logic
          filtered_schema = apply_filtering(raw_schema, exclude_tables, include_only)

          # Cache the results
          @schema_cache[cache_key] = filtered_schema if @cache_enabled

          # Update statistics
          @statistics[:tables_processed] = filtered_schema[:tables].length
          @statistics[:patterns_detected] = count_patterns(filtered_schema[:patterns])

          filtered_schema

        rescue => e
          @statistics[:validation_errors] += 1
          raise SchemaExtractionError, "Failed to extract schema: #{e.message}"
        end
      end

      # Get schema data for a specific table
      #
      # @param table_name [String] Name of the table
      # @return [Hash] Table schema data including columns, relationships, and patterns
      # @raise [TableNotFoundError] If table is not found
      #
      def schema_for_table(table_name)
        schema_data = extract_filtered_schema(include_only: [ table_name ])

        table_data = schema_data[:tables].first
        raise TableNotFoundError, "Table '#{table_name}' not found" unless table_data

        {
          table: table_data,
          relationships: find_relationships_for_table(table_name, schema_data[:relationships]),
          patterns: schema_data[:patterns][table_name] || {},
          indexes: schema_data[:indexes][table_name] || [],
          constraints: schema_data[:constraints][table_name] || []
        }
      end

      # Extract schema for a specific table (alias for compatibility with tests)
      #
      # @param table_name [String] Name of the table
      # @return [Hash] Table schema data including columns, relationships, and patterns
      # @raise [TableNotFoundError] If table is not found
      #
      def extract_table_schema(table_name)
        schema_for_table(table_name)
      end

      # Detect patterns for a specific table
      #
      # @param table_name [String] Name of the table
      # @return [Hash] Detected patterns for the table
      #
      def detect_patterns_for_table(table_name)
        return {} unless @enable_pattern_detection

        table_schema = schema_for_table(table_name)
        table_schema[:patterns]
      end

      # Get available table names after filtering
      #
      # @param exclude_tables [Array<String>] Additional tables to exclude
      # @param include_only [Array<String>] Only include these tables
      # @return [Array<String>] List of available table names
      #
      def available_tables(exclude_tables: [], include_only: nil)
        schema_data = extract_filtered_schema(exclude_tables: exclude_tables, include_only: include_only)
        schema_data[:tables].map { |table| table[:name] }
      end

      # Validate that specified tables exist
      #
      # @param table_names [Array<String>] Table names to validate
      # @return [Hash] Validation results with exists/missing arrays
      #
      def validate_tables_exist(table_names)
        available = available_tables
        existing_tables = table_names & available
        missing_tables = table_names - available

        {
          existing: existing_tables,
          missing: missing_tables,
          all_exist: missing_tables.empty?
        }
      end

      # Generate comprehensive pattern report across all tables
      #
      # @return [Hash] Pattern detection report with statistics
      #
      def generate_pattern_report
        return { enabled: false } unless @enable_pattern_detection

        schema_data = extract_filtered_schema
        @introspector.generate_pattern_report(schema_data[:patterns])
      end

      # Clear schema cache to force fresh extraction
      #
      # @return [Integer] Number of cached entries cleared
      #
      def clear_cache!
        cleared_count = @schema_cache.size
        @schema_cache.clear
        @statistics[:cache_hits] = 0
        @statistics[:cache_misses] = 0
        cleared_count
      end

      # Get service performance statistics
      #
      # @return [Hash] Performance and usage statistics
      #
      def performance_stats
        cache_total = @statistics[:cache_hits] + @statistics[:cache_misses]
        cache_hit_ratio = cache_total > 0 ? (@statistics[:cache_hits].to_f / cache_total * 100).round(2) : 0.0

        {
          schema_extractions: @statistics[:schema_extractions],
          tables_processed: @statistics[:tables_processed],
          patterns_detected: @statistics[:patterns_detected],
          validation_errors: @statistics[:validation_errors],
          cache_enabled: @cache_enabled,
          cache_entries: @schema_cache.size,
          cache_hit_ratio: cache_hit_ratio,
          cache_hits: @statistics[:cache_hits],
          cache_misses: @statistics[:cache_misses]
        }
      end

      # Check service health and configuration
      #
      # @return [Hash] Health status and configuration details
      #
      def health_check
        begin
          # Test basic schema extraction
          test_schema = @introspector.extract_schema
          tables_count = test_schema[:tables].length

          {
            status: :healthy,
            introspector: @introspector.class.name,
            cache_enabled: @cache_enabled,
            pattern_detection: @enable_pattern_detection,
            tables_available: tables_count,
            statistics: performance_stats
          }
        rescue => e
          {
            status: :unhealthy,
            error: e.message,
            introspector: @introspector.class.name,
            cache_enabled: @cache_enabled,
            pattern_detection: @enable_pattern_detection
          }
        end
      end

      private

      # Apply filtering logic to raw schema data
      #
      # @param raw_schema [Hash] Raw schema data from introspector
      # @param exclude_tables [Array<String>] Tables to exclude
      # @param include_only [Array<String>] Tables to include exclusively
      # @return [Hash] Filtered schema data
      #
      def apply_filtering(raw_schema, exclude_tables, include_only)
        filtered_tables = raw_schema[:tables].dup

        # Apply include_only filter if specified (overrides exclude)
        if include_only&.any?
          filtered_tables = filtered_tables.select { |table| include_only.include?(table[:name]) }
        else
          # Apply exclude filter
          all_exclusions = default_excluded_tables + exclude_tables
          filtered_tables = filtered_tables.reject { |table| all_exclusions.include?(table[:name]) }
        end

        # Filter relationships and patterns to match remaining tables
        table_names = filtered_tables.map { |table| table[:name] }
        filtered_relationships = filter_relationships(raw_schema[:relationships], table_names)
        filtered_patterns = filter_patterns(raw_schema[:patterns], table_names)
        filtered_indexes = filter_indexes(raw_schema[:indexes], table_names)
        filtered_constraints = filter_constraints(raw_schema[:constraints], table_names)

        {
          tables: filtered_tables,
          relationships: filtered_relationships,
          patterns: filtered_patterns,
          indexes: filtered_indexes,
          constraints: filtered_constraints
        }
      end

      # Get default excluded tables from introspector
      #
      # @return [Array<String>] Default excluded table names
      #
      def default_excluded_tables
        ZeroSchemaGenerator::RailsSchemaIntrospector::EXCLUDED_TABLES
      end

      # Filter relationships to only include tables that exist
      #
      # @param relationships [Array] Raw relationships data
      # @param table_names [Array<String>] Available table names
      # @return [Array] Filtered relationships
      #
      def filter_relationships(relationships, table_names)
        relationships.select { |rel| table_names.include?(rel[:table]) }
      end

      # Filter patterns to only include tables that exist
      #
      # @param patterns [Hash] Raw patterns data
      # @param table_names [Array<String>] Available table names
      # @return [Hash] Filtered patterns
      #
      def filter_patterns(patterns, table_names)
        patterns.select { |table_name, _| table_names.include?(table_name) }
      end

      # Filter indexes to only include tables that exist
      #
      # @param indexes [Hash] Raw indexes data
      # @param table_names [Array<String>] Available table names
      # @return [Hash] Filtered indexes
      #
      def filter_indexes(indexes, table_names)
        indexes.select { |table_name, _| table_names.include?(table_name) }
      end

      # Filter constraints to only include tables that exist
      #
      # @param constraints [Hash] Raw constraints data
      # @param table_names [Array<String>] Available table names
      # @return [Hash] Filtered constraints
      #
      def filter_constraints(constraints, table_names)
        constraints.select { |table_name, _| table_names.include?(table_name) }
      end

      # Find relationships for a specific table
      #
      # @param table_name [String] Table name to find relationships for
      # @param relationships [Array] All relationships data
      # @return [Hash] Relationships for the specified table
      #
      def find_relationships_for_table(table_name, relationships)
        relationship_data = relationships.find { |rel| rel[:table] == table_name }
        return default_relationship_structure unless relationship_data

        {
          belongs_to: relationship_data[:belongs_to] || [],
          has_many: relationship_data[:has_many] || [],
          has_one: relationship_data[:has_one] || [],
          polymorphic: relationship_data[:polymorphic] || []
        }
      end

      # Default empty relationship structure
      #
      # @return [Hash] Empty relationship structure
      #
      def default_relationship_structure
        {
          belongs_to: [],
          has_many: [],
          has_one: [],
          polymorphic: []
        }
      end

      # Build cache key for schema data
      #
      # @param exclude_tables [Array<String>] Excluded tables
      # @param include_only [Array<String>] Included tables
      # @return [String] Cache key
      #
      def build_cache_key(exclude_tables, include_only)
        key_parts = []
        key_parts << "exclude:#{exclude_tables.sort.join(',')}" if exclude_tables.any?
        key_parts << "include:#{include_only.sort.join(',')}" if include_only&.any?
        key_parts << "full_schema" if key_parts.empty?
        key_parts.join("|")
      end

      # Count total patterns across all tables
      #
      # @param patterns [Hash] Patterns data
      # @return [Integer] Total number of patterns
      #
      def count_patterns(patterns)
        patterns.values.sum { |table_patterns| table_patterns.keys.size }
      end

      # Validate schema integrity and consistency
      #
      # @param schema_data [Hash] Schema data to validate
      # @raise [SchemaValidationError] If validation fails
      #
      def validate_schema_integrity(schema_data)
        # Validate required structure
        required_keys = [ :tables, :relationships, :patterns, :indexes, :constraints ]
        missing_keys = required_keys - schema_data.keys

        if missing_keys.any?
          raise SchemaValidationError, "Missing required schema keys: #{missing_keys.join(', ')}"
        end

        # Validate tables structure
        unless schema_data[:tables].is_a?(Array)
          raise SchemaValidationError, "Schema tables must be an array"
        end

        # Validate each table has required fields
        schema_data[:tables].each do |table|
          validate_table_structure(table)
        end

        # Validate relationships reference existing tables
        validate_relationship_references(schema_data)
      end

      # Validate individual table structure
      #
      # @param table [Hash] Table data to validate
      # @raise [SchemaValidationError] If table structure is invalid
      #
      def validate_table_structure(table)
        required_table_keys = [ :name, :columns ]
        missing_keys = required_table_keys - table.keys

        if missing_keys.any?
          raise SchemaValidationError, "Table missing required keys: #{missing_keys.join(', ')}"
        end

        unless table[:columns].is_a?(Array)
          raise SchemaValidationError, "Table columns must be an array for table: #{table[:name]}"
        end
      end

      # Validate that relationships reference existing tables
      #
      # @param schema_data [Hash] Complete schema data
      # @raise [SchemaValidationError] If relationship references are invalid
      #
      def validate_relationship_references(schema_data)
        table_names = schema_data[:tables].map { |table| table[:name] }

        schema_data[:relationships].each do |rel|
          unless table_names.include?(rel[:table])
            raise SchemaValidationError, "Relationship references non-existent table: #{rel[:table]}"
          end
        end
      end
    end
  end
end
