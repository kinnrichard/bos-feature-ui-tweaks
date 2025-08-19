# frozen_string_literal: true

module ZeroSchemaGenerator
  # Collects polymorphic declarations from generated TypeScript models
  # Reads declarePolymorphicRelationships() calls to dynamically generate schema relationships
  class PolymorphicDeclarationCollector
    attr_reader :declarations

    def initialize(models_directory = nil)
      @models_directory = models_directory || default_models_directory
      @declarations = {}
    end

    # Collect all polymorphic declarations from TypeScript models
    def collect_declarations
      @declarations = {}

      Dir.glob(File.join(@models_directory, "*.ts")).each do |file_path|
        next if file_path.include?("reactive-") # Skip reactive models
        next if file_path.include?("/types/") # Skip type definitions
        next if file_path.include?("/base/") # Skip base classes

        collect_from_file(file_path)
      end

      @declarations
    end

    # Extract polymorphic declarations from a single file
    def collect_from_file(file_path)
      content = File.read(file_path)

      # Find declarePolymorphicRelationships calls
      # This handles multi-line declarations with nested objects
      if content =~ /declarePolymorphicRelationships\(\s*\{/
        # Find the starting position
        start_index = content.index(/declarePolymorphicRelationships\(\s*\{/)
        return unless start_index

        # Find the matching closing brace by counting braces
        config_start = content.index("{", start_index)
        brace_count = 1
        current_pos = config_start + 1
        in_string = false
        string_char = nil

        while current_pos < content.length && brace_count > 0
          char = content[current_pos]
          prev_char = current_pos > 0 ? content[current_pos - 1] : nil

          # Handle string literals to ignore braces inside strings
          if !in_string && (char == '"' || char == "'")
            in_string = true
            string_char = char
          elsif in_string && char == string_char && prev_char != "\\"
            in_string = false
            string_char = nil
          elsif !in_string
            brace_count += 1 if char == "{"
            brace_count -= 1 if char == "}"
          end

          current_pos += 1
        end

        if brace_count == 0
          config_content = content[config_start..current_pos-1]
          parsed = parse_declaration_from_js(config_content)

          if parsed[:table_name]
            @declarations[parsed[:table_name]] ||= { belongs_to: {}, has_many: {} }
            @declarations[parsed[:table_name]].merge!(parsed) do |key, old_val, new_val|
              if key == :belongs_to || key == :has_many
                old_val.merge(new_val)
              else
                new_val
              end
            end
          end
        end
      end
    end

    # Parse JavaScript object literal to extract declaration
    def parse_declaration_from_js(js_content)
      result = { belongs_to: {}, has_many: {} }

      # Extract tableName
      if js_content =~ /tableName:\s*['"]([^'"]+)['"]/
        result[:table_name] = $1
      end

      # Extract belongsTo object
      if js_content =~ /belongsTo:\s*\{/
        belongs_to_start = js_content.index(/belongsTo:\s*\{/)
        belongs_to_content = extract_nested_object(js_content[belongs_to_start..-1])
        result[:belongs_to] = parse_polymorphic_fields_from_js(belongs_to_content) if belongs_to_content
      end

      # Extract hasMany object
      if js_content =~ /hasMany:\s*\{/
        has_many_start = js_content.index(/hasMany:\s*\{/)
        has_many_content = extract_nested_object(js_content[has_many_start..-1])
        result[:has_many] = parse_polymorphic_fields_from_js(has_many_content) if has_many_content
      end

      result
    end

    # Extract a nested object from JavaScript content
    def extract_nested_object(content)
      return nil unless content =~ /\{/

      start = content.index("{")
      brace_count = 1
      current = start + 1

      while current < content.length && brace_count > 0
        brace_count += 1 if content[current] == "{"
        brace_count -= 1 if content[current] == "}"
        current += 1
      end

      return nil if brace_count != 0
      content[start+1...current-1]
    end

    # Parse polymorphic fields from JavaScript object content
    def parse_polymorphic_fields_from_js(content)
      fields = {}

      # Match field definitions with nested objects
      # Example: loggable: { typeField: 'loggable_type', ... }
      content.scan(/(\w+):\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/m) do |field_name, field_content|
        config = {}

        # Extract typeField
        if field_content =~ /typeField:\s*['"]([^'"]+)['"]/
          config[:type_field] = $1
        end

        # Extract idField
        if field_content =~ /idField:\s*['"]([^'"]+)['"]/
          config[:id_field] = $1
        end

        # Extract allowedTypes array - handle multi-line arrays
        if field_content =~ /allowedTypes:\s*\[([^\]]+)\]/m
          types_string = $1
          # Extract quoted strings from the array, handling both single and double quotes
          config[:allowed_types] = types_string.scan(/['"]([^'"]+)['"]/).flatten
        end

        fields[field_name.to_sym] = config if config.any?
      end

      fields
    end


    # Get polymorphic relationships for a specific table
    def get_table_polymorphic_relationships(table_name)
      @declarations[table_name] || { belongs_to: {}, has_many: {} }
    end

    # Get all tables with polymorphic belongs_to relationships
    def tables_with_polymorphic_belongs_to
      @declarations.select { |_, config| config[:belongs_to].any? }.keys
    end

    # Get all tables with polymorphic has_many relationships
    def tables_with_polymorphic_has_many
      @declarations.select { |_, config| config[:has_many].any? }.keys
    end

    # Get all unique polymorphic types (notable, loggable, etc.)
    def all_polymorphic_types
      types = Set.new

      @declarations.each do |_, config|
        config[:belongs_to].each_key { |type| types.add(type.to_s) }
        config[:has_many].each_key { |type| types.add(type.to_s) }
      end

      types.to_a.sort
    end

    # Get all allowed target types for a specific polymorphic association
    def get_allowed_types(table_name, association_name, association_type = :belongs_to)
      config = @declarations[table_name]
      return [] unless config

      association = config[association_type][association_name.to_sym]
      return [] unless association

      association[:allowed_types] || []
    end

    # Generate report of collected declarations
    def generate_report
      report = []
      report << "=" * 60
      report << "POLYMORPHIC DECLARATIONS COLLECTED"
      report << "=" * 60
      report << ""

      if @declarations.empty?
        report << "No polymorphic declarations found."
      else
        report << "Found #{@declarations.size} tables with polymorphic declarations:"
        report << ""

        @declarations.each do |table_name, config|
          report << "📋 Table: #{table_name}"

          if config[:belongs_to].any?
            report << "  belongs_to:"
            config[:belongs_to].each do |field, field_config|
              report << "    - #{field}:"
              report << "      Type Field: #{field_config[:type_field]}"
              report << "      ID Field: #{field_config[:id_field]}"
              report << "      Allowed Types: #{field_config[:allowed_types].join(', ')}"
            end
          end

          if config[:has_many].any?
            report << "  has_many:"
            config[:has_many].each do |field, field_config|
              report << "    - #{field}:"
              report << "      Type Field: #{field_config[:type_field]}"
              report << "      ID Field: #{field_config[:id_field]}"
              report << "      Allowed Types: #{field_config[:allowed_types].join(', ')}"
            end
          end

          report << ""
        end

        report << "Summary:"
        report << "  - Polymorphic Types: #{all_polymorphic_types.join(', ')}"
        report << "  - Tables with belongs_to: #{tables_with_polymorphic_belongs_to.size}"
        report << "  - Tables with has_many: #{tables_with_polymorphic_has_many.size}"
      end

      report.join("\n")
    end

    private

    def default_models_directory
      # Try to find the frontend models directory
      possible_paths = [
        Rails.root.join("frontend", "src", "lib", "models"),
        Rails.root.join("app", "javascript", "models"),
        Rails.root.join("client", "src", "models")
      ]

      path = possible_paths.find { |p| Dir.exist?(p) }
      path || Rails.root.join("frontend", "src", "lib", "models")
    end
  end
end
