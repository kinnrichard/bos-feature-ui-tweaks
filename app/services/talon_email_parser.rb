# Comprehensive Talon Email Parser Service
# Provides full-featured email parsing using the Talon Python library via PyCall
# Supports both plain text and HTML parsing with signature extraction
class TalonEmailParser
  include Singleton

  # Custom error classes for specific parsing failures
  class ParseError < StandardError; end
  class InitializationError < StandardError; end
  class FormatError < StandardError; end

  # Initialize Talon modules and check availability
  def initialize
    @talon = nil
    @signature_utils = nil
    @initialized = false
    @initialization_error = nil

    initialize_talon
  end

  # Main email parsing method
  # @param content [String] The email content to parse
  # @param format [String] The format of the content ('text/plain', 'text/html', 'both')
  # @return [Hash] Parsing results with extracted components
  def parse_email(content, format: "text/plain")
    return error_result("Email content cannot be blank") if content.blank?
    return error_result("Talon parser not initialized: #{@initialization_error}") unless available?

    validate_format!(format)

    begin
      case format
      when "text/plain"
        parse_plain_text(content)
      when "text/html"
        parse_html(content)
      when "both"
        parse_both_formats(content)
      else
        error_result("Unsupported format: #{format}")
      end
    rescue PyCall::PyError => e
      Rails.logger.error "Talon parsing failed: #{e.message}"
      error_result("Python parsing error: #{e.message}")
    rescue StandardError => e
      Rails.logger.error "Email parsing failed: #{e.message}"
      error_result("Parsing error: #{e.message}")
    end
  end

  # Parse plain text email content
  # @param content [String] Plain text email content
  # @return [Hash] Parsing results with reply and signature
  def parse_plain_text(content)
    return error_result("Content cannot be blank") if content.blank?
    return error_result("Talon parser not initialized") unless available?

    begin
      # Extract reply (remove quoted content)
      reply_text = @talon.quotations.extract_from(content)

      # Extract signature from the reply text
      signature_text = nil
      clean_reply = reply_text

      if reply_text && @signature_utils
        signature_text = @signature_utils.extract_signature(reply_text)
        if signature_text
          # Remove signature from reply to get clean content
          clean_reply = reply_text.gsub(signature_text, "").strip
        end
      end

      success_result({
        format: "text/plain",
        original_content: content,
        reply_text: reply_text&.strip,
        clean_reply: clean_reply&.strip,
        signature: signature_text&.strip,
        original_length: content.length,
        reply_length: reply_text&.length || 0,
        clean_length: clean_reply&.length || 0,
        has_signature: signature_text.present?,
        talon_version: talon_version
      })
    rescue PyCall::PyError => e
      Rails.logger.error "Talon plain text parsing failed: #{e.message}"
      error_result("Plain text parsing error: #{e.message}")
    end
  end

  # Parse HTML email content
  # @param content [String] HTML email content
  # @return [Hash] Parsing results with reply and signature
  def parse_html(content)
    return error_result("Content cannot be blank") if content.blank?
    return error_result("Talon parser not initialized") unless available?

    begin
      # Extract reply from HTML (remove quoted content)
      reply_html = @talon.quotations.extract_from_html(content)

      # Extract signature from HTML
      signature_html = nil
      clean_reply = reply_html

      if reply_html && @signature_utils && @signature_utils.respond_to?(:extract_signature_html)
        signature_html = @signature_utils.extract_signature_html(reply_html)
        if signature_html
          # Remove signature from reply to get clean content
          clean_reply = reply_html.gsub(signature_html, "").strip
        end
      end

      success_result({
        format: "text/html",
        original_content: content,
        reply_html: reply_html&.strip,
        clean_reply: clean_reply&.strip,
        signature: signature_html&.strip,
        original_length: content.length,
        reply_length: reply_html&.length || 0,
        clean_length: clean_reply&.length || 0,
        has_signature: signature_html.present?,
        talon_version: talon_version
      })
    rescue PyCall::PyError => e
      Rails.logger.error "Talon HTML parsing failed: #{e.message}"
      error_result("HTML parsing error: #{e.message}")
    end
  end

  # Parse both text and HTML formats
  # @param content [Hash] Hash with :text and :html keys, or String (will attempt both)
  # @return [Hash] Combined parsing results
  def parse_both_formats(content)
    if content.is_a?(String)
      # Attempt to parse as both formats with the same content
      text_result = parse_plain_text(content)
      html_result = parse_html(content)

      success_result({
        format: "both",
        text_parsing: text_result,
        html_parsing: html_result,
        talon_version: talon_version
      })
    elsif content.is_a?(Hash) && (content[:text] || content[:html])
      results = { format: "both", talon_version: talon_version }

      if content[:text]
        results[:text_parsing] = parse_plain_text(content[:text])
      end

      if content[:html]
        results[:html_parsing] = parse_html(content[:html])
      end

      success_result(results)
    else
      error_result("Invalid content for both formats parsing. Expected String or Hash with :text/:html keys")
    end
  end

  # Check if Talon parser is available and initialized
  # @return [Boolean] True if parser is ready to use
  def available?
    @initialized && @talon.present?
  end

  # Get Talon library version
  # @return [String] Version string or error message
  def talon_version
    return "unavailable" unless available?

    begin
      @talon.__version__ || "version_unknown"
    rescue
      "version_error"
    end
  end

  # Health check for the service
  # @return [Hash] Service status and capabilities
  def health_check
    if available?
      begin
        # Test basic functionality
        test_email = "Test reply\n\nOn Mon, Dec 1, 2014 at 11:55 AM, Original Sender wrote:\n> Original message"
        test_result = @talon.quotations.extract_from(test_email)

        {
          service: "TalonEmailParser",
          status: :available,
          initialized: true,
          talon_version: talon_version,
          signature_extraction: @signature_utils.present?,
          test_passed: test_result == "Test reply",
          capabilities: {
            plain_text: true,
            html: true,
            signature_extraction: @signature_utils.present?,
            both_formats: true
          },
          last_check: Time.current
        }
      rescue StandardError => e
        {
          service: "TalonEmailParser",
          status: :error,
          initialized: true,
          error: e.message,
          last_check: Time.current
        }
      end
    else
      {
        service: "TalonEmailParser",
        status: :unavailable,
        initialized: false,
        error: @initialization_error,
        last_check: Time.current
      }
    end
  end

  # Parse email from FrontMessage model
  # @param message [FrontMessage] The message to parse
  # @param format [String] Format preference
  # @return [Hash] Parsing results
  def parse_front_message(message, format: "both")
    return error_result("Invalid message") unless message.is_a?(FrontMessage)

    content = case format
    when "text/plain"
      message.body_plain
    when "text/html"
      message.body_html
    when "both"
      {
        text: message.body_plain,
        html: message.body_html
      }.compact
    end

    return error_result("No content available in message") if content.blank?

    result = parse_email(content, format: format)

    # Add message context to result
    if result[:success]
      result[:data][:message_context] = {
        message_id: message.id,
        front_id: message.front_id,
        subject: message.subject,
        is_inbound: message.is_inbound,
        message_type: message.message_type
      }
    end

    result
  end

  private

  # Initialize Talon modules with error handling
  def initialize_talon
    begin
      unless defined?(PyCall)
        @initialization_error = "PyCall not available"
        return
      end

      # Import main Talon module
      @talon = PyCall.import_module("talon")

      # Try to import signature utilities if available
      begin
        @signature_utils = PyCall.import_module("talon.signature")
      rescue PyCall::PyError
        Rails.logger.info "Talon signature utilities not available - signature extraction will be limited"
        @signature_utils = nil
      end

      @initialized = true
      Rails.logger.info "TalonEmailParser initialized successfully (version: #{talon_version})"

    rescue PyCall::PyError => e
      @initialization_error = "Failed to import Talon modules: #{e.message}"
      Rails.logger.error "TalonEmailParser initialization failed: #{@initialization_error}"
    rescue StandardError => e
      @initialization_error = "Unexpected initialization error: #{e.message}"
      Rails.logger.error "TalonEmailParser initialization failed: #{@initialization_error}"
    end
  end

  # Validate format parameter
  def validate_format!(format)
    valid_formats = [ "text/plain", "text/html", "both" ]
    unless valid_formats.include?(format)
      raise FormatError, "Invalid format '#{format}'. Must be one of: #{valid_formats.join(', ')}"
    end
  end

  # Create success result hash
  def success_result(data)
    {
      success: true,
      data: data,
      parsed_at: Time.current
    }
  end

  # Create error result hash
  def error_result(message)
    {
      success: false,
      error: message,
      data: nil,
      parsed_at: Time.current
    }
  end
end
