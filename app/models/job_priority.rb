# frozen_string_literal: true

class JobPriority
  include Comparable

  PRIORITIES = {
    critical: {
      emoji: "🔥",
      label: "Critical",
      sort_order: 0,
      color: "red"
    },
    very_high: {
      emoji: "‼️",
      label: "Very High",
      sort_order: 1,
      color: "red"
    },
    high: {
      emoji: "❗",
      label: "High",
      sort_order: 2,
      color: "orange"
    },
    normal: {
      emoji: "➖",
      label: "Normal",
      sort_order: 3,
      color: "gray"
    },
    low: {
      emoji: "🐢",
      label: "Low",
      sort_order: 4,
      color: "blue"
    },
    proactive_followup: {
      emoji: "💬",
      label: "Proactive Follow-up",
      sort_order: 5,
      color: "purple"
    }
  }.freeze

  attr_reader :key

  def initialize(priority)
    @key = priority.to_s.to_sym
    raise ArgumentError, "Invalid priority: #{priority}" unless PRIORITIES.key?(@key)
  end

  def emoji
    PRIORITIES[@key][:emoji] || ""
  end

  def label
    PRIORITIES[@key][:label] || @key.to_s.humanize
  end

  def sort_order
    PRIORITIES[@key][:sort_order] || 999
  end

  def color
    PRIORITIES[@key][:color] || "gray"
  end

  def to_s
    label
  end

  def to_sym
    @key
  end

  def with_emoji
    emoji.present? ? "#{emoji} #{label}" : label
  end

  # For ActiveRecord integration
  def to_param
    @key.to_s
  end

  # Comparable
  def <=>(other)
    return nil unless other.is_a?(JobPriority)
    sort_order <=> other.sort_order
  end

  # Equality
  def ==(other)
    return false unless other.is_a?(JobPriority)
    @key == other.key
  end

  def eql?(other)
    self == other
  end

  def hash
    @key.hash
  end

  # Class methods for Rails integration
  def self.all
    PRIORITIES.keys.map { |key| new(key) }
  end

  def self.for_select
    all.map { |priority| [ priority.label, priority.key.to_s ] }
  end

  def self.find(key)
    new(key)
  rescue ArgumentError
    nil
  end

  def self.valid?(priority)
    PRIORITIES.key?(priority.to_s.to_sym)
  end

  # For form helpers
  def self.options_for_select
    PRIORITIES.sort_by { |_, attrs| attrs[:sort_order] }
              .map { |key, attrs| [ attrs[:label], key.to_s ] }
  end
end
