class AddUuidForeignKeys < ActiveRecord::Migration[8.0]
  def up
    # Add UUID foreign key columns
    add_column :activity_logs, :user_uuid, :uuid
    add_column :activity_logs, :client_uuid, :uuid
    add_column :activity_logs, :job_uuid, :uuid

    add_column :contact_methods, :person_uuid, :uuid

    add_column :devices, :client_uuid, :uuid
    add_column :devices, :person_uuid, :uuid

    add_column :job_assignments, :job_uuid, :uuid
    add_column :job_assignments, :user_uuid, :uuid

    add_column :job_people, :job_uuid, :uuid
    add_column :job_people, :person_uuid, :uuid

    add_column :job_targets, :job_uuid, :uuid

    add_column :jobs, :client_uuid, :uuid
    add_column :jobs, :created_by_uuid, :uuid

    add_column :notes, :user_uuid, :uuid

    add_column :people, :client_uuid, :uuid

    add_column :refresh_tokens, :user_uuid, :uuid

    add_column :scheduled_date_time_users, :scheduled_date_time_uuid, :uuid
    add_column :scheduled_date_time_users, :user_uuid, :uuid

    add_column :task_completions, :task_uuid, :uuid
    add_column :task_completions, :job_target_uuid, :uuid
    add_column :task_completions, :completed_by_uuid, :uuid

    add_column :tasks, :job_uuid, :uuid
    add_column :tasks, :assigned_to_uuid, :uuid
    add_column :tasks, :parent_uuid, :uuid

    # Now populate the UUID foreign keys based on existing relationships
    execute <<-SQL
      -- activity_logs
      UPDATE activity_logs#{' '}
      SET user_uuid = users.uuid#{' '}
      FROM users#{' '}
      WHERE activity_logs.user_id = users.id;

      UPDATE activity_logs#{' '}
      SET client_uuid = clients.uuid#{' '}
      FROM clients#{' '}
      WHERE activity_logs.client_id = clients.id;

      UPDATE activity_logs#{' '}
      SET job_uuid = jobs.uuid#{' '}
      FROM jobs#{' '}
      WHERE activity_logs.job_id = jobs.id;

      -- contact_methods
      UPDATE contact_methods#{' '}
      SET person_uuid = people.uuid#{' '}
      FROM people#{' '}
      WHERE contact_methods.person_id = people.id;

      -- devices
      UPDATE devices#{' '}
      SET client_uuid = clients.uuid#{' '}
      FROM clients#{' '}
      WHERE devices.client_id = clients.id;

      UPDATE devices#{' '}
      SET person_uuid = people.uuid#{' '}
      FROM people#{' '}
      WHERE devices.person_id = people.id;

      -- job_assignments
      UPDATE job_assignments#{' '}
      SET job_uuid = jobs.uuid#{' '}
      FROM jobs#{' '}
      WHERE job_assignments.job_id = jobs.id;

      UPDATE job_assignments#{' '}
      SET user_uuid = users.uuid#{' '}
      FROM users#{' '}
      WHERE job_assignments.user_id = users.id;

      -- job_people
      UPDATE job_people#{' '}
      SET job_uuid = jobs.uuid#{' '}
      FROM jobs#{' '}
      WHERE job_people.job_id = jobs.id;

      UPDATE job_people#{' '}
      SET person_uuid = people.uuid#{' '}
      FROM people#{' '}
      WHERE job_people.person_id = people.id;

      -- job_targets
      UPDATE job_targets#{' '}
      SET job_uuid = jobs.uuid#{' '}
      FROM jobs#{' '}
      WHERE job_targets.job_id = jobs.id;

      -- jobs
      UPDATE jobs#{' '}
      SET client_uuid = clients.uuid#{' '}
      FROM clients#{' '}
      WHERE jobs.client_id = clients.id;

      UPDATE jobs#{' '}
      SET created_by_uuid = users.uuid#{' '}
      FROM users#{' '}
      WHERE jobs.created_by_id = users.id;

      -- notes
      UPDATE notes#{' '}
      SET user_uuid = users.uuid#{' '}
      FROM users#{' '}
      WHERE notes.user_id = users.id;

      -- people
      UPDATE people#{' '}
      SET client_uuid = clients.uuid#{' '}
      FROM clients#{' '}
      WHERE people.client_id = clients.id;

      -- refresh_tokens
      UPDATE refresh_tokens#{' '}
      SET user_uuid = users.uuid#{' '}
      FROM users#{' '}
      WHERE refresh_tokens.user_id = users.id;

      -- scheduled_date_time_users
      UPDATE scheduled_date_time_users#{' '}
      SET scheduled_date_time_uuid = scheduled_date_times.uuid#{' '}
      FROM scheduled_date_times#{' '}
      WHERE scheduled_date_time_users.scheduled_date_time_id = scheduled_date_times.id;

      UPDATE scheduled_date_time_users#{' '}
      SET user_uuid = users.uuid#{' '}
      FROM users#{' '}
      WHERE scheduled_date_time_users.user_id = users.id;

      -- task_completions
      UPDATE task_completions#{' '}
      SET task_uuid = tasks.uuid#{' '}
      FROM tasks#{' '}
      WHERE task_completions.task_id = tasks.id;

      UPDATE task_completions#{' '}
      SET job_target_uuid = job_targets.uuid#{' '}
      FROM job_targets#{' '}
      WHERE task_completions.job_target_id = job_targets.id;

      UPDATE task_completions#{' '}
      SET completed_by_uuid = users.uuid#{' '}
      FROM users#{' '}
      WHERE task_completions.completed_by_id = users.id;

      -- tasks
      UPDATE tasks#{' '}
      SET job_uuid = jobs.uuid#{' '}
      FROM jobs#{' '}
      WHERE tasks.job_id = jobs.id;

      UPDATE tasks#{' '}
      SET assigned_to_uuid = users.uuid#{' '}
      FROM users#{' '}
      WHERE tasks.assigned_to_id = users.id;

      UPDATE tasks#{' '}
      SET parent_uuid = parent_tasks.uuid#{' '}
      FROM tasks parent_tasks#{' '}
      WHERE tasks.parent_id = parent_tasks.id;
    SQL

    # Add indexes for UUID foreign keys
    add_index :activity_logs, :user_uuid
    add_index :activity_logs, :client_uuid
    add_index :activity_logs, :job_uuid

    add_index :contact_methods, :person_uuid

    add_index :devices, :client_uuid
    add_index :devices, :person_uuid

    add_index :job_assignments, :job_uuid
    add_index :job_assignments, :user_uuid

    add_index :job_people, :job_uuid
    add_index :job_people, :person_uuid

    add_index :job_targets, :job_uuid

    add_index :jobs, :client_uuid
    add_index :jobs, :created_by_uuid

    add_index :notes, :user_uuid

    add_index :people, :client_uuid

    add_index :refresh_tokens, :user_uuid

    add_index :scheduled_date_time_users, :scheduled_date_time_uuid
    add_index :scheduled_date_time_users, :user_uuid

    add_index :task_completions, :task_uuid
    add_index :task_completions, :job_target_uuid
    add_index :task_completions, :completed_by_uuid

    add_index :tasks, :job_uuid
    add_index :tasks, :assigned_to_uuid
    add_index :tasks, :parent_uuid
  end

  def down
    # Remove indexes
    remove_index :activity_logs, :user_uuid
    remove_index :activity_logs, :client_uuid
    remove_index :activity_logs, :job_uuid
    remove_index :contact_methods, :person_uuid
    remove_index :devices, :client_uuid
    remove_index :devices, :person_uuid
    remove_index :job_assignments, :job_uuid
    remove_index :job_assignments, :user_uuid
    remove_index :job_people, :job_uuid
    remove_index :job_people, :person_uuid
    remove_index :job_targets, :job_uuid
    remove_index :jobs, :client_uuid
    remove_index :jobs, :created_by_uuid
    remove_index :notes, :user_uuid
    remove_index :people, :client_uuid
    remove_index :refresh_tokens, :user_uuid
    remove_index :scheduled_date_time_users, :scheduled_date_time_uuid
    remove_index :scheduled_date_time_users, :user_uuid
    remove_index :task_completions, :task_uuid
    remove_index :task_completions, :job_target_uuid
    remove_index :task_completions, :completed_by_uuid
    remove_index :tasks, :job_uuid
    remove_index :tasks, :assigned_to_uuid
    remove_index :tasks, :parent_uuid

    # Remove columns
    remove_column :activity_logs, :user_uuid
    remove_column :activity_logs, :client_uuid
    remove_column :activity_logs, :job_uuid
    remove_column :contact_methods, :person_uuid
    remove_column :devices, :client_uuid
    remove_column :devices, :person_uuid
    remove_column :job_assignments, :job_uuid
    remove_column :job_assignments, :user_uuid
    remove_column :job_people, :job_uuid
    remove_column :job_people, :person_uuid
    remove_column :job_targets, :job_uuid
    remove_column :jobs, :client_uuid
    remove_column :jobs, :created_by_uuid
    remove_column :notes, :user_uuid
    remove_column :people, :client_uuid
    remove_column :refresh_tokens, :user_uuid
    remove_column :scheduled_date_time_users, :scheduled_date_time_uuid
    remove_column :scheduled_date_time_users, :user_uuid
    remove_column :task_completions, :task_uuid
    remove_column :task_completions, :job_target_uuid
    remove_column :task_completions, :completed_by_uuid
    remove_column :tasks, :job_uuid
    remove_column :tasks, :assigned_to_uuid
    remove_column :tasks, :parent_uuid
  end
end
