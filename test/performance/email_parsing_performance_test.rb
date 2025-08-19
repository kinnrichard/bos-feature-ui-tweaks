require "test_helper"

class EmailParsingPerformanceTest < ActiveSupport::TestCase
  def setup
    # Clean up any existing records
    ParsedEmail.delete_all
    FrontMessage.where("front_id LIKE 'perf_%'").delete_all

    # Performance test configuration
    @small_batch_size = 10
    @medium_batch_size = 50
    @large_batch_size = 100
    @timeout_limit = 30.seconds  # Maximum time allowed for large batches
  end

  def teardown
    # Clean up performance test data
    FrontMessage.where("front_id LIKE 'perf_%'").delete_all
    ParsedEmail.delete_all
  end

  # Small Batch Performance Tests
  test "small batch processing performance" do
    messages = create_performance_test_messages(@small_batch_size)

    batch_options = {
      message_ids: messages.map(&:id),
      batch_size: 5,
      options: { format: "both" }
    }

    # Mock parser with realistic processing time
    parser_mock = create_performance_parser_mock(messages, delay: 0.01)  # 10ms per message

    start_time = Time.current
    memory_before = get_memory_usage

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(batch_options)

      end_time = Time.current
      duration = end_time - start_time
      memory_after = get_memory_usage

      # Performance assertions for small batch
      assert duration < 5.seconds, "Small batch took too long: #{duration}s"
      assert result[:success_rate] == 1.0, "Small batch should have 100% success rate"
      assert result[:throughput_per_second] > 2, "Small batch throughput too low: #{result[:throughput_per_second]}"

      # Memory usage should be reasonable
      memory_delta = memory_after - memory_before
      assert memory_delta < 50.megabytes, "Small batch used too much memory: #{memory_delta} bytes"

      # Verify all messages were processed
      assert_equal @small_batch_size, result[:statistics][:processed]
      assert_equal @small_batch_size, result[:statistics][:successful]
      assert_equal 0, result[:statistics][:failed]
    end

    parser_mock.verify
  end

  test "medium batch processing performance" do
    messages = create_performance_test_messages(@medium_batch_size)

    batch_options = {
      message_ids: messages.map(&:id),
      batch_size: 10,
      options: { format: "both" }
    }

    parser_mock = create_performance_parser_mock(messages, delay: 0.005)  # 5ms per message

    start_time = Time.current
    memory_before = get_memory_usage

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(batch_options)

      end_time = Time.current
      duration = end_time - start_time
      memory_after = get_memory_usage

      # Performance assertions for medium batch
      assert duration < 15.seconds, "Medium batch took too long: #{duration}s"
      assert result[:success_rate] == 1.0, "Medium batch should have 100% success rate"
      assert result[:throughput_per_second] > 3, "Medium batch throughput too low: #{result[:throughput_per_second]}"

      # Memory usage should still be reasonable
      memory_delta = memory_after - memory_before
      assert memory_delta < 100.megabytes, "Medium batch used too much memory: #{memory_delta} bytes"

      # Verify processing stats
      assert_equal @medium_batch_size, result[:statistics][:processed]
      assert_equal @medium_batch_size, result[:statistics][:successful]
    end

    parser_mock.verify
  end

  test "large batch processing performance" do
    messages = create_performance_test_messages(@large_batch_size)

    batch_options = {
      message_ids: messages.map(&:id),
      batch_size: 20,
      options: { format: "both" }
    }

    parser_mock = create_performance_parser_mock(messages, delay: 0.002)  # 2ms per message

    start_time = Time.current
    memory_before = get_memory_usage

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(batch_options)

      end_time = Time.current
      duration = end_time - start_time
      memory_after = get_memory_usage

      # Performance assertions for large batch
      assert duration < @timeout_limit, "Large batch took too long: #{duration}s (limit: #{@timeout_limit}s)"
      assert result[:success_rate] == 1.0, "Large batch should have 100% success rate"
      assert result[:throughput_per_second] > 3, "Large batch throughput too low: #{result[:throughput_per_second]}"

      # Memory usage should be controlled
      memory_delta = memory_after - memory_before
      assert memory_delta < 200.megabytes, "Large batch used too much memory: #{memory_delta} bytes"

      # Verify processing stats
      assert_equal @large_batch_size, result[:statistics][:processed]
      assert_equal @large_batch_size, result[:statistics][:successful]

      # Verify metrics are comprehensive
      assert result[:statistics][:parse_time_total] > 0
      assert result[:statistics][:individual_times].length == @large_batch_size
    end

    parser_mock.verify
  end

  # Batch Size Optimization Tests
  test "optimal batch size performance comparison" do
    messages = create_performance_test_messages(50)
    batch_sizes = [ 1, 5, 10, 20, 50 ]
    results = {}

    batch_sizes.each do |batch_size|
      batch_options = {
        message_ids: messages.map(&:id),
        batch_size: batch_size,
        options: { format: "both" }
      }

      parser_mock = create_performance_parser_mock(messages, delay: 0.001)

      start_time = Time.current

      TalonEmailParser.stub :instance, parser_mock do
        result = FrontMessageParsingJob.perform_now(batch_options)
        end_time = Time.current

        results[batch_size] = {
          duration: end_time - start_time,
          throughput: result[:throughput_per_second],
          success_rate: result[:success_rate]
        }
      end

      # Reset ParsedEmail records for next test
      ParsedEmail.delete_all
    end

    # Analyze batch size performance
    durations = results.values.map { |r| r[:duration] }
    throughputs = results.values.map { |r| r[:throughput] }

    # Batch sizes should show performance improvements up to a point
    assert results[1][:duration] > results[5][:duration], "Batch size 5 should be faster than 1"
    assert results[5][:duration] > results[10][:duration], "Batch size 10 should be faster than 5"

    # All should have perfect success rates
    results.values.each do |result|
      assert_equal 1.0, result[:success_rate], "All batch sizes should have 100% success rate"
    end

    # Log results for analysis
    puts "\nBatch Size Performance Results:"
    results.each do |batch_size, stats|
      puts "  Batch Size #{batch_size}: #{stats[:duration].round(3)}s, #{stats[:throughput].round(2)} msg/sec"
    end
  end

  # Memory Usage and Garbage Collection Tests
  test "memory usage remains stable during large batch processing" do
    # Process multiple large batches to test memory stability
    3.times do |batch_num|
      messages = create_performance_test_messages(30, prefix: "mem_batch_#{batch_num}")

      batch_options = {
        message_ids: messages.map(&:id),
        batch_size: 10,
        options: { format: "both" }
      }

      parser_mock = create_performance_parser_mock(messages, delay: 0.001)

      memory_before = get_memory_usage

      TalonEmailParser.stub :instance, parser_mock do
        result = FrontMessageParsingJob.perform_now(batch_options)

        # Force garbage collection
        GC.start

        memory_after = get_memory_usage
        memory_delta = memory_after - memory_before

        # Memory growth should be reasonable per batch
        assert memory_delta < 30.megabytes, "Batch #{batch_num} memory growth too high: #{memory_delta} bytes"
        assert_equal 1.0, result[:success_rate], "Batch #{batch_num} should have 100% success rate"
      end

      # Clean up after each batch
      ParsedEmail.delete_all
      GC.start
    end
  end

  test "garbage collection triggers appropriately during processing" do
    messages = create_performance_test_messages(60)  # Enough to trigger GC

    batch_options = {
      message_ids: messages.map(&:id),
      batch_size: 10,
      options: { format: "both" }
    }

    parser_mock = create_performance_parser_mock(messages, delay: 0.001)
    gc_call_count = 0

    # Mock GC to count calls
    GC.stub :start, -> { gc_call_count += 1 } do
      TalonEmailParser.stub :instance, parser_mock do
        result = FrontMessageParsingJob.perform_now(batch_options)

        # GC should be called at least once for 60 messages (every 50 messages)
        assert gc_call_count >= 1, "GC should have been called at least once for 60 messages"
        assert_equal 1.0, result[:success_rate]
      end
    end
  end

  # Concurrent Processing Tests
  test "concurrent batch processing performance" do
    # Create separate message sets
    batch1_messages = create_performance_test_messages(20, prefix: "concurrent_1")
    batch2_messages = create_performance_test_messages(20, prefix: "concurrent_2")

    batch1_options = {
      message_ids: batch1_messages.map(&:id),
      batch_size: 10,
      options: { format: "both" }
    }

    batch2_options = {
      message_ids: batch2_messages.map(&:id),
      batch_size: 10,
      options: { format: "both" }
    }

    # Create separate parser mocks
    parser_mock1 = create_performance_parser_mock(batch1_messages, delay: 0.005)
    parser_mock2 = create_performance_parser_mock(batch2_messages, delay: 0.005)

    start_time = Time.current
    results = []

    # Run batches concurrently using threads
    threads = []

    threads << Thread.new do
      TalonEmailParser.stub :instance, parser_mock1 do
        results << FrontMessageParsingJob.perform_now(batch1_options)
      end
    end

    threads << Thread.new do
      TalonEmailParser.stub :instance, parser_mock2 do
        results << FrontMessageParsingJob.perform_now(batch2_options)
      end
    end

    threads.each(&:join)
    end_time = Time.current

    total_duration = end_time - start_time

    # Both batches should complete successfully
    assert_equal 2, results.length
    results.each do |result|
      assert_equal "completed", result[:status]
      assert_equal 1.0, result[:success_rate]
      assert_equal 20, result[:statistics][:processed]
    end

    # Concurrent processing should be faster than sequential
    # (though this is a simplified test)
    assert total_duration < 15.seconds, "Concurrent processing took too long: #{total_duration}s"

    parser_mock1.verify
    parser_mock2.verify
  end

  # Database Performance Tests
  test "database operations scale efficiently with batch size" do
    batch_sizes = [ 10, 25, 50 ]
    db_performance = {}

    batch_sizes.each do |size|
      messages = create_performance_test_messages(size, prefix: "db_test_#{size}")

      batch_options = {
        message_ids: messages.map(&:id),
        batch_size: [ size / 2, 10 ].max,  # Use reasonable batch size
        options: { format: "both" }
      }

      parser_mock = create_performance_parser_mock(messages, delay: 0.001)

      # Count database queries
      query_count = 0
      ActiveSupport::Notifications.subscribe "sql.active_record" do |*args|
        query_count += 1 unless args.last[:sql].include?("SHOW")  # Exclude SHOW queries
      end

      TalonEmailParser.stub :instance, parser_mock do
        result = FrontMessageParsingJob.perform_now(batch_options)

        db_performance[size] = {
          query_count: query_count,
          queries_per_message: query_count.to_f / size,
          success_rate: result[:success_rate]
        }
      end

      ActiveSupport::Notifications.unsubscribe "sql.active_record"
      ParsedEmail.delete_all
    end

    # Database queries should scale reasonably
    db_performance.values.each do |stats|
      assert_equal 1.0, stats[:success_rate]
      # Should not be doing excessive queries per message
      assert stats[:queries_per_message] < 10, "Too many DB queries per message: #{stats[:queries_per_message]}"
    end

    puts "\nDatabase Performance Results:"
    db_performance.each do |size, stats|
      puts "  #{size} messages: #{stats[:query_count]} queries (#{stats[:queries_per_message].round(2)} per message)"
    end
  end

  # Error Handling Performance Tests
  test "error handling does not significantly impact performance" do
    # Create mix of successful and failing messages
    success_messages = create_performance_test_messages(15, prefix: "success")
    failure_messages = create_performance_test_messages(5, prefix: "failure")
    all_messages = success_messages + failure_messages

    batch_options = {
      message_ids: all_messages.map(&:id),
      batch_size: 10,
      options: { format: "both" }
    }

    # Mock parser with mixed results
    parser_mock = Minitest::Mock.new

    success_messages.each do |message|
      parser_mock.expect :parse_front_message, {
        success: true,
        data: {
          format: "both",
          text_parsing: { success: true, data: { clean_reply: "Success", signature: nil } },
          html_parsing: { success: true, data: { clean_reply: "<p>Success</p>", signature: nil } },
          talon_version: "1.0.0"
        }
      }, [ message, { format: "both" } ]
    end

    failure_messages.each do |message|
      parser_mock.expect :parse_front_message, {
        success: false,
        error: "Parsing failed"
      }, [ message, { format: "both" } ]
    end

    start_time = Time.current

    TalonEmailParser.stub :instance, parser_mock do
      result = FrontMessageParsingJob.perform_now(batch_options)

      end_time = Time.current
      duration = end_time - start_time

      # Error handling should not dramatically slow processing
      assert duration < 10.seconds, "Error handling caused significant slowdown: #{duration}s"

      # Verify mixed results
      assert_equal 20, result[:statistics][:processed]
      assert_equal 15, result[:statistics][:successful]
      assert_equal 5, result[:statistics][:failed]
      assert_equal 0.75, result[:success_rate]
    end

    # Verify both success and error records were created
    assert_equal 15, ParsedEmail.successful.count
    assert_equal 5, ParsedEmail.with_errors.count

    parser_mock.verify
  end

  # Content Size Performance Tests
  test "processing performance with varying content sizes" do
    # Create messages with different content sizes
    small_content = "Small message content"
    medium_content = "Medium content " * 100  # ~2KB
    large_content = "Large content " * 1000   # ~20KB

    content_sizes = [
      { name: "small", content: small_content, count: 10 },
      { name: "medium", content: medium_content, count: 10 },
      { name: "large", content: large_content, count: 5 }
    ]

    performance_results = {}

    content_sizes.each do |test_case|
      messages = []
      test_case[:count].times do |i|
        message = FrontMessage.create!(
          front_id: "#{test_case[:name]}_content_#{i}",
          front_conversation: front_conversations(:one),
          message_uid: "#{test_case[:name]}_uid_#{i}",
          message_type: "email",
          is_inbound: true,
          is_draft: false,
          subject: "#{test_case[:name].capitalize} Content Test #{i}",
          body_plain: test_case[:content],
          body_html: "<p>#{test_case[:content]}</p>",
          created_at_timestamp: i.minutes.ago.to_f
        )
        messages << message
      end

      batch_options = {
        message_ids: messages.map(&:id),
        batch_size: 5,
        options: { format: "both" }
      }

      parser_mock = create_performance_parser_mock(messages, delay: 0.002)

      start_time = Time.current

      TalonEmailParser.stub :instance, parser_mock do
        result = FrontMessageParsingJob.perform_now(batch_options)

        end_time = Time.current
        duration = end_time - start_time

        performance_results[test_case[:name]] = {
          duration: duration,
          throughput: result[:throughput_per_second],
          avg_content_size: test_case[:content].length,
          message_count: test_case[:count]
        }
      end

      ParsedEmail.delete_all
    end

    # Large content should not cause exponential slowdown
    small_throughput = performance_results["small"][:throughput]
    large_throughput = performance_results["large"][:throughput]

    # Throughput degradation should be reasonable
    throughput_ratio = small_throughput / large_throughput
    assert throughput_ratio < 5, "Large content causes excessive throughput degradation: #{throughput_ratio}x"

    puts "\nContent Size Performance Results:"
    performance_results.each do |size, stats|
      puts "  #{size.capitalize}: #{stats[:duration].round(3)}s, #{stats[:throughput].round(2)} msg/sec, #{stats[:avg_content_size]} bytes avg"
    end
  end

  private

  def create_performance_test_messages(count, prefix: "perf")
    messages = []
    count.times do |i|
      message = FrontMessage.create!(
        front_id: "#{prefix}_msg_#{i}",
        front_conversation: front_conversations(:one),
        message_uid: "#{prefix}_uid_#{i}",
        message_type: "email",
        is_inbound: true,
        is_draft: false,
        subject: "Performance Test Email #{i}",
        body_plain: "Performance test message #{i} content\n\nOn Mon: > Original message #{i}",
        body_html: "<p>Performance test message #{i} content</p><blockquote>Original message #{i}</blockquote>",
        created_at_timestamp: i.minutes.ago.to_f
      )
      messages << message
    end
    messages
  end

  def create_performance_parser_mock(messages, delay: 0.001)
    parser_mock = Minitest::Mock.new

    messages.each do |message|
      parser_mock.expect :parse_front_message,
        ->(*) {
          sleep(delay) if delay > 0  # Simulate processing time
          {
            success: true,
            data: {
              format: "both",
              text_parsing: {
                success: true,
                data: {
                  clean_reply: "Performance test reply #{message.id}",
                  signature: "Performance signature #{message.id}"
                }
              },
              html_parsing: {
                success: true,
                data: {
                  clean_reply: "<p>Performance test reply #{message.id}</p>",
                  signature: "<p>Performance signature #{message.id}</p>"
                }
              },
              talon_version: "1.0.0"
            }
          }
        },
        [ message, { format: "both" } ]
    end

    parser_mock
  end

  def get_memory_usage
    # Simple memory usage estimation
    # In a real application, you might use more sophisticated memory monitoring
    ObjectSpace.count_objects[:TOTAL] * 40  # Rough estimate
  rescue
    0  # Fallback if ObjectSpace is not available
  end
end
