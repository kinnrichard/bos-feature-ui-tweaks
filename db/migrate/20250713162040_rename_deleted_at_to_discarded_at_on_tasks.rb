class RenameDeletedAtToDiscardedAtOnTasks < ActiveRecord::Migration[8.0]
  def change
    # Rename the column from deleted_at to discarded_at for discard gem compatibility
    rename_column :tasks, :deleted_at, :discarded_at

    # Remove old index and add new one with correct name
    remove_index :tasks, column: :discarded_at if index_exists?(:tasks, :discarded_at)
    add_index :tasks, :discarded_at
  end
end
