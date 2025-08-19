class CreateFrontConversationTickets < ActiveRecord::Migration[8.0]
  def change
    create_table :front_conversation_tickets, id: :uuid do |t|
      t.references :front_conversation, null: false, foreign_key: true, type: :uuid
      t.references :front_ticket, null: false, foreign_key: true, type: :uuid

      t.timestamps
    end

    add_index :front_conversation_tickets, [ :front_conversation_id, :front_ticket_id ], unique: true, name: 'index_front_conversation_tickets_unique'
  end
end
