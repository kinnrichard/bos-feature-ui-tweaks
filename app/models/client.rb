class Client < ApplicationRecord
  include Loggable

  # Associations
  has_many :people, dependent: :destroy
  has_many :jobs, dependent: :destroy
  has_many :devices, dependent: :destroy
  has_many :people_groups, dependent: :destroy

  # Front conversation associations
  has_many :clients_front_conversations, class_name: "ClientFrontConversation", dependent: :destroy
  has_many :front_conversations, through: :clients_front_conversations

  # Validations
  validates :name, presence: true
  validates :client_type, presence: true
  validates :name_normalized, presence: true
  validate :unique_name_validation

  # Callbacks
  before_validation :normalize_name

  # Enum for client types (string storage for better readability and Zero ORM compatibility)
  enum :client_type, {
    residential: "residential",
    business: "business"
  }

  # Scopes for searching
  scope :search, ->(query) { where("name ILIKE ?", "%#{query}%") if query.present? }

  # Default ordering
  default_scope { order(:name) }


  private

  def normalize_name
    return unless name.present?

    # Remove accents/diacritics and convert to lowercase
    normalized = name.unicode_normalize(:nfd).encode("ASCII", replace: "")

    # Keep only letters and numbers, remove all other characters
    normalized = normalized.downcase.gsub(/[^a-z0-9]/, "")

    self.name_normalized = normalized
  end

  def unique_name_validation
    return unless name_normalized.present?

    existing = Client.where.not(id: id).find_by(name_normalized: name_normalized)
    if existing
      errors.add(:name, "is too similar to an existing client: '#{existing.name}'")
    end
  end
end
