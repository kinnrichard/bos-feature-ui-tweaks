# frozen_string_literal: true

require "rails_helper"
require_relative "../../../../../lib/generators/zero/active_models/default_value_converter"

RSpec.describe Zero::Generators::DefaultValueConverter do
  let(:converter) { described_class.new }

  describe "#convert_default" do
    context "with string types" do
      it "converts string literals to TypeScript strings" do
        column = { type: :string, default: "open" }
        expect(converter.convert_default(column)).to eq("'open'")
      end

      it "escapes single quotes in strings" do
        column = { type: :string, default: "it's open" }
        expect(converter.convert_default(column)).to eq("'it\\'s open'")
      end

      it "handles empty strings" do
        column = { type: :string, default: "" }
        expect(converter.convert_default(column)).to eq("''")
      end

      it "handles nil defaults" do
        column = { type: :string, default: nil }
        expect(converter.convert_default(column)).to be_nil
      end
    end

    context "with numeric types" do
      it "converts integer defaults" do
        column = { type: :integer, default: 0 }
        expect(converter.convert_default(column)).to eq("0")
      end

      it "converts bigint defaults" do
        column = { type: :bigint, default: 1 }
        expect(converter.convert_default(column)).to eq("1")
      end

      it "converts decimal defaults" do
        column = { type: :decimal, default: "10.5" }
        expect(converter.convert_default(column)).to eq("10.5")
      end

      it "converts float defaults" do
        column = { type: :float, default: 3.14 }
        expect(converter.convert_default(column)).to eq("3.14")
      end

      it "handles numeric strings" do
        column = { type: :integer, default: "42" }
        expect(converter.convert_default(column)).to eq("42")
      end
    end

    context "with boolean types" do
      it "converts true boolean" do
        column = { type: :boolean, default: true }
        expect(converter.convert_default(column)).to eq("true")
      end

      it "converts false boolean" do
        column = { type: :boolean, default: false }
        expect(converter.convert_default(column)).to eq("false")
      end

      it "converts string 'true' to boolean" do
        column = { type: :boolean, default: "true" }
        expect(converter.convert_default(column)).to eq("true")
      end

      it "converts string 'false' to boolean" do
        column = { type: :boolean, default: "false" }
        expect(converter.convert_default(column)).to eq("false")
      end

      it "converts 't' to true" do
        column = { type: :boolean, default: "t" }
        expect(converter.convert_default(column)).to eq("true")
      end

      it "converts 'f' to false" do
        column = { type: :boolean, default: "f" }
        expect(converter.convert_default(column)).to eq("false")
      end

      it "converts 1 to true" do
        column = { type: :boolean, default: 1 }
        expect(converter.convert_default(column)).to eq("true")
      end

      it "converts 0 to false" do
        column = { type: :boolean, default: 0 }
        expect(converter.convert_default(column)).to eq("false")
      end
    end

    context "with runtime functions" do
      it "returns nil for UUID generation functions" do
        column = { type: :string, default: "gen_random_uuid()" }
        expect(converter.convert_default(column)).to be_nil
      end

      it "returns nil for timestamp functions" do
        column = { type: :datetime, default: "CURRENT_TIMESTAMP" }
        expect(converter.convert_default(column)).to be_nil
      end

      it "returns nil for now() function" do
        column = { type: :datetime, default: "now()" }
        expect(converter.convert_default(column)).to be_nil
      end

      it "returns nil for lambda defaults" do
        column = { type: :string, default: "-> { \"generated\" }" }
        expect(converter.convert_default(column)).to be_nil
      end
    end

    context "with JSON types" do
      it "converts empty object default" do
        column = { type: :json, default: "{}" }
        expect(converter.convert_default(column)).to eq("{}")
      end

      it "converts empty array default" do
        column = { type: :jsonb, default: "[]" }
        expect(converter.convert_default(column)).to eq("[]")
      end

      it "handles nil JSON" do
        column = { type: :json, default: nil }
        expect(converter.convert_default(column)).to be_nil
      end

      it "parses and re-stringifies valid JSON" do
        column = { type: :json, default: '{"key": "value"}' }
        expect(converter.convert_default(column)).to eq('{"key":"value"}')
      end

      it "defaults to empty object for invalid JSON" do
        column = { type: :json, default: "invalid json" }
        expect(converter.convert_default(column)).to eq("{}")
      end
    end

    context "with date/time types" do
      it "quotes valid date strings" do
        column = { type: :date, default: "2023-01-01" }
        expect(converter.convert_default(column)).to eq("'2023-01-01'")
      end

      it "returns null for nil dates" do
        column = { type: :date, default: nil }
        expect(converter.convert_default(column)).to be_nil
      end

      it "returns null for complex date expressions" do
        column = { type: :datetime, default: "now() + interval '1 day'" }
        expect(converter.convert_default(column)).to eq("null")
      end
    end

    context "with unknown types" do
      it "returns nil for unsupported types" do
        column = { type: :unknown_type, default: "value" }
        expect(converter.convert_default(column)).to be_nil
      end
    end

    context "with error handling" do
      it "returns nil and logs warning on conversion errors" do
        allow(Rails.logger).to receive(:warn)

        # Force an error by passing invalid data
        column = { type: :integer }
        column.define_singleton_method(:default) { raise "Test error" }

        expect(converter.convert_default(column)).to be_nil
        expect(Rails.logger).to have_received(:warn).with(/Failed to convert default/)
      end
    end
  end

  describe "#generate_defaults_object" do
    let(:table_name) { "tasks" }

    it "generates TypeScript object for multiple defaults" do
      columns = [
        { name: "lock_version", type: :integer, default: 0 },
        { name: "due_time_set", type: :boolean, default: false },
        { name: "status", type: :string, default: "open" }
      ]

      expected = <<~JS.strip
        {
          due_time_set: false,
          lock_version: 0,
          status: 'open',
        }
      JS

      expect(converter.generate_defaults_object(table_name, columns)).to eq(expected)
    end

    it "returns nil for empty defaults" do
      columns = [
        { name: "id", type: :string, default: "gen_random_uuid()" },
        { name: "created_at", type: :datetime, default: "CURRENT_TIMESTAMP" }
      ]

      expect(converter.generate_defaults_object(table_name, columns)).to be_nil
    end

    it "filters out nil conversions" do
      columns = [
        { name: "id", type: :string, default: "gen_random_uuid()" },
        { name: "active", type: :boolean, default: true },
        { name: "created_at", type: :datetime, default: nil }
      ]

      expected = <<~JS.strip
        {
          active: true,
        }
      JS

      expect(converter.generate_defaults_object(table_name, columns)).to eq(expected)
    end

    it "sorts keys alphabetically" do
      columns = [
        { name: "zebra", type: :string, default: "z" },
        { name: "alpha", type: :string, default: "a" },
        { name: "beta", type: :string, default: "b" }
      ]

      result = converter.generate_defaults_object(table_name, columns)
      lines = result.split("\n")

      expect(lines[1]).to include("alpha:")
      expect(lines[2]).to include("beta:")
      expect(lines[3]).to include("zebra:")
    end
  end

  describe "integration with real schema examples" do
    it "handles job table defaults correctly" do
      columns = [
        { name: "lock_version", type: :integer, default: 0 },
        { name: "due_time_set", type: :boolean, default: false },
        { name: "start_time_set", type: :boolean, default: false },
        { name: "status", type: :string, default: "open" },
        { name: "priority", type: :string, default: "normal" }
      ]

      expected = <<~JS.strip
        {
          due_time_set: false,
          lock_version: 0,
          priority: 'normal',
          start_time_set: false,
          status: 'open',
        }
      JS

      expect(converter.generate_defaults_object("jobs", columns)).to eq(expected)
    end

    it "handles task table defaults correctly" do
      columns = [
        { name: "subtasks_count", type: :integer, default: 0 },
        { name: "reordered_at", type: :datetime, default: "-> { \"CURRENT_TIMESTAMP\" }" },
        { name: "lock_version", type: :integer, default: 0 },
        { name: "applies_to_all_targets", type: :boolean, default: true },
        { name: "position_finalized", type: :boolean, default: false },
        { name: "repositioned_to_top", type: :boolean, default: false }
      ]

      expected = <<~JS.strip
        {
          applies_to_all_targets: true,
          lock_version: 0,
          position_finalized: false,
          repositioned_to_top: false,
          subtasks_count: 0,
        }
      JS

      expect(converter.generate_defaults_object("tasks", columns)).to eq(expected)
    end
  end
end
