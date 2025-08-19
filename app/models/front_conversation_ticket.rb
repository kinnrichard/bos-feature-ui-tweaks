class FrontConversationTicket < ApplicationRecord
  belongs_to :front_conversation
  belongs_to :front_ticket
end
