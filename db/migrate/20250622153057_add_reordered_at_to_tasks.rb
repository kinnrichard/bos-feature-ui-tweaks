class AddReorderedAtToTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :tasks, :reordered_at, :datetime, default: -> { 'CURRENT_TIMESTAMP' }
    add_index :tasks, :reordered_at

    # Set initial values for existing tasks
    reversible do |dir|
      dir.up do
        execute "UPDATE tasks SET reordered_at = CURRENT_TIMESTAMP WHERE reordered_at IS NULL"
      end
    end
  end
end
