class AddShortNameToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :short_name, :string
    add_index :users, :short_name, unique: true
  end
end
