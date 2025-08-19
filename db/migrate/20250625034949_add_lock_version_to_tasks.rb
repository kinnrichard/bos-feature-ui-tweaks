class AddLockVersionToTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :tasks, :lock_version, :integer, default: 0, null: false
    add_index :tasks, :lock_version
  end
end
