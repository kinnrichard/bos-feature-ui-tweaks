class ConvertMessageAuthorToPolymorphic < ActiveRecord::Migration[8.0]
  def change
    # Add polymorphic columns
    add_column :front_messages, :author_type, :string
    add_index :front_messages, [ :author_type, :author_id ]

    # Update existing records to set author_type to FrontContact where author_id exists
    reversible do |dir|
      dir.up do
        execute <<-SQL
          UPDATE front_messages#{' '}
          SET author_type = 'FrontContact'#{' '}
          WHERE author_id IS NOT NULL
        SQL
      end
    end
  end
end
