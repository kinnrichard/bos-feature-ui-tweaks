class RebalanceTasksJob < ApplicationJob
  queue_as :default

  def perform(job_id, parent_id)
    # Set flag to prevent recursive rebalancing checks
    Thread.current[:skip_rebalancing_check] = true

    begin
      # Get all tasks in the scope that need rebalancing
      tasks = Task.kept
                  .where(job_id: job_id, parent_id: parent_id)
                  .order(:position)

      return if tasks.count < 2

      # Check if rebalancing is still needed (another job might have done it)
      positions = tasks.pluck(:position)
      return unless needs_rebalancing?(positions)

      # Rebalance with even spacing
      spacing = 10000

      Task.transaction do
        tasks.each_with_index do |task, index|
          new_position = spacing * (index + 1)
          # Use update_column to skip callbacks and avoid recursion
          task.update_column(:position, new_position) if task.position != new_position
        end
      end

      Rails.logger.info "Rebalanced #{tasks.count} tasks for job_id: #{job_id}, parent_id: #{parent_id}"
    ensure
      Thread.current[:skip_rebalancing_check] = false
    end
  end

  private

  def needs_rebalancing?(positions)
    return false if positions.length < 2

    # Check minimum gap
    gaps = []
    (1...positions.length).each do |i|
      gap = positions[i] - positions[i-1]
      gaps << gap if gap > 0
    end

    return false if gaps.empty?

    min_gap = gaps.min
    min_gap < 2 || positions.last > 2_000_000_000
  end
end
