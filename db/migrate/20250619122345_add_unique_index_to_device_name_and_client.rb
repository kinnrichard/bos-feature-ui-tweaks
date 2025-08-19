class AddUniqueIndexToDeviceNameAndClient < ActiveRecord::Migration[8.0]
  def change
    add_index :devices, [ :client_id, :name ], unique: true
  end
end
