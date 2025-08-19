# frozen_string_literal: true

module ZeroSchemaGenerator
  class MutationConfig
    attr_accessor :exclude_tables, :exclude_patterns, :custom_naming, :output_directory,
                  :dry_run, :force_generation, :incremental_generation

    def initialize
      @exclude_tables = default_excluded_tables
      @exclude_patterns = {}
      @custom_naming = default_custom_naming
      @output_directory = default_output_directory
      @dry_run = false
      @force_generation = false
      @incremental_generation = true
    end

    def self.load_from_file(file_path = nil)
      file_path ||= default_config_path

      if File.exist?(file_path)
        config_data = JSON.parse(File.read(file_path))
        from_hash(config_data)
      else
        new
      end
    end

    def self.from_hash(hash)
      config = new
      config.exclude_tables = hash["excludeTables"] || config.exclude_tables
      config.exclude_patterns = hash["excludePatterns"] || {}
      config.custom_naming = hash["customNaming"] || config.custom_naming
      config.output_directory = hash["outputDirectory"] || config.output_directory
      config.dry_run = hash["dryRun"] || false
      config.force_generation = hash["forceGeneration"] || false
      config.incremental_generation = hash["incrementalGeneration"] != false # default true
      config
    end

    def to_hash
      {
        "excludeTables" => @exclude_tables,
        "excludePatterns" => @exclude_patterns,
        "customNaming" => @custom_naming,
        "outputDirectory" => @output_directory,
        "dryRun" => @dry_run,
        "forceGeneration" => @force_generation,
        "incrementalGeneration" => @incremental_generation
      }
    end

    def save_to_file(file_path = nil)
      file_path ||= self.class.default_config_path
      FileUtils.mkdir_p(File.dirname(file_path))
      File.write(file_path, JSON.pretty_generate(to_hash))
    end

    def self.default_config_path
      Rails.root.join("frontend", "src", "lib", "zero", ".generation-config.json")
    end

    def should_exclude_table?(table_name)
      @exclude_tables.include?(table_name)
    end

    def should_exclude_pattern?(table_name, pattern_type)
      table_exclusions = @exclude_patterns[table_name] || []
      table_exclusions.include?(pattern_type.to_s)
    end

    def get_custom_name(standard_name)
      @custom_naming[standard_name] || standard_name
    end

    def validate_configuration
      errors = []
      warnings = []

      # Validate output directory
      unless Dir.exist?(@output_directory)
        errors << "Output directory does not exist: #{@output_directory}"
      end

      unless File.writable?(@output_directory)
        errors << "Output directory is not writable: #{@output_directory}"
      end

      # Validate Zero schema exists
      zero_schema_path = File.join(@output_directory, "generated-schema.ts")
      unless File.exist?(zero_schema_path)
        warnings << "Zero schema not found at #{zero_schema_path}. Run 'rails zero:generate_schema' first."
      end

      # Validate exclude patterns reference valid pattern types
      valid_patterns = [ :soft_deletion, :positioning, :normalized_fields, :timestamp_pairs, :enums, :polymorphic ]
      @exclude_patterns.each do |table_name, patterns|
        invalid_patterns = patterns.map(&:to_sym) - valid_patterns
        if invalid_patterns.any?
          warnings << "Invalid pattern types for #{table_name}: #{invalid_patterns.join(', ')}"
        end
      end

      # Validate custom naming keys
      valid_naming_keys = %w[softDelete restore moveAfter moveBefore moveToTop moveToBottom]
      invalid_naming = @custom_naming.keys - valid_naming_keys
      if invalid_naming.any?
        warnings << "Invalid custom naming keys: #{invalid_naming.join(', ')}"
      end

      {
        valid: errors.empty?,
        errors: errors,
        warnings: warnings
      }
    end

    def detect_existing_mutation_files
      existing_files = []

      # Scan for existing mutation files
      pattern = File.join(@output_directory, "*.ts")
      Dir.glob(pattern).each do |file_path|
        next if file_path.include?("generated-schema.ts")
        next if file_path.include?("schema.ts")
        next if file_path.include?("client.ts")
        next if file_path.include?("hooks.ts")
        next if file_path.include?("index.ts")

        existing_files << {
          path: file_path,
          name: File.basename(file_path, ".ts"),
          size: File.size(file_path),
          modified: File.mtime(file_path)
        }
      end

      existing_files
    end

    def get_generation_manifest_path
      File.join(@output_directory, ".generation-manifest.json")
    end

    def load_generation_manifest
      manifest_path = get_generation_manifest_path
      return {} unless File.exist?(manifest_path)

      begin
        JSON.parse(File.read(manifest_path))
      rescue JSON::ParserError
        {}
      end
    end

    def save_generation_manifest(manifest_data)
      manifest_path = get_generation_manifest_path
      File.write(manifest_path, JSON.pretty_generate(manifest_data))
    end

    def should_regenerate_table?(table_name, patterns)
      return true unless @incremental_generation

      manifest = load_generation_manifest
      table_manifest = manifest[table_name]

      return true unless table_manifest

      # Check if patterns have changed
      current_pattern_hash = Digest::SHA256.hexdigest(patterns.to_json)
      table_manifest["pattern_hash"] != current_pattern_hash
    end

    def update_table_manifest(table_name, patterns, generated_files)
      manifest = load_generation_manifest

      manifest[table_name] = {
        "pattern_hash" => Digest::SHA256.hexdigest(patterns.to_json),
        "generated_at" => Time.current.iso8601,
        "generated_files" => generated_files,
        "file_hashes" => {}
      }

      # Calculate file hashes for conflict detection
      generated_files.each do |file_path|
        if File.exist?(file_path)
          content = File.read(file_path)
          manifest[table_name]["file_hashes"][file_path] = Digest::SHA256.hexdigest(content)
        end
      end

      save_generation_manifest(manifest)
    end

    private

    def default_excluded_tables
      # Only exclude system tables that would never need mutations
      %w[
        ar_internal_metadata
        schema_migrations
      ]
    end

    def default_custom_naming
      {
        # Default naming - can be overridden
        # "softDelete" => "archive",
        # "restore" => "unarchive"
      }
    end

    def default_output_directory
      Rails.root.join("frontend", "src", "lib", "zero").to_s
    end
  end
end
