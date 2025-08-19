# frozen_string_literal: true

module Zero
  module Generators
    # Service class for processing Rails model relationships
    #
    # Uses constructor injection with explicit dependencies.
    # No service registry lookups, all dependencies are provided explicitly.
    class RelationshipProcessor
      # Initialize with explicit dependencies
      #
      # @param relationships [Hash] Relationship data from schema analysis
      # @param current_table_name [String] Name of the current table being processed
      # @param schema_introspector [Object] Optional schema introspector for additional queries
      def initialize(relationships, current_table_name, schema_introspector: nil)
        @relationships = relationships || {}
        @current_table_name = current_table_name
        @schema_introspector = schema_introspector
      end

      def process_all
        {
          properties: generate_properties,
          imports: generate_imports,
          exclusions: extract_exclusions,
          documentation: generate_documentation,
          registration: generate_registration
        }
      end

      def each_relationship(&block)
        return enum_for(:each_relationship) unless block_given?

        each_relationship_type do |type, relations, relation|
          next unless valid_relationship?(relation)
          next if excluded_table?(relation[:target_table])

          yield(type, relation, relationship_metadata(relation))
        end
      end

      private

      def generate_properties
        return "" unless has_relationships?

        properties = []
        each_relationship do |type, relation, metadata|
          case type
          when :belongs_to, :has_one
            properties << "  #{metadata[:property_name]}?: #{metadata[:target_class]}Data; // #{type.to_s.gsub('_', '_')}"
          when :has_many
            properties << "  #{metadata[:property_name]}?: #{metadata[:target_class]}Data[]; // has_many"
          end
        end

        properties.join("\n")
      end

      def generate_imports
        return "" unless has_relationships?

        import_classes = Set.new
        each_relationship do |_type, relation, metadata|
          # Skip self-referencing imports to avoid circular dependencies
          unless relation[:target_table] == @current_table_name
            import_classes << metadata[:target_class]
          end
        end

        return "" if import_classes.empty?

        imports = import_classes.map do |class_name|
          kebab_name = class_name.underscore.dasherize
          "\nimport type { #{class_name}Data } from './#{kebab_name}-data';"
        end

        imports.join("")
      end

      def extract_exclusions
        return "" unless has_relationships?

        names = []
        each_relationship do |_type, _relation, metadata|
          names << metadata[:property_name]
        end

        return "" if names.empty?
        ", '#{names.join("', '")}'"
      end

      def generate_documentation
        return "" unless has_relationships?

        docs = []
        docs << " * Relationships (loaded via includes()):"

        each_relationship do |type, relation, metadata|
          case type
          when :belongs_to
            docs << " * - #{metadata[:property_name]}: belongs_to #{metadata[:target_class]}"
          when :has_one
            docs << " * - #{metadata[:property_name]}: has_one #{metadata[:target_class]}"
          when :has_many
            if relation[:through]
              docs << " * - #{metadata[:property_name]}: has_many #{metadata[:target_class]}, through: #{relation[:through]}"
            else
              docs << " * - #{metadata[:property_name]}: has_many #{metadata[:target_class]}"
            end
          end
        end

        docs.join("\n")
      end

      def generate_registration
        relationship_metadata = []

        each_relationship do |type, _relation, metadata|
          relationship_type = case type
          when :belongs_to then "belongsTo"
          when :has_many then "hasMany"
          when :has_one then "hasOne"
          end

          relationship_metadata << "  #{metadata[:property_name]}: { type: '#{relationship_type}', model: '#{metadata[:target_class]}' }"
        end

        if relationship_metadata.any?
          metadata_string = relationship_metadata.join(",\n")
          <<~TYPESCRIPT.strip
            registerModelRelationships('#{@current_table_name}', {
            #{metadata_string},
            });
          TYPESCRIPT
        else
          "// No relationships defined for this model"
        end
      end

      def each_relationship_type
        [
          [ :belongs_to, @relationships[:belongs_to] ],
          [ :has_one, @relationships[:has_one] ],
          [ :has_many, @relationships[:has_many] ]
        ].each do |type, relations|
          next unless relations&.any?

          relations.each do |relation|
            yield(type, relations, relation)
          end
        end
      end

      def valid_relationship?(relation)
        relation[:target_table] && relation[:name]
      end

      def excluded_table?(table_name)
        ZeroSchemaGenerator::RailsSchemaIntrospector::EXCLUDED_TABLES.include?(table_name)
      end

      def relationship_metadata(relation)
        {
          target_class: relation[:target_table].singularize.camelize,
          property_name: relation[:name].to_s.camelize(:lower)
        }
      end

      def has_relationships?
        @relationships && (
          @relationships[:belongs_to]&.any? ||
          @relationships[:has_many]&.any? ||
          @relationships[:has_one]&.any?
        )
      end
    end
  end
end
