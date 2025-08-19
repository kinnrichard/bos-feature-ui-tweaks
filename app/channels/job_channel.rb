class JobChannel < ApplicationCable::Channel
  def subscribed
    ensure_authorized!

    # Subscribe to specific job updates
    if params[:job_id].present?
      job = current_user.technician_jobs.find_by(id: params[:job_id])
      if job
        stream_from "job_#{job.id}"
        stream_from "job_#{job.id}_tasks"
      else
        reject
      end
    else
      # Subscribe to all jobs for the current user
      stream_from "user_#{current_user.id}_jobs"
    end
  end

  def unsubscribed
    # Cleanup when channel is unsubscribed
    stop_all_streams
  end

  # Action for updating task order
  def reorder_tasks(data)
    job = current_user.technician_jobs.find_by(id: data["job_id"])
    return unless job

    task_ids = data["task_ids"]
    return unless task_ids.is_a?(Array)

    # Update task positions
    Task.transaction do
      task_ids.each_with_index do |task_id, index|
        task = job.tasks.find_by(id: task_id)
        task&.update!(position: index)
      end
    end

    # Broadcast the update to all subscribers
    ActionCable.server.broadcast(
      "job_#{job.id}_tasks",
      {
        type: "tasks_reordered",
        job_id: job.id,
        task_ids: task_ids
      }
    )
  rescue ActiveRecord::RecordInvalid => e
    transmit({ error: e.message })
  end

  # Action for updating job status
  def update_status(data)
    job = current_user.technician_jobs.find_by(id: data["job_id"])
    return unless job

    begin
      if job.update!(status: data["status"])
        ActionCable.server.broadcast(
          "job_#{job.id}",
          {
            type: "status_updated",
            job_id: job.id,
            status: job.status,
            updated_at: job.updated_at
          }
        )
      end
    rescue ArgumentError, ActiveRecord::RecordInvalid => e
      transmit({ error: e.message })
    end
  end
end
