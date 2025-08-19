# frozen_string_literal: true

require "rails_helper"
require "fileutils"
require "tmpdir"

RSpec.describe "Generation Characterization Tests" do
  # These tests capture the exact current behavior of the TypeScript generation system
  # They serve as a safety net during refactoring - if these tests pass, we haven't
  # broken existing functionality
  #
  # NOTE: These tests do NOT validate correctness, only consistency
  # They document current behavior, including any bugs or quirks

  let(:output_dir) { Rails.root.join("tmp", "characterization_test_#{SecureRandom.hex(8)}") }
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

  describe "Simple model generation (no relationships)" do
    let(:simple_schema) do
      {
        tables: [
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
        ],
        relationships: [],
        patterns: {}
      }
    end

    it "generates data interface with correct types" do
      result = generate_model_set("users", simple_schema)

      data_content = read_generated_file("types/user-data.ts")
      expect(data_content).to include("export interface UserData {")
      expect(data_content).to include("id: number;")
      expect(data_content).to include("email: string;")
      expect(data_content).to include("name?: string;")
      expect(data_content).to include("active: boolean;")
      expect(data_content).to include("created_at: string;")
      expect(data_content).to include("updated_at: string;")
    end

    it "generates active model with correct structure" do
      result = generate_model_set("users", simple_schema)

      active_content = read_generated_file("user.ts")
      expect(active_content).to include("export class User extends BaseModel")
      expect(active_content).to include("static tableName = 'users';")
      expect(active_content).to include("declare id: number;")
      expect(active_content).to include("declare email: string;")
      expect(active_content).to include("declare name: string | null;")
    end

    it "generates reactive model with correct structure" do
      result = generate_model_set("users", simple_schema)

      reactive_content = read_generated_file("reactive-user.ts")
      expect(reactive_content).to include("export class ReactiveUser extends ReactiveBaseModel")
      expect(reactive_content).to include("static tableName = 'users';")
    end

    it "creates all three file types" do
      result = generate_model_set("users", simple_schema)

      expect(file_exists?("types/user-data.ts")).to be(true)
      expect(file_exists?("user.ts")).to be(true)
      expect(file_exists?("reactive-user.ts")).to be(true)
    end
  end

  describe "Model with belongs_to relationships" do
    let(:belongs_to_schema) do
      {
        tables: [
          {
            name: "posts",
            columns: [
              { name: "id", type: :bigint, null: false },
              { name: "title", type: :string, null: false },
              { name: "content", type: :text, null: true },
              { name: "user_id", type: :bigint, null: false },
              { name: "category_id", type: :bigint, null: true },
              { name: "created_at", type: :datetime, null: false },
              { name: "updated_at", type: :datetime, null: false }
            ]
          }
        ],
        relationships: [
          {
            table: "posts",
            belongs_to: [
              { name: "user", foreign_key: "user_id", required: true },
              { name: "category", foreign_key: "category_id", required: false }
            ],
            has_many: [],
            has_one: [],
            polymorphic: []
          }
        ],
        patterns: {}
      }
    end

    it "generates data interface with relationship properties" do
      result = generate_model_set("posts", belongs_to_schema)

      data_content = read_generated_file("types/post-data.ts")
      expect(data_content).to include("user_id: number;")
      expect(data_content).to include("category_id?: number;")
    end

    it "generates active model with relationship imports" do
      result = generate_model_set("posts", belongs_to_schema)

      active_content = read_generated_file("post.ts")
      expect(active_content).to include("import { registerModelRelationships }")
    end

    it "includes relationship registration in active model" do
      result = generate_model_set("posts", belongs_to_schema)

      active_content = read_generated_file("post.ts")
      expect(active_content).to include("registerModelRelationships(Post, {")
      expect(active_content).to include("belongsTo: {")
      expect(active_content).to include("user:")
      expect(active_content).to include("category:")
    end
  end

  describe "Model with has_many relationships" do
    let(:has_many_schema) do
      {
        tables: [
          {
            name: "users",
            columns: [
              { name: "id", type: :bigint, null: false },
              { name: "email", type: :string, null: false },
              { name: "name", type: :string, null: true }
            ]
          }
        ],
        relationships: [
          {
            table: "users",
            belongs_to: [],
            has_many: [
              { name: "posts", foreign_key: "user_id", dependent: "destroy" },
              { name: "comments", foreign_key: "author_id", dependent: "delete_all" }
            ],
            has_one: [],
            polymorphic: []
          }
        ],
        patterns: {}
      }
    end

    it "includes has_many relationships in registration" do
      result = generate_model_set("users", has_many_schema)

      active_content = read_generated_file("user.ts")
      expect(active_content).to include("hasMany: {")
      expect(active_content).to include("posts:")
      expect(active_content).to include("comments:")
    end
  end

  describe "Model with polymorphic relationships" do
    let(:polymorphic_schema) do
      {
        tables: [
          {
            name: "notes",
            columns: [
              { name: "id", type: :bigint, null: false },
              { name: "content", type: :text, null: false },
              { name: "notable_type", type: :string, null: false },
              { name: "notable_id", type: :bigint, null: false }
            ]
          }
        ],
        relationships: [
          {
            table: "notes",
            belongs_to: [],
            has_many: [],
            has_one: [],
            polymorphic: [
              {
                name: "notable",
                type_field: "notable_type",
                id_field: "notable_id",
                allowed_types: [ "Job", "Task", "Client" ]
              }
            ]
          }
        ],
        patterns: {}
      }
    end

    it "generates polymorphic import in active model" do
      result = generate_model_set("notes", polymorphic_schema)

      active_content = read_generated_file("note.ts")
      expect(active_content).to include("import { declarePolymorphicRelationships }")
    end

    it "includes polymorphic relationship declaration" do
      result = generate_model_set("notes", polymorphic_schema)

      active_content = read_generated_file("note.ts")
      expect(active_content).to include("declarePolymorphicRelationships({")
      expect(active_content).to include("tableName: 'notes'")
      expect(active_content).to include("belongsTo: {")
      expect(active_content).to include("notable: {")
      expect(active_content).to include("typeField: 'notable_type'")
      expect(active_content).to include("idField: 'notable_id'")
      expect(active_content).to include('allowedTypes: ["job","task","client"]')
    end
  end

  describe "Model with default values" do
    let(:defaults_schema) do
      {
        tables: [
          {
            name: "tasks",
            columns: [
              { name: "id", type: :bigint, null: false },
              { name: "title", type: :string, null: false },
              { name: "status", type: :string, null: false, default: "open" },
              { name: "priority", type: :string, null: false, default: "normal" },
              { name: "active", type: :boolean, null: false, default: true },
              { name: "lock_version", type: :integer, null: false, default: 0 },
              { name: "metadata", type: :json, null: false, default: "{}" }
            ]
          }
        ],
        relationships: [],
        patterns: {}
      }
    end

    it "includes defaults object in active model" do
      result = generate_model_set("tasks", defaults_schema)

      active_content = read_generated_file("task.ts")
      expect(active_content).to include("static defaults = {")
      expect(active_content).to include("active: true,")
      expect(active_content).to include("lock_version: 0,")
      expect(active_content).to include("metadata: {},")
      expect(active_content).to include("priority: 'normal',")
      expect(active_content).to include("status: 'open',")
    end
  end

  describe "Model with soft deletion (discard gem)" do
    let(:soft_delete_schema) do
      {
        tables: [
          {
            name: "products",
            columns: [
              { name: "id", type: :bigint, null: false },
              { name: "name", type: :string, null: false },
              { name: "discarded_at", type: :datetime, null: true }
            ]
          }
        ],
        relationships: [],
        patterns: {
          "products" => {
            soft_deletion: { gem: "discard", column: "discarded_at" }
          }
        }
      }
    end

    it "includes discard support in active model" do
      result = generate_model_set("products", soft_delete_schema)

      active_content = read_generated_file("product.ts")
      expect(active_content).to include("static supportsDiscard = true;")
    end
  end

  describe "Reserved word handling" do
    let(:reserved_words_schema) do
      {
        tables: [
          {
            name: "classes",
            columns: [
              { name: "id", type: :bigint, null: false },
              { name: "interface", type: :string, null: false },
              { name: "export", type: :string, null: false },
              { name: "import", type: :string, null: true },
              { name: "class", type: :string, null: true }
            ]
          }
        ],
        relationships: [],
        patterns: {}
      }
    end

    it "handles reserved TypeScript keywords in data interface" do
      result = generate_model_set("classes", reserved_words_schema)

      data_content = read_generated_file("types/class-data.ts")
      # Note: This captures current behavior - may not be the desired behavior
      expect(data_content).to include("interface: string;")
      expect(data_content).to include("export: string;")
      expect(data_content).to include("import?: string;")
      expect(data_content).to include("class?: string;")
    end

    it "handles reserved keywords in active model" do
      result = generate_model_set("classes", reserved_words_schema)

      active_content = read_generated_file("class.ts")
      # Note: This captures current behavior for reserved words
      expect(active_content).to include("declare interface: string;")
      expect(active_content).to include("declare export: string;")
    end
  end

  describe "File system operations" do
    it "creates proper directory structure" do
      result = generate_model_set("users", simple_schema)

      expect(Dir.exist?(File.join(output_dir, "types"))).to be(true)
      expect(file_exists?("types/user-data.ts")).to be(true)
    end

    it "generates files with consistent naming" do
      result = generate_model_set("blog_posts", {
        tables: [
          {
            name: "blog_posts",
            columns: [
              { name: "id", type: :bigint, null: false },
              { name: "title", type: :string, null: false }
            ]
          }
        ],
        relationships: [],
        patterns: {}
      })

      expect(file_exists?("types/blog-post-data.ts")).to be(true)
      expect(file_exists?("blog-post.ts")).to be(true)
      expect(file_exists?("reactive-blog-post.ts")).to be(true)
    end
  end

  describe "Error handling behavior" do
    it "handles missing relationship targets gracefully" do
      broken_schema = {
        tables: [
          {
            name: "posts",
            columns: [
              { name: "id", type: :bigint, null: false },
              { name: "user_id", type: :bigint, null: false }
            ]
          }
        ],
        relationships: [
          {
            table: "posts",
            belongs_to: [
              { name: "nonexistent_model", foreign_key: "user_id" }
            ],
            has_many: [],
            has_one: [],
            polymorphic: []
          }
        ],
        patterns: {}
      }

      # This should not raise an error, but document current behavior
      expect { generate_model_set("posts", broken_schema) }.not_to raise_error
    end
  end

  describe "Complex integration scenarios" do
    let(:complex_schema) do
      {
        tables: [
          {
            name: "jobs",
            columns: [
              { name: "id", type: :bigint, null: false },
              { name: "title", type: :string, null: false },
              { name: "description", type: :text, null: true },
              { name: "status", type: :string, null: false, default: "open" },
              { name: "priority", type: :string, null: false, default: "normal" },
              { name: "client_id", type: :bigint, null: false },
              { name: "assignee_id", type: :bigint, null: true },
              { name: "due_at", type: :datetime, null: true },
              { name: "completed_at", type: :datetime, null: true },
              { name: "lock_version", type: :integer, null: false, default: 0 },
              { name: "created_at", type: :datetime, null: false },
              { name: "updated_at", type: :datetime, null: false }
            ]
          }
        ],
        relationships: [
          {
            table: "jobs",
            belongs_to: [
              { name: "client", foreign_key: "client_id", required: true },
              { name: "assignee", foreign_key: "assignee_id", class_name: "User", required: false }
            ],
            has_many: [
              { name: "tasks", foreign_key: "job_id", dependent: "destroy" },
              { name: "time_entries", foreign_key: "job_id", dependent: "destroy" }
            ],
            has_one: [
              { name: "job_summary", foreign_key: "job_id", dependent: "destroy" }
            ],
            polymorphic: []
          }
        ],
        patterns: {
          "jobs" => {
            soft_deletion: { gem: "discard", column: "discarded_at" }
          }
        }
      }
    end

    it "generates complete complex model structure" do
      result = generate_model_set("jobs", complex_schema)

      # Verify all files are created
      expect(file_exists?("types/job-data.ts")).to be(true)
      expect(file_exists?("job.ts")).to be(true)
      expect(file_exists?("reactive-job.ts")).to be(true)

      # Verify data interface includes all fields
      data_content = read_generated_file("types/job-data.ts")
      expect(data_content).to include("client_id: number;")
      expect(data_content).to include("assignee_id?: number;")

      # Verify active model has all relationships
      active_content = read_generated_file("job.ts")
      expect(active_content).to include("belongsTo: {")
      expect(active_content).to include("hasMany: {")
      expect(active_content).to include("hasOne: {")

      # Verify defaults are included
      expect(active_content).to include("static defaults = {")
      expect(active_content).to include("lock_version: 0,")
      expect(active_content).to include("priority: 'normal',")
      expect(active_content).to include("status: 'open',")
    end
  end

  private

  def simple_schema
    @simple_schema ||= {
      tables: [
        {
          name: "users",
          columns: [
            { name: "id", type: :bigint, null: false },
            { name: "email", type: :string, null: false },
            { name: "name", type: :string, null: true },
            { name: "created_at", type: :datetime, null: false },
            { name: "updated_at", type: :datetime, null: false }
          ]
        }
      ],
      relationships: [],
      patterns: {}
    }
  end

  def generate_model_set(table_name, schema_data)
    # Create a GenerationCoordinator and generate the model set
    coordinator = Zero::Generators::GenerationCoordinator.new(
      {
        output_dir: output_dir.to_s,
        skip_prettier: true, # Skip prettier for consistent test output
        dry_run: false
      },
      mock_shell
    )

    table = schema_data[:tables].find { |t| t[:name] == table_name }
    coordinator.generate_model_set(table, schema_data, defer_write: false)
  end

  def file_exists?(relative_path)
    File.exist?(File.join(output_dir, relative_path))
  end

  def read_generated_file(relative_path)
    full_path = File.join(output_dir, relative_path)
    return nil unless File.exist?(full_path)

    File.read(full_path)
  end

  def normalize_content(content)
    # Normalize whitespace for consistent comparison
    content.strip.gsub(/\s+/, " ").gsub(/\n\s*/, "\n")
  end
end
