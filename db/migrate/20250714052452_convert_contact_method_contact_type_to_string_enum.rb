class ConvertContactMethodContactTypeToStringEnum < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Add temporary string column
    add_column :contact_methods, :contact_type_str, :string

    # Step 2: Populate string values based on integer mapping
    # Maps: 0 -> phone, 1 -> email, 2 -> address
    execute <<-SQL
      UPDATE contact_methods#{' '}
      SET contact_type_str = CASE#{' '}
        WHEN contact_type = 0 THEN 'phone'
        WHEN contact_type = 1 THEN 'email'
        WHEN contact_type = 2 THEN 'address'
        ELSE NULL
      END
    SQL

    # Step 3: Verify all rows were converted successfully
    unmapped_count = execute("SELECT COUNT(*) FROM contact_methods WHERE contact_type_str IS NULL").first['count'].to_i
    if unmapped_count > 0
      raise "Migration failed: #{unmapped_count} contact_type values could not be converted. " \
            "Check for unexpected enum values in the contact_methods table."
    end

    # Step 4: Drop old integer column and rename new string column
    remove_column :contact_methods, :contact_type
    rename_column :contact_methods, :contact_type_str, :contact_type

    # Step 5: Add NOT NULL constraint (matching original column)
    change_column_null :contact_methods, :contact_type, false

    puts "✅ Successfully converted #{execute('SELECT COUNT(*) FROM contact_methods').first['count']} contact_method records to string enum"
    puts "   phone: #{execute("SELECT COUNT(*) FROM contact_methods WHERE contact_type = 'phone'").first['count']} records"
    puts "   email: #{execute("SELECT COUNT(*) FROM contact_methods WHERE contact_type = 'email'").first['count']} records"
    puts "   address: #{execute("SELECT COUNT(*) FROM contact_methods WHERE contact_type = 'address'").first['count']} records"
  end

  def down
    # Reverse migration: convert string back to integer values
    add_column :contact_methods, :contact_type_int, :integer

    execute <<-SQL
      UPDATE contact_methods#{' '}
      SET contact_type_int = CASE#{' '}
        WHEN contact_type = 'phone' THEN 0
        WHEN contact_type = 'email' THEN 1
        WHEN contact_type = 'address' THEN 2
        ELSE NULL
      END
    SQL

    # Verify reverse conversion
    unmapped_count = execute("SELECT COUNT(*) FROM contact_methods WHERE contact_type_int IS NULL").first['count'].to_i
    if unmapped_count > 0
      raise "Rollback failed: #{unmapped_count} contact_type values could not be converted back to integers."
    end

    remove_column :contact_methods, :contact_type
    rename_column :contact_methods, :contact_type_int, :contact_type
    change_column_null :contact_methods, :contact_type, false

    puts "✅ Successfully rolled back contact_method contact_type to integer enum"
  end
end
