class RemoveUniquePositionConstraint < ActiveRecord::Migration[8.0]
  def change
    # Remove the unique constraint that was used by positioning gem
    # Our custom positioning system uses randomized positions, making conflicts extremely rare
    remove_index :tasks, name: 'index_tasks_on_scope_and_position'

    # Add back a non-unique index for query performance
    add_index :tasks, [ :job_id, :parent_id, :position ], name: 'index_tasks_on_scope_and_position_non_unique'
  end
end
