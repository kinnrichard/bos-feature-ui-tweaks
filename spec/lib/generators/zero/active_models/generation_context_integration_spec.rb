# frozen_string_literal: true

require "rails_helper"
require "fileutils"
require "tmpdir"

RSpec.describe "GenerationContext Integration" do
  # Integration tests that verify the GenerationContext works seamlessly
  # with the existing GenerationCoordinator and service infrastructure

  let(:output_dir) { Rails.root.join("tmp", "context_integration_test_#{SecureRandom.hex(8)}") }
  let(:mock_shell) { instance_double("Thor::Shell::Basic") }

  before do
    FileUtils.rm_rf(output_dir) if output_dir.exist?
    FileUtils.mkdir_p(output_dir)

    # Mock shell to silence output during tests
    allow(mock_shell).to receive(:say)
    allow(mock_shell).to receive(:say_status)
  end

  after do
    FileUtils.rm_rf(output_dir) if output_dir.exist?
  end

  describe "GenerationContext integration with GenerationCoordinator" do
    let(:test_table) do
      {
        name: "users",
        columns: [
          { name: "id", type: :bigint, null: false },
          { name: "email", type: :string, null: false },
          { name: "name", type: :string, null: true },
          { name: "active", type: :boolean, null: false, default: true },
          { name: "created_at", type: :datetime, null: false },
          { name: "updated_at", type: :datetime, null: false }
        ]
      }
    end

    let(:test_schema) do
      {
        tables: [ test_table ],
        relationships: [
          {
            table: "users",
            belongs_to: [],
            has_many: [
              { name: "posts", foreign_key: "user_id" }
            ],
            has_one: [],
            polymorphic: []
          }
        ],
        patterns: {
          "users" => {
            soft_deletion: { gem: "discard", column: "discarded_at" }
          }
        }
      }
    end

    let(:test_relationships) do
      {
        belongs_to: [],
        has_many: [
          { name: "posts", foreign_key: "user_id" }
        ],
        has_one: [],
        polymorphic: []
      }
    end

    let(:test_options) do
      {
        output_dir: output_dir.to_s,
        skip_prettier: true,
        dry_run: false,
        force: false
      }
    end

    let(:coordinator) do
      Zero::Generators::GenerationCoordinator.new(test_options, mock_shell)
    end

    it "creates GenerationContext from table and schema data" do
      context = Zero::Generators::GenerationContext.new(
        table: test_table,
        schema: test_schema,
        relationships: test_relationships,
        options: test_options
      )

      expect(context.table_name).to eq("users")
      expect(context.model_name).to eq("User")
      expect(context.kebab_name).to eq("user")
      expect(context.has_relationships?).to be(true)
      expect(context.supports_soft_deletion?).to be(true)
    end

    it "generates files using context-based methods" do
      context = Zero::Generators::GenerationContext.new(
        table: test_table,
        schema: test_schema,
        relationships: test_relationships,
        options: test_options
      )

      result = coordinator.generate_model_set_with_context(context, defer_write: false)

      # Verify the result structure
      expect(result).to include(
        :table_name,
        :model_name,
        :class_name,
        :kebab_name,
        :files_generated,
        :model_metadata
      )

      expect(result[:table_name]).to eq("users")
      expect(result[:class_name]).to eq("User")
      expect(result[:kebab_name]).to eq("user")

      # Verify files were created
      expect(result[:files_generated]).to have(3).items
      expect(file_exists?("types/user-data.ts")).to be(true)
      expect(file_exists?("user.ts")).to be(true)
      expect(file_exists?("reactive-user.ts")).to be(true)
    end

    it "produces equivalent output to original method" do
      # Generate using original method
      original_result = coordinator.generate_model_set(test_table, test_schema, defer_write: false)
      original_data_content = read_generated_file("types/user-data.ts")
      original_active_content = read_generated_file("user.ts")
      original_reactive_content = read_generated_file("reactive-user.ts")

      # Clean up files
      FileUtils.rm_rf(Dir.glob(File.join(output_dir, "*")))

      # Generate using context-based method
      context = Zero::Generators::GenerationContext.new(
        table: test_table,
        schema: test_schema,
        relationships: test_relationships,
        options: test_options
      )

      context_result = coordinator.generate_model_set_with_context(context, defer_write: false)
      context_data_content = read_generated_file("types/user-data.ts")
      context_active_content = read_generated_file("user.ts")
      context_reactive_content = read_generated_file("reactive-user.ts")

      # Compare results (content should be equivalent)
      expect(context_result[:table_name]).to eq(original_result[:table_name])
      expect(context_result[:class_name]).to eq(original_result[:class_name])
      expect(context_result[:kebab_name]).to eq(original_result[:kebab_name])

      # Compare generated content (normalize whitespace)
      expect(normalize_content(context_data_content)).to eq(normalize_content(original_data_content))
      expect(normalize_content(context_active_content)).to eq(normalize_content(original_active_content))
      expect(normalize_content(context_reactive_content)).to eq(normalize_content(original_reactive_content))
    end

    it "supports immutable context updates during generation" do
      base_context = Zero::Generators::GenerationContext.new(
        table: test_table,
        schema: test_schema,
        relationships: {},
        options: test_options
      )

      # Update context with relationships
      updated_context = base_context.with_relationships(test_relationships)

      # Verify original context unchanged
      expect(base_context.has_relationships?).to be(false)
      expect(updated_context.has_relationships?).to be(true)

      # Generate with updated context
      result = coordinator.generate_model_set_with_context(updated_context, defer_write: false)
      active_content = read_generated_file("user.ts")

      # Verify relationships were included
      expect(active_content).to include("hasMany:")
      expect(active_content).to include("posts:")
    end

    it "handles context metadata correctly" do
      context = Zero::Generators::GenerationContext.new(
        table: test_table,
        schema: test_schema,
        relationships: test_relationships,
        options: test_options,
        metadata: { custom_field: "test_value" }
      )

      # Add generated content to context
      content_context = context.with_generated_content("// test content")

      expect(content_context.generated_content).to eq("// test content")
      expect(content_context.metadata[:custom_field]).to eq("test_value")
    end

    it "handles dry run mode correctly" do
      dry_run_options = test_options.merge(dry_run: true)

      context = Zero::Generators::GenerationContext.new(
        table: test_table,
        schema: test_schema,
        relationships: test_relationships,
        options: dry_run_options
      )

      expect(context.dry_run?).to be(true)

      result = coordinator.generate_model_set_with_context(context, defer_write: false)

      # Verify dry run files listed but not created
      expect(result[:dry_run_files]).to have(3).items
      expect(result[:files_generated]).to be_empty
      expect(file_exists?("types/user-data.ts")).to be(false)
    end

    it "provides helpful debugging information" do
      context = Zero::Generators::GenerationContext.new(
        table: test_table,
        schema: test_schema,
        relationships: test_relationships,
        options: test_options
      )

      inspection = context.inspect
      expect(inspection).to include("GenerationContext")
      expect(inspection).to include('table="users"')
      expect(inspection).to include('model="User"')

      string_repr = context.to_s
      expect(string_repr).to eq("GenerationContext(users -> User)")
    end
  end

  describe "Error handling and edge cases" do
    it "gracefully handles missing Rails models" do
      # Create a table for which no Rails model exists
      fake_table = {
        name: "nonexistent_models",
        columns: [
          { name: "id", type: :bigint, null: false },
          { name: "name", type: :string, null: false }
        ]
      }

      fake_schema = {
        tables: [ fake_table ],
        relationships: [],
        patterns: {}
      }

      context = Zero::Generators::GenerationContext.new(
        table: fake_table,
        schema: fake_schema,
        options: test_options
      )

      # Should not raise error and should use table name for model name
      expect(context.table_name).to eq("nonexistent_models")
      expect(context.model_name).to eq("NonexistentModel")
    end

    it "validates context data during construction" do
      expect {
        Zero::Generators::GenerationContext.new(
          table: nil,
          schema: test_schema
        )
      }.to raise_error(Zero::Generators::GenerationContext::ValidationError, "table is required")

      expect {
        Zero::Generators::GenerationContext.new(
          table: test_table,
          schema: nil
        )
      }.to raise_error(Zero::Generators::GenerationContext::ValidationError, "schema is required")
    end

    it "handles context updates that fail validation" do
      context = Zero::Generators::GenerationContext.new(
        table: test_table,
        schema: test_schema
      )

      # Should validate new relationships data type
      expect {
        context.with_relationships("invalid")
      }.to raise_error(Zero::Generators::GenerationContext::ValidationError, "relationships must be a Hash")
    end
  end

  private

  def file_exists?(relative_path)
    File.exist?(File.join(output_dir, relative_path))
  end

  def read_generated_file(relative_path)
    full_path = File.join(output_dir, relative_path)
    return nil unless File.exist?(full_path)

    File.read(full_path)
  end

  def normalize_content(content)
    # Normalize whitespace and remove timestamps for comparison
    content&.gsub(/\/\/ Auto-generated.*\n/, "")
           &.gsub(/\s+/, " ")
           &.gsub(/\n\s*/, "\n")
           &.strip
  end
end
