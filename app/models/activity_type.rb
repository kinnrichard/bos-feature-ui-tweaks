# frozen_string_literal: true

class ActivityType
  TYPES = {
    created: {
      label: "Created",
      past_tense: "created",
      icon: "➕",
      color: "green"
    },
    viewed: {
      label: "Viewed",
      past_tense: "viewed",
      icon: "👁️",
      color: "blue"
    },
    renamed: {
      label: "Renamed",
      past_tense: "renamed",
      icon: "✏️",
      color: "yellow"
    },
    updated: {
      label: "Updated",
      past_tense: "updated",
      icon: "🔄",
      color: "blue"
    },
    deleted: {
      label: "Deleted",
      past_tense: "deleted",
      icon: "🗑️",
      color: "red"
    },
    assigned: {
      label: "Assigned",
      past_tense: "assigned",
      icon: "👤",
      color: "purple"
    },
    unassigned: {
      label: "Unassigned",
      past_tense: "unassigned",
      icon: "❓",
      color: "gray"
    },
    status_changed: {
      label: "Status Changed",
      past_tense: "marked",
      icon: "🔀",
      color: "blue"
    },
    added: {
      label: "Added",
      past_tense: "added",
      icon: "📎",
      color: "green"
    },
    logged_in: {
      label: "Logged In",
      past_tense: "signed into",
      icon: "🔐",
      color: "green"
    },
    logged_out: {
      label: "Logged Out",
      past_tense: "signed out of",
      icon: "🔓",
      color: "gray"
    }
  }.freeze

  attr_reader :key

  def initialize(type)
    @key = type.to_s.to_sym
    raise ArgumentError, "Invalid activity type: #{type}" unless TYPES.key?(@key)
  end

  def label
    TYPES[@key][:label] || @key.to_s.humanize
  end

  def past_tense
    TYPES[@key][:past_tense] || @key.to_s
  end

  def icon
    TYPES[@key][:icon] || "•••"
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

  # For ActiveRecord integration
  def to_param
    @key.to_s
  end

  # Equality
  def ==(other)
    return false unless other.is_a?(ActivityType)
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

  # For form helpers
  def self.options_for_select
    TYPES.map { |key, attrs| [ attrs[:label], key.to_s ] }
  end
end
