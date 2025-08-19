class TechnicianChannel < ApplicationCable::Channel
  def subscribed
    ensure_authorized!

    # Subscribe to job-specific technician collaboration
    if params[:job_id].present?
      job = current_user.technician_jobs.find_by(id: params[:job_id])
      if job
        stream_from "job_#{job.id}_technicians"

        # Notify other technicians that someone joined
        broadcast_presence(job.id, "joined")
      else
        reject
      end
    end
  end

  def unsubscribed
    if params[:job_id].present?
      broadcast_presence(params[:job_id], "left")
    end
    stop_all_streams
  end

  # Send a message to other technicians
  def send_message(data)
    job = current_user.technician_jobs.find_by(id: data["job_id"])
    return unless job

    message = {
      type: "message",
      job_id: job.id,
      user_id: current_user.id,
      user_name: current_user.name,
      content: data["content"],
      timestamp: Time.current
    }

    ActionCable.server.broadcast(
      "job_#{job.id}_technicians",
      message
    )
  end

  # Notify when a technician is typing
  def typing(data)
    job = current_user.technician_jobs.find_by(id: data["job_id"])
    return unless job

    ActionCable.server.broadcast(
      "job_#{job.id}_technicians",
      {
        type: "typing",
        job_id: job.id,
        user_id: current_user.id,
        user_name: current_user.name,
        is_typing: data["is_typing"]
      }
    )
  end

  # Share current location/status
  def update_location(data)
    job = current_user.technician_jobs.find_by(id: data["job_id"])
    return unless job

    ActionCable.server.broadcast(
      "job_#{job.id}_technicians",
      {
        type: "location_update",
        job_id: job.id,
        user_id: current_user.id,
        user_name: current_user.name,
        latitude: data["latitude"],
        longitude: data["longitude"],
        accuracy: data["accuracy"],
        timestamp: Time.current
      }
    )
  end

  private

  def broadcast_presence(job_id, action)
    ActionCable.server.broadcast(
      "job_#{job_id}_technicians",
      {
        type: "presence",
        action: action,
        user_id: current_user.id,
        user_name: current_user.name,
        timestamp: Time.current
      }
    )
  end
end
