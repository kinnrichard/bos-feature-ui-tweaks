class CreateCaseAssignments < ActiveRecord::Migration[8.0]
  def change
    create_table :case_assignments do |t|
      t.references :case, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true

      t.timestamps
    end
  end
end
