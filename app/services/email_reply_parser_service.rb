# Email Reply Parser Service
# Provides a clean Ruby interface for parsing email replies using the Talon Python library
# Integrates with PyCall to leverage Talon's email parsing capabilities

class EmailReplyParserService
  class << self
    # Parse email reply to extract just the new content
    # @param email_content [String] The full email content including reply and original message
    # @return [Hash] Result hash with :reply_text and :success status
    def extract_reply(email_content)
      return error_result("Email content cannot be blank") if email_content.blank?
      return error_result("Talon parser not available") unless TalonParserHelper.available?

      begin
        # Use Talon to extract the reply portion
        reply_text = TalonParserHelper.parser.quotations.extract_from(email_content)

        success_result({
          reply_text: reply_text&.strip,
          original_length: email_content.length,
          parsed_length: reply_text&.length || 0
        })
      rescue StandardError => e
        Rails.logger.error "Email parsing failed: #{e.message}"
        error_result("Failed to parse email: #{e.message}")
      end
    end

    # Simple text cleaning for basic signature patterns
    # @param text [String] The text to clean
    # @return [String] Text with common signature patterns removed
    def remove_common_signatures(text)
      return text if text.blank?

      # Remove common signature patterns (simple heuristic)
      # This is a fallback since Talon doesn't have built-in signature extraction
      patterns = [
        /\n--\s*\n.*/m,  # Standard signature delimiter
        /\nBest regards?,.*\n.*@.*\n/im,  # "Best regards" signatures
        /\nThanks?,.*\n.*@.*\n/im,  # "Thanks" signatures
        /\nSent from my .*/im  # Mobile signatures
      ]

      cleaned_text = text
      patterns.each do |pattern|
        cleaned_text = cleaned_text.gsub(pattern, "")
      end

      cleaned_text.strip
    end

    # Extract reply with basic signature removal
    # @param email_content [String] The full email content
    # @return [Hash] Result hash with cleaned reply text
    def parse_clean_reply(email_content)
      return error_result("Email content cannot be blank") if email_content.blank?

      # First extract the reply portion
      reply_result = extract_reply(email_content)
      return reply_result unless reply_result[:success]

      # Apply basic signature cleanup
      reply_text = reply_result[:data][:reply_text]
      clean_reply = remove_common_signatures(reply_text)

      success_result({
        clean_reply: clean_reply,
        original_reply: reply_text,
        original_length: email_content.length,
        reply_length: reply_text&.length || 0,
        clean_length: clean_reply&.length || 0
      })
    end

    # Advanced parsing using TalonEmailParser service
    # @param email_content [String] The full email content
    # @param format [String] Format to parse ('text/plain', 'text/html', 'both')
    # @return [Hash] Enhanced parsing results with signatures
    def advanced_parse(email_content, format: "text/plain")
      return error_result("Email content cannot be blank") if email_content.blank?

      begin
        parser = TalonEmailParser.instance
        return error_result("TalonEmailParser not available") unless parser.available?

        result = parser.parse_email(email_content, format: format)

        if result[:success]
          # Transform to match our existing interface
          data = result[:data]
          success_result({
            reply_text: data[:reply_text] || data[:clean_reply],
            clean_reply: data[:clean_reply],
            signature: data[:signature],
            has_signature: data[:has_signature],
            original_length: data[:original_length],
            reply_length: data[:reply_length] || data[:clean_length],
            clean_length: data[:clean_length],
            format: data[:format],
            talon_version: data[:talon_version],
            advanced_parsing: true
          })
        else
          error_result("Advanced parsing failed: #{result[:error]}")
        end
      rescue StandardError => e
        Rails.logger.error "Advanced email parsing failed: #{e.message}"
        error_result("Advanced parsing error: #{e.message}")
      end
    end

    # Health check for the service
    # @return [Hash] Service status and availability
    def health_check
      base_status = TalonParserHelper.health_check

      # Also check TalonEmailParser service
      advanced_parser = TalonEmailParser.instance
      advanced_status = advanced_parser.health_check

      {
        service: "EmailReplyParserService",
        talon_status: base_status[:status],
        available: base_status[:status] == :available,
        message: base_status[:message],
        advanced_parser: {
          status: advanced_status[:status],
          available: advanced_parser.available?,
          capabilities: advanced_status[:capabilities]
        },
        last_check: Time.current
      }
    end

    private

    def success_result(data)
      {
        success: true,
        data: data
      }
    end

    def error_result(message)
      {
        success: false,
        error: message,
        data: nil
      }
    end
  end
end
