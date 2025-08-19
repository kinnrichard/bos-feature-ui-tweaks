require "test_helper"

class FrontSync::TagSyncServiceTest < ActiveSupport::TestCase
  def setup
    # Skip if no Front API token is configured
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]
    @service = FrontSync::TagSyncService.new
  end

  test "inherits from FrontSyncService" do
    assert_equal FrontSyncService, FrontSync::TagSyncService.superclass
  end

  test "has sync_all method" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]
    assert_respond_to @service, :sync_all
  end

  test "transform_tag_attributes handles basic tag data" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    tag_data = {
      "id" => "tag_123",
      "name" => "Important",
      "highlight" => "red",
      "description" => "Important messages",
      "is_private" => true,
      "is_visible_in_conversation_lists" => true,
      "created_at" => 1640995200.123,
      "updated_at" => 1640995300.456
    }

    result = @service.send(:transform_tag_attributes, tag_data, nil, skip_parent: true)

    assert_equal "tag_123", result[:front_id]
    assert_equal "Important", result[:name]
    assert_equal "red", result[:highlight]
    assert_equal "Important messages", result[:description]
    assert_equal true, result[:is_private]
    assert_equal true, result[:is_visible_in_conversation_lists]
    assert_equal 1640995200.123, result[:created_at_timestamp]
    assert_equal 1640995300.456, result[:updated_at_timestamp]
  end

  test "transform_tag_attributes handles minimal tag data" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    tag_data = {
      "id" => "tag_456",
      "name" => "Urgent"
    }

    result = @service.send(:transform_tag_attributes, tag_data, nil, skip_parent: true)

    assert_equal "tag_456", result[:front_id]
    assert_equal "Urgent", result[:name]
    assert_equal false, result[:is_private]
    assert_equal false, result[:is_visible_in_conversation_lists]
  end
end
