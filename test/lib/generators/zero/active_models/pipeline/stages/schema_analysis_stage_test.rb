# frozen_string_literal: true

require "test_helper"
require "minitest/mock"
require "generators/zero/active_models/pipeline/stages/schema_analysis_stage"
require "generators/zero/active_models/generation_context"
require "generators/zero/active_models/schema_service"
require "generators/zero/active_models/service_registry"

module Zero
  module Generators
    module Pipeline
      module Stages
        class SchemaAnalysisStageTest < ActiveSupport::TestCase
          def setup
            # Create mock service registry
            @mock_service_registry = Minitest::Mock.new
            @mock_schema_service = Minitest::Mock.new

            # Create the stage with mocked dependencies
            @stage = SchemaAnalysisStage.new(@mock_service_registry)

            # Sample schema data for testing
            @sample_schema_data = {
              tables: [
                {
                  name: "users",
                  columns: [
                    { name: "id", type: "integer", null: false },
                    { name: "email", type: "string", null: false },
                    { name: "name", type: "string", null: true },
                    { name: "created_at", type: "datetime", null: false },
                    { name: "updated_at", type: "datetime", null: false }
                  ]
                },
                {
                  name: "posts",
                  columns: [
                    { name: "id", type: "integer", null: false },
                    { name: "title", type: "string", null: false },
                    { name: "content", type: "text", null: true },
                    { name: "user_id", type: "integer", null: false },
                    { name: "published", type: "boolean", null: false, default: false },
                    { name: "created_at", type: "datetime", null: false }
                  ]
                }
              ],
              relationships: [
                {
                  table: "users",
                  belongs_to: [],
                  has_many: [
                    { name: "posts", foreign_key: "user_id", class_name: "Post" }
                  ],
                  has_one: [],
                  polymorphic: []
                },
                {
                  table: "posts",
                  belongs_to: [
                    { name: "user", foreign_key: "user_id", class_name: "User" }
                  ],
                  has_many: [],
                  has_one: [],
                  polymorphic: []
                }
              ],
              patterns: {
                "users" => {
                  "timestamped" => { columns: [ "created_at", "updated_at" ] },
                  "primary_key" => "id"
                },
                "posts" => {
                  "timestamped" => { columns: [ "created_at" ] },
                  "primary_key" => "id",
                  "soft_deletion" => { column: "deleted_at", gem: "discard" }
                }
              },
              indexes: {
                "users" => [ { name: "index_users_on_email", columns: [ "email" ], unique: true } ],
                "posts" => [ { name: "index_posts_on_user_id", columns: [ "user_id" ] } ]
              },
              constraints: {
                "users" => [],
                "posts" => [ { name: "fk_posts_user_id", type: "foreign_key", table: "users" } ]
              }
            }

            # Basic context for testing
            @basic_context = GenerationContext.new(
              table: { name: "placeholder", columns: [] },
              schema: {},
              options: { dry_run: false },
              metadata: {}
            )
          end

          def teardown
            @mock_service_registry&.verify
            @mock_schema_service&.verify
          end

          # =============================================================================
          # Stage Interface Compliance Tests
          # =============================================================================

          test "implements required stage interface methods" do
            assert_respond_to @stage, :process
            assert_respond_to @stage, :can_run?
            assert_respond_to @stage, :name
            assert_respond_to @stage, :description
            assert_respond_to @stage, :idempotent?
            assert_respond_to @stage, :priority
          end

          test "returns correct stage metadata" do
            assert_equal "SchemaAnalysisStage", @stage.name
            assert_equal "Rails schema analysis and context enrichment", @stage.description
            assert @stage.idempotent?
            assert_equal 10, @stage.priority
          end

          test "can_run returns true for valid context" do
            assert @stage.can_run?(@basic_context)
          end

          test "can_run returns false for invalid context" do
            invalid_context = Object.new
            assert_not @stage.can_run?(invalid_context)
          end

          # =============================================================================
          # Schema Analysis Processing Tests
          # =============================================================================

          test "processes context successfully with complete schema data" do
            setup_schema_service_mock

            result = @stage.process(@basic_context)

            assert_instance_of GenerationContext, result
            assert result.metadata[:schema_analysis_complete]
            assert result.metadata[:full_schema]
            assert_equal 2, result.metadata[:total_tables]
          end

          test "enriches context with single table when table option specified" do
            setup_schema_service_mock

            single_table_context = @basic_context.with_options(table: "users")

            result = @stage.process(single_table_context)

            assert result.metadata[:table]
            assert_equal "users", result.metadata[:table][:name]
            assert result.metadata[:relationships]
            assert result.metadata[:patterns]
            assert result.metadata[:schema_analysis_complete]
          end

          test "enriches context with full schema for multi-table processing" do
            setup_schema_service_mock

            result = @stage.process(@basic_context)

            assert result.metadata[:full_schema]
            assert_equal @sample_schema_data, result.metadata[:full_schema]
            assert result.metadata[:schema_analysis_complete]
            assert_equal 2, result.metadata[:total_tables]
          end

          test "adds stage execution metadata" do
            setup_schema_service_mock

            result = @stage.process(@basic_context)

            stage_metadata = result.metadata[:stage_schema_analysis_stage]
            assert stage_metadata
            assert_equal 2, stage_metadata[:tables_analyzed]
            assert_equal 2, stage_metadata[:relationships_discovered]
            assert stage_metadata[:patterns_detected] > 0
            assert stage_metadata[:executed_at]
            assert_equal "SchemaAnalysisStage", stage_metadata[:stage_name]
          end

          # =============================================================================
          # Schema Filtering Tests
          # =============================================================================

          test "applies exclude_tables filtering correctly" do
            filtered_schema = @sample_schema_data.dup
            filtered_schema[:tables] = filtered_schema[:tables].reject { |t| t[:name] == "posts" }
            filtered_schema[:relationships] = filtered_schema[:relationships].reject { |r| r[:table] == "posts" }

            @mock_service_registry.expect(:get_service, @mock_schema_service, [ :schema ])
            @mock_schema_service.expect(:extract_filtered_schema, filtered_schema) do |options|
              options[:exclude_tables] == [ "posts" ] && options[:include_only].nil?
            end

            context_with_exclusion = @basic_context.with_options(exclude_tables: [ "posts" ])
            result = @stage.process(context_with_exclusion)

            assert_equal 1, result.metadata[:total_tables]
            table_names = result.metadata[:full_schema][:tables].map { |t| t[:name] }
            assert_includes table_names, "users"
            assert_not_includes table_names, "posts"
          end

          test "applies include_only filtering correctly" do
            filtered_schema = @sample_schema_data.dup
            filtered_schema[:tables] = filtered_schema[:tables].select { |t| t[:name] == "users" }
            filtered_schema[:relationships] = filtered_schema[:relationships].select { |r| r[:table] == "users" }

            @mock_service_registry.expect(:get_service, @mock_schema_service, [ :schema ])
            @mock_schema_service.expect(:extract_filtered_schema, filtered_schema) do |options|
              options[:include_only] == [ "users" ]
            end

            context_with_inclusion = @basic_context.with_options(table: "users")
            result = @stage.process(context_with_inclusion)

            assert result.metadata[:table]
            assert_equal "users", result.metadata[:table][:name]
          end

          # =============================================================================
          # Relationship Discovery Tests
          # =============================================================================

          test "discovers and processes relationships correctly" do
            setup_schema_service_mock

            single_table_context = @basic_context.with_options(table: "users")
            result = @stage.process(single_table_context)

            relationships = result.metadata[:relationships]
            assert relationships
            assert relationships[:belongs_to].is_a?(Array)
            assert relationships[:has_many].is_a?(Array)
            assert relationships[:has_one].is_a?(Array)
            assert relationships[:polymorphic].is_a?(Array)

            # Check specific relationship data
            assert_equal 1, relationships[:has_many].length
            assert_equal "posts", relationships[:has_many].first[:name]
          end

          test "handles tables with no relationships" do
            schema_without_relationships = @sample_schema_data.dup
            schema_without_relationships[:relationships] = []

            @mock_service_registry.expect(:get_service, @mock_schema_service, [ :schema ])
            @mock_schema_service.expect(:extract_filtered_schema, schema_without_relationships, [ Hash ])

            single_table_context = @basic_context.with_options(table: "users")
            result = @stage.process(single_table_context)

            relationships = result.metadata[:relationships]
            assert relationships
            assert_empty relationships[:belongs_to]
            assert_empty relationships[:has_many]
            assert_empty relationships[:has_one]
            assert_empty relationships[:polymorphic]
          end

          test "processes polymorphic relationships correctly" do
            schema_with_polymorphic = @sample_schema_data.dup
            schema_with_polymorphic[:relationships] = [
              {
                table: "comments",
                belongs_to: [],
                has_many: [],
                has_one: [],
                polymorphic: [
                  { name: "commentable", type_field: "commentable_type", id_field: "commentable_id" }
                ]
              }
            ]
            schema_with_polymorphic[:tables] = [
              { name: "comments", columns: [
                  { name: "id", type: "integer", null: false },
                  { name: "content", type: "text", null: false },
                  { name: "commentable_type", type: "string", null: false },
                  { name: "commentable_id", type: "integer", null: false }
                ]
              }
            ]

            @mock_service_registry.expect(:get_service, @mock_schema_service, [ :schema ])
            @mock_schema_service.expect(:extract_filtered_schema, schema_with_polymorphic, [ Hash ])

            single_table_context = @basic_context.with_options(table: "comments")
            result = @stage.process(single_table_context)

            relationships = result.metadata[:relationships]
            assert_equal 1, relationships[:polymorphic].length
            assert_equal "commentable", relationships[:polymorphic].first[:name]
          end

          # =============================================================================
          # Pattern Detection Tests
          # =============================================================================

          test "detects and processes table patterns" do
            setup_schema_service_mock

            single_table_context = @basic_context.with_options(table: "posts")
            result = @stage.process(single_table_context)

            patterns = result.metadata[:patterns]
            assert patterns
            assert patterns["timestamped"]
            assert patterns["soft_deletion"]
            assert_equal "discard", patterns["soft_deletion"][:gem]
          end

          test "handles tables without patterns" do
            schema_without_patterns = @sample_schema_data.dup
            schema_without_patterns[:patterns] = {}

            @mock_service_registry.expect(:get_service, @mock_schema_service, [ :schema ])
            @mock_schema_service.expect(:extract_filtered_schema, schema_without_patterns, [ Hash ])

            single_table_context = @basic_context.with_options(table: "users")
            result = @stage.process(single_table_context)

            patterns = result.metadata[:patterns]
            assert patterns
            assert_empty patterns
          end

          test "counts patterns accurately in stage metadata" do
            setup_schema_service_mock

            result = @stage.process(@basic_context)

            stage_metadata = result.metadata[:stage_schema_analysis_stage]
            # users has 2 patterns (timestamped, primary_key), posts has 3 (timestamped, primary_key, soft_deletion)
            assert_equal 5, stage_metadata[:patterns_detected]
          end

          # =============================================================================
          # Schema Validation Tests
          # =============================================================================

          test "validates schema structure integrity" do
            setup_schema_service_mock

            assert_nothing_raised do
              @stage.process(@basic_context)
            end
          end

          test "raises error for missing required schema keys" do
            invalid_schema = { tables: [] } # Missing required keys

            @mock_service_registry.expect(:get_service, @mock_schema_service, [ :schema ])
            @mock_schema_service.expect(:extract_filtered_schema, invalid_schema, [ Hash ])

            error = assert_raises SchemaAnalysisStage::SchemaAnalysisError do
              @stage.process(@basic_context)
            end

            assert_match /Schema missing required keys/, error.message
          end

          test "raises error for empty tables array" do
            empty_schema = {
              tables: [],
              relationships: [],
              patterns: {},
              indexes: {},
              constraints: {}
            }

            @mock_service_registry.expect(:get_service, @mock_schema_service, [ :schema ])
            @mock_schema_service.expect(:extract_filtered_schema, empty_schema, [ Hash ])

            error = assert_raises SchemaAnalysisStage::SchemaAnalysisError do
              @stage.process(@basic_context)
            end

            assert_match /No tables found for generation/, error.message
          end

          test "validates individual table structure" do
            invalid_table_schema = @sample_schema_data.dup
            invalid_table_schema[:tables] = [
              { name: "invalid_table" } # Missing columns
            ]

            @mock_service_registry.expect(:get_service, @mock_schema_service, [ :schema ])
            @mock_schema_service.expect(:extract_filtered_schema, invalid_table_schema, [ Hash ])

            error = assert_raises SchemaAnalysisStage::SchemaAnalysisError do
              @stage.process(@basic_context)
            end

            assert_match /Schema must contain a non-empty tables array/, error.message
          end

          test "validates table has columns" do
            empty_columns_schema = @sample_schema_data.dup
            empty_columns_schema[:tables] = [
              { name: "empty_table", columns: [] }
            ]

            @mock_service_registry.expect(:get_service, @mock_schema_service, [ :schema ])
            @mock_schema_service.expect(:extract_filtered_schema, empty_columns_schema, [ Hash ])

            error = assert_raises SchemaAnalysisStage::SchemaAnalysisError do
              @stage.process(@basic_context)
            end

            assert_match /has no columns/, error.message
          end

          # =============================================================================
          # Error Handling Tests
          # =============================================================================

          test "handles schema service failures gracefully" do
            @mock_service_registry.expect(:get_service, @mock_schema_service, [ :schema ])
            @mock_schema_service.expect(:extract_filtered_schema, -> { raise StandardError.new("Database error") }, [ Hash ])

            error = assert_raises SchemaAnalysisStage::SchemaAnalysisError do
              @stage.process(@basic_context)
            end

            assert_match /Database error/, error.message
            assert_equal @stage, error.stage
            assert_equal @basic_context, error.context
          end

          test "raises specific error when target table not found" do
            schema_missing_target = @sample_schema_data.dup
            schema_missing_target[:tables] = schema_missing_target[:tables].reject { |t| t[:name] == "users" }

            @mock_service_registry.expect(:get_service, @mock_schema_service, [ :schema ])
            @mock_schema_service.expect(:extract_filtered_schema, schema_missing_target, [ Hash ])

            single_table_context = @basic_context.with_options(table: "users")

            error = assert_raises SchemaAnalysisStage::SchemaAnalysisError do
              @stage.process(single_table_context)
            end

            assert_match /Specified table 'users' not found in schema/, error.message
          end

          test "provides comprehensive error context" do
            @mock_service_registry.expect(:get_service, @mock_schema_service, [ :schema ])
            @mock_schema_service.expect(:extract_filtered_schema, -> { raise StandardError.new("Test error") }, [ Hash ])

            error = assert_raises SchemaAnalysisStage::SchemaAnalysisError do
              @stage.process(@basic_context)
            end

            assert_equal @stage, error.stage
            assert_equal @basic_context, error.context
            assert_instance_of StandardError, error.original_error
            assert_match /Test error/, error.message
          end

          # =============================================================================
          # Context Validation Tests
          # =============================================================================

          test "validates context has required structure" do
            invalid_context = GenerationContext.new(
              table: { name: "test", columns: [] },
              schema: {},
              options: "not_a_hash", # Invalid options
              metadata: {}
            )

            error = assert_raises ArgumentError do
              @stage.process(invalid_context)
            end

            assert_match /Context options must be a Hash/, error.message
          end

          test "validates context responds to required methods" do
            invalid_context = Object.new

            error = assert_raises ArgumentError do
              @stage.process(invalid_context)
            end

            assert_match /Context must respond to/, error.message
          end

          # =============================================================================
          # Context Immutability Tests
          # =============================================================================

          test "returns new context instance without modifying original" do
            setup_schema_service_mock

            original_context = @basic_context
            result_context = @stage.process(original_context)

            assert_not_same original_context, result_context
            assert_not_equal original_context.metadata, result_context.metadata

            # Original context should remain unchanged
            assert_empty original_context.metadata
            assert_not_empty result_context.metadata
          end

          test "preserves original context data in new instance" do
            setup_schema_service_mock

            context_with_metadata = @basic_context.with_metadata(custom_key: "custom_value")
            result = @stage.process(context_with_metadata)

            # Should preserve original metadata
            assert_equal "custom_value", result.metadata[:custom_key]

            # Should add new metadata
            assert result.metadata[:schema_analysis_complete]
            assert result.metadata[:full_schema]
          end

          # =============================================================================
          # Integration Tests
          # =============================================================================

          test "integrates correctly with service registry" do
            setup_schema_service_mock

            # Should call service registry to get schema service
            result = @stage.process(@basic_context)

            assert_instance_of GenerationContext, result
            assert result.metadata[:schema_analysis_complete]
          end

          test "works with real GenerationContext patterns" do
            setup_schema_service_mock

            real_options = {
              dry_run: false,
              force: true,
              output_dir: "/tmp/test",
              exclude_tables: [ "schema_migrations", "ar_internal_metadata" ]
            }

            real_context = GenerationContext.new(
              table: { name: "placeholder", columns: [] },
              schema: {},
              options: real_options,
              metadata: { generator_version: "1.0.0" }
            )

            result = @stage.process(real_context)

            assert result.metadata[:generator_version]
            assert result.metadata[:schema_analysis_complete]
            assert result.metadata[:full_schema]
          end

          # =============================================================================
          # Performance and Edge Case Tests
          # =============================================================================

          test "handles large schema datasets efficiently" do
            large_schema = create_large_schema_data(100)

            @mock_service_registry.expect(:get_service, @mock_schema_service, [ :schema ])
            @mock_schema_service.expect(:extract_filtered_schema, large_schema, [ Hash ])

            result = @stage.process(@basic_context)

            assert_equal 100, result.metadata[:total_tables]
            stage_metadata = result.metadata[:stage_schema_analysis_stage]
            assert_equal 100, stage_metadata[:tables_analyzed]
          end

          test "is idempotent with same input" do
            setup_schema_service_mock
            setup_schema_service_mock # Second call for idempotency test

            result1 = @stage.process(@basic_context)
            result2 = @stage.process(@basic_context)

            # Results should be equivalent (though not necessarily identical objects)
            assert_equal result1.metadata[:full_schema], result2.metadata[:full_schema]
            assert_equal result1.metadata[:schema_analysis_complete], result2.metadata[:schema_analysis_complete]
          end

          private

          def setup_schema_service_mock
            @mock_service_registry.expect(:get_service, @mock_schema_service, [ :schema ])
            @mock_schema_service.expect(:extract_filtered_schema, @sample_schema_data, [ Hash ])
          end

          def create_large_schema_data(table_count)
            {
              tables: (1..table_count).map do |i|
                {
                  name: "table_#{i}",
                  columns: [
                    { name: "id", type: "integer", null: false },
                    { name: "name", type: "string", null: false },
                    { name: "created_at", type: "datetime", null: false }
                  ]
                }
              end,
              relationships: [],
              patterns: {},
              indexes: {},
              constraints: {}
            }
          end
        end
      end
    end
  end
end
