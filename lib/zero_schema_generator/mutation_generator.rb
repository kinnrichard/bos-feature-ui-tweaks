# frozen_string_literal: true

require_relative "rails_schema_introspector"
require_relative "mutation_config"

module ZeroSchemaGenerator
  class MutationGenerator
    def initialize(config = nil)
      @config = config || MutationConfig.new
      @introspector = RailsSchemaIntrospector.new
      @generated_files = []
      @dry_run_output = []
    end

    def generate_mutations(options = {})
      # Override config with command-line options
      @config.dry_run = options[:dry_run] if options.key?(:dry_run)
      @config.force_generation = options[:force] if options.key?(:force)

      # Validate configuration
      validation_result = @config.validate_configuration
      unless validation_result[:valid]
        raise "Configuration validation failed:\n#{validation_result[:errors].join("\n")}"
      end

      if validation_result[:warnings].any?
        puts "⚠️ Configuration warnings:"
        validation_result[:warnings].each { |warning| puts "  - #{warning}" }
      end

      # Ensure Rails models are loaded for proper singularization
      # Load models manually to avoid eager_load issues
      if defined?(Rails)
        Dir[Rails.root.join("app/models/**/*.rb")].each do |file|
          begin
            require_dependency file
          rescue LoadError, NameError
            # Skip files that can't be loaded
          end
        end
      end

      # Extract schema and patterns
      puts "🔍 Analyzing Rails schema and detecting patterns..."
      schema_data = @introspector.extract_schema

      # Detect existing mutation files
      existing_files = @config.detect_existing_mutation_files
      if existing_files.any? && !@config.force_generation
        puts "📁 Found existing mutation files:"
        existing_files.each do |file_info|
          puts "  - #{file_info[:name]}.ts (#{file_info[:size]} bytes, modified #{file_info[:modified].strftime('%Y-%m-%d %H:%M')})"
        end
      end

      # Generate mutations for each table
      generation_summary = {
        generated_tables: [],
        skipped_tables: [],
        errors: [],
        dry_run: @config.dry_run,
        generated_files: []
      }

      schema_data[:tables].each do |table|
        table_name = table[:name]
        table_patterns = schema_data[:patterns][table_name] || {}

        # Check exclusions
        if @config.should_exclude_table?(table_name)
          generation_summary[:skipped_tables] << "#{table_name} (excluded via config)"
          next
        end

        # Check if regeneration needed (incremental generation)
        # TODO: Fix incremental detection - commenting out for now
        # unless @config.should_regenerate_table?(table_name, table_patterns)
        #   generation_summary[:skipped_tables] << "#{table_name} (no changes detected)"
        #   next
        # end

        begin
          result = generate_table_mutations(table, table_patterns)
          if result[:generated]
            generation_summary[:generated_tables] << table_name
            generation_summary[:generated_files].concat(result[:files])
          else
            generation_summary[:skipped_tables] << "#{table_name} (#{result[:reason]})"
          end
        rescue => e
          generation_summary[:errors] << "#{table_name}: #{e.message}"
          puts "❌ Error generating mutations for #{table_name}: #{e.message}"
        end
      end

      # Output summary
      output_generation_summary(generation_summary)

      if @config.dry_run
        puts "\n📝 Dry-run output preview:"
        @dry_run_output.each { |output| puts output }
      end

      generation_summary
    end

    def generate_table_mutations(table, patterns)
      table_name = table[:name]

      # Find the Rails model for this table to get proper singular name
      rails_model = ApplicationRecord.descendants.find { |m| m.table_name == table_name }
      singular_name = rails_model ? rails_model.name.underscore : table_name.singularize

      # Skip if no meaningful patterns detected
      if patterns.empty?
        return { generated: false, reason: "no patterns detected" }
      end

      files_to_generate = []

      # Generate .generated.ts file
      generated_content = generate_generated_file(table, patterns)
      generated_file_path = File.join(@config.output_directory, "#{singular_name}.generated.ts")
      files_to_generate << { path: generated_file_path, content: generated_content, type: "generated" }

      # Generate .custom.ts file (only if it doesn't exist)
      custom_file_path = File.join(@config.output_directory, "#{singular_name}.custom.ts")
      unless File.exist?(custom_file_path)
        custom_content = generate_custom_template(table, patterns)
        files_to_generate << { path: custom_file_path, content: custom_content, type: "custom" }
      end

      # Generate main .ts file (merger) - DISABLED: using models/index.ts instead
      # main_file_path = File.join(@config.output_directory, "#{singular_name}.ts")
      # main_content = generate_main_file(table, patterns)
      # files_to_generate << { path: main_file_path, content: main_content, type: "main" }

      # Write files (or dry-run)
      written_files = []
      files_to_generate.each do |file_info|
        if @config.dry_run
          @dry_run_output << "\n=== #{file_info[:path]} ==="
          @dry_run_output << file_info[:content]
        else
          # Check for conflicts on generated files
          if file_info[:type] == "generated" && File.exist?(file_info[:path])
            existing_content = File.read(file_info[:path])
            unless file_generated_by_us?(existing_content)
              unless @config.force_generation
                puts "⚠️  WARNING: #{File.basename(file_info[:path])} appears to have manual modifications."
                puts "   Use --force to overwrite, or review changes before proceeding."
                next # Skip this file but continue with others
              end
            end
          end

          File.write(file_info[:path], file_info[:content])
          written_files << file_info[:path]
          puts "✅ Generated #{File.basename(file_info[:path])}"
        end
      end

      # Update manifest for incremental generation
      unless @config.dry_run
        @config.update_table_manifest(table_name, patterns, written_files)
      end

      { generated: true, files: written_files }
    end

    private

    def generate_generated_file(table, patterns)
      table_name = table[:name]
      singular_name = table_name.singularize

      imports = [
        "import { getZero } from './zero-client';"
      ]

      # Generate TypeScript types
      types = generate_typescript_types(table, patterns)

      mutations = []

      # Generate basic CRUD mutations
      mutations << generate_create_mutation(table, patterns)
      mutations << generate_update_mutation(table, patterns)
      mutations << generate_delete_mutation(table, patterns)
      mutations << generate_upsert_mutation(table, patterns)

      # Generate pattern-specific mutations
      if patterns[:positioning]
        mutations.concat(generate_positioning_mutations(table, patterns[:positioning]))
      end

      if patterns[:soft_deletion]
        if patterns[:soft_deletion][:gem] == "discard"
          mutations << generate_undiscard_mutation(table, patterns[:soft_deletion])
        else
          mutations << generate_restore_mutation(table, patterns[:soft_deletion])
        end
      end

      # Generate ActiveRecord-style queries
      activerecord_queries = generate_activerecord_queries(table, patterns)

      # Generate instance class for ActiveRecord-style operations
      instance_class = generate_instance_class(table, patterns)

      header = generate_file_header("generated")

      <<~TYPESCRIPT
        #{header}

        #{imports.join("\n")}
        import { RecordInstance, type ZeroMutations } from '../models/base/record-instance';

        // Generated TypeScript types for #{table_name}
        #{types}

        // Generated CRUD mutations for #{table_name}

        #{mutations.join("\n\n")}

        #{instance_class}

        // Generated ActiveRecord-style queries for #{table_name}

        #{activerecord_queries}
      TYPESCRIPT
    end

    def generate_custom_template(table, patterns)
      table_name = table[:name]
      singular_name = table_name.singularize

      header = generate_file_header("custom")

      examples = []

      if patterns[:soft_deletion]
        examples << generate_hard_delete_example(table)
      end

      if patterns[:enums]
        examples << generate_enum_transition_example(table, patterns[:enums])
      end

      <<~TYPESCRIPT
        #{header}

        import { getZero } from './zero-client';

        // Custom mutations for #{table_name}
        // Add your custom business logic here

        #{examples.join("\n\n")}

        // Example: Custom validation mutation
        // export async function validateAndUpdate#{singular_name.classify}(id: string, data: any) {
        //   // Add custom validation logic
        //   // Then call standard update
        //   return update#{singular_name.classify}(id, data);
        // }
      TYPESCRIPT
    end

    def generate_main_file(table, patterns)
      table_name = table[:name]
      singular_name = table_name.singularize

      header = generate_file_header("main")

      <<~TYPESCRIPT
        #{header}

        // Main export file for #{table_name} mutations
        // This file merges generated and custom mutations

        // Export all generated mutations
        export * from './#{singular_name}.generated';

        // Export all custom mutations#{'  '}
        export * from './#{singular_name}.custom';

        // Note: Custom mutations with the same name will override generated ones
      TYPESCRIPT
    end

    def generate_typescript_types(table, patterns)
      table_name = table[:name]
      singular_name = table_name.singularize
      class_name = singular_name.classify

      # Generate the main table interface
      interface_fields = []
      create_fields = []
      update_fields = []

      table[:columns].each do |column|
        column_name = column[:name]
        ts_type = rails_type_to_typescript(column)
        nullable = column[:null] ? "| null" : ""
        optional_marker = column[:null] ? "?" : ""

        # Full interface (what exists in database)
        interface_fields << "  #{column_name}#{optional_marker}: #{ts_type}#{nullable};"

        # Create interface (excludes auto-generated fields)
        unless %w[id created_at updated_at].include?(column_name)
          # Handle pattern-specific fields
          soft_deletion_column = patterns.dig(:soft_deletion, :column)
          if patterns[:soft_deletion] && column_name == soft_deletion_column
            # Skip soft deletion column in create - will be null by default
          elsif patterns[:positioning] && column_name == "position"
            create_fields << "  #{column_name}?: #{ts_type}; // Auto-calculated if not provided"
          else
            create_marker = column[:null] ? "?" : ""
            create_fields << "  #{column_name}#{create_marker}: #{ts_type}#{nullable};"
          end
        end

        # Update interface (all fields optional except ID, excludes auto-managed fields)
        unless %w[id created_at updated_at].include?(column_name)
          update_fields << "  #{column_name}?: #{ts_type}#{nullable};"
        end
      end

      <<~TYPESCRIPT
        // TypeScript interfaces for #{table_name}

        /**
         * Complete #{class_name} record as stored in database
         */
        export interface #{class_name} {
        #{interface_fields.join("\n")}
        }

        /**
         * Data required to create a new #{singular_name}
         * Excludes auto-generated fields (id, created_at, updated_at)
         */
        export interface Create#{class_name}Data {
        #{create_fields.join("\n")}
        }

        /**
         * Data for updating an existing #{singular_name}
         * All fields optional, excludes auto-managed fields
         */
        export interface Update#{class_name}Data {
        #{update_fields.join("\n")}
        }

        /**
         * Standard response from mutation operations
         */
        export interface #{class_name}MutationResult {
          id: string;
        }
      TYPESCRIPT
    end

    def generate_create_mutation(table, patterns)
      table_name = table[:name]
      singular_name = table_name.singularize
      class_name = singular_name.classify

      # Generate validation functions for required fields
      required_validations = []
      table[:columns].each do |column|
        next if column[:name] == "id" || column[:name] == table[:primary_key]
        next if %w[created_at updated_at].include?(column[:name])
        soft_deletion_column = patterns.dig(:soft_deletion, :column)
        next if patterns[:soft_deletion] && column[:name] == soft_deletion_column
        next if column[:null] # Only check non-nullable fields

        field_name = column[:name]
        case column[:type]
        when :string, :text
          required_validations << "if (!data.#{field_name}?.trim()) throw new Error('#{field_name.humanize} is required');"
        else
          required_validations << "if (data.#{field_name} === undefined || data.#{field_name} === null) throw new Error('#{field_name.humanize} is required');"
        end
      end

      validation_code = required_validations.any? ? "  // Validate required fields\n  #{required_validations.join("\n  ")}\n" : ""

      <<~TYPESCRIPT
        /**
         * Create a new #{singular_name}
         *#{' '}
         * @param data - The #{singular_name} data to create
         * @returns Promise resolving to the created #{singular_name} ID
         *#{' '}
         * @example
         * ```typescript
         * import { create#{class_name} } from './#{singular_name}';
         *#{' '}
         * const result = await create#{class_name}({
         *   // Add required fields here based on your schema
         * });
         * console.log('Created #{singular_name} with ID:', result.id);
         * ```
         */
        export async function create#{class_name}(data: Create#{class_name}Data): Promise<#{class_name}MutationResult> {
          const zero = getZero();
          if (!zero) {
            throw new Error('Zero client not initialized. Please ensure Zero is properly set up.');
          }
        #{'  '}
        #{validation_code}  // Generate unique ID with validation
          const id = crypto.randomUUID();
          if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
            throw new Error('Failed to generate valid UUID');
          }

          const now = Date.now();

          try {
            await zero.mutate.#{table_name}.insert({
              id,
              ...data,
              created_at: now,
              updated_at: now,
            });

            return { id };
          } catch (error) {
            throw new Error(`Failed to create #{singular_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      TYPESCRIPT
    end

    def generate_update_mutation(table, patterns)
      table_name = table[:name]
      singular_name = table_name.singularize
      class_name = singular_name.classify

      <<~TYPESCRIPT
        /**
         * Update an existing #{singular_name}
         *#{' '}
         * @param id - The UUID of the #{singular_name} to update
         * @param data - Partial #{singular_name} data for updates
         * @returns Promise resolving to the updated #{singular_name} ID
         *#{' '}
         * @example
         * ```typescript
         * import { update#{class_name} } from './#{singular_name}';
         *#{' '}
         * const result = await update#{class_name}('123e4567-e89b-12d3-a456-426614174000', {
         *   // Add fields to update
         * });
         * console.log('Updated #{singular_name}:', result.id);
         * ```
         */
        export async function update#{class_name}(id: string, data: Update#{class_name}Data): Promise<#{class_name}MutationResult> {
          const zero = getZero();
          if (!zero) {
            throw new Error('Zero client not initialized. Please ensure Zero is properly set up.');
          }
        #{'  '}
          // Validate ID format
          if (!id || typeof id !== 'string') {
            throw new Error('#{class_name} ID is required and must be a string');
          }
        #{'  '}
          if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
            throw new Error('#{class_name} ID must be a valid UUID');
          }

          // Validate that we have some data to update
          if (!data || Object.keys(data).length === 0) {
            throw new Error('Update data is required - at least one field must be provided');
          }

          const now = Date.now();

          try {
            await zero.mutate.#{table_name}.update({
              id,
              ...data,
              updated_at: now,
            });

            return { id };
          } catch (error) {
            throw new Error(`Failed to update #{singular_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      TYPESCRIPT
    end

    def generate_delete_mutation(table, patterns)
      table_name = table[:name]
      singular_name = table_name.singularize
      class_name = singular_name.classify

      if patterns[:soft_deletion]
        soft_deletion_column = patterns[:soft_deletion][:column]

        if patterns[:soft_deletion][:gem] == "discard"
          # Generate discard method for discard gem
          <<~TYPESCRIPT
            /**
             * Discard a #{singular_name} (soft deletion using discard gem)
             *#{' '}
             * @param id - The UUID of the #{singular_name} to discard
             * @returns Promise resolving to the discarded #{singular_name} ID
             *#{' '}
             * @example
             * ```typescript
             * import { discard#{class_name} } from './#{singular_name}';
             *#{' '}
             * const result = await discard#{class_name}('123e4567-e89b-12d3-a456-426614174000');
             * console.log('Discarded #{singular_name}:', result.id);
             * ```
             */
            export async function discard#{class_name}(id: string): Promise<#{class_name}MutationResult> {
              const zero = getZero();
              if (!zero) {
                throw new Error('Zero client not initialized. Please ensure Zero is properly set up.');
              }
            #{'  '}
              // Validate ID format
              if (!id || typeof id !== 'string') {
                throw new Error('#{class_name} ID is required and must be a string');
              }
            #{'  '}
              if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
                throw new Error('#{class_name} ID must be a valid UUID');
              }

              const now = Date.now();

              try {
                await zero.mutate.#{table_name}.update({
                  id,
                  #{soft_deletion_column}: now,
                  updated_at: now,
                });

                return { id };
              } catch (error) {
                throw new Error(`Failed to discard #{singular_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }
          TYPESCRIPT
        else
          # Legacy soft delete for deleted_at pattern
          delete_name = @config.get_custom_name("delete")
          <<~TYPESCRIPT
            /**
             * #{delete_name.humanize} a #{singular_name} (soft deletion)
             *#{' '}
             * @param id - The UUID of the #{singular_name} to #{delete_name}
             * @returns Promise resolving to the #{delete_name}d #{singular_name} ID
             *#{' '}
             * @example
             * ```typescript
             * import { #{delete_name}#{class_name} } from './#{singular_name}';
             *#{' '}
             * const result = await #{delete_name}#{class_name}('123e4567-e89b-12d3-a456-426614174000');
             * console.log('#{delete_name.humanize}d #{singular_name}:', result.id);
             * ```
             */
            export async function #{delete_name}#{class_name}(id: string): Promise<#{class_name}MutationResult> {
              const zero = getZero();
              if (!zero) {
                throw new Error('Zero client not initialized. Please ensure Zero is properly set up.');
              }
            #{'  '}
              // Validate ID format
              if (!id || typeof id !== 'string') {
                throw new Error('#{class_name} ID is required and must be a string');
              }
            #{'  '}
              if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
                throw new Error('#{class_name} ID must be a valid UUID');
              }

              const now = Date.now();

              try {
                await zero.mutate.#{table_name}.update({
                  id,
                  #{soft_deletion_column}: now,
                  updated_at: now,
                });

                return { id };
              } catch (error) {
                throw new Error(`Failed to #{delete_name} #{singular_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }
          TYPESCRIPT
        end
      else
        # Generate hard delete
        <<~TYPESCRIPT
          /**
           * Delete a #{singular_name} (permanent deletion)
           *#{' '}
           * @param id - The UUID of the #{singular_name} to delete
           * @returns Promise resolving to the deleted #{singular_name} ID
           *#{' '}
           * @example
           * ```typescript
           * import { delete#{class_name} } from './#{singular_name}';
           *#{' '}
           * const result = await delete#{class_name}('123e4567-e89b-12d3-a456-426614174000');
           * console.log('Deleted #{singular_name}:', result.id);
           * ```
           *#{' '}
           * @warning This is a permanent deletion and cannot be undone
           */
          export async function delete#{class_name}(id: string): Promise<#{class_name}MutationResult> {
            const zero = getZero();
            if (!zero) {
              throw new Error('Zero client not initialized. Please ensure Zero is properly set up.');
            }
          #{'  '}
            // Validate ID format
            if (!id || typeof id !== 'string') {
              throw new Error('#{class_name} ID is required and must be a string');
            }
          #{'  '}
            if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
              throw new Error('#{class_name} ID must be a valid UUID');
            }

            try {
              await zero.mutate.#{table_name}.delete({
                id
              });

              return { id };
            } catch (error) {
              throw new Error(`Failed to delete #{singular_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        TYPESCRIPT
      end
    end

    def generate_upsert_mutation(table, patterns)
      table_name = table[:name]
      singular_name = table_name.singularize
      class_name = singular_name.classify

      <<~TYPESCRIPT
        /**
         * Create or update a #{singular_name} (upsert operation)
         *#{' '}
         * @param data - The #{singular_name} data with optional ID for update, without ID for create
         * @returns Promise resolving to the #{singular_name} ID (generated if creating, provided if updating)
         *#{' '}
         * @example
         * ```typescript
         * import { upsert#{class_name} } from './#{singular_name}';
         *#{' '}
         * // Create new #{singular_name} (no ID provided)
         * const newResult = await upsert#{class_name}({
         *   // Add required fields here
         * });
         *#{' '}
         * // Update existing #{singular_name} (ID provided)
         * const updateResult = await upsert#{class_name}({
         *   id: '123e4567-e89b-12d3-a456-426614174000',
         *   // Add fields to update
         * });
         * ```
         */
        export async function upsert#{class_name}(data: (Create#{class_name}Data & { id?: string }) | (Update#{class_name}Data & { id: string })): Promise<#{class_name}MutationResult> {
          const zero = getZero();
          if (!zero) {
            throw new Error('Zero client not initialized. Please ensure Zero is properly set up.');
          }
        #{'  '}
          // Validate data is provided
          if (!data || Object.keys(data).length === 0) {
            throw new Error('Upsert data is required');
          }

          let id: string;
          const now = Date.now();

          // If ID is provided, validate it for update operation
          if (data.id) {
            if (!data.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
              throw new Error('#{class_name} ID must be a valid UUID');
            }
            id = data.id;
          } else {
            // Generate new ID for create operation
            id = crypto.randomUUID();
            if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
              throw new Error('Failed to generate valid UUID');
            }
          }

          try {
            const upsertData: any = {
              ...data,
              id,
              updated_at: now,
            };
        #{'    '}
            // Set created_at only if this is a new record
            if (!data.id) {
              upsertData.created_at = now;
            }
        #{'    '}
            await zero.mutate.#{table_name}.upsert(upsertData);

            return { id };
          } catch (error) {
            throw new Error(`Failed to upsert #{singular_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      TYPESCRIPT
    end

    def generate_undiscard_mutation(table, soft_deletion_pattern)
      table_name = table[:name]
      singular_name = table_name.singularize
      class_name = singular_name.classify
      soft_deletion_column = soft_deletion_pattern[:column]

      <<~TYPESCRIPT
        /**
         * Undiscard a discarded #{singular_name} (restore using discard gem)
         *#{' '}
         * @param id - The UUID of the #{singular_name} to undiscard
         * @returns Promise resolving to the undiscarded #{singular_name} ID
         *#{' '}
         * @example
         * ```typescript
         * import { undiscard#{class_name} } from './#{singular_name}';
         *#{' '}
         * const result = await undiscard#{class_name}('123e4567-e89b-12d3-a456-426614174000');
         * console.log('Undiscarded #{singular_name}:', result.id);
         * ```
         */
        export async function undiscard#{class_name}(id: string): Promise<#{class_name}MutationResult> {
          const zero = getZero();
          if (!zero) {
            throw new Error('Zero client not initialized. Please ensure Zero is properly set up.');
          }
        #{'  '}
          // Validate ID format
          if (!id || typeof id !== 'string') {
            throw new Error('#{class_name} ID is required and must be a string');
          }
        #{'  '}
          if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
            throw new Error('#{class_name} ID must be a valid UUID');
          }

          const now = Date.now();

          try {
            await zero.mutate.#{table_name}.update({
              id,
              #{soft_deletion_column}: null,
              updated_at: now,
            });

            return { id };
          } catch (error) {
            throw new Error(`Failed to undiscard #{singular_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      TYPESCRIPT
    end

    def generate_restore_mutation(table, soft_deletion_pattern)
      table_name = table[:name]
      singular_name = table_name.singularize
      class_name = singular_name.classify

      restore_name = @config.get_custom_name("restore")

      <<~TYPESCRIPT
        /**
         * #{restore_name.humanize} a soft-deleted #{singular_name}
         *#{' '}
         * @param id - The UUID of the #{singular_name} to #{restore_name}
         * @returns Promise resolving to the #{restore_name}d #{singular_name} ID
         *#{' '}
         * @example
         * ```typescript
         * import { #{restore_name}#{class_name} } from './#{singular_name}';
         *#{' '}
         * const result = await #{restore_name}#{class_name}('123e4567-e89b-12d3-a456-426614174000');
         * console.log('#{restore_name.humanize}d #{singular_name}:', result.id);
         * ```
         */
        export async function #{restore_name}#{class_name}(id: string): Promise<#{class_name}MutationResult> {
          const zero = getZero();
          if (!zero) {
            throw new Error('Zero client not initialized. Please ensure Zero is properly set up.');
          }
        #{'  '}
          // Validate ID format
          if (!id || typeof id !== 'string') {
            throw new Error('#{class_name} ID is required and must be a string');
          }
        #{'  '}
          if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
            throw new Error('#{class_name} ID must be a valid UUID');
          }

          const now = Date.now();

          try {
            await zero.mutate.#{table_name}.update({
              id,
              deleted_at: null,
              updated_at: now,
            });

            return { id };
          } catch (error) {
            throw new Error(`Failed to #{restore_name} #{singular_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      TYPESCRIPT
    end

    def generate_positioning_mutations(table, positioning_pattern)
      table_name = table[:name]
      singular_name = table_name.singularize
      class_name = singular_name.classify

      positioning_pattern[:methods].map do |method_name|
        custom_name = @config.get_custom_name(method_name)

        case method_name
        when "move_before"
          <<~TYPESCRIPT
            /**
             * Move #{singular_name} before another #{singular_name} in the position order
             *#{' '}
             * @param id - The UUID of the #{singular_name} to move
             * @param targetId - The UUID of the #{singular_name} to move before
             * @returns Promise resolving to the moved #{singular_name} ID
             *#{' '}
             * @example
             * ```typescript
             * import { #{custom_name.camelize(:lower)}#{class_name} } from './#{singular_name}';
             *#{' '}
             * const result = await #{custom_name.camelize(:lower)}#{class_name}(
             *   '123e4567-e89b-12d3-a456-426614174000',
             *   '987fcdeb-51d3-12b3-c456-987654321000'
             * );
             * ```
             */
            export async function #{custom_name.camelize(:lower)}#{class_name}(id: string, targetId: string): Promise<#{class_name}MutationResult> {
              const zero = getZero();
              if (!zero) {
                throw new Error('Zero client not initialized. Please ensure Zero is properly set up.');
              }
            #{'  '}
              // Validate IDs
              if (!id || typeof id !== 'string') {
                throw new Error('#{class_name} ID is required and must be a string');
              }
              if (!targetId || typeof targetId !== 'string') {
                throw new Error('Target #{class_name} ID is required and must be a string');
              }
            #{'  '}
              if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
                throw new Error('#{class_name} ID must be a valid UUID');
              }
              if (!targetId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
                throw new Error('Target #{class_name} ID must be a valid UUID');
              }
            #{'  '}
              const now = Date.now();
            #{'  '}
              try {
                // Get all records in the same scope to calculate position
                const view = zero.query.#{table_name}.materialize();
                const allRecords = await view.data;
                const targetRecord = Array.isArray(allRecords) ?#{' '}
                  allRecords.find(record => record.id === targetId) :#{' '}
                  (allRecords && allRecords.id === targetId ? allRecords : null);
                view.destroy();
            #{'    '}
                if (!targetRecord) {
                  throw new Error('Target #{singular_name} not found');
                }
            #{'    '}
                // Calculate position to insert before target (target.position)
                const newPosition = targetRecord.position || 1;
            #{'    '}
                await zero.mutate.#{table_name}.update({
                  id,
                  position: newPosition,
                  updated_at: now,
                });

                return { id };
              } catch (error) {
                throw new Error(`Failed to move #{singular_name} before target: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }
          TYPESCRIPT
        when "move_after"
          <<~TYPESCRIPT
            /**
             * Move #{singular_name} after another #{singular_name} in the position order
             *#{' '}
             * @param id - The UUID of the #{singular_name} to move
             * @param targetId - The UUID of the #{singular_name} to move after
             * @returns Promise resolving to the moved #{singular_name} ID
             *#{' '}
             * @example
             * ```typescript
             * import { #{custom_name.camelize(:lower)}#{class_name} } from './#{singular_name}';
             *#{' '}
             * const result = await #{custom_name.camelize(:lower)}#{class_name}(
             *   '123e4567-e89b-12d3-a456-426614174000',
             *   '987fcdeb-51d3-12b3-c456-987654321000'
             * );
             * ```
             */
            export async function #{custom_name.camelize(:lower)}#{class_name}(id: string, targetId: string): Promise<#{class_name}MutationResult> {
              const zero = getZero();
              if (!zero) {
                throw new Error('Zero client not initialized. Please ensure Zero is properly set up.');
              }
            #{'  '}
              // Validate IDs
              if (!id || typeof id !== 'string') {
                throw new Error('#{class_name} ID is required and must be a string');
              }
              if (!targetId || typeof targetId !== 'string') {
                throw new Error('Target #{class_name} ID is required and must be a string');
              }
            #{'  '}
              if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
                throw new Error('#{class_name} ID must be a valid UUID');
              }
              if (!targetId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
                throw new Error('Target #{class_name} ID must be a valid UUID');
              }
            #{'  '}
              const now = Date.now();
            #{'  '}
              try {
                // Get all records in the same scope to calculate position
                const view = zero.query.#{table_name}.materialize();
                const allRecords = await view.data;
                const targetRecord = Array.isArray(allRecords) ?#{' '}
                  allRecords.find(record => record.id === targetId) :#{' '}
                  (allRecords && allRecords.id === targetId ? allRecords : null);
                view.destroy();
            #{'    '}
                if (!targetRecord) {
                  throw new Error('Target #{singular_name} not found');
                }
            #{'    '}
                // Calculate position to insert after target (target.position + 1)
                const newPosition = (targetRecord.position || 0) + 1;
            #{'    '}
                await zero.mutate.#{table_name}.update({
                  id,
                  position: newPosition,
                  updated_at: now,
                });

                return { id };
              } catch (error) {
                throw new Error(`Failed to move #{singular_name} after target: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }
          TYPESCRIPT
        when "move_to_top"
          <<~TYPESCRIPT
            /**
             * Move #{singular_name} to the first position (position 0)
             *#{' '}
             * @param id - The UUID of the #{singular_name} to move to top
             * @returns Promise resolving to the moved #{singular_name} ID
             *#{' '}
             * @example
             * ```typescript
             * import { #{custom_name.camelize(:lower)}#{class_name} } from './#{singular_name}';
             *#{' '}
             * const result = await #{custom_name.camelize(:lower)}#{class_name}('123e4567-e89b-12d3-a456-426614174000');
             * console.log('Moved #{singular_name} to top:', result.id);
             * ```
             */
            export async function #{custom_name.camelize(:lower)}#{class_name}(id: string): Promise<#{class_name}MutationResult> {
              const zero = getZero();
              if (!zero) {
                throw new Error('Zero client not initialized. Please ensure Zero is properly set up.');
              }
            #{'  '}
              // Validate ID
              if (!id || typeof id !== 'string') {
                throw new Error('#{class_name} ID is required and must be a string');
              }
            #{'  '}
              if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
                throw new Error('#{class_name} ID must be a valid UUID');
              }
            #{'  '}
              const now = Date.now();
            #{'  '}
              try {
                // Move to position 1 (first position)
                await zero.mutate.#{table_name}.update({
                  id,
                  position: 1,
                  updated_at: now,
                });

                return { id };
              } catch (error) {
                throw new Error(`Failed to move #{singular_name} to top: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }
          TYPESCRIPT
        when "move_to_bottom"
          <<~TYPESCRIPT
            /**
             * Move #{singular_name} to the last position
             *#{' '}
             * @param id - The UUID of the #{singular_name} to move to bottom
             * @returns Promise resolving to the moved #{singular_name} ID
             *#{' '}
             * @example
             * ```typescript
             * import { #{custom_name.camelize(:lower)}#{class_name} } from './#{singular_name}';
             *#{' '}
             * const result = await #{custom_name.camelize(:lower)}#{class_name}('123e4567-e89b-12d3-a456-426614174000');
             * console.log('Moved #{singular_name} to bottom:', result.id);
             * ```
             */
            export async function #{custom_name.camelize(:lower)}#{class_name}(id: string): Promise<#{class_name}MutationResult> {
              const zero = getZero();
              if (!zero) {
                throw new Error('Zero client not initialized. Please ensure Zero is properly set up.');
              }
            #{'  '}
              // Validate ID
              if (!id || typeof id !== 'string') {
                throw new Error('#{class_name} ID is required and must be a string');
              }
            #{'  '}
              if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
                throw new Error('#{class_name} ID must be a valid UUID');
              }
            #{'  '}
              const now = Date.now();
            #{'  '}
              try {
                // Get all records to find the maximum position
                const view = zero.query.#{table_name}.materialize();
                const allRecords = await view.data;
                const recordsArray = Array.isArray(allRecords) ? allRecords : (allRecords ? [allRecords] : []);
                const maxPosition = Math.max(...recordsArray.map(r => r.position || 0), 0);
                view.destroy();
            #{'    '}
                await zero.mutate.#{table_name}.update({
                  id,
                  position: maxPosition + 1,
                  updated_at: now,
                });

                return { id };
              } catch (error) {
                throw new Error(`Failed to move #{singular_name} to bottom: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }
          TYPESCRIPT
        end
      end
    end

    def generate_hard_delete_example(table)
      table_name = table[:name]
      singular_name = table_name.singularize
      class_name = singular_name.classify

      <<~TYPESCRIPT
        // Example: Hard delete (permanent removal)
        // export async function hardDelete#{class_name}(id: string) {
        //   const zero = getZero();
        //   await zero.mutate.#{table_name}.delete({ id });
        //   return { id };
        // }
      TYPESCRIPT
    end

    def generate_enum_transition_example(table, enum_patterns)
      table_name = table[:name]
      singular_name = table_name.singularize
      class_name = singular_name.classify

      # Get first enum as example
      enum_pattern = enum_patterns.first
      enum_column = enum_pattern[:column]

      <<~TYPESCRIPT
        // Example: Status transition with business logic
        // export async function transition#{class_name}Status(
        //   id: string,#{' '}
        //   newStatus: '#{enum_pattern[:enum_values].join("' | '")}'
        // ) {
        //   // Add validation logic here
        //   // Check current status, validate transition
        //#{'   '}
        //   return update#{class_name}(id, { #{enum_column}: newStatus });
        // }
      TYPESCRIPT
    end

    def generate_file_header(file_type)
      case file_type
      when "generated"
        <<~TYPESCRIPT
          // 🤖 AUTO-GENERATED ZERO MUTATIONS
          //
          // ⚠️  DO NOT EDIT THIS FILE DIRECTLY
          // This file is automatically generated. Manual changes will be overwritten.
          //
          // 🔧 FOR CUSTOMIZATIONS:
          // Use the corresponding .custom.ts file for your custom mutations
          //
          // 🔄 TO REGENERATE: Run `rails generate zero:mutations`
        TYPESCRIPT
      when "custom"
        <<~TYPESCRIPT
          // ✏️ CUSTOM ZERO MUTATIONS
          // Add your custom mutation logic here
          //
          // 💡 This file is safe to edit - it won't be overwritten by generation
          //
          // 🔗 You can override generated mutations by exporting functions with the same name
          // 📚 Docs: https://zero.rocicorp.dev/docs/mutations
        TYPESCRIPT
      when "main"
        <<~TYPESCRIPT
          // 🔄 ZERO MUTATIONS MERGER
          // This file combines generated and custom mutations
          //
          // ⚠️  This file is automatically regenerated - do not edit directly
          //
          // Import this file to get access to all mutations:
          // import { createUser, updateUser, customUserLogic } from './user';
        TYPESCRIPT
      end
    end

    def file_generated_by_us?(content)
      content.include?("🤖 AUTO-GENERATED ZERO MUTATIONS") ||
      content.include?("🔄 ZERO MUTATIONS MERGER")
    end

    def generate_instance_class(table, patterns)
      table_name = table[:name]
      singular_name = table_name.singularize
      class_name = singular_name.classify
      has_soft_delete = patterns[:soft_deletion]
      has_position = patterns[:positioning]

      # Generate status enum type if applicable
      status_enum_type = nil
      status_enum_values = []
      if patterns[:enums]
        status_pattern = patterns[:enums].find { |enum| enum[:column] == "status" }
        if status_pattern
          status_enum_values = status_pattern[:enum_values] || []
          status_enum_type = status_pattern[:enum_values]&.map { |value| "'#{value}'" }&.join(" | ") || "string"
        end
      end

      # Generate update example fields for documentation
      update_example_fields = []
      table[:columns].each do |column|
        next if %w[id created_at updated_at].include?(column[:name])
        next if has_soft_delete && column[:name] == "deleted_at"

        case column[:name]
        when "title"
          update_example_fields << "title: 'Updated Title'"
        when "status"
          if status_enum_values.any?
            update_example_fields << "status: #{status_enum_values.first}"
          end
        when "position"
          update_example_fields << "position: 10" if has_position
        end

        break if update_example_fields.length >= 2
      end

      update_example = update_example_fields.any? ? update_example_fields.join(", ") : "// fields to update"

      # Check for title and name fields
      has_title = table[:columns].any? { |col| col[:name] == "title" }
      has_name = table[:columns].any? { |col| col[:name] == "name" }

      <<~TYPESCRIPT

        // ActiveRecord-style instance class for individual #{singular_name} records

        /**
         * ActiveRecord-style instance class for #{class_name}
         * Provides Rails-compatible instance methods: update(), delete(), restore()
         *#{' '}
         * Generated from Rails model: #{class_name}
         *#{' '}
         * @example
         * ```typescript
         * const #{singular_name} = #{class_name}.find('123').current;
         * if (#{singular_name}) {
         *   const instance = new #{class_name}Instance(#{singular_name});
         *   await instance.update({ #{update_example} });
         *   await instance.delete(); // #{has_soft_delete ? 'Soft delete' : 'Permanent delete'}
         *   #{has_soft_delete ? 'await instance.restore(); // Restore from soft delete' : ''}
         * }
         * ```
         */
        export class #{class_name}Instance extends RecordInstance<#{class_name}> {
          protected mutations: ZeroMutations<#{class_name}> = {
            update: async (id: string, data: Partial<#{class_name}>) => {
              return await update#{class_name}(id, data as Update#{class_name}Data);
            },
            delete: async (id: string) => {
              return await #{get_delete_method_name(patterns)}#{class_name}(id);
            }#{has_soft_delete ? generate_instance_restore_method(patterns) : ''}
          };

          constructor(data: #{class_name}) {
            super(data);
          }

        #{has_soft_delete ? generate_discard_or_soft_delete_getter(patterns) : ''}
        #{has_position ? generate_position_methods(class_name) : ''}
        #{status_enum_type ? generate_status_method(class_name, status_enum_type) : ''}

          /**
           * Rails-compatible inspect method for debugging
           */
          inspect(): string {
            return `#<#{class_name}Instance id: ${this.data.id}#{has_title ? ', title: "${(this.data as any).title}"' : ''}#{has_name ? ', name: "${(this.data as any).name}"' : ''}>`;
          }
        }

        /**
         * Factory function to create #{class_name}Instance from data
         * Used internally by ReactiveRecord and ActiveRecord
         */
        export function create#{class_name}Instance(data: #{class_name}): #{class_name}Instance {
          return new #{class_name}Instance(data);
        }
      TYPESCRIPT
    end

    def get_delete_method_name(patterns)
      if patterns[:soft_deletion] && patterns[:soft_deletion][:gem] == "discard"
        "discard"
      else
        "delete"
      end
    end

    def generate_instance_restore_method(patterns)
      if patterns[:soft_deletion] && patterns[:soft_deletion][:gem] == "discard"
        ",\n            undiscard: async (id: string) => {\n              return await undiscardTask(id);\n            }"
      else
        ",\n            restore: async (id: string) => {\n              return await restoreTask(id);\n            }"
      end
    end

    def generate_soft_delete_getter
      <<~TYPESCRIPT
        /**
         * Check if this record is soft deleted
         * Rails pattern: checks for deleted_at timestamp
         */
        get isDeleted(): boolean {
          return !!(this.data as any).deleted_at;
        }

      TYPESCRIPT
    end

    def generate_discard_getter
      <<~TYPESCRIPT
        /**
         * Check if this record is discarded
         * Rails discard gem pattern: checks for discarded_at timestamp
         */
        get isDiscarded(): boolean {
          return !!(this.data as any).discarded_at;
        }

        /**
         * Check if this record is kept (not discarded)
         * Rails discard gem pattern: opposite of discarded
         */
        get isKept(): boolean {
          return !(this.data as any).discarded_at;
        }

      TYPESCRIPT
    end

    def generate_discard_or_soft_delete_getter(patterns)
      if patterns[:soft_deletion] && patterns[:soft_deletion][:gem] == "discard"
        generate_discard_getter
      else
        generate_soft_delete_getter
      end
    end

    def generate_position_methods(class_name)
      <<~TYPESCRIPT
        /**
         * Move this record before another record
         * Rails acts_as_list pattern
         */
        async moveBefore(target#{class_name}Id: string): Promise<{ id: string }> {
          return await moveBefore#{class_name}(this.data.id, target#{class_name}Id);
        }

        /**
         * Move this record after another record
         * Rails acts_as_list pattern
         */
        async moveAfter(target#{class_name}Id: string): Promise<{ id: string }> {
          return await moveAfter#{class_name}(this.data.id, target#{class_name}Id);
        }

        /**
         * Move this record to the top of the list
         * Rails acts_as_list pattern
         */
        async moveToTop(): Promise<{ id: string }> {
          return await moveToTop#{class_name}(this.data.id);
        }

        /**
         * Move this record to the bottom of the list
         * Rails acts_as_list pattern
         */
        async moveToBottom(): Promise<{ id: string }> {
          return await moveToBottom#{class_name}(this.data.id);
        }

      TYPESCRIPT
    end

    def generate_status_method(class_name, status_enum_type)
      <<~TYPESCRIPT
        /**
         * Convenience method for updating status
         * Generated from Rails enum
         */
        async updateStatus(status: #{status_enum_type}): Promise<{ id: string }> {
          return await this.update({ status: status as any });
        }

      TYPESCRIPT
    end

    def rails_type_to_typescript(column)
      # Check if this is an enum field and generate string literal union type
      if column[:enum] && column[:enum_values]&.any?
        enum_values = column[:enum_values].map { |value| "'#{value}'" }.join(" | ")
        return enum_values
      end

      case column[:type]
      when :uuid, :string, :text
        "string"
      when :integer, :bigint, :decimal, :float, :datetime
        "number"
      when :boolean
        "boolean"
      when :jsonb, :json
        "any"
      else
        "string"
      end
    end

    def generate_activerecord_queries(table, patterns)
      table_name = table[:name]
      singular_name = table_name.singularize
      class_name = singular_name.classify

      # Determine if this table has soft deletion
      has_soft_deletion = patterns[:soft_deletion]

      # Generate relationship includes based on Rails schema introspection
      relationship_methods = generate_relationship_includes(table, patterns)

      <<~TYPESCRIPT

        // Zero reactive query wrapper using materialize() for active queries
        // This creates active queries that populate Zero's cache and stay synchronized
        function createReactiveQuery<T>(queryBuilder: any, defaultValue: T) {
          let current = defaultValue;
          let resultType: 'loading' | 'success' | 'error' = 'loading';
          let error: Error | null = null;
          let view: any = null;
          let retryCount = 0;
          const maxRetries = 3;

          const execute = async () => {
            try {
              resultType = 'loading';
        #{'      '}
              // Check if Zero is ready
              const zero = getZero();
              if (!zero) {
                setTimeout(() => execute(), 100);
                return;
              }
        #{'      '}
              // Create active query using materialize()
              view = queryBuilder.materialize();
              const result = await view.data;
        #{'      '}
              // If result is null and we haven't retried much, try again
              if ((result === null || result === undefined) && retryCount < maxRetries) {
                retryCount++;
                setTimeout(() => execute(), 500);
                return;
              }
        #{'      '}
              current = result || defaultValue;
              resultType = 'success';
              error = null;
              retryCount = 0;
            } catch (err) {
              error = err instanceof Error ? err : new Error('Unknown error');
              resultType = 'error';
        #{'      '}
              // Retry on error if we haven't exceeded max retries
              if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(() => execute(), 1000);
              }
            }
          };

          // Execute after a small delay to let Zero initialize
          setTimeout(() => execute(), 100);

          return {
            get current() { return current; },
            get value() { return current; },
            get resultType() { return resultType; },
            get error() { return error; },
            refresh: execute,
            destroy: () => view?.destroy()
          };
        }

        /**
         * ActiveRecord-style query interface for #{table_name}
         * Provides offline-capable queries that work with Zero's local database
         */
        export const #{class_name} = {
          /**
           * Find a single #{singular_name} by ID
           * @param id - The UUID of the #{singular_name}
           * @returns Zero query result with the #{singular_name} or null
           *#{' '}
           * @example
           * ```typescript
           * const #{singular_name} = #{class_name}.find('123e4567-e89b-12d3-a456-426614174000');
           * console.log(#{singular_name}.current); // The #{singular_name} object or null
           * ```
           */
          find(id: string) {
            const zero = getZero();
            if (!zero) return { current: null, value: null, resultType: 'loading' as const, error: null };
        #{'    '}
            return createReactiveQuery(
              zero.query.#{table_name}.where('id', id).one(),
              null as #{class_name} | null
            );
          },

          /**
           * Get all #{table_name} (includes discarded records like Rails Task.all)
           * @returns Zero query result with array of #{table_name}
           *#{' '}
           * @example
           * ```typescript
           * const all#{class_name.pluralize} = #{class_name}.all();
           * console.log(all#{class_name.pluralize}.current); // Array of #{table_name} including discarded
           * ```
           */
          all() {
            const zero = getZero();
            if (!zero) return { current: [], value: [], resultType: 'loading' as const, error: null };
        #{'    '}
            return createReactiveQuery(
              zero.query.#{table_name}.orderBy('created_at', 'desc'),
              [] as #{class_name}[]
            );
          },

          /**
           * Find #{table_name} matching conditions (includes discarded)
           * @param conditions - Object with field/value pairs to match
           * @returns Zero query result with array of matching #{table_name}
           *#{' '}
           * @example
           * ```typescript
           * const active#{class_name.pluralize} = #{class_name}.where({ status: 'active' });
           * const clientJobs = #{class_name}.where({ client_id: 'some-uuid' });
           * ```
           */
          where(conditions: Partial<#{class_name}>) {
            const zero = getZero();
            if (!zero) return { current: [], value: [], resultType: 'loading' as const, error: null };
        #{'    '}
            let query = zero.query.#{table_name};
        #{'    '}
            Object.entries(conditions).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                query = query.where(key as any, value);
              }
            });
        #{'    '}
            return createReactiveQuery(
              query.orderBy('created_at', 'desc'),
              [] as #{class_name}[]
            );
          }#{has_soft_deletion ? generate_discard_scopes(table_name, class_name, patterns) : ''}#{relationship_methods}
        };
      TYPESCRIPT
    end

    def generate_discard_scopes(table_name, class_name, patterns)
      soft_deletion_column = patterns[:soft_deletion][:column]

      if patterns[:soft_deletion][:gem] == "discard"
        <<~TYPESCRIPT
          ,

          /**
           * Get only kept (non-discarded) #{table_name} - like Rails Task.kept
           * @returns Zero query result with array of kept #{table_name}
           */
          kept() {
            const zero = getZero();
            if (!zero) return { current: [], value: [], resultType: 'loading' as const, error: null };
        #{'    '}
            return createReactiveQuery(
              zero.query.#{table_name}.where('#{soft_deletion_column}', 'IS', null).orderBy('created_at', 'desc'),
              [] as #{class_name}[]
            );
          },

          /**
           * Get only discarded #{table_name} - like Rails Task.discarded
           * @returns Zero query result with array of discarded #{table_name}
           */
          discarded() {
            const zero = getZero();
            if (!zero) return { current: [], value: [], resultType: 'loading' as const, error: null };
        #{'    '}
            return createReactiveQuery(
              zero.query.#{table_name}.where('#{soft_deletion_column}', 'IS NOT', null).orderBy('created_at', 'desc'),
              [] as #{class_name}[]
            );
          }
        TYPESCRIPT
      else
        # Legacy pattern - keep active scope for deleted_at
        <<~TYPESCRIPT
          ,

          /**
           * Get only active (non-deleted) #{table_name}
           * @returns Zero query result with array of active #{table_name}
           */
          active() {
            const zero = getZero();
            if (!zero) return { current: [], value: [], resultType: 'loading' as const, error: null };
        #{'    '}
            return createReactiveQuery(
              zero.query.#{table_name}.where('#{soft_deletion_column}', 'IS', null).orderBy('created_at', 'desc'),
              [] as #{class_name}[]
            );
          }
        TYPESCRIPT
      end
    end

    def generate_relationship_includes(table, patterns)
      # This would need to be enhanced based on actual Rails relationships
      # For now, return empty string - we can expand this later
      ""
    end

    def output_generation_summary(summary)
      puts "\n📊 Mutation Generation Summary"
      puts "=" * 50

      if summary[:dry_run]
        puts "🔍 DRY RUN MODE - No files were actually created"
      end

      puts "✅ Generated: #{summary[:generated_tables].size} tables"
      summary[:generated_tables].each { |table| puts "  - #{table}" }

      if summary[:skipped_tables].any?
        puts "⏭️ Skipped: #{summary[:skipped_tables].size} tables"
        summary[:skipped_tables].each { |table| puts "  - #{table}" }
      end

      if summary[:errors].any?
        puts "❌ Errors: #{summary[:errors].size}"
        summary[:errors].each { |error| puts "  - #{error}" }
      end

      unless summary[:dry_run]
        puts "📁 Files generated: #{summary[:generated_files].size}"
        summary[:generated_files].each { |file| puts "  - #{File.basename(file)}" }
      end
    end
  end
end
