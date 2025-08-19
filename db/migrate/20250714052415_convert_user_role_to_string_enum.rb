class ConvertUserRoleToStringEnum < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Add temporary string column
    add_column :users, :role_str, :string

    # Step 2: Populate string values based on integer mapping
    # Maps: 0 -> admin, 1 -> technician, 2 -> customer_specialist, 3 -> owner
    execute <<-SQL
      UPDATE users#{' '}
      SET role_str = CASE#{' '}
        WHEN role = 0 THEN 'admin'
        WHEN role = 1 THEN 'technician'
        WHEN role = 2 THEN 'customer_specialist'
        WHEN role = 3 THEN 'owner'
        ELSE NULL
      END
    SQL

    # Step 3: Verify all rows were converted successfully
    unmapped_count = execute("SELECT COUNT(*) FROM users WHERE role_str IS NULL").first['count'].to_i
    if unmapped_count > 0
      raise "Migration failed: #{unmapped_count} user role values could not be converted. " \
            "Check for unexpected enum values in the users table."
    end

    # Step 4: Drop old integer column and rename new string column
    remove_column :users, :role
    rename_column :users, :role_str, :role

    # Step 5: Add NOT NULL constraint (matching original column)
    change_column_null :users, :role, false

    puts "✅ Successfully converted #{execute('SELECT COUNT(*) FROM users').first['count']} user role records to string enum"
    puts "   admin: #{execute("SELECT COUNT(*) FROM users WHERE role = 'admin'").first['count']} records"
    puts "   technician: #{execute("SELECT COUNT(*) FROM users WHERE role = 'technician'").first['count']} records"
    puts "   customer_specialist: #{execute("SELECT COUNT(*) FROM users WHERE role = 'customer_specialist'").first['count']} records"
    puts "   owner: #{execute("SELECT COUNT(*) FROM users WHERE role = 'owner'").first['count']} records"
  end

  def down
    # Reverse migration: convert string back to integer values
    add_column :users, :role_int, :integer

    execute <<-SQL
      UPDATE users#{' '}
      SET role_int = CASE#{' '}
        WHEN role = 'admin' THEN 0
        WHEN role = 'technician' THEN 1
        WHEN role = 'customer_specialist' THEN 2
        WHEN role = 'owner' THEN 3
        ELSE NULL
      END
    SQL

    # Verify reverse conversion
    unmapped_count = execute("SELECT COUNT(*) FROM users WHERE role_int IS NULL").first['count'].to_i
    if unmapped_count > 0
      raise "Rollback failed: #{unmapped_count} user role values could not be converted back to integers."
    end

    remove_column :users, :role
    rename_column :users, :role_int, :role
    change_column_null :users, :role, false

    puts "✅ Successfully rolled back user role to integer enum"
  end
end
