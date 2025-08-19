namespace :activity_logs do
  desc "Backfill job_id for existing activity logs"
  task backfill_job_ids: :environment do
    puts "Starting backfill of job_ids..."

    # Update logs for Job loggables
    job_logs = ActivityLog.where(loggable_type: "Job").where(job_id: nil)
    puts "Found #{job_logs.count} Job logs to update"

    job_logs.find_each do |log|
      if log.loggable_id && Job.exists?(log.loggable_id)
        log.update_column(:job_id, log.loggable_id)
      end
    end

    # Update logs for Task loggables
    task_logs = ActivityLog.where(loggable_type: "Task").where(job_id: nil)
    puts "Found #{task_logs.count} Task logs to update"

    task_logs.includes(:loggable).find_each do |log|
      if log.loggable && log.loggable.job_id
        log.update_column(:job_id, log.loggable.job_id)
      end
    end

    puts "Backfill complete!"
    puts "Total logs with job_id: #{ActivityLog.where.not(job_id: nil).count}"
  end
end
