class CreateFrontTeammates < ActiveRecord::Migration[8.0]
  def change
    create_table :front_teammates, id: :uuid do |t|
      t.string :front_id, null: false
      t.string :email
      t.string :username
      t.string :first_name
      t.string :last_name
      t.boolean :is_admin, default: false
      t.boolean :is_available, default: true
      t.boolean :is_blocked, default: false
      t.string :teammate_type
      t.jsonb :custom_fields, default: {}
      t.jsonb :api_links, default: {}
      t.float :created_at_timestamp
      t.float :updated_at_timestamp

      t.timestamps
    end
    add_index :front_teammates, :front_id, unique: true
    add_index :front_teammates, :email
  end
end
