class CreateTasks < ActiveRecord::Migration[8.0]
  def change
    create_table :tasks do |t|
      t.references :case, null: false, foreign_key: true
      t.string :title
      t.integer :status
      t.integer :position
      t.references :assigned_to, null: true, foreign_key: { to_table: :users }

      t.timestamps
    end
  end
end
