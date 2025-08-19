class PersonFrontConversation < ApplicationRecord
  self.table_name = "people_front_conversations"

  belongs_to :person
  belongs_to :front_conversation

  validates :person_id, uniqueness: { scope: :front_conversation_id }
end
