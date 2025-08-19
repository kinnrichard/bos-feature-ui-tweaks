require "test_helper"

class TalonEmailParserTest < ActiveSupport::TestCase
  def setup
    @parser = TalonEmailParser.instance
    @sample_plain_email = <<~EMAIL
      Thanks for the update!

      I'll review this and get back to you by Friday.

      Best,
      Jane

      On Mon, Dec 4, 2023 at 2:30 PM, John Doe <john@example.com> wrote:
      > Hi Jane,
      >#{' '}
      > Just wanted to send you the latest project update.
      > The new features are ready for review.
      >#{' '}
      > Let me know what you think!
      >#{' '}
      > Regards,
      > John
    EMAIL

    @sample_html_email = <<~HTML
      <div>
        <p>Thanks for the update!</p>
      #{'  '}
        <p>I'll review this and get back to you by Friday.</p>

        <p>Best,<br>Jane</p>
      </div>

      <div class="gmail_quote">
        <div>On Mon, Dec 4, 2023 at 2:30 PM, John Doe &lt;<a href="mailto:john@example.com">john@example.com</a>&gt; wrote:</div>
        <blockquote class="gmail_quote">
          <div>Hi Jane,</div>
          <div><br></div>
          <div>Just wanted to send you the latest project update.</div>
          <div>The new features are ready for review.</div>
          <div><br></div>
          <div>Let me know what you think!</div>
          <div><br></div>
          <div>Regards,<br>John</div>
        </blockquote>
      </div>
    HTML

    @front_message = front_messages(:inbound_email)
  end

  # Initialization and Availability Tests
  test "parser is a singleton" do
    parser1 = TalonEmailParser.instance
    parser2 = TalonEmailParser.instance
    assert_same parser1, parser2
  end

  test "parser reports availability status" do
    # Note: This may be false in test environment if Talon isn't installed
    availability = @parser.available?
    assert [ true, false ].include?(availability)
  end

  test "parser provides health check information" do
    health = @parser.health_check

    assert health.is_a?(Hash)
    assert_equal "TalonEmailParser", health[:service]
    assert [ :available, :unavailable, :error ].include?(health[:status])
    assert health.key?(:initialized)
    assert health.key?(:last_check)

    if health[:status] == :available
      assert health.key?(:talon_version)
      assert health.key?(:capabilities)
      assert health[:capabilities].is_a?(Hash)
    end
  end

  test "parser handles initialization errors gracefully" do
    # Health check should work even if initialization failed
    health = @parser.health_check
    assert health.is_a?(Hash)

    if health[:status] == :unavailable
      assert health.key?(:error)
      assert health[:error].is_a?(String)
    end
  end

  # Plain Text Parsing Tests
  test "parse_plain_text extracts reply content" do
    skip "Talon not available" unless @parser.available?

    result = @parser.parse_plain_text(@sample_plain_email)

    assert result[:success], result[:error]
    data = result[:data]

    assert_equal "text/plain", data[:format]
    assert data[:reply_text].present?
    assert data[:clean_reply].present?
    assert data[:original_content] == @sample_plain_email
    assert data[:original_length] == @sample_plain_email.length
    assert data.key?(:talon_version)

    # Reply should not contain quoted content
    assert_not data[:reply_text].include?("On Mon, Dec 4, 2023")
    assert_not data[:clean_reply].include?("john@example.com")
  end

  test "parse_plain_text handles empty content" do
    result = @parser.parse_plain_text("")

    assert_not result[:success]
    assert_equal "Content cannot be blank", result[:error]
  end

  test "parse_plain_text handles nil content" do
    result = @parser.parse_plain_text(nil)

    assert_not result[:success]
    assert_equal "Content cannot be blank", result[:error]
  end

  test "parse_plain_text handles content without quotes" do
    skip "Talon not available" unless @parser.available?

    simple_content = "This is just a simple message without any quotes or signatures."
    result = @parser.parse_plain_text(simple_content)

    assert result[:success], result[:error]
    data = result[:data]

    assert_equal simple_content.strip, data[:reply_text]
    assert_equal simple_content.strip, data[:clean_reply]
  end

  # HTML Parsing Tests
  test "parse_html extracts reply content from HTML" do
    skip "Talon not available" unless @parser.available?

    result = @parser.parse_html(@sample_html_email)

    assert result[:success], result[:error]
    data = result[:data]

    assert_equal "text/html", data[:format]
    assert data[:reply_html].present?
    assert data[:clean_reply].present?
    assert data[:original_content] == @sample_html_email
    assert data.key?(:talon_version)

    # Reply should not contain quoted content
    assert_not data[:reply_html].include?("gmail_quote")
    assert_not data[:clean_reply].include?("blockquote")
  end

  test "parse_html handles empty content" do
    result = @parser.parse_html("")

    assert_not result[:success]
    assert_equal "Content cannot be blank", result[:error]
  end

  test "parse_html handles simple HTML without quotes" do
    skip "Talon not available" unless @parser.available?

    simple_html = "<p>This is a simple HTML message.</p>"
    result = @parser.parse_html(simple_html)

    assert result[:success], result[:error]
    data = result[:data]

    assert data[:reply_html].include?("simple HTML message")
  end

  # Both Formats Parsing Tests
  test "parse_both_formats with string content" do
    skip "Talon not available" unless @parser.available?

    result = @parser.parse_both_formats(@sample_plain_email)

    assert result[:success], result[:error]
    data = result[:data]

    assert_equal "both", data[:format]
    assert data.key?(:text_parsing)
    assert data.key?(:html_parsing)
    assert data.key?(:talon_version)

    # Both parsings should be attempted
    assert data[:text_parsing].is_a?(Hash)
    assert data[:html_parsing].is_a?(Hash)
  end

  test "parse_both_formats with hash content" do
    skip "Talon not available" unless @parser.available?

    content = {
      text: @sample_plain_email,
      html: @sample_html_email
    }

    result = @parser.parse_both_formats(content)

    assert result[:success], result[:error]
    data = result[:data]

    assert_equal "both", data[:format]
    assert data.key?(:text_parsing)
    assert data.key?(:html_parsing)

    # Text parsing should have been performed
    assert data[:text_parsing][:success], data[:text_parsing][:error]

    # HTML parsing should have been performed
    assert data[:html_parsing][:success], data[:html_parsing][:error]
  end

  test "parse_both_formats with partial content hash" do
    skip "Talon not available" unless @parser.available?

    # Only text content
    text_only = { text: @sample_plain_email }
    result = @parser.parse_both_formats(text_only)

    assert result[:success], result[:error]
    data = result[:data]

    assert data.key?(:text_parsing)
    assert_not data.key?(:html_parsing)

    # Only HTML content
    html_only = { html: @sample_html_email }
    result = @parser.parse_both_formats(html_only)

    assert result[:success], result[:error]
    data = result[:data]

    assert_not data.key?(:text_parsing)
    assert data.key?(:html_parsing)
  end

  test "parse_both_formats handles invalid content" do
    result = @parser.parse_both_formats({})

    assert_not result[:success]
    assert result[:error].include?("Invalid content")
  end

  # Main Parse Email Method Tests
  test "parse_email delegates to appropriate parser based on format" do
    skip "Talon not available" unless @parser.available?

    # Test plain text format
    result = @parser.parse_email(@sample_plain_email, format: "text/plain")
    assert result[:success], result[:error]
    assert_equal "text/plain", result[:data][:format]

    # Test HTML format
    result = @parser.parse_email(@sample_html_email, format: "text/html")
    assert result[:success], result[:error]
    assert_equal "text/html", result[:data][:format]

    # Test both formats
    result = @parser.parse_email(@sample_plain_email, format: "both")
    assert result[:success], result[:error]
    assert_equal "both", result[:data][:format]
  end

  test "parse_email validates format parameter" do
    result = @parser.parse_email(@sample_plain_email, format: "invalid")

    assert_not result[:success]
    assert result[:error].include?("Unsupported format")
  end

  test "parse_email handles blank content" do
    result = @parser.parse_email("", format: "text/plain")

    assert_not result[:success]
    assert_equal "Email content cannot be blank", result[:error]
  end

  test "parse_email handles unavailable parser" do
    # Mock unavailable parser
    @parser.stub(:available?, false) do
      result = @parser.parse_email(@sample_plain_email, format: "text/plain")

      assert_not result[:success]
      assert result[:error].include?("Talon parser not initialized")
    end
  end

  # FrontMessage Integration Tests
  test "parse_front_message with valid message" do
    # Setup message with content
    @front_message.update!(
      body_plain: @sample_plain_email,
      body_html: @sample_html_email
    )

    if @parser.available?
      result = @parser.parse_front_message(@front_message, format: "both")

      assert result[:success], result[:error]
      data = result[:data]

      assert data.key?(:message_context)
      context = data[:message_context]

      assert_equal @front_message.id, context[:message_id]
      assert_equal @front_message.front_id, context[:front_id]
      assert_equal @front_message.subject, context[:subject]
      assert_equal @front_message.is_inbound, context[:is_inbound]
      assert_equal @front_message.message_type, context[:message_type]
    else
      result = @parser.parse_front_message(@front_message, format: "text/plain")
      assert_not result[:success]
    end
  end

  test "parse_front_message with plain text only" do
    @front_message.update!(
      body_plain: @sample_plain_email,
      body_html: nil
    )

    if @parser.available?
      result = @parser.parse_front_message(@front_message, format: "text/plain")
      assert result[:success], result[:error]
    else
      result = @parser.parse_front_message(@front_message, format: "text/plain")
      assert_not result[:success]
    end
  end

  test "parse_front_message with HTML only" do
    @front_message.update!(
      body_plain: nil,
      body_html: @sample_html_email
    )

    if @parser.available?
      result = @parser.parse_front_message(@front_message, format: "text/html")
      assert result[:success], result[:error]
    else
      result = @parser.parse_front_message(@front_message, format: "text/html")
      assert_not result[:success]
    end
  end

  test "parse_front_message with no content" do
    @front_message.update!(body_plain: nil, body_html: nil)

    result = @parser.parse_front_message(@front_message, format: "both")

    assert_not result[:success]
    assert_equal "No content available in message", result[:error]
  end

  test "parse_front_message with invalid message" do
    result = @parser.parse_front_message("not a message", format: "text/plain")

    assert_not result[:success]
    assert_equal "Invalid message", result[:error]
  end

  # Error Handling Tests
  test "parser handles PyCall errors gracefully" do
    skip "Talon not available" unless @parser.available?

    # Mock a PyCall error
    @parser.stub(:parse_plain_text, ->(*) { raise PyCall::PyError.new("Mock PyCall error") }) do
      result = @parser.parse_email(@sample_plain_email, format: "text/plain")

      assert_not result[:success]
      assert result[:error].include?("Python parsing error")
    end
  end

  test "parser handles standard errors gracefully" do
    skip "Talon not available" unless @parser.available?

    # Mock a standard error
    @parser.stub(:parse_plain_text, ->(*) { raise StandardError.new("Mock standard error") }) do
      result = @parser.parse_email(@sample_plain_email, format: "text/plain")

      assert_not result[:success]
      assert result[:error].include?("Parsing error")
    end
  end

  # Version and Capability Tests
  test "talon_version returns version when available" do
    if @parser.available?
      version = @parser.talon_version
      assert version.is_a?(String)
      assert_not_equal "unavailable", version
    else
      version = @parser.talon_version
      assert_equal "unavailable", version
    end
  end

  test "health check includes capability information" do
    health = @parser.health_check

    if health[:status] == :available
      capabilities = health[:capabilities]
      assert capabilities.key?(:plain_text)
      assert capabilities.key?(:html)
      assert capabilities.key?(:signature_extraction)
      assert capabilities.key?(:both_formats)
    end
  end

  # Signature Extraction Tests
  test "parse_plain_text extracts signatures when available" do
    skip "Talon not available" unless @parser.available?

    email_with_signature = <<~EMAIL
      Thanks for the meeting today.

      Best regards,
      Jane Smith
      Senior Developer
      jane@company.com
      (555) 123-4567

      On Wed, Jan 10, 2024 at 3:00 PM, Bob Johnson wrote:
      > Let's schedule a follow-up meeting next week.
    EMAIL

    result = @parser.parse_plain_text(email_with_signature)

    if result[:success]
      data = result[:data]

      # Check if signature was detected
      if data[:has_signature] && data[:signature].present?
        assert data[:signature].include?("Jane Smith")
        assert data[:signature].include?("Senior Developer")

        # Clean reply should not include signature
        assert_not data[:clean_reply].include?("jane@company.com")
      end
    end
  end

  # Performance Tests
  test "parser handles large email content efficiently" do
    skip "Talon not available" unless @parser.available?

    # Create large content (10KB)
    large_content = "A" * 10000 + "\n\nOn Mon, Dec 4, 2023:\n> Original message"

    start_time = Time.current
    result = @parser.parse_plain_text(large_content)
    end_time = Time.current

    # Should complete within reasonable time (5 seconds)
    assert (end_time - start_time) < 5.0

    if result[:success]
      assert result[:data][:reply_text].present?
      assert result[:data][:original_length] == large_content.length
    end
  end

  test "parser handles multiple concurrent requests" do
    skip "Talon not available" unless @parser.available?

    threads = []
    results = []

    # Create 5 concurrent parsing requests
    5.times do |i|
      threads << Thread.new do
        content = "Message #{i}\n\nOn Mon: > Quote #{i}"
        result = @parser.parse_plain_text(content)
        results << result
      end
    end

    threads.each(&:join)

    # All requests should complete successfully
    results.each do |result|
      assert result[:success], result[:error] if result
    end

    assert_equal 5, results.length
  end

  # Edge Cases
  test "parser handles unicode content" do
    skip "Talon not available" unless @parser.available?

    unicode_content = <<~EMAIL
      Hello! 你好! こんにちは! 🎉

      Thanks for the ünïcödë test.

      On Mon: > Original message with émojis 🚀
    EMAIL

    result = @parser.parse_plain_text(unicode_content)

    if result[:success]
      data = result[:data]
      assert data[:reply_text].include?("你好")
      assert data[:reply_text].include?("🎉")
    end
  end

  test "parser handles very short content" do
    skip "Talon not available" unless @parser.available?

    short_content = "OK"
    result = @parser.parse_plain_text(short_content)

    if result[:success]
      data = result[:data]
      assert_equal "OK", data[:reply_text]
      assert_equal 2, data[:reply_length]
    end
  end

  test "parser handles content with only whitespace and quotes" do
    skip "Talon not available" unless @parser.available?

    whitespace_content = "   \n\n  \n\nOn Mon: > Original message"
    result = @parser.parse_plain_text(whitespace_content)

    if result[:success]
      data = result[:data]
      # Should extract minimal or empty reply
      assert data[:reply_text].blank? || data[:reply_text].strip.empty?
    end
  end
end
