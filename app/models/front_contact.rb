class FrontContact < ApplicationRecord
  # Associations
  has_many :front_conversations, foreign_key: :recipient_contact_id, dependent: :nullify
  has_many :authored_messages, class_name: "FrontMessage", as: :author, dependent: :nullify
  has_many :front_message_recipients, dependent: :destroy
  has_many :messages, through: :front_message_recipients, source: :front_message

  # Validations
  validates :handle, presence: true

  # Scopes
  scope :with_front_id, -> { where.not(front_id: nil) }
  scope :by_handle, ->(handle) { where(handle: handle) }

  # Helper methods
  def primary_email
    email_handles = handles&.select { |h| h["source"] == "email" }
    email_handles&.first&.dig("handle") || (handle if handle&.include?("@"))
  end

  def all_emails
    email_handles = handles&.select { |h| h["source"] == "email" }&.map { |h| h["handle"] } || []
    email_handles << handle if handle&.include?("@") && !email_handles.include?(handle)
    email_handles.uniq
  end

  def all_phones
    handles&.select { |h| h["source"] == "phone" }&.map { |h| h["handle"] } || []
  end

  def display_name
    name.presence || handle
  end
end
