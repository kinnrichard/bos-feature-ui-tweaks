# frozen_string_literal: true

require "test_helper"
require "minitest/mock"
require "generators/zero/active_models/schema_service"

module Zero
  module Generators
    class SchemaServiceTest < ActiveSupport::TestCase
      def setup
        # Create a mock introspector for testing
        @mock_introspector = Minitest::Mock.new
        @schema_service = SchemaService.new(
          introspector: @mock_introspector,
          cache_enabled: true,
          enable_pattern_detection: true
        )

        # Sample schema data for testing
        @sample_schema = {
          tables: [
            {
              name: "users",
              columns: [
                { name: "id", type: "integer", null: false },
                { name: "email", type: "string", null: false },
                { name: "created_at", type: "datetime", null: false }
              ]
            },
            {
              name: "posts",
              columns: [
                { name: "id", type: "integer", null: false },
                { name: "title", type: "string", null: false },
                { name: "user_id", type: "integer", null: true }
              ]
            },
            {
              name: "schema_migrations",
              columns: [
                { name: "version", type: "string", null: false }
              ]
            }
          ],
          relationships: [
            {
              table: "users",
              belongs_to: [],
              has_many: [ { name: "posts", foreign_key: "user_id" } ],
              has_one: [],
              polymorphic: []
            },
            {
              table: "posts",
              belongs_to: [ { name: "user", foreign_key: "user_id" } ],
              has_many: [],
              has_one: [],
              polymorphic: []
            }
          ],
          patterns: {
            "users" => { "timestamped" => true, "primary_key" => "id" },
            "posts" => { "timestamped" => false, "primary_key" => "id" }
          },
          indexes: {
            "users" => [ { name: "index_users_on_email", columns: [ "email" ] } ],
            "posts" => []
          },
          constraints: {
            "users" => [],
            "posts" => []
          }
        }
      end

      def teardown
        @mock_introspector&.verify
      end

      # =============================================================================
      # Schema Extraction & Filtering Tests
      # =============================================================================

      test "extracts complete schema from Rails introspector" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        result = @schema_service.extract_filtered_schema

        assert_instance_of Hash, result
        assert result.key?(:tables)
        assert result.key?(:relationships)
        assert result.key?(:patterns)
        assert result.key?(:indexes)
        assert result.key?(:constraints)
      end

      test "filters tables by exclude_tables option correctly" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        result = @schema_service.extract_filtered_schema(exclude_tables: [ "posts" ])

        table_names = result[:tables].map { |table| table[:name] }
        assert_includes table_names, "users"
        assert_not_includes table_names, "posts"
      end

      test "filters tables by include_only option correctly" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        result = @schema_service.extract_filtered_schema(include_only: [ "users" ])

        table_names = result[:tables].map { |table| table[:name] }
        assert_includes table_names, "users"
        assert_not_includes table_names, "posts"
        assert_not_includes table_names, "schema_migrations"
      end

      test "combines filtering options appropriately" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        # include_only should override exclude_tables
        result = @schema_service.extract_filtered_schema(
          exclude_tables: [ "users" ],
          include_only: [ "users", "posts" ]
        )

        table_names = result[:tables].map { |table| table[:name] }
        assert_includes table_names, "users"
        assert_includes table_names, "posts"
        assert_not_includes table_names, "schema_migrations"
      end

      test "handles empty filter results gracefully" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        result = @schema_service.extract_filtered_schema(include_only: [ "nonexistent_table" ])

        assert_empty result[:tables]
        assert_instance_of Array, result[:tables]
      end

      # =============================================================================
      # Schema Caching Tests
      # =============================================================================

      test "caches schema data for repeated requests" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        # First call should hit the introspector
        result1 = @schema_service.extract_filtered_schema

        # Second call should use cache (no additional expect needed)
        result2 = @schema_service.extract_filtered_schema

        assert_equal result1, result2
        assert_equal 1, @schema_service.statistics[:cache_hits]
      end

      test "generates unique cache keys for different filters" do
        @mock_introspector.expect(:extract_schema, @sample_schema)
        @mock_introspector.expect(:extract_schema, @sample_schema)

        # Different filter combinations should generate different cache keys
        result1 = @schema_service.extract_filtered_schema(exclude_tables: [ "posts" ])
        result2 = @schema_service.extract_filtered_schema(include_only: [ "users" ])

        # Both should hit the introspector (different cache keys)
        assert_equal 2, @schema_service.statistics[:schema_extractions]
      end

      test "invalidates cache when schema changes" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        # First extraction
        @schema_service.extract_filtered_schema

        # Clear cache manually (simulating schema change)
        cleared_count = @schema_service.clear_cache!

        assert_equal 1, cleared_count
        assert_equal 0, @schema_service.statistics[:cache_hits]
        assert_equal 0, @schema_service.statistics[:cache_misses]
      end

      test "tracks cache hit/miss statistics accurately" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        # First call is cache miss
        @schema_service.extract_filtered_schema
        assert_equal 1, @schema_service.statistics[:cache_misses]
        assert_equal 0, @schema_service.statistics[:cache_hits]

        # Second call is cache hit
        @schema_service.extract_filtered_schema
        assert_equal 1, @schema_service.statistics[:cache_misses]
        assert_equal 1, @schema_service.statistics[:cache_hits]
      end

      # =============================================================================
      # Schema Validation Tests
      # =============================================================================

      test "validates schema structure integrity" do
        # Valid schema should pass validation
        @mock_introspector.expect(:extract_schema, @sample_schema)

        assert_nothing_raised do
          @schema_service.extract_filtered_schema
        end
      end

      test "validates table structure requirements" do
        invalid_schema = @sample_schema.dup
        invalid_schema[:tables] = [ { name: "invalid_table" } ] # Missing columns

        @mock_introspector.expect(:extract_schema, invalid_schema)

        assert_raises SchemaService::SchemaExtractionError do
          @schema_service.extract_filtered_schema
        end
      end

      test "validates relationship references" do
        # Create a completely new invalid schema
        invalid_schema = {
          tables: [
            { name: "users", columns: [ { name: "id", type: "integer", null: false } ] }
          ],
          relationships: [
            { table: "nonexistent_table", belongs_to: [], has_many: [], has_one: [], polymorphic: [] }
          ],
          patterns: {},
          indexes: {},
          constraints: {}
        }

        @mock_introspector.expect(:extract_schema, invalid_schema)

        assert_raises SchemaService::SchemaExtractionError do
          @schema_service.extract_filtered_schema
        end
      end

      test "provides detailed validation error messages" do
        invalid_schema = { tables: "not_an_array" } # Invalid structure

        @mock_introspector.expect(:extract_schema, invalid_schema)

        error = assert_raises SchemaService::SchemaExtractionError do
          @schema_service.extract_filtered_schema
        end

        assert_match /Failed to extract schema/, error.message
      end

      # =============================================================================
      # Table-Specific Operations Tests
      # =============================================================================

      test "retrieves schema for specific table correctly" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        table_schema = @schema_service.schema_for_table("users")

        assert_instance_of Hash, table_schema
        assert table_schema.key?(:table)
        assert table_schema.key?(:relationships)
        assert table_schema.key?(:patterns)
        assert table_schema.key?(:indexes)
        assert table_schema.key?(:constraints)

        assert_equal "users", table_schema[:table][:name]
      end

      test "handles non-existent table requests appropriately" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        assert_raises SchemaService::TableNotFoundError do
          @schema_service.schema_for_table("nonexistent_table")
        end
      end

      test "extracts table patterns when pattern detection enabled" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        patterns = @schema_service.detect_patterns_for_table("users")

        assert_instance_of Hash, patterns
        assert patterns.key?("timestamped")
        assert patterns["timestamped"]
      end

      test "returns comprehensive table metadata" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        table_schema = @schema_service.schema_for_table("users")

        # Check table data
        assert_equal "users", table_schema[:table][:name]
        assert_instance_of Array, table_schema[:table][:columns]

        # Check relationships
        assert_instance_of Hash, table_schema[:relationships]
        assert table_schema[:relationships].key?(:has_many)

        # Check patterns
        assert_instance_of Hash, table_schema[:patterns]

        # Check indexes and constraints
        assert_instance_of Array, table_schema[:indexes]
        assert_instance_of Array, table_schema[:constraints]
      end

      # =============================================================================
      # Performance Optimization Tests
      # =============================================================================

      test "optimizes repeated schema extractions" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        # Multiple extractions with same parameters
        3.times { @schema_service.extract_filtered_schema }

        # Should only extract once, then use cache
        assert_equal 1, @schema_service.statistics[:schema_extractions]
        assert_equal 2, @schema_service.statistics[:cache_hits]
      end

      test "minimizes database introspection calls" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        # First call should hit introspector
        result1 = @schema_service.extract_filtered_schema
        assert_equal 1, @schema_service.statistics[:schema_extractions]
        assert_equal 0, @schema_service.statistics[:cache_hits]

        # Second identical call should use cache
        result2 = @schema_service.extract_filtered_schema
        assert_equal 1, @schema_service.statistics[:schema_extractions]
        assert_equal 1, @schema_service.statistics[:cache_hits]

        assert_equal result1, result2
      end

      test "tracks performance metrics accurately" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        @schema_service.extract_filtered_schema
        stats = @schema_service.performance_stats

        assert_instance_of Hash, stats
        assert stats.key?(:schema_extractions)
        assert stats.key?(:tables_processed)
        assert stats.key?(:cache_hit_ratio)
        assert stats.key?(:cache_entries)

        assert_equal 1, stats[:schema_extractions]
        assert stats[:tables_processed] > 0
      end

      # =============================================================================
      # Error Handling Tests
      # =============================================================================

      test "handles database connection failures gracefully" do
        def @mock_introspector.extract_schema
          raise StandardError.new("Connection failed")
        end

        error = assert_raises SchemaService::SchemaExtractionError do
          @schema_service.extract_filtered_schema
        end

        assert_match /Failed to extract schema/, error.message
        assert_match /Connection failed/, error.message
      end

      test "handles invalid table names with helpful errors" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        error = assert_raises SchemaService::TableNotFoundError do
          @schema_service.schema_for_table("invalid-table-name!")
        end

        assert_match /Table.*not found/, error.message
      end

      test "handles schema extraction timeouts appropriately" do
        def @mock_introspector.extract_schema
          raise Timeout::Error.new("Schema extraction timeout")
        end

        error = assert_raises SchemaService::SchemaExtractionError do
          @schema_service.extract_filtered_schema
        end

        assert_match /Failed to extract schema/, error.message
        assert_equal 1, @schema_service.statistics[:validation_errors]
      end

      # =============================================================================
      # Service Configuration Tests
      # =============================================================================

      test "respects cache_enabled configuration" do
        # Create service with caching disabled
        no_cache_service = SchemaService.new(
          introspector: @mock_introspector,
          cache_enabled: false
        )

        @mock_introspector.expect(:extract_schema, @sample_schema)
        @mock_introspector.expect(:extract_schema, @sample_schema)

        # Should hit introspector both times
        no_cache_service.extract_filtered_schema
        no_cache_service.extract_filtered_schema

        assert_equal 0, no_cache_service.statistics[:cache_hits]
        assert_equal 2, no_cache_service.statistics[:schema_extractions]
      end

      test "respects pattern_detection configuration" do
        # Service with pattern detection disabled
        no_patterns_service = SchemaService.new(
          introspector: @mock_introspector,
          enable_pattern_detection: false
        )

        patterns = no_patterns_service.detect_patterns_for_table("users")

        assert_empty patterns
      end

      # =============================================================================
      # Available Tables and Validation Tests
      # =============================================================================

      test "returns available tables after filtering" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        available = @schema_service.available_tables(exclude_tables: [ "posts" ])

        assert_instance_of Array, available
        assert_includes available, "users"
        assert_not_includes available, "posts"
      end

      test "validates table existence correctly" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        validation = @schema_service.validate_tables_exist([ "users", "posts", "nonexistent" ])

        assert_instance_of Hash, validation
        assert_includes validation[:existing], "users"
        assert_includes validation[:existing], "posts"
        assert_includes validation[:missing], "nonexistent"
        assert_not validation[:all_exist]
      end

      # =============================================================================
      # Pattern Detection Tests
      # =============================================================================

      test "generates pattern reports when enabled" do
        @mock_introspector.expect(:extract_schema, @sample_schema)
        @mock_introspector.expect(:generate_pattern_report, { total_patterns: 2 }) do |patterns|
          patterns
        end

        report = @schema_service.generate_pattern_report

        assert_instance_of Hash, report
        # Should delegate to introspector for detailed pattern analysis
      end

      test "returns disabled status when pattern detection disabled" do
        no_patterns_service = SchemaService.new(
          introspector: @mock_introspector,
          enable_pattern_detection: false
        )

        report = no_patterns_service.generate_pattern_report

        assert_equal false, report[:enabled]
      end

      # =============================================================================
      # Health Check Tests
      # =============================================================================

      test "health check returns comprehensive status when healthy" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        health = @schema_service.health_check

        assert_instance_of Hash, health
        assert_equal :healthy, health[:status]
        assert health.key?(:introspector)
        assert health.key?(:cache_enabled)
        assert health.key?(:pattern_detection)
        assert health.key?(:tables_available)
        assert health.key?(:statistics)

        assert health[:tables_available] > 0
      end

      test "health check reports unhealthy status on errors" do
        def @mock_introspector.extract_schema
          raise StandardError.new("Health check failed")
        end

        health = @schema_service.health_check

        assert_equal :unhealthy, health[:status]
        assert health.key?(:error)
        assert_match /Health check failed/, health[:error]
      end

      test "health check includes service configuration" do
        health = @schema_service.health_check

        assert_instance_of TrueClass, health[:cache_enabled]
        assert_instance_of TrueClass, health[:pattern_detection]
        assert_match /Mock/, health[:introspector]
      end

      # =============================================================================
      # Cache and Performance Integration Tests
      # =============================================================================

      test "cache hit ratio calculation is accurate" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        # Generate some cache hits and misses
        @schema_service.extract_filtered_schema  # miss
        @schema_service.extract_filtered_schema  # hit
        @schema_service.extract_filtered_schema  # hit

        stats = @schema_service.performance_stats

        assert_equal 66.67, stats[:cache_hit_ratio]  # 2 hits out of 3 total
        assert_equal 2, stats[:cache_hits]
        assert_equal 1, stats[:cache_misses]
      end

      test "statistics track all relevant metrics" do
        @mock_introspector.expect(:extract_schema, @sample_schema)
        @mock_introspector.expect(:extract_schema, @sample_schema)

        @schema_service.extract_filtered_schema
        @schema_service.schema_for_table("users")

        stats = @schema_service.statistics

        assert stats[:schema_extractions] > 0
        assert stats[:tables_processed] > 0
        assert_equal 2, stats[:schema_extractions]  # Should be 2 separate extractions
        assert_equal 0, stats[:validation_errors]
      end

      test "clear cache resets statistics appropriately" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        @schema_service.extract_filtered_schema
        @schema_service.extract_filtered_schema  # cache hit

        cleared = @schema_service.clear_cache!

        assert_equal 1, cleared
        assert_equal 0, @schema_service.statistics[:cache_hits]
        assert_equal 0, @schema_service.statistics[:cache_misses]
      end

      # =============================================================================
      # Edge Cases and Integration Tests
      # =============================================================================

      test "handles empty schema gracefully" do
        empty_schema = {
          tables: [],
          relationships: [],
          patterns: {},
          indexes: {},
          constraints: {}
        }

        @mock_introspector.expect(:extract_schema, empty_schema)

        result = @schema_service.extract_filtered_schema

        assert_empty result[:tables]
        assert_instance_of Array, result[:tables]
      end

      test "handles large schema datasets efficiently" do
        # Create a larger schema for testing
        large_schema = {
          tables: (1..100).map do |i|
            {
              name: "table_#{i}",
              columns: [
                { name: "id", type: "integer", null: false },
                { name: "data", type: "string", null: true }
              ]
            }
          end,
          relationships: [],  # No relationships for this test
          patterns: {},
          indexes: {},
          constraints: {}
        }

        @mock_introspector.expect(:extract_schema, large_schema)

        result = @schema_service.extract_filtered_schema

        assert_equal 100, result[:tables].length
        assert_equal 100, @schema_service.statistics[:tables_processed]
      end

      test "filtering preserves data integrity across related structures" do
        @mock_introspector.expect(:extract_schema, @sample_schema)

        # Filter to only include users table
        result = @schema_service.extract_filtered_schema(include_only: [ "users" ])

        # Should only have users table
        assert_equal 1, result[:tables].length
        assert_equal "users", result[:tables].first[:name]

        # Relationships should be filtered to only include users
        user_relationships = result[:relationships].select { |rel| rel[:table] == "users" }
        assert_equal 1, user_relationships.length

        # Patterns should only include users
        assert result[:patterns].key?("users")
        assert_not result[:patterns].key?("posts")
      end
    end
  end
end
