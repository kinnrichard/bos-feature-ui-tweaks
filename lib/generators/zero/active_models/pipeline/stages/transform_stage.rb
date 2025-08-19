# frozen_string_literal: true

require_relative "../stage"

module Zero
  module Generators
    module Pipeline
      module Stages
        # TransformStage demonstrates context transformation in a pipeline
        #
        # This stage shows how to modify context data during pipeline execution.
        # It can transform table data, enhance schema information, or prepare
        # context for subsequent stages. This is a template for actual processing
        # stages that will transform generation data.
        #
        # Key Features:
        # - Transforms context data while preserving immutability
        # - Demonstrates conditional processing based on context
        # - Shows error handling for transformation failures
        # - Configurable transformation rules
        # - Preserves original data for debugging
        #
        # @example Usage in pipeline
        #   pipeline = Pipeline.new(stages: [
        #     ValidationStage.new,
        #     TransformStage.new(
        #       normalize_column_names: true,
        #       enhance_relationships: true
        #     ),
        #     GenerationStage.new
        #   ])
        #
        # @example Access transformed data
        #   result = pipeline.execute(context)
        #   transformed = result.metadata[:transformed_data]
        #   original = result.metadata[:original_data_backup]
        #
        class TransformStage < Stage
          # Custom error for transformation failures
          class TransformationError < StandardError; end

          attr_reader :transformation_rules, :preserve_original

          # Initialize TransformStage with transformation configuration
          #
          # @param normalize_column_names [Boolean] Whether to normalize column names
          # @param enhance_relationships [Boolean] Whether to enhance relationship data
          # @param add_computed_properties [Boolean] Whether to add computed properties
          # @param preserve_original [Boolean] Whether to backup original data
          # @param transformation_block [Proc] Custom transformation logic
          #
          def initialize(
            normalize_column_names: false,
            enhance_relationships: false,
            add_computed_properties: true,
            preserve_original: true,
            &transformation_block
          )
            @transformation_rules = {
              normalize_column_names: normalize_column_names,
              enhance_relationships: enhance_relationships,
              add_computed_properties: add_computed_properties
            }
            @preserve_original = preserve_original
            @custom_transformer = transformation_block
            super()
          end

          # Transform context data according to configured rules
          #
          # @param context [GenerationContext] Input context to transform
          # @return [GenerationContext] Context with transformed data
          #
          # @raise [StageError] If transformation fails
          #
          def process(context)
            transformation_start_time = Time.current

            begin
              # Preserve original data if requested
              preserved_context = preserve_original_data(context) if @preserve_original

              # Apply transformations
              transformed_context = context
              transformed_context = normalize_column_names(transformed_context) if @transformation_rules[:normalize_column_names]
              transformed_context = enhance_relationships(transformed_context) if @transformation_rules[:enhance_relationships]
              transformed_context = add_computed_properties(transformed_context) if @transformation_rules[:add_computed_properties]
              transformed_context = apply_custom_transformation(transformed_context) if @custom_transformer

              # Add transformation metadata
              transformation_metadata = {
                transformed: true,
                transformed_at: Time.current,
                transformation_duration: Time.current - transformation_start_time,
                transformation_rules: @transformation_rules.keys,
                original_data_preserved: @preserve_original
              }

              # Merge preserved data if available
              if preserved_context
                transformation_metadata.merge!(preserved_context.metadata)
              end

              add_stage_metadata(transformed_context, transformation_metadata)

            rescue StandardError => e
              # Wrap transformation errors with stage context
              raise Stage::StageError.new(
                stage: self,
                context: context,
                error: TransformationError.new("Data transformation failed: #{e.message}")
              )
            end
          end

          # TransformStage requires valid context with table data
          #
          # @param context [GenerationContext] Context to evaluate
          # @return [Boolean] True if context has transformable data
          #
          def can_run?(context)
            context.respond_to?(:table) &&
              context.table.is_a?(Hash) &&
              !context.table.empty?
          end

          # TransformStage is generally not idempotent
          #
          # @return [Boolean] False - transformations may compound
          #
          def idempotent?
            false
          end

          # TransformStage should run after validation
          #
          # @return [Integer] Medium priority (30)
          #
          def priority
            30
          end

          # Get stage description
          #
          # @return [String] Description of transformation stage functionality
          #
          def description
            "Transforms context data according to configured rules"
          end

          private

          # Preserve original context data for rollback/debugging
          #
          # @param context [GenerationContext] Context to preserve
          # @return [GenerationContext] Context with original data backed up
          #
          def preserve_original_data(context)
            backup_data = {
              original_table: context.table.dup,
              original_schema: context.schema.dup,
              original_relationships: context.relationships.dup,
              backed_up_at: Time.current
            }

            context.with_metadata(original_data_backup: backup_data)
          end

          # Normalize column names to standard format
          #
          # @param context [GenerationContext] Context with table data
          # @return [GenerationContext] Context with normalized column names
          #
          def normalize_column_names(context)
            normalized_table = context.table.dup

            normalized_table[:columns] = normalized_table[:columns].map do |column|
              normalized_column = column.dup
              normalized_column[:name] = column[:name].underscore
              normalized_column[:normalized_name] = column[:name].underscore.humanize
              normalized_column
            end

            context.class.new(
              table: normalized_table,
              schema: context.schema,
              relationships: context.relationships,
              options: context.options,
              metadata: context.metadata
            )
          end

          # Enhance relationship data with additional metadata
          #
          # @param context [GenerationContext] Context with relationships
          # @return [GenerationContext] Context with enhanced relationships
          #
          def enhance_relationships(context)
            enhanced_relationships = context.relationships.dup

            enhanced_relationships.each do |type, relations|
              enhanced_relationships[type] = relations.map do |relation|
                enhanced_relation = relation.dup
                enhanced_relation[:enhanced_at] = Time.current
                enhanced_relation[:relationship_type] = type
                enhanced_relation[:foreign_key] = infer_foreign_key(relation, type) if relation.is_a?(Hash)
                enhanced_relation
              end
            end

            context.with_relationships(enhanced_relationships)
          end

          # Add computed properties to context
          #
          # @param context [GenerationContext] Input context
          # @return [GenerationContext] Context with computed properties
          #
          def add_computed_properties(context)
            computed_properties = {
              column_count: context.table[:columns].size,
              has_primary_key: has_primary_key_column?(context.table),
              has_timestamps: has_timestamp_columns?(context.table),
              relationship_count: count_relationships(context.relationships),
              estimated_complexity: calculate_complexity_score(context)
            }

            context.with_metadata(computed_properties: computed_properties)
          end

          # Apply custom transformation block if provided
          #
          # @param context [GenerationContext] Input context
          # @return [GenerationContext] Context transformed by custom block
          #
          def apply_custom_transformation(context)
            @custom_transformer.call(context)
          end

          # Infer foreign key name for relationship
          #
          # @param relation [Hash] Relationship definition
          # @param type [Symbol] Relationship type
          # @return [String] Inferred foreign key name
          #
          def infer_foreign_key(relation, type)
            return relation[:foreign_key] if relation[:foreign_key]

            case type
            when :belongs_to
              "#{relation[:name]}_id"
            when :has_many, :has_one
              "#{relation[:name].to_s.singularize}_id"
            else
              nil
            end
          end

          # Check if table has primary key column
          #
          # @param table [Hash] Table definition
          # @return [Boolean] True if primary key exists
          #
          def has_primary_key_column?(table)
            table[:columns].any? { |col| col[:name] == "id" || col[:primary_key] }
          end

          # Check if table has timestamp columns
          #
          # @param table [Hash] Table definition
          # @return [Boolean] True if created_at/updated_at exist
          #
          def has_timestamp_columns?(table)
            timestamp_columns = table[:columns].map { |col| col[:name] }
            timestamp_columns.include?("created_at") && timestamp_columns.include?("updated_at")
          end

          # Count total relationships
          #
          # @param relationships [Hash] Relationships hash
          # @return [Integer] Total relationship count
          #
          def count_relationships(relationships)
            relationships.values.sum { |relations| relations.size }
          end

          # Calculate complexity score for context
          #
          # @param context [GenerationContext] Context to analyze
          # @return [Integer] Complexity score (0-100)
          #
          def calculate_complexity_score(context)
            score = 0

            # Base score from column count
            score += context.table[:columns].size * 2

            # Add for relationships
            score += count_relationships(context.relationships) * 5

            # Add for polymorphic relationships
            if context.respond_to?(:has_polymorphic_relationships?) && context.has_polymorphic_relationships?
              score += 15
            end

            # Add for soft deletion support
            if context.respond_to?(:supports_soft_deletion?) && context.supports_soft_deletion?
              score += 10
            end

            # Cap at 100
            [ score, 100 ].min
          end

          # Detect which transformation rule likely failed
          #
          # @param error [StandardError] The transformation error
          # @return [Symbol, nil] The likely failed rule
          #
          def detect_failed_rule(error)
            error_message = error.message.downcase

            return :normalize_column_names if error_message.include?("column") || error_message.include?("name")
            return :enhance_relationships if error_message.include?("relationship") || error_message.include?("foreign")
            return :add_computed_properties if error_message.include?("computed") || error_message.include?("property")
            return :custom_transformation if @custom_transformer

            nil
          end
        end
      end
    end
  end
end
