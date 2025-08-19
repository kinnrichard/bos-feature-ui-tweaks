class AddPerformanceIndexes < ActiveRecord::Migration[8.0]
  def change
    # Activity logs indexes for ViewDataService bulk operations
    add_index :activity_logs, [ :action, :loggable_type, :loggable_id ],
              name: 'index_activity_logs_on_action_and_loggable'
    add_index :activity_logs, [ :loggable_type, :loggable_id, :action ],
              name: 'index_activity_logs_on_loggable_and_action'
    add_index :activity_logs, :created_at, name: 'index_activity_logs_on_created_at'

    # Jobs indexes for filtering and sorting
    add_index :jobs, [ :status, :created_at ], name: 'index_jobs_on_status_and_created_at'
    add_index :jobs, [ :due_on, :due_time ], name: 'index_jobs_on_due_date_time'

    # Users indexes for role-based queries
    add_index :users, :role, name: 'index_users_on_role'
    add_index :users, :email, name: 'index_users_on_email' unless index_exists?(:users, :email)
  end
end
