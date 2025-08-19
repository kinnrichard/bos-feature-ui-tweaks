# frozen_string_literal: true

require "test_helper"
require_relative "../../../../../lib/generators/zero/active_models/polymorphic_config_loader"

class PolymorphicConfigLoaderTest < ActiveSupport::TestCase
  def setup
    @config_path = Rails.root.join("config/zero_polymorphic_types.yml")
    @loader = Zero::Generators::PolymorphicConfigLoader.new(@config_path)
  end

  test "should load configuration file successfully" do
    assert @loader.loaded?, "Configuration should be loaded"
    assert @loader.config_data.present?, "Config data should be present"
  end

  test "should detect polymorphic associations for notes table" do
    associations = @loader.polymorphic_associations_for_table("notes")

    assert associations.any?, "Should have polymorphic associations for notes"

    notable_association = associations.find { |a| a[:name] == "notable" }
    assert notable_association.present?, "Should have notable association"
    assert_equal "notable_type", notable_association[:type_field]
    assert_equal "notable_id", notable_association[:id_field]
    assert_includes notable_association[:allowed_types], "Task"
  end

  test "should detect polymorphic associations for activity_logs table" do
    associations = @loader.polymorphic_associations_for_table("activity_logs")

    assert associations.any?, "Should have polymorphic associations for activity_logs"

    loggable_association = associations.find { |a| a[:name] == "loggable" }
    assert loggable_association.present?, "Should have loggable association"
    assert_equal "loggable_type", loggable_association[:type_field]
    assert_equal "loggable_id", loggable_association[:id_field]
    assert_includes loggable_association[:allowed_types], "Client"
    assert_includes loggable_association[:allowed_types], "Job"
    assert_includes loggable_association[:allowed_types], "Person"
    assert_includes loggable_association[:allowed_types], "Task"
  end

  test "should return empty associations for non-polymorphic tables" do
    associations = @loader.polymorphic_associations_for_table("users")
    assert associations.empty?, "Users table should not have polymorphic associations"
  end

  test "should generate correct import statement for polymorphic tables" do
    import_statement = @loader.polymorphic_import_statement("notes")
    expected = "import { declarePolymorphicRelationships } from '../zero/polymorphic';"
    assert_equal expected, import_statement
  end

  test "should generate empty import statement for non-polymorphic tables" do
    import_statement = @loader.polymorphic_import_statement("users")
    assert_equal "", import_statement
  end

  test "should generate correct polymorphic static block for notes" do
    static_block = @loader.polymorphic_static_block("notes")

    assert static_block.include?("declarePolymorphicRelationships"), "Should include declarePolymorphicRelationships call"
    assert static_block.include?("tableName: 'notes'"), "Should include table name"
    assert static_block.include?("notable:"), "Should include notable association"
    assert static_block.include?("'task'"), "Should include task as allowed type"
  end

  test "should generate correct polymorphic static block for activity_logs" do
    static_block = @loader.polymorphic_static_block("activity_logs")

    assert static_block.include?("declarePolymorphicRelationships"), "Should include declarePolymorphicRelationships call"
    assert static_block.include?("tableName: 'activity_logs'"), "Should include table name"
    assert static_block.include?("loggable:"), "Should include loggable association"
    assert static_block.include?("'client'"), "Should include client as allowed type"
    assert static_block.include?("'job'"), "Should include job as allowed type"
    assert static_block.include?("'person'"), "Should include person as allowed type"
    assert static_block.include?("'task'"), "Should include task as allowed type"
  end

  test "should return empty static block for non-polymorphic tables" do
    static_block = @loader.polymorphic_static_block("users")
    assert_equal "", static_block
  end

  test "should list all tables with polymorphic associations" do
    tables = @loader.tables_with_polymorphic_associations

    assert tables.include?("notes"), "Should include notes table"
    assert tables.include?("activity_logs"), "Should include activity_logs table"
    assert tables.include?("front_messages"), "Should include front_messages table"
    assert tables.include?("parsed_emails"), "Should include parsed_emails table"
  end

  test "should provide configuration summary" do
    summary = @loader.summary

    assert summary[:loaded], "Configuration should be loaded"
    assert summary[:file_exists], "Config file should exist"
    assert summary[:total_associations] > 0, "Should have total associations"
    assert summary[:tables_with_polymorphic] > 0, "Should have tables with polymorphic"
  end

  test "should detect polymorphic associations correctly" do
    assert @loader.has_polymorphic_associations?("notes"), "Notes should have polymorphic associations"
    assert @loader.has_polymorphic_associations?("activity_logs"), "ActivityLogs should have polymorphic associations"
    assert_not @loader.has_polymorphic_associations?("users"), "Users should not have polymorphic associations"
  end

  test "should provide metadata about configuration" do
    metadata = @loader.metadata

    assert metadata[:generated_at].present?, "Should have generated_at metadata"
    assert metadata[:rails_environment].present?, "Should have rails_environment metadata"
  end

  test "should provide statistics about polymorphic associations" do
    statistics = @loader.statistics

    assert statistics[:total_associations].present?, "Should have total_associations statistic"
    assert statistics[:associations_with_data].present?, "Should have associations_with_data statistic"
  end
end
