class RemoveCreatedByFromJobs < ActiveRecord::Migration[8.0]
  def change
    remove_foreign_key :jobs, column: :created_by_id
    remove_index :jobs, :created_by_id
    remove_column :jobs, :created_by_id, :uuid
  end
end
