class ConvertClientTypeToIntegerEnum < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Add temporary integer column
    add_column :clients, :client_type_int, :integer

    # Step 2: Populate integer values based on string mapping
    # Maps: residential -> 0, business -> 1
    execute <<-SQL
      UPDATE clients#{' '}
      SET client_type_int = CASE#{' '}
        WHEN client_type = 'residential' THEN 0
        WHEN client_type = 'business' THEN 1
        ELSE NULL
      END
    SQL

    # Step 3: Verify all rows were converted successfully
    unmapped_count = execute("SELECT COUNT(*) FROM clients WHERE client_type_int IS NULL").first['count'].to_i
    if unmapped_count > 0
      raise "Migration failed: #{unmapped_count} client_type values could not be converted. " \
            "Check for unexpected enum values in the clients table."
    end

    # Step 4: Drop old string column and rename new integer column
    remove_column :clients, :client_type
    rename_column :clients, :client_type_int, :client_type

    # Step 5: Add NOT NULL constraint (matching original column)
    change_column_null :clients, :client_type, false

    puts "✅ Successfully converted #{execute('SELECT COUNT(*) FROM clients').first['count']} client records"
    puts "   residential: #{execute("SELECT COUNT(*) FROM clients WHERE client_type = 0").first['count']} records"
    puts "   business: #{execute("SELECT COUNT(*) FROM clients WHERE client_type = 1").first['count']} records"
  end

  def down
    # Reverse migration: convert integer back to string values
    add_column :clients, :client_type_str, :string

    execute <<-SQL
      UPDATE clients#{' '}
      SET client_type_str = CASE#{' '}
        WHEN client_type = 0 THEN 'residential'
        WHEN client_type = 1 THEN 'business'
        ELSE NULL
      END
    SQL

    # Verify reverse conversion
    unmapped_count = execute("SELECT COUNT(*) FROM clients WHERE client_type_str IS NULL").first['count'].to_i
    if unmapped_count > 0
      raise "Rollback failed: #{unmapped_count} client_type values could not be converted back to strings."
    end

    remove_column :clients, :client_type
    rename_column :clients, :client_type_str, :client_type
    change_column_null :clients, :client_type, false

    puts "✅ Successfully rolled back client_type to string enum"
  end
end
