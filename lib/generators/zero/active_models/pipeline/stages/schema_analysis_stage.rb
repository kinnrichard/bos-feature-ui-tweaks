# frozen_string_literal: true

require_relative "../stage"

module Zero
  module Generators
    module Pipeline
      module Stages
        # SchemaAnalysisStage is responsible for extracting and analyzing Rails schema data
        #
        # This stage performs comprehensive schema introspection and analysis, providing
        # the foundation data needed for TypeScript model generation. It handles table
        # filtering, relationship discovery, pattern detection, and schema validation.
        #
        # Key Responsibilities:
        # - Rails schema introspection via SchemaService
        # - Table filtering based on configuration (exclude/include lists)
        # - Relationship discovery (belongs_to, has_many, has_one, polymorphic)
        # - Column and type extraction with metadata
        # - Pattern detection (soft deletion, enums, defaults)
        # - Schema validation and integrity checking
        # - Context enrichment with structured schema data
        #
        # Input: GenerationContext with initial configuration
        # Output: GenerationContext enriched with complete schema data
        #
        # The stage uses immutable context updates to ensure clean data flow
        # through the pipeline and provides comprehensive error handling for
        # schema-related failures.
        #
        # @example Usage in pipeline
        #   pipeline = Pipeline.new(stages: [
        #     SchemaAnalysisStage.new(service_registry),
        #     ModelGenerationStage.new,
        #     FormattingStage.new
        #   ])
        #
        # @example Context enrichment
        #   Input:  GenerationContext(table: basic_config, options: {...})
        #   Output: GenerationContext(table: enriched_data, schema: full_schema, relationships: {...})
        #
        class SchemaAnalysisStage < Stage
          # Schema analysis specific errors
          class SchemaAnalysisError < StandardError; end
          class SchemaExtractionError < SchemaAnalysisError; end
          class TableFilteringError < SchemaAnalysisError; end
          class RelationshipDiscoveryError < SchemaAnalysisError; end

          attr_reader :service_registry

          # Initialize SchemaAnalysisStage with service dependencies
          #
          # @param service_registry [ServiceRegistry] Registry providing schema and related services
          #
          def initialize(service_registry)
            @service_registry = service_registry
            super()
          end

          # Process context by performing comprehensive schema analysis
          #
          # This is the main stage processing method that orchestrates all schema
          # analysis operations and enriches the GenerationContext with complete
          # schema data needed for subsequent pipeline stages.
          #
          # @param context [GenerationContext] Input context with basic configuration
          # @return [GenerationContext] Enriched context with complete schema analysis
          #
          # @raise [SchemaAnalysisError] If schema analysis fails at any stage
          #
          def process(context)
            validate_context!(context)

            begin
              # Phase 1: Extract raw schema data with filtering
              schema_data = extract_and_filter_schema(context)

              # Phase 2: Validate schema integrity
              validate_schema_integrity(schema_data)

              # Phase 3: Enrich context with schema data and metadata
              enriched_context = enrich_context_with_schema(context, schema_data)

              # Phase 4: Add stage execution metadata and return final context
              final_context = add_stage_metadata(enriched_context, {
                tables_analyzed: schema_data[:tables].length,
                relationships_discovered: schema_data[:relationships].length,
                patterns_detected: count_patterns(schema_data[:patterns]),
                schema_extraction_source: schema_service.class.name
              })

              final_context

            rescue StandardError => e
              Rails.logger.error "[SchemaAnalysisStage] Error: #{e.class} - #{e.message}" if defined?(Rails)
              Rails.logger.error "[SchemaAnalysisStage] Backtrace: #{e.backtrace.first(5).join("\n")}" if defined?(Rails)
              raise Stage::StageError.new(
                stage: self,
                context: context,
                error: e
              )
            end
          end

          # Check if stage can run with given context
          #
          # SchemaAnalysisStage can run with any context that has options,
          # as it provides the foundational schema data for the pipeline.
          #
          # @param context [GenerationContext] Context to evaluate
          # @return [Boolean] True if context has required structure
          #
          def can_run?(context)
            context.respond_to?(:options) && context.respond_to?(:metadata)
          end

          # Get stage description for logging and debugging
          #
          # @return [String] Human-readable description of stage purpose
          #
          def description
            "Rails schema analysis and context enrichment"
          end

          # Check if stage is idempotent
          #
          # SchemaAnalysisStage is idempotent - given the same input context
          # and database state, it will produce the same enriched context.
          #
          # @return [Boolean] True, stage is safe to run multiple times
          #
          def idempotent?
            true
          end

          # Get stage execution priority
          #
          # SchemaAnalysisStage should run early in the pipeline as it provides
          # foundational data for subsequent stages.
          #
          # @return [Integer] High priority (low number) for early execution
          #
          def priority
            10 # High priority - run early in pipeline
          end

          private

          # Extract schema data with filtering based on context options
          #
          # @param context [GenerationContext] Context with filtering options
          # @return [Hash] Complete filtered schema data
          #
          # @raise [SchemaExtractionError] If schema extraction fails
          #
          def extract_and_filter_schema(context)
            begin
              # Get filtering configuration from context options
              exclude_tables = context.options[:exclude_tables] || []
              include_only = context.options[:table] ? [ context.options[:table] ] : nil

              # Use SchemaService for schema extraction
              schema_data = schema_service.extract_schema

              # Apply filtering manually
              if include_only
                # Filter to only include specified table
                schema_data[:tables] = schema_data[:tables].select { |t| include_only.include?(t[:name]) }
              elsif exclude_tables.any?
                # Filter out excluded tables
                schema_data[:tables] = schema_data[:tables].reject { |t| exclude_tables.include?(t[:name]) }
              end

              # Handle empty results
              if schema_data[:tables].empty?
                raise SchemaExtractionError, "No tables found for generation with current filters"
              end

              schema_data

            rescue => e
              raise SchemaExtractionError, "Failed to extract schema: #{e.message}"
            end
          end

          # Validate schema data integrity and structure
          #
          # @param schema_data [Hash] Schema data to validate
          #
          # @raise [SchemaAnalysisError] If schema validation fails
          #
          def validate_schema_integrity(schema_data)
            # Validate required schema structure
            required_keys = [ :tables, :relationships, :patterns, :indexes, :constraints ]
            missing_keys = required_keys - schema_data.keys

            if missing_keys.any?
              raise SchemaAnalysisError, "Schema missing required keys: #{missing_keys.join(', ')}"
            end

            # Validate tables structure
            unless schema_data[:tables].is_a?(Array) && schema_data[:tables].any?
              raise SchemaAnalysisError, "Schema must contain a non-empty tables array"
            end

            # Validate each table has required structure
            schema_data[:tables].each do |table|
              validate_table_structure(table)
            end
          end

          # Validate individual table structure
          #
          # @param table [Hash] Table data to validate
          #
          # @raise [SchemaAnalysisError] If table structure is invalid
          #
          def validate_table_structure(table)
            unless table.is_a?(Hash) && valid_table_name?(table[:name]) && table[:columns].is_a?(Array)
              raise SchemaAnalysisError, "Invalid table structure: #{table.inspect}"
            end

            if table[:columns].empty?
              raise SchemaAnalysisError, "Table '#{table[:name]}' has no columns"
            end
          end

          # Check if table name is valid (not nil, empty, or blank)
          #
          # @param name [String, nil] Table name to validate
          # @return [Boolean] True if name is valid
          #
          def valid_table_name?(name)
            name && name.to_s.strip.length > 0
          end

          # Enrich context with complete schema analysis data
          #
          # @param context [GenerationContext] Original context
          # @param schema_data [Hash] Complete schema analysis results
          # @return [GenerationContext] Enriched context with schema data
          #
          def enrich_context_with_schema(context, schema_data)
            # For single table processing, enrich with specific table data
            if context.options[:table]
              target_table = find_target_table(schema_data[:tables], context.options[:table])

              if target_table.nil?
                raise TableFilteringError, "Specified table '#{context.options[:table]}' not found in schema"
              end

              # Enrich context with specific table and its relationships
              relationships = find_relationships_for_table(target_table[:name], schema_data[:relationships])
              patterns = schema_data[:patterns][target_table[:name]] || {}

              context
                .with_metadata(
                  table: target_table,
                  full_schema: schema_data,
                  relationships: relationships,
                  patterns: patterns,
                  schema_analysis_complete: true
                )

            else
              # For multi-table processing, provide full schema
              context
                .with_metadata(
                  full_schema: schema_data,
                  schema_analysis_complete: true,
                  total_tables: schema_data[:tables].length
                )
            end
          end

          # Find target table in schema data
          #
          # @param tables [Array] Array of table data
          # @param table_name [String] Name of table to find
          # @return [Hash, nil] Table data or nil if not found
          #
          def find_target_table(tables, table_name)
            tables.find { |table| table[:name] == table_name }
          end

          # Find relationships for a specific table
          #
          # @param table_name [String] Table name to find relationships for
          # @param relationships [Array] All relationships data from schema
          # @return [Hash] Structured relationships for the table
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

          # Get default empty relationship structure
          #
          # @return [Hash] Empty relationships structure
          #
          def default_relationship_structure
            {
              belongs_to: [],
              has_many: [],
              has_one: [],
              polymorphic: []
            }
          end

          # Count total patterns detected across all tables
          #
          # @param patterns [Hash] Patterns data keyed by table name
          # @return [Integer] Total number of patterns detected
          #
          def count_patterns(patterns)
            return 0 unless patterns.is_a?(Hash)

            patterns.values.sum { |table_patterns| table_patterns&.keys&.size || 0 }
          end

          # Get schema service from service registry
          #
          # @return [SchemaService] Configured schema service instance
          #
          def schema_service
            @schema_service ||= service_registry.get_service(:schema)
          end

          # Validate context has required structure for schema analysis
          #
          # @param context [GenerationContext] Context to validate
          #
          # @raise [ArgumentError] If context is invalid
          #
          def validate_context!(context)
            super(context, [ :options ])

            unless context.options.is_a?(Hash)
              raise ArgumentError, "Context options must be a Hash"
            end
          end
        end
      end
    end
  end
end
