class ConvertToUuidPrimaryKeys < ActiveRecord::Migration[8.0]
  def up
    # List of tables to convert (excluding ones already using UUID as PK)
    tables_to_convert = %w[
      activity_logs clients contact_methods devices
      job_assignments job_people job_targets jobs notes people
      refresh_tokens scheduled_date_time_users scheduled_date_times
      solid_cable_messages solid_cache_entries solid_queue_blocked_executions
      solid_queue_claimed_executions solid_queue_failed_executions solid_queue_jobs
      solid_queue_pauses solid_queue_processes solid_queue_ready_executions
      solid_queue_recurring_executions solid_queue_recurring_tasks
      solid_queue_scheduled_executions solid_queue_semaphores
      task_completions tasks unique_ids users
    ]

    # Step 1: Remove all foreign key constraints that reference the old integer IDs
    remove_foreign_keys

    # Step 2: Update polymorphic associations to use UUID columns
    update_polymorphic_associations

    # Step 3: Convert each table's primary key from integer to UUID
    tables_to_convert.each do |table_name|
      convert_table_to_uuid_pk(table_name)
    end

    # Step 4: Update foreign key columns to reference UUIDs instead of integer IDs
    update_foreign_key_references

    # Step 5: Remove old integer columns and rename UUID columns (no foreign keys yet)
    tables_to_convert.each do |table_name|
      finalize_table_conversion(table_name)
    end

    # Step 6: Add all foreign key constraints after all tables are converted
    add_all_foreign_keys
  end

  def down
    # This is a destructive migration that can't be easily reversed
    # In a real scenario, you'd want to maintain the old structure for rollback
    raise ActiveRecord::IrreversibleMigration, "Cannot reverse UUID conversion without data loss"
  end

  private

  def remove_foreign_keys
    # Remove all foreign key constraints
    execute <<-SQL
      DO $$
      DECLARE
          r RECORD;
      BEGIN
          FOR r IN (SELECT conname, conrelid::regclass as table_name#{' '}
                   FROM pg_constraint#{' '}
                   WHERE contype = 'f'#{' '}
                   AND connamespace = 'public'::regnamespace)#{' '}
          LOOP
              EXECUTE 'ALTER TABLE ' || r.table_name || ' DROP CONSTRAINT ' || r.conname;
          END LOOP;
      END $$;
    SQL
  end

  def update_polymorphic_associations
    # Update activity_logs polymorphic association
    execute "UPDATE activity_logs SET loggable_uuid = (SELECT uuid FROM jobs WHERE jobs.id = activity_logs.loggable_id) WHERE loggable_type = 'Job'"
    execute "UPDATE activity_logs SET loggable_uuid = (SELECT uuid FROM clients WHERE clients.id = activity_logs.loggable_id) WHERE loggable_type = 'Client'"

    # Update notes polymorphic association
    execute "UPDATE notes SET notable_uuid = (SELECT uuid FROM jobs WHERE jobs.id = notes.notable_id) WHERE notable_type = 'Job'"
    execute "UPDATE notes SET notable_uuid = (SELECT uuid FROM clients WHERE clients.id = notes.notable_id) WHERE notable_type = 'Client'"

    # Update scheduled_date_times polymorphic association
    execute "UPDATE scheduled_date_times SET schedulable_uuid = (SELECT uuid FROM jobs WHERE jobs.id = scheduled_date_times.schedulable_id) WHERE schedulable_type = 'Job'"

    # Update job_targets polymorphic association
    execute "UPDATE job_targets SET target_uuid = (SELECT uuid FROM people WHERE people.id = job_targets.target_id) WHERE target_type = 'Person'"
    execute "UPDATE job_targets SET target_uuid = (SELECT uuid FROM devices WHERE devices.id = job_targets.target_id) WHERE target_type = 'Device'"
  end

  def convert_table_to_uuid_pk(table_name)
    # Add a temporary UUID column if it doesn't exist
    unless column_exists?(table_name, :uuid)
      add_column table_name, :uuid, :uuid, default: 'gen_random_uuid()', null: false
      add_index table_name, :uuid, unique: true
    end

    # Ensure all UUID values are populated
    execute "UPDATE #{table_name} SET uuid = gen_random_uuid() WHERE uuid IS NULL"
  end

  def update_foreign_key_references
    # Update all foreign key references to use UUID values
    foreign_key_mappings = {
      # activity_logs
      'activity_logs' => {
        'user_uuid' => 'SELECT uuid FROM users WHERE users.id = activity_logs.user_id',
        'client_uuid' => 'SELECT uuid FROM clients WHERE clients.id = activity_logs.client_id',
        'job_uuid' => 'SELECT uuid FROM jobs WHERE jobs.id = activity_logs.job_id'
      },
      # contact_methods
      'contact_methods' => {
        'person_uuid' => 'SELECT uuid FROM people WHERE people.id = contact_methods.person_id'
      },
      # devices
      'devices' => {
        'client_uuid' => 'SELECT uuid FROM clients WHERE clients.id = devices.client_id',
        'person_uuid' => 'SELECT uuid FROM people WHERE people.id = devices.person_id'
      },
      # job_assignments
      'job_assignments' => {
        'job_uuid' => 'SELECT uuid FROM jobs WHERE jobs.id = job_assignments.job_id',
        'user_uuid' => 'SELECT uuid FROM users WHERE users.id = job_assignments.user_id'
      },
      # job_people
      'job_people' => {
        'job_uuid' => 'SELECT uuid FROM jobs WHERE jobs.id = job_people.job_id',
        'person_uuid' => 'SELECT uuid FROM people WHERE people.id = job_people.person_id'
      },
      # job_targets
      'job_targets' => {
        'job_uuid' => 'SELECT uuid FROM jobs WHERE jobs.id = job_targets.job_id'
      },
      # jobs
      'jobs' => {
        'client_uuid' => 'SELECT uuid FROM clients WHERE clients.id = jobs.client_id',
        'created_by_uuid' => 'SELECT uuid FROM users WHERE users.id = jobs.created_by_id'
      },
      # notes
      'notes' => {
        'user_uuid' => 'SELECT uuid FROM users WHERE users.id = notes.user_id'
      },
      # people
      'people' => {
        'client_uuid' => 'SELECT uuid FROM clients WHERE clients.id = people.client_id'
      },
      # refresh_tokens
      'refresh_tokens' => {
        'user_uuid' => 'SELECT uuid FROM users WHERE users.id = refresh_tokens.user_id'
      },
      # scheduled_date_time_users
      'scheduled_date_time_users' => {
        'scheduled_date_time_uuid' => 'SELECT uuid FROM scheduled_date_times WHERE scheduled_date_times.id = scheduled_date_time_users.scheduled_date_time_id',
        'user_uuid' => 'SELECT uuid FROM users WHERE users.id = scheduled_date_time_users.user_id'
      },
      # task_completions
      'task_completions' => {
        'task_uuid' => 'SELECT uuid FROM tasks WHERE tasks.id = task_completions.task_id',
        'job_target_uuid' => 'SELECT uuid FROM job_targets WHERE job_targets.id = task_completions.job_target_id',
        'completed_by_uuid' => 'SELECT uuid FROM users WHERE users.id = task_completions.completed_by_id'
      },
      # tasks
      'tasks' => {
        'job_uuid' => 'SELECT uuid FROM jobs WHERE jobs.id = tasks.job_id',
        'assigned_to_uuid' => 'SELECT uuid FROM users WHERE users.id = tasks.assigned_to_id',
        'parent_uuid' => 'SELECT uuid FROM tasks WHERE tasks.id = tasks.parent_id'
      }
    }

    foreign_key_mappings.each do |table, columns|
      columns.each do |uuid_column, select_query|
        execute "UPDATE #{table} SET #{uuid_column} = (#{select_query}) WHERE #{uuid_column} IS NULL"
      end
    end
  end

  def finalize_table_conversion(table_name)
    # Remove old integer foreign key columns first
    remove_integer_foreign_keys(table_name)

    # Remove the old integer ID column
    if column_exists?(table_name, :id) && column_exists?(table_name, :uuid)
      remove_column table_name, :id
    end

    # Rename uuid column to id and make it the primary key
    if column_exists?(table_name, :uuid)
      rename_column table_name, :uuid, :id
      execute "ALTER TABLE #{table_name} ADD PRIMARY KEY (id)"
    end

    # Rename UUID foreign key columns to standard names (no constraints yet)
    rename_uuid_foreign_keys_only(table_name)
  end

  def add_all_foreign_keys
    # Add all foreign key constraints after all tables are converted
    add_foreign_key "activity_logs", "users", column: "user_id", primary_key: "id"
    add_foreign_key "activity_logs", "clients", column: "client_id", primary_key: "id"
    add_foreign_key "activity_logs", "jobs", column: "job_id", primary_key: "id"

    add_foreign_key "contact_methods", "people", column: "person_id", primary_key: "id"

    add_foreign_key "devices", "clients", column: "client_id", primary_key: "id"
    add_foreign_key "devices", "people", column: "person_id", primary_key: "id"

    add_foreign_key "job_assignments", "jobs", column: "job_id", primary_key: "id"
    add_foreign_key "job_assignments", "users", column: "user_id", primary_key: "id"

    add_foreign_key "job_people", "jobs", column: "job_id", primary_key: "id"
    add_foreign_key "job_people", "people", column: "person_id", primary_key: "id"

    add_foreign_key "job_targets", "jobs", column: "job_id", primary_key: "id"

    add_foreign_key "jobs", "clients", column: "client_id", primary_key: "id"
    add_foreign_key "jobs", "users", column: "created_by_id", primary_key: "id"

    add_foreign_key "notes", "users", column: "user_id", primary_key: "id"

    add_foreign_key "people", "clients", column: "client_id", primary_key: "id"

    add_foreign_key "refresh_tokens", "users", column: "user_id", primary_key: "id"

    add_foreign_key "scheduled_date_time_users", "scheduled_date_times", column: "scheduled_date_time_id", primary_key: "id"
    add_foreign_key "scheduled_date_time_users", "users", column: "user_id", primary_key: "id"

    add_foreign_key "task_completions", "tasks", column: "task_id", primary_key: "id"
    add_foreign_key "task_completions", "job_targets", column: "job_target_id", primary_key: "id"
    add_foreign_key "task_completions", "users", column: "completed_by_id", primary_key: "id"

    add_foreign_key "tasks", "jobs", column: "job_id", primary_key: "id"
    add_foreign_key "tasks", "users", column: "assigned_to_id", primary_key: "id"
    add_foreign_key "tasks", "tasks", column: "parent_id", primary_key: "id"
  end

  def remove_integer_foreign_keys(table_name)
    case table_name
    when 'activity_logs'
      remove_column table_name, :user_id if column_exists?(table_name, :user_id)
      remove_column table_name, :client_id if column_exists?(table_name, :client_id)
      remove_column table_name, :job_id if column_exists?(table_name, :job_id)
      remove_column table_name, :loggable_id if column_exists?(table_name, :loggable_id)
    when 'contact_methods'
      remove_column table_name, :person_id if column_exists?(table_name, :person_id)
    when 'devices'
      remove_column table_name, :client_id if column_exists?(table_name, :client_id)
      remove_column table_name, :person_id if column_exists?(table_name, :person_id)
    when 'job_assignments'
      remove_column table_name, :job_id if column_exists?(table_name, :job_id)
      remove_column table_name, :user_id if column_exists?(table_name, :user_id)
    when 'job_people'
      remove_column table_name, :job_id if column_exists?(table_name, :job_id)
      remove_column table_name, :person_id if column_exists?(table_name, :person_id)
    when 'job_targets'
      remove_column table_name, :job_id if column_exists?(table_name, :job_id)
      remove_column table_name, :target_id if column_exists?(table_name, :target_id)
    when 'jobs'
      remove_column table_name, :client_id if column_exists?(table_name, :client_id)
      remove_column table_name, :created_by_id if column_exists?(table_name, :created_by_id)
    when 'notes'
      remove_column table_name, :user_id if column_exists?(table_name, :user_id)
      remove_column table_name, :notable_id if column_exists?(table_name, :notable_id)
    when 'people'
      remove_column table_name, :client_id if column_exists?(table_name, :client_id)
    when 'refresh_tokens'
      remove_column table_name, :user_id if column_exists?(table_name, :user_id)
    when 'scheduled_date_time_users'
      remove_column table_name, :scheduled_date_time_id if column_exists?(table_name, :scheduled_date_time_id)
      remove_column table_name, :user_id if column_exists?(table_name, :user_id)
    when 'scheduled_date_times'
      remove_column table_name, :schedulable_id if column_exists?(table_name, :schedulable_id)
    when 'task_completions'
      remove_column table_name, :task_id if column_exists?(table_name, :task_id)
      remove_column table_name, :job_target_id if column_exists?(table_name, :job_target_id)
      remove_column table_name, :completed_by_id if column_exists?(table_name, :completed_by_id)
    when 'tasks'
      remove_column table_name, :job_id if column_exists?(table_name, :job_id)
      remove_column table_name, :assigned_to_id if column_exists?(table_name, :assigned_to_id)
      remove_column table_name, :parent_id if column_exists?(table_name, :parent_id)
    end
  end

  def rename_uuid_foreign_keys_only(table_name)
    case table_name
    when 'activity_logs'
      rename_column table_name, :user_uuid, :user_id if column_exists?(table_name, :user_uuid)
      rename_column table_name, :client_uuid, :client_id if column_exists?(table_name, :client_uuid)
      rename_column table_name, :job_uuid, :job_id if column_exists?(table_name, :job_uuid)
      rename_column table_name, :loggable_uuid, :loggable_id if column_exists?(table_name, :loggable_uuid)

    when 'contact_methods'
      rename_column table_name, :person_uuid, :person_id if column_exists?(table_name, :person_uuid)

    when 'devices'
      rename_column table_name, :client_uuid, :client_id if column_exists?(table_name, :client_uuid)
      rename_column table_name, :person_uuid, :person_id if column_exists?(table_name, :person_uuid)

    when 'job_assignments'
      rename_column table_name, :job_uuid, :job_id if column_exists?(table_name, :job_uuid)
      rename_column table_name, :user_uuid, :user_id if column_exists?(table_name, :user_uuid)

    when 'job_people'
      rename_column table_name, :job_uuid, :job_id if column_exists?(table_name, :job_uuid)
      rename_column table_name, :person_uuid, :person_id if column_exists?(table_name, :person_uuid)

    when 'job_targets'
      rename_column table_name, :job_uuid, :job_id if column_exists?(table_name, :job_uuid)
      rename_column table_name, :target_uuid, :target_id if column_exists?(table_name, :target_uuid)

    when 'jobs'
      rename_column table_name, :client_uuid, :client_id if column_exists?(table_name, :client_uuid)
      rename_column table_name, :created_by_uuid, :created_by_id if column_exists?(table_name, :created_by_uuid)

    when 'notes'
      rename_column table_name, :user_uuid, :user_id if column_exists?(table_name, :user_uuid)
      rename_column table_name, :notable_uuid, :notable_id if column_exists?(table_name, :notable_uuid)

    when 'people'
      rename_column table_name, :client_uuid, :client_id if column_exists?(table_name, :client_uuid)

    when 'refresh_tokens'
      rename_column table_name, :user_uuid, :user_id if column_exists?(table_name, :user_uuid)

    when 'scheduled_date_time_users'
      rename_column table_name, :scheduled_date_time_uuid, :scheduled_date_time_id if column_exists?(table_name, :scheduled_date_time_uuid)
      rename_column table_name, :user_uuid, :user_id if column_exists?(table_name, :user_uuid)

    when 'scheduled_date_times'
      rename_column table_name, :schedulable_uuid, :schedulable_id if column_exists?(table_name, :schedulable_uuid)

    when 'task_completions'
      rename_column table_name, :task_uuid, :task_id if column_exists?(table_name, :task_uuid)
      rename_column table_name, :job_target_uuid, :job_target_id if column_exists?(table_name, :job_target_uuid)
      rename_column table_name, :completed_by_uuid, :completed_by_id if column_exists?(table_name, :completed_by_uuid)

    when 'tasks'
      rename_column table_name, :job_uuid, :job_id if column_exists?(table_name, :job_uuid)
      rename_column table_name, :assigned_to_uuid, :assigned_to_id if column_exists?(table_name, :assigned_to_uuid)
      rename_column table_name, :parent_uuid, :parent_id if column_exists?(table_name, :parent_uuid)
    end
  end
end
