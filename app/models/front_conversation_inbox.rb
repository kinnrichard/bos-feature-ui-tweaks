class FrontConversationInbox < ApplicationRecord
  belongs_to :front_conversation
  belongs_to :front_inbox
end
