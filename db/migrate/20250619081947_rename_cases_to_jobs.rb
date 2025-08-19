class RenameCasesToJobs < ActiveRecord::Migration[8.0]
  def change
    rename_table :cases, :jobs
    rename_table :case_assignments, :job_assignments
    rename_table :case_people, :job_people

    # Rename foreign key columns
    rename_column :job_assignments, :case_id, :job_id
    rename_column :job_people, :case_id, :job_id
    rename_column :tasks, :case_id, :job_id
  end
end
