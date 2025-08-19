class MakePersonIdOptionalInDevices < ActiveRecord::Migration[8.0]
  def change
    change_column_null :devices, :person_id, true
  end
end
