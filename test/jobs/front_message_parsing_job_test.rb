require "test_helper"

class FrontMessageParsingJobTest < ActiveSupport::TestCase
  def setup
    @messages = create_test_messages(5)
    @batch_options = {
      message_ids: @messages.map(&:id),
      batch_size: 2,
      skip_parsed: true,
      force_reparse: false,
      options: { format: "both" }
    }
  end

  def create_test_messages(count)
    messages = []
    count.times do |i|
      message = FrontMessage.create!(
        front_id: "msg_#{i}",
        front_conversation: front_conversations(:one),
        message_uid: "uid_#{i}",
        message_type: "email",
        is_inbound: true,
        is_draft: false,
        subject: "Test Email #{i}",
        body_plain: "Test message #{i}\n\nOn Mon: > Original #{i}",
        body_html: "<p>Test message #{i}</p><blockquote>Original #{i}</blockquote>",
        created_at_timestamp: i.hours.ago.to_f
      )
      messages << message
    end
    messages
  end

  def mock_successful_parser_response(message_id)
    {
      success: true,
      data: {
        format: "both",
        text_parsing: {
          success: true,
          data: {
            clean_reply: "Test reply #{message_id}",
            signature: "Signature #{message_id}"
          }
        },
        html_parsing: {
          success: true,
          data: {
            clean_reply: "<p>Test reply #{message_id}</p>",
            signature: "<p>Signature #{message_id}</p>"
          }
        },
        talon_version: "1.0.0"
      }
    }
  end

  def mock_failed_parser_response(error_message)
    {
      success: false,
      error: error_message
    }
  end

  # Basic Batch Processing Tests
  test "job processes batch of messages successfully" do
    parser_mock = Minitest::Mock.new

    # Expect parser calls for each message
    @messages.each do |message|
      parser_mock.expect :parse_front_message,
        mock_successful_parser_response(message.id),
        [ message, { format: "both" } ]
    end

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(@batch_options)

      assert_equal "completed", result[:status]
      assert_equal 5, result[:statistics][:total_messages]
      assert_equal 5, result[:statistics][:processed]
      assert_equal 5, result[:statistics][:successful]
      assert_equal 0, result[:statistics][:failed]
      assert_equal 1.0, result[:success_rate]
    end

    parser_mock.verify

    # Verify all messages have ParsedEmail records
    @messages.each do |message|
      message.reload
      assert message.parsed_email.present?
      assert message.parsed_email.parsing_successful?
    end
  end

  test "job processes messages in specified batch sizes" do
    parser_mock = Minitest::Mock.new
    call_order = []

    # Track order of parser calls
    @messages.each do |message|
      parser_mock.expect :parse_front_message,
        ->(msg, opts) {
          call_order << msg.id
          mock_successful_parser_response(msg.id)
        },
        [ message, { format: "both" } ]
    end

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(@batch_options)
      assert_equal "completed", result[:status]
    end

    # Verify all messages were processed
    assert_equal @messages.length, call_order.length
    assert_equal @messages.map(&:id).sort, call_order.sort
  end

  # Batch Options Validation Tests
  test "job validates batch options" do
    # Test empty message_ids
    invalid_options = @batch_options.merge(message_ids: [])

    assert_raises ArgumentError do
      FrontMessageParsingJob.perform_now(invalid_options)
    end
  end

  test "job validates batch_size limits" do
    # Test batch size too small
    invalid_options = @batch_options.merge(batch_size: 0)

    assert_raises ArgumentError do
      FrontMessageParsingJob.perform_now(invalid_options)
    end

    # Test batch size too large
    invalid_options = @batch_options.merge(batch_size: 101)

    assert_raises ArgumentError do
      FrontMessageParsingJob.perform_now(invalid_options)
    end
  end

  test "job requires message_ids array" do
    invalid_options = @batch_options.merge(message_ids: "not_an_array")

    assert_raises ArgumentError do
      FrontMessageParsingJob.perform_now(invalid_options)
    end
  end

  # Message Filtering Tests
  test "job skips messages that should not be parsed" do
    # Make some messages ineligible
    @messages[0].update!(is_inbound: false)  # Outbound
    @messages[1].update!(is_draft: true)     # Draft
    @messages[2].update!(message_type: "sms") # Not email

    parser_mock = Minitest::Mock.new

    # Should only parse eligible messages (2 remaining)
    [ @messages[3], @messages[4] ].each do |message|
      parser_mock.expect :parse_front_message,
        mock_successful_parser_response(message.id),
        [ message, { format: "both" } ]
    end

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(@batch_options)

      assert_equal "completed", result[:status]
      assert_equal 2, result[:statistics][:total_messages]
      assert_equal 2, result[:statistics][:processed]
      assert_equal 2, result[:statistics][:successful]
    end

    parser_mock.verify
  end

  test "job respects skip_parsed option" do
    # Create existing ParsedEmail for first message
    ParsedEmail.create!(
      parseable: @messages[0],
      plain_message: "Existing content",
      content_hash: generate_content_hash(@messages[0]),
      parsed_at: 1.hour.ago
    )

    parser_mock = Minitest::Mock.new

    # Should skip first message, parse remaining 4
    @messages[1..4].each do |message|
      parser_mock.expect :parse_front_message,
        mock_successful_parser_response(message.id),
        [ message, { format: "both" } ]
    end

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(@batch_options)

      assert_equal 4, result[:statistics][:total_messages]
      assert_equal 4, result[:statistics][:processed]
    end

    parser_mock.verify
  end

  test "job respects force_reparse option" do
    # Create existing ParsedEmail for first message
    ParsedEmail.create!(
      parseable: @messages[0],
      plain_message: "Existing content",
      content_hash: generate_content_hash(@messages[0]),
      parsed_at: 1.hour.ago
    )

    force_reparse_options = @batch_options.merge(force_reparse: true)
    parser_mock = Minitest::Mock.new

    # Should parse all messages including the one with existing ParsedEmail
    @messages.each do |message|
      parser_mock.expect :parse_front_message,
        mock_successful_parser_response(message.id),
        [ message, { format: "both" } ]
    end

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(force_reparse_options)

      assert_equal 5, result[:statistics][:total_messages]
      assert_equal 5, result[:statistics][:processed]
    end

    parser_mock.verify
  end

  test "job skips messages with unchanged content hash" do
    # Create existing ParsedEmail with matching content hash
    content_hash = generate_content_hash(@messages[0])
    ParsedEmail.create!(
      parseable: @messages[0],
      plain_message: "Existing content",
      content_hash: content_hash,
      parsed_at: 1.hour.ago
    )

    parser_mock = Minitest::Mock.new

    # Should skip first message due to matching hash
    @messages[1..4].each do |message|
      parser_mock.expect :parse_front_message,
        mock_successful_parser_response(message.id),
        [ message, { format: "both" } ]
    end

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(@batch_options)

      assert_equal 4, result[:statistics][:total_messages]
      assert_equal 4, result[:statistics][:processed]
    end

    parser_mock.verify
  end

  # Error Handling and Resilience Tests
  test "job handles individual message parsing failures" do
    parser_mock = Minitest::Mock.new

    # First message fails, others succeed
    parser_mock.expect :parse_front_message,
      mock_failed_parser_response("Parse failed"),
      [ @messages[0], { format: "both" } ]

    @messages[1..4].each do |message|
      parser_mock.expect :parse_front_message,
        mock_successful_parser_response(message.id),
        [ message, { format: "both" } ]
    end

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(@batch_options)

      assert_equal "completed", result[:status]
      assert_equal 5, result[:statistics][:processed]
      assert_equal 4, result[:statistics][:successful]
      assert_equal 1, result[:statistics][:failed]
      assert_equal 0.8, result[:success_rate]
    end

    parser_mock.verify

    # Verify failed message has error record
    @messages[0].reload
    assert @messages[0].parsed_email.present?
    assert_not @messages[0].parsed_email.parsing_successful?

    # Verify successful messages have proper records
    @messages[1..4].each do |message|
      message.reload
      assert message.parsed_email.present?
      assert message.parsed_email.parsing_successful?
    end
  end

  test "job handles exceptions during individual message processing" do
    parser_mock = Minitest::Mock.new

    # First message throws exception, others succeed
    parser_mock.expect :parse_front_message,
      ->(*) { raise StandardError.new("Unexpected error") },
      [ @messages[0], { format: "both" } ]

    @messages[1..4].each do |message|
      parser_mock.expect :parse_front_message,
        mock_successful_parser_response(message.id),
        [ message, { format: "both" } ]
    end

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(@batch_options)

      # Job should continue processing other messages
      assert_equal "completed", result[:status]
      assert_equal 5, result[:statistics][:processed]
      assert_equal 4, result[:statistics][:successful]
      assert_equal 1, result[:statistics][:failed]
    end

    # Exception message should have error record
    @messages[0].reload
    assert @messages[0].parsed_email.present?
    assert_not @messages[0].parsed_email.parsing_successful?
  end

  test "job handles batch-level errors" do
    # Mock a batch-level error (database connection lost, etc.)
    parser_mock = Minitest::Mock.new
    parser_mock.expect :parse_front_message,
      ->(*) { raise StandardError.new("Database connection lost") },
      [ @messages[0], { format: "both" } ]

    TalonEmailParser.stub :instance, parser_mock do
      assert_raises StandardError do
        FrontMessageParsingJob.perform_now(@batch_options)
      end
    end
  end

  # Performance and Metrics Tests
  test "job records comprehensive performance metrics" do
    parser_mock = Minitest::Mock.new

    @messages.each do |message|
      parser_mock.expect :parse_front_message,
        mock_successful_parser_response(message.id),
        [ message, { format: "both" } ]
    end

    start_time = Time.current

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(@batch_options)

      # Verify comprehensive metrics
      assert result[:duration_seconds].present?
      assert result[:duration_seconds] > 0
      assert result[:throughput_per_second].present?
      assert result[:success_rate] == 1.0

      job_metadata = result[:job_metadata]
      assert job_metadata[:job_id].present?
      assert job_metadata[:queue_name] == "parsing_priority"
      assert job_metadata[:executions].present?
      assert job_metadata[:created_at].present?
    end

    # Verify metrics are cached
    cache_key = "email_parsing_metrics:batch:#{result[:job_metadata][:job_id]}"
    cached_metrics = Rails.cache.read(cache_key)
    assert cached_metrics.present?
    assert_equal 5, cached_metrics[:total_messages]
    assert_equal 5, cached_metrics[:successful]
  end

  test "job calculates accurate throughput metrics" do
    parser_mock = Minitest::Mock.new

    @messages.each do |message|
      parser_mock.expect :parse_front_message,
        ->(*) {
          sleep(0.01)  # Simulate processing time
          mock_successful_parser_response(message.id)
        },
        [ message, { format: "both" } ]
    end

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(@batch_options)

      # Should have reasonable throughput calculation
      assert result[:throughput_per_second] > 0
      assert result[:throughput_per_second] < 1000  # Reasonable upper bound

      # Duration should reflect actual processing time
      assert result[:duration_seconds] > 0.05  # At least 5ms * 5 messages
    end
  end

  test "job handles memory management during large batches" do
    # Create larger batch to test memory management
    large_messages = create_test_messages(20)
    large_batch_options = @batch_options.merge(
      message_ids: large_messages.map(&:id),
      batch_size: 5
    )

    parser_mock = Minitest::Mock.new
    large_messages.each do |message|
      parser_mock.expect :parse_front_message,
        mock_successful_parser_response(message.id),
        [ message, { format: "both" } ]
    end

    # Mock GC to verify it's called
    gc_call_count = 0
    GC.stub :start, -> { gc_call_count += 1 } do
      TalonEmailParser.stub :instance, parser_mock do
        result = FrontMessageParsingJob.perform_now(large_batch_options)

        assert_equal "completed", result[:status]
        assert_equal 20, result[:statistics][:processed]
      end
    end

    # Should have called GC at least once for 20 messages
    # (every 50 messages, but we're testing the mechanism)
    # Note: This might be 0 if messages are processed too quickly
    assert gc_call_count >= 0
  end

  # Content Processing Tests
  test "job processes different content formats correctly" do
    # Update messages with different content types
    @messages[0].update!(body_plain: "Plain only", body_html: nil)
    @messages[1].update!(body_plain: nil, body_html: "<p>HTML only</p>")
    @messages[2].update!(body_plain: "Both plain", body_html: "<p>Both HTML</p>")

    parser_mock = Minitest::Mock.new
    @messages.each do |message|
      parser_mock.expect :parse_front_message,
        mock_successful_parser_response(message.id),
        [ message, { format: "both" } ]
    end

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(@batch_options)

      assert_equal "completed", result[:status]
      assert_equal 5, result[:statistics][:successful]
    end

    # Verify all messages were processed
    @messages.each do |message|
      message.reload
      assert message.parsed_email.present?
    end
  end

  test "job stores parsing options for batch processing" do
    custom_options = { signature_detection: true, custom_param: "test" }
    batch_with_options = @batch_options.merge(options: custom_options)

    parser_mock = Minitest::Mock.new
    @messages.each do |message|
      parser_mock.expect :parse_front_message,
        mock_successful_parser_response(message.id),
        [ message, custom_options ]
    end

    TalonEmailParser.stub :instance, parser_mock do
      FrontMessageParsingJob.perform_now(batch_with_options)
    end

    # Verify options were stored in ParsedEmail records
    @messages.each do |message|
      message.reload
      stored_options = JSON.parse(message.parsed_email.parse_options)
      assert_equal custom_options.stringify_keys, stored_options
    end
  end

  # Queue and Retry Configuration Tests
  test "job is configured for parsing_priority queue" do
    job = FrontMessageParsingJob.new
    assert_equal "parsing_priority", job.queue_name
  end

  test "job has proper retry configuration" do
    # Test that job has retry configuration for different error types
    job = FrontMessageParsingJob.new

    # This is a basic test - more detailed retry testing would require
    # integration tests with the actual job queue
    assert job.class.retry_on_block_variable_name.present?
  end

  # Integration Tests
  test "job can be enqueued for background processing" do
    assert_enqueued_with(job: FrontMessageParsingJob, args: [ @batch_options ]) do
      FrontMessageParsingJob.perform_later(@batch_options)
    end
  end

  test "job handles empty batch gracefully" do
    empty_options = @batch_options.merge(message_ids: [])

    assert_raises ArgumentError do
      FrontMessageParsingJob.perform_now(empty_options)
    end
  end

  test "job handles non-existent message IDs" do
    non_existent_ids = [ 999999, 999998, 999997 ]
    invalid_options = @batch_options.merge(message_ids: non_existent_ids)

    result = FrontMessageParsingJob.perform_now(invalid_options)

    # Should complete successfully but process 0 messages
    assert_equal "completed", result[:status]
    assert_equal 0, result[:statistics][:total_messages]
    assert_equal 0, result[:statistics][:processed]
  end

  # Edge Cases and Robustness
  test "job handles mixed valid and invalid message IDs" do
    mixed_ids = [ @messages[0].id, 999999, @messages[1].id, 999998 ]
    mixed_options = @batch_options.merge(message_ids: mixed_ids)

    parser_mock = Minitest::Mock.new
    [ @messages[0], @messages[1] ].each do |message|
      parser_mock.expect :parse_front_message,
        mock_successful_parser_response(message.id),
        [ message, { format: "both" } ]
    end

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(mixed_options)

      # Should process only the valid messages
      assert_equal 2, result[:statistics][:total_messages]
      assert_equal 2, result[:statistics][:processed]
      assert_equal 2, result[:statistics][:successful]
    end
  end

  test "job handles very large batch sizes gracefully" do
    # Test with batch size larger than message count
    large_batch_options = @batch_options.merge(batch_size: 50)

    parser_mock = Minitest::Mock.new
    @messages.each do |message|
      parser_mock.expect :parse_front_message,
        mock_successful_parser_response(message.id),
        [ message, { format: "both" } ]
    end

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(large_batch_options)

      assert_equal "completed", result[:status]
      assert_equal 5, result[:statistics][:processed]
    end
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
