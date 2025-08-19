class CreateFrontMessageRecipients < ActiveRecord::Migration[8.0]
  def change
    create_table :front_message_recipients, id: :uuid do |t|
      t.references :front_message, null: false, foreign_key: true, type: :uuid
      t.references :front_contact, null: true, foreign_key: true, type: :uuid  # Can be null if no unified contact
      t.string :role, null: false  # 'from', 'to', 'cc', 'bcc'
      t.string :handle, null: false  # The SPECIFIC email address used
      t.string :name  # Display name at time of message
      t.jsonb :api_links, default: {}

      t.timestamps
    end
    add_index :front_message_recipients, [ :front_message_id, :role ]
    add_index :front_message_recipients, :handle
  end
end
