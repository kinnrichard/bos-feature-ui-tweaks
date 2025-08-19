class ScheduledDateTimeUser < ApplicationRecord
  belongs_to :scheduled_date_time
  belongs_to :user

  # Validations to ensure unique user per scheduled datetime
  validates :user_id, uniqueness: { scope: :scheduled_date_time_id }
end
