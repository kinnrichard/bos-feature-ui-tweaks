class AddRecipientFieldsToFrontConversations < ActiveRecord::Migration[8.0]
  def change
    add_column :front_conversations, :recipient_handle, :string
    add_column :front_conversations, :recipient_role, :string
  end
end
