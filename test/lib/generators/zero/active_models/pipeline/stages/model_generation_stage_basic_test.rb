# frozen_string_literal: true

require "minitest/autorun"
require "minitest/mock"
require "pathname"
require "time"

# Minimal Rails test environment setup
module Rails
  def self.root
    Pathname.new("/fake/rails/root")
  end

  def self.env
    "test"
  end
end

# Mock Time.current for testing
class Time
  def self.current
    new
  end
end

require_relative "../../../../../../../lib/generators/zero/active_models/pipeline/stages/model_generation_stage"
require_relative "../../../../../../../lib/generators/zero/active_models/generation_context"

module Zero
  module Generators
    module Pipeline
      module Stages
        class ModelGenerationStageBasicTest < Minitest::Test
          def setup
            @mock_service_registry = Minitest::Mock.new
            @stage = ModelGenerationStage.new(@mock_service_registry)

            # Sample table data
            @sample_table = {
              name: "users",
              columns: [
                { name: "id", type: "integer", null: false },
                { name: "email", type: "string", null: false }
              ]
            }

            # Sample relationships
            @sample_relationships = {
              belongs_to: [],
              has_many: [],
              has_one: [],
              polymorphic: []
            }

            # Basic context for testing
            @basic_context = GenerationContext.new(
              table: @sample_table,
              schema: { tables: [ @sample_table ] },
              relationships: @sample_relationships,
              options: { dry_run: false },
              metadata: { patterns: {} }
            )
          end

          def teardown
            @mock_service_registry&.verify
          end

          def test_initializes_with_service_registry
            stage = ModelGenerationStage.new(@mock_service_registry)

            refute_nil stage
            # Just check that stage has a name
            assert_equal "ModelGenerationStage", stage.name
          end

          def test_returns_correct_stage_metadata
            metadata = @stage.metadata

            assert_equal "ModelGenerationStage", metadata[:name]
            assert_equal "Zero::Generators::Pipeline::Stages::ModelGenerationStage", metadata[:class]
            assert_includes metadata[:description], "TypeScript"
            assert_equal true, metadata[:can_skip]
          end

          def test_stage_is_idempotent
            assert_equal true, @stage.idempotent?
          end

          def test_stage_has_correct_priority
            assert_equal 30, @stage.priority
          end

          def test_can_run_returns_true_for_valid_context
            assert_equal true, @stage.can_run?(@basic_context)
          end

          def test_can_run_returns_false_for_context_without_table
            # Use a mock context since GenerationContext validates table presence
            mock_context = Minitest::Mock.new
            mock_context.expect :table, nil
            # No need to expect respond_to? since we return false before checking it

            result = @stage.can_run?(mock_context)
            assert_equal false, result

            mock_context.verify
          end

          def test_can_run_returns_false_for_context_without_columns
            # Create a context with empty columns array
            table_with_empty_columns = { name: "users", columns: [] }
            context = GenerationContext.new(
              table: table_with_empty_columns,
              schema: { tables: [ table_with_empty_columns ] },
              relationships: @sample_relationships,
              options: { dry_run: false },
              metadata: {}
            )

            assert_equal false, @stage.can_run?(context)
          end

          def test_count_lines_helper_method
            content = "line 1\nline 2\nline 3"
            assert_equal 3, @stage.send(:count_lines, content)

            empty_content = ""
            assert_equal 0, @stage.send(:count_lines, empty_content)

            nil_content = nil
            assert_equal 0, @stage.send(:count_lines, nil_content)
          end
        end
      end
    end
  end
end
