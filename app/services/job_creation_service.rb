# frozen_string_literal: true

# Service object for handling job creation with all associated records
class JobCreationService
  attr_reader :job, :errors

  def initialize(client:, user:, params:)
    @client = client
    @user = user
    @params = params
    @errors = []
  end

  def call
    ActiveRecord::Base.transaction do
      create_job
      return false unless @job.persisted?

      assign_technicians
      associate_people
      log_activity

      true
    end
  rescue ActiveRecord::RecordInvalid => e
    @errors << e.message
    false
  rescue StandardError => e
    @errors << "An unexpected error occurred: #{e.message}"
    Rails.logger.error "JobCreationService error: #{e.full_message}"
    false
  end

  private

  def create_job
    @job = @client.jobs.build(sanitized_job_params)
    @job.save!
  end

  def sanitized_job_params
    sanitized = @params.dup
    sanitized[:title] = sanitize_html(sanitized[:title]) if sanitized[:title]
    sanitized[:description] = sanitize_html(sanitized[:description]) if sanitized[:description]
    sanitized
  end

  def sanitize_html(text)
    ActionController::Base.helpers.sanitize(text, tags: [])
  end

  def assign_technicians
    return unless @params[:technician_ids].present?

    technician_ids = @params[:technician_ids].reject(&:blank?).uniq
    technician_ids.each do |user_id|
      @job.job_assignments.create!(user_id: user_id)
    end
  end

  def associate_people
    return unless @params[:person_ids].present?

    person_ids = @params[:person_ids].reject(&:blank?).uniq
    person_ids.each do |person_id|
      @job.job_people.create!(person_id: person_id)
    end
  end

  def log_activity
    ActivityLog.create!(
      user: @user,
      action: "created",
      loggable: @job,
      metadata: { job_title: @job.title, client_name: @client.name }
    )
  end
end
