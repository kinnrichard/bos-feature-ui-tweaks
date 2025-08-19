require "test_helper"

class FrontSync::InboxSyncServiceTest < ActiveSupport::TestCase
  def setup
    # Skip if no Front API token is configured
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]
    @service = FrontSync::InboxSyncService.new
  end

  test "inherits from FrontSyncService" do
    assert_equal FrontSyncService, FrontSync::InboxSyncService.superclass
  end

  test "has sync_all method" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]
    assert_respond_to @service, :sync_all
  end

  test "transform_inbox_attributes handles basic channel data" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    channel_data = {
      "id" => "cha_123",
      "name" => "Support Inbox",
      "type" => "smtp",
      "address" => "support@example.com",
      "is_private" => false,
      "settings" => {
        "smtp_host" => "smtp.example.com",
        "smtp_port" => 587
      },
      "_links" => { "self" => "https://api.frontapp.com/channels/cha_123" }
    }

    result = @service.send(:transform_inbox_attributes, channel_data)

    assert_equal "cha_123", result[:front_id]
    assert_equal "Support Inbox", result[:name]
    assert_equal "email", result[:inbox_type]
    assert_equal "support@example.com", result[:handle]
    assert result[:settings].present?
    assert_equal false, result[:settings]["is_private"]
    assert_equal "smtp.example.com", result[:settings]["smtp_host"]
    assert result[:api_links].present?
  end

  test "determine_inbox_type maps channel types correctly" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    assert_equal "email", @service.send(:determine_inbox_type, { "type" => "smtp" })
    assert_equal "email", @service.send(:determine_inbox_type, { "type" => "imap" })
    assert_equal "email", @service.send(:determine_inbox_type, { "type" => "gmail" })
    assert_equal "sms", @service.send(:determine_inbox_type, { "type" => "twilio" })
    assert_equal "chat", @service.send(:determine_inbox_type, { "type" => "front_chat" })
    assert_equal "custom", @service.send(:determine_inbox_type, { "type" => "custom" })
    assert_equal "unknown", @service.send(:determine_inbox_type, { "type" => "unknown_type" })
    assert_equal "unknown", @service.send(:determine_inbox_type, {})
  end
end
