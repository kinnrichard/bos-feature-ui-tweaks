class ScheduledDateTime < ApplicationRecord
  include Loggable
  include PolymorphicUuidSupport

  # Polymorphic association to any schedulable model (Job, etc.)
  belongs_to :schedulable, polymorphic: true

  # Many-to-many relationship with users (technicians)
  has_many :scheduled_date_time_users, dependent: :destroy
  has_many :users, through: :scheduled_date_time_users

  # Validations
  validates :scheduled_type, presence: true
  validates :scheduled_at, presence: true
  validates :scheduled_type, inclusion: {
    in: %w[due start followup],
    message: "%{value} is not a valid scheduled type"
  }

  # Value object integration
  def scheduled_type_object
    ScheduleType.new(scheduled_type)
  end

  # Delegate display methods to value object
  delegate :emoji, :label, :description, :color, :with_emoji,
           to: :scheduled_type_object, prefix: :scheduled_type

  alias_method :type_emoji, :scheduled_type_emoji
  alias_method :type_label, :scheduled_type_label

  # Scopes
  scope :due_dates, -> { where(scheduled_type: "due") }
  scope :start_dates, -> { where(scheduled_type: "start") }
  scope :followup_dates, -> { where(scheduled_type: "followup") }
  scope :upcoming, -> { where("scheduled_at >= ?", Date.current.beginning_of_day).order(:scheduled_at) }
  scope :past, -> { where("scheduled_at < ?", Date.current.beginning_of_day).order(scheduled_at: :desc) }
  scope :for_date, ->(date) { where(scheduled_at: date.beginning_of_day..date.end_of_day) }
  scope :with_time, -> { where(scheduled_time_set: true) }
  scope :without_time, -> { where(scheduled_time_set: false) }

  # Class methods
  def self.scheduled_types
    {
      due: "Due Date",
      start: "Start Date",
      followup: "Followup"
    }
  end

  # Instance methods
  def due?
    scheduled_type == "due"
  end

  def start?
    scheduled_type == "start"
  end

  def followup?
    scheduled_type == "followup"
  end

  def datetime
    scheduled_at
  end

  def display_datetime
    if scheduled_time_set?
      TimeFormat.datetime(scheduled_at)
    else
      TimeFormat.date(scheduled_at.to_date, format: :medium)
    end
  end
end
