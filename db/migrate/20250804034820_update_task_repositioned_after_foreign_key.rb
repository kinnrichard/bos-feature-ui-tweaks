class UpdateTaskRepositionedAfterForeignKey < ActiveRecord::Migration[8.0]
  def change
    # Remove the existing foreign key constraint
    remove_foreign_key :tasks, column: :repositioned_after_id

    # Add a new foreign key constraint with ON DELETE SET NULL
    add_foreign_key :tasks, :tasks,
                    column: :repositioned_after_id,
                    on_delete: :nullify
  end
end
