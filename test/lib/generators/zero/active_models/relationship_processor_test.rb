# frozen_string_literal: true

require "test_helper"
require "mocha/minitest"
require "generators/zero/active_models/relationship_processor"

module Zero
  module Generators
    class RelationshipProcessorTest < ActiveSupport::TestCase
      # Disable fixtures for this test since RelationshipProcessor is a pure Ruby class
      SKIP_FIXTURES = true

      def setup
        # Set environment to skip fixtures for this test
        @original_skip_fixtures = ENV["SKIP_FIXTURES"]
        ENV["SKIP_FIXTURES"] = "true"

        @basic_relationships = {
          belongs_to: [
            { name: :user, target_table: "users" },
            { name: :client, target_table: "clients" }
          ],
          has_one: [
            { name: :profile, target_table: "profiles" }
          ],
          has_many: [
            { name: :tasks, target_table: "tasks" },
            { name: :comments, target_table: "comments", through: :commentable }
          ]
        }

        @current_table = "jobs"
        @processor = RelationshipProcessor.new(@basic_relationships, @current_table)
      end

      def teardown
        # Restore original environment setting
        ENV["SKIP_FIXTURES"] = @original_skip_fixtures
      end

      # =============================================================================
      # Initialization Tests
      # =============================================================================

      test "initializes with valid relationships and table name" do
        processor = RelationshipProcessor.new(@basic_relationships, "test_table")

        assert_not_nil processor
        # Test that it can process relationships without error
        result = processor.process_all
        assert_instance_of Hash, result
      end

      test "initializes with nil relationships" do
        processor = RelationshipProcessor.new(nil, "test_table")

        result = processor.process_all

        assert_instance_of Hash, result
        assert_equal "", result[:properties]
        assert_equal "", result[:imports]
        assert_equal "", result[:exclusions]
        assert_equal "", result[:documentation]
        assert_includes result[:registration], "No relationships defined"
      end

      test "initializes with empty relationships hash" do
        processor = RelationshipProcessor.new({}, "test_table")

        result = processor.process_all

        assert_instance_of Hash, result
        assert_equal "", result[:properties]
        assert_equal "", result[:imports]
        assert_equal "", result[:exclusions]
        assert_equal "", result[:documentation]
        assert_includes result[:registration], "No relationships defined"
      end

      # =============================================================================
      # process_all Method Tests
      # =============================================================================

      test "process_all returns hash with all expected keys" do
        result = @processor.process_all

        expected_keys = [ :properties, :imports, :exclusions, :documentation, :registration ]
        expected_keys.each do |key|
          assert result.key?(key), "Result should include #{key}"
        end
      end

      test "process_all generates content for all sections with relationships" do
        result = @processor.process_all

        assert_not_empty result[:properties]
        assert_not_empty result[:imports]
        assert_not_empty result[:exclusions]
        assert_not_empty result[:documentation]
        assert_not_empty result[:registration]
      end

      test "process_all handles empty relationships correctly" do
        empty_processor = RelationshipProcessor.new({}, "empty_table")
        result = empty_processor.process_all

        assert_equal "", result[:properties]
        assert_equal "", result[:imports]
        assert_equal "", result[:exclusions]
        assert_equal "", result[:documentation]
        assert_includes result[:registration], "No relationships defined"
      end

      # =============================================================================
      # Property Generation Tests
      # =============================================================================

      test "generates properties for belongs_to relationships" do
        belongs_to_only = {
          belongs_to: [
            { name: :user, target_table: "users" },
            { name: :client, target_table: "clients" }
          ]
        }
        processor = RelationshipProcessor.new(belongs_to_only, "jobs")

        result = processor.process_all[:properties]

        assert_includes result, "user?: UserData; // belongs_to"
        assert_includes result, "client?: ClientData; // belongs_to"
      end

      test "generates properties for has_one relationships" do
        has_one_only = {
          has_one: [
            { name: :profile, target_table: "profiles" },
            { name: :setting, target_table: "settings" }
          ]
        }
        processor = RelationshipProcessor.new(has_one_only, "users")

        result = processor.process_all[:properties]

        assert_includes result, "profile?: ProfileData; // has_one"
        assert_includes result, "setting?: SettingData; // has_one"
      end

      test "generates properties for has_many relationships" do
        has_many_only = {
          has_many: [
            { name: :tasks, target_table: "tasks" },
            { name: :comments, target_table: "comments" }
          ]
        }
        processor = RelationshipProcessor.new(has_many_only, "jobs")

        result = processor.process_all[:properties]

        assert_includes result, "tasks?: TaskData[]; // has_many"
        assert_includes result, "comments?: CommentData[]; // has_many"
      end

      test "generates mixed relationship properties correctly" do
        result = @processor.process_all[:properties]

        # belongs_to
        assert_includes result, "user?: UserData; // belongs_to"
        assert_includes result, "client?: ClientData; // belongs_to"

        # has_one
        assert_includes result, "profile?: ProfileData; // has_one"

        # has_many
        assert_includes result, "tasks?: TaskData[]; // has_many"
        assert_includes result, "comments?: CommentData[]; // has_many"
      end

      test "property generation handles empty relationships" do
        empty_processor = RelationshipProcessor.new({}, "test_table")

        result = empty_processor.process_all[:properties]

        assert_equal "", result
      end

      # =============================================================================
      # Import Generation Tests
      # =============================================================================

      test "generates import statements for relationships" do
        result = @processor.process_all[:imports]

        assert_includes result, "import type { UserData } from './user-data';"
        assert_includes result, "import type { ClientData } from './client-data';"
        assert_includes result, "import type { ProfileData } from './profile-data';"
        assert_includes result, "import type { TaskData } from './task-data';"
        assert_includes result, "import type { CommentData } from './comment-data';"
      end

      test "converts class names to kebab-case for import paths" do
        complex_names = {
          belongs_to: [
            { name: :user_account, target_table: "user_accounts" },
            { name: :billing_address, target_table: "billing_addresses" }
          ]
        }
        processor = RelationshipProcessor.new(complex_names, "orders")

        result = processor.process_all[:imports]

        assert_includes result, "import type { UserAccountData } from './user-account-data';"
        assert_includes result, "import type { BillingAddressData } from './billing-address-data';"
      end

      test "skips self-referencing imports to avoid circular dependencies" do
        self_ref_relationships = {
          belongs_to: [
            { name: :parent, target_table: "jobs" }, # Self-reference
            { name: :user, target_table: "users" }
          ]
        }
        processor = RelationshipProcessor.new(self_ref_relationships, "jobs")

        result = processor.process_all[:imports]

        assert_not_includes result, "JobData"
        assert_includes result, "import type { UserData } from './user-data';"
      end

      test "import generation handles empty relationships" do
        empty_processor = RelationshipProcessor.new({}, "test_table")

        result = empty_processor.process_all[:imports]

        assert_equal "", result
      end

      test "import generation handles only self-referencing relationships" do
        self_only = {
          belongs_to: [
            { name: :parent, target_table: "categories" }
          ]
        }
        processor = RelationshipProcessor.new(self_only, "categories")

        result = processor.process_all[:imports]

        assert_equal "", result
      end

      # =============================================================================
      # Exclusion Generation Tests
      # =============================================================================

      test "generates exclusion string for relationship properties" do
        result = @processor.process_all[:exclusions]

        expected_exclusions = [ "user", "client", "profile", "tasks", "comments" ]
        expected_exclusions.each do |exclusion|
          assert_includes result, exclusion
        end

        assert_match(/^, '.*'$/, result) # Should start with comma and quotes
      end

      test "exclusion generation handles single relationship" do
        single_rel = {
          belongs_to: [
            { name: :user, target_table: "users" }
          ]
        }
        processor = RelationshipProcessor.new(single_rel, "jobs")

        result = processor.process_all[:exclusions]

        assert_equal ", 'user'", result
      end

      test "exclusion generation handles empty relationships" do
        empty_processor = RelationshipProcessor.new({}, "test_table")

        result = empty_processor.process_all[:exclusions]

        assert_equal "", result
      end

      test "exclusion generation uses camelCase property names" do
        snake_case_names = {
          belongs_to: [
            { name: :user_account, target_table: "user_accounts" },
            { name: :billing_info, target_table: "billing_infos" }
          ]
        }
        processor = RelationshipProcessor.new(snake_case_names, "orders")

        result = processor.process_all[:exclusions]

        assert_includes result, "userAccount"
        assert_includes result, "billingInfo"
      end

      # =============================================================================
      # Documentation Generation Tests
      # =============================================================================

      test "generates documentation for relationships" do
        result = @processor.process_all[:documentation]

        assert_includes result, "Relationships (loaded via includes()):"
        assert_includes result, "- user: belongs_to User"
        assert_includes result, "- client: belongs_to Client"
        assert_includes result, "- profile: has_one Profile"
        assert_includes result, "- tasks: has_many Task"
        assert_includes result, "- comments: has_many Comment, through: commentable"
      end

      test "documentation handles has_many through relationships" do
        through_relationships = {
          has_many: [
            { name: :tags, target_table: "tags", through: :taggings },
            { name: :categories, target_table: "categories", through: :categorizations }
          ]
        }
        processor = RelationshipProcessor.new(through_relationships, "posts")

        result = processor.process_all[:documentation]

        assert_includes result, "- tags: has_many Tag, through: taggings"
        assert_includes result, "- categories: has_many Category, through: categorizations"
      end

      test "documentation generation handles empty relationships" do
        empty_processor = RelationshipProcessor.new({}, "test_table")

        result = empty_processor.process_all[:documentation]

        assert_equal "", result
      end

      test "documentation uses camelCase property names and PascalCase class names" do
        mixed_names = {
          belongs_to: [
            { name: :user_account, target_table: "user_accounts" }
          ],
          has_many: [
            { name: :order_items, target_table: "order_items" }
          ]
        }
        processor = RelationshipProcessor.new(mixed_names, "orders")

        result = processor.process_all[:documentation]

        assert_includes result, "- userAccount: belongs_to UserAccount"
        assert_includes result, "- orderItems: has_many OrderItem"
      end

      # =============================================================================
      # Registration Generation Tests
      # =============================================================================

      test "generates registration code for relationships" do
        result = @processor.process_all[:registration]

        assert_includes result, "registerModelRelationships('jobs', {"
        assert_includes result, "user: { type: 'belongsTo', model: 'User' }"
        assert_includes result, "client: { type: 'belongsTo', model: 'Client' }"
        assert_includes result, "profile: { type: 'hasOne', model: 'Profile' }"
        assert_includes result, "tasks: { type: 'hasMany', model: 'Task' }"
        assert_includes result, "comments: { type: 'hasMany', model: 'Comment' }"
        assert_includes result, "});"
      end

      test "registration maps relationship types correctly" do
        type_mapping_test = {
          belongs_to: [ { name: :user, target_table: "users" } ],
          has_one: [ { name: :profile, target_table: "profiles" } ],
          has_many: [ { name: :tasks, target_table: "tasks" } ]
        }
        processor = RelationshipProcessor.new(type_mapping_test, "test_table")

        result = processor.process_all[:registration]

        assert_includes result, "type: 'belongsTo'"
        assert_includes result, "type: 'hasOne'"
        assert_includes result, "type: 'hasMany'"
      end

      test "registration generation handles no relationships" do
        empty_processor = RelationshipProcessor.new({}, "test_table")

        result = empty_processor.process_all[:registration]

        assert_equal "// No relationships defined for this model", result
      end

      test "registration uses camelCase property names and PascalCase model names" do
        naming_test = {
          belongs_to: [
            { name: :user_account, target_table: "user_accounts" }
          ]
        }
        processor = RelationshipProcessor.new(naming_test, "orders")

        result = processor.process_all[:registration]

        assert_includes result, "userAccount: { type: 'belongsTo', model: 'UserAccount' }"
      end

      # =============================================================================
      # Iterator Tests
      # =============================================================================

      test "each_relationship iterates through all valid relationships" do
        relationships_found = []

        @processor.each_relationship do |type, relation, metadata|
          relationships_found << [ type, relation[:name], metadata[:target_class] ]
        end

        expected = [
          [ :belongs_to, :user, "User" ],
          [ :belongs_to, :client, "Client" ],
          [ :has_one, :profile, "Profile" ],
          [ :has_many, :tasks, "Task" ],
          [ :has_many, :comments, "Comment" ]
        ]

        assert_equal expected, relationships_found
      end

      test "each_relationship returns enumerator when no block given" do
        enumerator = @processor.each_relationship

        assert_instance_of Enumerator, enumerator
        assert_equal 5, enumerator.count
      end

      test "each_relationship skips invalid relationships" do
        invalid_relationships = {
          belongs_to: [
            { name: :user, target_table: "users" }, # Valid
            { name: :invalid }, # Missing target_table
            { target_table: "clients" }, # Missing name
            { name: :valid_client, target_table: "clients" } # Valid
          ]
        }
        processor = RelationshipProcessor.new(invalid_relationships, "jobs")

        valid_relationships = []
        processor.each_relationship do |type, relation, metadata|
          valid_relationships << relation[:name]
        end

        assert_equal [ :user, :valid_client ], valid_relationships
      end

      test "each_relationship skips excluded tables" do
        # Use actual excluded table name from the constant
        excluded_table_name = ZeroSchemaGenerator::RailsSchemaIntrospector::EXCLUDED_TABLES.first

        relationships_with_excluded = {
          belongs_to: [
            { name: :user, target_table: "users" }, # Should be included
            { name: :excluded_rel, target_table: excluded_table_name } # Should be excluded
          ]
        }
        processor = RelationshipProcessor.new(relationships_with_excluded, "jobs")

        valid_relationships = []
        processor.each_relationship do |type, relation, metadata|
          valid_relationships << relation[:name]
        end

        assert_equal [ :user ], valid_relationships
      end

      # =============================================================================
      # Validation Method Tests
      # =============================================================================

      test "validates valid relationships correctly" do
        valid_relation = { name: :user, target_table: "users" }

        result = @processor.send(:valid_relationship?, valid_relation)

        assert result
      end

      test "validates invalid relationships correctly" do
        invalid_relations = [
          { name: :user }, # Missing target_table
          { target_table: "users" }, # Missing name
          { name: nil, target_table: "users" }, # Nil name
          { name: :user, target_table: nil }, # Nil target_table
          {} # Empty hash
        ]

        invalid_relations.each do |relation|
          result = @processor.send(:valid_relationship?, relation)
          assert_not result, "Should be invalid: #{relation.inspect}"
        end
      end

      test "excluded_table? checks exclusion list correctly" do
        # Use actual values from the excluded tables constant
        excluded_tables = ZeroSchemaGenerator::RailsSchemaIntrospector::EXCLUDED_TABLES

        # Test with actual excluded table names
        excluded_tables.first(2).each do |excluded_table|
          assert @processor.send(:excluded_table?, excluded_table)
        end

        # Test with non-excluded table names
        assert_not @processor.send(:excluded_table?, "users")
        assert_not @processor.send(:excluded_table?, "regular_table")
        assert_not @processor.send(:excluded_table?, "posts")
      end

      test "relationship_metadata generates correct metadata" do
        relation = { name: :user_account, target_table: "user_accounts" }

        metadata = @processor.send(:relationship_metadata, relation)

        assert_equal "UserAccount", metadata[:target_class]
        assert_equal "userAccount", metadata[:property_name]
      end

      # =============================================================================
      # Edge Cases and Integration Tests
      # =============================================================================

      test "handles nil relationship arrays gracefully" do
        nil_arrays = {
          belongs_to: nil,
          has_one: [ { name: :profile, target_table: "profiles" } ],
          has_many: nil
        }
        processor = RelationshipProcessor.new(nil_arrays, "users")

        result = processor.process_all

        # Should only process the has_one relationship
        assert_includes result[:properties], "profile?: ProfileData; // has_one"
        assert_not_includes result[:properties], "belongs_to"
        assert_not_includes result[:properties], "has_many"
      end

      test "handles mixed valid and invalid relationships" do
        mixed_relationships = {
          belongs_to: [
            { name: :user, target_table: "users" }, # Valid
            { name: :invalid }, # Invalid - no target_table
            { name: :client, target_table: "clients" } # Valid
          ]
        }
        processor = RelationshipProcessor.new(mixed_relationships, "jobs")

        result = processor.process_all

        # Should only include valid relationships
        assert_includes result[:properties], "user?: UserData"
        assert_includes result[:properties], "client?: ClientData"
        assert_not_includes result[:properties], "invalid"
      end

      test "handles empty arrays in relationship hash" do
        empty_arrays = {
          belongs_to: [],
          has_one: [ { name: :profile, target_table: "profiles" } ],
          has_many: []
        }
        processor = RelationshipProcessor.new(empty_arrays, "users")

        result = processor.process_all

        # Should only process the has_one relationship
        assert_includes result[:properties], "profile?: ProfileData; // has_one"
        assert_equal 1, result[:properties].lines.count
      end

      test "processes complex real-world relationship scenario" do
        complex_relationships = {
          belongs_to: [
            { name: :user, target_table: "users" },
            { name: :client, target_table: "clients" },
            { name: :assigned_technician, target_table: "users" }
          ],
          has_one: [
            { name: :job_status, target_table: "job_statuses" }
          ],
          has_many: [
            { name: :tasks, target_table: "tasks" },
            { name: :notes, target_table: "notes" },
            { name: :attachments, target_table: "attachments", through: :job_attachments },
            { name: :tags, target_table: "tags", through: :taggings }
          ]
        }
        processor = RelationshipProcessor.new(complex_relationships, "jobs")

        result = processor.process_all

        # Verify all sections are generated correctly
        assert_not_empty result[:properties]
        assert_not_empty result[:imports]
        assert_not_empty result[:exclusions]
        assert_not_empty result[:documentation]
        assert_not_empty result[:registration]

        # Verify specific content
        assert_includes result[:properties], "assignedTechnician?: UserData; // belongs_to"
        assert_includes result[:documentation], "through: job_attachments"
        assert_includes result[:registration], "assignedTechnician: { type: 'belongsTo', model: 'User' }"
      end

      test "has_relationships? method works correctly" do
        # Test with relationships
        assert @processor.send(:has_relationships?)

        # Test with empty relationships
        empty_processor = RelationshipProcessor.new({}, "test")
        assert_not empty_processor.send(:has_relationships?)

        # Test with nil relationships
        nil_processor = RelationshipProcessor.new(nil, "test")
        assert_not nil_processor.send(:has_relationships?)

        # Test with only empty arrays
        empty_arrays_processor = RelationshipProcessor.new({
          belongs_to: [],
          has_one: [],
          has_many: []
        }, "test")
        assert_not empty_arrays_processor.send(:has_relationships?)
      end
    end
  end
end
