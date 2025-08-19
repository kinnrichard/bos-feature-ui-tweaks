# frozen_string_literal: true

module Zero
  module ActiveModels
    # Analyzes Rails models to discover polymorphic associations
    # Used by the generator to create accurate TypeScript polymorphic declarations
    class PolymorphicModelAnalyzer
      def initialize
        @models_loaded = false
        ensure_models_loaded
      end

      # Get all polymorphic associations for a given table
      def polymorphic_associations_for_table(table_name)
        associations = []

        # Find the model class for this table
        model_class = find_model_for_table(table_name)
        return associations unless model_class

        # Find all belongs_to polymorphic associations
        model_class.reflect_on_all_associations(:belongs_to).each do |association|
          next unless association.options[:polymorphic]

          association_name = association.name.to_s
          type_field = association.foreign_type || "#{association_name}_type"
          id_field = association.foreign_key || "#{association_name}_id"

          # Discover potential types from model analysis
          potential_types = discover_potential_types_for(association_name)

          next unless potential_types.any?

          associations << {
            name: association_name,
            type_field: type_field,
            id_field: id_field,
            allowed_types: potential_types,
            mapped_tables: map_types_to_tables(potential_types)
          }
        end

        associations
      end

      private

      # Discover potential types by analyzing Rails models
      def discover_potential_types_for(association_name)
        potential_types = []

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
          # JobTarget can target various models - based on common patterns
          potential_types = [ "Client", "Person", "PeopleGroup" ]
        when "parseable"
          # Find models that can have parsed emails
          potential_types = find_models_with_polymorphic_has_many("parsed_emails", "parseable")
        when "author"
          # FrontMessage author can be FrontContact or FrontTeammate
          potential_types = [ "FrontContact", "FrontTeammate" ]
        when "identifiable"
          # UniqueId can identify various models
          potential_types = find_models_with_polymorphic_has_many("unique_ids", "identifiable")
        else
          # Generic discovery - look for has_many associations
          potential_types = find_models_with_polymorphic_has_many_generic(association_name)
        end

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
          model.reflect_on_all_associations(:has_many).each do |assoc|
            if assoc.name.to_s == association_table && assoc.options[:as]&.to_s == as_name
              models_with_association << model.name
            end
          end
        end

        models_with_association.sort
      end

      # Generic discovery for any polymorphic association
      def find_models_with_polymorphic_has_many_generic(as_name)
        models_with_association = []

        all_models.each do |model|
          model.reflect_on_all_associations(:has_many).each do |assoc|
            if assoc.options[:as]&.to_s == as_name.to_s
              models_with_association << model.name
            end
          end
        end

        models_with_association.sort
      end

      # Map Rails model names to table names
      def map_types_to_tables(type_names)
        type_names.map do |type_name|
          model_class = type_name.constantize rescue nil
          next unless model_class
          next unless model_class < ActiveRecord::Base

          model_class.table_name
        end.compact.uniq.sort
      end

      # Find model class for a given table name
      def find_model_for_table(table_name)
        all_models.find { |model| model.table_name == table_name }
      end

      # Get all loaded models (cached)
      def all_models
        @all_models ||= begin
          ensure_models_loaded
          ActiveRecord::Base.descendants.select { |model|
            model.name && !model.abstract_class? && model.table_exists?
          }
        end
      end

      # Ensure all models are loaded
      def ensure_models_loaded
        return if @models_loaded

        # In Rails 8.0 with Zeitwerk, only eager load the models directory
        if !Rails.application.config.eager_load
          Rails.autoloaders.main.eager_load_dir(Rails.root.join("app/models"))
        end

        @models_loaded = true
      rescue => e
        Rails.logger.warn "⚠️ Error loading models: #{e.message}"
      end
    end
  end
end
