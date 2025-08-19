# frozen_string_literal: true

require "rails/generators"
require_relative "pipeline/generation_pipeline"

module Zero
  module Generators
    # ActiveModelsGenerator - Generates TypeScript models from Rails schema
    #
    # This generator creates TypeScript interfaces and model classes based on
    # your Rails database schema, providing type-safe access to your data
    # in frontend applications using Zero.js.
    #
    # @example Generate all models
    #   rails generate zero:active_models
    #
    # @example Generate for specific table
    #   rails generate zero:active_models --table=users
    #
    # @example Dry run to see what would be generated
    #   rails generate zero:active_models --dry-run
    #
    class ActiveModelsGenerator < Rails::Generators::Base
      desc "Generate TypeScript ReactiveRecord and ActiveRecord models based on Rails models"

      source_root File.expand_path("templates", __dir__)

      class_option :dry_run, type: :boolean, default: false,
                   desc: "Show what would be generated without creating files"
      class_option :force, type: :boolean, default: false,
                   desc: "Force generation even if conflicts are detected"
      class_option :table, type: :string,
                   desc: "Generate models for specific table only"
      class_option :exclude_tables, type: :array, default: [],
                   desc: "Tables to exclude from generation"
      class_option :output_dir, type: :string,
                   default: "frontend/src/lib/models",
                   desc: "Custom output directory"
      class_option :skip_prettier, type: :boolean, default: false,
                   desc: "Skip Prettier formatting of generated TypeScript files"
      class_option :verbose, type: :boolean, default: false,
                   desc: "Show detailed output"

      # Main generation method
      def generate_models
        shell.say "🚀 Starting ActiveModels TypeScript generation...", :blue
        shell.say "📊 Rails version: #{Rails.version}", :cyan
        shell.say "💎 Ruby version: #{RUBY_VERSION}", :cyan

        # Create and execute the pipeline
        pipeline = create_pipeline
        result = pipeline.execute

        # Report results
        report_generation_results(result)

      rescue => e
        handle_generation_error(e)
        raise
      end

      private

      # Create the generation pipeline with current options
      def create_pipeline
        Pipeline::GenerationPipeline.new(
          options: options.to_h.symbolize_keys
        )
      end

      # Report generation results to user
      def report_generation_results(result)
        if result[:success]
          models_count = result[:generated_models]&.length || 0
          files_count = result[:generated_files]&.length || 0
          execution_time = result[:statistics][:execution_time] || 0

          shell.say "✅ Generated #{models_count} models (#{files_count} files) in #{execution_time}s", :green
        else
          shell.say "❌ Generation failed:", :red
          result[:errors]&.each { |error| shell.say "  - #{error}", :red }
        end
      end

      # Handle generation errors with helpful messaging
      def handle_generation_error(error)
        shell.say "❌ Generation failed with error:", :red
        shell.say "  #{error.message}", :red

        if options[:verbose]
          shell.say "\nBacktrace:", :red
          error.backtrace.first(10).each { |line| shell.say "  #{line}", :red }
        else
          shell.say "  Run with --verbose for more details", :yellow
        end
      end
    end
  end
end
