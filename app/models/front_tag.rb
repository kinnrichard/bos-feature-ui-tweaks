class FrontTag < ApplicationRecord
  # Associations
  belongs_to :parent_tag, class_name: "FrontTag", optional: true
  has_many :child_tags, class_name: "FrontTag", foreign_key: :parent_tag_id, dependent: :destroy
  has_many :front_conversation_tags, dependent: :destroy
  has_many :front_conversations, through: :front_conversation_tags

  # Validations
  validates :front_id, presence: true, uniqueness: true
  validates :name, presence: true

  # Scopes
  scope :visible, -> { where(is_visible_in_conversation_lists: true) }
  scope :private_tags, -> { where(is_private: true) }
  scope :public_tags, -> { where(is_private: false) }
  scope :root_tags, -> { where(parent_tag_id: nil) }

  # Helper methods
  def created_time
    Time.at(created_at_timestamp) if created_at_timestamp
  end

  def updated_time
    Time.at(updated_at_timestamp) if updated_at_timestamp
  end

  def has_children?
    child_tags.exists?
  end

  def conversation_count
    front_conversations.count
  end
end
