class AddUuidToAllTables < ActiveRecord::Migration[8.0]
  def up
    # List of all application tables (excluding schema_migrations and ar_internal_metadata)
    tables = %w[
      activity_logs
      clients
      contact_methods
      devices
      job_assignments
      job_people
      job_targets
      jobs
      notes
      people
      refresh_tokens
      scheduled_date_time_users
      scheduled_date_times
      task_completions
      tasks
      unique_ids
      users
    ]

    # Add UUID column to each table
    tables.each do |table|
      add_column table, :uuid, :uuid, default: 'gen_random_uuid()', null: false
      add_index table, :uuid, unique: true
    end

    # Special handling for Solid suite tables (if they exist and we want to migrate them)
    solid_tables = %w[
      solid_cable_messages
      solid_cache_entries
      solid_queue_blocked_executions
      solid_queue_claimed_executions
      solid_queue_failed_executions
      solid_queue_jobs
      solid_queue_pauses
      solid_queue_processes
      solid_queue_ready_executions
      solid_queue_recurring_executions
      solid_queue_recurring_tasks
      solid_queue_scheduled_executions
      solid_queue_semaphores
    ]

    solid_tables.each do |table|
      if table_exists?(table)
        add_column table, :uuid, :uuid, default: 'gen_random_uuid()', null: false
        add_index table, :uuid, unique: true
      end
    end
  end

  def down
    # List all tables
    tables = %w[
      activity_logs
      clients
      contact_methods
      devices
      job_assignments
      job_people
      job_targets
      jobs
      notes
      people
      refresh_tokens
      scheduled_date_time_users
      scheduled_date_times
      task_completions
      tasks
      unique_ids
      users
    ]

    tables.each do |table|
      remove_column table, :uuid if column_exists?(table, :uuid)
    end

    # Remove from Solid tables
    solid_tables = %w[
      solid_cable_messages
      solid_cache_entries
      solid_queue_blocked_executions
      solid_queue_claimed_executions
      solid_queue_failed_executions
      solid_queue_jobs
      solid_queue_pauses
      solid_queue_processes
      solid_queue_ready_executions
      solid_queue_recurring_executions
      solid_queue_recurring_tasks
      solid_queue_scheduled_executions
      solid_queue_semaphores
    ]

    solid_tables.each do |table|
      if table_exists?(table) && column_exists?(table, :uuid)
        remove_column table, :uuid
      end
    end
  end
end
