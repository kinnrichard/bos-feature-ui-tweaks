class ClientFrontConversation < ApplicationRecord
  self.table_name = "clients_front_conversations"

  belongs_to :client
  belongs_to :front_conversation

  validates :client_id, uniqueness: { scope: :front_conversation_id }
end
