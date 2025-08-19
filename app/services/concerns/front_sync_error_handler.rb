# Front API error handling module with circuit breaker pattern
# Provides comprehensive error handling for Front API synchronization operations
module FrontSyncErrorHandler
  extend ActiveSupport::Concern

  # Custom error classes for specific Front sync failures
  class NetworkError < StandardError; end
  class RateLimitError < StandardError; end
  class AuthenticationError < StandardError; end
  class CircuitBreakerOpenError < StandardError; end

  included do
    # Class-level circuit breaker state management
    cattr_accessor :circuit_breakers, default: {}
  end

  class_methods do
    # Circuit breaker configuration
    CIRCUIT_BREAKER_THRESHOLD = 5
    CIRCUIT_BREAKER_TIMEOUT = 5.minutes

    # Check if circuit breaker is open for a given operation
    def circuit_breaker_open?(operation_key)
      breaker = circuit_breakers[operation_key]
      return false unless breaker

      if breaker[:state] == "open"
        # Check if timeout has passed (attempt half-open state)
        if Time.current - breaker[:opened_at] > CIRCUIT_BREAKER_TIMEOUT
          circuit_breakers[operation_key][:state] = "half_open"
          false
        else
          true
        end
      else
        false
      end
    end

    # Reset circuit breaker for an operation
    def reset_circuit_breaker(operation_key)
      circuit_breakers.delete(operation_key)
    end

    # Record circuit breaker failure
    def record_circuit_breaker_failure(operation_key, error)
      circuit_breakers[operation_key] ||= {
        state: "closed",
        failure_count: 0,
        opened_at: nil
      }

      breaker = circuit_breakers[operation_key]
      breaker[:failure_count] += 1
      breaker[:last_failure] = error.message
      breaker[:last_failure_at] = Time.current

      if breaker[:failure_count] >= CIRCUIT_BREAKER_THRESHOLD
        breaker[:state] = "open"
        breaker[:opened_at] = Time.current

        Rails.logger.error "Circuit breaker opened for #{operation_key} after #{breaker[:failure_count]} failures"

        # Notify monitoring/alerting system
        notify_circuit_breaker_opened(operation_key, error)
      end
    end

    # Record circuit breaker success (used in half-open state)
    def record_circuit_breaker_success(operation_key)
      reset_circuit_breaker(operation_key)
    end

    private

    def notify_circuit_breaker_opened(operation_key, error)
      Rails.logger.error "ALERT: Front sync circuit breaker opened for #{operation_key}: #{error.message}"
      # Add integration with monitoring service like Sentry, DataDog, etc.
      # Sentry.capture_exception(error, tags: { circuit_breaker: operation_key })
    end
  end

  # Execute Front API operation with comprehensive error handling and retry logic
  def with_error_handling(operation_key = "default")
    # Check circuit breaker
    if self.class.circuit_breaker_open?(operation_key)
      raise CircuitBreakerOpenError, "Circuit breaker is open for #{operation_key}"
    end

    retry_count = 0
    max_retries = 3
    base_delay = 1.0

    begin
      result = yield

      # Record success for circuit breaker
      self.class.record_circuit_breaker_success(operation_key)

      result
    rescue => error
      retry_count += 1

      # Determine if we should retry based on error type and retry count
      should_retry = false

      case error
      when Net::HTTPTooManyRequests
        if retry_count <= max_retries
          retry_after = extract_retry_after_header(error)
          delay = retry_after || (base_delay * (2 ** retry_count))
          Rails.logger.warn "Rate limited (attempt #{retry_count}/#{max_retries}). Retrying in #{delay}s: #{error.message}"
          sleep(delay)
          should_retry = true
        else
          Rails.logger.error "Rate limit exceeded after #{max_retries} attempts: #{error.message}"
          raise RateLimitError, "Front API rate limit exceeded: #{error.message}"
        end

      when Net::HTTPUnauthorized
        Rails.logger.error "Authentication failed for Front API: #{error.message}"
        self.class.record_circuit_breaker_failure(operation_key, error)
        notify_authentication_failure(error)
        raise AuthenticationError, "Front API authentication failed: #{error.message}"

      when Timeout::Error, Net::ReadTimeout, Net::OpenTimeout, Errno::ECONNREFUSED, Errno::EHOSTUNREACH, SocketError
        if retry_count <= max_retries
          delay = base_delay * (2 ** retry_count)
          Rails.logger.warn "Network error (attempt #{retry_count}/#{max_retries}). Retrying in #{delay}s: #{error.message}"
          sleep(delay)
          should_retry = true
        else
          Rails.logger.error "Network error after #{max_retries} attempts: #{error.message}"
          self.class.record_circuit_breaker_failure(operation_key, error)
          raise NetworkError, "Front API network error: #{error.message}"
        end

      when JSON::ParserError
        if retry_count <= max_retries
          delay = base_delay * retry_count
          Rails.logger.warn "JSON parse error (attempt #{retry_count}/#{max_retries}). Retrying in #{delay}s: #{error.message}"
          sleep(delay)
          should_retry = true
        else
          Rails.logger.error "JSON parse error after #{max_retries} attempts: #{error.message}"
          self.class.record_circuit_breaker_failure(operation_key, error)
          raise NetworkError, "Front API JSON parse error: #{error.message}"
        end

      else
        if retry_count <= max_retries && recoverable_error?(error)
          delay = base_delay * retry_count
          Rails.logger.warn "Recoverable error (attempt #{retry_count}/#{max_retries}). Retrying in #{delay}s: #{error.message}"
          sleep(delay)
          should_retry = true
        else
          Rails.logger.error "Unrecoverable error or max retries exceeded: #{error.message}"
          self.class.record_circuit_breaker_failure(operation_key, error)
          raise error
        end
      end

      # Retry if appropriate
      retry if should_retry
    end
  end

  # Alternative wrapper for sync operations with automatic error handling
  def sync_with_error_handling(resource_type, sync_type = "full")
    sync_log = FrontSyncLog.create!(
      resource_type: resource_type,
      sync_type: sync_type,
      status: "running",
      started_at: Time.current
    )

    begin
      # Check if sync should be skipped
      if should_skip_sync?(resource_type, sync_type)
        sync_log.update!(
          status: "skipped",
          completed_at: Time.current,
          duration_seconds: 0,
          metadata: { reason: "Recent sync or circuit breaker open" }
        )
        return { created: 0, updated: 0, failed: 0, skipped: true }
      end

      # Execute the sync operation
      result = with_error_handling("sync_#{resource_type}") do
        yield if block_given?
      end

      # Update sync log with success
      sync_log.mark_completed!(
        records_synced: result[:created] + result[:updated],
        records_created: result[:created],
        records_updated: result[:updated],
        records_failed: result[:failed]
      )

      result
    rescue => error
      # Update sync log with failure
      sync_log.mark_failed!(error.message)

      # Log error context
      log_error_context(resource_type, sync_type, error)

      raise
    end
  end

  private

  # Extract retry-after header from rate limit response
  def extract_retry_after_header(error)
    return nil unless error.respond_to?(:response) && error.response

    retry_after = error.response["Retry-After"]
    retry_after ? retry_after.to_i : nil
  end

  # Check if error is potentially recoverable
  def recoverable_error?(error)
    case error
    when Timeout::Error, Errno::ETIMEDOUT, Errno::ECONNRESET
      true
    when StandardError
      error.message.include?("temporary") || error.message.include?("timeout")
    else
      false
    end
  end

  # Determine if sync should be skipped
  def should_skip_sync?(resource_type, sync_type)
    # Skip if circuit breaker is open
    return true if self.class.circuit_breaker_open?("sync_#{resource_type}")

    # Skip if recent sync exists (within last 5 minutes for incremental)
    if sync_type == "incremental"
      recent_sync = FrontSyncLog.where(
        resource_type: resource_type,
        status: "completed",
        completed_at: 5.minutes.ago..Time.current
      ).exists?

      return true if recent_sync
    end

    false
  end

  # Log detailed error context for debugging
  def log_error_context(resource_type, sync_type, error)
    context = {
      resource_type: resource_type,
      sync_type: sync_type,
      error_class: error.class.name,
      error_message: error.message,
      backtrace: error.backtrace&.first(5)
    }

    Rails.logger.error "Front sync error context: #{context.to_json}"
  end

  # Notify about authentication failures
  def notify_authentication_failure(error)
    Rails.logger.error "CRITICAL: Front API authentication failure - immediate action required"
    # Add notification to admins via email/Slack
    # AdminMailer.front_api_auth_failure(error).deliver_later
  end

  # Error categorization for monitoring
  def categorize_error(error)
    case error
    when RateLimitError
      "rate_limit"
    when AuthenticationError
      "authentication"
    when NetworkError
      "network"
    when CircuitBreakerOpenError
      "circuit_breaker"
    when Timeout::Error
      "timeout"
    when JSON::ParserError
      "json_parse"
    else
      "unknown"
    end
  end

  # Track error metrics for monitoring
  def track_error_metric(error_category, resource_type)
    # Integration point for StatsD, DataDog, etc.
    # StatsD.increment("front_sync.errors.#{error_category}", tags: ["resource:#{resource_type}"])
  end
end
