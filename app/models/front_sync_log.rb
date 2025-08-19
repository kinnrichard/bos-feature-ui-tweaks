# Model for tracking Front API synchronization operations
# Provides audit trail and monitoring capabilities for sync jobs
class FrontSyncLog < ApplicationRecord
  # Validations
  validates :resource_type, presence: true
  validates :sync_type, presence: true
  validates :status, presence: true, inclusion: { in: %w[running completed completed_with_errors failed skipped] }
  validates :started_at, presence: true
  validates :records_synced, :records_created, :records_updated, :records_failed,
            presence: true, numericality: { greater_than_or_equal_to: 0 }

  # Validation that completed syncs have completion time
  validates :completed_at, presence: true, if: -> { status.in?(%w[completed completed_with_errors failed skipped]) }

  # Scopes for common queries
  scope :recent, ->(limit = 50) { order(started_at: :desc).limit(limit) }
  scope :for_resource, ->(resource_type) { where(resource_type: resource_type) }
  scope :successful, -> { where(status: "completed") }
  scope :with_errors, -> { where(status: "completed_with_errors") }
  scope :failed, -> { where(status: "failed") }
  scope :running, -> { where(status: "running") }
  scope :completed, -> { where(status: %w[completed completed_with_errors]) }
  scope :skipped, -> { where(status: "skipped") }
  scope :today, -> { where(started_at: Date.current.beginning_of_day..Date.current.end_of_day) }
  scope :last_24_hours, -> { where(started_at: 24.hours.ago..Time.current) }
  scope :last_week, -> { where(started_at: 7.days.ago..Time.current) }

  # Class methods for reporting
  def self.latest_for_resource(resource_type)
    for_resource(resource_type).order(started_at: :desc).first
  end

  def self.success_rate_for_resource(resource_type, period: 7.days)
    logs = for_resource(resource_type).where(started_at: period.ago..Time.current)
    return 0 if logs.empty?

    successful = logs.successful.count
    total = logs.completed.count
    return 0 if total.zero?

    (successful.to_f / total * 100).round(2)
  end

  def self.sync_summary(period: 7.days)
    logs = where(started_at: period.ago..Time.current).completed

    {
      total_syncs: logs.count,
      successful_syncs: logs.successful.count,
      syncs_with_errors: logs.with_errors.count,
      total_records_synced: logs.sum(:records_synced),
      total_records_created: logs.sum(:records_created),
      total_records_updated: logs.sum(:records_updated),
      total_records_failed: logs.sum(:records_failed),
      average_duration: logs.where.not(duration_seconds: nil).average(:duration_seconds)&.round(2),
      by_resource_type: logs.group(:resource_type).count
    }
  end

  # Instance methods
  def duration
    return nil unless started_at && completed_at
    completed_at - started_at
  end

  def success_rate
    return 0 if records_synced.zero?
    ((records_synced - records_failed).to_f / records_synced * 100).round(2)
  end

  def completed?
    status.in?(%w[completed completed_with_errors failed skipped])
  end

  def successful?
    status == "completed"
  end

  def has_errors?
    status == "completed_with_errors" || error_messages.any?
  end

  def running?
    status == "running"
  end

  def failed?
    status == "failed"
  end

  def skipped?
    status == "skipped"
  end

  # Mark sync as completed
  def mark_completed!(final_stats = {})
    update!(
      status: final_stats[:failed]&.positive? ? "completed_with_errors" : "completed",
      completed_at: Time.current,
      records_synced: final_stats[:created].to_i + final_stats[:updated].to_i,
      records_created: final_stats[:created].to_i,
      records_updated: final_stats[:updated].to_i,
      records_failed: final_stats[:failed].to_i,
      error_messages: final_stats[:errors] || [],
      duration_seconds: duration
    )
  end

  # Mark sync as failed
  def mark_failed!(error_message)
    update!(
      status: "failed",
      completed_at: Time.current,
      error_messages: (error_messages || []) + [ error_message ],
      duration_seconds: duration
    )
  end

  # Add error message while keeping sync running
  def add_error(message)
    self.error_messages = (error_messages || []) + [ message ]
    save!
  end

  # Update progress during sync
  def update_progress!(stats)
    update!(
      records_synced: stats[:created].to_i + stats[:updated].to_i,
      records_created: stats[:created].to_i,
      records_updated: stats[:updated].to_i,
      records_failed: stats[:failed].to_i
    )
  end

  # Human readable status
  def status_description
    case status
    when "running"
      "Sync in progress"
    when "completed"
      "Successfully completed"
    when "completed_with_errors"
      "Completed with #{records_failed} failed records"
    when "failed"
      "Sync failed"
    when "skipped"
      "Sync skipped"
    end
  end

  # Summary for logging/display
  def summary
    if completed?
      "#{resource_type} sync: #{records_created} created, #{records_updated} updated, #{records_failed} failed (#{duration_seconds&.round(2)}s)"
    else
      "#{resource_type} sync: #{status} since #{started_at.strftime('%H:%M:%S')}"
    end
  end

  def to_s
    "FrontSyncLog[#{id}] #{resource_type} #{status}"
  end
end
