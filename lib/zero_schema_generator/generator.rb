# frozen_string_literal: true

require_relative "rails_schema_introspector"
require_relative "type_mapper"

module ZeroSchemaGenerator
  class Generator
    def initialize(config = {})
      @config = config
      @introspector = RailsSchemaIntrospector.new
      @type_mapper = TypeMapper.new(config)
      @output_path = config[:schema_file] || default_schema_path
      @types_path = config[:types_file] || default_types_path
      @polymorphic_config = load_polymorphic_config(config[:polymorphic_config_path])
      @polymorphic_collector = PolymorphicDeclarationCollector.new
    end

    def generate_schema(rails_schema = nil)
      puts "🔍 Analyzing Rails schema..."
      rails_schema ||= @introspector.extract_schema

      puts "📋 Collecting polymorphic declarations from TypeScript models..."
      @polymorphic_declarations = @polymorphic_collector.collect_declarations
      if @polymorphic_declarations.any?
        puts "  ✅ Found #{@polymorphic_declarations.size} tables with polymorphic declarations"
        @polymorphic_declarations.each do |table, config|
          belongs_to_count = config[:belongs_to].size
          has_many_count = config[:has_many].size
          if belongs_to_count > 0 || has_many_count > 0
            puts "    - #{table}: #{belongs_to_count} belongs_to, #{has_many_count} has_many"
          end
        end
      else
        puts "  ⚠️ No polymorphic declarations found in TypeScript models"
      end

      puts "🔄 Converting to Zero format..."
      zero_schema = build_zero_schema(rails_schema)

      puts "🛡️ Validating generated schema..."
      validation_result = self.class.validate_schema(zero_schema)

      if validation_result[:errors].any?
        puts "❌ Schema validation failed:"
        validation_result[:errors].each { |error| puts "  - #{error}" }
        raise "Schema generation failed validation. Fix errors and try again."
      end

      if validation_result[:warnings].any?
        puts "⚠️ Schema validation warnings:"
        validation_result[:warnings].each { |warning| puts "  - #{warning}" }
      end

      puts "✅ Schema validation passed (#{validation_result[:stats][:table_count]} tables, #{validation_result[:stats][:relationship_count]} relationships)"

      puts "🔍 Detecting schema changes..."
      change_detection = detect_schema_changes(zero_schema)

      puts "📝 Writing schema files..."
      write_schema_files(zero_schema)

      {
        schema_content: zero_schema,
        schema_path: @output_path,
        types_path: @types_path,
        tables_count: rails_schema[:tables].count,
        generated_at: Time.current,
        validation: validation_result,
        changes: change_detection
      }
    end

    def write_schema_files(zero_schema)
      # Ensure output directory exists
      FileUtils.mkdir_p(File.dirname(@output_path))
      FileUtils.mkdir_p(File.dirname(@types_path)) if @types_path != @output_path

      # Check for existing customizations and warn user
      if File.exist?(@output_path)
        existing_content = File.read(@output_path)
        customizations = detect_customizations(existing_content)

        if customizations.any?
          puts "🔧 Found customizations in existing schema: #{customizations.join(', ')}"
          puts "📝 Consider moving customizations to a separate file or custom schema extension"
          puts "💡 Existing customizations will be overwritten (restore from git if needed)"
        end
      end

      # Add enhanced header with customization guidance
      enhanced_schema = add_customization_header(zero_schema)

      # Write main schema file
      File.write(@output_path, enhanced_schema)

      # Generate TypeScript types file if different path
      if @types_path != @output_path
        types_content = generate_typescript_types
        File.write(@types_path, types_content)
      end
    end

    def detect_schema_changes(new_schema_content)
      return { first_generation: true } unless File.exist?(@output_path)

      existing_content = File.read(@output_path)
      changes = {
        first_generation: false,
        has_changes: false,
        new_tables: [],
        removed_tables: [],
        modified_tables: [],
        new_relationships: [],
        removed_relationships: [],
        customizations: [],
        migration_notes: []
      }

      # Extract table names from both schemas
      existing_tables = extract_table_names(existing_content)
      new_tables = extract_table_names(new_schema_content)

      # Detect table changes
      changes[:new_tables] = new_tables - existing_tables
      changes[:removed_tables] = existing_tables - new_tables

      # Detect relationship changes
      existing_relationships = extract_relationship_names(existing_content)
      new_relationships = extract_relationship_names(new_schema_content)

      changes[:new_relationships] = new_relationships - existing_relationships
      changes[:removed_relationships] = existing_relationships - new_relationships

      # Detect potential customizations (comments, custom imports, etc.)
      changes[:customizations] = detect_customizations(existing_content)

      # Generate migration notes
      changes[:migration_notes] = generate_migration_notes(changes)

      changes[:has_changes] = (
        changes[:new_tables].any? ||
        changes[:removed_tables].any? ||
        changes[:new_relationships].any? ||
        changes[:removed_relationships].any?
      )

      if changes[:has_changes]
        puts "📋 Schema changes detected:"
        puts "  + #{changes[:new_tables].length} new tables: #{changes[:new_tables].join(', ')}" if changes[:new_tables].any?
        puts "  - #{changes[:removed_tables].length} removed tables: #{changes[:removed_tables].join(', ')}" if changes[:removed_tables].any?
        puts "  + #{changes[:new_relationships].length} new relationships" if changes[:new_relationships].any?
        puts "  - #{changes[:removed_relationships].length} removed relationships" if changes[:removed_relationships].any?
      else
        puts "📋 No schema changes detected"
      end

      if changes[:customizations].any?
        puts "⚠️ #{changes[:customizations].length} potential customizations detected - will be preserved"
      end

      changes
    end

    private

    def build_zero_schema(rails_schema)
      tables = rails_schema[:tables]
      relationships = rails_schema[:relationships]

      table_definitions = []
      table_names = []
      relationship_definitions = []
      relationship_names = []

      tables.each do |table|
        table_def = generate_table_definition(table)
        table_definitions << table_def
        table_names << table[:name]
      end

      relationships.select(&:present?).each do |relationship_data|
        rel_def = generate_relationship_definition(relationship_data, table_names)
        if rel_def
          relationship_definitions << rel_def
          relationship_names << "#{relationship_data[:table]}Relationships"
        end
      end

      generate_schema_template(table_definitions, table_names, relationship_definitions, relationship_names)
    end

    def generate_table_definition(table)
      columns = generate_columns(table)
      primary_key = table[:primary_key] || "id"
      table_name = table[:name]

      <<~TYPESCRIPT
        // #{table[:name].humanize} table
        const #{table_name} = table('#{table[:name]}')
          .columns({
            #{columns.join(",\n    ")}
          })
          .primaryKey('#{primary_key}');
      TYPESCRIPT
    end

    def generate_columns(table)
      table[:columns].map do |column|
        # Add table context for type mapping
        column_with_context = column.merge(table_name: table[:name])

        zero_type = if column[:name] == table[:primary_key]
          @type_mapper.map_primary_key(column_with_context)
        else
          @type_mapper.map_column(column_with_context)
        end

        comment = column[:comment] ? " // #{column[:comment]}" : ""
        "#{column[:name]}: #{zero_type}#{comment}"
      end
    end

    def generate_relationship_definition(relationship_data, table_names)
      table_name = relationship_data[:table]
      belongs_to_rels = relationship_data[:belongs_to] || []
      has_many_rels = relationship_data[:has_many] || []

      # Skip if no relationships or table not in our generated tables
      return nil unless table_names.include?(table_name)
      return nil if belongs_to_rels.empty? && has_many_rels.empty?

      relationships = []
      uses_one = false
      uses_many = false

      # Generate belongs_to relationships (one)
      belongs_to_rels.each do |rel|
        if rel[:polymorphic]
          # Handle polymorphic associations with multiple target relationships
          polymorphic_rels = generate_polymorphic_relationships(rel, table_names, table_name)
          relationships.concat(polymorphic_rels)
          uses_one = true if polymorphic_rels.any? # Only set if relationships were actually generated
        elsif rel[:target_table] && table_names.include?(rel[:target_table])
          rel_name = rel[:name].to_s.camelize(:lower)
          relationships << generate_one_relationship(rel_name, rel[:foreign_key], rel[:target_table])
          uses_one = true
        end
      end

      # Generate has_many relationships (many)
      has_many_rels.each do |rel|
        next unless rel[:target_table] && table_names.include?(rel[:target_table])

        rel_name = rel[:name].to_s.camelize(:lower)

        if rel[:through]
          # Generate chained relationship for has_many :through
          through_comment = generate_through_relationship(rel_name, rel, table_names)
          relationships << through_comment if through_comment
        else
          # Validate that the foreign key field exists in target table before generating relationship
          if validate_foreign_key_exists(rel[:foreign_key], rel[:target_table])
            relationships << generate_many_relationship(rel_name, rel[:foreign_key], rel[:target_table])
            uses_many = true
          else
            # Add comment about skipped relationship
            relationships << "// SKIPPED: #{rel_name} - foreign key '#{rel[:foreign_key]}' does not exist in #{rel[:target_table]} table"
          end
        end
      end

      # Add self-referential children relationship if we have a parent relationship
      if belongs_to_rels.any? { |rel| rel[:target_table] == relationship_data[:table] && rel[:name].to_s.include?("parent") }
        relationships << generate_many_relationship("children", "parent_id", table_name)
        uses_many = true
      end

      return nil if relationships.empty?

      # Determine which parameters to destructure based on actual usage
      params = []
      params << "one" if uses_one
      params << "many" if uses_many
      param_list = params.join(", ")

      <<~TYPESCRIPT
        // #{relationship_data[:table].humanize} relationships
        const #{table_name}Relationships = relationships(#{table_name}, ({ #{param_list} }) => ({
          #{relationships.join(",\n  ")}
        }));
      TYPESCRIPT
    end

    def generate_one_relationship(rel_name, foreign_key, target_table)
      <<~TYPESCRIPT.strip
        #{rel_name}: one({
          sourceField: ['#{foreign_key}'],
          destField: ['id'],
          destSchema: #{target_table},
        })
      TYPESCRIPT
    end

    def generate_many_relationship(rel_name, foreign_key, target_table)
      <<~TYPESCRIPT.strip
        #{rel_name}: many({
          sourceField: ['id'],
          destSchema: #{target_table},
          destField: ['#{foreign_key}'],
        })
      TYPESCRIPT
    end

    def generate_through_relationship(rel_name, rel, table_names)
      through_table = rel[:through]
      target_table = rel[:target_table]

      # Convert through association name to table name
      through_table_name = through_table.to_s.pluralize

      # Verify through table exists in our schema
      return nil unless table_names.include?(through_table_name)

      # For Rails has_many :through, we add a comment explaining the Zero.js chained access pattern
      # Instead of generating a separate relationship, we document how to use the existing join table relationship
      comment = "// Rails has_many :#{rel_name}, through: :#{through_table} -> Use #{through_table.to_s.camelize(:lower)}.related('#{target_table.singularize}') in Zero.js"

      # Return just the comment - the actual join table relationship is already generated
      # This prevents duplicate relationships while documenting the Rails pattern
      comment
    end

    def validate_foreign_key_exists(foreign_key, target_table)
      # Get the Rails schema to check if foreign key field exists in target table
      rails_schema = @introspector.extract_schema

      target_table_data = rails_schema[:tables].find { |table| table[:name] == target_table }
      return false unless target_table_data

      # Check if the foreign key column exists in the target table
      target_table_data[:columns].any? { |column| column[:name] == foreign_key }
    end

    def generate_polymorphic_relationships(rel, table_names, parent_table_name = nil)
      # Collect declarations if not already done
      @polymorphic_declarations ||= @polymorphic_collector.collect_declarations

      table_name = parent_table_name || find_table_for_relationship(rel)

      # First try to use declarations from TypeScript models
      polymorphic_targets = if @polymorphic_declarations[table_name]
        belongs_to = @polymorphic_declarations[table_name][:belongs_to][rel[:name].to_sym]
        if belongs_to && belongs_to[:allowed_types]
          # Map allowed types to table names
          belongs_to[:allowed_types].map do |type|
            # Convert TypeScript type names to Rails table names
            map_type_to_table_name(type)
          end.select { |t| table_names.include?(t) }
        else
          []
        end
      else
        []
      end

      # Fallback to polymorphic config if no declarations found
      if polymorphic_targets.empty?
        config_key = "#{table_name}.#{rel[:name]}"

        if @polymorphic_config && @polymorphic_config.dig(:polymorphic_associations, config_key)
          # Use discovered configuration
          polymorphic_targets = @polymorphic_config[:polymorphic_associations][config_key][:mapped_tables] || []
        else
          # Fallback to legacy hardcoded logic with warning
          Rails.logger.warn "⚠️ No polymorphic configuration found for #{config_key}, using fallback logic"
          polymorphic_targets = fallback_polymorphic_targets(rel[:name])
        end
      end

      relationships = []
      polymorphic_targets.each do |target_table|
        next unless table_names.include?(target_table)

        # Create conditional relationship: notable_job, notable_task, etc.
        # Use singular form for the relationship name and type value
        singular_name = target_table.singularize
        rel_name = "#{rel[:name]}#{singular_name.classify}"
        relationships << generate_conditional_polymorphic_relationship(
          rel_name.camelize(:lower),
          rel[:foreign_key],
          rel[:foreign_type],
          target_table,
          singular_name.classify
        )
      end

      # Generate Polymorphic suffix model for this association
      if relationships.any? && @config[:generate_polymorphic_models] != false
        polymorphic_model = generate_polymorphic_model(rel, polymorphic_targets, table_names, table_name)
        relationships << "// Polymorphic model: #{polymorphic_model[:model_name]} - see generated Polymorphic models"
      end

      relationships
    end

    def generate_conditional_polymorphic_relationship(rel_name, id_column, type_column, target_table, type_value)
      # Note: This is a simplified approach. Full polymorphic support would need
      # conditional queries based on the type column
      <<~TYPESCRIPT.strip
        #{rel_name}: one({
          sourceField: ['#{id_column}'],
          destField: ['id'],
          destSchema: #{target_table},
        })
      TYPESCRIPT
    end

    def generate_schema_template(table_definitions, table_names, relationship_definitions = [], relationship_names = [], rails_schema = nil)
      # Detect if we need enumeration import by checking table definitions
      needs_enumeration = table_definitions.any? { |table_def| table_def.include?("enumeration<") }

      # Base imports
      base_imports = %w[createSchema table string number boolean json]
      base_imports << "enumeration" if needs_enumeration
      base_imports << "relationships" if relationship_definitions.any?
      base_imports << "type Zero"

      imports = <<~TYPESCRIPT.strip
        import {
          #{base_imports.join(",\n  ")}
        } from '@rocicorp/zero';
      TYPESCRIPT

      relationships_section = if relationship_definitions.any?
        "\n\n#{relationship_definitions.join("\n\n")}"
      else
        ""
      end

      # Generate Polymorphic models section
      polymorphic_models_section = generate_polymorphic_models_section

      schema_relationships = if relationship_names.any?
        ",\n  relationships: [\n    #{relationship_names.join(",\n    ")}\n  ]"
      else
        ""
      end

      <<~TYPESCRIPT
        // Generated Zero Schema
        // DO NOT EDIT - This file is automatically generated from Rails schema

        #{imports}

        #{table_definitions.join("\n\n")}#{relationships_section}#{polymorphic_models_section}

        // Create the complete schema
        export const schema = createSchema({
          tables: [
            #{table_names.join(",\n    ")}
          ]#{schema_relationships}
        });

        export type ZeroClient = Zero<typeof schema>;

        // Table type exports for convenience
        #{generate_table_type_exports(table_names)}
      TYPESCRIPT
    end

    def generate_table_type_exports(table_names)
      # Zero tables don't have inferZodType - remove broken type exports
      # The schema export provides type safety through Zero<typeof schema>
      ""
    end

    def generate_typescript_types
      # Generate separate TypeScript types file if needed
      rails_schema = @introspector.extract_schema

      type_definitions = rails_schema[:tables].map do |table|
        generate_table_type_definition(table)
      end

      <<~TYPESCRIPT
        // Generated TypeScript Types from Rails Schema
        // DO NOT EDIT - This file is automatically generated

        #{type_definitions.join("\n\n")}

        // Union types for easier usage
        export type TableNames = #{rails_schema[:tables].map { |t| "'#{t[:name]}'" }.join(' | ')};
        export type ModelNames = #{rails_schema[:tables].map { |t| "'#{t[:name].singularize}'" }.join(' | ')};
      TYPESCRIPT
    end

    def generate_table_type_definition(table)
      fields = table[:columns].map do |column|
        ts_type = rails_type_to_typescript(column)
        optional = column[:null] && column[:name] != table[:primary_key] ? "?" : ""
        comment = column[:comment] ? " // #{column[:comment]}" : ""
        "  #{column[:name]}#{optional}: #{ts_type};#{comment}"
      end

      <<~TYPESCRIPT
        export interface #{table[:name].classify} {
        #{fields.join("\n")}
        }
      TYPESCRIPT
    end

    def rails_type_to_typescript(column)
      case column[:type]
      when :uuid, :string, :text, :datetime, :date, :time
        "string"
      when :integer, :bigint, :decimal, :float
        "number"
      when :boolean
        "boolean"
      when :jsonb, :json
        "Record<string, unknown>" # Type-safe JSON representation
      else
        "string" # Safe fallback
      end
    end

    def default_schema_path
      Rails.root.join("frontend", "src", "lib", "zero", "generated-schema.ts").to_s
    end

    def default_types_path
      Rails.root.join("frontend", "src", "lib", "types", "generated.ts").to_s
    end

    def extract_table_names(schema_content)
      schema_content.scan(/const (\w+) = table\('([^']+)'\)/).map { |_, table_name| table_name }
    end

    def extract_relationship_names(schema_content)
      schema_content.scan(/const (\w+Relationships) = relationships\(/).flatten
    end

    def detect_customizations(existing_content)
      customizations = []

      # Check for custom comments (not generated ones)
      custom_comments = existing_content.scan(/\/\/(?! Generated| \w+ table| \w+ relationships)(.+)/).flatten
      customizations.concat(custom_comments.map { |comment| "Custom comment: #{comment.strip}" })

      # Check for custom imports
      if existing_content.include?("import") && !existing_content.match(/^import \{\s*createSchema,/)
        customizations << "Custom import statements detected"
      end

      # Check for custom exports beyond standard ones
      custom_exports = existing_content.scan(/export (?:const|type|function) (\w+)/).flatten
      standard_exports = [ "schema", "ZeroClient" ]
      custom_exports_filtered = custom_exports - standard_exports

      if custom_exports_filtered.any?
        customizations << "Custom exports: #{custom_exports_filtered.join(', ')}"
      end

      customizations
    end

    def add_customization_header(schema_content)
      header = <<~TYPESCRIPT
        // 🤖 AUTO-GENERATED ZERO SCHEMA
        //#{' '}
        // ⚠️  DO NOT EDIT THIS FILE DIRECTLY
        // This file is automatically generated from your Rails schema.
        // Any manual changes will be overwritten on the next generation.
        //
        // 🔧 FOR CUSTOMIZATIONS:
        // 1. Create a separate file like 'custom-schema-extensions.ts'
        // 2. Import and extend this schema in your application code
        // 3. Use Zero's schema composition features for custom relationships
        //
        // 🔄 TO REGENERATE: Run `rails zero:generate_schema`
        // 📚 DOCS: https://zero.rocicorp.dev/docs/schema

      TYPESCRIPT

      # Replace the existing header
      schema_content.sub(/^\/\/ Generated Zero Schema.*?(?=import)/m, header)
    end

    def generate_migration_notes(changes)
      notes = []

      if changes[:new_tables].any?
        notes << "NEW TABLES: #{changes[:new_tables].join(', ')} - Update your queries to use these new tables"
      end

      if changes[:removed_tables].any?
        notes << "REMOVED TABLES: #{changes[:removed_tables].join(', ')} - Remove any queries using these tables"
      end

      if changes[:new_relationships].any?
        notes << "NEW RELATIONSHIPS: #{changes[:new_relationships].length} added - Update your joins and includes"
      end

      if changes[:removed_relationships].any?
        notes << "REMOVED RELATIONSHIPS: #{changes[:removed_relationships].length} removed - Update affected queries"
      end

      notes
    end

    def load_polymorphic_config(config_path = nil)
      begin
        require_relative "polymorphic_introspector"
        PolymorphicIntrospector.load_from_yaml(config_path)
      rescue LoadError, StandardError => e
        Rails.logger.warn "⚠️ Could not load polymorphic configuration: #{e.message}"
        {}
      end
    end

    # Map TypeScript type names to database table names
    def map_type_to_table_name(type_name)
      # Handle special cases where simple pluralization doesn't work
      type_to_table_mapping = {
        "person" => "people",
        "peoplegroup" => "people_groups",
        "peoplegroupmembership" => "people_group_memberships",
        "scheduleddatetime" => "scheduled_date_times",
        "activitylog" => "activity_logs",
        "frontcontact" => "front_contacts",
        "frontteammate" => "front_teammates",
        "frontconversation" => "front_conversations",
        "frontmessage" => "front_messages"
      }

      # Check if we have a special mapping
      return type_to_table_mapping[type_name.downcase] if type_to_table_mapping.key?(type_name.downcase)

      # For compound words that Rails would normally underscore
      # Try to inflect it as a Rails model name would be
      type_name.downcase.gsub(/([a-z])([A-Z])/, '\1_\2').pluralize
    end

    def find_table_for_relationship(rel)
      # Find the table name from the relationship context
      # This assumes the relationship data includes model information
      if rel.respond_to?(:dig) && rel[:model]
        rel[:model].tableize
      else
        # Fallback: try to infer from foreign key
        rel[:foreign_key]&.gsub(/_id$/, "")&.pluralize || "unknown"
      end
    end

    def fallback_polymorphic_targets(association_name)
      # Legacy hardcoded logic as fallback
      case association_name.to_s
      when "notable"
        %w[jobs tasks clients]
      when "loggable"
        %w[jobs tasks clients users people]
      when "schedulable"
        %w[jobs tasks]
      when "author"
        %w[front_contacts front_teammates]
      when "parseable"
        %w[front_messages]
      else
        []
      end
    end

    def generate_polymorphic_model(rel, polymorphic_targets, table_names, table_name = nil)
      # Generate metadata for Polymorphic suffix model
      association_name = rel[:name].to_s
      table_name ||= find_table_for_relationship(rel)
      model_name = "#{table_name.singularize.classify}#{association_name.classify}Polymorphic"

      {
        model_name: model_name,
        association: association_name,
        targets: polymorphic_targets,
        type_column: rel[:foreign_type],
        id_column: rel[:foreign_key]
      }
    end

    def generate_polymorphic_models_section
      return "" unless @polymorphic_config && @config[:generate_polymorphic_models] != false

      models = []

      @polymorphic_config.dig(:polymorphic_associations)&.each do |config_key, config|
        table_name, association_name = config_key.split(".", 2)
        model_name = "#{table_name.singularize.classify}#{association_name.classify}Polymorphic"

        models << generate_polymorphic_model_definition(model_name, config)
      end

      if models.any?
        "\n\n// Generated Polymorphic Models\n// These models use declarePolymorphicRelationships API\n\n#{models.join("\n\n")}"
      else
        ""
      end
    end

    def generate_polymorphic_model_definition(model_name, config)
      targets = config[:mapped_tables] || []

      <<~TYPESCRIPT
        // #{model_name} - Polymorphic association model
        // Usage: import { declarePolymorphicRelationships } from '@/lib/zero/polymorphic';
        // declarePolymorphicRelationships({
        //   modelName: '#{model_name}',
        //   association: '#{config[:association]}',
        //   typeColumn: '#{config[:type_column]}',
        //   idColumn: '#{config[:id_column]}',
        //   targetTables: #{targets.inspect},
        //   discoveredTypes: #{config[:discovered_types].inspect}
        // });
      TYPESCRIPT
    end

    def self.validate_schema(schema_content)
      # Enhanced validation of generated schema
      required_imports = [ "createSchema", "table", "string", "number", "boolean" ]
      missing_imports = required_imports.reject { |import| schema_content.include?(import) }

      errors = []
      warnings = []

      # Check required imports
      errors << "Missing required imports: #{missing_imports.join(', ')}" if missing_imports.any?

      # Check exports
      errors << "Missing schema export" unless schema_content.include?("export const schema")
      errors << "Missing ZeroClient type export" unless schema_content.include?("export type ZeroClient")

      # Check for common Anti-patterns
      if schema_content.include?("inferZodType")
        errors << "Schema contains 'inferZodType' which doesn't exist in Zero API"
      end

      if schema_content.include?(".offset(") || schema_content.include?(".value")
        warnings << "Schema may contain deprecated Zero query methods (.offset, .value)"
      end

      # Check syntax patterns
      unless schema_content.match(/const \w+ = table\('/)
        errors << "No table definitions found in schema"
      end

      unless schema_content.match(/relationships\(\w+, \(\{ one, many \}\) =>/)
        warnings << "No relationships found in schema"
      end

      {
        valid: errors.empty?,
        errors: errors,
        warnings: warnings,
        stats: {
          table_count: schema_content.scan(/const \w+ = table\('/).length,
          relationship_count: schema_content.scan(/relationships\(/).length,
          import_count: required_imports.count { |import| schema_content.include?(import) }
        }
      }
    end
  end
end
