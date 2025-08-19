class Device < ApplicationRecord
  include Loggable

  belongs_to :client
  belongs_to :person, optional: true

  validates :name, presence: true, uniqueness: { scope: :client_id, case_sensitive: false }

  # For displaying in views - hide empty fields
  def display_location?
    location.present?
  end

  def display_notes?
    notes.present?
  end
end
