class FrontTicket < ApplicationRecord
  # Associations
  has_many :front_conversation_tickets, dependent: :destroy
  has_many :front_conversations, through: :front_conversation_tickets

  # Validations
  validates :front_id, presence: true, uniqueness: true
  validates :ticket_id, presence: true

  # Helper methods
  def created_time
    Time.at(created_at_timestamp) if created_at_timestamp
  end

  def updated_time
    Time.at(updated_at_timestamp) if updated_at_timestamp
  end
end
