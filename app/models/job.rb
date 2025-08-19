class Job < ApplicationRecord
  include Loggable

  belongs_to :client

  has_many :job_assignments, dependent: :destroy
  has_many :technicians, through: :job_assignments, source: :user
  has_many :job_people, dependent: :destroy
  has_many :people, through: :job_people
  has_many :job_targets, dependent: :destroy
  has_many :tasks, -> { kept }, dependent: :destroy
  has_many :all_tasks, -> { with_discarded }, class_name: "Task", dependent: :destroy
  has_many :notes, as: :notable, dependent: :destroy
  has_many :scheduled_date_times, as: :schedulable, dependent: :destroy

  enum :status, {
    open: "open",
    in_progress: "in_progress",
    paused: "paused",
    waiting_for_customer: "waiting_for_customer",
    waiting_for_scheduled_appointment: "waiting_for_scheduled_appointment",
    successfully_completed: "successfully_completed",
    cancelled: "cancelled"
  }

  enum :priority, {
    critical: "critical",
    very_high: "very_high",
    high: "high",
    normal: "normal",
    low: "low",
    proactive_followup: "proactive_followup"
  }

  validates :title, presence: true
  validates :status, presence: true
  validates :priority, presence: true

  # Scopes
  scope :my_jobs, ->(user) { joins(:job_assignments).where(job_assignments: { user_id: user.id }) }
  scope :unassigned, -> { left_joins(:job_assignments).where(job_assignments: { id: nil }) }
  scope :assigned_to_others, ->(user) {
    joins(:job_assignments)
    .where.not(job_assignments: { user_id: user.id })
    .distinct
  }
  scope :closed, -> { where(status: [ :successfully_completed, :cancelled ]) }
  scope :active, -> { where.not(status: [ :successfully_completed, :cancelled ]) }
  scope :overdue, -> { where("due_at < ?", Time.current) }
  scope :upcoming, -> { where("due_at >= ?", Date.current.beginning_of_day) }

  # Set defaults
  after_initialize :set_defaults, if: :new_record?

  # Temporarily disable optimistic locking to prevent stale object errors
  self.locking_column = nil

  # Convenience methods for date/time handling
  def overdue?
    return false unless due_at
    due_at < Time.current
  end

  def days_until_due
    return nil unless due_at
    ((due_at.to_date - Date.current).to_i)
  end

  # Scheduled DateTime helpers
  def due_date
    scheduled_date_times.due_dates.first
  end

  def start_date
    scheduled_date_times.start_dates.first
  end

  def followup_dates
    scheduled_date_times.followup_dates
  end

  def upcoming_scheduled_dates
    scheduled_date_times.upcoming
  end

  def has_scheduled_dates?
    scheduled_date_times.any?
  end

  # Value object integration
  def status_object
    @status_object ||= JobStatus.new(status)
  end

  def priority_object
    @priority_object ||= JobPriority.new(priority)
  end

  # Delegate display methods to value objects
  delegate :emoji, :label, :color, :with_emoji,
           to: :status_object,
           prefix: :status

  delegate :emoji, :label, :color, :with_emoji, :sort_order,
           to: :priority_object,
           prefix: :priority

  # Merge another job into this one
  # @param other_job [Job] The job to merge into this one
  # @param options [Hash] Options for the merge
  # @option options [Boolean] :keep_other_description (true) Whether to append the other job's description
  # @option options [Boolean] :delete_other (true) Whether to delete the other job after merging
  # @return [Boolean] true if merge was successful
  def merge_with!(other_job, options = {})
    return false if other_job.id == self.id
    return false unless other_job.is_a?(Job)

    options = {
      keep_other_description: true,
      delete_other: true
    }.merge(options)

    transaction do
      # Move all tasks from the other job to this job
      other_job.all_tasks.update_all(job_id: self.id)

      # Move all job assignments (technicians)
      other_job.job_assignments.each do |assignment|
        # Only add if not already assigned
        unless job_assignments.exists?(user_id: assignment.user_id)
          job_assignments.create!(
            user_id: assignment.user_id,
            assigned_at: assignment.assigned_at
          )
        end
      end

      # Move all job_people associations
      other_job.job_people.each do |job_person|
        # Only add if not already associated
        unless job_people.exists?(person_id: job_person.person_id)
          job_people.create!(person_id: job_person.person_id)
        end
      end

      # Move all notes
      other_job.notes.update_all(notable_id: self.id)

      # Move all scheduled_date_times
      other_job.scheduled_date_times.update_all(schedulable_id: self.id)

      # Move all job_targets
      other_job.job_targets.update_all(job_id: self.id)

      # Merge descriptions if requested
      if options[:keep_other_description] && other_job.description.present?
        if self.description.present? && self.description != other_job.description
          self.description = "#{self.description}\n\n--- Merged from job: #{other_job.title} ---\n#{other_job.description}"
        elsif self.description.blank?
          self.description = other_job.description
        end
        self.save!
      end

      # Update status if this job is completed but other has active work
      if self.status == "successfully_completed" && other_job.status != "successfully_completed"
        self.status = other_job.status
        self.save!
      end

      # Take the higher priority
      if priority_object.sort_order > other_job.priority_object.sort_order
        self.priority = other_job.priority
        self.save!
      end

      # Take the earlier due date if present
      if other_job.due_at.present? && (self.due_at.nil? || other_job.due_at < self.due_at)
        self.due_at = other_job.due_at
        self.due_time_set = other_job.due_time_set
        self.save!
      end

      # Delete the other job if requested
      if options[:delete_other]
        other_job.reload # Reload to clear associations
        other_job.destroy!
      end

      true
    end
  rescue => e
    Rails.logger.error "Failed to merge job #{other_job.id} into #{self.id}: #{e.message}"
    false
  end

  # Class method to merge all duplicate jobs with the same title for a client
  # @param client [Client] The client whose jobs to check
  # @param title [String] The job title to look for duplicates
  # @return [Job, nil] The primary job after merging, or nil if none found
  def self.merge_duplicates_for_client(client, title)
    jobs = client.jobs.where(title: title).order(:created_at)

    return nil if jobs.empty?
    return jobs.first if jobs.count == 1

    primary_job = jobs.first
    jobs.offset(1).each do |duplicate_job|
      primary_job.merge_with!(duplicate_job)
    end

    primary_job.reload
  end

  # Class method to find and merge all duplicate "Legacy Tasks" jobs
  # @return [Hash] Statistics about the merge operation
  def self.merge_all_legacy_tasks_duplicates
    stats = {
      clients_processed: 0,
      jobs_merged: 0,
      tasks_moved: 0
    }

    # Find all clients with Legacy Tasks jobs
    clients_with_legacy = Client.joins(:jobs)
                                .where(jobs: { title: "Legacy Tasks" })
                                .distinct

    clients_with_legacy.find_each do |client|
      legacy_jobs = client.jobs.where(title: "Legacy Tasks").order(:created_at)

      if legacy_jobs.count > 1
        primary_job = legacy_jobs.first

        legacy_jobs.offset(1).each do |duplicate_job|
          tasks_count = duplicate_job.all_tasks.count
          if primary_job.merge_with!(duplicate_job)
            stats[:jobs_merged] += 1
            stats[:tasks_moved] += tasks_count
          end
        end

        stats[:clients_processed] += 1
      end
    end

    stats
  end

  private

  def set_defaults
    self.status ||= :open
    self.priority ||= :normal
  end
end
