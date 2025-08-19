class SetDefaultsForJobStatusAndPriority < ActiveRecord::Migration[8.0]
  def change
    # First update existing NULL records to have default values
    reversible do |dir|
      dir.up do
        execute "UPDATE jobs SET status = 'open' WHERE status IS NULL"
        execute "UPDATE jobs SET priority = 'normal' WHERE priority IS NULL"
      end
    end

    # Then set the default values for the columns
    change_column_default :jobs, :status, 'open'
    change_column_default :jobs, :priority, 'normal'
  end
end
