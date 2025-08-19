class CreateFrontInboxes < ActiveRecord::Migration[8.0]
  def change
    create_table :front_inboxes, id: :uuid do |t|
      t.string :front_id, null: false
      t.string :name, null: false
      t.string :inbox_type
      t.string :handle
      t.jsonb :settings, default: {}
      t.jsonb :api_links, default: {}

      t.timestamps
    end
    add_index :front_inboxes, :front_id, unique: true
    add_index :front_inboxes, :name
    add_index :front_inboxes, :handle
  end
end
