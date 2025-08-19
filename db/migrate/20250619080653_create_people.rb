class CreatePeople < ActiveRecord::Migration[8.0]
  def change
    create_table :people do |t|
      t.references :client, null: false, foreign_key: true
      t.string :name
      t.text :notes

      t.timestamps
    end
  end
end
