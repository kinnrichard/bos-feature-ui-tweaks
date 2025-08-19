require "test_helper"

class ParsedEmailTest < ActiveSupport::TestCase
  def setup
    @front_message = front_messages(:inbound_email)
    @parsed_email = ParsedEmail.create!(
      parseable: @front_message,
      plain_message: "This is a test reply.",
      plain_signature: "Best regards,\nJohn Doe",
      html_message: "<p>This is a test reply.</p>",
      html_signature: "<p>Best regards,<br>John Doe</p>",
      content_hash: "abc123",
      parsed_at: Time.current,
      parser_version: "1.0.0"
    )
  end

  # Association Tests
  test "belongs to parseable polymorphic association" do
    assert_equal @front_message, @parsed_email.parseable
    assert_equal "FrontMessage", @parsed_email.parseable_type
    assert_equal @front_message.id, @parsed_email.parseable_id
  end

  test "can associate with different parseable types" do
    # For future when we might parse other message types
    # This demonstrates the polymorphic nature works
    assert_instance_of FrontMessage, @parsed_email.parseable
  end

  # Validation Tests
  test "requires parseable_type" do
    parsed_email = ParsedEmail.new(
      parseable_id: @front_message.id,
      parseable_type: nil
    )
    assert_invalid parsed_email, attribute: :parseable_type
  end

  test "requires parseable_id" do
    parsed_email = ParsedEmail.new(
      parseable_type: "FrontMessage",
      parseable_id: nil
    )
    assert_invalid parsed_email, attribute: :parseable_id
  end

  test "valid with minimum required fields" do
    parsed_email = ParsedEmail.new(
      parseable: @front_message
    )
    assert_valid parsed_email
  end

  # Scope Tests
  test "with_errors scope returns records with errors" do
    # Create record with errors
    error_record = ParsedEmail.create!(
      parseable: front_messages(:another_email),
      parse_errors: { error: "Parse failed" }
    )

    # Create record without errors
    success_record = ParsedEmail.create!(
      parseable: front_messages(:outbound_email),
      parse_errors: nil
    )

    with_errors = ParsedEmail.with_errors
    assert_includes with_errors, error_record
    assert_not_includes with_errors, success_record
  end

  test "successful scope returns records without errors" do
    # Create record without errors
    success_record = ParsedEmail.create!(
      parseable: front_messages(:another_email),
      parse_errors: nil
    )

    # Create record with errors
    error_record = ParsedEmail.create!(
      parseable: front_messages(:outbound_email),
      parse_errors: { error: "Parse failed" }
    )

    successful = ParsedEmail.successful
    assert_includes successful, success_record
    assert_not_includes successful, error_record
  end

  # JSON Serialization Tests
  test "parse_options serializes and deserializes JSON" do
    options = { format: "both", signature_detection: true }
    @parsed_email.parse_options = options
    @parsed_email.save!

    @parsed_email.reload
    assert_equal options.stringify_keys, @parsed_email.parse_options
  end

  test "parse_errors serializes and deserializes JSON" do
    errors = { talon_error: "Import failed", timestamp: Time.current.to_s }
    @parsed_email.parse_errors = errors
    @parsed_email.save!

    @parsed_email.reload
    assert_equal errors.stringify_keys, @parsed_email.parse_errors
  end

  # Computed Properties Tests
  test "plain_message_with_signature combines plain message and signature" do
    expected = "This is a test reply.\n\nBest regards,\nJohn Doe"
    assert_equal expected, @parsed_email.plain_message_with_signature
  end

  test "plain_message_with_signature returns only message when no signature" do
    @parsed_email.update!(plain_signature: nil)
    assert_equal "This is a test reply.", @parsed_email.plain_message_with_signature
  end

  test "plain_message_with_signature returns nil when no message" do
    @parsed_email.update!(plain_message: nil, plain_signature: nil)
    assert_nil @parsed_email.plain_message_with_signature
  end

  test "html_message_with_signature combines HTML message and signature" do
    expected = "<p>This is a test reply.</p>\n<p>Best regards,<br>John Doe</p>"
    assert_equal expected, @parsed_email.html_message_with_signature
  end

  test "html_message_with_signature returns only message when no signature" do
    @parsed_email.update!(html_signature: nil)
    assert_equal "<p>This is a test reply.</p>", @parsed_email.html_message_with_signature
  end

  test "clean_content prefers plain text by default" do
    assert_equal "This is a test reply.", @parsed_email.clean_content
  end

  test "clean_content prefers HTML when requested" do
    assert_equal "<p>This is a test reply.</p>", @parsed_email.clean_content(prefer_html: true)
  end

  test "clean_content falls back to alternative format" do
    @parsed_email.update!(plain_message: nil)
    assert_equal "<p>This is a test reply.</p>", @parsed_email.clean_content
  end

  test "content_with_signature prefers plain text by default" do
    expected = "This is a test reply.\n\nBest regards,\nJohn Doe"
    assert_equal expected, @parsed_email.content_with_signature
  end

  test "content_with_signature prefers HTML when requested" do
    expected = "<p>This is a test reply.</p>\n<p>Best regards,<br>John Doe</p>"
    assert_equal expected, @parsed_email.content_with_signature(prefer_html: true)
  end

  test "has_signature? returns true when signature exists" do
    assert @parsed_email.has_signature?
  end

  test "has_signature? returns false when no signature" do
    @parsed_email.update!(plain_signature: nil, html_signature: nil)
    assert_not @parsed_email.has_signature?
  end

  test "signature returns preferred format" do
    assert_equal "Best regards,\nJohn Doe", @parsed_email.signature
    assert_equal "<p>Best regards,<br>John Doe</p>", @parsed_email.signature(prefer_html: true)
  end

  test "parsing_successful? returns true when no errors" do
    @parsed_email.update!(parse_errors: nil)
    assert @parsed_email.parsing_successful?

    @parsed_email.update!(parse_errors: {})
    assert @parsed_email.parsing_successful?
  end

  test "parsing_successful? returns false when errors exist" do
    @parsed_email.update!(parse_errors: { error: "Failed" })
    assert_not @parsed_email.parsing_successful?
  end

  test "parsing_status returns correct status" do
    @parsed_email.update!(parse_errors: nil)
    assert_equal "successful", @parsed_email.parsing_status

    @parsed_email.update!(parse_errors: { error: "Failed" })
    assert_equal "failed", @parsed_email.parsing_status
  end

  test "error_messages extracts messages from hash errors" do
    @parsed_email.update!(parse_errors: { talon: "Import failed", parser: "Version mismatch" })
    messages = @parsed_email.error_messages
    assert_includes messages, "Import failed"
    assert_includes messages, "Version mismatch"
  end

  test "error_messages extracts messages from array errors" do
    @parsed_email.update!(parse_errors: [ "Error 1", "Error 2" ])
    messages = @parsed_email.error_messages
    assert_equal [ "Error 1", "Error 2" ], messages
  end

  test "error_messages handles string errors" do
    @parsed_email.update!(parse_errors: "Single error")
    messages = @parsed_email.error_messages
    assert_equal [ "Single error" ], messages
  end

  test "has_parsed_content? returns true when content exists" do
    assert @parsed_email.has_parsed_content?
  end

  test "has_parsed_content? returns false when no content" do
    @parsed_email.update!(plain_message: nil, html_message: nil)
    assert_not @parsed_email.has_parsed_content?
  end

  test "parsing_summary returns comprehensive summary" do
    summary = @parsed_email.parsing_summary

    assert_equal true, summary[:plain_message]
    assert_equal true, summary[:plain_signature]
    assert_equal true, summary[:html_message]
    assert_equal true, summary[:html_signature]
    assert_equal false, summary[:has_errors]
    assert_equal @parsed_email.parsed_at, summary[:parsed_at]
    assert_equal @parsed_email.parser_version, summary[:parser_version]
  end

  # Edge Cases
  test "handles empty content gracefully" do
    empty_email = ParsedEmail.create!(
      parseable: front_messages(:another_email),
      plain_message: "",
      html_message: "",
      plain_signature: "",
      html_signature: ""
    )

    assert_not empty_email.has_parsed_content?
    assert_not empty_email.has_signature?
    assert_nil empty_email.clean_content
  end

  test "handles whitespace-only content" do
    whitespace_email = ParsedEmail.create!(
      parseable: front_messages(:another_email),
      plain_message: "   \n   ",
      html_message: "   \n   "
    )

    assert_not whitespace_email.has_parsed_content?
  end

  test "handles very long content" do
    long_content = "A" * 10000
    long_email = ParsedEmail.create!(
      parseable: front_messages(:another_email),
      plain_message: long_content,
      html_message: "<p>#{long_content}</p>"
    )

    assert long_email.has_parsed_content?
    assert_equal long_content, long_email.clean_content
  end

  # Database Constraint Tests
  test "content_hash can be nil" do
    parsed_email = ParsedEmail.create!(
      parseable: front_messages(:another_email),
      content_hash: nil
    )
    assert_valid parsed_email
  end

  test "parsed_at can be nil" do
    parsed_email = ParsedEmail.create!(
      parseable: front_messages(:another_email),
      parsed_at: nil
    )
    assert_valid parsed_email
  end

  test "parser_version can be nil" do
    parsed_email = ParsedEmail.create!(
      parseable: front_messages(:another_email),
      parser_version: nil
    )
    assert_valid parsed_email
  end

  # Performance Tests
  test "parsing_summary is efficient for large datasets" do
    # Create multiple records
    10.times do |i|
      ParsedEmail.create!(
        parseable: front_messages(:another_email),
        plain_message: "Message #{i}",
        parsed_at: i.hours.ago
      )
    end

    # Ensure queries are reasonable
    assert_queries(1) do
      ParsedEmail.all.map(&:parsing_summary)
    end
  end
end
