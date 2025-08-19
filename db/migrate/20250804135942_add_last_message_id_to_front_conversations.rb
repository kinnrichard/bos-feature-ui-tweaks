class AddLastMessageIdToFrontConversations < ActiveRecord::Migration[8.0]
  def change
    add_column :front_conversations, :last_message_front_id, :string
  end
end
