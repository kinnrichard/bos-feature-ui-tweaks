# frozen_string_literal: true

module ZeroSchemaGenerator
  class TypeMapper
    # Core Rails-to-Zero type mappings
    TYPE_MAPPINGS = {
      # UUID handling - Rails UUIDs become Zero strings
      uuid: ->(_column) { "string()" },

      # Rails enum stored as integer - use number() type in Zero.js
      integer: ->(column) {
        "number()"
      },

      # JSONB support
      jsonb: ->(_column) { "json()" },
      json: ->(_column) { "json()" },

      # Temporal types - Zero sees PostgreSQL timestamps as numbers
      datetime: ->(_column) { "number()" },
      timestamp: ->(_column) { "number()" },
      timestamptz: ->(_column) { "number()" },
      date: ->(_column) { "number()" },
      time: ->(_column) { "number()" },

      # Standard types
      string: ->(_column) { "string()" },
      text: ->(_column) { "string()" },
      boolean: ->(_column) { "boolean()" },
      decimal: ->(_column) { "number()" },
      float: ->(_column) { "number()" },
      bigint: ->(_column) { "number()" },

      # Binary data
      binary: ->(_column) { "string()" },  # Base64 encoded

      # Arrays (PostgreSQL specific)
      array: ->(column) { "json()" }  # Arrays as JSON for now
    }.freeze

    # Special handling for common Rails patterns
    COLUMN_OVERRIDES = {
      # Common Rails timestamp columns (PostgreSQL timestamps as numbers)
      "created_at" => "number()",
      "updated_at" => "number()",

      # Rails locking columns
      "lock_version" => "number()",

      # Common Rails convention columns
      "position" => "number()",
      "sort_order" => "number()"
      # Note: "priority" removed - should be detected as enum automatically
    }.freeze

    def initialize(config = {})
      @config = config
      @custom_mappings = config[:type_overrides] || {}
    end

    def map_column(column)
      table_column_key = "#{column[:table_name]}.#{column[:name]}" if column[:table_name]

      # Check for custom override first
      if table_column_key && @custom_mappings[table_column_key]
        return apply_nullability(@custom_mappings[table_column_key], column)
      end

      # Check for global column name override
      if COLUMN_OVERRIDES[column[:name]]
        return apply_nullability(COLUMN_OVERRIDES[column[:name]], column)
      end

      # Use type mapping
      mapper = TYPE_MAPPINGS[column[:type]]

      if mapper.nil?
        # Fallback for unknown types
        Rails.logger.warn "Unknown column type '#{column[:type]}' for #{column[:name]}, defaulting to string()"
        base_type = "string()"
      else
        base_type = if mapper.respond_to?(:call)
          mapper.call(column)
        else
          mapper
        end
      end

      apply_nullability(base_type, column)
    end

    def map_primary_key(column)
      # Primary keys are never nullable in Zero
      case column[:type]
      when :uuid
        "string()"
      when :integer, :bigint
        "number()"
      else
        "string()"  # Fallback
      end
    end

    def generate_zero_type_import(columns = [])
      # Generate the import statement for Zero types
      used_types = %w[string number boolean json]

      # Rails enums use number() type, no need for enumeration import
      # if columns.any? { |column| column[:enum] && column[:enum_integer_values]&.any? }
      #   used_types << 'enumeration'
      # end

      "import { #{used_types.join(', ')} } from '@rocicorp/zero';"
    end

    private

    def apply_nullability(base_type, column)
      if column[:null] && !primary_key_column?(column)
        # Remove existing parentheses and add .optional()
        base_type = base_type.gsub(/\(\)$/, "")
        "#{base_type}().optional()"
      else
        base_type
      end
    end

    def primary_key_column?(column)
      # Check if this is a primary key column
      column[:name] == "id" || column[:primary_key] == true
    end

    def enum_column?(column)
      column[:enum] == true
    end

    # Type validation helpers
    def self.zero_type_valid?(type_string)
      # Basic validation that the generated type string is valid Zero syntax
      valid_patterns = [
        /^string\(\)(\.optional\(\))?$/,
        /^number\(\)(\.optional\(\))?$/,
        /^boolean\(\)(\.optional\(\))?$/,
        /^json\(\)(\.optional\(\))?$/,
        /^enumeration<.+>\(\)(\.optional\(\))?$/  # Support enumeration types
      ]

      valid_patterns.any? { |pattern| type_string.match?(pattern) }
    end

    def self.suggest_type_for_sql_type(sql_type)
      # Suggest Zero type based on SQL type when Rails type is unknown
      case sql_type.downcase
      when /varchar|text|char/
        "string()"
      when /int|serial|bigserial/
        "number()"
      when /bool/
        "boolean()"
      when /json|jsonb/
        "json()"
      when /timestamp|date|time/
        "string()"
      when /uuid/
        "string()"
      when /decimal|numeric|float|double/
        "number()"
      else
        "string()"  # Safe fallback
      end
    end
  end
end
