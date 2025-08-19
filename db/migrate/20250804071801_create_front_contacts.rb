class CreateFrontContacts < ActiveRecord::Migration[8.0]
  def change
    create_table :front_contacts, id: :uuid do |t|
      t.string :front_id, null: true  # Can be null if no unified Front contact
      t.string :name
      t.string :handle  # Primary email/phone
      t.string :role  # 'from', 'to', 'cc', etc.
      t.jsonb :handles, default: []  # Array of all contact methods
      t.jsonb :api_links, default: {}

      t.timestamps
    end
    add_index :front_contacts, :front_id, unique: true, where: "front_id IS NOT NULL"
    add_index :front_contacts, :handle
    add_index :front_contacts, :name
  end
end
