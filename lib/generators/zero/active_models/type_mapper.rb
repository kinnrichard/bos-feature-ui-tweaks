# frozen_string_literal: true

module Zero
  module Generators
    # TypeMapper - Centralized type mapping from Rails to TypeScript
    #
    # Handles the conversion of Rails column types to appropriate TypeScript types,
    # with special handling for enums, configurable type mappings, and extensible
    # custom type support.
    #
    # Features:
    # - Configurable type mappings via class constants
    # - Enhanced enum handling with validation
    # - Support for custom type mappings
    # - Extensible architecture for different deployment scenarios
    #
    # @example Basic usage
    #   mapper = TypeMapper.new
    #   ts_type = mapper.map_rails_type_to_typescript("string", { name: "title" })
    #   # => "string"
    #
    # @example Enum handling
    #   column = { enum: true, enum_values: ["draft", "published"] }
    #   ts_type = mapper.map_rails_type_to_typescript("string", column)
    #   # => "'draft' | 'published'"
    #
    class TypeMapper
      # Core type mappings from Rails types to TypeScript types
      # Organized by type categories for better maintainability
      TYPE_MAP = {
        # String types
        %w[string text] => "string",

        # Numeric types
        %w[integer bigint] => "number",
        %w[decimal float] => "number",

        # Boolean types
        %w[boolean] => "boolean",

        # Date/Time types
        %w[datetime timestamp timestamptz] => "string | number", # Support both ISO strings and timestamps
        %w[date] => "string",
        %w[time] => "string",

        # Complex types
        %w[json jsonb] => "Record<string, unknown>",
        %w[uuid] => "string",
        %w[binary] => "Uint8Array"
      }.freeze

      # Flattened mapping for fast lookups
      # Built automatically from TYPE_MAP for O(1) performance
      FLATTENED_TYPE_MAP = TYPE_MAP.each_with_object({}) do |(rails_types, ts_type), hash|
        rails_types.each { |rails_type| hash[rails_type] = ts_type }
      end.freeze

      # Default fallback type for unknown Rails types
      DEFAULT_UNKNOWN_TYPE = "unknown"

      # Initialize TypeMapper with optional custom configuration
      #
      # Uses constructor injection with sensible defaults, following Sandi Metz principles.
      # No hidden dependencies, no service registry lookups.
      #
      # @param custom_mappings [Hash] Additional type mappings to merge with defaults
      # @param unknown_type_handler [String] Custom fallback for unknown types
      def initialize(custom_mappings: {}, unknown_type_handler: DEFAULT_UNKNOWN_TYPE)
        @custom_mappings = custom_mappings || {}
        @unknown_type_handler = unknown_type_handler

        # Ensure custom mappings use string keys to match FLATTENED_TYPE_MAP
        stringified_custom_mappings = @custom_mappings.transform_keys(&:to_s)
        @effective_mappings = FLATTENED_TYPE_MAP.merge(stringified_custom_mappings)
      end

      # Map Rails column type to appropriate TypeScript type
      #
      # @param rails_type [String, Symbol] The Rails column type
      # @param column [Hash] Column metadata including enum information
      # @return [String] The corresponding TypeScript type
      #
      # @example Standard type mapping
      #   mapper.map_rails_type_to_typescript("string", {})
      #   # => "string"
      #
      # @example Enum type mapping
      #   column = { enum: true, enum_values: ["active", "inactive"] }
      #   mapper.map_rails_type_to_typescript("string", column)
      #   # => "'active' | 'inactive'"
      #
      def map_rails_type_to_typescript(rails_type, column)
        # Handle enums first - they override base type mapping
        return enum_type(column) if enum_column?(column)

        # Map standard Rails types to TypeScript
        normalized_type = rails_type.to_s
        @effective_mappings[normalized_type] || handle_unknown_type(normalized_type)
      end

      # Alias for map_rails_type_to_typescript for compatibility
      #
      # @param rails_type [String, Symbol] The Rails column type
      # @param column [Hash] Column metadata including enum information
      # @return [String] The corresponding TypeScript type
      #
      def map_type(rails_type, column = {})
        map_rails_type_to_typescript(rails_type, column)
      end

      # Generate TypeScript enum type from column enum values
      #
      # @param column [Hash] Column metadata with enum information
      # @return [String] TypeScript union type string
      #
      # @example
      #   column = { enum_values: ["draft", "published", "archived"] }
      #   mapper.enum_type(column)
      #   # => "'draft' | 'published' | 'archived'"
      #
      def enum_type(column)
        return DEFAULT_UNKNOWN_TYPE unless valid_enum_values?(column)

        column[:enum_values]
          .map { |value| "'#{escape_enum_value(value)}'" }
          .join(" | ")
      end

      # Check if this mapper handles unknown types gracefully
      #
      # @return [Boolean] True if unknown types are handled, false if they throw errors
      def handles_unknown_types?
        !@unknown_type_handler.nil?
      end

      # Get the effective type mappings (defaults + custom)
      #
      # @return [Hash] The complete type mapping hash
      def effective_mappings
        @effective_mappings.dup
      end

      # Get available Rails types that can be mapped
      #
      # @return [Array<String>] List of supported Rails types
      def supported_rails_types
        @effective_mappings.keys.sort
      end

      private

      # Check if column represents an enum type
      #
      # @param column [Hash] Column metadata
      # @return [Boolean] True if column is a valid enum
      def enum_column?(column)
        column[:enum] && valid_enum_values?(column)
      end

      # Validate enum values are present and usable
      #
      # @param column [Hash] Column metadata
      # @return [Boolean] True if enum values are valid
      def valid_enum_values?(column)
        column[:enum_values]&.respond_to?(:any?) && column[:enum_values].any?
      end

      # Escape enum values for safe TypeScript literal types
      # Handles single quotes and other special characters
      #
      # @param value [String] Raw enum value
      # @return [String] Escaped enum value safe for TypeScript
      def escape_enum_value(value)
        value.to_s.gsub("'", "\\'")
      end

      # Handle unknown Rails types with configured fallback
      #
      # @param rails_type [String] Unknown Rails type
      # @return [String] Fallback TypeScript type
      def handle_unknown_type(rails_type)
        # Log unknown type for monitoring and improvement
        warn_unknown_type(rails_type) if Rails.env.development?

        @unknown_type_handler
      end

      # Warn about unknown types in development for monitoring
      #
      # @param rails_type [String] Unknown Rails type encountered
      def warn_unknown_type(rails_type)
        puts "⚠️  TypeMapper: Unknown Rails type '#{rails_type}', mapping to '#{@unknown_type_handler}'"
      end
    end
  end
end
