class DeviceSerializer < ApplicationSerializer
  set_type :devices

  attributes :name, :location, :model, :serial_number, :notes

  timestamp_attributes :created_at, :updated_at

  # API compatibility attributes
  attribute :device_type do |device|
    "unknown"
  end

  attribute :status do |device|
    "active"
  end

  attribute :metadata do |device|
    {}
  end

  # Relationships
  belongs_to :client
  has_many :notes, if: proc { |device| false } # No notes relationship in current model

  # Computed attributes
  attribute :owner_name do |device|
    device.person&.name || device.client&.name
  end

  attribute :has_location do |device|
    device.location.present?
  end

  attribute :has_notes do |device|
    device.notes.present?
  end

  attribute :display_name do |device|
    if device.name.present?
      device.name
    elsif device.model.present?
      "#{device.model} (unknown)"
    else
      "Unknown Device"
    end
  end

  attribute :status_label do |device|
    "Active"
  end

  attribute :is_active do |device|
    true
  end

  attribute :requires_attention do |device|
    false
  end

  attribute :last_seen_at do |device|
    nil
  end
end
