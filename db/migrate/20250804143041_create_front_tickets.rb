class CreateFrontTickets < ActiveRecord::Migration[8.0]
  def change
    create_table :front_tickets, id: :uuid do |t|
      t.string :front_id
      t.string :ticket_id
      t.string :subject
      t.string :status
      t.string :status_category
      t.string :status_id
      t.decimal :created_at_timestamp, precision: 15, scale: 3
      t.decimal :updated_at_timestamp, precision: 15, scale: 3
      t.jsonb :custom_fields
      t.jsonb :metadata
      t.jsonb :api_links

      t.timestamps
    end
    add_index :front_tickets, :front_id, unique: true
  end
end
