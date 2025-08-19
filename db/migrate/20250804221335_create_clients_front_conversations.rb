class CreateClientsFrontConversations < ActiveRecord::Migration[7.0]
  def change
    create_table :clients_front_conversations, id: :uuid do |t|
      t.references :client, type: :uuid, null: false, foreign_key: true
      t.references :front_conversation, type: :uuid, null: false, foreign_key: true

      t.timestamps

      # One entry per client-conversation pair
      t.index [ :client_id, :front_conversation_id ], unique: true, name: 'idx_client_front_conversation'
      t.index :front_conversation_id, name: 'idx_clients_front_convs_on_conv_id'
    end
  end
end
