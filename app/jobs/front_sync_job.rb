# Background job for Front API synchronization
# Handles syncing different resource types with robust error handling and retry logic
class FrontSyncJob < ApplicationJob
  include FrontSyncErrorHandler

  queue_as :default

  # Retry configuration for Front API errors
  retry_on FrontSyncErrorHandler::NetworkError,
           wait: :exponentially_longer,
           attempts: 5

  retry_on FrontSyncErrorHandler::RateLimitError,
           wait: :exponentially_longer,
           attempts: 3

  # Don't retry authentication errors or circuit breaker errors
  discard_on FrontSyncErrorHandler::AuthenticationError
  discard_on FrontSyncErrorHandler::CircuitBreakerOpenError

  # Main job execution method
  def perform(resource_type, sync_type = "full", since: nil)
    Rails.logger.tagged("FrontSyncJob", resource_type, sync_type) do
      Rails.logger.info "Starting Front sync: #{resource_type} (#{sync_type})"

      validate_parameters!(resource_type, sync_type)

      # Use error handling wrapper
      result = sync_with_error_handling(resource_type, sync_type) do
        execute_sync(resource_type, sync_type, since)
      end

      Rails.logger.info "Completed Front sync: #{resource_type} - #{result[:created]} created, #{result[:updated]} updated, #{result[:failed]} failed"
      result
    end
  rescue => error
    Rails.logger.error "Front sync job failed for #{resource_type}: #{error.message}"
    raise # Re-raise to trigger ActiveJob retry logic
  end

  private

  # Validate job parameters
  def validate_parameters!(resource_type, sync_type)
    valid_resource_types = %w[all contacts tags inboxes conversations messages teammates channels comments]
    valid_sync_types = %w[full incremental]

    unless valid_resource_types.include?(resource_type)
      raise ArgumentError, "Invalid resource_type: #{resource_type}. Must be one of: #{valid_resource_types.join(', ')}"
    end

    unless valid_sync_types.include?(sync_type)
      raise ArgumentError, "Invalid sync_type: #{sync_type}. Must be one of: #{valid_sync_types.join(', ')}"
    end
  end

  # Execute the appropriate sync operation
  def execute_sync(resource_type, sync_type, since)
    case resource_type
    when "all"
      sync_all_resources(sync_type, since)
    else
      sync_single_resource(resource_type, sync_type, since)
    end
  end

  # Sync all resources using FrontSyncService
  def sync_all_resources(sync_type, since)
    service = FrontSyncService.new

    if sync_type == "incremental" && since
      # For incremental sync, we would need to modify FrontSyncService to handle 'since' parameter
      # For now, fall back to full sync
      Rails.logger.warn "Incremental sync not yet implemented for all resources, performing full sync"
    end

    service.sync_all
  end

  # Sync a single resource type
  def sync_single_resource(resource_type, sync_type, since)
    service_class_name = "FrontSync::#{resource_type.classify}SyncService"

    begin
      service_class = service_class_name.constantize
    rescue NameError
      raise ArgumentError, "No sync service found for resource type: #{resource_type} (expected #{service_class_name})"
    end

    service = service_class.new

    # Execute sync based on type
    case sync_type
    when "full"
      # Use sync_all which is the actual method name
      if service.respond_to?(:sync_all)
        service.sync_all
      else
        raise NoMethodError, "#{service_class_name} does not implement sync_all method"
      end
    when "incremental"
      # For incremental, use sync_all with since parameter
      if service.respond_to?(:sync_all)
        service.sync_all(since: since || 1.day.ago)
      else
        Rails.logger.warn "Incremental sync not supported for #{resource_type}, performing full sync"
        service.sync_all
      end
    end

    service.stats
  end

  # Override error handling to provide job-specific context
  def log_error_with_context(error, context = {})
    job_context = {
      job_class: self.class.name,
      job_id: job_id,
      queue_name: queue_name,
      executions: executions,
      **context
    }

    super(error, job_context)
  end

  # Check if sync should be skipped based on job history
  def should_skip_job?(resource_type)
    # Check for currently running jobs for the same resource
    running_jobs = ActiveJob::Base.queue_adapter.class.name == "ActiveJob::QueueAdapters::SolidQueueAdapter" ?
                   check_solid_queue_running_jobs(resource_type) :
                   false

    if running_jobs
      Rails.logger.info "Skipping #{resource_type} sync - another job is already running"
      return true
    end

    # Use parent class method for other checks
    should_skip_sync?(resource_type)
  end

  # Check for running jobs in Solid Queue
  def check_solid_queue_running_jobs(resource_type)
    return false unless defined?(SolidQueue)

    # Check for running jobs with same arguments
    SolidQueue::Job.where(
      job_class_name: "FrontSyncJob",
      status: [ "pending", "running" ]
    ).any? { |job|
      job.arguments&.first == resource_type
    }
  rescue => e
    Rails.logger.warn "Could not check for running jobs: #{e.message}"
    false
  end

  # Enhanced job metrics and monitoring
  def record_job_metrics(resource_type, sync_type, result, duration)
    # Record basic metrics
    Rails.logger.info "Job metrics: #{resource_type}/#{sync_type} - Duration: #{duration.round(2)}s, Results: #{result}"

    # Integration point for metrics services (DataDog, StatsD, etc.)
    # StatsD.increment('front_sync.jobs.completed', tags: ["resource:#{resource_type}", "type:#{sync_type}"])
    # StatsD.timing('front_sync.jobs.duration', duration, tags: ["resource:#{resource_type}", "type:#{sync_type}"])
    # StatsD.gauge('front_sync.records.created', result[:created], tags: ["resource:#{resource_type}"])
    # StatsD.gauge('front_sync.records.updated', result[:updated], tags: ["resource:#{resource_type}"])
    # StatsD.gauge('front_sync.records.failed', result[:failed], tags: ["resource:#{resource_type}"])
  end

  # Job completion callback
  def after_perform(*args)
    resource_type, sync_type = args
    Rails.logger.info "FrontSyncJob completed successfully for #{resource_type} (#{sync_type})"
  end

  # Job error callback
  def rescue_with_handler(exception)
    Rails.logger.error "FrontSyncJob failed with #{exception.class}: #{exception.message}"
    super
  end
end
