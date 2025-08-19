class DropSolidQueueTables < ActiveRecord::Migration[8.0]
  def up
    # Drop all SolidQueue tables
    drop_table :solid_queue_blocked_executions if table_exists?(:solid_queue_blocked_executions)
    drop_table :solid_queue_claimed_executions if table_exists?(:solid_queue_claimed_executions)
    drop_table :solid_queue_failed_executions if table_exists?(:solid_queue_failed_executions)
    drop_table :solid_queue_ready_executions if table_exists?(:solid_queue_ready_executions)
    drop_table :solid_queue_recurring_executions if table_exists?(:solid_queue_recurring_executions)
    drop_table :solid_queue_scheduled_executions if table_exists?(:solid_queue_scheduled_executions)
    drop_table :solid_queue_semaphores if table_exists?(:solid_queue_semaphores)
    drop_table :solid_queue_pauses if table_exists?(:solid_queue_pauses)
    drop_table :solid_queue_processes if table_exists?(:solid_queue_processes)
    drop_table :solid_queue_recurring_tasks if table_exists?(:solid_queue_recurring_tasks)
    drop_table :solid_queue_jobs if table_exists?(:solid_queue_jobs)
  end

  def down
    raise ActiveRecord::IrreversibleMigration, "SolidQueue tables have been removed in favor of GoodJob"
  end
end
