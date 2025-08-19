class AddAuthorFieldsToFrontMessages < ActiveRecord::Migration[8.0]
  def change
    add_column :front_messages, :author_handle, :string
    add_column :front_messages, :author_name, :string

    add_index :front_messages, :author_handle
  end
end
