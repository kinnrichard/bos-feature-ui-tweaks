class ClientSerializer < ApplicationSerializer
  set_type :clients

  attributes :name, :client_type

  timestamp_attributes :created_at, :updated_at

  # API compatibility attributes - primary contact fields
  attribute :nickname do |client|
    nil
  end

  attribute :primary_contact_name do |client|
    nil
  end

  attribute :primary_contact_phone do |client|
    nil
  end

  attribute :primary_contact_email do |client|
    nil
  end

  attribute :phone_metadata do |client|
    {
      type: nil,
      carrier: nil,
      location: nil
    }
  end

  # Relationships
  has_many :jobs
  has_many :devices
  has_many :notes, if: proc { |client| false } # No notes relationship in current model
  has_many :contact_methods, if: proc { |client| false } # No contact_methods relationship

  attribute :client_type_label do |client|
    client.client_type&.humanize&.titleize
  end

  # Count attributes
  attribute :job_count do |client|
    client.jobs.count
  end

  attribute :jobs_count do |client|
    client.jobs.count
  end

  attribute :recent_jobs_count do |client|
    client.jobs.where(created_at: 30.days.ago..).count
  end

  attribute :active_jobs_count do |client|
    client.jobs.where(status: [ "open", "in_progress" ]).count
  end

  attribute :person_count do |client|
    client.people.count
  end

  attribute :device_count do |client|
    client.devices.count
  end

  attribute :is_active do |client|
    client.jobs.where(created_at: 90.days.ago..).exists?
  end
end
