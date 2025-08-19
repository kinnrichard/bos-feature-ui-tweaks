class AddNameNormalizedToClients < ActiveRecord::Migration[8.0]
  def change
    add_column :clients, :name_normalized, :string
    add_index :clients, :name_normalized, unique: true
  end
end
