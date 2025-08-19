class FrontTeammate < ApplicationRecord
  # Associations
  has_many :assigned_conversations, class_name: "FrontConversation", foreign_key: "assignee_id"
  has_many :authored_messages, class_name: "FrontMessage", as: :author

  # Validations
  validates :front_id, presence: true, uniqueness: true

  # Scopes
  scope :available, -> { where(is_available: true) }
  scope :admins, -> { where(is_admin: true) }
  scope :active, -> { where(is_blocked: false) }

  # Helper methods
  def full_name
    [ first_name, last_name ].compact.join(" ")
  end

  def display_name
    full_name.presence || username || email
  end

  def created_time
    Time.at(created_at_timestamp) if created_at_timestamp
  end

  def updated_time
    Time.at(updated_at_timestamp) if updated_at_timestamp
  end
end
