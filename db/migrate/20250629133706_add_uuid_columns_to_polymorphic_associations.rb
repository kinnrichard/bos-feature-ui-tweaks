class AddUuidColumnsToPolymorphicAssociations < ActiveRecord::Migration[8.0]
  def change
    # Add UUID columns for polymorphic associations

    # activity_logs table
    add_column :activity_logs, :loggable_uuid, :uuid
    add_index :activity_logs, :loggable_uuid
    add_index :activity_logs, [ :loggable_type, :loggable_uuid ], name: 'index_activity_logs_on_loggable_type_and_uuid'

    # job_targets table
    add_column :job_targets, :target_uuid, :uuid
    add_index :job_targets, :target_uuid
    add_index :job_targets, [ :target_type, :target_uuid ], name: 'index_job_targets_on_target_type_and_uuid'

    # notes table
    add_column :notes, :notable_uuid, :uuid
    add_index :notes, :notable_uuid
    add_index :notes, [ :notable_type, :notable_uuid ], name: 'index_notes_on_notable_type_and_uuid'

    # scheduled_date_times table
    add_column :scheduled_date_times, :schedulable_uuid, :uuid
    add_index :scheduled_date_times, :schedulable_uuid
    add_index :scheduled_date_times, [ :schedulable_type, :schedulable_uuid ], name: 'index_scheduled_date_times_on_schedulable_type_and_uuid'
  end
end
