class TaskSortingService
  def initialize(job)
    @job = job
  end

  def sort_and_resolve_conflicts(task_updates = [])
    # Process updates by timestamp to resolve conflicts
    sorted_updates = task_updates.sort_by { |update| update[:timestamp] || Time.current }

    sorted_updates.each do |update|
      task = @job.tasks.find(update[:id])

      # Update parent if changed
      if update[:parent_id] != task.parent_id
        task.parent_id = update[:parent_id]
        task.save! # Save parent change before position update
      end

      # Update position if provided
      if update[:position].present?
        task.update(position: update[:position].to_i)
      end

      # Update reordered_at timestamp
      task.update_column(:reordered_at, Time.current)
    end

    # Return all tasks properly ordered
    get_ordered_tasks
  end

  def get_ordered_tasks
    # Always use position-based ordering now - let frontend handle display logic
    # Get root tasks with proper ordering and preload associations
    root_tasks = @job.tasks
      .includes(:notes, :assigned_to, subtasks: [ :notes, :assigned_to ])
      .root_tasks
      .order(:position)

    # Build complete task tree
    tasks_tree = []
    root_tasks.each do |task|
      tasks_tree << build_task_tree(task)
    end

    tasks_tree
  end

  private

  def build_task_tree(task, depth = 0)
    # Always use position-based ordering for subtasks too
    {
      task: task,
      depth: depth,
      subtasks: task.subtasks.order(:position).map { |subtask|
        build_task_tree(subtask, depth + 1)
      }
    }
  end
end
