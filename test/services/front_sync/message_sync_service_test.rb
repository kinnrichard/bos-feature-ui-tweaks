require "test_helper"

class FrontSync::MessageSyncServiceTest < ActiveSupport::TestCase
  def setup
    # Skip if no Front API token is configured
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]
    @service = FrontSync::MessageSyncService.new

    # Create test data
    @test_conversation = FrontConversation.create!(
      front_id: "cnv_123",
      subject: "Test Conversation",
      status: "assigned",
      created_at_timestamp: Time.current.to_i
    )

    @test_contact = front_contacts(:one) rescue FrontContact.create!(
      front_id: "crd_123",
      name: "Test Contact",
      handle: "test@example.com"
    )

    @test_author = front_contacts(:two) rescue FrontContact.create!(
      front_id: "crd_456",
      name: "Author Contact",
      handle: "author@example.com"
    )
  end

  test "inherits from FrontSyncService" do
    assert_equal FrontSyncService, FrontSync::MessageSyncService.superclass
  end

  test "has sync_all method" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]
    assert_respond_to @service, :sync_all
  end

  test "has sync_for_conversations method" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]
    assert_respond_to @service, :sync_for_conversations
  end

  test "sync_all accepts since parameter" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

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

  test "sync_for_conversations accepts conversation_ids array" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    # Mock the API call to avoid hitting real API in tests
    @service.stub(:fetch_all_pages, []) do
      result = @service.sync_for_conversations([ "cnv_123", "cnv_456" ])
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

  test "transform_message_attributes handles basic message data" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    message_data = {
      "id" => "msg_123",
      "message_uid" => "uid_123",
      "type" => "email",
      "is_inbound" => true,
      "is_draft" => false,
      "subject" => "Test Message",
      "blurb" => "This is a test message",
      "body" => "<p>HTML body content</p>",
      "text" => "Plain text body content",
      "error_type" => nil,
      "draft_mode" => nil,
      "created_at" => 1640995200,
      "author" => { "id" => @test_author.front_id, "_links" => { "self" => "https://api.frontapp.com/contacts/crd_456" } },
      "version" => 1,
      "thread_ref" => "thread_123",
      "is_system" => false,
      "delivery_status" => "delivered",
      "_links" => { "self" => "https://api.frontapp.com/messages/msg_123" }
    }

    result = @service.send(:transform_message_attributes, message_data, @test_conversation)

    assert_equal @test_conversation.id, result[:front_conversation_id]
    assert_equal "uid_123", result[:message_uid]
    assert_equal "email", result[:message_type]
    assert_equal true, result[:is_inbound]
    assert_equal false, result[:is_draft]
    assert_equal "Test Message", result[:subject]
    assert_equal "This is a test message", result[:blurb]
    assert_equal "<p>HTML body content</p>", result[:body_html]
    assert_equal "Plain text body content", result[:body_plain]
    assert_equal 1640995200, result[:created_at_timestamp]
    assert_equal @test_author.id, result[:author_id]
    assert result[:api_links].present?

    # Check metadata
    assert_equal 1, result[:metadata]["version"]
    assert_equal "thread_123", result[:metadata]["thread_ref"]
    assert_equal false, result[:metadata]["is_system"]
    assert_equal "delivered", result[:metadata]["delivery_status"]
  end

  test "find_author_id finds contact author" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    author_data = {
      "id" => @test_author.front_id,
      "_links" => { "self" => "https://api.frontapp.com/contacts/crd_456" }
    }

    result = @service.send(:find_author_id, author_data)
    assert_equal @test_author.id, result
  end

  test "find_author_id returns nil for teammate author" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    author_data = {
      "id" => "tea_123",
      "_links" => { "self" => "https://api.frontapp.com/teammates/tea_123" }
    }

    result = @service.send(:find_author_id, author_data)
    assert_nil result
  end

  test "find_author_id returns nil for missing contact" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    author_data = {
      "id" => "nonexistent_contact",
      "_links" => { "self" => "https://api.frontapp.com/contacts/nonexistent_contact" }
    }

    result = @service.send(:find_author_id, author_data)
    assert_nil result
  end

  test "find_contact_by_handle finds contact by direct handle" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    result = @service.send(:find_contact_by_handle, @test_contact.handle)
    assert_equal @test_contact, result
  end

  test "find_contact_by_handle returns nil for missing contact" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    result = @service.send(:find_contact_by_handle, "nonexistent@example.com")
    assert_nil result
  end

  test "sync_message_recipients creates recipient associations" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    message = FrontMessage.create!(
      front_id: "msg_test",
      front_conversation: @test_conversation,
      message_type: "email",
      created_at_timestamp: Time.current.to_i
    )

    recipients_data = [
      { "handle" => @test_contact.handle, "role" => "to" },
      { "handle" => @test_author.handle, "role" => "from" }
    ]

    @service.send(:sync_message_recipients, message, recipients_data)

    assert_equal 2, message.front_message_recipients.count

    to_recipient = message.front_message_recipients.find_by(role: "to")
    assert_equal @test_contact, to_recipient.front_contact

    from_recipient = message.front_message_recipients.find_by(role: "from")
    assert_equal @test_author, from_recipient.front_contact
  end

  test "sync_message_attachments creates attachment records" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    message = FrontMessage.create!(
      front_id: "msg_test",
      front_conversation: @test_conversation,
      message_type: "email",
      created_at_timestamp: Time.current.to_i
    )

    attachments_data = [
      {
        "id" => "att_123",
        "filename" => "document.pdf",
        "url" => "https://example.com/document.pdf",
        "content_type" => "application/pdf",
        "size" => 1024,
        "is_inline" => false,
        "content_id" => nil,
        "disposition" => "attachment"
      }
    ]

    @service.send(:sync_message_attachments, message, attachments_data)

    assert_equal 1, message.front_attachments.count

    attachment = message.front_attachments.first
    assert_equal "att_123", attachment.front_id
    assert_equal "document.pdf", attachment.filename
    assert_equal "https://example.com/document.pdf", attachment.url
    assert_equal "application/pdf", attachment.content_type
    assert_equal 1024, attachment.size
    assert_equal false, attachment.metadata["is_inline"]
    assert_equal "attachment", attachment.metadata["disposition"]
  end

  test "handles missing recipients gracefully" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    message = FrontMessage.create!(
      front_id: "msg_test",
      front_conversation: @test_conversation,
      message_type: "email",
      created_at_timestamp: Time.current.to_i
    )

    recipients_data = [
      { "handle" => "nonexistent@example.com", "role" => "to" }
    ]

    # Should not raise an error
    assert_nothing_raised do
      @service.send(:sync_message_recipients, message, recipients_data)
    end

    assert_equal 0, message.front_message_recipients.count
  end

  test "sync_for_conversations handles missing conversation gracefully" do
    skip "FRONT_API_TOKEN not configured" unless ENV["FRONT_API_TOKEN"]

    # Mock the API call to avoid hitting real API in tests
    @service.stub(:fetch_all_pages, []) do
      # Should not raise an error for nonexistent conversation
      assert_nothing_raised do
        @service.sync_for_conversations([ "nonexistent_conversation" ])
      end
    end
  end
end
