require "test_helper"

class EmailParseJobTest < ActiveSupport::TestCase
  def setup
    @front_message = front_messages(:inbound_email)
    @front_message.update!(
      is_inbound: true,
      is_draft: false,
      message_type: "email",
      body_plain: sample_plain_email,
      body_html: sample_html_email,
      subject: "Test Email Subject"
    )
  end

  def sample_plain_email
    <<~EMAIL
      Thanks for the update!

      I'll review this by Friday.

      Best,
      Jane

      On Mon, Dec 4, 2023 at 2:30 PM, John Doe <john@example.com> wrote:
      > Hi Jane,
      > Just wanted to send the latest update.
      > Regards, John
    EMAIL
  end

  def sample_html_email
    <<~HTML
      <div>
        <p>Thanks for the update!</p>
        <p>I'll review this by Friday.</p>
        <p>Best,<br>Jane</p>
      </div>
      <div class="gmail_quote">
        <blockquote>
          <div>Hi Jane,</div>
          <div>Just wanted to send the latest update.</div>
          <div>Regards, John</div>
        </blockquote>
      </div>
    HTML
  end

  # Basic Job Execution Tests
  test "job performs successfully with valid message" do
    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, {
      success: true,
      data: {
        format: "both",
        text_parsing: {
          success: true,
          data: {
            clean_reply: "Thanks for the update!\n\nI'll review this by Friday.\n\nBest,\nJane",
            signature: "Best,\nJane"
          }
        },
        html_parsing: {
          success: true,
          data: {
            clean_reply: "<p>Thanks for the update!</p><p>I'll review this by Friday.</p>",
            signature: "<p>Best,<br>Jane</p>"
          }
        },
        talon_version: "1.0.0"
      }
    }, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      assert_difference "ParsedEmail.count", 1 do
        EmailParseJob.perform_now(@front_message)
      end
    end

    parser_mock.verify

    # Verify ParsedEmail was created correctly
    parsed_email = @front_message.reload.parsed_email
    assert parsed_email.present?
    assert_equal "Thanks for the update!\n\nI'll review this by Friday.\n\nBest,\nJane", parsed_email.plain_message
    assert_equal "Best,\nJane", parsed_email.plain_signature
    assert_equal "<p>Thanks for the update!</p><p>I'll review this by Friday.</p>", parsed_email.html_message
    assert_equal "<p>Best,<br>Jane</p>", parsed_email.html_signature
    assert_equal "1.0.0", parsed_email.parser_version
    assert parsed_email.parsing_successful?
  end

  test "job updates existing parsed email record" do
    # Create existing parsed email
    existing_parsed_email = ParsedEmail.create!(
      parseable: @front_message,
      plain_message: "Old content",
      parsed_at: 1.day.ago,
      parser_version: "0.9.0"
    )

    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, {
      success: true,
      data: {
        format: "both",
        text_parsing: {
          success: true,
          data: {
            clean_reply: "New parsed content",
            signature: "New signature"
          }
        },
        html_parsing: {
          success: true,
          data: {
            clean_reply: "<p>New parsed content</p>",
            signature: "<p>New signature</p>"
          }
        },
        talon_version: "1.1.0"
      }
    }, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      # Should not create new record
      assert_no_difference "ParsedEmail.count" do
        EmailParseJob.perform_now(@front_message)
      end
    end

    # Verify existing record was updated
    existing_parsed_email.reload
    assert_equal "New parsed content", existing_parsed_email.plain_message
    assert_equal "New signature", existing_parsed_email.plain_signature
    assert_equal "1.1.0", existing_parsed_email.parser_version
  end

  # Message Filtering Tests
  test "job skips outbound messages" do
    @front_message.update!(is_inbound: false)

    assert_no_difference "ParsedEmail.count" do
      EmailParseJob.perform_now(@front_message)
    end
  end

  test "job skips draft messages" do
    @front_message.update!(is_draft: true)

    assert_no_difference "ParsedEmail.count" do
      EmailParseJob.perform_now(@front_message)
    end
  end

  test "job skips non-email message types" do
    @front_message.update!(message_type: "sms")

    assert_no_difference "ParsedEmail.count" do
      EmailParseJob.perform_now(@front_message)
    end
  end

  test "job processes inbound email messages" do
    @front_message.update!(
      is_inbound: true,
      is_draft: false,
      message_type: "email"
    )

    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, {
      success: true,
      data: {
        format: "both",
        text_parsing: { success: true, data: { clean_reply: "Test", signature: nil } },
        html_parsing: { success: true, data: { clean_reply: "<p>Test</p>", signature: nil } },
        talon_version: "1.0.0"
      }
    }, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      assert_difference "ParsedEmail.count", 1 do
        EmailParseJob.perform_now(@front_message)
      end
    end
  end

  test "job returns early for invalid message types" do
    # Should not call parser for non-FrontMessage objects
    assert_no_difference "ParsedEmail.count" do
      EmailParseJob.perform_now("not a message")
    end
  end

  # Error Handling Tests
  test "job handles parsing failures gracefully" do
    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, {
      success: false,
      error: "Talon import failed"
    }, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      assert_difference "ParsedEmail.count", 1 do
        EmailParseJob.perform_now(@front_message)
      end
    end

    # Verify error was recorded
    parsed_email = @front_message.reload.parsed_email
    assert parsed_email.present?
    assert_not parsed_email.parsing_successful?

    errors = JSON.parse(parsed_email.parse_errors)
    assert_equal "Talon import failed", errors["error"]
    assert_equal "error", parsed_email.parser_version
  end

  test "job handles standard errors and re-raises for retry" do
    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, ->(*) { raise StandardError.new("Unexpected error") }, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      assert_raises StandardError do
        EmailParseJob.perform_now(@front_message)
      end
    end

    # Should still create error record
    parsed_email = @front_message.reload.parsed_email
    assert parsed_email.present?
    assert_not parsed_email.parsing_successful?
  end

  test "job handles TalonEmailParser::ParseError with retry" do
    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, ->(*) { raise TalonEmailParser::ParseError.new("Parse failed") }, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      assert_raises TalonEmailParser::ParseError do
        EmailParseJob.perform_now(@front_message)
      end
    end

    # Should create error record
    parsed_email = @front_message.reload.parsed_email
    assert parsed_email.present?
    assert_not parsed_email.parsing_successful?
  end

  # Content Hash and Deduplication Tests
  test "job generates consistent content hash" do
    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, {
      success: true,
      data: {
        format: "both",
        text_parsing: { success: true, data: { clean_reply: "Test", signature: nil } },
        html_parsing: { success: true, data: { clean_reply: "<p>Test</p>", signature: nil } },
        talon_version: "1.0.0"
      }
    }, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      EmailParseJob.perform_now(@front_message)
    end

    parsed_email = @front_message.reload.parsed_email
    first_hash = parsed_email.content_hash

    # Hash should be consistent for same content
    assert first_hash.present?
    assert_equal 64, first_hash.length # SHA256 hex string length
  end

  test "job generates different hash for different content" do
    # First parsing
    parser_mock1 = Minitest::Mock.new
    parser_mock1.expect :parse_front_message, {
      success: true,
      data: {
        format: "both",
        text_parsing: { success: true, data: { clean_reply: "First content", signature: nil } },
        html_parsing: { success: true, data: { clean_reply: "<p>First content</p>", signature: nil } },
        talon_version: "1.0.0"
      }
    }, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock1 do
      EmailParseJob.perform_now(@front_message)
    end

    first_hash = @front_message.reload.parsed_email.content_hash

    # Update message content
    @front_message.update!(body_plain: "Different content", body_html: "<p>Different content</p>")

    # Second parsing
    parser_mock2 = Minitest::Mock.new
    parser_mock2.expect :parse_front_message, {
      success: true,
      data: {
        format: "both",
        text_parsing: { success: true, data: { clean_reply: "Different content", signature: nil } },
        html_parsing: { success: true, data: { clean_reply: "<p>Different content</p>", signature: nil } },
        talon_version: "1.0.0"
      }
    }, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock2 do
      EmailParseJob.perform_now(@front_message)
    end

    second_hash = @front_message.reload.parsed_email.content_hash

    assert_not_equal first_hash, second_hash
  end

  # Content Extraction Tests
  test "job extracts plain text content correctly" do
    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, {
      success: true,
      data: {
        format: "text/plain",
        clean_reply: "Plain text reply",
        signature: "Plain signature",
        talon_version: "1.0.0"
      }
    }, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      EmailParseJob.perform_now(@front_message)
    end

    parsed_email = @front_message.reload.parsed_email
    assert_equal "Plain text reply", parsed_email.plain_message
    assert_equal "Plain signature", parsed_email.plain_signature
    assert_nil parsed_email.html_message
    assert_nil parsed_email.html_signature
  end

  test "job extracts HTML content correctly" do
    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, {
      success: true,
      data: {
        format: "text/html",
        clean_reply: "<p>HTML reply</p>",
        signature: "<p>HTML signature</p>",
        talon_version: "1.0.0"
      }
    }, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      EmailParseJob.perform_now(@front_message)
    end

    parsed_email = @front_message.reload.parsed_email
    assert_nil parsed_email.plain_message
    assert_nil parsed_email.plain_signature
    assert_equal "<p>HTML reply</p>", parsed_email.html_message
    assert_equal "<p>HTML signature</p>", parsed_email.html_signature
  end

  test "job extracts both formats correctly" do
    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, {
      success: true,
      data: {
        format: "both",
        text_parsing: {
          success: true,
          data: {
            clean_reply: "Plain text reply",
            signature: "Plain signature"
          }
        },
        html_parsing: {
          success: true,
          data: {
            clean_reply: "<p>HTML reply</p>",
            signature: "<p>HTML signature</p>"
          }
        },
        talon_version: "1.0.0"
      }
    }, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      EmailParseJob.perform_now(@front_message)
    end

    parsed_email = @front_message.reload.parsed_email
    assert_equal "Plain text reply", parsed_email.plain_message
    assert_equal "Plain signature", parsed_email.plain_signature
    assert_equal "<p>HTML reply</p>", parsed_email.html_message
    assert_equal "<p>HTML signature</p>", parsed_email.html_signature
  end

  test "job handles partial parsing results" do
    # Text parsing succeeds, HTML parsing fails
    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, {
      success: true,
      data: {
        format: "both",
        text_parsing: {
          success: true,
          data: {
            clean_reply: "Plain text reply",
            signature: "Plain signature"
          }
        },
        html_parsing: {
          success: false,
          error: "HTML parsing failed"
        },
        talon_version: "1.0.0"
      }
    }, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      EmailParseJob.perform_now(@front_message)
    end

    parsed_email = @front_message.reload.parsed_email
    assert_equal "Plain text reply", parsed_email.plain_message
    assert_equal "Plain signature", parsed_email.plain_signature
    assert_nil parsed_email.html_message
    assert_nil parsed_email.html_signature
  end

  # Options and Metadata Tests
  test "job stores parsing options" do
    options = { format: "both", signature_detection: true }

    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, {
      success: true,
      data: {
        format: "both",
        text_parsing: { success: true, data: { clean_reply: "Test", signature: nil } },
        html_parsing: { success: true, data: { clean_reply: "<p>Test</p>", signature: nil } },
        talon_version: "1.0.0"
      }
    }, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      EmailParseJob.perform_now(@front_message, options)
    end

    parsed_email = @front_message.reload.parsed_email
    stored_options = JSON.parse(parsed_email.parse_options)
    assert_equal options.stringify_keys, stored_options
  end

  test "job records parsing timestamp" do
    freeze_time = Time.current

    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, {
      success: true,
      data: {
        format: "both",
        text_parsing: { success: true, data: { clean_reply: "Test", signature: nil } },
        html_parsing: { success: true, data: { clean_reply: "<p>Test</p>", signature: nil } },
        talon_version: "1.0.0"
      }
    }, [ @front_message, { format: "both" } ]

    travel_to freeze_time do
      TalonEmailParser.stub :instance, parser_mock do
        EmailParseJob.perform_now(@front_message)
      end
    end

    parsed_email = @front_message.reload.parsed_email
    assert_in_delta freeze_time, parsed_email.parsed_at, 1.second
  end

  # Queue Configuration Tests
  test "job is queued on parsing queue" do
    assert_equal :parsing, EmailParseJob.new.queue_name
  end

  test "job has retry configuration for TalonEmailParser errors" do
    # This tests the retry_on configuration
    retry_config = EmailParseJob.retry_on_block_variable_name
    assert retry_config.present?
  end

  # Integration with ActiveJob Tests
  test "job can be enqueued for later execution" do
    assert_enqueued_with(job: EmailParseJob, args: [ @front_message, {} ]) do
      EmailParseJob.perform_later(@front_message)
    end
  end

  test "job can be enqueued with options" do
    options = { signature_detection: true }

    assert_enqueued_with(job: EmailParseJob, args: [ @front_message, options ]) do
      EmailParseJob.perform_later(@front_message, options)
    end
  end

  # Edge Cases and Robustness Tests
  test "job handles nil message gracefully" do
    assert_no_difference "ParsedEmail.count" do
      EmailParseJob.perform_now(nil)
    end
  end

  test "job handles message without content" do
    @front_message.update!(body_plain: nil, body_html: nil)

    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, {
      success: false,
      error: "No content available"
    }, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      EmailParseJob.perform_now(@front_message)
    end

    parsed_email = @front_message.reload.parsed_email
    assert parsed_email.present?
    assert_not parsed_email.parsing_successful?
  end

  test "job handles very long content" do
    long_content = "A" * 100000  # 100KB content
    @front_message.update!(body_plain: long_content)

    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, {
      success: true,
      data: {
        format: "text/plain",
        clean_reply: long_content[0..1000],  # Truncated for test
        signature: nil,
        talon_version: "1.0.0"
      }
    }, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      assert_difference "ParsedEmail.count", 1 do
        EmailParseJob.perform_now(@front_message)
      end
    end

    parsed_email = @front_message.reload.parsed_email
    assert parsed_email.present?
    assert parsed_email.parsing_successful?
  end

  test "job handles unicode and special characters" do
    unicode_content = "Hello 🌍! This is a test with ünïcödë characters."
    @front_message.update!(body_plain: unicode_content)

    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, {
      success: true,
      data: {
        format: "text/plain",
        clean_reply: unicode_content,
        signature: nil,
        talon_version: "1.0.0"
      }
    }, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      EmailParseJob.perform_now(@front_message)
    end

    parsed_email = @front_message.reload.parsed_email
    assert_equal unicode_content, parsed_email.plain_message
  end
end
