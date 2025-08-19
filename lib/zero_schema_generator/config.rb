# frozen_string_literal: true

module ZeroSchemaGenerator
  class Config
    attr_accessor :excluded_tables, :type_overrides, :field_mappings, :output, :preserve_customizations

    def initialize
      @excluded_tables = default_excluded_tables
      @type_overrides = {}
      @field_mappings = {}
      @output = default_output_config
      @preserve_customizations = []
    end

    def self.load_from_file(file_path = nil)
      file_path ||= Rails.root.join("config", "zero_generator.yml")

      if File.exist?(file_path)
        config_data = YAML.load_file(file_path)["zero_generator"] || {}
        from_hash(config_data)
      else
        new
      end
    end

    def self.from_hash(hash)
      config = new
      config.excluded_tables = hash["excluded_tables"] || config.excluded_tables
      config.type_overrides = hash["type_overrides"] || {}
      config.field_mappings = hash["field_mappings"] || {}
      config.output = (hash["output"] || {}).merge(config.output)
      config.preserve_customizations = hash["preserve_customizations"] || []
      config
    end

    def schema_path
      @output["schema_file"]
    end

    def types_path
      @output["types_file"]
    end

    def to_hash
      {
        "zero_generator" => {
          "excluded_tables" => @excluded_tables,
          "type_overrides" => @type_overrides,
          "field_mappings" => @field_mappings,
          "output" => @output,
          "preserve_customizations" => @preserve_customizations
        }
      }
    end

    def save_to_file(file_path = nil)
      file_path ||= Rails.root.join("config", "zero_generator.yml")
      File.write(file_path, to_hash.to_yaml)
    end

    private

    def default_excluded_tables
      %w[
        solid_cache_entries
        solid_queue_jobs
        solid_queue_blocked_executions
        solid_queue_claimed_executions
        solid_queue_failed_executions
        solid_queue_paused_executions
        solid_queue_ready_executions
        solid_queue_recurring_executions
        solid_queue_scheduled_executions
        solid_queue_semaphores
        solid_queue_processes
        solid_queue_pauses
        solid_queue_recurring_tasks
        solid_cable_messages
        refresh_tokens
        revoked_tokens
        unique_ids
        ar_internal_metadata
        schema_migrations
        versions
      ]
    end

    def default_output_config
      {
        "schema_file" => Rails.root.join("frontend", "src", "lib", "zero", "generated-schema.ts").to_s,
        "types_file" => Rails.root.join("frontend", "src", "lib", "types", "generated.ts").to_s
      }
    end
  end
end
