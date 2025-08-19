class FrontMessage < ApplicationRecord
  # Associations
  belongs_to :front_conversation
  belongs_to :author, polymorphic: true, optional: true  # Can be FrontContact or FrontTeammate
  has_many :front_message_recipients, dependent: :destroy
  has_many :recipients, through: :front_message_recipients, source: :front_contact
  has_many :front_attachments, dependent: :destroy
  has_one :parsed_email, as: :parseable, dependent: :destroy

  # Validations
  validates :front_id, presence: true, uniqueness: true
  validates :message_type, presence: true

  # Callbacks
  after_create :queue_parsing, if: :should_parse?

  # Scopes
  scope :inbound, -> { where(is_inbound: true) }
  scope :outbound, -> { where(is_inbound: false) }
  scope :emails, -> { where(message_type: "email") }
  scope :recent, -> { order(created_at_timestamp: :desc) }

  # Email parsing methods

  # Queue background parsing job for the message
  # Only queues for inbound, non-draft, email messages
  def queue_parsing(options = {})
    return unless should_parse?

    EmailParseJob.perform_later(self, options)
  end

  # Queue batch parsing for multiple messages
  # @param message_ids [Array<Integer>] Array of FrontMessage IDs to parse
  # @param batch_options [Hash] Options for batch processing
  # @return [ActiveJob::Base] The queued FrontMessageParsingJob
  def self.queue_batch_parsing(message_ids, batch_options = {})
    default_options = {
      message_ids: message_ids,
      batch_size: 10,
      skip_parsed: true,
      force_reparse: false,
      options: {}
    }

    batch_options = default_options.merge(batch_options.symbolize_keys)
    FrontMessageParsingJob.perform_later(batch_options)
  end

  # Queue parsing for all unparsed messages
  # @param limit [Integer] Maximum number of messages to process (default: 1000)
  # @param batch_size [Integer] Messages per batch job (default: 10)
  # @return [Array<ActiveJob::Base>] Array of queued jobs
  def self.queue_all_unparsed(limit: 1000, batch_size: 10)
    unparsed_messages = where(is_inbound: true, is_draft: false, message_type: "email")
                       .left_joins(:parsed_email)
                       .where(parsed_emails: { id: nil })
                       .limit(limit)
                       .pluck(:id)

    return [] if unparsed_messages.empty?

    jobs = []
    unparsed_messages.each_slice(batch_size * 5) do |message_batch|
      job = queue_batch_parsing(message_batch, { batch_size: batch_size })
      jobs << job
    end

    Rails.logger.info "Queued #{jobs.length} batch parsing jobs for #{unparsed_messages.length} unparsed messages"
    jobs
  end

  # Perform immediate parsing of the message
  # @param options [Hash] Parsing options
  # @return [ParsedEmail, nil] The parsed email record or nil if parsing failed
  def parse!(options = {})
    return unless should_parse?

    Rails.logger.info "Performing immediate parsing for FrontMessage #{id}"

    begin
      # Use TalonEmailParser service directly
      parser = TalonEmailParser.instance
      result = parser.parse_front_message(self, format: "both")

      if result[:success]
        create_parsed_email_from_result(result[:data], options)
      else
        Rails.logger.error "Immediate parsing failed for FrontMessage #{id}: #{result[:error]}"
        create_parsed_email_with_error(result[:error], options)
      end
    rescue StandardError => e
      Rails.logger.error "Immediate parsing failed for FrontMessage #{id}: #{e.message}"
      create_parsed_email_with_error(e.message, options)
    end
  end

  # Get display content with options for signature and format preference
  # @param include_signature [Boolean] Whether to include signature in content
  # @param prefer_html [Boolean] Whether to prefer HTML over plain text
  # @return [String, nil] The display content
  def display_content(include_signature: false, prefer_html: false)
    # If we have parsed content, use it
    if parsed_email&.has_parsed_content?
      if include_signature
        parsed_email.content_with_signature(prefer_html: prefer_html)
      else
        parsed_email.clean_content(prefer_html: prefer_html)
      end
    else
      # Fallback to original content
      prefer_html ? (body_html.presence || body_plain) : (body_plain.presence || body_html)
    end
  end

  # Generate content hash for deduplication and caching
  # @return [String] SHA256 hash of the message content
  def content_hash
    @content_hash ||= begin
      content = [
        body_plain,
        body_html,
        subject,
        front_id
      ].compact.join("|")

      Digest::SHA256.hexdigest(content)
    end
  end

  # Check if message has been parsed
  # @return [Boolean] True if message has parsed email data
  def parsed?
    parsed_email&.has_parsed_content? || false
  end

  # Check if message has parsing errors
  # @return [Boolean] True if parsing failed with errors
  def parse_failed?
    parsed_email&.parse_errors.present? || false
  end

  # Get parsing status for display
  # @return [String] Human readable parsing status
  def parsing_status
    return "not_parsed" unless parsed_email

    parsed_email.parsing_status
  end

  # Helper methods
  def created_time
    Time.at(created_at_timestamp) if created_at_timestamp
  end

  def body_content
    body_plain.presence || body_html
  end

  def from_recipients
    front_message_recipients.where(role: "from")
  end

  def to_recipients
    front_message_recipients.where(role: "to")
  end

  def cc_recipients
    front_message_recipients.where(role: "cc")
  end

  # Get author display name from polymorphic association or stored fields
  def author_display_name
    if author.present?
      author.display_name
    else
      author_name.presence || author_handle
    end
  end

  # Get author email/handle
  def author_email
    if author.present?
      author.respond_to?(:email) ? author.email : author.handle
    else
      author_handle
    end
  end

  private

  # Check if message should be parsed
  # Only parse inbound, non-draft, email messages
  # @return [Boolean] True if message should be parsed
  def should_parse?
    is_inbound && !is_draft && message_type == "email"
  end

  # Create ParsedEmail record from successful parsing result
  # @param data [Hash] Parsing result data from TalonEmailParser
  # @param options [Hash] Additional parsing options
  # @return [ParsedEmail] The created/updated parsed email record
  def create_parsed_email_from_result(data, options)
    # Extract content based on parsing format
    plain_content = extract_plain_content_from_result(data)
    html_content = extract_html_content_from_result(data)

    parsed_email_attrs = {
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
    }

    if parsed_email
      parsed_email.update!(parsed_email_attrs)
      parsed_email
    else
      create_parsed_email!(parsed_email_attrs)
    end
  end

  # Create ParsedEmail record with error information
  # @param error [String] Error message
  # @param options [Hash] Additional parsing options
  # @return [ParsedEmail] The created/updated parsed email record
  def create_parsed_email_with_error(error, options)
    parsed_email_attrs = {
      content_hash: content_hash,
      parsed_at: Time.current,
      parser_version: "error",
      parse_options: options.to_json,
      parse_errors: { error: error, timestamp: Time.current }.to_json
    }

    if parsed_email
      parsed_email.update!(parsed_email_attrs)
      parsed_email
    else
      create_parsed_email!(parsed_email_attrs)
    end
  end

  # Extract plain text content from parsing result
  # @param data [Hash] Parsing result data
  # @return [Hash] Plain text message and signature
  def extract_plain_content_from_result(data)
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

  # Extract HTML content from parsing result
  # @param data [Hash] Parsing result data
  # @return [Hash] HTML message and signature
  def extract_html_content_from_result(data)
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
end
