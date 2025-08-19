class AddUniqueIndexToTasksPosition < ActiveRecord::Migration[8.0]
  def change
    add_index :tasks, [ :job_id, :parent_id, :position ], unique: true, name: 'index_tasks_on_scope_and_position'
  end
end
