class AddResortTasksOnStatusChangeToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :resort_tasks_on_status_change, :boolean, default: true, null: false
  end
end
