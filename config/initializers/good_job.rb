# GoodJob configuration
Rails.application.configure do
  # Configure GoodJob for email parsing with Python/PyCall
  # IMPORTANT: Python/PyCall is not thread-safe, so we must limit concurrency

  config.good_job = {
    # Execution mode
    execution_mode: :external, # Run as separate process, not inline

    # Queue configuration with limited concurrency for parsing jobs
    queues: "*",
    max_threads: 1,  # CRITICAL: Only 1 thread to prevent Python/PyCall conflicts

    # Poll settings
    poll_interval: 1, # Check for new jobs every second

    # Shutdown settings
    shutdown_timeout: 30, # Give jobs 30 seconds to finish on shutdown

    # Enable cron for scheduled jobs
    enable_cron: true,

    # Define cron schedule for automatic Front sync
    cron: {
      front_sync_scheduler: {
        cron: "*/5 * * * *",  # Every 5 minutes
        class: "FrontSyncSchedulerJob",
        description: "Check and schedule Front API syncs based on configured intervals"
      }
    },

    # Dashboard settings
    dashboard_default_locale: :en,

    # Performance settings
    cleanup_interval_seconds: 600, # Clean up old job records every 10 minutes
    cleanup_preserved_jobs_before_seconds_ago: 86_400 # Keep job records for 24 hours
  }
end

# Configure GoodJob to handle parsing jobs carefully
if defined?(GoodJob)
  # Set default queue adapter options
  GoodJob.preserve_job_records = true
  GoodJob.retry_on_unhandled_error = false # Don't retry on unexpected errors

  # Log job execution
  GoodJob.on_thread_error = ->(exception) {
    Rails.logger.error "[GoodJob] Thread error: #{exception.class} - #{exception.message}"
    Rails.logger.error exception.backtrace.first(10).join("\n")

    # If it's a Python/PyCall error, log additional context
    if exception.message.include?("PyCall") || exception.message.include?("Python")
      Rails.logger.error "[GoodJob] Python/PyCall error detected - this may indicate thread safety issues"
    end
  }
end
