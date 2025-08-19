require "test_helper"

class FrontSync::ConversationSyncServiceTest < ActiveSupport::TestCase
  def setup
    # Skip if no Front API token is configured
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]
    @service = FrontSync::ConversationSyncService.new

    # Create test data
    @test_tag = front_tags(:one) rescue FrontTag.create!(front_id: "tag_123", name: "Test Tag")
    @test_inbox = front_inboxes(:one) rescue FrontInbox.create!(front_id: "inb_123", name: "Test Inbox", address: "test@example.com")
    @test_contact = front_contacts(:one) rescue FrontContact.create!(front_id: "crd_123", name: "Test Contact", handle: "test@example.com")
  end

  test "inherits from FrontSyncService" do
    assert_equal FrontSyncService, FrontSync::ConversationSyncService.superclass
  end

  test "has sync_all method" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]
    assert_respond_to @service, :sync_all
  end

  test "sync_all accepts since parameter" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]
    assert_respond_to @service, :sync_all

    # Mock the API call to avoid hitting real API in tests
    @service.stub(:fetch_all_pages, []) do
      result = @service.sync_all(since: 1.day.ago)
      assert_kind_of Hash, result
      assert_includes result.keys, :created
      assert_includes result.keys, :updated
      assert_includes result.keys, :failed
    end
  end

  test "sync_all accepts max_results parameter" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    # Mock the API call to avoid hitting real API in tests
    @service.stub(:fetch_all_pages, []) do
      result = @service.sync_all(max_results: 100)
      assert_kind_of Hash, result
    end
  end

  test "initializes with empty stats" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]
    assert_equal 0, @service.stats[:created]
    assert_equal 0, @service.stats[:updated]
    assert_equal 0, @service.stats[:failed]
    assert_equal [], @service.stats[:errors]
  end

  test "transform_conversation_attributes handles basic conversation data" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    conversation_data = {
      "id" => "cnv_123",
      "subject" => "Test Subject",
      "status" => "assigned",
      "status_id" => "status_123",
      "is_private" => false,
      "created_at" => 1640995200,
      "waiting_since" => 1640995300,
      "custom_fields" => { "priority" => "high" },
      "links" => [ "https://example.com" ],
      "scheduled_reminders" => [ { "scheduled_at" => 1640999999 } ],
      "assignee" => { "id" => "tea_123" },
      "recipient" => { "handle" => "test@example.com" },
      "_links" => { "self" => "https://api.frontapp.com/conversations/cnv_123" }
    }

    result = @service.send(:transform_conversation_attributes, conversation_data)

    assert_equal "Test Subject", result[:subject]
    assert_equal "assigned", result[:status]
    assert_equal "open", result[:status_category]
    assert_equal "status_123", result[:status_id]
    assert_equal false, result[:is_private]
    assert_equal 1640995200, result[:created_at_timestamp]
    assert_equal 1640995300, result[:waiting_since_timestamp]
    assert_equal({ "priority" => "high" }, result[:custom_fields])
    assert result[:api_links].present?
    assert_equal [ "https://example.com" ], result[:links]
    assert_equal [ { "scheduled_at" => 1640999999 } ], result[:scheduled_reminders]
  end

  test "determine_status_category categorizes statuses correctly" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    assert_equal "closed", @service.send(:determine_status_category, "archived")
    assert_equal "closed", @service.send(:determine_status_category, "deleted")
    assert_equal "open", @service.send(:determine_status_category, "unassigned")
    assert_equal "open", @service.send(:determine_status_category, "assigned")
    assert_equal "open", @service.send(:determine_status_category, "unknown_status")
  end

  test "find_recipient_contact_id finds contact by handle" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    recipient_data = { "handle" => @test_contact.handle }
    result = @service.send(:find_recipient_contact_id, recipient_data)

    assert_equal @test_contact.id, result
  end

  test "find_recipient_contact_id returns nil for missing contact" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    recipient_data = { "handle" => "nonexistent@example.com" }
    result = @service.send(:find_recipient_contact_id, recipient_data)

    assert_nil result
  end

  test "sync_conversation_tags creates tag associations" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    conversation = FrontConversation.create!(
      front_id: "cnv_test",
      subject: "Test",
      status: "assigned",
      created_at_timestamp: Time.current.to_i
    )

    tags_data = [ { "id" => @test_tag.front_id } ]

    @service.send(:sync_conversation_tags, conversation, tags_data)

    assert_equal 1, conversation.front_conversation_tags.count
    assert_equal @test_tag, conversation.front_tags.first
  end

  test "sync_conversation_inboxes creates inbox associations" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    conversation = FrontConversation.create!(
      front_id: "cnv_test",
      subject: "Test",
      status: "assigned",
      created_at_timestamp: Time.current.to_i
    )

    inboxes_data = [ { "id" => @test_inbox.front_id } ]

    @service.send(:sync_conversation_inboxes, conversation, inboxes_data)

    assert_equal 1, conversation.front_conversation_inboxes.count
    assert_equal @test_inbox, conversation.front_inboxes.first
  end

  test "handles missing tags gracefully" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    conversation = FrontConversation.create!(
      front_id: "cnv_test",
      subject: "Test",
      status: "assigned",
      created_at_timestamp: Time.current.to_i
    )

    tags_data = [ { "id" => "nonexistent_tag" } ]

    # Should not raise an error
    assert_nothing_raised do
      @service.send(:sync_conversation_tags, conversation, tags_data)
    end

    assert_equal 0, conversation.front_conversation_tags.count
  end

  test "handles missing inboxes gracefully" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    conversation = FrontConversation.create!(
      front_id: "cnv_test",
      subject: "Test",
      status: "assigned",
      created_at_timestamp: Time.current.to_i
    )

    inboxes_data = [ { "id" => "nonexistent_inbox" } ]

    # Should not raise an error
    assert_nothing_raised do
      @service.send(:sync_conversation_inboxes, conversation, inboxes_data)
    end

    assert_equal 0, conversation.front_conversation_inboxes.count
  end
end
