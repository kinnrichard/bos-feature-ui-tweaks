class CreateDevices < ActiveRecord::Migration[8.0]
  def change
    create_table :devices do |t|
      t.references :person, null: false, foreign_key: true
      t.string :name
      t.string :model
      t.string :serial_number
      t.string :location
      t.text :notes

      t.timestamps
    end
  end
end
