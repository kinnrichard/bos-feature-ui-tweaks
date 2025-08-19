# frozen_string_literal: true

module ZeroSchemaGenerator
  class PolymorphicIntrospector
    def initialize
      @connection = ActiveRecord::Base.connection
      load_all_models # Ensure all models are loaded
    end

    # Discovers all polymorphic associations from Rails models and database
    # Returns a complete configuration hash for YAML export
    def discover_polymorphic_types
      Rails.logger.info "🔍 Discovering polymorphic associations from Rails models..."

      polymorphic_associations = discover_polymorphic_associations
      polymorphic_config = {}
      statistics = {
        discovered_at: Time.current.iso8601,
        total_associations: 0,
        total_potential_types: 0,
        total_discovered_types: 0,
        associations_with_data: 0,
        sti_patterns: []
      }

      polymorphic_associations.each do |table_name, associations|
        associations.each do |association|
          config_key = "#{table_name}.#{association[:name]}"
          statistics[:total_associations] += 1

          # Get potential types from Rails model analysis
          potential_types = discover_potential_types_from_models(association[:name])

          # Also query database for actual usage (for statistics)
          discovered_types = query_polymorphic_types(table_name, association)

          if discovered_types.any?
            statistics[:associations_with_data] += 1
            statistics[:total_discovered_types] += discovered_types.length
          end

          statistics[:total_potential_types] += potential_types.length

          # Map Rails class names to table names
          potential_mapped = map_types_to_tables(potential_types, statistics)
          discovered_mapped = map_types_to_tables(discovered_types, statistics)

          polymorphic_config[config_key] = {
            table: table_name,
            association: association[:name],
            type_column: association[:type_column],
            id_column: association[:id_column],
            potential_types: potential_types,  # From model analysis - used for generation
            discovered_types: discovered_types,  # From database - for information
            mapped_tables: potential_mapped[:tables],  # Use potential for generation
            discovered_tables: discovered_mapped[:tables],  # Keep discovered for reference
            sti_patterns: potential_mapped[:sti_patterns],
            statistics: {
              total_records: count_polymorphic_records(table_name, association),
              unique_discovered_types: discovered_types.length,
              potential_types_count: potential_types.length,
              last_seen: get_last_seen_timestamp(table_name, association),
              first_seen: get_first_seen_timestamp(table_name, association)
            }
          }
        end
      end

      {
        metadata: {
          generated_at: Time.current.iso8601,
          rails_environment: Rails.env.to_s,
          database_adapter: @connection.adapter_name,
          schema_version: current_schema_version
        },
        statistics: statistics,
        polymorphic_associations: polymorphic_config
      }
    end

    # Export configuration to YAML file
    def export_to_yaml(config_data, output_path = nil)
      output_path ||= Rails.root.join("config", "zero_polymorphic_types.yml")

      # Ensure output directory exists
      FileUtils.mkdir_p(File.dirname(output_path))

      # Add header comment to YAML
      yaml_content = generate_yaml_header + config_data.to_yaml

      File.write(output_path, yaml_content)

      Rails.logger.info "✅ Polymorphic configuration exported to #{output_path}"

      {
        config_path: output_path,
        associations_count: config_data.dig(:statistics, :total_associations) || 0,
        types_count: config_data.dig(:statistics, :total_types) || 0,
        exported_at: Time.current.iso8601
      }
    end

    # Load configuration from YAML file
    def self.load_from_yaml(config_path = nil)
      config_path ||= Rails.root.join("config", "zero_polymorphic_types.yml")

      return {} unless File.exist?(config_path)

      YAML.load_file(config_path) || {}
    rescue Psych::SyntaxError => e
      Rails.logger.error "Failed to parse polymorphic configuration: #{e.message}"
      {}
    end

    # Generate summary report of discovered types
    def generate_discovery_report(config_data)
      stats = config_data[:statistics]
      associations = config_data[:polymorphic_associations]

      report = []
      report << "="*60
      report << "POLYMORPHIC DISCOVERY REPORT"
      report << "="*60
      report << "Generated at: #{config_data[:metadata][:generated_at]}"
      report << "Environment: #{config_data[:metadata][:rails_environment]}"
      report << ""
      report << "SUMMARY:"
      report << "- Total associations: #{stats[:total_associations]}"
      report << "- Associations with data: #{stats[:associations_with_data]}"
      report << "- Total unique types: #{stats[:total_types]}"
      report << "- STI patterns detected: #{stats[:sti_patterns].length}"
      report << ""

      if stats[:sti_patterns].any?
        report << "STI PATTERNS:"
        stats[:sti_patterns].each do |sti|
          report << "- #{sti[:base_class]} → #{sti[:subclasses].join(', ')}"
        end
        report << ""
      end

      report << "ASSOCIATIONS:"
      associations.each do |key, config|
        report << "#{key}:"
        report << "  Database types: #{config[:discovered_types].join(', ')}"
        report << "  Mapped tables: #{config[:mapped_tables].join(', ')}"
        report << "  Records: #{config[:statistics][:total_records]}"
        report << "  Type count: #{config[:statistics][:unique_types]}"

        if config[:statistics][:last_seen]
          report << "  Last activity: #{config[:statistics][:last_seen]}"
        end
        report << ""
      end

      report.join("\n")
    end

    private

    def discover_polymorphic_associations
      Rails.logger.info "📋 Scanning Rails models for polymorphic associations..."

      polymorphic_associations = {}

      discover_models.each do |model_class|
        next unless model_class.table_exists?

        table_name = model_class.table_name

        model_class.reflections.each do |name, reflection|
          if reflection.macro == :belongs_to && reflection.polymorphic?
            polymorphic_associations[table_name] ||= []
            polymorphic_associations[table_name] << {
              name: name,
              type_column: reflection.foreign_type,
              id_column: reflection.foreign_key,
              model_class: model_class.name
            }
          end
        end
      end

      Rails.logger.info "🔍 Found #{polymorphic_associations.values.flatten.length} polymorphic associations across #{polymorphic_associations.keys.length} tables"

      polymorphic_associations
    end

    def discover_models
      # Manually discover models to avoid Zeitwerk issues with generators
      model_names = %w[
        User Client Job Task Person Device Note ActivityLog ContactMethod
        ScheduledDateTime JobAssignment JobPerson PeopleGroup PeopleGroupMembership
        FrontContact FrontTag FrontInbox FrontConversation FrontMessage FrontAttachment
        FrontConversationTag FrontMessageRecipient FrontConversationInbox FrontSyncLog
        FrontTeammate FrontTicket FrontConversationTicket ParsedEmail ClientFrontConversation
        PersonFrontConversation UniqueId JobTarget RefreshToken RevokedToken
      ]

      models = []
      model_names.each do |name|
        begin
          model_class = Object.const_get(name)
          if model_class < ActiveRecord::Base && model_class.table_exists?
            models << model_class
          end
        rescue NameError, ActiveRecord::StatementInvalid => e
          Rails.logger.debug "Skipping model #{name}: #{e.message}"
        end
      end

      Rails.logger.info "🔍 Discovered #{models.length} ActiveRecord models for analysis"
      models
    end

    def query_polymorphic_types(table_name, association)
      type_column = association[:type_column]

      begin
        # Query database for actual polymorphic type values
        types = @connection.select_values(
          "SELECT DISTINCT #{type_column} FROM #{table_name} WHERE #{type_column} IS NOT NULL ORDER BY #{type_column}"
        )

        Rails.logger.debug "📊 #{table_name}.#{association[:name]} has types: #{types.join(', ')}"

        types
      rescue ActiveRecord::StatementInvalid => e
        Rails.logger.warn "⚠️ Could not query types for #{table_name}.#{type_column}: #{e.message}"
        []
      end
    end

    def map_types_to_tables(type_values, statistics)
      tables = []
      sti_patterns = []

      type_values.each do |type_value|
        # Handle STI patterns (e.g., "Task::SubTask" → "tasks")
        if type_value.include?("::")
          base_class, subclass = type_value.split("::", 2)
          sti_pattern = find_or_create_sti_pattern(statistics[:sti_patterns], base_class)
          sti_pattern[:subclasses] << subclass unless sti_pattern[:subclasses].include?(subclass)

          # Use base class table name for STI
          table_name = base_class.tableize
        else
          table_name = type_value.tableize
        end

        tables << table_name unless tables.include?(table_name)
      end

      {
        tables: tables.sort,
        sti_patterns: sti_patterns
      }
    end

    def find_or_create_sti_pattern(sti_patterns, base_class)
      pattern = sti_patterns.find { |p| p[:base_class] == base_class }

      unless pattern
        pattern = { base_class: base_class, subclasses: [] }
        sti_patterns << pattern
      end

      pattern
    end

    def count_polymorphic_records(table_name, association)
      type_column = association[:type_column]

      begin
        @connection.select_value(
          "SELECT COUNT(*) FROM #{table_name} WHERE #{type_column} IS NOT NULL"
        ).to_i
      rescue ActiveRecord::StatementInvalid => e
        Rails.logger.warn "⚠️ Could not count records for #{table_name}.#{type_column}: #{e.message}"
        0
      end
    end

    def get_last_seen_timestamp(table_name, association)
      type_column = association[:type_column]

      begin
        # Try common timestamp columns
        timestamp_columns = %w[updated_at created_at]
        timestamp_column = timestamp_columns.find do |col|
          @connection.columns(table_name).any? { |c| c.name == col }
        end

        return nil unless timestamp_column

        result = @connection.select_value(
          "SELECT MAX(#{timestamp_column}) FROM #{table_name} WHERE #{type_column} IS NOT NULL"
        )

        result&.iso8601
      rescue ActiveRecord::StatementInvalid => e
        Rails.logger.warn "⚠️ Could not get last seen timestamp for #{table_name}.#{type_column}: #{e.message}"
        nil
      end
    end

    def get_first_seen_timestamp(table_name, association)
      type_column = association[:type_column]

      begin
        # Try common timestamp columns
        timestamp_columns = %w[created_at updated_at]
        timestamp_column = timestamp_columns.find do |col|
          @connection.columns(table_name).any? { |c| c.name == col }
        end

        return nil unless timestamp_column

        result = @connection.select_value(
          "SELECT MIN(#{timestamp_column}) FROM #{table_name} WHERE #{type_column} IS NOT NULL"
        )

        result&.iso8601
      rescue ActiveRecord::StatementInvalid => e
        Rails.logger.warn "⚠️ Could not get first seen timestamp for #{table_name}.#{type_column}: #{e.message}"
        nil
      end
    end

    def current_schema_version
      begin
        @connection.select_value("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1")
      rescue ActiveRecord::StatementInvalid
        "unknown"
      end
    end

    def generate_yaml_header
      <<~YAML
        # Zero.js Polymorphic Types Configuration
        # Auto-generated by PolymorphicIntrospector - DO NOT EDIT MANUALLY
        ##{' '}
        # This file contains discovered polymorphic associations and their actual database types.
        # Used by the Zero schema generator to create accurate polymorphic relationships.
        #
        # To regenerate: rails zero:discover_polymorphic_types
        # Generated: #{Time.current.iso8601}

      YAML
    end

    # Discover potential polymorphic types by analyzing Rails models
    # This finds all models that could potentially be used with a polymorphic association
    def discover_potential_types_from_models(association_name)
      potential_types = []

      # Special handling for known concerns
      case association_name.to_s
      when "loggable"
        # Find all models that include the Loggable concern
        potential_types = find_models_with_concern("Loggable")
      when "notable"
        # Find all models with has_many :notes, as: :notable
        potential_types = find_models_with_polymorphic_has_many("notes", "notable")
      when "schedulable"
        # Find all models with has_many :scheduled_date_times, as: :schedulable
        potential_types = find_models_with_polymorphic_has_many("scheduled_date_times", "schedulable")
      when "target"
        # JobTarget can target various models - check common patterns
        potential_types = find_potential_target_models
      when "parseable"
        # Find models that can have parsed emails
        potential_types = find_models_with_polymorphic_has_many("parsed_emails", "parseable")
      when "author"
        # FrontMessage author can be FrontContact or FrontTeammate (from comment in model)
        potential_types = [ "FrontContact", "FrontTeammate" ]
      when "identifiable"
        # UniqueId can identify various models
        potential_types = find_models_with_polymorphic_has_many("unique_ids", "identifiable")
      else
        # Generic discovery - look for has_many associations
        potential_types = find_models_with_polymorphic_association(association_name)
      end

      Rails.logger.info "📊 Found potential types for '#{association_name}': #{potential_types.join(', ')}"
      potential_types
    end

    # Find all models that include a specific concern
    def find_models_with_concern(concern_name)
      models_with_concern = []

      all_models.each do |model|
        if model.included_modules.any? { |mod| mod.name == concern_name }
          models_with_concern << model.name
        end
      end

      models_with_concern.sort
    end

    # Find all models that have a specific polymorphic has_many association
    def find_models_with_polymorphic_has_many(association_table, as_name)
      models_with_association = []

      all_models.each do |model|
        if model.reflect_on_all_associations(:has_many).any? { |assoc|
          assoc.name.to_s == association_table && assoc.options[:as]&.to_s == as_name
        }
          models_with_association << model.name
        end
      end

      models_with_association.sort
    end

    # Find potential target models for JobTarget
    def find_potential_target_models
      # Based on common patterns, JobTarget typically targets:
      # Clients, People, PeopleGroups
      [ "Client", "Person", "PeopleGroup" ]
    end

    # Generic discovery of models with polymorphic associations
    def find_models_with_polymorphic_association(association_name)
      models_with_association = []

      all_models.each do |model|
        # Check for has_many with as: option
        if model.reflect_on_all_associations(:has_many).any? { |assoc|
          assoc.options[:as]&.to_s == association_name.to_s
        }
          models_with_association << model.name
        end
      end

      models_with_association.sort
    end

    # Get all loaded models (cached)
    def all_models
      @all_models ||= begin
        load_all_models
        ActiveRecord::Base.descendants.select { |model|
          model.name && !model.abstract_class? && model.table_exists?
        }
      end
    end

    # Ensure all models are loaded
    def load_all_models
      # Load all models from app/models directory
      Dir.glob(Rails.root.join("app", "models", "**", "*.rb")).each do |file|
        require_dependency file unless file.include?("/concerns/")
      end

      # Also load concerns as they might define associations
      Dir.glob(Rails.root.join("app", "models", "concerns", "**", "*.rb")).each do |file|
        require_dependency file
      end
    rescue => e
      Rails.logger.warn "⚠️ Error loading models: #{e.message}"
    end
  end
end
