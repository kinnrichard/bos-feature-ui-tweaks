# frozen_string_literal: true

require "test_helper"
require_relative "../../../../../lib/generators/zero/active_models/pipeline"
require_relative "../../../../../lib/generators/zero/active_models/generation_context"

class PipelineTest < ActiveSupport::TestCase
  def setup
    @sample_table = {
      name: "users",
      columns: [
        { name: "id", type: "integer", primary_key: true },
        { name: "email", type: "string", null: false },
        { name: "name", type: "string", null: true },
        { name: "created_at", type: "datetime", null: false },
        { name: "updated_at", type: "datetime", null: false }
      ]
    }

    @sample_schema = {
      tables: [ @sample_table ],
      relationships: [],
      patterns: {}
    }

    @sample_context = Zero::Generators::GenerationContext.new(
      table: @sample_table,
      schema: @sample_schema,
      relationships: {},
      options: { dry_run: false }
    )
  end

  test "Pipeline can be created with stages" do
    stage1 = MockStage.new("Stage1")
    stage2 = MockStage.new("Stage2")

    pipeline = Zero::Generators::Pipeline::Pipeline.new(stages: [ stage1, stage2 ])

    assert_equal 2, pipeline.stages.size
    assert_equal stage1, pipeline.stages.first
    assert_equal stage2, pipeline.stages.last
  end

  test "Pipeline executes stages in order" do
    stage1 = MockStage.new("Stage1")
    stage2 = MockStage.new("Stage2")

    pipeline = Zero::Generators::Pipeline::Pipeline.new(stages: [ stage1, stage2 ])
    result = pipeline.execute(@sample_context)

    assert result.metadata[:stage1_executed]
    assert result.metadata[:stage2_executed]
    assert_equal "users", result.table_name
  end

  test "Pipeline with_stage returns new pipeline with added stage" do
    stage1 = MockStage.new("Stage1")
    stage2 = MockStage.new("Stage2")

    original_pipeline = Zero::Generators::Pipeline::Pipeline.new(stages: [ stage1 ])
    new_pipeline = original_pipeline.with_stage(stage2)

    assert_equal 1, original_pipeline.stages.size
    assert_equal 2, new_pipeline.stages.size
    refute_same original_pipeline, new_pipeline
  end

  test "Pipeline without_stage removes stage of specified type" do
    stage1 = MockStage.new("Stage1")
    stage2 = MockStage.new("Stage2")

    original_pipeline = Zero::Generators::Pipeline::Pipeline.new(stages: [ stage1, stage2 ])
    new_pipeline = original_pipeline.without_stage(MockStage)

    assert_equal 0, new_pipeline.stages.size
  end

  test "Pipeline tracks execution statistics" do
    stage1 = MockStage.new("Stage1")

    pipeline = Zero::Generators::Pipeline::Pipeline.new(stages: [ stage1 ])
    pipeline.execute(@sample_context)

    stats = pipeline.execution_statistics
    assert_equal 1, stats[:executions_count]
    assert_equal 1, stats[:stages_executed]
    assert stats[:total_execution_time] > 0
  end

  test "Pipeline handles stage errors" do
    failing_stage = FailingMockStage.new("FailingStage")

    pipeline = Zero::Generators::Pipeline::Pipeline.new(stages: [ failing_stage ])

    assert_raises Zero::Generators::Pipeline::StageError do
      pipeline.execute(@sample_context)
    end
  end

  test "LoggingStage adds execution metadata" do
    logging_stage = Zero::Generators::Pipeline::Stages::LoggingStage.new

    result = logging_stage.process(@sample_context)

    assert result.metadata[:execution_log]
    assert result.metadata[:last_logged_at]
    assert_equal 1, result.metadata[:pipeline_step_count]
  end

  test "ValidationStage validates context successfully" do
    validation_stage = Zero::Generators::Pipeline::Stages::ValidationStage.new

    result = validation_stage.process(@sample_context)

    assert result.metadata[:stage_validation_stage][:validated]
    assert result.metadata[:stage_validation_stage][:validated_at]
  end

  test "ValidationStage raises error for invalid context" do
    validation_stage = Zero::Generators::Pipeline::Stages::ValidationStage.new

    invalid_context = Zero::Generators::GenerationContext.new(
      table: { name: "", columns: [] },
      schema: @sample_schema
    )

    assert_raises Zero::Generators::Pipeline::StageError do
      validation_stage.process(invalid_context)
    end
  end

  test "TransformStage adds computed properties" do
    transform_stage = Zero::Generators::Pipeline::Stages::TransformStage.new(
      add_computed_properties: true
    )

    result = transform_stage.process(@sample_context)

    computed = result.metadata[:computed_properties]
    assert_equal 5, computed[:column_count]
    assert computed[:has_primary_key]
    assert computed[:has_timestamps]
  end

  test "default_pipeline creates pipeline with standard stages" do
    pipeline = Zero::Generators::Pipeline.default_pipeline

    assert_equal 3, pipeline.stage_count
    assert pipeline.has_stage?(Zero::Generators::Pipeline::Stages::LoggingStage)
    assert pipeline.has_stage?(Zero::Generators::Pipeline::Stages::ValidationStage)
    assert pipeline.has_stage?(Zero::Generators::Pipeline::Stages::TransformStage)
  end

  test "from_types creates pipeline from stage symbols" do
    pipeline = Zero::Generators::Pipeline.from_types([ :validation, :logging ])

    assert_equal 2, pipeline.stage_count
    assert pipeline.has_stage?(Zero::Generators::Pipeline::Stages::ValidationStage)
    assert pipeline.has_stage?(Zero::Generators::Pipeline::Stages::LoggingStage)
  end

  test "StageError provides detailed error context" do
    stage = MockStage.new("TestStage")
    original_error = StandardError.new("Test error")

    stage_error = Zero::Generators::Pipeline::StageError.new(
      stage: stage,
      context: @sample_context,
      error: original_error
    )

    assert_equal "TestStage", stage_error.stage_name
    assert_includes stage_error.context_info, "table: users"
    assert_equal original_error, stage_error.original_error
    assert_equal :system, stage_error.error_category
  end

  test "Integration: complete pipeline execution" do
    pipeline = Zero::Generators::Pipeline.default_pipeline(enable_logging: false)
    result = pipeline.execute(@sample_context)

    # Check that all stages executed successfully
    assert result.metadata[:execution_log]
    assert result.metadata[:stage_validation_stage][:validated]
    assert result.metadata[:computed_properties]

    # Verify context integrity
    assert_equal "users", result.table_name
    assert_equal "User", result.model_name
    assert_equal "user", result.kebab_name
  end

  private

  # Mock stage for testing
  class MockStage
    attr_reader :name

    def initialize(name)
      @name = name
    end

    def process(context)
      metadata_key = "#{@name.downcase}_executed".to_sym
      context.with_metadata(metadata_key => true)
    end

    def can_run?(context)
      true
    end

    def class
      MockStage
    end
  end

  # Mock failing stage for error testing
  class FailingMockStage
    attr_reader :name

    def initialize(name)
      @name = name
    end

    def process(context)
      raise StandardError, "Mock stage failure"
    end

    def can_run?(context)
      true
    end

    def class
      FailingMockStage
    end
  end
end
