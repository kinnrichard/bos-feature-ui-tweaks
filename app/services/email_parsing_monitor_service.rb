# Service for monitoring email parsing performance and health
# Provides comprehensive metrics, alerts, and reporting for email parsing operations
class EmailParsingMonitorService
  include Singleton

  # Get current parsing status and statistics
  # @return [Hash] Current status with metrics and health indicators
  def parsing_status
    {
      overview: parsing_overview,
      performance: performance_metrics,
      queue_status: queue_status,
      recent_activity: recent_activity,
      error_analysis: error_analysis,
      recommendations: generate_recommendations
    }
  end

  # Get parsing overview statistics
  # @return [Hash] Overview metrics
  def parsing_overview
    total_messages = FrontMessage.where(is_inbound: true, is_draft: false, message_type: "email").count
    parsed_messages = FrontMessage.joins(:parsed_email)
                                  .where(is_inbound: true, is_draft: false, message_type: "email")
                                  .count

    unparsed_messages = total_messages - parsed_messages
    completion_rate = total_messages > 0 ? (parsed_messages.to_f / total_messages) : 0

    {
      total_messages: total_messages,
      parsed_messages: parsed_messages,
      unparsed_messages: unparsed_messages,
      completion_rate: completion_rate.round(4),
      completion_percentage: (completion_rate * 100).round(2)
    }
  end

  # Get performance metrics for parsing operations
  # @return [Hash] Performance statistics
  def performance_metrics(hours_back: 24)
    since = hours_back.hours.ago

    # Recent parsing activity
    recent_parsed = ParsedEmail.joins(:parseable)
                               .where(parseable_type: "FrontMessage")
                               .where("parsed_at > ?", since)

    total_recent = recent_parsed.count
    successful_recent = recent_parsed.where(parse_errors: [ nil, {}, "{}", "[]" ]).count
    failed_recent = total_recent - successful_recent

    success_rate = total_recent > 0 ? (successful_recent.to_f / total_recent) : 0

    # Batch job performance from cache
    batch_metrics = get_batch_performance_metrics(hours_back)

    {
      recent_parsed_count: total_recent,
      successful_count: successful_recent,
      failed_count: failed_recent,
      success_rate: success_rate.round(4),
      success_percentage: (success_rate * 100).round(2),
      average_batch_duration: batch_metrics[:avg_duration],
      average_throughput: batch_metrics[:avg_throughput],
      total_batches: batch_metrics[:total_batches]
    }
  end

  # Get queue status for parsing jobs
  # @return [Hash] Queue statistics
  def queue_status
    return { available: false, message: "GoodJob not available" } unless defined?(GoodJob)

    begin
      # Individual parsing jobs
      parsing_pending = GoodJob::Job.where(job_class: "EmailParseJob", finished_at: nil, performed_at: nil).count
      parsing_running = GoodJob::Job.where(job_class: "EmailParseJob", finished_at: nil).where.not(performed_at: nil).count

      # Batch parsing jobs
      batch_pending = GoodJob::Job.where(job_class: "FrontMessageParsingJob", finished_at: nil, performed_at: nil).count
      batch_running = GoodJob::Job.where(job_class: "FrontMessageParsingJob", finished_at: nil).where.not(performed_at: nil).count

      # Failed jobs in last 24 hours
      parsing_failed = GoodJob::Job.where(job_class: [ "EmailParseJob", "FrontMessageParsingJob" ])
                                   .where.not(error: nil)
                                   .where("created_at > ?", 24.hours.ago)
                                   .count

      {
        available: true,
        individual_parsing: {
          pending: parsing_pending,
          running: parsing_running
        },
        batch_parsing: {
          pending: batch_pending,
          running: batch_running
        },
        failed_jobs_24h: parsing_failed,
        total_pending: parsing_pending + batch_pending,
        total_running: parsing_running + batch_running
      }
    rescue => e
      Rails.logger.error "Failed to get queue status: #{e.message}"
      { available: false, error: e.message }
    end
  end

  # Get recent parsing activity
  # @return [Hash] Recent activity metrics
  def recent_activity(limit: 10)
    recent_parsed_emails = ParsedEmail.joins(:parseable)
                                      .where(parseable_type: "FrontMessage")
                                      .order(parsed_at: :desc)
                                      .limit(limit)
                                      .includes(:parseable)

    activity_summary = recent_parsed_emails.map do |parsed_email|
      {
        message_id: parsed_email.parseable_id,
        parsed_at: parsed_email.parsed_at,
        success: parsed_email.parsing_successful?,
        parser_version: parsed_email.parser_version,
        has_content: parsed_email.has_parsed_content?,
        error: parsed_email.parsing_successful? ? nil : parsed_email.error_messages.first
      }
    end

    {
      recent_items: activity_summary,
      total_items: recent_parsed_emails.length
    }
  end

  # Analyze parsing errors and patterns
  # @return [Hash] Error analysis
  def error_analysis(days_back: 7)
    since = days_back.days.ago

    error_parsed_emails = ParsedEmail.joins(:parseable)
                                     .where(parseable_type: "FrontMessage")
                                     .where.not(parse_errors: [ nil, {}, "{}", "[]" ])
                                     .where("parsed_at > ?", since)

    error_patterns = {}
    error_examples = {}

    error_parsed_emails.each do |parsed_email|
      error_data = JSON.parse(parsed_email.parse_errors) rescue { error: parsed_email.parse_errors }
      error_key = error_data.is_a?(Hash) ?
                    error_data["error"].to_s.split(":").first :
                    "unknown_error"

      error_patterns[error_key] = (error_patterns[error_key] || 0) + 1
      error_examples[error_key] ||= error_data.is_a?(Hash) ? error_data["error"] : error_data.to_s
    end

    {
      total_errors: error_parsed_emails.count,
      error_patterns: error_patterns,
      error_examples: error_examples,
      error_rate: calculate_error_rate(days_back)
    }
  end

  # Generate recommendations based on current metrics
  # @return [Array<Hash>] Array of recommendations
  def generate_recommendations
    recommendations = []
    status = parsing_status

    # Check completion rate
    if status[:overview][:completion_rate] < 0.8
      recommendations << {
        type: "warning",
        category: "completion",
        title: "Low parsing completion rate",
        message: "Only #{status[:overview][:completion_percentage]}% of eligible messages have been parsed",
        action: "Run batch parsing: rake front_message_parsing:batch"
      }
    end

    # Check error rate
    if status[:performance][:success_percentage] < 90 && status[:performance][:recent_parsed_count] > 0
      recommendations << {
        type: "error",
        category: "errors",
        title: "High parsing error rate",
        message: "#{100 - status[:performance][:success_percentage].round(1)}% of recent parsing attempts failed",
        action: "Check parser configuration and investigate error patterns"
      }
    end

    # Check queue backlog
    if status[:queue_status][:available] && status[:queue_status][:total_pending] > 100
      recommendations << {
        type: "warning",
        category: "performance",
        title: "Large queue backlog",
        message: "#{status[:queue_status][:total_pending]} parsing jobs are pending",
        action: "Consider increasing worker capacity or batch size"
      }
    end

    # Check for stuck jobs
    if status[:queue_status][:available] && status[:queue_status][:total_running] > 10
      recommendations << {
        type: "info",
        category: "monitoring",
        title: "High number of running jobs",
        message: "#{status[:queue_status][:total_running]} jobs are currently running",
        action: "Monitor for stuck jobs or consider worker scaling"
      }
    end

    # Performance recommendations
    if status[:performance][:average_batch_duration] && status[:performance][:average_batch_duration] > 60
      recommendations << {
        type: "info",
        category: "performance",
        title: "Slow batch processing",
        message: "Average batch duration is #{status[:performance][:average_batch_duration].round(1)}s",
        action: "Consider reducing batch size or optimizing parser performance"
      }
    end

    recommendations
  end

  # Generate comprehensive health report
  # @return [Hash] Complete health report
  def health_report
    report_data = parsing_status

    # Add system information
    report_data[:system_info] = {
      rails_env: Rails.env,
      timestamp: Time.current.iso8601,
      talon_parser_available: TalonEmailParser&.instance&.available?,
      good_job_available: defined?(GoodJob)
    }

    # Add trend analysis
    report_data[:trends] = calculate_trends

    report_data
  end

  # Get parsing throughput statistics
  # @return [Hash] Throughput metrics
  def throughput_stats(hours_back: 24)
    since = hours_back.hours.ago

    hourly_counts = ParsedEmail.joins(:parseable)
                               .where(parseable_type: "FrontMessage")
                               .where("parsed_at > ?", since)
                               .group_by_hour(:parsed_at)
                               .count

    total_parsed = hourly_counts.values.sum
    avg_per_hour = total_parsed.to_f / hours_back
    peak_hour = hourly_counts.max_by { |_, count| count }&.first
    peak_count = hourly_counts.values.max || 0

    {
      total_parsed: total_parsed,
      average_per_hour: avg_per_hour.round(2),
      peak_hour: peak_hour,
      peak_count: peak_count,
      hourly_distribution: hourly_counts
    }
  end

  private

  # Get batch performance metrics from cache
  def get_batch_performance_metrics(hours_back)
    cache_pattern = "email_parsing_metrics:batch:*"

    # In a real implementation, you might use Redis SCAN or similar
    # For now, we'll check Rails cache for known patterns
    metric_entries = []

    # Try to find cached metrics (simplified approach)
    # In production, you'd want a more sophisticated cache key discovery
    (0..hours_back).each do |hour_offset|
      hour_key = (hours_back.hours.ago + hour_offset.hours).strftime("%Y%m%d%H")
      cache_key = "email_parsing_metrics:batch:#{hour_key}"

      if Rails.cache.exist?(cache_key)
        metric_entries << Rails.cache.read(cache_key)
      end
    end

    return { avg_duration: 0, avg_throughput: 0, total_batches: 0 } if metric_entries.empty?

    avg_duration = metric_entries.map { |m| m[:duration_seconds] }.sum / metric_entries.length
    avg_throughput = metric_entries.map { |m| m[:throughput_per_second] }.sum / metric_entries.length

    {
      avg_duration: avg_duration.round(2),
      avg_throughput: avg_throughput.round(2),
      total_batches: metric_entries.length
    }
  end

  # Calculate error rate over time period
  def calculate_error_rate(days_back)
    since = days_back.days.ago

    total_recent = ParsedEmail.joins(:parseable)
                              .where(parseable_type: "FrontMessage")
                              .where("parsed_at > ?", since)
                              .count

    return 0 if total_recent == 0

    error_recent = ParsedEmail.joins(:parseable)
                              .where(parseable_type: "FrontMessage")
                              .where("parsed_at > ?", since)
                              .where.not(parse_errors: [ nil, {}, "{}", "[]" ])
                              .count

    (error_recent.to_f / total_recent).round(4)
  end

  # Calculate trends for key metrics
  def calculate_trends
    current_24h = performance_metrics(hours_back: 24)
    previous_24h = performance_metrics_for_period(48.hours.ago, 24.hours.ago)

    {
      parsing_rate_trend: trend_direction(current_24h[:recent_parsed_count], previous_24h[:recent_parsed_count]),
      success_rate_trend: trend_direction(current_24h[:success_rate], previous_24h[:success_rate]),
      throughput_trend: trend_direction(current_24h[:average_throughput], previous_24h[:average_throughput])
    }
  end

  # Get performance metrics for a specific time period
  def performance_metrics_for_period(start_time, end_time)
    recent_parsed = ParsedEmail.joins(:parseable)
                               .where(parseable_type: "FrontMessage")
                               .where(parsed_at: start_time..end_time)

    total_recent = recent_parsed.count
    successful_recent = recent_parsed.where(parse_errors: [ nil, {}, "{}", "[]" ]).count
    success_rate = total_recent > 0 ? (successful_recent.to_f / total_recent) : 0

    {
      recent_parsed_count: total_recent,
      success_rate: success_rate,
      average_throughput: total_recent / 24.0  # Simplified throughput calculation
    }
  end

  # Calculate trend direction
  def trend_direction(current, previous)
    return "stable" if current == previous || previous == 0

    change_percent = ((current - previous) / previous.to_f) * 100

    if change_percent > 5
      "improving"
    elsif change_percent < -5
      "declining"
    else
      "stable"
    end
  end
end
