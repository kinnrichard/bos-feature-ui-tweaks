class CreateFrontSyncLogs < ActiveRecord::Migration[8.0]
  def change
    create_table :front_sync_logs, id: :uuid do |t|
      # Core sync tracking fields
      t.string :resource_type, null: false
      t.string :sync_type, null: false, default: 'full'
      t.string :status, null: false, default: 'running'

      # Timing fields
      t.timestamp :started_at, null: false
      t.timestamp :completed_at
      t.decimal :duration_seconds, precision: 10, scale: 3

      # Record count tracking
      t.integer :records_synced, default: 0
      t.integer :records_created, default: 0
      t.integer :records_updated, default: 0
      t.integer :records_failed, default: 0

      # Error tracking
      t.text :error_messages, array: true, default: []

      # Additional metadata
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    # Indexes for performance
    add_index :front_sync_logs, :resource_type
    add_index :front_sync_logs, :sync_type
    add_index :front_sync_logs, :status
    add_index :front_sync_logs, :started_at
    add_index :front_sync_logs, [ :resource_type, :started_at ]
    add_index :front_sync_logs, :metadata, using: :gin
  end
end
