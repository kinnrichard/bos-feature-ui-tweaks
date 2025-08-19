class EnableZeroPermissionsForFrontTables < ActiveRecord::Migration[8.0]
  def up
    # Only enable in development environment
    return unless Rails.env.development?

    # All Front-related tables that need Zero permissions
    tables = %w[
      front_contacts
      front_tags
      front_inboxes
      front_conversations
      front_messages
      front_attachments
      front_conversation_tags
      front_message_recipients
      front_conversation_inboxes
      front_sync_logs
      front_teammates
      front_tickets
      front_conversation_tickets
    ]

    tables.each do |table_name|
      next unless connection.table_exists?(table_name)

      puts "Setting up Zero permissions for table: #{table_name}"

      # Enable Row Level Security
      execute "ALTER TABLE #{table_name} ENABLE ROW LEVEL SECURITY;"

      # Create ANYONE_CAN policies for all operations
      execute <<-SQL
        CREATE POLICY #{table_name}_anyone_can_select ON #{table_name}
        FOR SELECT USING (true);
      SQL

      execute <<-SQL
        CREATE POLICY #{table_name}_anyone_can_insert ON #{table_name}
        FOR INSERT WITH CHECK (true);
      SQL

      execute <<-SQL
        CREATE POLICY #{table_name}_anyone_can_update ON #{table_name}
        FOR UPDATE USING (true);
      SQL

      execute <<-SQL
        CREATE POLICY #{table_name}_anyone_can_delete ON #{table_name}
        FOR DELETE USING (true);
      SQL
    end

    puts "✅ Zero permissions enabled for Front tables"
  end

  def down
    return unless Rails.env.development?

    tables = %w[
      front_contacts
      front_tags
      front_inboxes
      front_conversations
      front_messages
      front_attachments
      front_conversation_tags
      front_message_recipients
      front_conversation_inboxes
      front_sync_logs
      front_teammates
      front_tickets
      front_conversation_tickets
    ]

    tables.each do |table_name|
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

    puts "✅ Zero permissions disabled for Front tables"
  end
end
