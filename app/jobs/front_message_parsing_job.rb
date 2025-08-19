# Enhanced background job for batch parsing email content using TalonEmailParser
# Provides batch processing, retry logic, performance monitoring, and queue priorities
class FrontMessageParsingJob < ApplicationJob
  # Queue configuration with priorities
  queue_as :parsing_priority

  # Enhanced retry configuration with exponential backoff
  retry_on TalonEmailParser::ParseError,
           wait: :exponentially_longer,
           attempts: 5,
           jitter: 0.15

  retry_on StandardError,
           wait: :exponentially_longer,
           attempts: 3,
           jitter: 0.15

  # Discard on permanent failures
  discard_on ArgumentError
  discard_on ActiveRecord::RecordNotFound

  # Job execution with performance monitoring
  # @param batch_options [Hash] Configuration for batch processing
  #   - message_ids: Array of FrontMessage IDs to process (required)
  #   - batch_size: Number of messages to process in parallel (default: 10)
  #   - skip_parsed: Skip messages that already have ParsedEmail records (default: true)
  #   - force_reparse: Force reparsing even if already parsed (default: false)
  #   - options: Parsing options to pass to TalonEmailParser (default: {})
  def perform(batch_options = {})
    @start_time = Time.current
    @batch_options = batch_options.with_indifferent_access
    @stats = initialize_batch_stats

    Rails.logger.info "Starting FrontMessageParsingJob batch processing with #{@batch_options.inspect}"

    begin
      validate_batch_options!
      messages = load_messages_batch

      if messages.empty?
        Rails.logger.info "No messages to process in batch"
        return build_batch_result
      end

      process_messages_batch(messages)
      record_batch_metrics

      Rails.logger.info "Completed FrontMessageParsingJob batch: #{@stats}"
      build_batch_result

    rescue StandardError => e
      Rails.logger.error "FrontMessageParsingJob batch failed: #{e.message}"
      @stats[:batch_errors] += 1
      record_batch_metrics(error: e.message)
      raise e # Re-raise to trigger retry mechanism
    end
  end

  private

  # Initialize batch processing statistics
  def initialize_batch_stats
    {
      total_messages: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      batch_errors: 0,
      parse_time_total: 0.0,
      individual_times: []
    }
  end

  # Validate batch processing options
  def validate_batch_options!
    unless @batch_options[:message_ids].is_a?(Array) && @batch_options[:message_ids].any?
      raise ArgumentError, "message_ids must be a non-empty array"
    end

    batch_size = @batch_options[:batch_size] || 10
    if batch_size < 1 || batch_size > 100
      raise ArgumentError, "batch_size must be between 1 and 100, got #{batch_size}"
    end
  end

  # Load messages for batch processing with proper filtering
  def load_messages_batch
    message_ids = @batch_options[:message_ids]
    skip_parsed = @batch_options.fetch(:skip_parsed, true)
    force_reparse = @batch_options.fetch(:force_reparse, false)

    messages_query = FrontMessage.where(id: message_ids)
                                 .includes(:parsed_email)

    # Filter out messages that shouldn't be parsed
    messages = messages_query.select { |msg| should_process_message?(msg, skip_parsed, force_reparse) }

    @stats[:total_messages] = messages.length
    Rails.logger.info "Loaded #{messages.length} messages for batch processing"

    messages
  end

  # Check if message should be processed in this batch
  def should_process_message?(message, skip_parsed, force_reparse)
    # Basic eligibility check (same as EmailParseJob)
    return false unless should_parse?(message)

    # Check existing parsed email
    has_parsed_email = message.parsed_email.present?

    if force_reparse
      return true
    elsif skip_parsed && has_parsed_email
      return false
    end

    # Check for content hash deduplication
    if has_parsed_email && !force_reparse
      current_hash = generate_content_hash(message)
      existing_hash = message.parsed_email.content_hash

      if current_hash == existing_hash
        Rails.logger.debug "Skipping message #{message.id} - content hash unchanged"
        return false
      end
    end

    true
  end

  # Process messages in controlled batches with concurrency limits
  def process_messages_batch(messages)
    batch_size = @batch_options.fetch(:batch_size, 10)
    parsing_options = @batch_options.fetch(:options, {})

    Rails.logger.info "Processing #{messages.length} messages in batches of #{batch_size}"

    messages.each_slice(batch_size).with_index do |batch, batch_index|
      Rails.logger.info "Processing batch #{batch_index + 1} with #{batch.length} messages"

      # Process batch with error isolation
      batch.each do |message|
        process_single_message_with_tracking(message, parsing_options)

        # Memory management - force garbage collection every 50 messages
        GC.start if (@stats[:processed] % 50).zero?
      end

      # Brief pause between batches to manage system load
      sleep(0.1) if batch_index < (messages.length / batch_size) - 1
    end
  end

  # Process a single message with performance tracking and error isolation
  def process_single_message_with_tracking(message, options)
    message_start_time = Time.current

    begin
      Rails.logger.debug "Processing FrontMessage #{message.id}"

      # Use TalonEmailParser service to parse the message
      parser = TalonEmailParser.instance
      result = parser.parse_front_message(message, format: "both")

      parse_duration = Time.current - message_start_time
      @stats[:parse_time_total] += parse_duration
      @stats[:individual_times] << parse_duration

      if result[:success]
        create_or_update_parsed_email(message, result[:data], options)
        @stats[:successful] += 1
        Rails.logger.debug "Successfully parsed FrontMessage #{message.id} in #{parse_duration.round(3)}s"
      else
        handle_parsing_error(message, result[:error], options)
        @stats[:failed] += 1
      end

    rescue StandardError => e
      parse_duration = Time.current - message_start_time
      @stats[:parse_time_total] += parse_duration
      @stats[:failed] += 1

      Rails.logger.error "Batch parsing failed for FrontMessage #{message.id}: #{e.message}"
      handle_parsing_error(message, e.message, options)

      # Don't re-raise individual message errors - continue with batch
    ensure
      @stats[:processed] += 1
    end
  end

  # Record comprehensive batch metrics and performance data
  def record_batch_metrics(error: nil)
    duration = Time.current - @start_time
    success_rate = @stats[:processed] > 0 ? (@stats[:successful].to_f / @stats[:processed]) : 0
    avg_parse_time = @stats[:individual_times].any? ? (@stats[:individual_times].sum / @stats[:individual_times].length) : 0

    metrics = {
      job_class: self.class.name,
      job_id: job_id,
      queue_name: queue_name,
      duration_seconds: duration.round(3),
      total_messages: @stats[:total_messages],
      processed: @stats[:processed],
      successful: @stats[:successful],
      failed: @stats[:failed],
      skipped: @stats[:skipped],
      success_rate_percent: (success_rate * 100).round(2),
      avg_parse_time_seconds: avg_parse_time.round(3),
      total_parse_time_seconds: @stats[:parse_time_total].round(3),
      throughput_per_second: @stats[:processed] > 0 ? (@stats[:processed] / duration).round(2) : 0,
      batch_size: @batch_options[:batch_size] || 10,
      error: error,
      timestamp: Time.current.iso8601
    }

    Rails.logger.info "Batch parsing metrics: #{metrics.to_json}"

    # Integration point for external metrics services
    # StatsD.increment('email_parsing.batch.completed')
    # StatsD.timing('email_parsing.batch.duration', duration * 1000)
    # StatsD.gauge('email_parsing.batch.success_rate', success_rate * 100)
    # StatsD.gauge('email_parsing.batch.throughput', metrics[:throughput_per_second])

    # Store metrics in Rails cache for dashboard/monitoring
    cache_key = "email_parsing_metrics:batch:#{job_id}"
    Rails.cache.write(cache_key, metrics, expires_in: 24.hours)
  end

  # Build standardized batch result for monitoring and reporting
  def build_batch_result
    duration = Time.current - @start_time
    success_rate = @stats[:processed] > 0 ? (@stats[:successful].to_f / @stats[:processed]) : 0

    {
      status: @stats[:batch_errors] > 0 ? "completed_with_errors" : "completed",
      duration_seconds: duration.round(3),
      statistics: @stats,
      success_rate: success_rate.round(4),
      throughput_per_second: @stats[:processed] > 0 ? (@stats[:processed] / duration).round(2) : 0,
      job_metadata: {
        job_id: job_id,
        queue_name: queue_name,
        executions: executions,
        created_at: @start_time.iso8601
      }
    }
  end

  # Check if message should be parsed (same logic as EmailParseJob)
  def should_parse?(message)
    message.is_inbound && !message.is_draft && message.message_type == "email"
  end

  # Create or update ParsedEmail record (same logic as EmailParseJob)
  def create_or_update_parsed_email(message, data, options)
    content_hash = generate_content_hash(message)
    plain_content = extract_plain_content(data)
    html_content = extract_html_content(data)

    parsed_email = message.parsed_email || message.build_parsed_email

    parsed_email.assign_attributes(
      plain_message: plain_content[:message],
      plain_signature: plain_content[:signature],
      html_message: html_content[:message],
      html_signature: html_content[:signature],
      content_hash: content_hash,
      parsed_at: Time.current,
      parser_version: data[:talon_version] || "unknown",
      parse_options: options.to_json,
      parse_errors: nil
    )

    parsed_email.save!
  end

  # Handle parsing errors (same logic as EmailParseJob)
  def handle_parsing_error(message, error, options)
    Rails.logger.warn "Batch parsing failed for FrontMessage #{message.id}: #{error}"

    parsed_email = message.parsed_email || message.build_parsed_email
    parsed_email.assign_attributes(
      content_hash: generate_content_hash(message),
      parsed_at: Time.current,
      parser_version: "error",
      parse_options: options.to_json,
      parse_errors: { error: error, timestamp: Time.current }.to_json
    )

    parsed_email.save!
  end

  # Extract plain text content (same logic as EmailParseJob)
  def extract_plain_content(data)
    if data[:format] == "both" && data[:text_parsing]&.dig(:success)
      text_data = data[:text_parsing][:data]
      {
        message: text_data[:clean_reply],
        signature: text_data[:signature]
      }
    elsif data[:format] == "text/plain"
      {
        message: data[:clean_reply],
        signature: data[:signature]
      }
    else
      { message: nil, signature: nil }
    end
  end

  # Extract HTML content (same logic as EmailParseJob)
  def extract_html_content(data)
    if data[:format] == "both" && data[:html_parsing]&.dig(:success)
      html_data = data[:html_parsing][:data]
      {
        message: html_data[:clean_reply],
        signature: html_data[:signature]
      }
    elsif data[:format] == "text/html"
      {
        message: data[:clean_reply],
        signature: data[:signature]
      }
    else
      { message: nil, signature: nil }
    end
  end

  # Generate content hash for deduplication (same logic as EmailParseJob)
  def generate_content_hash(message)
    content = [
      message.body_plain,
      message.body_html,
      message.subject,
      message.front_id
    ].compact.join("|")

    Digest::SHA256.hexdigest(content)
  end

  # Enhanced error logging with job context
  def log_error_with_context(error, context = {})
    job_context = {
      job_class: self.class.name,
      job_id: job_id,
      queue_name: queue_name,
      executions: executions,
      batch_options: @batch_options,
      current_stats: @stats,
      **context
    }

    Rails.logger.error "FrontMessageParsingJob error: #{error.message}", job_context
  end

  # Job completion callback with metrics reporting
  def after_perform(*args)
    Rails.logger.info "FrontMessageParsingJob completed successfully"
  rescue StandardError => e
    Rails.logger.error "Error in after_perform callback: #{e.message}"
  end

  # Job error callback with comprehensive error reporting
  def rescue_with_handler(exception)
    Rails.logger.error "FrontMessageParsingJob failed with #{exception.class}: #{exception.message}"

    # Record failure metrics
    if defined?(@stats)
      @stats[:batch_errors] += 1
      record_batch_metrics(error: exception.message)
    end

    super
  end
end
