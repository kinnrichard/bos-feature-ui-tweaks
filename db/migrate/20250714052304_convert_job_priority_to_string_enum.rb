class ConvertJobPriorityToStringEnum < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Add temporary string column
    add_column :jobs, :priority_str, :string

    # Step 2: Populate string values based on integer mapping
    # Maps: 0 -> critical, 1 -> high, 2 -> normal, 3 -> low, 4 -> proactive_followup
    execute <<-SQL
      UPDATE jobs#{' '}
      SET priority_str = CASE#{' '}
        WHEN priority = 0 THEN 'critical'
        WHEN priority = 1 THEN 'high'
        WHEN priority = 2 THEN 'normal'
        WHEN priority = 3 THEN 'low'
        WHEN priority = 4 THEN 'proactive_followup'
        ELSE NULL
      END
    SQL

    # Step 3: Verify all rows were converted successfully
    unmapped_count = execute("SELECT COUNT(*) FROM jobs WHERE priority_str IS NULL").first['count'].to_i
    if unmapped_count > 0
      raise "Migration failed: #{unmapped_count} job priority values could not be converted. " \
            "Check for unexpected enum values in the jobs table."
    end

    # Step 4: Drop old integer column and rename new string column
    remove_column :jobs, :priority
    rename_column :jobs, :priority_str, :priority

    # Step 5: Add NOT NULL constraint (matching original column)
    change_column_null :jobs, :priority, false

    puts "✅ Successfully converted #{execute('SELECT COUNT(*) FROM jobs').first['count']} job priority records to string enum"
    puts "   critical: #{execute("SELECT COUNT(*) FROM jobs WHERE priority = 'critical'").first['count']} records"
    puts "   high: #{execute("SELECT COUNT(*) FROM jobs WHERE priority = 'high'").first['count']} records"
    puts "   normal: #{execute("SELECT COUNT(*) FROM jobs WHERE priority = 'normal'").first['count']} records"
    puts "   low: #{execute("SELECT COUNT(*) FROM jobs WHERE priority = 'low'").first['count']} records"
    puts "   proactive_followup: #{execute("SELECT COUNT(*) FROM jobs WHERE priority = 'proactive_followup'").first['count']} records"
  end

  def down
    # Reverse migration: convert string back to integer values
    add_column :jobs, :priority_int, :integer

    execute <<-SQL
      UPDATE jobs#{' '}
      SET priority_int = CASE#{' '}
        WHEN priority = 'critical' THEN 0
        WHEN priority = 'high' THEN 1
        WHEN priority = 'normal' THEN 2
        WHEN priority = 'low' THEN 3
        WHEN priority = 'proactive_followup' THEN 4
        ELSE NULL
      END
    SQL

    # Verify reverse conversion
    unmapped_count = execute("SELECT COUNT(*) FROM jobs WHERE priority_int IS NULL").first['count'].to_i
    if unmapped_count > 0
      raise "Rollback failed: #{unmapped_count} job priority values could not be converted back to integers."
    end

    remove_column :jobs, :priority
    rename_column :jobs, :priority_int, :priority
    change_column_null :jobs, :priority, false

    puts "✅ Successfully rolled back job priority to integer enum"
  end
end
