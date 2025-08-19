class Api::V1::JobsController < Api::V1::BaseController
  include Paginatable

  before_action :authenticate_request
  before_action :set_job, only: [ :show, :update, :destroy ]

  # GET /api/v1/jobs
  def index
    jobs = job_scope
                      .includes(:client, :technicians, tasks: :subtasks)
                      .order(created_at: :desc)

    # Apply filters
    jobs = apply_filters(jobs)

    # Paginate
    jobs = paginate(jobs)

    Rails.logger.info "JOBS INDEX: Loading #{jobs.count} jobs" if Rails.env.development?
    Rails.logger.info "JOBS INDEX: Include params: #{params[:include]}" if Rails.env.development?

    # Log technician counts for debugging
    if Rails.env.development?
      jobs.each do |job|
        tech_count = job.technicians.count
        tech_names = job.technicians.pluck(:name).join(", ")
        Rails.logger.info "JOBS INDEX: Job #{job.id} has #{tech_count} technicians: #{tech_names}"
      end
    end

    # Check ETag freshness with filter params as additional keys
    filter_params = params.permit(:scope, :status, :priority, :client_id, :q, :page, :per_page, :include, :from_date, :to_date).to_h
    if stale_check?(jobs, additional_keys: [ filter_params ])
      render json: JobSerializer.new(
        jobs,
        include: params[:include]&.split(","),
        meta: pagination_meta(jobs),
        links: pagination_links(jobs, request.url)
      ).serializable_hash
    end
  end

  # GET /api/v1/jobs/:id
  def show
    # Reload job to ensure we have the latest data including updated_at from touch callbacks
    @job.reload

    # Check ETag freshness for the job
    if stale_check?(@job, additional_keys: [ params[:include] ])
      render json: JobSerializer.new(
        @job,
        include: params[:include]&.split(",")
      ).serializable_hash
    end
  end

  # POST /api/v1/jobs
  def create
    job = Job.new(job_params)

    if job.save
      # Add current user as technician if they are one
      if current_user.technician?
        job.technicians << current_user
      end

      render json: JobSerializer.new(job).serializable_hash, status: :created
    else
      render_validation_errors(job.errors)
    end
  end

  # PATCH/PUT /api/v1/jobs/:id
  def update
    if @job.update(job_params)
      render json: JobSerializer.new(@job).serializable_hash
    else
      render_validation_errors(@job.errors)
    end
  end

  # DELETE /api/v1/jobs/:id
  def destroy
    if current_user.can_delete?(@job)
      @job.destroy
      head :no_content
    else
      render_error(
        status: :forbidden,
        code: "FORBIDDEN",
        title: "Access Denied",
        detail: "You do not have permission to delete this job"
      )
    end
  end

  # PATCH /api/v1/jobs/:id/technicians
  def update_technicians
    @job = Job.find(params[:id])
    technician_ids = params[:technician_ids] || []

    Rails.logger.info "TECH ASSIGNMENT: Job ID: #{@job.id}, Technician IDs: #{technician_ids.inspect}" if Rails.env.development?

    # Find valid users
    technicians = User.where(id: technician_ids)
    Rails.logger.info "TECH ASSIGNMENT: Found #{technicians.count} technicians: #{technicians.pluck(:name).join(', ')}" if Rails.env.development?

    # Update job technicians - Touchable concern handles cache invalidation automatically
    current_tech_ids = @job.job_assignments.pluck(:user_id)
    new_tech_ids = technician_ids.reject(&:blank?).uniq

    Rails.logger.info "TECH ASSIGNMENT: Current: #{current_tech_ids.inspect}, New: #{new_tech_ids.inspect}" if Rails.env.development?

    # Only update if there are changes
    unless current_tech_ids.sort == new_tech_ids.sort
      Rails.logger.info "TECH ASSIGNMENT: Changes detected, updating assignments" if Rails.env.development?

      # Touchable concern automatically touches job when destroy_all is called
      @job.job_assignments.destroy_all

      # Create new assignments (also triggers touch via belongs_to :job, touch: true)
      new_tech_ids.each do |user_id|
        @job.job_assignments.create!(user_id: user_id)
      end

      # Reload the job to get the updated timestamp
      @job.reload
    else
      Rails.logger.info "TECH ASSIGNMENT: No changes detected" if Rails.env.development?
    end

    Rails.logger.info "TECH ASSIGNMENT: Successfully updated. Current technicians: #{@job.technicians.pluck(:name).join(', ')}" if Rails.env.development?
    Rails.logger.info "TECH ASSIGNMENT: Job updated_at: #{@job.updated_at}" if Rails.env.development?

    render json: {
      status: "success",
      technicians: @job.technicians.map { |tech| technician_data(tech) }
    }
  rescue ActiveRecord::RecordNotFound
    Rails.logger.error "TECH ASSIGNMENT: Job not found: #{params[:id]}" if Rails.env.development?
    render json: { error: "Job not found" }, status: :not_found
  end

  private

  def set_job
    # Use the same permission logic as the index action
    if current_user.admin? || current_user.owner?
      # Admins/owners can access any job
      @job = Job.includes(:client, :technicians, tasks: :subtasks).find(params[:id])
    else
      # Regular users can only access jobs they're assigned to
      @job = current_user.technician_jobs.includes(:client, :technicians, tasks: :subtasks).find(params[:id])
    end
  rescue ActiveRecord::RecordNotFound
    render_error(
      status: :not_found,
      code: "NOT_FOUND",
      title: "Job Not Found",
      detail: "Job with ID #{params[:id]} not found or not accessible"
    )
  end

  def job_params
    params.require(:job).permit(
      :title, :description, :status, :priority,
      :client_id, :due_on, :due_time, :start_on, :start_time
    )
  end

  def apply_filters(scope)
    # Filter by status
    if params[:status].present?
      scope = scope.where(status: params[:status])
    end

    # Filter by priority
    if params[:priority].present?
      scope = scope.where(priority: params[:priority])
    end

    # Filter by client
    if params[:client_id].present?
      if uuid?(params[:client_id])
        scope = scope.where(client_uuid: params[:client_id])
      else
        scope = scope.where(client_id: params[:client_id])
      end
    end

    # Filter by date range
    if params[:from_date].present?
      scope = scope.where("jobs.created_at >= ?", Date.parse(params[:from_date]))
    end

    if params[:to_date].present?
      scope = scope.where("jobs.created_at <= ?", Date.parse(params[:to_date]).end_of_day)
    end

    # Search by title
    if params[:q].present?
      scope = scope.where("jobs.title ILIKE ?", "%#{params[:q]}%")
    end

    scope
  end

  def job_scope
    case params[:scope]
    when "all"
      # All jobs - only for admins/owners
      if current_user.admin? || current_user.owner?
        Job.all
      else
        # Non-admins get their assigned jobs
        current_user.technician_jobs
      end
    when "mine"
      # Explicitly request user's assigned jobs
      current_user.technician_jobs
    else
      # Default: user's assigned jobs (maintains existing behavior)
      current_user.technician_jobs
    end
  end

  private

  def technician_data(technician)
    {
      id: technician.id,
      name: technician.name,
      email: technician.email,
      role: technician.role,
      initials: technician.initials,
      avatar_style: technician.avatar_style
    }
  end
end
