class ScheduledDateTimeSerializer < ApplicationSerializer
  set_type :scheduled_date_times

  attributes :scheduled_type, :scheduled_at, :scheduled_time_set, :notes

  timestamp_attributes :created_at, :updated_at

  # API compatibility attributes
  attribute :duration_minutes do |scheduled|
    60 # Default duration
  end

  attribute :status do |scheduled|
    "confirmed"
  end

  attribute :metadata do |scheduled|
    {}
  end

  attribute :schedule_type do |scheduled|
    scheduled.scheduled_type
  end

  # Polymorphic relationship
  belongs_to :schedulable, polymorphic: true


  # Computed attributes from value object
  attribute :type_label do |scheduled|
    scheduled.scheduled_type_label
  end

  attribute :type_emoji do |scheduled|
    scheduled.scheduled_type_emoji
  end

  attribute :type_color do |scheduled|
    scheduled.scheduled_type_color
  end

  attribute :status_label do |scheduled|
    "Confirmed"
  end

  # DateTime attributes
  attribute :scheduled_at do |scheduled|
    scheduled.scheduled_at&.iso8601
  end

  attribute :scheduled_end_at do |scheduled|
    if scheduled.scheduled_at
      (scheduled.scheduled_at + 60.minutes).iso8601
    end
  end

  # Status flags
  attribute :is_past do |scheduled|
    scheduled.scheduled_at && scheduled.scheduled_at < Date.current.beginning_of_day
  end

  attribute :is_future do |scheduled|
    scheduled.scheduled_at && scheduled.scheduled_at > Date.current.end_of_day
  end

  attribute :is_today do |scheduled|
    scheduled.scheduled_at && scheduled.scheduled_at.to_date == Date.current
  end
end
