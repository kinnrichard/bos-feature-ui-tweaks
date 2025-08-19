class CreateContactMethods < ActiveRecord::Migration[8.0]
  def change
    create_table :contact_methods do |t|
      t.references :person, null: false, foreign_key: true
      t.string :value
      t.string :formatted_value
      t.integer :contact_type

      t.timestamps
    end
  end
end
