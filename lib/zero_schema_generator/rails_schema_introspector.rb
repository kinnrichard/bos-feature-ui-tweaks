# frozen_string_literal: true

module ZeroSchemaGenerator
  class RailsSchemaIntrospector
    # Tables to exclude from Zero schema generation
    EXCLUDED_TABLES = %w[
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
      good_jobs
      good_job_batches
      good_job_executions
      good_job_processes
      good_job_settings
      refresh_tokens
      revoked_tokens
      unique_ids
      ar_internal_metadata
      schema_migrations
      versions
    ].freeze

    def initialize
      @connection = ActiveRecord::Base.connection
    end

    def extract_schema
      tables_data = extract_tables
      {
        tables: tables_data,
        relationships: extract_relationships,
        indexes: extract_indexes,
        constraints: extract_constraints,
        patterns: extract_patterns(tables_data)
      }
    end

    def generate_pattern_report(patterns)
      report = {
        total_patterns: 0,
        tables_with_patterns: 0,
        pattern_types: Hash.new(0),
        details: {}
      }

      patterns.each do |table_name, table_patterns|
        next if table_patterns.empty?

        report[:tables_with_patterns] += 1
        report[:details][table_name] = []

        table_patterns.each do |pattern_type, pattern_data|
          report[:total_patterns] += 1
          report[:pattern_types][pattern_type] += 1

          case pattern_type
          when :soft_deletion
            gem_info = pattern_data[:gem] == "discard" ? "discard gem" : pattern_data[:mutation_behavior]
            report[:details][table_name] << "Soft Deletion: #{pattern_data[:column]} (#{gem_info})"
          when :positioning
            scoping = pattern_data[:scoping_columns].any? ? " scoped by #{pattern_data[:scoping_columns].join(', ')}" : ""
            report[:details][table_name] << "Positioning: #{pattern_data[:column]}#{scoping}"
          when :normalized_fields
            pattern_data.each do |field|
              report[:details][table_name] << "Normalized Field: #{field[:source_column]} → #{field[:normalized_column]}"
            end
          when :timestamp_pairs
            pattern_data.each do |pair|
              report[:details][table_name] << "Timestamp Pair: #{pair[:boolean_column]} + #{pair[:timestamp_column]}"
            end
          when :enums
            enum_count = pattern_data.size
            report[:details][table_name] << "Rails Enums: #{enum_count} enum#{enum_count > 1 ? 's' : ''} detected"
          when :polymorphic
            poly_count = pattern_data.size
            report[:details][table_name] << "Polymorphic: #{poly_count} association#{poly_count > 1 ? 's' : ''} detected"
          end
        end
      end

      report
    end

    private

    def extract_tables
      @connection.tables.map do |table_name|
        next if excluded_table?(table_name)

        {
          name: table_name,
          columns: extract_columns(table_name),
          primary_key: extract_primary_key(table_name),
          foreign_keys: extract_foreign_keys(table_name)
        }
      end.compact
    end

    def extract_columns(table_name)
      @connection.columns(table_name).map do |column|
        column_data = {
          name: column.name,
          type: column.type,
          sql_type: column.sql_type,
          null: column.null,
          default: column.default,
          default_function: extract_default_function(column),
          default_type: categorize_default_type(column),
          comment: column.comment,
          enum: enum_column?(table_name, column.name),
          enum_values: enum_values_for_column(table_name, column.name),
          enum_integer_values: enum_integer_values_for_column(table_name, column.name)
        }

        # Validate enum storage if this is an enum column
        if column_data[:enum]
          validate_enum_storage(table_name, column.name)
        end

        column_data
      end
    end

    def extract_primary_key(table_name)
      @connection.primary_key(table_name)
    end

    def extract_foreign_keys(table_name)
      @connection.foreign_keys(table_name).map do |fk|
        {
          name: fk.name,
          from_table: fk.from_table,
          from_column: fk.column,
          to_table: fk.to_table,
          to_column: fk.primary_key,
          on_delete: fk.on_delete,
          on_update: fk.on_update
        }
      end
    end

    def extract_relationships
      # Extract ActiveRecord model relationships
      models = discover_models

      models.map do |model_class|
        next unless model_class.table_exists?

        {
          model: model_class.name,
          table: model_class.table_name,
          belongs_to: extract_belongs_to(model_class),
          has_many: extract_has_many(model_class),
          has_one: extract_has_one(model_class),
          polymorphic: extract_polymorphic(model_class)
        }
      end.compact
    end

    def extract_indexes
      # Extract database indexes (not covered by foreign keys)
      indexes = {}

      @connection.tables.each do |table_name|
        next if excluded_table?(table_name)

        indexes[table_name] = @connection.indexes(table_name).map do |index|
          {
            name: index.name,
            columns: index.columns,
            unique: index.unique,
            using: index.try(:using),
            where: index.try(:where)
          }
        end
      end

      indexes
    end

    def extract_constraints
      # Extract check constraints and other constraints
      # This is PostgreSQL-specific implementation
      return {} unless postgresql?

      constraints_sql = <<~SQL
        SELECT#{' '}
          tc.table_name,
          tc.constraint_name,
          tc.constraint_type,
          cc.check_clause
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.check_constraints cc#{' '}
          ON tc.constraint_name = cc.constraint_name
        WHERE tc.table_schema = 'public'
          AND tc.constraint_type IN ('CHECK', 'UNIQUE')
        ORDER BY tc.table_name, tc.constraint_name;
      SQL

      result = @connection.execute(constraints_sql)

      constraints = {}
      result.each do |row|
        table_name = row["table_name"]
        next if excluded_table?(table_name)

        constraints[table_name] ||= []
        constraints[table_name] << {
          name: row["constraint_name"],
          type: row["constraint_type"],
          definition: row["check_clause"]
        }
      end

      constraints
    end

    def excluded_table?(table_name)
      EXCLUDED_TABLES.include?(table_name)
    end

    def enum_column?(table_name, column_name)
      # Check if this column is defined as an enum in Rails models
      model_class = find_model_for_table(table_name)
      return false unless model_class

      model_class.defined_enums.key?(column_name)
    end

    def enum_values_for_column(table_name, column_name)
      model_class = find_model_for_table(table_name)
      return [] unless model_class&.defined_enums&.key?(column_name)

      model_class.defined_enums[column_name].keys
    end

    def enum_integer_values_for_column(table_name, column_name)
      model_class = find_model_for_table(table_name)
      return [] unless model_class&.defined_enums&.key?(column_name)

      model_class.defined_enums[column_name].values
    end

    def validate_enum_storage(table_name, column_name)
      model_class = find_model_for_table(table_name)
      return unless model_class&.defined_enums&.key?(column_name)

      enum_values = model_class.defined_enums[column_name].values

      # Check if any enum values are integers (indicating integer storage)
      if enum_values.any? { |v| v.is_a?(Integer) }
        enum_definition = model_class.defined_enums[column_name]

        raise <<~ERROR
          ❌ ENUM VALIDATION ERROR: #{model_class.name}.#{column_name} uses integer storage

          Integer-based enums are incompatible with this project's string enum convention and Zero.js schema generation.
          Please convert to string-based enum storage for better readability and type safety.

          Current enum definition:
            enum :#{column_name}, #{enum_definition.inspect}
          #{'  '}
          Expected string-based definition:
            enum :#{column_name}, {
              #{enum_definition.keys.map { |key| "#{key}: \"#{key}\"" }.join(",\n      ")}
            }
          #{'  '}
          To fix this:
          1. Create a migration to convert the column from integer to string
          2. Update the model's enum definition to use string values
          3. Regenerate the Zero.js schema

          This project uses string enums for better developer experience and debugging.
        ERROR
      end
    end

    def extract_default_function(column)
      return nil unless column.default_function

      # ActiveRecord provides default_function for database functions
      column.default_function
    rescue NoMethodError
      # Fallback for older ActiveRecord versions
      # Try to detect function defaults from the string representation
      default_str = column.default.to_s
      if default_str.include?("gen_random_uuid") || default_str.include?("uuid_generate")
        "gen_random_uuid()"
      elsif default_str.include?("CURRENT_TIMESTAMP") || default_str.include?("now()")
        "CURRENT_TIMESTAMP"
      else
        nil
      end
    end

    def categorize_default_type(column)
      return nil unless column.default

      default_str = column.default.to_s

      # Check for database functions
      if default_str.include?("->") || default_str.include?("lambda")
        "function"
      elsif default_str.include?("gen_random_uuid") || default_str.include?("uuid_generate")
        "uuid_function"
      elsif default_str.include?("CURRENT_TIMESTAMP") || default_str.include?("now()")
        "timestamp_function"
      elsif column.type == :string || column.type == :text
        "string_literal"
      elsif column.type == :integer || column.type == :bigint || column.type == :decimal || column.type == :float
        "numeric_literal"
      elsif column.type == :boolean
        "boolean_literal"
      elsif column.type == :date || column.type == :datetime || column.type == :time
        "date_literal"
      elsif column.type == :json || column.type == :jsonb
        "json_literal"
      else
        "unknown"
      end
    end

    def find_model_for_table(table_name)
      # Find ActiveRecord model class for table
      model_name = table_name.classify
      return nil unless Object.const_defined?(model_name)

      model_class = Object.const_get(model_name)
      return nil unless model_class < ActiveRecord::Base
      return nil unless model_class.table_name == table_name

      model_class
    rescue NameError
      nil
    end

    def check_discard_model_inclusion(model_class)
      # Check if model includes Discard::Model
      return false unless defined?(Discard::Model)

      model_class.included_modules.include?(Discard::Model)
    rescue => e
      Rails.logger.warn "Could not check Discard::Model inclusion for #{model_class.name}: #{e.message}"
      false
    end

    def discover_models
      # Avoid eager loading that causes issues, just discover known models
      model_names = %w[User Client Job Task Person Device Note ActivityLog ContactMethod ScheduledDateTime JobAssignment JobPerson]

      model_names.map do |name|
        begin
          model_class = Object.const_get(name)
          model_class if model_class < ActiveRecord::Base && model_class.table_exists?
        rescue NameError, ActiveRecord::StatementInvalid
          nil
        end
      end.compact
    end

    def extract_belongs_to(model_class)
      model_class.reflections.select { |_, r| r.macro == :belongs_to }.map do |name, reflection|
        {
          name: name,
          foreign_key: reflection.foreign_key,
          target_table: reflection.polymorphic? ? nil : safe_table_name(reflection),
          target_class: reflection.polymorphic? ? nil : reflection.class_name,
          optional: reflection.options[:optional] || false,
          polymorphic: reflection.polymorphic?
        }
      end
    end

    def extract_has_many(model_class)
      model_class.reflections.select { |_, r| r.macro == :has_many }.map do |name, reflection|
        {
          name: name,
          foreign_key: reflection.foreign_key,
          target_table: safe_table_name(reflection),
          target_class: reflection.class_name,
          through: reflection.through_reflection&.name,
          dependent: reflection.options[:dependent]
        }
      end
    end

    def extract_has_one(model_class)
      model_class.reflections.select { |_, r| r.macro == :has_one }.map do |name, reflection|
        {
          name: name,
          foreign_key: reflection.foreign_key,
          target_table: safe_table_name(reflection),
          target_class: reflection.class_name,
          dependent: reflection.options[:dependent]
        }
      end
    end

    def extract_polymorphic(model_class)
      model_class.reflections.select { |_, r| r.polymorphic? }.map do |name, reflection|
        {
          name: name,
          type_column: "#{name}_type",
          id_column: "#{name}_id",
          strategy: :polymorphic_union,
          foreign_key: reflection.foreign_key,
          foreign_type: reflection.foreign_type
        }
      end
    end

    def postgresql?
      @connection.adapter_name.downcase == "postgresql"
    end

    def safe_table_name(reflection)
      return nil if reflection.polymorphic?

      begin
        reflection.table_name
      rescue => e
        Rails.logger.warn "Could not determine table name for reflection #{reflection.name}: #{e.message}"
        nil
      end
    end

    # Pattern Detection Methods for Story 1.2

    def extract_patterns(tables_data)
      patterns = {}

      tables_data.each do |table|
        patterns[table[:name]] = detect_table_patterns(table)
      end

      patterns
    end

    def detect_table_patterns(table)
      patterns = {}

      # Detect all supported patterns
      patterns[:soft_deletion] = detect_soft_deletion_pattern(table)
      patterns[:positioning] = detect_positioning_pattern(table)
      patterns[:normalized_fields] = detect_normalized_field_pattern(table)
      patterns[:timestamp_pairs] = detect_timestamp_pair_pattern(table)
      patterns[:enums] = detect_enum_pattern(table)
      patterns[:polymorphic] = detect_polymorphic_pattern(table)

      # Filter out empty patterns
      patterns.select { |_, pattern_data|
        pattern_data && (pattern_data.is_a?(Array) ? pattern_data.any? : pattern_data[:detected])
      }
    end

    def detect_soft_deletion_pattern(table)
      # First check for discarded_at column (discard gem pattern)
      discarded_at_column = table[:columns].find { |col| col[:name] == "discarded_at" }

      if discarded_at_column
        # Check if Rails model includes Discard::Model
        model_class = find_model_for_table(table[:name])
        uses_discard_gem = model_class && check_discard_model_inclusion(model_class)

        return {
          detected: true,
          column: discarded_at_column[:name],
          type: discarded_at_column[:type],
          sql_type: discarded_at_column[:sql_type],
          nullable: discarded_at_column[:null],
          mutation_behavior: "discard_pattern",
          gem: "discard",
          uses_discard_gem: uses_discard_gem
        }
      end

      # Fallback to legacy deleted_at pattern
      deleted_at_column = table[:columns].find { |col| col[:name] == "deleted_at" }

      return nil unless deleted_at_column

      {
        detected: true,
        column: deleted_at_column[:name],
        type: deleted_at_column[:type],
        sql_type: deleted_at_column[:sql_type],
        nullable: deleted_at_column[:null],
        mutation_behavior: "soft_delete_on_delete_call",
        gem: "legacy"
      }
    end

    def detect_positioning_pattern(table)
      position_column = table[:columns].find { |col| col[:name] == "position" }

      return nil unless position_column

      # Check for scoping columns (common patterns)
      scoping_columns = []
      table[:columns].each do |col|
        if col[:name].end_with?("_id") && col[:name] != "id"
          scoping_columns << col[:name]
        end
      end

      {
        detected: true,
        column: position_column[:name],
        type: position_column[:type],
        scoping_columns: scoping_columns,
        mutation_behavior: "positioning_methods_generation",
        methods: %w[move_before move_after move_to_top move_to_bottom]
      }
    end

    def detect_normalized_field_pattern(table)
      normalized_fields = []

      table[:columns].each do |col|
        if col[:name].end_with?("_normalized")
          source_field = col[:name].gsub("_normalized", "")
          source_column = table[:columns].find { |c| c[:name] == source_field }

          if source_column
            normalized_fields << {
              normalized_column: col[:name],
              source_column: source_field,
              normalized_type: col[:type],
              source_type: source_column[:type],
              mutation_behavior: "auto_populate_from_source"
            }
          end
        end
      end

      normalized_fields.any? ? normalized_fields : nil
    end

    def detect_timestamp_pair_pattern(table)
      timestamp_pairs = []

      table[:columns].each do |col|
        if col[:name].end_with?("_time_set") && col[:type] == :boolean
          timestamp_field = col[:name].gsub("_time_set", "_at")
          timestamp_column = table[:columns].find { |c| c[:name] == timestamp_field }

          if timestamp_column && [ :datetime, :timestamp, :timestamptz ].include?(timestamp_column[:type])
            timestamp_pairs << {
              boolean_column: col[:name],
              timestamp_column: timestamp_field,
              boolean_type: col[:type],
              timestamp_type: timestamp_column[:type],
              mutation_behavior: "auto_set_boolean_when_timestamp_provided"
            }
          end
        end
      end

      timestamp_pairs.any? ? timestamp_pairs : nil
    end

    def detect_enum_pattern(table)
      enum_columns = []

      table[:columns].each do |col|
        if col[:enum] && col[:enum_values].any?
          enum_columns << {
            column: col[:name],
            type: col[:type],
            sql_type: col[:sql_type],
            enum_values: col[:enum_values],
            mutation_behavior: "zero_enum_validation",
            validation_type: "runtime_and_compile_time"
          }
        end
      end

      enum_columns.any? ? enum_columns : nil
    end

    def detect_polymorphic_pattern(table)
      polymorphic_columns = []

      # Group columns by potential polymorphic relationships
      type_columns = table[:columns].select { |col| col[:name].end_with?("_type") }

      type_columns.each do |type_col|
        base_name = type_col[:name].gsub("_type", "")
        id_column = table[:columns].find { |col| col[:name] == "#{base_name}_id" }

        if id_column
          polymorphic_columns << {
            base_name: base_name,
            type_column: type_col[:name],
            id_column: id_column[:name],
            type_column_type: type_col[:type],
            id_column_type: id_column[:type],
            mutation_behavior: "type_safe_polymorphic_setters",
            validation: "target_type_and_existence"
          }
        end
      end

      polymorphic_columns.any? ? polymorphic_columns : nil
    end
  end
end
