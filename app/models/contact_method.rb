class ContactMethod < ApplicationRecord
  belongs_to :person

  # Reverse associations with Front models
  has_many :front_conversations, primary_key: "normalized_value",
           foreign_key: "recipient_handle",
           dependent: :nullify
  has_many :front_message_recipients, primary_key: "normalized_value",
           foreign_key: "handle",
           dependent: :nullify

  enum :contact_type, {
    phone: "phone",
    email: "email",
    address: "address"
  }

  before_validation :detect_and_format_type
  before_validation :normalize_value

  validates :value, presence: true
  validates :normalized_value, uniqueness: { scope: [ :person_id, :contact_type ] }, allow_nil: true

  # Value object integration
  def contact_type_object
    ContactMethodType.new(contact_type)
  end

  # Delegate display methods to value object
  delegate :emoji, :label, :placeholder, :input_type, :with_emoji,
           to: :contact_type_object, prefix: :contact_type

  alias_method :type_emoji, :contact_type_emoji
  alias_method :type_label, :contact_type_label

  # Class method for external normalization
  def self.normalize(value, type)
    return nil if value.blank?

    case type.to_s
    when "phone"
      normalize_phone_value(value)
    when "email"
      normalize_email_value(value)
    when "address"
      normalize_address_value(value)
    else
      value
    end
  end

  private

  def detect_and_format_type
    return unless value.present?

    # Trim value for better detection
    trimmed_value = value.strip

    # Check if it's an email
    if trimmed_value.match?(/\A[^@\s]+@[^@\s]+\z/)
      self.contact_type = :email
      self.formatted_value = trimmed_value.downcase
    # Check if it's a phone number using phonelib or has phone-like patterns
    elsif is_phone_number?(trimmed_value)
      self.contact_type = :phone
      format_phone_number
    else
      self.contact_type = :address
      self.formatted_value = value
    end
  end

  def normalize_value
    return unless value.present?

    case contact_type&.to_s
    when "phone"
      self.normalized_value = self.class.normalize_phone_value(value)
    when "email"
      self.normalized_value = self.class.normalize_email_value(value)
    when "address"
      self.normalized_value = self.class.normalize_address_value(value)
    end
  end

  def is_phone_number?(value)
    # First try phonelib validation
    parsed = Phonelib.parse(value)
    return true if parsed.valid?

    # Check if phonelib can extract a valid phone number (even with extension)
    return true if parsed.e164.present? && parsed.e164.match?(/\A\+\d{10,}\z/)

    # Fallback to digit counting for simple cases
    digits = value.gsub(/\D/, "")
    return true if digits.match?(/\A\d{10,11}\z/)

    false
  end

  def format_phone_number
    # Remove all non-digits
    digits = value.gsub(/\D/, "")

    # Format as (812) 321-3123
    if digits.length == 10
      self.formatted_value = "(#{digits[0..2]}) #{digits[3..5]}-#{digits[6..9]}"
    elsif digits.length == 11 && digits[0] == "1"
      # Remove country code
      digits = digits[1..-1]
      self.formatted_value = "(#{digits[0..2]}) #{digits[3..5]}-#{digits[6..9]}"
    else
      self.formatted_value = value
    end
  end

  # Class methods for normalization
  class << self
    def normalize_phone_value(value)
      return nil if value.blank?

      # Check for extension in the original value before parsing
      extension_match = value.match(/(?:ext?\.?|extension|x)\s*(\d+)$/i)

      # Remove extension from value for parsing
      clean_value = extension_match ? value.gsub(/(?:ext?\.?|extension|x)\s*\d+$/i, "").strip : value

      # Parse phone number with US country code for 10-digit numbers
      digits = clean_value.gsub(/\D/, "")

      if digits.length == 10
        # For 10-digit numbers, explicitly use US country code
        parsed = Phonelib.parse(clean_value, "US")
      else
        # For other lengths, parse normally (handles international numbers)
        parsed = Phonelib.parse(clean_value)
      end

      if parsed.valid? || (parsed.possible? && parsed.e164.present?)
        # Get E.164 format (international standard)
        normalized = parsed.e164

        # Add extension if found
        if extension_match
          extension = extension_match[1]
          normalized = "#{normalized},#{extension}"
        end

        normalized
      else
        # Fallback to original behavior for invalid phone numbers
        # This maintains backward compatibility
        digits = value.gsub(/\D/, "")
        if digits.length >= 10
          # Add US country code for 10-digit numbers
          if digits.length == 10
            "+1#{digits}"
          elsif digits.length == 11 && digits[0] == "1"
            "+#{digits}"
          else
            "+#{digits}"
          end
        else
          value
        end
      end
    end

    def normalize_email_value(value)
      return nil if value.blank?
      value.downcase.strip
    end

    def normalize_address_value(value)
      return nil if value.blank?
      # For addresses, we store as-is but trimmed
      value.strip
    end
  end
end
