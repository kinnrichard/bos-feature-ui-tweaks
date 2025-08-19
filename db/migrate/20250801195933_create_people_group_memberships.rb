class CreatePeopleGroupMemberships < ActiveRecord::Migration[8.0]
  def change
    create_table :people_group_memberships, id: :uuid do |t|
      t.references :person, null: false, foreign_key: true, type: :uuid
      t.references :people_group, null: false, foreign_key: true, type: :uuid

      t.timestamps
    end

    add_index :people_group_memberships, [ :person_id, :people_group_id ], unique: true, name: 'index_people_group_memberships_unique'
  end
end
