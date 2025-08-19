# frozen_string_literal: true

# Service to prepare data for views, avoiding database queries in view components
class ViewDataService
  class << self
    # Prepare data for schedule popover component
    def schedule_popover_data(job:)
      {
        scheduled_dates: job.scheduled_date_times.includes(:users).order(:scheduled_date, :scheduled_time),
        available_technicians: available_technicians
      }
    end

    # Prepare data for job assignment dropdowns
    def job_assignment_data
      {
        available_technicians: available_technicians
      }
    end

    # Prepare data for people index view
    def people_index_data(people:)
      # Preload contact methods to avoid N+1
      people_with_contacts = people.includes(:contact_methods)

      # Build a hash of existing contact types for each person
      contact_types_by_person = {}
      people_with_contacts.each do |person|
        contact_types_by_person[person.id] = person.contact_methods.pluck(:contact_type)
      end

      {
        people: people_with_contacts,
        contact_types_by_person: contact_types_by_person
      }
    end

    # Prepare data for task list component
    def task_list_data(tasks_tree:)
      # Collect all task IDs from the tree
      task_ids = []
      collect_task_ids(tasks_tree, task_ids)

      # Preload last status changes for all tasks at once
      last_status_changes = ActivityLog
        .where(loggable_type: "Task", loggable_id: task_ids)
        .where(action: "status_changed")
        .where("metadata->>'new_status' = ?", "in_progress")
        .group(:loggable_id)
        .maximum(:created_at)

      # Bulk calculate time in progress for all tasks
      time_in_progress = bulk_calculate_time_in_progress(task_ids)

      {
        last_status_changes: last_status_changes,
        time_in_progress: time_in_progress
      }
    end

    # Prepare data for job card component
    def job_card_data(jobs:)
      # Preload associations to avoid N+1
      jobs.includes(:client, :technicians)
    end

    private

    def available_technicians
      @available_technicians ||= User.where(role: [ :technician, :admin, :owner ]).order(:name).to_a
    end

    def collect_task_ids(tasks_tree, task_ids)
      tasks_tree.each do |node|
        task_ids << node[:task].id
        collect_task_ids(node[:subtasks], task_ids) if node[:subtasks].any?
      end
    end

    # Bulk calculate time in progress for multiple tasks
    def bulk_calculate_time_in_progress(task_ids)
      return {} if task_ids.empty?

      # Get all status change logs for these tasks in one query
      status_logs = ActivityLog
        .where(loggable_type: "Task", loggable_id: task_ids)
        .where(action: "status_changed")
        .order(:loggable_id, :created_at)
        .pluck(:loggable_id, :created_at, :metadata)

      # Get current status for tasks that are currently in_progress
      current_in_progress = Task
        .where(id: task_ids, status: :in_progress)
        .pluck(:id)
        .to_set

      # Calculate time in progress for each task
      time_by_task = {}

      # Group logs by task ID
      logs_by_task = status_logs.group_by(&:first)

      logs_by_task.each do |task_id, logs|
        total_seconds = 0
        in_progress_start = nil

        logs.each do |log|
          _, created_at, metadata = log
          new_status = metadata["new_status"]

          if new_status == "in_progress"
            # Task went into in_progress
            in_progress_start = created_at
          elsif in_progress_start.present?
            # Task left in_progress status
            total_seconds += (created_at - in_progress_start)
            in_progress_start = nil
          end
        end

        # If currently in_progress, add time from last start to now
        if current_in_progress.include?(task_id) && in_progress_start.present?
          total_seconds += (Time.current - in_progress_start)
        end

        time_by_task[task_id] = total_seconds
      end

      # Fill in zero for tasks with no in_progress time
      task_ids.each do |task_id|
        time_by_task[task_id] ||= 0
      end

      time_by_task
    end
  end
end
