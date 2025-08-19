class AddLockVersionToJobs < ActiveRecord::Migration[8.0]
  def change
    add_column :jobs, :lock_version, :integer, default: 0, null: false
    add_index :jobs, :lock_version
  end
end
