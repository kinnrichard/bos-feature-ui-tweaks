# Background job scheduler for Front API synchronization
# Manages recurring sync operations and determines what needs syncing
class FrontSyncSchedulerJob < ApplicationJob
  include FrontSyncErrorHandler

  queue_as :default

  # Sync scheduling configuration
  # Only include resources that have corresponding sync services
  SYNC_INTERVALS = {
    "contacts" => { full: 1.hour },
    "conversations" => { full: 24.hours, incremental: 15.minutes },
    "messages" => { incremental: 1.hour }, # Messages only do incremental
    "tags" => { full: 24.hours },
    "inboxes" => { full: 24.hours },
    "teammates" => { full: 24.hours }
  }.freeze

  # Priority order for sync operations (removed channels and comments)
  SYNC_PRIORITY = %w[tags inboxes teammates contacts conversations messages].freeze

  def perform(force_sync: false)
    Rails.logger.tagged("FrontSyncScheduler") do
      Rails.logger.info "Starting Front sync scheduling check (force: #{force_sync})"

      scheduled_jobs = []

      SYNC_PRIORITY.each do |resource_type|
        jobs_for_resource = schedule_resource_syncs(resource_type, force_sync)
        scheduled_jobs.concat(jobs_for_resource)
      end

      Rails.logger.info "Scheduled #{scheduled_jobs.size} sync jobs: #{scheduled_jobs.map(&:first).join(', ')}"
      scheduled_jobs
    end
  rescue => error
    Rails.logger.error "Front sync scheduler failed: #{error.message}"
    log_error_with_context(error, { scheduler_run: Time.current })
    raise
  end

  private

  # Schedule syncs for a specific resource type
  def schedule_resource_syncs(resource_type, force_sync)
    scheduled_jobs = []
    intervals = SYNC_INTERVALS[resource_type]

    return scheduled_jobs unless intervals

    intervals.each do |sync_type, interval|
      if should_schedule_sync?(resource_type, sync_type.to_s, interval, force_sync)
        job_args = build_job_arguments(resource_type, sync_type.to_s)

        # Schedule the job
        if job_args.length > 2
          FrontSyncJob.perform_later(job_args[0], job_args[1], **job_args[2])
        else
          FrontSyncJob.perform_later(*job_args)
        end
        scheduled_jobs << [ resource_type, sync_type.to_s ]

        Rails.logger.info "Scheduled #{sync_type} sync for #{resource_type}"
      end
    end

    scheduled_jobs
  end

  # Determine if a sync should be scheduled
  def should_schedule_sync?(resource_type, sync_type, interval, force_sync)
    return true if force_sync

    # Check if there's already a pending/running job
    if job_already_queued?(resource_type, sync_type)
      Rails.logger.debug "Skipping #{resource_type} #{sync_type} sync - job already queued"
      return false
    end

    # Check circuit breaker status
    operation_key = "sync_#{resource_type}"
    if self.class.circuit_breaker_open?(operation_key)
      Rails.logger.debug "Skipping #{resource_type} #{sync_type} sync - circuit breaker open"
      return false
    end

    # Check last sync time
    last_sync = get_last_sync_time(resource_type, sync_type)

    if last_sync.nil?
      Rails.logger.debug "Scheduling #{resource_type} #{sync_type} sync - no previous sync found"
      return true
    end

    time_since_last = Time.current - last_sync
    needs_sync = time_since_last >= interval

    Rails.logger.debug "#{resource_type} #{sync_type}: last sync #{time_since_last.round}s ago, interval #{interval}s, needs sync: #{needs_sync}"

    needs_sync
  end

  # Check if a job is already queued for this resource/sync type
  def job_already_queued?(resource_type, sync_type)
    # For GoodJob, check the jobs table
    if defined?(GoodJob)
      check_good_job_jobs(resource_type, sync_type)
    else
      # For other adapters, we can't easily check pending jobs
      false
    end
  end

  # Check GoodJob for existing jobs
  def check_good_job_jobs(resource_type, sync_type)
    GoodJob::Job.where(
      job_class: "FrontSyncJob",
      finished_at: nil
    ).any? do |job|
      args = job.serialized_params.dig("arguments")
      args&.first == resource_type && args&.second == sync_type
    end
  rescue => e
    Rails.logger.warn "Could not check queued jobs: #{e.message}"
    false
  end

  # Get the last sync time for a resource/sync type combination
  def get_last_sync_time(resource_type, sync_type)
    last_log = FrontSyncLog.where(
      resource_type: resource_type,
      sync_type: sync_type,
      status: %w[completed completed_with_errors]
    ).order(started_at: :desc).first

    last_log&.started_at
  end

  # Build job arguments with appropriate parameters
  def build_job_arguments(resource_type, sync_type)
    args = [ resource_type, sync_type ]

    # For incremental syncs, add 'since' parameter based on last sync
    if sync_type == "incremental"
      last_sync_time = get_last_successful_sync_time(resource_type)
      since_time = last_sync_time || 1.day.ago
      args << { since: since_time }
    end

    args
  end

  # Get last successful sync time (used for incremental syncs)
  def get_last_successful_sync_time(resource_type)
    last_log = FrontSyncLog.where(
      resource_type: resource_type,
      status: "completed"
    ).order(completed_at: :desc).first

    last_log&.completed_at
  end

  # Health check method to verify scheduler is working
  def self.health_check
    last_run = FrontSyncLog.where(
      resource_type: "scheduler_health",
      status: "completed"
    ).order(started_at: :desc).first

    if last_run.nil? || last_run.started_at < 2.hours.ago
      return {
        status: "unhealthy",
        message: "Scheduler has not run recently",
        last_run: last_run&.started_at
      }
    end

    {
      status: "healthy",
      message: "Scheduler is running normally",
      last_run: last_run.started_at
    }
  end

  # Record scheduler health
  def record_scheduler_health
    FrontSyncLog.create!(
      resource_type: "scheduler_health",
      sync_type: "health_check",
      started_at: Time.current,
      completed_at: Time.current,
      status: "completed",
      records_synced: 0,
      records_created: 0,
      records_updated: 0,
      records_failed: 0,
      error_messages: [],
      metadata: { scheduler_version: "1.0", ruby_version: RUBY_VERSION }
    )
  end

  # Add after_perform callback to record health
  after_perform do |job|
    record_scheduler_health
  end

  # Scheduler-specific metrics
  def record_scheduler_metrics(scheduled_count, resource_breakdown)
    Rails.logger.info "Scheduler metrics: #{scheduled_count} jobs scheduled, breakdown: #{resource_breakdown}"

    # Integration point for metrics services
    # StatsD.gauge('front_sync.scheduler.jobs_scheduled', scheduled_count)
    # resource_breakdown.each do |resource, count|
    #   StatsD.gauge('front_sync.scheduler.by_resource', count, tags: ["resource:#{resource}"])
    # end
  end

  # Emergency stop method to halt all scheduled syncs
  def self.emergency_stop!(reason = "Manual intervention")
    Rails.logger.warn "EMERGENCY STOP: Halting all Front sync operations - #{reason}"

    # Open circuit breakers for all resources
    SYNC_INTERVALS.keys.each do |resource_type|
      operation_key = "sync_#{resource_type}"
      record_circuit_breaker_failure(operation_key, StandardError.new("Emergency stop: #{reason}"))
    end

    # Cancel pending jobs if possible
    if defined?(GoodJob)
      pending_jobs = GoodJob::Job.where(
        job_class: "FrontSyncJob",
        finished_at: nil
      )

      Rails.logger.info "Discarding #{pending_jobs.count} pending Front sync jobs"
      pending_jobs.each(&:discard_job)
    end
  end

  # Resume operations after emergency stop
  def self.resume_operations!
    Rails.logger.info "RESUMING: Re-enabling Front sync operations"

    # Reset all circuit breakers
    SYNC_INTERVALS.keys.each do |resource_type|
      operation_key = "sync_#{resource_type}"
      reset_circuit_breaker(operation_key)
    end

    # Schedule immediate sync check
    FrontSyncSchedulerJob.perform_later(force_sync: false)
  end
end
