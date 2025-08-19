class Task < ApplicationRecord
  include Discard::Model
  include Loggable

  # Disable all touchable behavior for Task to prevent conflicts
  touchable_config disabled: true

  belongs_to :job, touch: false
  belongs_to :assigned_to, class_name: "User", optional: true
  belongs_to :parent, class_name: "Task", optional: true, counter_cache: :subtasks_count

  has_many :notes, as: :notable, dependent: :destroy
  has_many :activity_logs, as: :loggable, dependent: :destroy
  has_many :subtasks, class_name: "Task", foreign_key: :parent_id, dependent: :destroy

  has_one :client, through: :job

  belongs_to :repositioned_after, class_name: "Task", optional: true
  def repositioned_after_title
    repositioned_after&.title
  end

  has_one :next_repositioned_task, class_name: "Task", foreign_key: :repositioned_after_id, dependent: :nullify
  def next_repositioned_task_title
    next_repositioned_task&.title
  end


  enum :status, {
    new_task: "new_task",
    in_progress: "in_progress",
    paused: "paused",
    successfully_completed: "successfully_completed",
    cancelled: "cancelled"
  }

  validates :title, presence: true
  validates :status, presence: true
  validate :prevent_self_reference
  validate :prevent_circular_reference

  # Position management handled by custom calculate_position_from_repositioned_after method
  # (positioning gem removed to avoid conflicts with custom system)

  # Scopes - discard gem provides kept, discarded, with_discarded
  scope :root_tasks, -> { where(parent_id: nil) }
  scope :subtasks_of, ->(task) { where(parent_id: task.id) }

  # Consistent ordering by status - cancelled tasks go to the bottom
  scope :ordered_by_status, -> {
    order(Arel.sql("CASE
      WHEN status = 'in_progress' THEN 1
      WHEN status = 'paused' THEN 2
      WHEN status = 'new_task' THEN 3
      WHEN status = 'successfully_completed' THEN 4
      WHEN status = 'cancelled' THEN 5
      END, position ASC"))
  }

  # Set defaults
  after_initialize :set_defaults, if: :new_record?

  # Calculate position from repositioned_after_id if not finalized
  # Use after_initialize to set position before positioning gem sees it
  after_initialize :prepare_position_calculation, if: :new_record?
  before_validation :calculate_position_from_repositioned_after

  # Update reordered_at when position or parent changes
  before_save :update_reordered_at, if: -> { position_changed? || parent_id_changed? }

  # Touch job updated_at without incrementing lock_version
  # after_save :touch_job_updated_at
  # after_destroy :touch_job_updated_at

  # Check if automatic rebalancing is needed after position changes
  after_save :check_for_rebalancing, if: :saved_change_to_position?

  def inspect
    "<Task.find '#{id}'
          title: #{title}
       position: #{position}
      parent_id: #{parent_id}" +
    (repositioned_after_id ? " - repositioned_after_id: #{repositioned_after_id}" : "") +
      (repositioned_to_top ? " - repositioned_to_top: #{repositioned_to_top}" : "") +
    "
>"
  end

  # Temporarily disable optimistic locking for positioning compatibility testing
  self.locking_column = nil

  # Value object integration
  def status_object
    TaskStatus.new(status)
  end

  # Delegate display methods to value object
  delegate :emoji, :label, :color, :with_emoji,
           to: :status_object, prefix: :status

  # Calculate total time spent in 'in_progress' status
  def time_in_progress
    total_seconds = 0

    # Get all status change logs for this task, ordered by time
    status_logs = activity_logs
      .where(action: "status_changed")
      .order(:created_at)

    # Track when task went into in_progress
    in_progress_start = nil

    status_logs.each do |log|
      new_status = log.metadata["new_status"]

      if new_status == "in_progress"
        # Task went into in_progress
        in_progress_start = log.created_at
      elsif in_progress_start.present?
        # Task left in_progress status
        total_seconds += (log.created_at - in_progress_start)
        in_progress_start = nil
      end
    end

    # If currently in_progress, add time from last start to now
    if in_progress? && in_progress_start.present?
      total_seconds += (Time.current - in_progress_start)
    end

    total_seconds
  end

  # Format time in progress as human readable
  def formatted_time_in_progress
    TimeFormat.duration(time_in_progress)
  end

  # Check if this task has subtasks
  def has_subtasks?
    subtasks_count > 0
  end

  # Check if this is a subtask
  def is_subtask?
    parent_id.present?
  end

  # Custom discard method with subtask validation
  def discard_with_subtask_check
    return false if discarded?

    # Check if task has non-discarded subtasks
    if subtasks.kept.exists?
      errors.add(:base, "Cannot delete task with active subtasks. Please delete or move subtasks first.")
      return false
    end

    discard
  end

  # Get the root task (top-level parent)
  def root_task
    current = self
    while current.parent
      current = current.parent
    end
    current
  end

  # Calculate progress based on subtasks
  def progress_percentage
    return 100 if successfully_completed?
    return 0 unless has_subtasks?

    completed = subtasks.successfully_completed.count
    total = subtasks.count
    return 0 if total == 0

    (completed.to_f / total * 100).round
  end

  private

  def set_defaults
    self.status ||= :new_task
    # Only set position_finalized if it's truly nil (not explicitly set)
    # Default to false so position calculation runs for new tasks
    if position_finalized.nil?
      self.position_finalized = false
    end
  end

  def prevent_self_reference
    errors.add(:parent_id, "can't reference itself") if parent_id.present? && parent_id == id
  end

  def prevent_circular_reference
    return unless parent_id_changed? && parent_id.present?

    current = parent
    visited = Set.new([ id ])

    while current
      if visited.include?(current.id)
        errors.add(:parent_id, "would create a circular reference")
        break
      end
      visited.add(current.id)
      current = current.parent
    end
  end

  def update_reordered_at
    self.reordered_at = Time.current
  end

  def touch_job_updated_at
    # Update job's updated_at timestamp without incrementing lock_version
    # This preserves the "last activity" tracking without causing lock conflicts
    job.update_column(:updated_at, Time.current) if job.present?
  end

  def check_for_rebalancing
    # Skip if this is already part of a rebalancing operation
    return if Thread.current[:skip_rebalancing_check]

    # Get sibling tasks in the same scope
    siblings = Task.kept.where(job_id: job_id, parent_id: parent_id).order(:position).pluck(:id, :position)

    # Only check if there are enough tasks to matter
    return if siblings.count < 10

    # Check if rebalancing is needed
    if needs_automatic_rebalancing?(siblings)
      # Trigger rebalancing in background to avoid blocking
      RebalanceTasksJob.perform_later(job_id, parent_id)
    end
  end

  def needs_automatic_rebalancing?(siblings)
    return false if siblings.count < 2

    positions = siblings.map { |_, pos| pos }.compact
    return false if positions.length < 2

    gaps = []

    # Calculate gaps between consecutive positions
    (1...positions.length).each do |i|
      gap = positions[i] - positions[i-1]
      gaps << gap if gap > 0
    end

    return false if gaps.empty?

    min_gap = gaps.min

    # Trigger rebalancing if:
    # 1. Any gap is less than 2 (approaching precision limits)
    # 2. We're approaching integer limits
    min_gap < 2 || positions.last > 2_000_000_000
  end

  # Removed skip_lock_version_for_position_updates method - using locking_column = nil instead

  def prepare_position_calculation
    # Clear invalid repositioned_after_id early to avoid foreign key constraint
    if repositioned_after_id.present? && !Task.exists?(id: repositioned_after_id)
      self.repositioned_after_id = nil
    end

    # Only set temporary position if we don't have a position yet
    # and we're not finalized (meaning we need calculation)
    if !position_finalized? && position.blank?
      self.position = -999999999 # Temporary position
    end
  end

  def calculate_position_from_repositioned_after
    # Skip calculation if position is already finalized
    return if position_finalized?

    # Handle cases where position needs calculation:
    # 1. repositioned_to_top is true
    # 2. repositioned_after_id is present
    # 3. position is not set or is the temporary value
    needs_calculation = repositioned_to_top? ||
                       repositioned_after_id.present? ||
                       position.blank? ||
                       position == -999999999

    return unless needs_calculation

    # Handle top-of-list positioning
    if repositioned_to_top?
      # Find the minimum position in the current scope
      siblings = Task.kept.where(job_id: job_id, parent_id: parent_id)
                     .where.not(id: id) # Exclude self if updating

      # Only consider siblings with valid positions
      valid_siblings = siblings.where.not(position: nil)
      if valid_siblings.any?
        min_position = valid_siblings.minimum(:position) || 0
        # Generate random negative position before the first task
        self.position = rand(-10000...min_position.to_i).clamp(-2_000_000_000, min_position - 1)
      else
        # First task in the list or no valid positions
        self.position = rand(1000..10000)
      end
    elsif repositioned_after_id.present?
      # Position after a specific task
      after_task = Task.find_by(id: repositioned_after_id)

      if after_task && after_task.job_id == job_id && after_task.position.present?
        # Get the next sibling after the reference task
        next_sibling = Task.kept
                          .where(job_id: job_id, parent_id: parent_id)
                          .where("position > ?", after_task.position)
                          .where.not(id: id) # Exclude self if updating
                          .where.not(position: nil) # Exclude siblings with NIL positions
                          .order(:position)
                          .first

        if next_sibling
          # Calculate position between after_task and next_sibling
          gap = next_sibling.position - after_task.position

          if gap > 1
            # Place randomly in the middle 50% of the gap
            quarter_gap = gap / 4
            min_offset = quarter_gap
            max_offset = gap - quarter_gap

            # Add microsecond-based randomness to ensure different positions
            micro_random = Time.current.usec % 1000
            offset = rand(min_offset..max_offset) + (micro_random.to_f / 1000)
            self.position = (after_task.position + offset).floor.clamp(after_task.position + 1, next_sibling.position - 1)
          else
            # Gap too small, position right after
            self.position = after_task.position + 1
          end
        else
          # Last position - add standard spacing with randomization
          base_spacing = 10000
          # Use microseconds for additional randomness to keep within test expectations
          micro_random = Time.current.usec % 1000
          random_offset = rand(0..base_spacing/4) + micro_random  # Max 3500 instead of 10000
          self.position = after_task.position + base_spacing + random_offset
        end
      else
        # Referenced task not found or wrong job, fall back to end of list
        calculate_end_position
      end
    else
      # No specific repositioning requested, or position needs fixing
      # Place at end of list
      calculate_end_position
    end

    # Mark position as finalized after calculation
    self.position_finalized = true
    # Clear repositioning fields after use
    self.repositioned_after_id = nil
    self.repositioned_to_top = false
  end

  def calculate_end_position
    siblings = Task.kept.where(job_id: job_id, parent_id: parent_id)
                   .where.not(id: id) # Exclude self if updating
                   .where.not(position: nil) # Exclude siblings with NIL positions

    if siblings.any?
      max_position = siblings.maximum(:position) || 0
      base_spacing = 10000
      random_offset = rand(0...base_spacing/2)
      self.position = max_position + base_spacing + random_offset
    else
      # First task or no valid positions
      self.position = rand(1000..10000)
    end
  end
end
