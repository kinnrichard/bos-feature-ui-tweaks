class Api::V1::TasksController < Api::V1::BaseController
  before_action :find_job
  before_action :find_task, except: [ :index, :create, :reorder, :batch_reorder, :batch_reorder_relative, :batch_details, :rebalance ]
  before_action :set_current_user

  # Temporarily skip CSRF for testing
  skip_before_action :verify_csrf_token_for_cookie_auth, only: [ :batch_reorder, :batch_reorder_relative, :batch_details ]

  def index
    @tasks = @job.tasks.includes(:assigned_to)

    render json: {
      data: @tasks.map do |task|
        {
          type: "tasks",
          id: task.id,
          attributes: {
            title: task.title,
            description: task.description,
            status: task.status,
            position: task.position,
            parent_id: task.parent_id,
            created_at: task.created_at,
            updated_at: task.updated_at,
            completed_at: task.completed_at
          },
          relationships: {
            assigned_to: {
              data: task.assigned_to ? { type: "users", id: task.assigned_to.id } : nil
            }
          }
        }
      end,
      included: build_included_users
    }
  end

  def show
    render json: TaskSerializer.new(@task).serializable_hash
  end

  # GET /api/v1/jobs/:job_id/tasks/:id/details
  def details
    # Load associated data for detailed view
    @task = @job.tasks.includes(:assigned_to, notes: :user, activity_logs: :user).find(params[:id])

    render json: {
      id: @task.id,
      title: @task.title,
      status: @task.status,
      position: @task.position,
      parent_id: @task.parent_id,
      created_at: @task.created_at,
      updated_at: @task.updated_at,
      notes: @task.notes.map do |note|
        {
          id: note.id,
          content: note.content,
          user_name: note.user.name,
          created_at: note.created_at
        }
      end,
      activity_logs: @task.activity_logs.order(:created_at).map do |log|
        {
          id: log.id,
          action: log.action,
          user_name: log.user&.name,
          created_at: log.created_at,
          metadata: log.metadata
        }
      end,
      available_technicians: available_technicians_data
    }
  end

  # GET /api/v1/jobs/:job_id/tasks/batch_details
  def batch_details
    # Load all tasks with their associated data in a single efficient query
    @tasks = @job.tasks.includes(:assigned_to, notes: :user, activity_logs: :user).order(:position)

    render json: {
      data: @tasks.map do |task|
        {
          type: "tasks",
          id: task.id,
          attributes: {
            title: task.title,
            status: task.status,
            position: task.position,
            parent_id: task.parent_id,
            created_at: task.created_at,
            updated_at: task.updated_at,
            notes: task.notes.order(:created_at).map do |note|
              {
                id: note.id,
                content: note.content,
                user_name: note.user.name,
                created_at: note.created_at
              }
            end,
            activity_logs: task.activity_logs.order(:created_at).map do |log|
              {
                id: log.id,
                action: log.action,
                user_name: log.user&.name,
                created_at: log.created_at,
                metadata: log.metadata
              }
            end
          },
          relationships: {
            assigned_to: {
              data: task.assigned_to ? { type: "users", id: task.assigned_to.id } : nil
            }
          }
        }
      end,
      included: build_included_users_for_batch(@tasks)
    }
  end

  # PATCH /api/v1/jobs/:job_id/tasks/:id/assign
  def assign
    technician_id = params[:technician_id]

    if technician_id.present?
      technician = User.find(technician_id)
      @task.update!(assigned_to: technician)

      render json: {
        status: "success",
        technician: {
          id: technician.id,
          name: technician.name
        }
      }
    else
      @task.update!(assigned_to: nil)

      render json: {
        status: "success",
        technician: nil
      }
    end
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Technician not found" }, status: :not_found
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  # POST /api/v1/jobs/:job_id/tasks/:id/notes
  def add_note
    content = params.dig(:note, :content)

    if content.blank?
      render json: { error: "Note content cannot be blank" }, status: :unprocessable_entity
      return
    end

    note = @task.notes.build(
      content: content,
      user: current_user
    )

    if note.save
      render json: {
        status: "success",
        note: {
          id: note.id,
          content: note.content,
          user_name: note.user.name,
          created_at: note.created_at
        }
      }
    else
      render json: { errors: note.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def create
    task_data = task_params

    # If client sends position instead of repositioned_after_id, mark as finalized
    if task_data[:position].present? && !task_data.key?(:position_finalized)
      task_data[:position_finalized] = true
    end

    # Legacy support: convert after_task_id to repositioned_after_id
    if task_data[:after_task_id].present? && task_data[:repositioned_after_id].blank?
      task_data[:repositioned_after_id] = task_data.delete(:after_task_id)
      task_data[:position_finalized] = false
    end

    @task = @job.tasks.build(task_data)

    if @task.save
      render json: {
        status: "success",
        task: task_attributes(@task)
      }, status: :created
    else
      render json: {
        errors: @task.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  def update
    if @task.update(task_params)
      render json: {
        status: "success",
        task: task_attributes(@task),
        timestamp: Time.current
      }
    else
      render json: {
        errors: @task.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  def destroy
    if @task.discard_with_subtask_check
      render json: {
        status: "success",
        message: "Task deleted successfully"
      }
    else
      render json: {
        error: @task.errors.full_messages.join(", "),
        details: @task.errors.messages
      }, status: :unprocessable_entity
    end
  rescue => e
    Rails.logger.error "Task deletion failed: #{e.message}"
    render json: {
      error: "Failed to delete task: #{e.message}"
    }, status: :internal_server_error
  end

  # Individual task reorder
  def reorder
    position = params[:position]&.to_i

    if position.blank?
      render json: { error: "Position parameter required" }, status: :unprocessable_entity
      return
    end

    # Check lock_version if provided
    if params[:lock_version]
      expected_lock = params[:lock_version].to_i
      if @task.lock_version != expected_lock
        render json: {
          error: "Task has been modified by another user",
          conflict: true,
          current_lock_version: @task.lock_version
        }, status: :conflict
        return
      end
    end

    @task.update!(position: position)

    render json: {
      status: "success",
      timestamp: Time.current,
      lock_version: @task.reload.lock_version
    }
  rescue ActiveRecord::StaleObjectError => e
    render json: {
      error: "Task has been modified by another user",
      conflict: true,
      current_lock_version: @task.lock_version
    }, status: :conflict
  end

  # Batch reorder multiple tasks
  def batch_reorder
    if params[:positions].blank?
      render json: { error: "Positions parameter required" }, status: :unprocessable_entity
      return
    end

    # Use a transaction to ensure all updates succeed or all fail
    Task.transaction do
      # If job lock_version is provided, verify it hasn't changed
      if params[:job_lock_version]
        expected_job_lock = params[:job_lock_version].to_i
        if @job.lock_version != expected_job_lock
          raise ActiveRecord::StaleObjectError.new(@job, "lock_version")
        end
      end

      params[:positions].each do |position_data|
        task = @job.tasks.find(position_data[:id])

        # Check lock_version if provided
        if position_data[:lock_version]
          expected_lock = position_data[:lock_version].to_i
          if task.lock_version != expected_lock
            raise ActiveRecord::StaleObjectError.new(task, "lock_version")
          end
        end

        # Handle both parent_id and position changes in a single atomic update
        if position_data.key?(:parent_id)
          # When changing parent, we need to update both parent_id and position together
          # to avoid acts_as_list conflicts and lock version issues
          task.update!(
            parent_id: position_data[:parent_id],
            position: position_data[:position].to_i
          )
        else
          # If only position is changing, update directly
          task.update!(position: position_data[:position].to_i)
        end
      end
    end

    render json: {
      status: "success",
      timestamp: Time.current,
      job_lock_version: @job.reload.lock_version,
      tasks: @job.tasks.order(:position).map { |t| {
        id: t.id,
        lock_version: t.lock_version,
        position: t.position,
        parent_id: t.parent_id,
        title: t.title
      } }
    }
  rescue ActiveRecord::StaleObjectError => e
    conflict_data = if e.record.is_a?(Job)
      {
        error: "Job has been modified by another user",
        conflict: true,
        current_state: {
          job_lock_version: e.record.lock_version
        }
      }
    else
      {
        error: "One or more tasks have been modified by another user",
        conflict: true,
        current_state: {
          job_lock_version: @job.reload.lock_version,
          tasks: @job.tasks.map do |task|
            {
              id: task.id,
              title: task.title,
              position: task.position,
              parent_id: task.parent_id,
              status: task.status,
              lock_version: task.lock_version
            }
          end
        }
      }
    end

    render json: conflict_data, status: :conflict
  rescue ActiveRecord::RecordNotFound
    render json: {
      error: "One or more tasks not found"
    }, status: :not_found
  end

  def batch_reorder_relative
    if params[:relative_positions].blank?
      render json: { error: "Relative positions parameter required" }, status: :unprocessable_entity
      return
    end

    # Use a transaction to ensure all updates succeed or all fail
    Task.transaction do
      # If job lock_version is provided, verify it hasn't changed
      if params[:job_lock_version]
        expected_job_lock = params[:job_lock_version].to_i
        if @job.lock_version != expected_job_lock
          raise ActiveRecord::StaleObjectError.new(@job, "lock_version")
        end
      end

      params[:relative_positions].each do |position_data|
        task = @job.tasks.find(position_data[:id])

        # Check lock_version if provided
        if position_data[:lock_version]
          expected_lock = position_data[:lock_version].to_i
          if task.lock_version != expected_lock
            raise ActiveRecord::StaleObjectError.new(task, "lock_version")
          end
        end

        # Handle relative positioning using custom system
        position_update = {}

        # Handle parent_id change
        if position_data.key?(:parent_id)
          position_update[:parent_id] = position_data[:parent_id]
        end

        # Handle relative positioning using our custom system
        if position_data[:before_task_id]
          # Position before specific task - use repositioned_after_id of the task before the target
          target_task = @job.tasks.find(position_data[:before_task_id])
          before_target = @job.tasks.kept
                                   .where(job_id: @job.id, parent_id: position_data[:parent_id])
                                   .where("position < ?", target_task.position)
                                   .order(:position)
                                   .last
          if before_target
            position_update[:repositioned_after_id] = before_target.id
          else
            position_update[:repositioned_to_top] = true
          end
          position_update[:position_finalized] = false
        elsif position_data[:after_task_id]
          # Position after specific task
          position_update[:repositioned_after_id] = position_data[:after_task_id]
          position_update[:position_finalized] = false
        elsif position_data[:position] == "first"
          # Position at the beginning
          position_update[:repositioned_to_top] = true
          position_update[:position_finalized] = false
        elsif position_data[:position] == "last"
          # Position at the end - let server calculate end position
          position_update[:repositioned_after_id] = nil
          position_update[:repositioned_to_top] = false
          position_update[:position_finalized] = false
        end

        # Apply the positioning update
        task.update!(position_update)
      end
    end

    render json: {
      status: "success",
      timestamp: Time.current,
      job_lock_version: @job.reload.lock_version,
      tasks: @job.tasks.order(:position).map { |t| {
        id: t.id,
        lock_version: t.lock_version,
        position: t.position,
        parent_id: t.parent_id,
        title: t.title
      } }
    }
  rescue ActiveRecord::StaleObjectError => e
    conflict_data = if e.record.is_a?(Job)
      {
        error: "Job has been modified by another user",
        conflict: true,
        current_state: {
          job_lock_version: e.record.lock_version
        }
      }
    else
      {
        error: "One or more tasks have been modified by another user",
        conflict: true,
        current_state: {
          job_lock_version: @job.reload.lock_version,
          tasks: @job.tasks.map do |task|
            {
              id: task.id,
              title: task.title,
              position: task.position,
              parent_id: task.parent_id,
              status: task.status,
              lock_version: task.lock_version
            }
          end
        }
      }
    end

    render json: conflict_data, status: :conflict
  rescue ActiveRecord::RecordNotFound
    render json: {
      error: "One or more tasks not found"
    }, status: :not_found
  end

  def update_status
    status = params[:status]

    if status.blank?
      render json: { error: "Status parameter required" }, status: :unprocessable_entity
      return
    end

    if @task.update(status: status)
      render json: {
        status: "success",
        task: task_attributes(@task)
      }
    else
      render json: {
        errors: @task.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/jobs/:job_id/tasks/rebalance
  # Rebalances task positions to ensure even spacing and prevent precision issues
  def rebalance
    # Optional parameters for customization
    parent_id = params[:parent_id] # Rebalance only tasks with this parent_id
    spacing = params[:spacing]&.to_i || 10000 # Default spacing between tasks

    Task.transaction do
      # Get tasks to rebalance
      tasks_scope = @job.tasks.kept
      tasks_scope = tasks_scope.where(parent_id: parent_id) if params.key?(:parent_id)
      tasks = tasks_scope.order(:position)

      # Check if rebalancing is needed
      if tasks.count > 1 && needs_rebalancing?(tasks)
        # Rebalance positions with even spacing
        tasks.each_with_index do |task, index|
          new_position = spacing * (index + 1)
          task.update_column(:position, new_position) if task.position != new_position
        end

        render json: {
          status: "success",
          message: "Tasks rebalanced successfully",
          tasks_rebalanced: tasks.count,
          timestamp: Time.current
        }
      else
        render json: {
          status: "success",
          message: "No rebalancing needed",
          tasks_checked: tasks.count,
          timestamp: Time.current
        }
      end
    end
  rescue => e
    Rails.logger.error "Task rebalancing failed: #{e.message}"
    render json: {
      error: "Failed to rebalance tasks: #{e.message}"
    }, status: :internal_server_error
  end

  private

  def set_current_user
    User.current_user = current_user
  end

  def find_job
    # Use the same permission logic as the Jobs API controller
    if current_user.admin? || current_user.owner?
      # Admins/owners can access any job
      @job = Job.includes(:tasks).find(params[:job_id])
    else
      # Regular users can only access jobs they're assigned to
      @job = current_user.technician_jobs.includes(:tasks).find(params[:job_id])
    end
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Job not found or not accessible" }, status: :not_found
  end

  def find_task
    @task = @job.tasks.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Task not found" }, status: :not_found
  end

  def task_params
    params.require(:task).permit(:title, :status, :parent_id, :position, :assigned_to_id, :after_task_id,
                                  :repositioned_after_id, :position_finalized, :repositioned_to_top)
  end

  def task_attributes(task)
    {
      id: task.id,
      title: task.title,
      status: task.status,
      position: task.position,
      parent_id: task.parent_id,
      created_at: task.created_at,
      updated_at: task.updated_at,
      lock_version: task.lock_version
    }
  end

  def build_included_users
    users = @tasks.filter_map(&:assigned_to).uniq
    users.map do |user|
      {
        type: "users",
        id: user.id,
        attributes: {
          name: user.name,
          email: user.email
        }
      }
    end
  end

  def build_included_users_for_batch(tasks)
    users = tasks.filter_map(&:assigned_to).uniq
    users.map do |user|
      {
        type: "users",
        id: user.id,
        attributes: {
          name: user.name,
          email: user.email
        }
      }
    end
  end

  def available_technicians_data
    Rails.cache.fetch("available_technicians_data", expires_in: 5.minutes) do
      User.technician.map do |user|
        {
          id: user.id,
          name: user.name,
          initials: user.initials
        }
      end
    end
  end

  # Check if tasks need rebalancing based on position gaps
  def needs_rebalancing?(tasks)
    return false if tasks.count < 2

    # Configuration
    min_gap_threshold = 2 # Minimum gap size that indicates potential precision issues
    max_gap_ratio = 100 # Maximum ratio between largest and smallest gap

    positions = tasks.pluck(:position)
    gaps = []

    # Calculate gaps between consecutive positions
    (1...positions.length).each do |i|
      gap = positions[i] - positions[i-1]
      gaps << gap if gap > 0
    end

    return false if gaps.empty?

    min_gap = gaps.min
    max_gap = gaps.max

    # Check if any gap is too small (indicating precision issues)
    return true if min_gap < min_gap_threshold

    # Check if gap variance is too high (indicating uneven distribution)
    return true if max_gap > min_gap * max_gap_ratio

    # Check if we're approaching integer limits
    last_position = positions.last
    return true if last_position > 2_000_000_000 # Leave room before 32-bit int limit

    false
  end
end
