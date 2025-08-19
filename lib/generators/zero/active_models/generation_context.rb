# frozen_string_literal: true

module Zero
  module Generators
    # GenerationContext is an immutable value object that encapsulates
    # all configuration and context data needed for TypeScript model generation.
    #
    # This eliminates primitive obsession by replacing scattered hash parameters
    # with a proper domain object. It provides type safety, validation, and
    # convenient computed properties while maintaining immutability.
    #
    # Key Responsibilities:
    # - Encapsulate table schema, relationships, options, and metadata
    # - Provide immutable update patterns via #with_* methods
    # - Calculate derived properties (model names, file paths)
    # - Validate required context data
    # - Offer helpful debugging and inspection methods
    #
    # @example Basic usage
    #   context = GenerationContext.new(
    #     table: { name: "users", columns: [...] },
    #     schema: { tables: [...], relationships: [...] },
    #     relationships: { belongs_to: [...], has_many: [...] },
    #     options: { dry_run: false, output_dir: "..." }
    #   )
    #
    # @example Immutable updates
    #   new_context = context.with_relationships(processed_relationships)
    #   final_context = new_context.with_generated_content(typescript_code)
    #
    class GenerationContext
      # Context validation errors
      class ContextError < StandardError; end
      class ValidationError < ContextError; end

      attr_reader :table, :schema, :relationships, :options, :metadata

      # Initialize GenerationContext with required table and schema data
      #
      # @param table [Hash] Table definition with :name and :columns keys
      # @param schema [Hash] Complete schema data with :tables, :relationships, :patterns
      # @param relationships [Hash] Processed relationships for this table
      # @param options [Hash] Generator options and configuration
      # @param metadata [Hash] Additional context and computed data
      #
      # @raise [ValidationError] If required parameters are missing or invalid
      #
      def initialize(table:, schema:, relationships: {}, options: {}, metadata: {})
        @table = table.freeze
        @schema = schema.freeze
        @relationships = relationships.freeze
        @options = options.freeze
        @metadata = metadata.freeze

        validate!
        freeze
      end

      # Create new context with updated relationships
      #
      # @param new_relationships [Hash] Updated relationship data
      # @return [GenerationContext] New immutable context instance
      #
      def with_relationships(new_relationships)
        self.class.new(
          table: table,
          schema: schema,
          relationships: new_relationships,
          options: options,
          metadata: metadata
        )
      end

      # Create new context with updated options
      #
      # @param new_options [Hash] Updated options data
      # @return [GenerationContext] New immutable context instance
      #
      def with_options(new_options)
        self.class.new(
          table: table,
          schema: schema,
          relationships: relationships,
          options: new_options,
          metadata: metadata
        )
      end

      # Create new context with updated metadata
      #
      # @param new_metadata [Hash] Updated metadata (merged with existing)
      # @return [GenerationContext] New immutable context instance
      #
      def with_metadata(new_metadata)
        merged_metadata = metadata.merge(new_metadata)
        self.class.new(
          table: table,
          schema: schema,
          relationships: relationships,
          options: options,
          metadata: merged_metadata
        )
      end

      # Create new context with generated TypeScript content
      #
      # @param content [String] Generated TypeScript code
      # @return [GenerationContext] New context with content stored in metadata
      #
      def with_generated_content(content)
        with_metadata(generated_content: content)
      end

      # Get table name
      #
      # @return [String] Table name from schema
      #
      def table_name
        table[:name]
      end

      # Get model name (singular, camelized)
      #
      # @return [String] TypeScript class name for this model
      #
      def model_name
        # Find the Rails model for proper singularization
        rails_model = find_rails_model
        if rails_model
          rails_model.name.underscore
        else
          table_name.singularize
        end.camelize
      end

      # Get kebab-case model name for file naming
      #
      # @return [String] Kebab-case model name for TypeScript files
      #
      def kebab_name
        model_name.underscore.dasherize
      end

      # Get TypeScript file names for this model
      #
      # @return [Hash] Hash with :data, :active, :reactive file names
      #
      def typescript_filenames
        {
          data: "types/#{kebab_name}-data.ts",
          active: "#{kebab_name}.ts",
          reactive: "reactive-#{kebab_name}.ts"
        }
      end

      # Check if this model has relationships
      #
      # @return [Boolean] True if any relationships are defined
      #
      def has_relationships?
        relationships.any? { |_type, relations| relations.any? }
      end

      # Check if this is a polymorphic model
      #
      # @return [Boolean] True if model has polymorphic relationships
      #
      def has_polymorphic_relationships?
        relationships[:polymorphic]&.any? || false
      end

      # Get table patterns (soft deletion, etc.)
      #
      # @return [Hash] Pattern data for this table from schema
      #
      def patterns
        schema.dig(:patterns, table_name) || {}
      end

      # Check if table supports soft deletion
      #
      # @return [Boolean] True if soft deletion pattern detected
      #
      def supports_soft_deletion?
        patterns.key?(:soft_deletion)
      end

      # Get generated content from metadata
      #
      # @return [String, nil] Previously generated TypeScript content
      #
      def generated_content
        metadata[:generated_content]
      end

      # Get dry run status from options
      #
      # @return [Boolean] True if this is a dry run
      #
      def dry_run?
        options[:dry_run] == true
      end

      # Provide detailed string representation for debugging
      #
      # @return [String] Detailed context inspection
      #
      def inspect
        "#<#{self.class.name}:#{object_id.to_s(16)} " \
          "table=#{table_name.inspect} " \
          "model=#{model_name.inspect} " \
          "relationships=#{relationships.keys.inspect} " \
          "options=#{options.keys.inspect}>"
      end

      # Provide compact string representation
      #
      # @return [String] Compact context description
      #
      def to_s
        "GenerationContext(#{table_name} -> #{model_name})"
      end

      private

      # Validate required context data
      #
      # @raise [ValidationError] If validation fails
      #
      def validate!
        validate_table!
        validate_schema!
        validate_data_types!
      end

      # Validate table data structure
      #
      # @raise [ValidationError] If table is invalid
      #
      def validate_table!
        raise ValidationError, "table is required" if table.nil?
        raise ValidationError, "table must be a Hash" unless table.is_a?(Hash)
        raise ValidationError, "table[:name] is required" if table[:name].nil? || table[:name].empty?
        raise ValidationError, "table[:columns] is required" if table[:columns].nil?
        raise ValidationError, "table[:columns] must be an Array" unless table[:columns].is_a?(Array)
      end

      # Validate schema data structure
      #
      # @raise [ValidationError] If schema is invalid
      #
      def validate_schema!
        raise ValidationError, "schema is required" if schema.nil?
        raise ValidationError, "schema must be a Hash" unless schema.is_a?(Hash)
      end

      # Validate data types for key attributes
      #
      # @raise [ValidationError] If data types are invalid
      #
      def validate_data_types!
        raise ValidationError, "relationships must be a Hash" unless relationships.is_a?(Hash)
        raise ValidationError, "options must be a Hash" unless options.is_a?(Hash)
        raise ValidationError, "metadata must be a Hash" unless metadata.is_a?(Hash)
      end

      # Find the Rails model class for this table
      #
      # @return [Class, nil] Rails model class if found
      #
      def find_rails_model
        return nil unless defined?(ApplicationRecord)

        ApplicationRecord.descendants.find { |m| m.table_name == table_name }
      rescue => e
        # Log but don't fail - we can still generate without Rails model
        Rails.logger&.debug("Could not find Rails model for #{table_name}: #{e.message}")
        nil
      end
    end
  end
end
