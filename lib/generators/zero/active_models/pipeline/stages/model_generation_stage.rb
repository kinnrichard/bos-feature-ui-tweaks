# frozen_string_literal: true

require_relative "../stage"

module Zero
  module Generators
    module Pipeline
      module Stages
        # ModelGenerationStage is responsible for generating TypeScript model files
        #
        # This stage handles the core model generation process, creating three types
        # of TypeScript files for each table:
        # - Data interface (TypeScript interface matching database schema)
        # - ActiveRecord model (mutations and server-side operations)
        # - ReactiveRecord model (client-side reactive queries)
        #
        # Key Responsibilities:
        # - Generate TypeScript interfaces from Rails schema data
        # - Create ActiveRecord model classes for mutations
        # - Create ReactiveRecord model classes for reactive queries
        # - Handle relationship mappings and type conversions
        # - Generate proper import statements and type exclusions
        # - Apply Rails to TypeScript type mapping
        # - Process template rendering with proper context
        #
        # Input: GenerationContext with schema data and relationships
        # Output: GenerationContext with generated TypeScript code in metadata
        #
        # The stage uses the service registry to access:
        # - TemplateRenderer for ERB template processing
        # - TypeMapper for Rails to TypeScript type conversion
        # - RelationshipProcessor for relationship handling
        # - PolymorphicModelAnalyzer for polymorphic associations
        # - DefaultValueConverter for default value processing
        #
        # @example Usage in pipeline
        #   pipeline = Pipeline.new(stages: [
        #     SchemaAnalysisStage.new(service_registry),
        #     ModelGenerationStage.new(service_registry),
        #     FormattingStage.new(service_registry)
        #   ])
        #
        # @example Generated files for User table
        #   types/user-data.ts        # UserData interface
        #   user.ts                   # User ActiveRecord model
        #   reactive-user.ts          # ReactiveUser model
        #
        class ModelGenerationStage < Stage
          # Model generation specific errors
          class ModelGenerationError < StandardError; end
          class TemplateRenderingError < ModelGenerationError; end
          class TypeMappingError < ModelGenerationError; end
          class RelationshipProcessingError < ModelGenerationError; end

          attr_reader :service_registry

          # Initialize ModelGenerationStage with service dependencies
          #
          # @param service_registry [ServiceRegistry] Registry providing template, type mapping, and other services
          #
          def initialize(service_registry)
            @service_registry = service_registry
            super()
          end

          # Process context by generating all TypeScript model files
          #
          # This is the main stage processing method that generates the three types
          # of TypeScript model files and stores the generated content in the context
          # metadata for subsequent pipeline stages to write to disk.
          #
          # @param context [GenerationContext] Input context with schema and relationship data
          # @return [GenerationContext] Context enriched with generated TypeScript content
          #
          # @raise [ModelGenerationError] If model generation fails at any stage
          #
          def process(context)
            validate_context!(context, [ :relationships, :patterns ])

            begin
              # Phase 1: Generate TypeScript data interface
              data_interface_content = generate_data_interface(context)

              # Phase 2: Generate ActiveRecord model
              active_model_content = generate_active_model(context)

              # Phase 3: Generate ReactiveRecord model
              reactive_model_content = generate_reactive_model(context)

              # Phase 4: Store generated content in context metadata
              generated_content = {
                data_interface: data_interface_content,
                active_model: active_model_content,
                reactive_model: reactive_model_content,
                filenames: context.typescript_filenames
              }

              # Phase 5: Add stage execution metadata
              enriched_context = context.with_metadata(
                generated_content: generated_content,
                generation_timestamp: Time.current.iso8601
              )

              add_stage_metadata(enriched_context, {
                files_generated: 3,
                data_interface_lines: count_lines(data_interface_content),
                active_model_lines: count_lines(active_model_content),
                reactive_model_lines: count_lines(reactive_model_content),
                relationships_processed: context.relationships.values.flatten.length,
                templates_rendered: 3
              })

            rescue StandardError => e
              raise Stage::StageError.new(
                stage: self,
                context: context,
                error: e
              )
            end
          end

          # Check if stage can run with the given context
          #
          # ModelGenerationStage requires table data, schema information,
          # and processed relationships to generate models properly.
          #
          # @param context [GenerationContext] Context to evaluate
          # @return [Boolean] True if context has required data for model generation
          #
          def can_run?(context)
            return false unless context.table
            return false unless context.table[:columns]
            return false unless context.table[:columns].any?
            return false unless context.respond_to?(:relationships)

            true
          end

          # Get stage description for logging and debugging
          #
          # @return [String] Brief description of what this stage does
          #
          def description
            "Generates TypeScript interfaces, ActiveRecord models, and ReactiveRecord models"
          end

          # Check if stage is idempotent (safe to run multiple times)
          #
          # @return [Boolean] True - model generation is idempotent
          #
          def idempotent?
            true
          end

          # Get stage execution priority
          #
          # @return [Integer] Priority value (30 = high priority, should run after schema analysis)
          #
          def priority
            30
          end

          private

          # Generate TypeScript data interface from table schema
          #
          # Creates a TypeScript interface that matches the database schema exactly,
          # including all columns and relationships with proper TypeScript types.
          #
          # @param context [GenerationContext] Generation context with table and relationship data
          # @return [String] Generated TypeScript interface content
          #
          # @raise [TemplateRenderingError] If template rendering fails
          #
          def generate_data_interface(context)
            template_context = build_data_interface_template_context(context)
            template_renderer = service_registry.get_service(:template_renderer)

            template_renderer.render("data_interface.ts.erb", template_context)
          rescue => e
            raise TemplateRenderingError, "Failed to generate data interface: #{e.message}"
          end

          # Generate ActiveRecord model for mutations and server operations
          #
          # Creates a TypeScript ActiveRecord model class with mutation capabilities,
          # relationships, and server-side operation support.
          #
          # @param context [GenerationContext] Generation context with table and relationship data
          # @return [String] Generated ActiveRecord model content
          #
          # @raise [TemplateRenderingError] If template rendering fails
          #
          def generate_active_model(context)
            template_context = build_active_model_template_context(context)
            template_renderer = service_registry.get_service(:template_renderer)

            template_renderer.render("active_model.ts.erb", template_context)
          rescue => e
            raise TemplateRenderingError, "Failed to generate active model: #{e.message}"
          end

          # Generate ReactiveRecord model for client-side reactive queries
          #
          # Creates a ReactiveRecord model class with reactive query capabilities,
          # real-time updates, and client-side data management.
          #
          # @param context [GenerationContext] Generation context with table and relationship data
          # @return [String] Generated ReactiveRecord model content
          #
          # @raise [TemplateRenderingError] If template rendering fails
          #
          def generate_reactive_model(context)
            template_context = build_reactive_model_template_context(context)
            template_renderer = service_registry.get_service(:template_renderer)

            template_renderer.render("reactive_model.ts.erb", template_context)
          rescue => e
            raise TemplateRenderingError, "Failed to generate reactive model: #{e.message}"
          end

          # Build template context for data interface generation
          #
          # Creates the context hash needed by the data_interface.ts.erb template,
          # including column properties, relationship data, and type exclusions.
          #
          # @param context [GenerationContext] Generation context
          # @return [Hash] Template context for ERB rendering
          #
          # @raise [TypeMappingError] If type mapping fails
          # @raise [RelationshipProcessingError] If relationship processing fails
          #
          def build_data_interface_template_context(context)
            current_table_name = context.table_name

            # Generate database column properties with proper TypeScript types
            column_properties = generate_column_properties(context.table[:columns])

            # Process relationships using RelationshipProcessor
            relationship_data = process_relationships(context.relationships, current_table_name)

            # Combine all properties
            all_properties = [ column_properties, relationship_data[:properties] ].reject(&:empty?).join("\n")

            # Generate type exclusions for Create/Update types
            base_exclusions = "'id', 'created_at', 'updated_at'"
            create_exclusions = "Omit<#{context.model_name}Data, #{base_exclusions}#{relationship_data[:exclusions]}>"
            update_exclusions = "Partial<Omit<#{context.model_name}Data, #{base_exclusions}#{relationship_data[:exclusions]}>>"

            {
              class_name: context.model_name,
              table: context.table,
              relationship_docs: relationship_data[:documentation],
              relationship_imports: relationship_data[:imports],
              all_properties: all_properties,
              create_exclusions: create_exclusions,
              update_exclusions: update_exclusions
            }
          end

          # Build template context for active model generation
          #
          # Creates the context hash needed by the active_model.ts.erb template,
          # including relationships, patterns, defaults, and polymorphic associations.
          #
          # @param context [GenerationContext] Generation context
          # @return [Hash] Template context for ERB rendering
          #
          def build_active_model_template_context(context)
            table_name = context.table_name
            class_name = context.model_name
            kebab_name = context.kebab_name
            model_name = table_name.singularize
            relationships = context.relationships
            patterns = context.patterns

            # Build discard gem scopes if present
            discard_scopes = build_discard_scopes(patterns, class_name)

            # Generate relationship import section
            relationship_import = generate_relationship_import(relationships)
            relationship_import_section = relationship_import.empty? ? "" : "\n#{relationship_import}"

            # Generate relationship registration
            relationship_registration = process_relationships(relationships, table_name)[:registration]

            # Generate defaults using DefaultValueConverter
            defaults_data = generate_defaults_data(table_name, context.table[:columns])

            # Get polymorphic configuration
            polymorphic_data = analyze_polymorphic_associations(table_name)

            {
              class_name: class_name,
              table_name: table_name,
              kebab_name: kebab_name,
              model_name: model_name,
              relationship_import_section: relationship_import_section,
              supports_discard: supports_discard?(patterns),
              discard_scopes: discard_scopes,
              relationship_registration: relationship_registration,
              has_defaults: defaults_data[:has_defaults],
              defaults_object: defaults_data[:defaults_object],
              polymorphic_import: polymorphic_data[:import],
              polymorphic_static_block: polymorphic_data[:static_block],
              has_polymorphic: polymorphic_data[:has_polymorphic]
            }
          end

          # Build template context for reactive model generation
          #
          # Creates the context hash needed by the reactive_model.ts.erb template.
          # Currently uses the same context as active model but could be extended
          # with reactive-specific configuration.
          #
          # @param context [GenerationContext] Generation context
          # @return [Hash] Template context for ERB rendering
          #
          def build_reactive_model_template_context(context)
            # Use same context as active model - could be extended for reactive-specific features
            build_active_model_template_context(context)
          end

          # Generate column properties with TypeScript types
          #
          # Converts Rails column definitions to TypeScript interface properties
          # with proper type mapping and nullability handling.
          #
          # @param columns [Array<Hash>] Array of column definitions
          # @return [String] Generated TypeScript property definitions
          #
          # @raise [TypeMappingError] If type mapping fails for any column
          #
          def generate_column_properties(columns)
            type_mapper = service_registry.get_service(:type_mapper)

            columns.map do |column|
              ts_type = type_mapper.map_rails_type_to_typescript(column[:type], column)
              nullable = column[:null] ? "?" : ""
              comment = column[:comment] ? " // #{column[:comment]}" : ""

              "  #{column[:name]}#{nullable}: #{ts_type};#{comment}"
            end.join("\n")
          rescue => e
            raise TypeMappingError, "Failed to generate column properties: #{e.message}"
          end

          # Process relationships using RelationshipProcessor service
          #
          # Generates relationship properties, imports, documentation, and registration
          # code using the RelationshipProcessor service.
          #
          # @param relationships [Hash] Relationship data (belongs_to, has_many, etc.)
          # @param table_name [String] Current table name for self-reference detection
          # @return [Hash] Processed relationship data
          #
          # @raise [RelationshipProcessingError] If relationship processing fails
          #
          def process_relationships(relationships, table_name)
            processor_factory = service_registry.get_service(:relationship_processor)
            processor = processor_factory.call(relationships, table_name)
            processor.process_all
          rescue => e
            raise RelationshipProcessingError, "Failed to process relationships: #{e.message}"
          end

          # Build discard gem scopes for soft deletion support
          #
          # Generates scope examples for models using the discard gem for soft deletion.
          #
          # @param patterns [Hash] Pattern detection results
          # @param class_name [String] Model class name
          # @return [String] Generated scope examples or empty string
          #
          def build_discard_scopes(patterns, class_name)
            return "" unless patterns[:soft_deletion]

            if patterns[:soft_deletion][:gem] == "discard"
              "\n * const discarded#{class_name}s = await #{class_name}.discarded().all();"
            else
              ""
            end
          end

          # Check if model supports discard gem
          #
          # @param patterns [Hash] Pattern detection results
          # @return [String] "true" or "false" string for template rendering
          #
          def supports_discard?(patterns)
            if patterns[:soft_deletion] && patterns[:soft_deletion][:gem] == "discard"
              "true"
            else
              "false"
            end
          end

          # Generate relationship import statements
          #
          # Creates import statements for relationship registration functionality
          # when relationships are present.
          #
          # @param relationships [Hash] Relationship data
          # @return [String] Import statement or empty string
          #
          def generate_relationship_import(relationships)
            has_relationships = relationships && (
              relationships[:belongs_to]&.any? ||
              relationships[:has_many]&.any? ||
              relationships[:has_one]&.any?
            )

            if has_relationships
              "import { registerModelRelationships } from './base/scoped-query-base';"
            else
              ""
            end
          end

          # Generate defaults data using DefaultValueConverter service
          #
          # Creates default value objects and metadata for model generation.
          #
          # @param table_name [String] Table name
          # @param columns [Array<Hash>] Column definitions
          # @return [Hash] Defaults data with has_defaults boolean and defaults_object
          #
          def generate_defaults_data(table_name, columns)
            default_value_converter = service_registry.get_service(:default_value_converter)
            defaults_object = default_value_converter.generate_defaults_object(table_name, columns)

            {
              has_defaults: !defaults_object.nil?,
              defaults_object: defaults_object
            }
          end

          # Analyze polymorphic associations using PolymorphicModelAnalyzer service
          #
          # Gets polymorphic association data and generates import/static block content.
          #
          # @param table_name [String] Table name
          # @return [Hash] Polymorphic data with import, static_block, and has_polymorphic
          #
          def analyze_polymorphic_associations(table_name)
            polymorphic_analyzer = service_registry.get_service(:polymorphic_model_analyzer)
            polymorphic_associations = polymorphic_analyzer.polymorphic_associations_for_table(table_name)
            has_polymorphic = polymorphic_associations.any?

            polymorphic_import = has_polymorphic ? "import { declarePolymorphicRelationships } from '../zero/polymorphic';" : ""
            polymorphic_static_block = generate_polymorphic_static_block(table_name, polymorphic_associations)

            {
              import: polymorphic_import,
              static_block: polymorphic_static_block,
              has_polymorphic: has_polymorphic
            }
          end

          # Generate polymorphic static block for TypeScript model
          #
          # Creates the static code block for polymorphic relationship declarations.
          #
          # @param table_name [String] Table name
          # @param polymorphic_associations [Array<Hash>] Polymorphic association data
          # @return [String] Generated static block code
          #
          def generate_polymorphic_static_block(table_name, polymorphic_associations)
            return "" unless polymorphic_associations.any?

            blocks = polymorphic_associations.map do |assoc|
              # Convert Rails model names to lowercase for TypeScript
              allowed_types = assoc[:allowed_types].map { |type| type.underscore.gsub("_", "") }

              <<~BLOCK

                // EP-0036: Polymorphic relationship declarations
                declarePolymorphicRelationships({
                  tableName: '#{table_name}',
                  belongsTo: {
                    #{assoc[:name]}: {
                    typeField: '#{assoc[:type_field]}',
                    idField: '#{assoc[:id_field]}',
                    allowedTypes: #{allowed_types.to_json}
                  }
                  }
                });
              BLOCK
            end

            blocks.join("\n")
          end

          # Count lines in generated content for metrics
          #
          # @param content [String] Generated content
          # @return [Integer] Number of lines
          #
          def count_lines(content)
            content.to_s.lines.count
          end
        end
      end
    end
  end
end
