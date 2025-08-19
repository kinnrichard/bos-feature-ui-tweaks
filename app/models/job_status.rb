# frozen_string_literal: true

class JobStatus
  STATUSES = {
    open: {
      emoji: "⚫",
      label: "Open",
      color: "gray"
    },
    in_progress: {
      emoji: "🟢",
      label: "In Progress",
      color: "green"
    },
    paused: {
      emoji: "⏸️",
      label: "Paused",
      color: "yellow"
    },
    waiting_for_customer: {
      emoji: "⏳",
      label: "Waiting for Customer",
      color: "orange"
    },
    waiting_for_scheduled_appointment: {
      emoji: "🗓️",
      label: "Scheduled",
      color: "blue"
    },
    successfully_completed: {
      emoji: "✅",
      label: "Completed",
      color: "green"
    },
    cancelled: {
      emoji: "❌",
      label: "Cancelled",
      color: "red"
    }
  }.freeze

  attr_reader :key

  def initialize(status)
    @key = status.to_s.to_sym
    raise ArgumentError, "Invalid status: #{status}" unless STATUSES.key?(@key)
  end

  def emoji
    STATUSES[@key][:emoji] || "❓"
  end

  def label
    STATUSES[@key][:label] || @key.to_s.humanize
  end

  def color
    STATUSES[@key][:color] || "gray"
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
    return false unless other.is_a?(JobStatus)
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
    STATUSES.keys.map { |key| new(key) }
  end

  def self.for_select
    all.map { |status| [ status.label, status.key.to_s ] }
  end

  def self.find(key)
    new(key)
  rescue ArgumentError
    nil
  end

  def self.valid?(status)
    STATUSES.key?(status.to_s.to_sym)
  end

  # For form helpers
  def self.options_for_select
    STATUSES.map { |key, attrs| [ attrs[:label], key.to_s ] }
  end
end
