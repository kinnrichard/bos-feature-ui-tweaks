class AddRepositionedAfterIdToTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :tasks, :repositioned_after_id, :uuid
    add_foreign_key :tasks, :tasks, column: :repositioned_after_id
    add_index :tasks, :repositioned_after_id
  end
end
