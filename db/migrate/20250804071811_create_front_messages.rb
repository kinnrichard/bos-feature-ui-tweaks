class CreateFrontMessages < ActiveRecord::Migration[8.0]
  def change
    create_table :front_messages, id: :uuid do |t|
      t.string :front_id, null: false
      t.references :front_conversation, null: false, foreign_key: true, type: :uuid
      t.string :message_uid
      t.string :message_type
      t.boolean :is_inbound, default: true
      t.boolean :is_draft, default: false
      t.string :subject
      t.text :blurb
      t.text :body_html
      t.text :body_plain
      t.string :error_type
      t.string :draft_mode
      t.jsonb :metadata, default: {}
      t.jsonb :api_links, default: {}
      t.decimal :created_at_timestamp, precision: 15, scale: 3
      t.references :author, null: true, foreign_key: { to_table: :front_contacts }, type: :uuid

      t.timestamps
    end
    add_index :front_messages, :front_id, unique: true
    add_index :front_messages, :message_type
    add_index :front_messages, :created_at_timestamp
  end
end
