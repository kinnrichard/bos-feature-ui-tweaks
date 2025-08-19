class Person < ApplicationRecord
  include Loggable

  belongs_to :client
  has_many :contact_methods, dependent: :destroy
  has_many :devices, dependent: :destroy
  has_many :notes, as: :notable, dependent: :destroy
  has_many :people_group_memberships, dependent: :destroy
  has_many :people_groups, through: :people_group_memberships

  # Front conversation associations
  has_many :people_front_conversations, class_name: "PersonFrontConversation", dependent: :destroy
  has_many :front_conversations, through: :people_front_conversations

  validates :name, presence: true

  accepts_nested_attributes_for :contact_methods,
    allow_destroy: true,
    reject_if: :all_blank
end
