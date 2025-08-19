# frozen_string_literal: true

require 'rails_helper'
require_relative '../../../../../lib/generators/zero/active_models/pipeline'
require_relative '../../../../../lib/generators/zero/active_models/generation_context'

RSpec.describe Zero::Generators::Pipeline do
  let(:sample_table) do
    {
      name: "users",
      columns: [
        { name: "id", type: "integer", primary_key: true },
        { name: "email", type: "string", null: false },
        { name: "name", type: "string", null: true },
        { name: "created_at", type: "datetime", null: false },
        { name: "updated_at", type: "datetime", null: false }
      ]
    }
  end

  let(:sample_schema) do
    {
      tables: [ sample_table ],
      relationships: [],
      patterns: {}
    }
  end

  let(:sample_context) do
    Zero::Generators::GenerationContext.new(
      table: sample_table,
      schema: sample_schema,
      relationships: {},
      options: { dry_run: false }
    )
  end

  describe Zero::Generators::Pipeline::Pipeline do
    let(:stage1) { double("Stage1") }
    let(:stage2) { double("Stage2") }

    before do
      allow(stage1).to receive(:process) { |ctx| ctx.with_metadata(stage1_executed: true) }
      allow(stage1).to receive(:can_run?) { true }
      allow(stage1).to receive(:class) { double(name: "Stage1") }

      allow(stage2).to receive(:process) { |ctx| ctx.with_metadata(stage2_executed: true) }
      allow(stage2).to receive(:can_run?) { true }
      allow(stage2).to receive(:class) { double(name: "Stage2") }
    end

    describe "#initialize" do
      it "creates pipeline with stages" do
        pipeline = described_class.new(stages: [ stage1, stage2 ])
        expect(pipeline.stages).to eq([ stage1, stage2 ])
      end

      it "validates stages implement required interface" do
        invalid_stage = double("InvalidStage")
        allow(invalid_stage).to receive(:class) { double(name: "InvalidStage") }

        expect {
          described_class.new(stages: [ invalid_stage ])
        }.to raise_error(Zero::Generators::Pipeline::Pipeline::StageValidationError)
      end

      it "initializes with metadata" do
        metadata = { type: :test, created_by: :rspec }
        pipeline = described_class.new(stages: [], metadata: metadata)
        expect(pipeline.metadata).to eq(metadata)
      end

      it "initializes execution statistics" do
        pipeline = described_class.new(stages: [])
        stats = pipeline.execution_statistics
        expect(stats[:executions_count]).to eq(0)
        expect(stats[:total_execution_time]).to eq(0.0)
      end
    end

    describe "#execute" do
      it "processes stages in order" do
        pipeline = described_class.new(stages: [ stage1, stage2 ])
        result = pipeline.execute(sample_context)

        expect(result.metadata[:stage1_executed]).to be(true)
        expect(result.metadata[:stage2_executed]).to be(true)
      end

      it "passes context between stages" do
        pipeline = described_class.new(stages: [ stage1, stage2 ])
        result = pipeline.execute(sample_context)

        expect(stage1).to have_received(:process).with(sample_context)
        expect(stage2).to have_received(:process)
      end

      it "updates execution statistics" do
        pipeline = described_class.new(stages: [ stage1 ])
        pipeline.execute(sample_context)

        stats = pipeline.execution_statistics
        expect(stats[:executions_count]).to eq(1)
        expect(stats[:stages_executed]).to eq(1)
        expect(stats[:total_execution_time]).to be > 0
      end

      it "skips stages when can_run? returns false" do
        allow(stage1).to receive(:can_run?) { false }
        pipeline = described_class.new(stages: [ stage1, stage2 ])
        result = pipeline.execute(sample_context)

        expect(stage1).not_to have_received(:process)
        expect(stage2).to have_received(:process)
        expect(result.metadata[:stage1_executed]).to be_nil
      end

      it "handles stage errors" do
        error = StandardError.new("Stage failed")
        allow(stage1).to receive(:process).and_raise(error)

        pipeline = described_class.new(stages: [ stage1 ])

        expect {
          pipeline.execute(sample_context)
        }.to raise_error(Zero::Generators::Pipeline::StageError)
      end

      it "returns final context" do
        pipeline = described_class.new(stages: [ stage1 ])
        result = pipeline.execute(sample_context)

        expect(result).to be_a(Zero::Generators::GenerationContext)
        expect(result.table_name).to eq("users")
      end
    end

    describe "#with_stage" do
      it "adds stage at end by default" do
        pipeline = described_class.new(stages: [ stage1 ])
        new_pipeline = pipeline.with_stage(stage2)

        expect(new_pipeline.stages).to eq([ stage1, stage2 ])
        expect(pipeline.stages).to eq([ stage1 ]) # original unchanged
      end

      it "adds stage at specified position" do
        pipeline = described_class.new(stages: [ stage2 ])
        new_pipeline = pipeline.with_stage(stage1, position: 0)

        expect(new_pipeline.stages).to eq([ stage1, stage2 ])
      end

      it "returns new pipeline instance" do
        pipeline = described_class.new(stages: [ stage1 ])
        new_pipeline = pipeline.with_stage(stage2)

        expect(new_pipeline).not to be(pipeline)
        expect(new_pipeline).to be_a(described_class)
      end
    end

    describe "#without_stage" do
      it "removes stages of specified class" do
        pipeline = described_class.new(stages: [ stage1, stage2 ])
        new_pipeline = pipeline.without_stage(stage1.class)

        expect(new_pipeline.stages).to eq([ stage2 ])
      end

      it "returns new pipeline instance" do
        pipeline = described_class.new(stages: [ stage1, stage2 ])
        new_pipeline = pipeline.without_stage(stage1.class)

        expect(new_pipeline).not to be(pipeline)
      end
    end

    describe "#replace_stage" do
      let(:replacement_stage) { double("ReplacementStage") }

      before do
        allow(replacement_stage).to receive(:process) { |ctx| ctx }
        allow(replacement_stage).to receive(:can_run?) { true }
        allow(replacement_stage).to receive(:class) { double(name: "ReplacementStage") }
      end

      it "replaces stage of specified class" do
        pipeline = described_class.new(stages: [ stage1, stage2 ])
        new_pipeline = pipeline.replace_stage(stage1.class, replacement_stage)

        expect(new_pipeline.stages).to eq([ replacement_stage, stage2 ])
      end
    end

    describe "#has_stage?" do
      it "returns true when stage type exists" do
        pipeline = described_class.new(stages: [ stage1 ])
        expect(pipeline.has_stage?(stage1.class)).to be(true)
      end

      it "returns false when stage type doesn't exist" do
        pipeline = described_class.new(stages: [ stage1 ])
        expect(pipeline.has_stage?(stage2.class)).to be(false)
      end
    end

    describe "#stage_count" do
      it "returns number of stages" do
        pipeline = described_class.new(stages: [ stage1, stage2 ])
        expect(pipeline.stage_count).to eq(2)
      end
    end
  end

  describe Zero::Generators::Pipeline::Stage do
    let(:test_stage_class) do
      Class.new(described_class) do
        def process(context)
          context.with_metadata(test_stage_processed: true)
        end
      end
    end

    let(:test_stage) { test_stage_class.new }

    describe "#process" do
      it "must be implemented by subclasses" do
        stage = described_class.new
        expect {
          stage.process(sample_context)
        }.to raise_error(NotImplementedError)
      end

      it "can be implemented by subclasses" do
        result = test_stage.process(sample_context)
        expect(result.metadata[:test_stage_processed]).to be(true)
      end
    end

    describe "#can_run?" do
      it "returns true by default" do
        stage = test_stage_class.new
        expect(stage.can_run?(sample_context)).to be(true)
      end

      it "can be overridden by subclasses" do
        conditional_stage_class = Class.new(described_class) do
          def can_run?(context)
            context.table_name == "users"
          end

          def process(context)
            context
          end
        end

        stage = conditional_stage_class.new
        expect(stage.can_run?(sample_context)).to be(true)

        different_context = sample_context.class.new(
          table: { name: "posts", columns: [] },
          schema: sample_schema
        )
        expect(stage.can_run?(different_context)).to be(false)
      end
    end

    describe "#name" do
      it "returns class name without module" do
        expect(test_stage.name).to match(/\AClass_0x[0-9a-f]+\z/) # Anonymous class pattern
      end
    end

    describe "#metadata" do
      it "returns stage information" do
        metadata = test_stage.metadata
        expect(metadata[:name]).to be_present
        expect(metadata[:class]).to be_present
        expect(metadata[:description]).to be_present
      end
    end

    describe "#idempotent?" do
      it "returns false by default" do
        expect(test_stage.idempotent?).to be(false)
      end
    end

    describe "#priority" do
      it "returns 50 by default" do
        expect(test_stage.priority).to eq(50)
      end
    end
  end

  describe "Example Stages" do
    describe Zero::Generators::Pipeline::Stages::LoggingStage do
      let(:logging_stage) { described_class.new }

      it "adds execution metadata to context" do
        result = logging_stage.process(sample_context)

        expect(result.metadata[:execution_log]).to be_present
        expect(result.metadata[:last_logged_at]).to be_present
        expect(result.metadata[:pipeline_step_count]).to eq(1)
      end

      it "is idempotent" do
        expect(logging_stage.idempotent?).to be(true)
      end

      it "can always run" do
        expect(logging_stage.can_run?(sample_context)).to be(true)
      end

      it "has high priority" do
        expect(logging_stage.priority).to eq(10)
      end
    end

    describe Zero::Generators::Pipeline::Stages::ValidationStage do
      let(:validation_stage) { described_class.new }

      it "validates context and adds metadata" do
        result = validation_stage.process(sample_context)

        expect(result.metadata[:stage_validation_stage][:validated]).to be(true)
        expect(result.metadata[:stage_validation_stage][:validated_at]).to be_present
      end

      it "raises StageError for invalid context" do
        invalid_context = Zero::Generators::GenerationContext.new(
          table: { name: "", columns: [] },
          schema: sample_schema
        )

        expect {
          validation_stage.process(invalid_context)
        }.to raise_error(Zero::Generators::Pipeline::StageError)
      end

      it "validates table structure" do
        invalid_table_context = Zero::Generators::GenerationContext.new(
          table: { name: "invalid", columns: "not_an_array" },
          schema: sample_schema
        )

        expect {
          validation_stage.process(invalid_table_context)
        }.to raise_error(Zero::Generators::Pipeline::StageError)
      end

      it "is idempotent" do
        expect(validation_stage.idempotent?).to be(true)
      end

      it "has very high priority" do
        expect(validation_stage.priority).to eq(5)
      end
    end

    describe Zero::Generators::Pipeline::Stages::TransformStage do
      let(:transform_stage) { described_class.new(add_computed_properties: true) }

      it "adds computed properties to context" do
        result = transform_stage.process(sample_context)

        computed = result.metadata[:computed_properties]
        expect(computed[:column_count]).to eq(5)
        expect(computed[:has_primary_key]).to be(true)
        expect(computed[:has_timestamps]).to be(true)
      end

      it "preserves original data when requested" do
        stage = described_class.new(preserve_original: true)
        result = stage.process(sample_context)

        backup = result.metadata[:original_data_backup]
        expect(backup[:original_table]).to eq(sample_table)
        expect(backup[:backed_up_at]).to be_present
      end

      it "requires valid table data to run" do
        expect(transform_stage.can_run?(sample_context)).to be(true)

        invalid_context = double("InvalidContext", table: nil)
        expect(transform_stage.can_run?(invalid_context)).to be(false)
      end

      it "is not idempotent by default" do
        expect(transform_stage.idempotent?).to be(false)
      end
    end
  end

  describe "Module Helper Methods" do
    describe ".default_pipeline" do
      it "creates pipeline with default stages" do
        pipeline = described_class.default_pipeline
        expect(pipeline.stage_count).to eq(3)
        expect(pipeline.has_stage?(Zero::Generators::Pipeline::Stages::LoggingStage)).to be(true)
        expect(pipeline.has_stage?(Zero::Generators::Pipeline::Stages::ValidationStage)).to be(true)
        expect(pipeline.has_stage?(Zero::Generators::Pipeline::Stages::TransformStage)).to be(true)
      end

      it "can exclude specific stages" do
        pipeline = described_class.default_pipeline(
          exclude_stages: [ Zero::Generators::Pipeline::Stages::LoggingStage ]
        )
        expect(pipeline.stage_count).to eq(2)
        expect(pipeline.has_stage?(Zero::Generators::Pipeline::Stages::LoggingStage)).to be(false)
      end
    end

    describe ".empty_pipeline" do
      it "creates empty pipeline" do
        pipeline = described_class.empty_pipeline
        expect(pipeline.stage_count).to eq(0)
      end

      it "includes metadata" do
        pipeline = described_class.empty_pipeline(metadata: { custom: :data })
        expect(pipeline.metadata[:custom]).to eq(:data)
        expect(pipeline.metadata[:type]).to eq(:custom)
      end
    end

    describe ".from_types" do
      it "creates pipeline from stage type symbols" do
        pipeline = described_class.from_types([ :validation, :logging ])
        expect(pipeline.stage_count).to eq(2)
        expect(pipeline.has_stage?(Zero::Generators::Pipeline::Stages::ValidationStage)).to be(true)
        expect(pipeline.has_stage?(Zero::Generators::Pipeline::Stages::LoggingStage)).to be(true)
      end

      it "raises error for unknown stage types" do
        expect {
          described_class.from_types([ :unknown_stage ])
        }.to raise_error(ArgumentError, /Unknown stage type/)
      end
    end

    describe ".available_stage_types" do
      it "returns available stage type symbols" do
        types = described_class.available_stage_types
        expect(types).to include(:logging, :validation, :transform)
      end
    end

    describe ".valid_stage?" do
      let(:valid_stage) do
        double("ValidStage").tap do |stage|
          allow(stage).to receive(:process)
          allow(stage).to receive(:can_run?)
          allow(stage).to receive(:class) { double(name: "ValidStage") }
        end
      end

      let(:invalid_stage) do
        double("InvalidStage").tap do |stage|
          allow(stage).to receive(:class) { double(name: "InvalidStage") }
        end
      end

      it "returns true for valid stages" do
        expect(described_class.valid_stage?(valid_stage)).to be(true)
      end

      it "raises error for stages missing #process" do
        expect {
          described_class.valid_stage?(invalid_stage)
        }.to raise_error(ArgumentError, /must implement #process/)
      end
    end
  end

  describe "Integration Example" do
    it "executes complete pipeline with all stages" do
      pipeline = described_class.default_pipeline(enable_logging: false)
      result = pipeline.execute(sample_context)

      # Check that all stages executed successfully
      expect(result.metadata[:execution_log]).to be_present
      expect(result.metadata[:stage_validation_stage][:validated]).to be(true)
      expect(result.metadata[:computed_properties]).to be_present

      # Verify context integrity
      expect(result.table_name).to eq("users")
      expect(result.model_name).to eq("User")
      expect(result.kebab_name).to eq("user")
    end

    it "demonstrates error handling and recovery" do
      failing_stage = Class.new(Zero::Generators::Pipeline::Stage) do
        def process(context)
          raise StandardError, "Intentional failure"
        end
      end

      pipeline = described_class.empty_pipeline.with_stage(failing_stage.new)

      expect {
        pipeline.execute(sample_context)
      }.to raise_error(Zero::Generators::Pipeline::StageError) do |error|
        expect(error.stage_name).to match(/Class_0x/)
        expect(error.context_info).to include("table: users")
        expect(error.original_error.message).to eq("Intentional failure")
        expect(error.error_category).to eq(:system)
        expect(error.severity).to eq(:critical)
      end
    end

    it "demonstrates pipeline composition" do
      base_pipeline = described_class.from_types([ :validation ])
      enhanced_pipeline = base_pipeline
        .with_stage(Zero::Generators::Pipeline::Stages::LoggingStage.new, position: 0)
        .with_stage(Zero::Generators::Pipeline::Stages::TransformStage.new)

      expect(enhanced_pipeline.stage_count).to eq(3)

      result = enhanced_pipeline.execute(sample_context)

      # Should have metadata from all stages
      expect(result.metadata[:execution_log]).to be_present # LoggingStage
      expect(result.metadata[:stage_validation_stage]).to be_present # ValidationStage
      expect(result.metadata[:computed_properties]).to be_present # TransformStage
    end
  end
end
