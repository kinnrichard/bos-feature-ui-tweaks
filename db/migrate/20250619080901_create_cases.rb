class CreateCases < ActiveRecord::Migration[8.0]
  def change
    create_table :cases do |t|
      t.references :client, null: false, foreign_key: true
      t.string :title
      t.integer :status
      t.integer :priority
      t.datetime :due_date
      t.datetime :start_on_date
      t.references :created_by, null: false, foreign_key: { to_table: :users }

      t.timestamps
    end
  end
end
