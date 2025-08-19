class CreatePeopleGroups < ActiveRecord::Migration[8.0]
  def change
    create_table :people_groups, id: :uuid do |t|
      t.string :name, null: false
      t.boolean :is_department, default: false, null: false
      t.references :client, null: false, foreign_key: true, type: :uuid

      t.timestamps
    end

    add_index :people_groups, [ :client_id, :name ], unique: true
  end
end
