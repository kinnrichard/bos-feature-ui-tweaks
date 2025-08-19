# frozen_string_literal: true

class ContactMethodType
  TYPES = {
    phone: {
      emoji: "📱",
      label: "Phone",
      placeholder: "(555) 555-5555",
      input_type: "tel"
    },
    email: {
      emoji: "📧",
      label: "Email",
      placeholder: "email@example.com",
      input_type: "email"
    },
    address: {
      emoji: "📍",
      label: "Address",
      placeholder: "123 Main St, City, State 12345",
      input_type: "text"
    }
  }.freeze

  attr_reader :key

  def initialize(type)
    @key = type.to_s.to_sym
    # Default to phone if unknown type
    @key = :phone unless TYPES.key?(@key)
  end

  def emoji
    TYPES[@key][:emoji] || "📞"
  end

  def label
    TYPES[@key][:label] || @key.to_s.humanize
  end

  def placeholder
    TYPES[@key][:placeholder] || ""
  end

  def input_type
    TYPES[@key][:input_type] || "text"
  end

  def to_s
    label
  end

  def to_sym
    @key
  end

  def with_emoji
    "#{emoji} #{label}"
  end

  # For ActiveRecord integration
  def to_param
    @key.to_s
  end

  # Equality
  def ==(other)
    return false unless other.is_a?(ContactMethodType)
    @key == other.key
  end

  def eql?(other)
    self == other
  end

  def hash
    @key.hash
  end

  # Class methods
  def self.all
    TYPES.keys.map { |key| new(key) }
  end

  def self.for_select
    all.map { |type| [ type.label, type.key.to_s ] }
  end

  def self.find(key)
    new(key)
  end

  def self.valid?(type)
    TYPES.key?(type.to_s.to_sym)
  end

  # For form helpers
  def self.options_for_select
    TYPES.map { |key, attrs| [ attrs[:label], key.to_s ] }
  end
end
