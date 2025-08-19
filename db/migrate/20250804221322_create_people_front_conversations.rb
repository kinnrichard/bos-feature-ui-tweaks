class CreatePeopleFrontConversations < ActiveRecord::Migration[7.0]
  def change
    create_table :people_front_conversations, id: :uuid do |t|
      t.references :person, type: :uuid, null: false, foreign_key: true
      t.references :front_conversation, type: :uuid, null: false, foreign_key: true

      t.timestamps

      # One entry per person-conversation pair
      t.index [ :person_id, :front_conversation_id ], unique: true, name: 'idx_person_front_conversation'
      t.index :front_conversation_id, name: 'idx_people_front_convs_on_conv_id'
    end
  end
end
