class CreateFrontConversations < ActiveRecord::Migration[8.0]
  def change
    create_table :front_conversations, id: :uuid do |t|
      t.string :front_id, null: false
      t.string :subject
      t.string :status
      t.string :status_category
      t.string :status_id
      t.boolean :is_private, default: false
      t.decimal :created_at_timestamp, precision: 15, scale: 3
      t.decimal :waiting_since_timestamp, precision: 15, scale: 3
      t.jsonb :custom_fields, default: {}
      t.jsonb :metadata, default: {}
      t.jsonb :links, default: []
      t.jsonb :scheduled_reminders, default: []
      t.jsonb :api_links, default: {}
      t.references :assignee, null: true, foreign_key: { to_table: :users }, type: :uuid
      t.references :recipient_contact, null: true, foreign_key: { to_table: :front_contacts }, type: :uuid

      t.timestamps
    end
    add_index :front_conversations, :front_id, unique: true
    add_index :front_conversations, :status
    add_index :front_conversations, :created_at_timestamp
  end
end
