# frozen_string_literal: true

require "test_helper"

class PolymorphicModelGenerationTest < ActiveSupport::TestCase
  test "generated models include polymorphic declarations" do
    # Test that the generated Note model file includes polymorphic declarations
    note_model_path = Rails.root.join("frontend/src/lib/models/note.ts")
    assert File.exist?(note_model_path), "Note model should exist"

    note_content = File.read(note_model_path)
    assert_includes note_content, "import { declarePolymorphicRelationships } from '../zero/polymorphic';",
                   "Note model should import declarePolymorphicRelationships"
    assert_includes note_content, "declarePolymorphicRelationships({",
                   "Note model should call declarePolymorphicRelationships"
    assert_includes note_content, "tableName: 'notes'",
                   "Note model should declare tableName"
    assert_includes note_content, "notable:",
                   "Note model should declare notable association"
    assert_includes note_content, "allowedTypes: ['task']",
                   "Note model should declare allowed types for notable"
  end

  test "generated activity log model includes complex polymorphic declarations" do
    # Test that the generated ActivityLog model file includes polymorphic declarations
    activity_log_model_path = Rails.root.join("frontend/src/lib/models/activity-log.ts")
    assert File.exist?(activity_log_model_path), "ActivityLog model should exist"

    activity_log_content = File.read(activity_log_model_path)
    assert_includes activity_log_content, "import { declarePolymorphicRelationships } from '../zero/polymorphic';",
                   "ActivityLog model should import declarePolymorphicRelationships"
    assert_includes activity_log_content, "declarePolymorphicRelationships({",
                   "ActivityLog model should call declarePolymorphicRelationships"
    assert_includes activity_log_content, "tableName: 'activity_logs'",
                   "ActivityLog model should declare tableName"
    assert_includes activity_log_content, "loggable:",
                   "ActivityLog model should declare loggable association"
    assert_includes activity_log_content, "allowedTypes: ['client', 'job', 'person', 'task']",
                   "ActivityLog model should declare all allowed types for loggable"
  end

  test "non-polymorphic model does not include polymorphic declarations" do
    # Test that the generated User model file does not include polymorphic declarations
    user_model_path = Rails.root.join("frontend/src/lib/models/user.ts")
    assert File.exist?(user_model_path), "User model should exist"

    user_content = File.read(user_model_path)
    assert_not_includes user_content, "import { declarePolymorphicRelationships }",
                       "User model should not import declarePolymorphicRelationships"
    assert_not_includes user_content, "declarePolymorphicRelationships(",
                       "User model should not call declarePolymorphicRelationships"
  end

  test "reactive models include polymorphic declarations" do
    # Test that reactive models also include polymorphic declarations
    reactive_note_model_path = Rails.root.join("frontend/src/lib/models/reactive-note.ts")
    assert File.exist?(reactive_note_model_path), "Reactive Note model should exist"

    reactive_note_content = File.read(reactive_note_model_path)
    assert_includes reactive_note_content, "import { declarePolymorphicRelationships } from '../zero/polymorphic';",
                   "Reactive Note model should import declarePolymorphicRelationships"
    assert_includes reactive_note_content, "declarePolymorphicRelationships({",
                   "Reactive Note model should call declarePolymorphicRelationships"
    assert_includes reactive_note_content, "allowedTypes: ['task']",
                   "Reactive Note model should declare allowed types"
  end

  test "polymorphic configuration file exists and is valid" do
    config_file_path = Rails.root.join("config/zero_polymorphic_types.yml")
    assert File.exist?(config_file_path), "Polymorphic configuration file should exist"

    config_content = YAML.load_file(config_file_path)
    assert config_content.present?, "Configuration should have content"
    assert config_content[:polymorphic_associations].present?, "Configuration should have polymorphic_associations"

    # Test specific associations are present
    assert config_content[:polymorphic_associations]["notes.notable"].present?,
           "Configuration should include notes.notable association"
    assert config_content[:polymorphic_associations]["activity_logs.loggable"].present?,
           "Configuration should include activity_logs.loggable association"
  end
end
