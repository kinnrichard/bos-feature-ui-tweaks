class FrontSyncMonitorService
  include Singleton

  CIRCUIT_BREAKER_KEY = "front_sync_circuit_breaker"
  HEALTH_METRICS_CACHE_KEY = "front_sync_health_metrics"
  PERFORMANCE_STATS_CACHE_KEY = "front_sync_performance_stats"

  def self.sync_status
    instance.sync_status
  end

  def self.health_metrics
    instance.health_metrics
  end

  def self.performance_stats
    instance.performance_stats
  end

  def self.circuit_breaker_status
    instance.circuit_breaker_status
  end

  def self.reset_circuit_breaker
    instance.reset_circuit_breaker
  end

  def sync_status
    recent_logs = FrontSyncLog.where("created_at >= ?", 24.hours.ago)
    last_sync = FrontSyncLog.order(created_at: :desc).first

    has_recent_errors = recent_logs.where(status: "error").exists?
    circuit_breaker_open = circuit_breaker_status[:open]

    overall_status = if circuit_breaker_open
                      "circuit_breaker_open"
    elsif has_recent_errors
                      "degraded"
    elsif last_sync&.status == "completed"
                      "healthy"
    else
                      "unknown"
    end

    {
      overall: overall_status,
      last_sync: last_sync&.completed_at,
      recent_errors: recent_logs.where(status: "error").count,
      running_syncs: FrontSyncLog.where(status: "running").count
    }
  end

  def health_metrics
    Rails.cache.fetch(HEALTH_METRICS_CACHE_KEY, expires_in: 5.minutes) do
      calculate_health_metrics
    end
  end

  def performance_stats
    Rails.cache.fetch(PERFORMANCE_STATS_CACHE_KEY, expires_in: 5.minutes) do
      calculate_performance_stats
    end
  end

  def circuit_breaker_status
    breaker_data = Rails.cache.read(CIRCUIT_BREAKER_KEY) || {}

    {
      open: breaker_data["open"] || false,
      failure_count: breaker_data["failure_count"] || 0,
      last_failure_at: breaker_data["last_failure_at"] ? Time.parse(breaker_data["last_failure_at"]) : nil,
      next_attempt_at: breaker_data["next_attempt_at"] ? Time.parse(breaker_data["next_attempt_at"]) : nil
    }
  rescue
    { open: false, failure_count: 0, last_failure_at: nil, next_attempt_at: nil }
  end

  def reset_circuit_breaker
    Rails.cache.delete(CIRCUIT_BREAKER_KEY)
    Rails.logger.info "Front API Circuit Breaker reset manually"
  end

  def record_api_call(response_time:, success:)
    update_performance_metrics(response_time, success)
    update_circuit_breaker(success)
  end

  def generate_health_report
    {
      timestamp: Time.current,
      sync_status: sync_status,
      health_metrics: health_metrics,
      performance_stats: performance_stats,
      circuit_breaker: circuit_breaker_status,
      recommendations: generate_recommendations
    }
  end

  private

  def calculate_health_metrics
    logs_24h = FrontSyncLog.where("created_at >= ?", 24.hours.ago)
    logs_7d = FrontSyncLog.where("created_at >= ?", 7.days.ago)

    total_24h = logs_24h.count
    successful_24h = logs_24h.where(status: "completed").count

    success_rate = total_24h > 0 ? successful_24h.to_f / total_24h : 0.0

    avg_duration = logs_24h.where.not(started_at: nil, completed_at: nil)
                           .average("EXTRACT(EPOCH FROM (completed_at - started_at))")&.to_f || 0

    error_patterns = analyze_error_patterns(logs_7d)

    {
      success_rate: success_rate,
      avg_duration_seconds: avg_duration,
      total_syncs_24h: total_24h,
      successful_syncs_24h: successful_24h,
      failed_syncs_24h: logs_24h.where(status: "error").count,
      running_syncs: logs_24h.where(status: "running").count,
      error_patterns: error_patterns,
      uptime_percentage: calculate_uptime_percentage(logs_7d)
    }
  end

  def calculate_performance_stats
    logs_24h = FrontSyncLog.where("created_at >= ?", 24.hours.ago)

    # Extract performance data from metadata
    response_times = []
    api_calls_count = 0
    error_count = 0

    logs_24h.find_each do |log|
      next unless log.metadata.present?

      if log.metadata["stats"].present?
        stats = log.metadata["stats"]
        response_times << stats["response_time_avg"].to_f if stats["response_time_avg"]
        api_calls_count += stats["api_calls"].to_i if stats["api_calls"]
      end

      error_count += 1 if log.status == "error"
    end

    avg_response_time = response_times.any? ? (response_times.sum / response_times.size).round(2) : 0
    error_rate = logs_24h.count > 0 ? error_count.to_f / logs_24h.count : 0

    {
      avg_response_time: avg_response_time,
      api_calls_24h: api_calls_count,
      error_rate: error_rate,
      throughput_per_hour: calculate_throughput_per_hour(logs_24h),
      peak_usage_hour: calculate_peak_usage_hour(logs_24h),
      rate_limit_hits: count_rate_limit_hits(logs_24h)
    }
  end

  def analyze_error_patterns(logs)
    error_logs = logs.where(status: "error")

    patterns = {}

    error_logs.find_each do |log|
      next unless log.error_message.present?

      # Group by error type
      error_type = extract_error_type(log.error_message)
      patterns[error_type] ||= { count: 0, recent_example: nil }
      patterns[error_type][:count] += 1
      patterns[error_type][:recent_example] = log.error_message if patterns[error_type][:recent_example].nil?
    end

    # Sort by frequency
    patterns.sort_by { |_, data| -data[:count] }.to_h
  end

  def extract_error_type(error_message)
    case error_message
    when /timeout/i
      "timeout"
    when /rate.limit/i
      "rate_limit"
    when /authentication/i, /unauthorized/i
      "authentication"
    when /not.found/i, /404/i
      "not_found"
    when /server.error/i, /500/i
      "server_error"
    when /network/i, /connection/i
      "network"
    else
      "other"
    end
  end

  def calculate_uptime_percentage(logs)
    total_hours = 7 * 24 # 7 days
    error_hours = logs.where(status: "error")
                     .group("DATE_TRUNC('hour', created_at)")
                     .count
                     .keys
                     .count

    uptime_hours = total_hours - error_hours
    (uptime_hours.to_f / total_hours * 100).round(2)
  end

  def calculate_throughput_per_hour(logs)
    hourly_counts = logs.group("DATE_TRUNC('hour', created_at)").count
    hourly_counts.values.sum.to_f / [ hourly_counts.size, 1 ].max
  end

  def calculate_peak_usage_hour(logs)
    hourly_counts = logs.group("DATE_TRUNC('hour', created_at)").count
    peak_hour = hourly_counts.max_by { |_, count| count }&.first
    peak_hour&.strftime("%H:00")
  end

  def count_rate_limit_hits(logs)
    logs.where("error_message ILIKE ?", "%rate limit%").count
  end

  def update_performance_metrics(response_time, success)
    # This would typically update a time-series database or cache
    # For now, we'll store basic metrics in Rails cache

    current_metrics = Rails.cache.read("front_sync_current_metrics") || {
      response_times: [],
      success_count: 0,
      failure_count: 0,
      last_updated: Time.current
    }

    current_metrics[:response_times] << response_time
    current_metrics[:response_times] = current_metrics[:response_times].last(100) # Keep last 100

    if success
      current_metrics[:success_count] += 1
    else
      current_metrics[:failure_count] += 1
    end

    current_metrics[:last_updated] = Time.current

    Rails.cache.write("front_sync_current_metrics", current_metrics, expires_in: 1.hour)
  end

  def update_circuit_breaker(success)
    breaker_data = Rails.cache.read(CIRCUIT_BREAKER_KEY) || {
      "open" => false,
      "failure_count" => 0,
      "last_failure_at" => nil,
      "next_attempt_at" => nil
    }

    if success
      # Reset failure count on success
      breaker_data["failure_count"] = 0
      breaker_data["open"] = false
      breaker_data["next_attempt_at"] = nil
    else
      breaker_data["failure_count"] += 1
      breaker_data["last_failure_at"] = Time.current.iso8601

      # Open circuit breaker after 5 consecutive failures
      if breaker_data["failure_count"] >= 5
        breaker_data["open"] = true
        breaker_data["next_attempt_at"] = (Time.current + 5.minutes).iso8601
      end
    end

    Rails.cache.write(CIRCUIT_BREAKER_KEY, breaker_data, expires_in: 1.hour)
  end

  def generate_recommendations
    recommendations = []
    metrics = health_metrics
    stats = performance_stats

    # Success rate recommendations
    if metrics[:success_rate] < 0.9
      recommendations << {
        type: "warning",
        title: "Low Success Rate",
        message: "Success rate is #{(metrics[:success_rate] * 100).round(1)}%. Consider investigating recent errors.",
        action: "Review error logs and consider increasing retry logic"
      }
    end

    # Performance recommendations
    if stats[:avg_response_time] > 5000 # 5 seconds
      recommendations << {
        type: "warning",
        title: "Slow API Response Times",
        message: "Average response time is #{stats[:avg_response_time]}ms.",
        action: "Consider optimizing API calls or implementing caching"
      }
    end

    # Rate limit recommendations
    if stats[:rate_limit_hits] > 0
      recommendations << {
        type: "warning",
        title: "Rate Limit Issues",
        message: "#{stats[:rate_limit_hits]} rate limit hits in the last 24 hours.",
        action: "Implement exponential backoff or reduce API call frequency"
      }
    end

    # Circuit breaker recommendations
    if circuit_breaker_status[:open]
      recommendations << {
        type: "error",
        title: "Circuit Breaker Open",
        message: "The circuit breaker is currently open due to repeated failures.",
        action: "Investigate the underlying issue before resetting the circuit breaker"
      }
    end

    recommendations
  end
end
