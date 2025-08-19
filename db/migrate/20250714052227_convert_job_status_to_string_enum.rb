class ConvertJobStatusToStringEnum < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Add temporary string column
    add_column :jobs, :status_str, :string

    # Step 2: Populate string values based on integer mapping
    # Maps: 0 -> open, 1 -> in_progress, 2 -> paused, 3 -> waiting_for_customer,
    #       4 -> waiting_for_scheduled_appointment, 5 -> successfully_completed, 6 -> cancelled
    execute <<-SQL
      UPDATE jobs#{' '}
      SET status_str = CASE#{' '}
        WHEN status = 0 THEN 'open'
        WHEN status = 1 THEN 'in_progress'
        WHEN status = 2 THEN 'paused'
        WHEN status = 3 THEN 'waiting_for_customer'
        WHEN status = 4 THEN 'waiting_for_scheduled_appointment'
        WHEN status = 5 THEN 'successfully_completed'
        WHEN status = 6 THEN 'cancelled'
        ELSE NULL
      END
    SQL

    # Step 3: Verify all rows were converted successfully
    unmapped_count = execute("SELECT COUNT(*) FROM jobs WHERE status_str IS NULL").first['count'].to_i
    if unmapped_count > 0
      raise "Migration failed: #{unmapped_count} job status values could not be converted. " \
            "Check for unexpected enum values in the jobs table."
    end

    # Step 4: Drop old integer column and rename new string column
    remove_column :jobs, :status
    rename_column :jobs, :status_str, :status

    # Step 5: Add NOT NULL constraint (matching original column)
    change_column_null :jobs, :status, false

    puts "✅ Successfully converted #{execute('SELECT COUNT(*) FROM jobs').first['count']} job status records to string enum"
    puts "   open: #{execute("SELECT COUNT(*) FROM jobs WHERE status = 'open'").first['count']} records"
    puts "   in_progress: #{execute("SELECT COUNT(*) FROM jobs WHERE status = 'in_progress'").first['count']} records"
    puts "   paused: #{execute("SELECT COUNT(*) FROM jobs WHERE status = 'paused'").first['count']} records"
    puts "   waiting_for_customer: #{execute("SELECT COUNT(*) FROM jobs WHERE status = 'waiting_for_customer'").first['count']} records"
    puts "   waiting_for_scheduled_appointment: #{execute("SELECT COUNT(*) FROM jobs WHERE status = 'waiting_for_scheduled_appointment'").first['count']} records"
    puts "   successfully_completed: #{execute("SELECT COUNT(*) FROM jobs WHERE status = 'successfully_completed'").first['count']} records"
    puts "   cancelled: #{execute("SELECT COUNT(*) FROM jobs WHERE status = 'cancelled'").first['count']} records"
  end

  def down
    # Reverse migration: convert string back to integer values
    add_column :jobs, :status_int, :integer

    execute <<-SQL
      UPDATE jobs#{' '}
      SET status_int = CASE#{' '}
        WHEN status = 'open' THEN 0
        WHEN status = 'in_progress' THEN 1
        WHEN status = 'paused' THEN 2
        WHEN status = 'waiting_for_customer' THEN 3
        WHEN status = 'waiting_for_scheduled_appointment' THEN 4
        WHEN status = 'successfully_completed' THEN 5
        WHEN status = 'cancelled' THEN 6
        ELSE NULL
      END
    SQL

    # Verify reverse conversion
    unmapped_count = execute("SELECT COUNT(*) FROM jobs WHERE status_int IS NULL").first['count'].to_i
    if unmapped_count > 0
      raise "Rollback failed: #{unmapped_count} job status values could not be converted back to integers."
    end

    remove_column :jobs, :status
    rename_column :jobs, :status_int, :status
    change_column_null :jobs, :status, false

    puts "✅ Successfully rolled back job status to integer enum"
  end
end
