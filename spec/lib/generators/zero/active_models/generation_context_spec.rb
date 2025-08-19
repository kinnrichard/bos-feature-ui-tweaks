# frozen_string_literal: true

require "rails_helper"
require_relative "../../../../../lib/generators/zero/active_models/generation_context"

RSpec.describe Zero::Generators::GenerationContext do
  let(:valid_table) do
    {
      name: "users",
      columns: [
        { name: "id", type: :bigint },
        { name: "email", type: :string },
        { name: "name", type: :string },
        { name: "created_at", type: :datetime },
        { name: "updated_at", type: :datetime }
      ]
    }
  end

  let(:valid_schema) do
    {
      tables: [ valid_table ],
      relationships: [],
      patterns: {
        "users" => {
          soft_deletion: { gem: "discard", column: "discarded_at" }
        }
      }
    }
  end

  let(:valid_relationships) do
    {
      belongs_to: [
        { name: "organization", foreign_key: "organization_id" }
      ],
      has_many: [
        { name: "posts", foreign_key: "user_id" }
      ],
      has_one: [],
      polymorphic: []
    }
  end

  let(:valid_options) do
    {
      dry_run: false,
      output_dir: "frontend/src/lib/models",
      force: false,
      skip_prettier: false
    }
  end

  let(:valid_metadata) do
    {
      execution_time: 0.5,
      service_stats: { template_renders: 3 }
    }
  end

  describe "#initialize" do
    it "creates context with required parameters" do
      context = described_class.new(
        table: valid_table,
        schema: valid_schema
      )

      expect(context.table).to eq(valid_table)
      expect(context.schema).to eq(valid_schema)
      expect(context.relationships).to eq({})
      expect(context.options).to eq({})
      expect(context.metadata).to eq({})
    end

    it "creates context with all parameters" do
      context = described_class.new(
        table: valid_table,
        schema: valid_schema,
        relationships: valid_relationships,
        options: valid_options,
        metadata: valid_metadata
      )

      expect(context.table).to eq(valid_table)
      expect(context.schema).to eq(valid_schema)
      expect(context.relationships).to eq(valid_relationships)
      expect(context.options).to eq(valid_options)
      expect(context.metadata).to eq(valid_metadata)
    end

    it "freezes all attributes for immutability" do
      context = described_class.new(
        table: valid_table,
        schema: valid_schema,
        relationships: valid_relationships,
        options: valid_options,
        metadata: valid_metadata
      )

      expect(context.table).to be_frozen
      expect(context.schema).to be_frozen
      expect(context.relationships).to be_frozen
      expect(context.options).to be_frozen
      expect(context.metadata).to be_frozen
      expect(context).to be_frozen
    end

    it "validates required table parameter" do
      expect {
        described_class.new(table: nil, schema: valid_schema)
      }.to raise_error(Zero::Generators::GenerationContext::ValidationError, "table is required")
    end

    it "validates table is a Hash" do
      expect {
        described_class.new(table: "invalid", schema: valid_schema)
      }.to raise_error(Zero::Generators::GenerationContext::ValidationError, "table must be a Hash")
    end

    it "validates table has name" do
      invalid_table = valid_table.dup
      invalid_table.delete(:name)

      expect {
        described_class.new(table: invalid_table, schema: valid_schema)
      }.to raise_error(Zero::Generators::GenerationContext::ValidationError, "table[:name] is required")
    end

    it "validates table name is not empty" do
      invalid_table = valid_table.merge(name: "")

      expect {
        described_class.new(table: invalid_table, schema: valid_schema)
      }.to raise_error(Zero::Generators::GenerationContext::ValidationError, "table[:name] is required")
    end

    it "validates table has columns" do
      invalid_table = valid_table.dup
      invalid_table.delete(:columns)

      expect {
        described_class.new(table: invalid_table, schema: valid_schema)
      }.to raise_error(Zero::Generators::GenerationContext::ValidationError, "table[:columns] is required")
    end

    it "validates table columns is an Array" do
      invalid_table = valid_table.merge(columns: "invalid")

      expect {
        described_class.new(table: invalid_table, schema: valid_schema)
      }.to raise_error(Zero::Generators::GenerationContext::ValidationError, "table[:columns] must be an Array")
    end

    it "validates required schema parameter" do
      expect {
        described_class.new(table: valid_table, schema: nil)
      }.to raise_error(Zero::Generators::GenerationContext::ValidationError, "schema is required")
    end

    it "validates schema is a Hash" do
      expect {
        described_class.new(table: valid_table, schema: "invalid")
      }.to raise_error(Zero::Generators::GenerationContext::ValidationError, "schema must be a Hash")
    end

    it "validates relationships is a Hash" do
      expect {
        described_class.new(
          table: valid_table,
          schema: valid_schema,
          relationships: "invalid"
        )
      }.to raise_error(Zero::Generators::GenerationContext::ValidationError, "relationships must be a Hash")
    end

    it "validates options is a Hash" do
      expect {
        described_class.new(
          table: valid_table,
          schema: valid_schema,
          options: "invalid"
        )
      }.to raise_error(Zero::Generators::GenerationContext::ValidationError, "options must be a Hash")
    end

    it "validates metadata is a Hash" do
      expect {
        described_class.new(
          table: valid_table,
          schema: valid_schema,
          metadata: "invalid"
        )
      }.to raise_error(Zero::Generators::GenerationContext::ValidationError, "metadata must be a Hash")
    end
  end

  describe "immutable update methods" do
    let(:context) do
      described_class.new(
        table: valid_table,
        schema: valid_schema,
        relationships: valid_relationships,
        options: valid_options,
        metadata: valid_metadata
      )
    end

    describe "#with_relationships" do
      let(:new_relationships) do
        {
          belongs_to: [ { name: "company", foreign_key: "company_id" } ],
          has_many: [],
          has_one: [ { name: "profile", foreign_key: "user_id" } ]
        }
      end

      it "returns a new instance" do
        new_context = context.with_relationships(new_relationships)
        expect(new_context).not_to be(context)
        expect(new_context).to be_a(described_class)
      end

      it "updates relationships" do
        new_context = context.with_relationships(new_relationships)
        expect(new_context.relationships).to eq(new_relationships)
      end

      it "preserves other attributes" do
        new_context = context.with_relationships(new_relationships)
        expect(new_context.table).to eq(context.table)
        expect(new_context.schema).to eq(context.schema)
        expect(new_context.options).to eq(context.options)
        expect(new_context.metadata).to eq(context.metadata)
      end

      it "freezes the new instance" do
        new_context = context.with_relationships(new_relationships)
        expect(new_context).to be_frozen
        expect(new_context.relationships).to be_frozen
      end
    end

    describe "#with_options" do
      let(:new_options) do
        { dry_run: true, force: true, output_dir: "/custom/path" }
      end

      it "returns a new instance" do
        new_context = context.with_options(new_options)
        expect(new_context).not_to be(context)
        expect(new_context).to be_a(described_class)
      end

      it "updates options" do
        new_context = context.with_options(new_options)
        expect(new_context.options).to eq(new_options)
      end

      it "preserves other attributes" do
        new_context = context.with_options(new_options)
        expect(new_context.table).to eq(context.table)
        expect(new_context.schema).to eq(context.schema)
        expect(new_context.relationships).to eq(context.relationships)
        expect(new_context.metadata).to eq(context.metadata)
      end
    end

    describe "#with_metadata" do
      let(:additional_metadata) do
        { generated_content: "typescript code", performance_stats: { time: 1.2 } }
      end

      it "returns a new instance" do
        new_context = context.with_metadata(additional_metadata)
        expect(new_context).not_to be(context)
        expect(new_context).to be_a(described_class)
      end

      it "merges metadata with existing" do
        new_context = context.with_metadata(additional_metadata)
        expected_metadata = valid_metadata.merge(additional_metadata)
        expect(new_context.metadata).to eq(expected_metadata)
      end

      it "preserves other attributes" do
        new_context = context.with_metadata(additional_metadata)
        expect(new_context.table).to eq(context.table)
        expect(new_context.schema).to eq(context.schema)
        expect(new_context.relationships).to eq(context.relationships)
        expect(new_context.options).to eq(context.options)
      end
    end

    describe "#with_generated_content" do
      let(:typescript_content) { "export class User { id: number; }" }

      it "returns a new instance" do
        new_context = context.with_generated_content(typescript_content)
        expect(new_context).not_to be(context)
      end

      it "stores content in metadata" do
        new_context = context.with_generated_content(typescript_content)
        expect(new_context.metadata[:generated_content]).to eq(typescript_content)
      end

      it "preserves existing metadata" do
        new_context = context.with_generated_content(typescript_content)
        expect(new_context.metadata[:execution_time]).to eq(valid_metadata[:execution_time])
      end
    end
  end

  describe "computed properties" do
    let(:context) do
      described_class.new(table: valid_table, schema: valid_schema)
    end

    describe "#table_name" do
      it "returns table name from table data" do
        expect(context.table_name).to eq("users")
      end

      it "memoizes the result" do
        result1 = context.table_name
        result2 = context.table_name
        expect(result1).to be(result2)
      end
    end

    describe "#model_name" do
      it "returns camelized model name" do
        expect(context.model_name).to eq("User")
      end

      it "handles plural table names" do
        posts_table = valid_table.merge(name: "blog_posts")
        posts_context = described_class.new(table: posts_table, schema: valid_schema)
        expect(posts_context.model_name).to eq("BlogPost")
      end

      it "memoizes the result" do
        result1 = context.model_name
        result2 = context.model_name
        expect(result1).to be(result2)
      end
    end

    describe "#kebab_name" do
      it "returns kebab-case model name" do
        expect(context.kebab_name).to eq("user")
      end

      it "handles multi-word model names" do
        posts_table = valid_table.merge(name: "blog_posts")
        posts_context = described_class.new(table: posts_table, schema: valid_schema)
        expect(posts_context.kebab_name).to eq("blog-post")
      end

      it "memoizes the result" do
        result1 = context.kebab_name
        result2 = context.kebab_name
        expect(result1).to be(result2)
      end
    end

    describe "#typescript_filenames" do
      it "returns hash with all file types" do
        filenames = context.typescript_filenames
        expect(filenames).to be_a(Hash)
        expect(filenames.keys).to contain_exactly(:data, :active, :reactive)
      end

      it "generates correct file paths" do
        filenames = context.typescript_filenames
        expect(filenames[:data]).to eq("types/user-data.ts")
        expect(filenames[:active]).to eq("user.ts")
        expect(filenames[:reactive]).to eq("reactive-user.ts")
      end

      it "memoizes the result" do
        result1 = context.typescript_filenames
        result2 = context.typescript_filenames
        expect(result1).to be(result2)
      end
    end

    describe "#has_relationships?" do
      it "returns false when no relationships" do
        expect(context.has_relationships?).to be(false)
      end

      it "returns true when has relationships" do
        context_with_rels = context.with_relationships(valid_relationships)
        expect(context_with_rels.has_relationships?).to be(true)
      end

      it "returns false when relationships are empty arrays" do
        empty_rels = { belongs_to: [], has_many: [], has_one: [] }
        context_with_empty = context.with_relationships(empty_rels)
        expect(context_with_empty.has_relationships?).to be(false)
      end
    end

    describe "#has_polymorphic_relationships?" do
      it "returns false when no polymorphic relationships" do
        expect(context.has_polymorphic_relationships?).to be(false)
      end

      it "returns true when has polymorphic relationships" do
        poly_rels = valid_relationships.merge(
          polymorphic: [ { name: "notable", types: [ "Job", "Task" ] } ]
        )
        context_with_poly = context.with_relationships(poly_rels)
        expect(context_with_poly.has_polymorphic_relationships?).to be(true)
      end
    end

    describe "#patterns" do
      it "returns patterns for this table" do
        expected_patterns = { soft_deletion: { gem: "discard", column: "discarded_at" } }
        expect(context.patterns).to eq(expected_patterns)
      end

      it "returns empty hash when no patterns" do
        schema_without_patterns = valid_schema.merge(patterns: {})
        context_no_patterns = described_class.new(
          table: valid_table,
          schema: schema_without_patterns
        )
        expect(context_no_patterns.patterns).to eq({})
      end

      it "memoizes the result" do
        result1 = context.patterns
        result2 = context.patterns
        expect(result1).to be(result2)
      end
    end

    describe "#supports_soft_deletion?" do
      it "returns true when soft deletion pattern exists" do
        expect(context.supports_soft_deletion?).to be(true)
      end

      it "returns false when no soft deletion pattern" do
        schema_no_soft_delete = valid_schema.merge(patterns: { "users" => {} })
        context_no_soft = described_class.new(
          table: valid_table,
          schema: schema_no_soft_delete
        )
        expect(context_no_soft.supports_soft_deletion?).to be(false)
      end
    end

    describe "#generated_content" do
      it "returns nil when no content generated" do
        expect(context.generated_content).to be_nil
      end

      it "returns content from metadata" do
        content = "export class User {}"
        context_with_content = context.with_generated_content(content)
        expect(context_with_content.generated_content).to eq(content)
      end
    end

    describe "#dry_run?" do
      it "returns false by default" do
        expect(context.dry_run?).to be(false)
      end

      it "returns true when dry_run option is true" do
        dry_run_context = context.with_options(dry_run: true)
        expect(dry_run_context.dry_run?).to be(true)
      end

      it "returns false when dry_run option is false" do
        no_dry_run_context = context.with_options(dry_run: false)
        expect(no_dry_run_context.dry_run?).to be(false)
      end
    end
  end

  describe "string representation" do
    let(:context) do
      described_class.new(
        table: valid_table,
        schema: valid_schema,
        relationships: valid_relationships,
        options: valid_options
      )
    end

    describe "#inspect" do
      it "provides detailed debugging information" do
        inspection = context.inspect
        expect(inspection).to include(described_class.name)
        expect(inspection).to include('table="users"')
        expect(inspection).to include('model="User"')
        expect(inspection).to include("relationships=")
        expect(inspection).to include("options=")
      end
    end

    describe "#to_s" do
      it "provides compact string representation" do
        string_repr = context.to_s
        expect(string_repr).to eq("GenerationContext(users -> User)")
      end
    end
  end

  describe "error handling" do
    it "handles missing Rails models gracefully" do
      # This test ensures the context doesn't fail when Rails models aren't available
      context = described_class.new(table: valid_table, schema: valid_schema)
      expect { context.model_name }.not_to raise_error
    end
  end
end
