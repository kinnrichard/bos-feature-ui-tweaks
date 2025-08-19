class PopulatePolymorphicUuidColumns < ActiveRecord::Migration[8.0]
  def up
    # Update notes table
    execute <<-SQL
      UPDATE notes n
      SET notable_uuid = (
        CASE#{' '}
          WHEN n.notable_type = 'Job' THEN (SELECT uuid FROM jobs WHERE id = n.notable_id)
          WHEN n.notable_type = 'Client' THEN (SELECT uuid FROM clients WHERE id = n.notable_id)
          WHEN n.notable_type = 'Person' THEN (SELECT uuid FROM people WHERE id = n.notable_id)
          WHEN n.notable_type = 'Device' THEN (SELECT uuid FROM devices WHERE id = n.notable_id)
          WHEN n.notable_type = 'Task' THEN (SELECT uuid FROM tasks WHERE id = n.notable_id)
        END
      )
      WHERE n.notable_uuid IS NULL AND n.notable_id IS NOT NULL
    SQL

    # Update activity_logs table
    execute <<-SQL
      UPDATE activity_logs al
      SET loggable_uuid = (
        CASE#{' '}
          WHEN al.loggable_type = 'Job' THEN (SELECT uuid FROM jobs WHERE id = al.loggable_id)
          WHEN al.loggable_type = 'Client' THEN (SELECT uuid FROM clients WHERE id = al.loggable_id)
          WHEN al.loggable_type = 'Person' THEN (SELECT uuid FROM people WHERE id = al.loggable_id)
          WHEN al.loggable_type = 'Device' THEN (SELECT uuid FROM devices WHERE id = al.loggable_id)
          WHEN al.loggable_type = 'Task' THEN (SELECT uuid FROM tasks WHERE id = al.loggable_id)
          WHEN al.loggable_type = 'User' THEN (SELECT uuid FROM users WHERE id = al.loggable_id)
        END
      )
      WHERE al.loggable_uuid IS NULL AND al.loggable_id IS NOT NULL
    SQL

    # Update scheduled_date_times table
    execute <<-SQL
      UPDATE scheduled_date_times sdt
      SET schedulable_uuid = (
        CASE#{' '}
          WHEN sdt.schedulable_type = 'Job' THEN (SELECT uuid FROM jobs WHERE id = sdt.schedulable_id)
          WHEN sdt.schedulable_type = 'Task' THEN (SELECT uuid FROM tasks WHERE id = sdt.schedulable_id)
        END
      )
      WHERE sdt.schedulable_uuid IS NULL AND sdt.schedulable_id IS NOT NULL
    SQL

    # Update job_targets table if it exists
    if table_exists?(:job_targets)
      execute <<-SQL
        UPDATE job_targets jt
        SET target_uuid = (
          CASE#{' '}
            WHEN jt.target_type = 'Person' THEN (SELECT uuid FROM people WHERE id = jt.target_id)
            WHEN jt.target_type = 'Device' THEN (SELECT uuid FROM devices WHERE id = jt.target_id)
          END
        )
        WHERE jt.target_uuid IS NULL AND jt.target_id IS NOT NULL
      SQL
    end
  end

  def down
    # Data migration - no need to reverse
  end
end
