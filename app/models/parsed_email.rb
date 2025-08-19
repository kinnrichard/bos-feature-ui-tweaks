class ParsedEmail < ApplicationRecord
  # Associations
  belongs_to :parseable, polymorphic: true

  # JSON serialization for Rails 8 - using attribute with cast type
  # Note: Rails 8 with PostgreSQL supports native JSON columns, so we'll use type casting
  attribute :parse_options, :json
  attribute :parse_errors, :json

  # Validations
  validates :parseable_type, presence: true
  validates :parseable_id, presence: true

  # Scopes
  scope :with_errors, -> { where.not(parse_errors: [ nil, {}, "{}", "[]" ]) }
  scope :successful, -> { where(parse_errors: [ nil, {}, "{}", "[]" ]) }

  # Computed properties

  # Combines plain message with signature
  def plain_message_with_signature
    return nil unless plain_message.present?

    components = [ plain_message, plain_signature ].compact
    return plain_message if components.length == 1

    components.join("\n\n")
  end

  # Combines HTML message with signature
  def html_message_with_signature
    return nil unless html_message.present?

    components = [ html_message, html_signature ].compact
    return html_message if components.length == 1

    components.join("\n")
  end

  # Get the cleanest content (no quotes, no signature)
  # @param prefer_html [Boolean] Whether to prefer HTML over plain text
  # @return [String, nil] The clean message content
  def clean_content(prefer_html: false)
    if prefer_html
      html_message.presence || plain_message.presence
    else
      plain_message.presence || html_message.presence
    end
  end

  # Get content with signature (no quotes)
  # @param prefer_html [Boolean] Whether to prefer HTML over plain text
  # @return [String, nil] The message content with signature
  def content_with_signature(prefer_html: false)
    if prefer_html
      html_message_with_signature || plain_message_with_signature
    else
      plain_message_with_signature || html_message_with_signature
    end
  end

  # Check if email has a signature
  # @return [Boolean] True if either plain or HTML signature exists
  def has_signature?
    plain_signature.present? || html_signature.present?
  end

  # Get the signature content
  # @param prefer_html [Boolean] Whether to prefer HTML over plain text
  # @return [String, nil] The signature content
  def signature(prefer_html: false)
    if prefer_html
      html_signature.presence || plain_signature.presence
    else
      plain_signature.presence || html_signature.presence
    end
  end

  # Check if parsing was successful (no errors)
  # @return [Boolean] True if parsing completed without errors
  def parsing_successful?
    parse_errors.blank? || parse_errors.empty?
  end

  # Get human-readable parsing status
  # @return [String] Status description
  def parsing_status
    return "successful" if parsing_successful?
    return "failed" if parse_errors.present? && parse_errors.any?

    "unknown"
  end

  # Get formatted error messages for display
  # @return [Array<String>] Array of error messages
  def error_messages
    return [] unless parse_errors.present?

    case parse_errors
    when Hash
      parse_errors.values.flatten.compact
    when Array
      parse_errors.flatten.compact
    else
      [ parse_errors.to_s ]
    end
  end

  # Check if content was actually parsed (has parsed content)
  # @return [Boolean] True if any message content was extracted
  def has_parsed_content?
    plain_message.present? || html_message.present?
  end

  # Get a summary of what was parsed
  # @return [Hash] Summary of parsed components
  def parsing_summary
    {
      plain_message: plain_message.present?,
      plain_signature: plain_signature.present?,
      html_message: html_message.present?,
      html_signature: html_signature.present?,
      has_errors: !parsing_successful?,
      parsed_at: parsed_at,
      parser_version: parser_version
    }
  end
end
