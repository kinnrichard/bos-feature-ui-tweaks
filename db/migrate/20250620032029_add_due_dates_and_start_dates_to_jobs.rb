class AddDueDatesAndStartDatesToJobs < ActiveRecord::Migration[8.0]
  def change
    add_column :jobs, :due_on, :date
    add_column :jobs, :due_time, :time
    add_column :jobs, :start_on, :date
    add_column :jobs, :start_time, :time
  end
end
