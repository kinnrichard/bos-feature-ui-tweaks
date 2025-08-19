class CreateCasePeople < ActiveRecord::Migration[8.0]
  def change
    create_table :case_people do |t|
      t.references :case, null: false, foreign_key: true
      t.references :person, null: false, foreign_key: true

      t.timestamps
    end
  end
end
