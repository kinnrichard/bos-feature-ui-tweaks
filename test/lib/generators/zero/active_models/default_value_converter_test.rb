# frozen_string_literal: true

require "test_helper"
require_relative "../../../../../lib/generators/zero/active_models/default_value_converter"

class DefaultValueConverterTest < ActiveSupport::TestCase
  def setup
    @converter = Zero::Generators::DefaultValueConverter.new
  end

  test "converts string literals to TypeScript strings" do
    column = { type: :string, default: "open" }
    assert_equal "'open'", @converter.convert_default(column)
  end

  test "escapes single quotes in strings" do
    column = { type: :string, default: "it's open" }
    assert_equal "'it\\'s open'", @converter.convert_default(column)
  end

  test "handles empty strings" do
    column = { type: :string, default: "" }
    assert_equal "''", @converter.convert_default(column)
  end

  test "handles nil defaults" do
    column = { type: :string, default: nil }
    assert_nil @converter.convert_default(column)
  end

  test "converts integer defaults" do
    column = { type: :integer, default: 0 }
    assert_equal "0", @converter.convert_default(column)
  end

  test "converts boolean true" do
    column = { type: :boolean, default: true }
    assert_equal "true", @converter.convert_default(column)
  end

  test "converts boolean false" do
    column = { type: :boolean, default: false }
    assert_equal "false", @converter.convert_default(column)
  end

  test "returns nil for UUID generation functions" do
    column = { type: :string, default: "gen_random_uuid()" }
    assert_nil @converter.convert_default(column)
  end

  test "returns nil for timestamp functions" do
    column = { type: :datetime, default: "CURRENT_TIMESTAMP" }
    assert_nil @converter.convert_default(column)
  end

  test "converts empty JSON object" do
    column = { type: :json, default: "{}" }
    assert_equal "{}", @converter.convert_default(column)
  end

  test "generates TypeScript object for multiple defaults" do
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

    assert_equal expected, @converter.generate_defaults_object("tasks", columns)
  end

  test "returns nil for empty defaults" do
    columns = [
      { name: "id", type: :string, default: "gen_random_uuid()" },
      { name: "created_at", type: :datetime, default: "CURRENT_TIMESTAMP" }
    ]

    assert_nil @converter.generate_defaults_object("tasks", columns)
  end

  test "handles real job table defaults" do
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

    assert_equal expected, @converter.generate_defaults_object("jobs", columns)
  end

  test "handles real task table defaults" do
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

    assert_equal expected, @converter.generate_defaults_object("tasks", columns)
  end
end
