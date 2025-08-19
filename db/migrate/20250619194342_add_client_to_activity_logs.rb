class AddClientToActivityLogs < ActiveRecord::Migration[8.0]
  def change
    add_reference :activity_logs, :client, null: true, foreign_key: true
    add_index :activity_logs, [ :client_id, :created_at ]
  end
end
