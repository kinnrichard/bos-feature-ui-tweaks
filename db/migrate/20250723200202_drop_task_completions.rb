class DropTaskCompletions < ActiveRecord::Migration[8.0]
  def change
    drop_table :task_completions
  end
end
