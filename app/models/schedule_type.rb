# frozen_string_literal: true

class ScheduleType
  TYPES = {
    due: {
      emoji: "⏰",
      label: "Due Date",
      description: "Deadline for completion",
      color: "orange"
    },
    start: {
      emoji: "▶️",
      label: "Start Date",
      description: "When work should begin",
      color: "purple"
    },
    followup: {
      emoji: "🔄",
      label: "Followup",
      description: "Follow-up visit or call",
      color: "green"
    }
  }.freeze

  attr_reader :key

  def initialize(type)
    @key = type.to_s.to_sym
    raise ArgumentError, "Invalid schedule type: #{type}" unless TYPES.key?(@key)
  end

  def emoji
    TYPES[@key][:emoji] || "🗓️"
  end

  def label
    TYPES[@key][:label] || @key.to_s.humanize
  end

  def description
    TYPES[@key][:description] || ""
  end

  def color
    TYPES[@key][:color] || "gray"
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
    return false unless other.is_a?(ScheduleType)
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
  rescue ArgumentError
    nil
  end

  def self.valid?(type)
    TYPES.key?(type.to_s.to_sym)
  end

  # For form helpers with emoji
  def self.options_for_select_with_emoji
    TYPES.map { |key, attrs| [ "#{attrs[:emoji]} #{attrs[:label]}", key.to_s ] }
  end

  # For form helpers without emoji
  def self.options_for_select
    TYPES.map { |key, attrs| [ attrs[:label], key.to_s ] }
  end
end
