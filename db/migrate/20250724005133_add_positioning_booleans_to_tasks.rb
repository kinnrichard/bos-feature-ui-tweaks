class AddPositioningBooleansToTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :tasks, :position_finalized, :boolean, default: true, null: false
    add_column :tasks, :repositioned_to_top, :boolean, default: false, null: false
  end
end
