require "test_helper"

class EmailParsingIntegrationTest < ActiveSupport::TestCase
  def setup
    # Clean up any existing ParsedEmail records
    ParsedEmail.delete_all

    @front_message = front_messages(:inbound_email)
    @front_message.update!(
      body_plain: File.read(Rails.root.join("test/fixtures/emails/gmail_reply.txt")),
      body_html: File.read(Rails.root.join("test/fixtures/emails/gmail_reply.html"))
    )

    # Mock successful Talon parser for integration tests
    @parser_response = {
      success: true,
      data: {
        format: "both",
        text_parsing: {
          success: true,
          data: {
            clean_reply: "Thanks for the update on the project. I've reviewed the latest changes and they look great!\n\nI have a few questions about the implementation:\n1. How does the error handling work in the new parser?\n2. What's the performance impact on large email threads?\n\nLet me know when you have time to discuss.",
            signature: "Best regards,\nSarah Johnson\nSenior Developer\nsarah@company.com\n(555) 123-4567"
          }
        },
        html_parsing: {
          success: true,
          data: {
            clean_reply: "<div>Thanks for the update on the project. I've reviewed the latest changes and they look great!</div><div><br></div><div>I have a few questions about the implementation:</div><div>1. How does the error handling work in the new parser?</div><div>2. What's the performance impact on large email threads?</div><div><br></div><div>Let me know when you have time to discuss.</div>",
            signature: "<div>Best regards,<br>Sarah Johnson<br>Senior Developer<br><a href=\"mailto:sarah@company.com\">sarah@company.com</a><br>(555) 123-4567</div>"
          }
        },
        talon_version: "1.0.0"
      }
    }
  end

  # End-to-End Workflow Tests
  test "complete email parsing workflow via EmailParseJob" do
    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, @parser_response, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      # Execute the job
      EmailParseJob.perform_now(@front_message)
    end

    parser_mock.verify

    # Verify ParsedEmail record was created
    @front_message.reload
    parsed_email = @front_message.parsed_email

    assert parsed_email.present?
    assert parsed_email.parsing_successful?
    assert_equal "Thanks for the update on the project. I've reviewed the latest changes and they look great!\n\nI have a few questions about the implementation:\n1. How does the error handling work in the new parser?\n2. What's the performance impact on large email threads?\n\nLet me know when you have time to discuss.", parsed_email.plain_message
    assert_equal "Best regards,\nSarah Johnson\nSenior Developer\nsarah@company.com\n(555) 123-4567", parsed_email.plain_signature
    assert parsed_email.html_message.present?
    assert parsed_email.html_signature.present?
    assert_equal "1.0.0", parsed_email.parser_version
  end

  test "complete batch parsing workflow via FrontMessageParsingJob" do
    # Create multiple messages
    messages = []
    5.times do |i|
      message = FrontMessage.create!(
        front_id: "batch_msg_#{i}",
        front_conversation: front_conversations(:one),
        message_uid: "batch_uid_#{i}",
        message_type: "email",
        is_inbound: true,
        is_draft: false,
        subject: "Batch Test Email #{i}",
        body_plain: "Test message #{i} content\n\nOn Mon: > Original #{i}",
        body_html: "<p>Test message #{i} content</p><blockquote>Original #{i}</blockquote>",
        created_at_timestamp: i.hours.ago.to_f
      )
      messages << message
    end

    batch_options = {
      message_ids: messages.map(&:id),
      batch_size: 2,
      skip_parsed: true,
      force_reparse: false,
      options: { format: "both" }
    }

    # Mock parser for all messages
    parser_mock = Minitest::Mock.new
    messages.each do |message|
      parser_mock.expect :parse_front_message, {
        success: true,
        data: {
          format: "both",
          text_parsing: {
            success: true,
            data: {
              clean_reply: "Test reply #{message.id}",
              signature: "Test signature #{message.id}"
            }
          },
          html_parsing: {
            success: true,
            data: {
              clean_reply: "<p>Test reply #{message.id}</p>",
              signature: "<p>Test signature #{message.id}</p>"
            }
          },
          talon_version: "1.0.0"
        }
      }, [ message, { format: "both" } ]
    end

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(batch_options)

      assert_equal "completed", result[:status]
      assert_equal 5, result[:statistics][:successful]
      assert_equal 0, result[:statistics][:failed]
    end

    parser_mock.verify

    # Verify all messages have ParsedEmail records
    messages.each do |message|
      message.reload
      parsed_email = message.parsed_email

      assert parsed_email.present?
      assert parsed_email.parsing_successful?
      assert_equal "Test reply #{message.id}", parsed_email.plain_message
      assert_equal "Test signature #{message.id}", parsed_email.plain_signature
    end
  end

  test "FrontMessage after_create callback triggers EmailParseJob" do
    # This test verifies the callback integration
    skip "Callback integration test - requires actual callback setup"

    # In a real implementation, you would test:
    # 1. Create a new FrontMessage that meets parsing criteria
    # 2. Verify that EmailParseJob is enqueued automatically
    # 3. Process the job and verify ParsedEmail creation
  end

  # Error Handling Integration Tests
  test "end-to-end error handling workflow" do
    error_response = {
      success: false,
      error: "Talon import failed"
    }

    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, error_response, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      EmailParseJob.perform_now(@front_message)
    end

    # Verify error was recorded properly
    @front_message.reload
    parsed_email = @front_message.parsed_email

    assert parsed_email.present?
    assert_not parsed_email.parsing_successful?
    assert_equal "error", parsed_email.parser_version

    errors = JSON.parse(parsed_email.parse_errors)
    assert_equal "Talon import failed", errors["error"]
    assert errors["timestamp"].present?
  end

  test "batch processing with mixed success and failure" do
    # Create test messages
    success_message = FrontMessage.create!(
      front_id: "success_msg",
      front_conversation: front_conversations(:one),
      message_uid: "success_uid",
      message_type: "email",
      is_inbound: true,
      is_draft: false,
      subject: "Success Email",
      body_plain: "This will succeed",
      created_at_timestamp: 1.hour.ago.to_f
    )

    failure_message = FrontMessage.create!(
      front_id: "failure_msg",
      front_conversation: front_conversations(:one),
      message_uid: "failure_uid",
      message_type: "email",
      is_inbound: true,
      is_draft: false,
      subject: "Failure Email",
      body_plain: "This will fail",
      created_at_timestamp: 2.hours.ago.to_f
    )

    batch_options = {
      message_ids: [ success_message.id, failure_message.id ],
      batch_size: 2,
      options: { format: "both" }
    }

    # Mock parser with mixed results
    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, {
      success: true,
      data: {
        format: "both",
        text_parsing: {
          success: true,
          data: { clean_reply: "Success reply", signature: "Success sig" }
        },
        html_parsing: {
          success: true,
          data: { clean_reply: "<p>Success reply</p>", signature: "<p>Success sig</p>" }
        },
        talon_version: "1.0.0"
      }
    }, [ success_message, { format: "both" } ]

    parser_mock.expect :parse_front_message, {
      success: false,
      error: "Parsing failed"
    }, [ failure_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(batch_options)

      assert_equal "completed", result[:status]
      assert_equal 2, result[:statistics][:processed]
      assert_equal 1, result[:statistics][:successful]
      assert_equal 1, result[:statistics][:failed]
      assert_equal 0.5, result[:success_rate]
    end

    # Verify individual results
    success_message.reload
    assert success_message.parsed_email.present?
    assert success_message.parsed_email.parsing_successful?

    failure_message.reload
    assert failure_message.parsed_email.present?
    assert_not failure_message.parsed_email.parsing_successful?
  end

  # Content Processing Integration Tests
  test "processing different email client formats" do
    test_cases = [
      {
        name: "Gmail",
        plain_file: "gmail_reply.txt",
        html_file: "gmail_reply.html"
      },
      {
        name: "Outlook",
        plain_file: "outlook_reply.txt",
        html_file: "outlook_reply.html"
      },
      {
        name: "Apple Mail",
        plain_file: "apple_mail_reply.txt",
        html_file: "apple_mail_reply.html"
      }
    ]

    test_cases.each do |test_case|
      message = FrontMessage.create!(
        front_id: "#{test_case[:name].downcase}_msg",
        front_conversation: front_conversations(:one),
        message_uid: "#{test_case[:name].downcase}_uid",
        message_type: "email",
        is_inbound: true,
        is_draft: false,
        subject: "#{test_case[:name]} Test Email",
        body_plain: File.read(Rails.root.join("test/fixtures/emails/#{test_case[:plain_file]}")),
        body_html: File.read(Rails.root.join("test/fixtures/emails/#{test_case[:html_file]}")),
        created_at_timestamp: 1.hour.ago.to_f
      )

      # Mock successful parsing for each format
      parser_mock = Minitest::Mock.new
      parser_mock.expect :parse_front_message, {
        success: true,
        data: {
          format: "both",
          text_parsing: {
            success: true,
            data: {
              clean_reply: "Parsed #{test_case[:name]} reply",
              signature: "Parsed #{test_case[:name]} signature"
            }
          },
          html_parsing: {
            success: true,
            data: {
              clean_reply: "<p>Parsed #{test_case[:name]} reply</p>",
              signature: "<p>Parsed #{test_case[:name]} signature</p>"
            }
          },
          talon_version: "1.0.0"
        }
      }, [ message, { format: "both" } ]

      TalonEmailParser.stub :instance, parser_mock do
        EmailParseJob.perform_now(message)
      end

      parser_mock.verify

      # Verify parsing results
      message.reload
      parsed_email = message.parsed_email

      assert parsed_email.present?, "#{test_case[:name]} parsing failed"
      assert parsed_email.parsing_successful?, "#{test_case[:name]} parsing was not successful"
      assert_equal "Parsed #{test_case[:name]} reply", parsed_email.plain_message
      assert_equal "Parsed #{test_case[:name]} signature", parsed_email.plain_signature
    end
  end

  # Content Hash and Deduplication Integration Tests
  test "content hash prevents duplicate processing" do
    # Process message first time
    parser_mock1 = Minitest::Mock.new
    parser_mock1.expect :parse_front_message, @parser_response, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock1 do
      EmailParseJob.perform_now(@front_message)
    end

    first_parsed_email = @front_message.reload.parsed_email
    first_content_hash = first_parsed_email.content_hash
    first_parsed_at = first_parsed_email.parsed_at

    # Try to process same message again with batch job (should skip due to hash)
    batch_options = {
      message_ids: [ @front_message.id ],
      batch_size: 1,
      skip_parsed: true,
      force_reparse: false,
      options: { format: "both" }
    }

    # Parser should not be called since message should be skipped
    result = FrontMessageParsingJob.perform_now(batch_options)

    assert_equal "completed", result[:status]
    assert_equal 0, result[:statistics][:total_messages]  # Should be skipped
    assert_equal 0, result[:statistics][:processed]

    # Verify ParsedEmail was not modified
    @front_message.reload
    assert_equal first_content_hash, @front_message.parsed_email.content_hash
    assert_equal first_parsed_at, @front_message.parsed_email.parsed_at
  end

  test "force_reparse bypasses content hash deduplication" do
    # Process message first time
    parser_mock1 = Minitest::Mock.new
    parser_mock1.expect :parse_front_message, @parser_response, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock1 do
      EmailParseJob.perform_now(@front_message)
    end

    first_parsed_at = @front_message.reload.parsed_email.parsed_at

    # Force reparse with updated response
    updated_response = @parser_response.deep_dup
    updated_response[:data][:text_parsing][:data][:clean_reply] = "Updated reply content"

    parser_mock2 = Minitest::Mock.new
    parser_mock2.expect :parse_front_message, updated_response, [ @front_message, { format: "both" } ]

    batch_options = {
      message_ids: [ @front_message.id ],
      batch_size: 1,
      skip_parsed: false,
      force_reparse: true,
      options: { format: "both" }
    }

    TalonEmailParser.stub :instance, parser_mock2 do
      result = FrontMessageParsingJob.perform_now(batch_options)

      assert_equal "completed", result[:status]
      assert_equal 1, result[:statistics][:total_messages]
      assert_equal 1, result[:statistics][:processed]
      assert_equal 1, result[:statistics][:successful]
    end

    parser_mock2.verify

    # Verify content was updated
    @front_message.reload
    assert_equal "Updated reply content", @front_message.parsed_email.plain_message
    assert @front_message.parsed_email.parsed_at > first_parsed_at
  end

  # Performance and Metrics Integration Tests
  test "batch processing performance metrics are accurate" do
    # Create multiple messages
    messages = []
    10.times do |i|
      message = FrontMessage.create!(
        front_id: "perf_msg_#{i}",
        front_conversation: front_conversations(:one),
        message_uid: "perf_uid_#{i}",
        message_type: "email",
        is_inbound: true,
        is_draft: false,
        subject: "Performance Test #{i}",
        body_plain: "Performance test content #{i}",
        created_at_timestamp: i.minutes.ago.to_f
      )
      messages << message
    end

    batch_options = {
      message_ids: messages.map(&:id),
      batch_size: 3,
      options: { format: "both" }
    }

    # Mock parser with slight delay to test timing
    parser_mock = Minitest::Mock.new
    messages.each do |message|
      parser_mock.expect :parse_front_message,
        ->(*) {
          sleep(0.001)  # 1ms delay per message
          {
            success: true,
            data: {
              format: "both",
              text_parsing: { success: true, data: { clean_reply: "Reply #{message.id}", signature: nil } },
              html_parsing: { success: true, data: { clean_reply: "<p>Reply #{message.id}</p>", signature: nil } },
              talon_version: "1.0.0"
            }
          }
        },
        [ message, { format: "both" } ]
    end

    start_time = Time.current

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(batch_options)

      # Verify timing metrics
      assert result[:duration_seconds] > 0.01  # At least 10ms total
      assert result[:throughput_per_second] > 0
      assert result[:success_rate] == 1.0

      # Verify job metadata
      job_metadata = result[:job_metadata]
      assert job_metadata[:job_id].present?
      assert job_metadata[:queue_name] == "parsing_priority"
      assert job_metadata[:created_at].present?
    end

    end_time = Time.current

    # Verify metrics are cached
    cache_key = "email_parsing_metrics:batch:#{result[:job_metadata][:job_id]}"
    cached_metrics = Rails.cache.read(cache_key)

    assert cached_metrics.present?
    assert_equal 10, cached_metrics[:total_messages]
    assert_equal 10, cached_metrics[:successful]
    assert_equal 0, cached_metrics[:failed]
    assert cached_metrics[:duration_seconds] > 0
    assert cached_metrics[:throughput_per_second] > 0
  end

  # Edge Case Integration Tests
  test "processing messages with no content" do
    empty_message = FrontMessage.create!(
      front_id: "empty_msg",
      front_conversation: front_conversations(:one),
      message_uid: "empty_uid",
      message_type: "email",
      is_inbound: true,
      is_draft: false,
      subject: "Empty Email",
      body_plain: nil,
      body_html: nil,
      created_at_timestamp: 1.hour.ago.to_f
    )

    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, {
      success: false,
      error: "No content available in message"
    }, [ empty_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      EmailParseJob.perform_now(empty_message)
    end

    # Verify error handling
    empty_message.reload
    parsed_email = empty_message.parsed_email

    assert parsed_email.present?
    assert_not parsed_email.parsing_successful?

    errors = JSON.parse(parsed_email.parse_errors)
    assert_equal "No content available in message", errors["error"]
  end

  test "processing messages with unicode content" do
    unicode_message = FrontMessage.create!(
      front_id: "unicode_msg",
      front_conversation: front_conversations(:one),
      message_uid: "unicode_uid",
      message_type: "email",
      is_inbound: true,
      is_draft: false,
      subject: "Unicode Test 🌍",
      body_plain: "Hello 世界! Testing ünïcödë content 🚀\n\nOn Mon: > Original",
      body_html: "<p>Hello 世界! Testing ünïcödë content 🚀</p><blockquote>Original</blockquote>",
      created_at_timestamp: 1.hour.ago.to_f
    )

    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, {
      success: true,
      data: {
        format: "both",
        text_parsing: {
          success: true,
          data: {
            clean_reply: "Hello 世界! Testing ünïcödë content 🚀",
            signature: nil
          }
        },
        html_parsing: {
          success: true,
          data: {
            clean_reply: "<p>Hello 世界! Testing ünïcödë content 🚀</p>",
            signature: nil
          }
        },
        talon_version: "1.0.0"
      }
    }, [ unicode_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      EmailParseJob.perform_now(unicode_message)
    end

    # Verify unicode handling
    unicode_message.reload
    parsed_email = unicode_message.parsed_email

    assert parsed_email.present?
    assert parsed_email.parsing_successful?
    assert_equal "Hello 世界! Testing ünïcödë content 🚀", parsed_email.plain_message
    assert parsed_email.plain_message.include?("🚀")
    assert parsed_email.plain_message.include?("世界")
    assert parsed_email.plain_message.include?("ünïcödë")
  end

  # Cleanup and State Management Tests
  test "parsing does not interfere with existing associations" do
    # Create associated records
    existing_attachment = FrontAttachment.create!(
      front_message: @front_message,
      front_id: "att_001",
      filename: "test.pdf",
      url: "https://example.com/test.pdf",
      content_type: "application/pdf",
      size: 12345
    )

    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message, @parser_response, [ @front_message, { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      EmailParseJob.perform_now(@front_message)
    end

    # Verify associations are preserved
    @front_message.reload
    assert @front_message.parsed_email.present?
    assert @front_message.front_attachments.include?(existing_attachment)
    assert_equal 1, @front_message.front_attachments.count
  end

  private

  def generate_content_hash(message)
    content = [
      message.body_plain,
      message.body_html,
      message.subject,
      message.front_id
    ].compact.join("|")

    Digest::SHA256.hexdigest(content)
  end
end
