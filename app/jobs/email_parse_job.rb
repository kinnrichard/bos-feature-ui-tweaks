# Background job for parsing email content using TalonEmailParser
# Processes FrontMessage objects to extract clean content and signatures
class EmailParseJob < ApplicationJob
  queue_as :parsing

  # Retry on specific errors that might be transient
  retry_on TalonEmailParser::ParseError, wait: 30.seconds, attempts: 3
  retry_on StandardError, wait: 1.minute, attempts: 2

  # Parse a FrontMessage and create/update its ParsedEmail record
  # @param message [FrontMessage] The message to parse
  # @param options [Hash] Parsing options
  def perform(message, options = {})
    return unless message.is_a?(FrontMessage)
    return unless should_parse?(message)

    Rails.logger.info "Starting email parsing for FrontMessage #{message.id}"

    begin
      # Use TalonEmailParser service to parse the message
      parser = TalonEmailParser.instance
      result = parser.parse_front_message(message, format: "both")

      if result[:success]
        create_or_update_parsed_email(message, result[:data], options)
        Rails.logger.info "Successfully parsed FrontMessage #{message.id}"
      else
        handle_parsing_error(message, result[:error], options)
      end

    rescue StandardError => e
      Rails.logger.error "Email parsing job failed for FrontMessage #{message.id}: #{e.message}"
      handle_parsing_error(message, e.message, options)
      raise e # Re-raise to trigger retry mechanism
    end
  end

  private

  # Check if message should be parsed
  # @param message [FrontMessage] The message to check
  # @return [Boolean] True if message should be parsed
  def should_parse?(message)
    # Only parse inbound, non-draft email messages
    message.is_inbound && !message.is_draft && message.message_type == "email"
  end

  # Create or update ParsedEmail record with parsing results
  # @param message [FrontMessage] The source message
  # @param data [Hash] Parsing result data
  # @param options [Hash] Additional options
  def create_or_update_parsed_email(message, data, options)
    # Generate content hash for deduplication
    content_hash = generate_content_hash(message)

    # Extract parsed content based on format
    plain_content = extract_plain_content(data)
    html_content = extract_html_content(data)

    parsed_email = message.parsed_email || message.build_parsed_email

    parsed_email.assign_attributes(
      # Content fields
      plain_message: plain_content[:message],
      plain_signature: plain_content[:signature],
      html_message: html_content[:message],
      html_signature: html_content[:signature],

      # Metadata
      content_hash: content_hash,
      parsed_at: Time.current,
      parser_version: data[:talon_version] || "unknown",
      parse_options: options.to_json,
      parse_errors: nil
    )

    parsed_email.save!
  end

  # Handle parsing errors by creating ParsedEmail record with error info
  # @param message [FrontMessage] The source message
  # @param error [String] Error message
  # @param options [Hash] Additional options
  def handle_parsing_error(message, error, options)
    Rails.logger.warn "Parsing failed for FrontMessage #{message.id}: #{error}"

    # Still create ParsedEmail record to track the failure
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

  # Extract plain text content from parsing results
  # @param data [Hash] Parsing result data
  # @return [Hash] Plain text message and signature
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

  # Extract HTML content from parsing results
  # @param data [Hash] Parsing result data
  # @return [Hash] HTML message and signature
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

  # Generate content hash for deduplication
  # @param message [FrontMessage] The message
  # @return [String] SHA256 hash of the content
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
