# frozen_string_literal: true

require "yaml"

module Zero
  module Generators
    # Service class for loading and parsing polymorphic configuration from YAML
    # Integrates with the polymorphic introspector configuration and provides
    # structured data for model generation.
    class PolymorphicConfigLoader
      # Configuration file path relative to Rails.root
      CONFIG_FILE_PATH = "config/zero_polymorphic_types.yml"

      attr_reader :config_data, :loaded_at

      def initialize(config_path = nil)
        @config_path = config_path || Rails.root.join(CONFIG_FILE_PATH)
        @config_data = {}
        @loaded_at = nil
        load_configuration if File.exist?(@config_path)
      end

      # Load configuration from the YAML file
      # Returns true if successfully loaded, false if file doesn't exist
      def load_configuration
        return false unless File.exist?(@config_path)

        begin
          raw_data = YAML.load_file(@config_path)
          @config_data = raw_data || {}
          @loaded_at = Time.current
          true
        rescue => e
          Rails.logger.warn("Failed to load polymorphic configuration from #{@config_path}: #{e.message}")
          @config_data = {}
          @loaded_at = nil
          false
        end
      end

      # Get polymorphic associations for a specific table
      # @param table_name [String] Name of the table to get associations for
      # @return [Array<Hash>] Array of polymorphic association configurations
      def polymorphic_associations_for_table(table_name)
        associations = []
        polymorphic_data = @config_data.dig(:polymorphic_associations) || {}

        polymorphic_data.each do |association_key, association_config|
          # Parse association key (format: "table.association_name")
          config_table, association_name = association_key.to_s.split(".", 2)
          next unless config_table == table_name

          # Use potential_types (from model analysis) if available, fallback to discovered_types
          types = association_config[:potential_types] || association_config[:discovered_types] || []
          next unless types.any?

          associations << {
            name: association_name,
            type_field: association_config[:type_column],
            id_field: association_config[:id_column],
            allowed_types: types,
            mapped_tables: association_config[:mapped_tables] || [],
            statistics: association_config[:statistics] || {}
          }
        end

        associations
      end

      # Check if a table has any polymorphic associations
      # @param table_name [String] Name of the table to check
      # @return [Boolean] True if table has polymorphic associations
      def has_polymorphic_associations?(table_name)
        polymorphic_associations_for_table(table_name).any?
      end

      # Get all tables that have polymorphic associations
      # @return [Array<String>] Array of table names with polymorphic associations
      def tables_with_polymorphic_associations
        tables = Set.new
        polymorphic_data = @config_data.dig(:polymorphic_associations) || {}

        polymorphic_data.keys.each do |association_key|
          table_name, _association = association_key.to_s.split(".", 2)
          tables << table_name if table_name
        end

        tables.to_a.sort
      end

      # Get configuration metadata
      # @return [Hash] Metadata about the configuration
      def metadata
        @config_data[:metadata] || {}
      end

      # Get configuration statistics
      # @return [Hash] Statistics about polymorphic associations
      def statistics
        @config_data[:statistics] || {}
      end

      # Check if configuration is loaded and valid
      # @return [Boolean] True if configuration is loaded
      def loaded?
        @loaded_at.present? && @config_data.present?
      end

      # Get configuration summary for reporting
      # @return [Hash] Summary of configuration status
      def summary
        {
          loaded: loaded?,
          loaded_at: @loaded_at,
          config_path: @config_path,
          file_exists: File.exist?(@config_path),
          total_associations: statistics[:total_associations] || 0,
          associations_with_data: statistics[:associations_with_data] || 0,
          tables_with_polymorphic: tables_with_polymorphic_associations.count
        }
      end

      # Force reload of configuration
      # @return [Boolean] True if successfully reloaded
      def reload!
        @config_data = {}
        @loaded_at = nil
        load_configuration
      end

      # Get polymorphic configuration in format suitable for model generation
      # @param table_name [String] Name of the table
      # @return [Hash] Formatted configuration for template rendering
      def polymorphic_config_for_template(table_name)
        associations = polymorphic_associations_for_table(table_name)
        return {} if associations.empty?

        config = {
          tableName: table_name,
          belongsTo: {}
        }

        associations.each do |association|
          # Convert Rails model names to lowercase for allowedTypes
          allowed_types = association[:allowed_types].map(&:underscore)

          config[:belongsTo][association[:name]] = {
            typeField: association[:type_field],
            idField: association[:id_field],
            allowedTypes: allowed_types
          }
        end

        config
      end

      # Generate import statement for polymorphic tracking system
      # @param table_name [String] Name of the table
      # @return [String] Import statement or empty string
      def polymorphic_import_statement(table_name)
        return "" unless has_polymorphic_associations?(table_name)

        "import { declarePolymorphicRelationships } from '../zero/polymorphic';"
      end

      # Generate static block content for polymorphic relationships
      # @param table_name [String] Name of the table
      # @return [String] Static block content or empty string
      def polymorphic_static_block(table_name)
        config = polymorphic_config_for_template(table_name)
        return "" if config.empty?

        # Generate formatted configuration object
        belongs_to_entries = config[:belongsTo].map do |name, options|
          allowed_types_str = options[:allowedTypes].map { |type| "'#{type}'" }.join(", ")

          <<~TYPESCRIPT.strip
            #{name}: {
                typeField: '#{options[:typeField]}',
                idField: '#{options[:idField]}',
                allowedTypes: [#{allowed_types_str}]
              }
          TYPESCRIPT
        end.join(",\n          ")

        # Note: Using immediate function invocation since models are exported as const
        <<~TYPESCRIPT.strip
          // EP-0036: Polymorphic relationship declarations
          declarePolymorphicRelationships({
            tableName: '#{config[:tableName]}',
            belongsTo: {
              #{belongs_to_entries}
            }
          });
        TYPESCRIPT
      end
    end
  end
end
