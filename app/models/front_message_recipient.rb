class FrontMessageRecipient < ApplicationRecord
  # Associations
  belongs_to :front_message
  belongs_to :front_contact, optional: true  # Can be null if no unified Front contact

  # Association with ContactMethod via normalized handle matching
  belongs_to :matched_contact, -> { where("contact_type IN ('phone', 'email')") },
             class_name: "ContactMethod",
             primary_key: "normalized_value",
             foreign_key: "handle",
             optional: true

  # Access to Person through matched contact
  has_one :person, through: :matched_contact

  # Validations
  validates :role, presence: true, inclusion: { in: %w[from to cc bcc] }
  validates :handle, presence: true

  # Scopes
  scope :senders, -> { where(role: "from") }
  scope :primary_recipients, -> { where(role: "to") }
  scope :cc_recipients, -> { where(role: "cc") }
  scope :bcc_recipients, -> { where(role: "bcc") }
  scope :by_email, ->(email) { where(handle: email) }
  scope :with_person_data, -> { includes(matched_contact: :person) }

  # Helper methods
  def display_name_or_handle
    name.presence || handle
  end

  def is_sender?
    role == "from"
  end

  def is_primary_recipient?
    role == "to"
  end
end
