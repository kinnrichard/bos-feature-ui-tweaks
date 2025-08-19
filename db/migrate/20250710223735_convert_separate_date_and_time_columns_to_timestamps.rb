class ConvertSeparateDateAndTimeColumnsToTimestamps < ActiveRecord::Migration[8.0]
  def up
    # Add new timestamp columns with time_set flags
    add_column :jobs, :due_at, :timestamp
    add_column :jobs, :due_time_set, :boolean, default: false, null: false

    add_column :jobs, :starts_at, :timestamp
    add_column :jobs, :start_time_set, :boolean, default: false, null: false

    add_column :scheduled_date_times, :scheduled_at, :timestamp
    add_column :scheduled_date_times, :scheduled_time_set, :boolean, default: false, null: false

    # Migrate existing data
    migrate_jobs_data
    migrate_scheduled_date_times_data

    # Remove old columns
    remove_column :jobs, :due_date
    remove_column :jobs, :due_time
    remove_column :jobs, :start_on_date
    remove_column :jobs, :start_time
    remove_column :jobs, :start_on
    remove_column :jobs, :due_on

    remove_column :scheduled_date_times, :scheduled_date
    remove_column :scheduled_date_times, :scheduled_time
  end

  def down
    # Add back old columns
    add_column :jobs, :due_date, :date
    add_column :jobs, :due_time, :time
    add_column :jobs, :start_on_date, :date
    add_column :jobs, :start_time, :time
    add_column :jobs, :start_on, :date
    add_column :jobs, :due_on, :date

    add_column :scheduled_date_times, :scheduled_date, :date
    add_column :scheduled_date_times, :scheduled_time, :time

    # Migrate data back
    migrate_jobs_data_down
    migrate_scheduled_date_times_data_down

    # Remove new columns
    remove_column :jobs, :due_at
    remove_column :jobs, :due_time_set
    remove_column :jobs, :starts_at
    remove_column :jobs, :start_time_set

    remove_column :scheduled_date_times, :scheduled_at
    remove_column :scheduled_date_times, :scheduled_time_set
  end

  private

  def migrate_jobs_data
    # Process in batches to handle large datasets
    Job.find_each do |job|
      # Handle due_date + due_time -> due_at + due_time_set
      if job.due_date.present?
        begin
          if job.due_time.present?
            # Combine date and time
            job.due_at = Time.zone.parse("#{job.due_date} #{job.due_time}")
            job.due_time_set = true
          else
            # Date only - set to midnight
            base_time = job.due_date.is_a?(Date) ? job.due_date.to_time : Time.zone.parse(job.due_date.to_s)
            job.due_at = base_time&.beginning_of_day
            job.due_time_set = false
          end
        rescue => e
          Rails.logger.warn "Failed to parse due_date for job #{job.id}: #{e.message}"
        end
      end

      # Handle start_on_date + start_time -> starts_at + start_time_set
      start_date = job.start_on_date || job.start_on
      if start_date.present?
        begin
          if job.start_time.present?
            # Combine date and time
            job.starts_at = Time.zone.parse("#{start_date} #{job.start_time}")
            job.start_time_set = true
          else
            # Date only - set to midnight
            base_time = start_date.is_a?(Date) ? start_date.to_time : Time.zone.parse(start_date.to_s)
            job.starts_at = base_time&.beginning_of_day
            job.start_time_set = false
          end
        rescue => e
          Rails.logger.warn "Failed to parse start_date for job #{job.id}: #{e.message}"
        end
      end

      job.save!(validate: false) if job.changed?
    end
  end

  def migrate_scheduled_date_times_data
    ScheduledDateTime.find_each do |sdt|
      if sdt.scheduled_date.present?
        begin
          if sdt.scheduled_time.present?
            # Combine date and time
            sdt.scheduled_at = Time.zone.parse("#{sdt.scheduled_date} #{sdt.scheduled_time}")
            sdt.scheduled_time_set = true
          else
            # Date only - set to midnight
            base_time = sdt.scheduled_date.is_a?(Date) ? sdt.scheduled_date.to_time : Time.zone.parse(sdt.scheduled_date.to_s)
            sdt.scheduled_at = base_time&.beginning_of_day
            sdt.scheduled_time_set = false
          end

          sdt.save!(validate: false) if sdt.changed?
        rescue => e
          Rails.logger.warn "Failed to parse scheduled_date for ScheduledDateTime #{sdt.id}: #{e.message}"
        end
      end
    end
  end

  def migrate_jobs_data_down
    Job.find_each do |job|
      # Extract date and time from timestamps
      if job.due_at.present?
        job.due_date = job.due_at.to_date
        job.due_time = job.due_time_set? ? job.due_at.strftime("%H:%M:%S") : nil
      end

      if job.starts_at.present?
        job.start_on_date = job.starts_at.to_date
        job.start_time = job.start_time_set? ? job.starts_at.strftime("%H:%M:%S") : nil
      end

      job.save!(validate: false) if job.changed?
    end
  end

  def migrate_scheduled_date_times_data_down
    ScheduledDateTime.find_each do |sdt|
      if sdt.scheduled_at.present?
        sdt.scheduled_date = sdt.scheduled_at.to_date
        sdt.scheduled_time = sdt.scheduled_time_set? ? sdt.scheduled_at.strftime("%H:%M:%S") : nil

        sdt.save!(validate: false) if sdt.changed?
      end
    end
  end
end
