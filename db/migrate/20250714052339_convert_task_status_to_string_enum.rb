class ConvertTaskStatusToStringEnum < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Add temporary string column
    add_column :tasks, :status_str, :string

    # Step 2: Populate string values based on integer mapping
    # Maps: 0 -> new_task, 1 -> in_progress, 2 -> paused, 3 -> successfully_completed, 4 -> cancelled
    execute <<-SQL
      UPDATE tasks#{' '}
      SET status_str = CASE#{' '}
        WHEN status = 0 THEN 'new_task'
        WHEN status = 1 THEN 'in_progress'
        WHEN status = 2 THEN 'paused'
        WHEN status = 3 THEN 'successfully_completed'
        WHEN status = 4 THEN 'cancelled'
        ELSE NULL
      END
    SQL

    # Step 3: Verify all rows were converted successfully
    unmapped_count = execute("SELECT COUNT(*) FROM tasks WHERE status_str IS NULL").first['count'].to_i
    if unmapped_count > 0
      raise "Migration failed: #{unmapped_count} task status values could not be converted. " \
            "Check for unexpected enum values in the tasks table."
    end

    # Step 4: Drop old integer column and rename new string column
    remove_column :tasks, :status
    rename_column :tasks, :status_str, :status

    # Step 5: Add NOT NULL constraint (matching original column)
    change_column_null :tasks, :status, false

    puts "✅ Successfully converted #{execute('SELECT COUNT(*) FROM tasks').first['count']} task status records to string enum"
    puts "   new_task: #{execute("SELECT COUNT(*) FROM tasks WHERE status = 'new_task'").first['count']} records"
    puts "   in_progress: #{execute("SELECT COUNT(*) FROM tasks WHERE status = 'in_progress'").first['count']} records"
    puts "   paused: #{execute("SELECT COUNT(*) FROM tasks WHERE status = 'paused'").first['count']} records"
    puts "   successfully_completed: #{execute("SELECT COUNT(*) FROM tasks WHERE status = 'successfully_completed'").first['count']} records"
    puts "   cancelled: #{execute("SELECT COUNT(*) FROM tasks WHERE status = 'cancelled'").first['count']} records"
  end

  def down
    # Reverse migration: convert string back to integer values
    add_column :tasks, :status_int, :integer

    execute <<-SQL
      UPDATE tasks#{' '}
      SET status_int = CASE#{' '}
        WHEN status = 'new_task' THEN 0
        WHEN status = 'in_progress' THEN 1
        WHEN status = 'paused' THEN 2
        WHEN status = 'successfully_completed' THEN 3
        WHEN status = 'cancelled' THEN 4
        ELSE NULL
      END
    SQL

    # Verify reverse conversion
    unmapped_count = execute("SELECT COUNT(*) FROM tasks WHERE status_int IS NULL").first['count'].to_i
    if unmapped_count > 0
      raise "Rollback failed: #{unmapped_count} task status values could not be converted back to integers."
    end

    remove_column :tasks, :status
    rename_column :tasks, :status_int, :status
    change_column_null :tasks, :status, false

    puts "✅ Successfully rolled back task status to integer enum"
  end
end
