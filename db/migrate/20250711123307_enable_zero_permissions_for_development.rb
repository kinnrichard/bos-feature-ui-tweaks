class EnableZeroPermissionsForDevelopment < ActiveRecord::Migration[8.0]
  def up
    # Only enable in development environment
    return unless Rails.env.development?

    # Get all table names from the schema
    tables = %w[
      clients
      users
      people
      contact_methods
      devices
      jobs
      tasks
      notes
      activity_logs
      scheduled_date_times
      scheduled_date_time_users
      job_assignments
      job_people
      job_targets
      task_completions
    ]

    tables.each do |table_name|
      # Skip if table doesn't exist
      next unless connection.table_exists?(table_name)

      puts "Setting up Zero permissions for table: #{table_name}"

      # Enable Row Level Security
      execute "ALTER TABLE #{table_name} ENABLE ROW LEVEL SECURITY;"

      # Create ANYONE_CAN policy for SELECT (read access)
      execute <<-SQL
        CREATE POLICY #{table_name}_anyone_can_select ON #{table_name}
        FOR SELECT
        USING (true);
      SQL

      # Create ANYONE_CAN policy for INSERT (create access)
      execute <<-SQL
        CREATE POLICY #{table_name}_anyone_can_insert ON #{table_name}
        FOR INSERT
        WITH CHECK (true);
      SQL

      # Create ANYONE_CAN policy for UPDATE (update access)
      execute <<-SQL
        CREATE POLICY #{table_name}_anyone_can_update ON #{table_name}
        FOR UPDATE
        USING (true);
      SQL

      # Create ANYONE_CAN policy for DELETE (delete access)
      execute <<-SQL
        CREATE POLICY #{table_name}_anyone_can_delete ON #{table_name}
        FOR DELETE
        USING (true);
      SQL
    end

    puts "✅ Zero permissions enabled for development environment"
  end

  def down
    # Only disable in development environment
    return unless Rails.env.development?

    tables = %w[
      clients
      users
      people
      contact_methods
      devices
      jobs
      tasks
      notes
      activity_logs
      scheduled_date_times
      scheduled_date_time_users
      job_assignments
      job_people
      job_targets
      task_completions
    ]

    tables.each do |table_name|
      # Skip if table doesn't exist
      next unless connection.table_exists?(table_name)

      puts "Removing Zero permissions for table: #{table_name}"

      # Drop policies
      execute "DROP POLICY IF EXISTS #{table_name}_anyone_can_select ON #{table_name};"
      execute "DROP POLICY IF EXISTS #{table_name}_anyone_can_insert ON #{table_name};"
      execute "DROP POLICY IF EXISTS #{table_name}_anyone_can_update ON #{table_name};"
      execute "DROP POLICY IF EXISTS #{table_name}_anyone_can_delete ON #{table_name};"

      # Disable Row Level Security
      execute "ALTER TABLE #{table_name} DISABLE ROW LEVEL SECURITY;"
    end

    puts "✅ Zero permissions disabled for development environment"
  end
end
