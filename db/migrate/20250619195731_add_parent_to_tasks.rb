class AddParentToTasks < ActiveRecord::Migration[8.0]
  def change
    add_reference :tasks, :parent, null: true, foreign_key: { to_table: :tasks }
    add_column :tasks, :subtasks_count, :integer, default: 0
  end
end
