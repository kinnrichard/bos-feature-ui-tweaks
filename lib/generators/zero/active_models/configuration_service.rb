# frozen_string_literal: true

require "yaml"
require "pathname"
require_relative "../../../zero_schema_generator/rails_schema_introspector"

module Zero
  module Generators
    # ConfigurationService provides comprehensive configuration management
    # for the Zero ActiveModels generator system.
    #
    # This service centralizes all configuration concerns including:
    # - Generator settings and defaults
    # - System table exclusions
    # - Type mappings and overrides
    # - File operation settings
    # - Template configurations
    # - Environment-specific configuration
    # - Configuration validation and schema enforcement
    #
    # Key Responsibilities:
    # - Configuration loading from files and defaults
    # - Environment-specific configuration management
    # - Configuration validation and error reporting
    # - Dynamic configuration updates and persistence
    # - Configuration schema enforcement
    # - Performance optimizations for repeated access
    #
    # @example Basic usage
    #   config_service = ConfigurationService.new
    #   config_service.excluded_tables
    #   # => ["ar_internal_metadata", "schema_migrations", ...]
    #
    # @example Environment-specific configuration
    #   config_service = ConfigurationService.new(environment: "production")
    #   config_service.enable_caching?
    #   # => true (production defaults)
    #
    class ConfigurationService
      # Configuration validation errors
      class ConfigurationError < StandardError; end
      class ValidationError < ConfigurationError; end
      class SchemaError < ConfigurationError; end

      # Default configuration structure
      DEFAULT_CONFIG = {
        # System table exclusions - uses the canonical list from RailsSchemaIntrospector
        # Additional exclusions can be added via configuration files or add_excluded_table method
        excluded_tables: ZeroSchemaGenerator::RailsSchemaIntrospector::EXCLUDED_TABLES.dup.freeze,

        # Type mapping overrides
        type_overrides: {}.freeze,

        # Field mapping customizations
        field_mappings: {}.freeze,

        # Output configuration
        output: {
          base_dir: "frontend/src/lib/models",
          types_dir: "frontend/src/lib/models/types",
          zero_dir: "frontend/src/lib/zero",
          schema_file: "frontend/src/lib/zero/generated-schema.ts",
          types_file: "frontend/src/lib/types/generated.ts"
        }.freeze,

        # File operation settings
        file_operations: {
          enable_prettier: true,
          enable_semantic_comparison: true,
          create_directories: true,
          force_overwrite: false
        }.freeze,

        # Template settings
        template_settings: {
          enable_caching: false, # Disabled by default, enabled in development
          trim_mode: "-",
          error_handling: "detailed"
        }.freeze,

        # Generator behavior
        generator_options: {
          enable_pattern_detection: true,
          generate_relationships: true,
          generate_enums: true,
          validate_schema: true,
          dry_run: false
        }.freeze,

        # Performance settings
        performance: {
          enable_schema_caching: true,
          cache_ttl: 3600, # 1 hour
          max_cache_entries: 100
        }.freeze,

        # Customization preservation
        preserve_customizations: [].freeze
      }.freeze

      # Environment-specific overrides
      ENVIRONMENT_OVERRIDES = {
        development: {
          template_settings: {
            enable_caching: true,
            error_handling: "detailed"
          },
          performance: {},
          file_operations: {
            enable_prettier: true
          }
        },
        production: {
          template_settings: {
            enable_caching: true,
            error_handling: "minimal"
          },
          performance: {
            cache_ttl: 7200 # 2 hours
          },
          file_operations: {
            enable_prettier: true,
            enable_semantic_comparison: true
          }
        },
        test: {
          template_settings: {
            enable_caching: false,
            error_handling: "detailed"
          },
          performance: {
            enable_schema_caching: false
          },
          file_operations: {
            enable_prettier: false,
            force_overwrite: true
          }
        }
      }.freeze

      attr_reader :environment, :config_file_path, :configuration, :statistics

      # Initialize ConfigurationService with environment and file path
      #
      # @param environment [String, Symbol] Environment name (development, production, test)
      # @param config_file_path [String] Path to configuration file
      # @param validate_on_load [Boolean] Validate configuration on load (default: true)
      #
      def initialize(environment: nil, config_file_path: nil, validate_on_load: true)
        @environment = (environment || detect_environment).to_s
        @config_file_path = config_file_path || default_config_file_path
        @configuration = {}
        @statistics = {
          loads: 0,
          saves: 0,
          validations: 0,
          errors: 0,
          cache_hits: 0
        }

        load_configuration!
        validate_configuration! if validate_on_load
      end

      # Get excluded tables list
      #
      # @return [Array<String>] List of excluded table names
      #
      def excluded_tables
        get_config_value(:excluded_tables)
      end

      # Get type overrides hash
      #
      # @return [Hash] Type mapping overrides
      #
      def type_overrides
        get_config_value(:type_overrides)
      end

      # Get field mappings hash
      #
      # @return [Hash] Field mapping customizations
      #
      def field_mappings
        get_config_value(:field_mappings)
      end

      # Get output directory configuration
      #
      # @return [Hash] Output directory settings
      #
      def output_config
        get_config_value(:output)
      end

      # Get base output directory path
      #
      # @return [String] Base output directory
      #
      def base_output_dir
        output_config[:base_dir]
      end

      # Get types directory path
      #
      # @return [String] Types directory path
      #
      def types_dir
        output_config[:types_dir]
      end

      # Get Zero directory path
      #
      # @return [String] Zero directory path
      #
      def zero_dir
        output_config[:zero_dir]
      end

      # Get schema file path
      #
      # @return [String] Schema file path
      #
      def schema_file_path
        output_config[:schema_file]
      end

      # Get types file path
      #
      # @return [String] Types file path
      #
      def types_file_path
        output_config[:types_file]
      end

      # Check if Prettier formatting is enabled
      #
      # @return [Boolean] True if Prettier is enabled
      #
      def enable_prettier?
        get_config_value(:file_operations)[:enable_prettier]
      end

      # Check if semantic comparison is enabled
      #
      # @return [Boolean] True if semantic comparison is enabled
      #
      def enable_semantic_comparison?
        get_config_value(:file_operations)[:enable_semantic_comparison]
      end

      # Check if directory creation is enabled
      #
      # @return [Boolean] True if directories should be created
      #
      def create_directories?
        get_config_value(:file_operations)[:create_directories]
      end

      # Check if force overwrite is enabled
      #
      # @return [Boolean] True if files should be overwritten
      #
      def force_overwrite?
        get_config_value(:file_operations)[:force_overwrite]
      end


      # Get template trim mode
      #
      # @return [String] ERB trim mode setting
      #
      def template_trim_mode
        get_config_value(:template_settings)[:trim_mode]
      end

      # Get template error handling mode
      #
      # @return [String] Template error handling setting
      #
      def template_error_handling
        get_config_value(:template_settings)[:error_handling]
      end

      # Check if pattern detection is enabled
      #
      # @return [Boolean] True if pattern detection is enabled
      #
      def enable_pattern_detection?
        get_config_value(:generator_options)[:enable_pattern_detection]
      end

      # Check if relationship generation is enabled
      #
      # @return [Boolean] True if relationships should be generated
      #
      def generate_relationships?
        get_config_value(:generator_options)[:generate_relationships]
      end

      # Check if enum generation is enabled
      #
      # @return [Boolean] True if enums should be generated
      #
      def generate_enums?
        get_config_value(:generator_options)[:generate_enums]
      end

      # Check if schema validation is enabled
      #
      # @return [Boolean] True if schema should be validated
      #
      def validate_schema?
        get_config_value(:generator_options)[:validate_schema]
      end

      # Check if schema caching is enabled
      #
      # @return [Boolean] True if schema caching is enabled
      #
      def enable_schema_caching?
        get_config_value(:performance)[:enable_schema_caching]
      end

      # Get cache TTL in seconds
      #
      # @return [Integer] Cache TTL in seconds
      #
      def cache_ttl
        get_config_value(:performance)[:cache_ttl]
      end

      # Get maximum cache entries
      #
      # @return [Integer] Maximum cache entries
      #
      def max_cache_entries
        get_config_value(:performance)[:max_cache_entries]
      end

      # Get preserved customizations list
      #
      # @return [Array<String>] List of preserved customizations
      #
      def preserve_customizations
        get_config_value(:preserve_customizations)
      end

      # Update configuration value
      #
      # @param key_path [String, Symbol, Array] Configuration key path
      # @param value [Object] New value to set
      # @param validate [Boolean] Validate after update (default: true)
      #
      def update_config(key_path, value, validate: true)
        key_path = normalize_key_path(key_path)
        set_nested_value(@configuration, key_path, value)
        validate_configuration! if validate
        @statistics[:updates] = (@statistics[:updates] || 0) + 1
      end

      # Add excluded table
      #
      # @param table_name [String] Table name to exclude
      #
      def add_excluded_table(table_name)
        current_excluded = excluded_tables.dup
        current_excluded << table_name unless current_excluded.include?(table_name)
        update_config(:excluded_tables, current_excluded)
      end

      # Remove excluded table
      #
      # @param table_name [String] Table name to include
      #
      def remove_excluded_table(table_name)
        current_excluded = excluded_tables.dup
        current_excluded.delete(table_name)
        update_config(:excluded_tables, current_excluded)
      end

      # Add type override
      #
      # @param rails_type [String] Rails type to override
      # @param typescript_type [String] TypeScript type to use
      #
      def add_type_override(rails_type, typescript_type)
        current_overrides = type_overrides.dup
        current_overrides[rails_type.to_sym] = typescript_type
        update_config(:type_overrides, current_overrides)
      end

      # Save configuration to file
      #
      # @param file_path [String] Optional custom file path
      # @return [Boolean] True if save successful
      #
      def save_configuration!(file_path: nil)
        target_path = file_path || @config_file_path

        begin
          ensure_config_directory_exists(target_path)

          config_hash = {
            "zero_generator" => @configuration,
            "environment" => @environment,
            "updated_at" => Time.current.iso8601
          }

          File.write(target_path, config_hash.to_yaml)
          @statistics[:saves] += 1
          true
        rescue => e
          @statistics[:errors] += 1
          raise ConfigurationError, "Failed to save configuration: #{e.message}"
        end
      end

      # Reload configuration from file
      #
      # @param validate [Boolean] Validate after reload (default: true)
      #
      def reload_configuration!(validate: true)
        load_configuration!
        validate_configuration! if validate
      end

      # Validate current configuration
      #
      # @return [Boolean] True if configuration is valid
      # @raise [ValidationError] If validation fails
      #
      def validate_configuration!
        @statistics[:validations] += 1

        begin
          validate_required_keys
          validate_excluded_tables
          validate_output_paths
          validate_file_operations
          validate_performance_settings
          true
        rescue => e
          @statistics[:errors] += 1
          raise ValidationError, "Configuration validation failed: #{e.message}"
        end
      end

      # Validate configuration (alias for compatibility with tests)
      #
      # @return [Boolean] True if configuration is valid
      # @raise [ValidationError] If validation fails
      #
      def validate_configuration(config = nil)
        # If config is provided, temporarily use it for validation
        if config
          original_config = @configuration
          @configuration = config
          result = validate_configuration!
          @configuration = original_config
          result
        else
          validate_configuration!
        end
      end

      # Get configuration health status
      #
      # @return [Hash] Health status and diagnostics
      #
      def health_check
        {
          status: :healthy,
          environment: @environment,
          config_file: @config_file_path,
          config_exists: File.exist?(@config_file_path),
          last_validation: @statistics[:validations] > 0,
          statistics: @statistics,
          key_counts: {
            excluded_tables: excluded_tables.size,
            type_overrides: type_overrides.size,
            field_mappings: field_mappings.size,
            preserve_customizations: preserve_customizations.size
          }
        }
      rescue => e
        {
          status: :unhealthy,
          error: e.message,
          environment: @environment,
          config_file: @config_file_path,
          statistics: @statistics
        }
      end

      # Reset configuration to defaults
      #
      # @param preserve_environment [Boolean] Keep environment-specific settings
      #
      def reset_to_defaults!(preserve_environment: true)
        @configuration = deep_dup(DEFAULT_CONFIG)
        apply_environment_overrides if preserve_environment
        validate_configuration!
      end

      # Export configuration as hash
      #
      # @return [Hash] Complete configuration hash
      #
      def export_config
        {
          base_config: deep_dup(@configuration),
          environment: @environment,
          environment_overrides: ENVIRONMENT_OVERRIDES[@environment.to_sym] || {},
          statistics: @statistics
        }
      end

      # Update configuration with generator options
      #
      # @param generator_options [Hash] Options from Rails generator
      #
      def update_from_generator_options(generator_options)
        return unless generator_options

        # Track if we're using generator options (allows absolute paths)
        @using_generator_options = true

        # Update output directory if provided
        if generator_options[:output_dir]
          output_dir = generator_options[:output_dir]

          # Handle absolute paths correctly
          base_dir = if Pathname.new(output_dir).absolute?
                       output_dir
          else
                       output_dir
          end

          # Update output configuration
          update_config([ :output, :base_dir ], base_dir, validate: false)
          update_config([ :output, :types_dir ], File.join(base_dir, "types"), validate: false)
        end

        # Update other generator options
        if generator_options.key?(:force)
          update_config([ :file_operations, :force_overwrite ], generator_options[:force], validate: false)
        end

        if generator_options.key?(:skip_prettier)
          update_config([ :file_operations, :enable_prettier ], !generator_options[:skip_prettier], validate: false)
        end

        if generator_options.key?(:dry_run)
          update_config([ :generator_options, :dry_run ], generator_options[:dry_run], validate: false)
        end

        # Validate after all updates
        validate_configuration!
      end

      private

      # Load configuration from file and apply defaults
      #
      def load_configuration!
        @configuration = deep_dup(DEFAULT_CONFIG)

        # Load from file if it exists
        if File.exist?(@config_file_path)
          load_from_file
        end

        # Apply environment-specific overrides
        apply_environment_overrides

        @statistics[:loads] += 1
      end

      # Load configuration from YAML file
      #
      def load_from_file
        begin
          file_config = YAML.load_file(@config_file_path)
          generator_config = file_config["zero_generator"] || {}

          # Symbolize keys recursively to match default configuration
          symbolized_config = symbolize_keys_recursively(generator_config)

          # Deep merge file configuration with defaults
          @configuration = deep_merge(@configuration, symbolized_config)
        rescue => e
          raise ConfigurationError, "Failed to load configuration from #{@config_file_path}: #{e.message}"
        end
      end

      # Apply environment-specific configuration overrides
      #
      def apply_environment_overrides
        env_overrides = ENVIRONMENT_OVERRIDES[@environment.to_sym]
        return unless env_overrides

        @configuration = deep_merge(@configuration, env_overrides)
      end

      # Get configuration value with nested key support
      #
      # @param key_path [String, Symbol, Array] Configuration key path
      # @return [Object] Configuration value
      #
      def get_config_value(key_path)
        key_path = normalize_key_path(key_path)
        get_nested_value(@configuration, key_path)
      end

      # Get nested value from hash using key path
      #
      # @param hash [Hash] Source hash
      # @param key_path [Array] Array of keys
      # @return [Object] Nested value
      #
      def get_nested_value(hash, key_path)
        key_path.reduce(hash) { |current, key| current&.dig(key) }
      end

      # Set nested value in hash using key path
      #
      # @param hash [Hash] Target hash
      # @param key_path [Array] Array of keys
      # @param value [Object] Value to set
      #
      def set_nested_value(hash, key_path, value)
        last_key = key_path.pop
        target = key_path.reduce(hash) { |current, key| current[key] ||= {} }
        target[last_key] = value
      end

      # Normalize key path to array format
      #
      # @param key_path [String, Symbol, Array] Key path in various formats
      # @return [Array] Normalized key path array
      #
      def normalize_key_path(key_path)
        case key_path
        when Array then key_path.map(&:to_sym)
        when String then key_path.split(".").map(&:to_sym)
        else [ key_path.to_sym ]
        end
      end

      # Deep merge two hashes
      #
      # @param base [Hash] Base hash
      # @param override [Hash] Override hash
      # @return [Hash] Merged hash
      #
      def deep_merge(base, override)
        base.merge(override) do |_key, base_val, override_val|
          if base_val.is_a?(Hash) && override_val.is_a?(Hash)
            deep_merge(base_val, override_val)
          else
            override_val
          end
        end
      end

      # Deep duplicate an object
      #
      # @param obj [Object] Object to duplicate
      # @return [Object] Deep duplicated object
      #
      def deep_dup(obj)
        case obj
        when Hash
          obj.transform_values { |value| deep_dup(value) }
        when Array
          obj.map { |item| deep_dup(item) }
        else
          obj.respond_to?(:dup) ? obj.dup : obj
        end
      end

      # Symbolize keys recursively in a hash
      #
      # @param obj [Object] Object to symbolize
      # @return [Object] Object with symbolized keys
      #
      def symbolize_keys_recursively(obj)
        case obj
        when Hash
          obj.transform_keys(&:to_sym).transform_values { |value| symbolize_keys_recursively(value) }
        when Array
          obj.map { |item| symbolize_keys_recursively(item) }
        else
          obj
        end
      end

      # Detect current Rails environment
      #
      # @return [String] Environment name
      #
      def detect_environment
        return Rails.env if defined?(Rails) && Rails.respond_to?(:env)
        ENV["RAILS_ENV"] || ENV["RACK_ENV"] || "development"
      end

      # Get default configuration file path
      #
      # @return [String] Default config file path
      #
      def default_config_file_path
        if defined?(Rails) && Rails.respond_to?(:root)
          Rails.root.join("config", "zero_generator.yml").to_s
        else
          File.join(Dir.pwd, "config", "zero_generator.yml")
        end
      end

      # Ensure configuration directory exists
      #
      # @param file_path [String] Configuration file path
      #
      def ensure_config_directory_exists(file_path)
        config_dir = File.dirname(file_path)
        FileUtils.mkdir_p(config_dir) unless Dir.exist?(config_dir)
      end

      # Validation methods

      def validate_required_keys
        required_keys = [ :excluded_tables, :output, :file_operations, :generator_options ]
        missing_keys = required_keys - @configuration.keys

        if missing_keys.any?
          raise ValidationError, "Missing required configuration keys: #{missing_keys.join(', ')}"
        end
      end

      def validate_excluded_tables
        unless excluded_tables.is_a?(Array)
          raise ValidationError, "excluded_tables must be an array"
        end

        excluded_tables.each do |table|
          unless table.is_a?(String) && !table.empty?
            raise ValidationError, "excluded_tables must contain non-empty strings"
          end
        end
      end

      def validate_output_paths
        output_config.each do |key, path|
          next unless path.is_a?(String)

          if path.empty?
            raise ValidationError, "Output path #{key} cannot be empty"
          end

          # Validate path is relative (for security), unless using generator options
          if Pathname.new(path).absolute? && !@using_generator_options
            raise ValidationError, "Output path #{key} should be relative, got: #{path}"
          end
        end
      end

      def validate_file_operations
        file_ops = get_config_value(:file_operations)

        [ :enable_prettier, :enable_semantic_comparison, :create_directories, :force_overwrite ].each do |key|
          value = file_ops[key]
          unless [ true, false ].include?(value)
            raise ValidationError, "file_operations.#{key} must be a boolean, got: #{value.class}"
          end
        end
      end

      def validate_performance_settings
        performance = get_config_value(:performance)

        unless performance[:cache_ttl].is_a?(Integer) && performance[:cache_ttl] > 0
          raise ValidationError, "performance.cache_ttl must be a positive integer"
        end

        unless performance[:max_cache_entries].is_a?(Integer) && performance[:max_cache_entries] > 0
          raise ValidationError, "performance.max_cache_entries must be a positive integer"
        end
      end

      # Merge multiple configuration hashes
      #
      # @param configs [Array<Hash>] Configuration hashes to merge
      # @return [Hash] Merged configuration hash
      #
      def merge_configurations(*configs)
        configs.reduce({}) do |merged, config|
          deep_merge(merged, config || {})
        end
      end
    end
  end
end
