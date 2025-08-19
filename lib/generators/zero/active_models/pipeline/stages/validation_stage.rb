# frozen_string_literal: true

require_relative "../stage"

module Zero
  module Generators
    module Pipeline
      module Stages
        # ValidationStage ensures context has required data for subsequent stages
        #
        # This stage validates that the GenerationContext contains all necessary
        # data for successful pipeline execution. It can check for required fields,
        # validate data formats, and ensure relationships are properly structured.
        #
        # Key Features:
        # - Validates required context attributes
        # - Checks data format and structure
        # - Provides detailed validation error messages
        # - Can be configured with custom validation rules
        # - Fails fast to prevent issues in later stages
        #
        # @example Usage in pipeline
        #   pipeline = Pipeline.new(stages: [
        #     ValidationStage.new(
        #       required_fields: [:table_name, :schema],
        #       validate_table_structure: true
        #     ),
        #     ProcessingStage.new
        #   ])
        #
        # @example Custom validation rules
        #   validator = ValidationStage.new do |context|
        #     unless context.table[:columns].any?
        #       raise ValidationError, "Table must have at least one column"
        #     end
        #   end
        #
        class ValidationStage < Stage
          # Custom error for validation failures
          class ValidationError < StandardError; end

          attr_reader :required_fields, :validation_rules, :options

          # Initialize ValidationStage with validation configuration
          #
          # @param required_fields [Array<Symbol>] Required context methods/attributes
          # @param validate_table_structure [Boolean] Whether to validate table structure
          # @param validate_relationships [Boolean] Whether to validate relationships
          # @param strict_mode [Boolean] Whether to fail on warnings
          # @param custom_validator [Proc] Custom validation block
          #
          def initialize(
            required_fields: [ :table, :schema ],
            validate_table_structure: true,
            validate_relationships: false,
            strict_mode: false,
            &custom_validator
          )
            @required_fields = required_fields
            @validation_rules = {
              table_structure: validate_table_structure,
              relationships: validate_relationships,
              strict_mode: strict_mode
            }
            @custom_validator = custom_validator
            super()
          end

          # Validate context and add validation metadata
          #
          # @param context [GenerationContext] Input context to validate
          # @return [GenerationContext] Context with validation metadata
          #
          # @raise [StageError] If validation fails
          #
          def process(context)
            validation_start_time = Time.current

            begin
              # Run all validation checks
              validate_required_fields!(context)
              validate_table_structure!(context) if @validation_rules[:table_structure]
              validate_relationships!(context) if @validation_rules[:relationships]
              run_custom_validation!(context) if @custom_validator

              # Add successful validation metadata
              validation_metadata = {
                validated: true,
                validated_at: Time.current,
                validation_duration: Time.current - validation_start_time,
                validation_rules_applied: @validation_rules.keys,
                warnings: []
              }

              add_stage_metadata(context, validation_metadata)

            rescue ValidationError => e
              # Wrap validation errors with stage context
              raise Stage::StageError.new(
                stage: self,
                context: context,
                error: e
              )
            end
          end

          # ValidationStage should run early in pipeline
          #
          # @param context [GenerationContext] Context to evaluate
          # @return [Boolean] True if context exists
          #
          def can_run?(context)
            !context.nil?
          end

          # ValidationStage is idempotent
          #
          # @return [Boolean] True - validation can be run multiple times safely
          #
          def idempotent?
            true
          end

          # ValidationStage should run very early
          #
          # @return [Integer] Very high priority (5)
          #
          def priority
            5
          end

          # Get stage description
          #
          # @return [String] Description of validation stage functionality
          #
          def description
            "Validates context data and structure for subsequent stages"
          end

          private

          # Validate that all required fields are present and accessible
          #
          # @param context [GenerationContext] Context to validate
          # @raise [ValidationError] If required fields are missing
          #
          def validate_required_fields!(context)
            @required_fields.each do |field|
              unless context.respond_to?(field)
                raise ValidationError,
                  "Context missing required field: #{field}"
              end

              # Check if field returns nil or empty for critical fields
              value = context.send(field)
              if critical_field?(field) && (value.nil? || (value.respond_to?(:empty?) && value.empty?))
                raise ValidationError,
                  "Required field '#{field}' is nil or empty"
              end
            end
          end

          # Validate table structure if table data is present
          #
          # @param context [GenerationContext] Context to validate
          # @raise [ValidationError] If table structure is invalid
          #
          def validate_table_structure!(context)
            return unless context.respond_to?(:table) && context.table

            table = context.table

            # Validate table is a hash with required keys
            unless table.is_a?(Hash)
              raise ValidationError, "Table data must be a Hash, got #{table.class}"
            end

            # Validate table name
            unless table[:name].is_a?(String) && !table[:name].empty?
              raise ValidationError, "Table must have a valid name (String)"
            end

            # Validate columns structure
            unless table[:columns].is_a?(Array)
              raise ValidationError, "Table columns must be an Array"
            end

            if table[:columns].empty?
              if @validation_rules[:strict_mode]
                raise ValidationError, "Table must have at least one column"
              else
                # Just a warning in non-strict mode
                warn "Table '#{table[:name]}' has no columns"
              end
            end

            # Validate individual columns
            table[:columns].each_with_index do |column, index|
              validate_column_structure!(column, index, table[:name])
            end
          end

          # Validate individual column structure
          #
          # @param column [Hash] Column definition to validate
          # @param index [Integer] Column position for error messages
          # @param table_name [String] Table name for error context
          # @raise [ValidationError] If column structure is invalid
          #
          def validate_column_structure!(column, index, table_name)
            unless column.is_a?(Hash)
              raise ValidationError,
                "Column #{index} in table '#{table_name}' must be a Hash"
            end

            unless column[:name].is_a?(String) && !column[:name].empty?
              raise ValidationError,
                "Column #{index} in table '#{table_name}' must have a valid name"
            end

            unless column[:type].is_a?(String) && !column[:type].empty?
              raise ValidationError,
                "Column '#{column[:name]}' in table '#{table_name}' must have a valid type"
            end
          end

          # Validate relationships structure if present
          #
          # @param context [GenerationContext] Context to validate
          # @raise [ValidationError] If relationships are invalid
          #
          def validate_relationships!(context)
            return unless context.respond_to?(:relationships) && context.relationships

            relationships = context.relationships

            unless relationships.is_a?(Hash)
              raise ValidationError,
                "Relationships must be a Hash, got #{relationships.class}"
            end

            # Validate relationship types
            valid_relationship_types = [ :belongs_to, :has_many, :has_one, :polymorphic ]
            relationships.each do |type, relations|
              unless valid_relationship_types.include?(type)
                if @validation_rules[:strict_mode]
                  raise ValidationError, "Invalid relationship type: #{type}"
                else
                  warn "Unknown relationship type: #{type}"
                end
              end

              unless relations.is_a?(Array)
                raise ValidationError,
                  "Relationships for '#{type}' must be an Array"
              end
            end
          end

          # Run custom validation block if provided
          #
          # @param context [GenerationContext] Context to validate
          # @raise [ValidationError] If custom validation fails
          #
          def run_custom_validation!(context)
            @custom_validator.call(context)
          rescue StandardError => e
            # Wrap custom validation errors
            raise ValidationError, "Custom validation failed: #{e.message}"
          end

          # Check if field is critical and should not be nil/empty
          #
          # @param field [Symbol] Field name to check
          # @return [Boolean] True if field is critical
          #
          def critical_field?(field)
            [ :table, :schema, :table_name ].include?(field)
          end

          # Issue warning if not in strict mode
          #
          # @param message [String] Warning message
          #
          def warn(message)
            return if @validation_rules[:strict_mode]

            # In a real implementation, this might log to Rails logger
            puts "ValidationStage Warning: #{message}" if defined?(Rails) && Rails.env.development?
          end
        end
      end
    end
  end
end
