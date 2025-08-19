# frozen_string_literal: true

# Service object for handling job updates with all associated records
class JobUpdateService
  attr_reader :job, :errors

  def initialize(job:, user:, params:)
    @job = job
    @user = user
    @params = params
    @errors = []
  end

  def call
    ActiveRecord::Base.transaction do
      update_job
      return false unless @job.valid?

      update_technician_assignments if @params[:technician_ids]
      update_people_associations if @params[:person_ids]
      log_activity

      true
    end
  rescue ActiveRecord::RecordInvalid => e
    @errors << e.message
    false
  rescue StandardError => e
    @errors << "An unexpected error occurred: #{e.message}"
    Rails.logger.error "JobUpdateService error: #{e.full_message}"
    false
  end

  private

  def update_job
    @job.update!(sanitized_job_params)
  end

  def sanitized_job_params
    sanitized = @params.except(:technician_ids, :person_ids)
    sanitized[:title] = sanitize_html(sanitized[:title]) if sanitized[:title]
    sanitized[:description] = sanitize_html(sanitized[:description]) if sanitized[:description]
    sanitized
  end

  def sanitize_html(text)
    ActionController::Base.helpers.sanitize(text, tags: [])
  end

  def update_technician_assignments
    technician_ids = @params[:technician_ids].reject(&:blank?).uniq
    current_tech_ids = @job.job_assignments.pluck(:user_id)

    # Only update if there are changes
    return if current_tech_ids.sort == technician_ids.sort

    @job.job_assignments.destroy_all
    technician_ids.each do |user_id|
      @job.job_assignments.create!(user_id: user_id)
    end
  end

  def update_people_associations
    person_ids = @params[:person_ids].reject(&:blank?).uniq
    current_person_ids = @job.job_people.pluck(:person_id)

    # Only update if there are changes
    return if current_person_ids.sort == person_ids.sort

    @job.job_people.destroy_all
    person_ids.each do |person_id|
      @job.job_people.create!(person_id: person_id)
    end
  end

  def log_activity
    ActivityLog.create!(
      user: @user,
      action: "updated",
      loggable: @job,
      metadata: { job_title: @job.title, client_name: @job.client.name }
    )
  end
end
