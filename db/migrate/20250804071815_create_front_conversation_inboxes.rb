class CreateFrontConversationInboxes < ActiveRecord::Migration[8.0]
  def change
    create_table :front_conversation_inboxes, id: :uuid do |t|
      t.references :front_conversation, null: false, foreign_key: true, type: :uuid
      t.references :front_inbox, null: false, foreign_key: true, type: :uuid

      t.timestamps
    end
    add_index :front_conversation_inboxes, [ :front_conversation_id, :front_inbox_id ],
              unique: true, name: 'index_front_conversation_inboxes_unique'
  end
end
