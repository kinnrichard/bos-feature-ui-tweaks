# frozen_string_literal: true

module ZeroSchemaGenerator
  autoload :RailsSchemaIntrospector, "zero_schema_generator/rails_schema_introspector"
  autoload :TypeMapper, "zero_schema_generator/type_mapper"
  autoload :Generator, "zero_schema_generator/generator"
  autoload :Config, "zero_schema_generator/config"
  autoload :MutationConfig, "zero_schema_generator/mutation_config"
  autoload :MutationGenerator, "zero_schema_generator/mutation_generator"
  autoload :PolymorphicIntrospector, "zero_schema_generator/polymorphic_introspector"
  autoload :PolymorphicDeclarationCollector, "zero_schema_generator/polymorphic_declaration_collector"

  class << self
    def generate_schema(config_path: nil)
      config = Config.load_from_file(config_path)
      generator = Generator.new(config.to_hash["zero_generator"])
      generator.generate_schema
    end

    def generate_mutations(config_path: nil, options: {})
      config = if config_path && File.exist?(config_path)
        MutationConfig.load_from_file(config_path)
      else
        MutationConfig.new
      end

      # Apply options to config
      config.dry_run = options[:dry_run] if options.key?(:dry_run)
      config.force_generation = options[:force] if options.key?(:force)

      generator = MutationGenerator.new(config)
      generator.generate_mutations(options)
    end

    def create_mutations_config(output_path = nil)
      output_path ||= MutationConfig.default_config_path

      config = MutationConfig.new
      # Add some example customizations
      config.exclude_patterns = {
        "versions" => [ "soft_deletion", "positioning" ],
        "schema_migrations" => [ "soft_deletion" ]
      }
      config.custom_naming = {
        "softDelete" => "archive",
        "restore" => "unarchive"
      }

      config.save_to_file(output_path)
      puts "Sample mutation configuration created at #{output_path}"
    end

    def discover_polymorphic_types(output_path: nil)
      introspector = PolymorphicIntrospector.new
      config_data = introspector.discover_polymorphic_types

      export_result = introspector.export_to_yaml(config_data, output_path)

      puts introspector.generate_discovery_report(config_data)
      puts "📝 Configuration exported to: #{export_result[:config_path]}"

      {
        config_data: config_data,
        export_result: export_result,
        discovered_at: Time.current
      }
    end

    def validate_schema(schema_path = nil)
      config = Config.load_from_file
      schema_path ||= config.schema_path

      unless File.exist?(schema_path)
        return {
          valid: false,
          errors: [ "Schema file not found at #{schema_path}" ]
        }
      end

      schema_content = File.read(schema_path)
      Generator.validate_schema(schema_content)
    end

    def create_sample_config(output_path = nil)
      output_path ||= Rails.root.join("config", "zero_generator.yml")

      config = Config.new
      # Add some example customizations
      config.type_overrides = {
        "jobs.status" => "string()",
        "tasks.position" => "number()"
      }

      config.field_mappings = {
        "notes.notable" => {
          "strategy" => "union_types",
          "types" => %w[job task client]
        }
      }

      config.save_to_file(output_path)
      puts "Sample configuration created at #{output_path}"
    end
  end
end
