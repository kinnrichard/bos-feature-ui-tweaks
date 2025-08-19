# Email Parser Operations Guide

This guide provides operational procedures for managing the email reply parser system in production environments. It covers performance tuning, monitoring, maintenance, and capacity planning.

## Table of Contents

- [Overview](#overview)
- [Performance Tuning](#performance-tuning)
- [Monitoring and Metrics](#monitoring-and-metrics)
- [Capacity Planning](#capacity-planning)
- [Maintenance Procedures](#maintenance-procedures)
- [Health Checks](#health-checks)
- [Incident Response](#incident-response)
- [Scaling Guidelines](#scaling-guidelines)

## Overview

The email parser system is designed for high-volume email processing with the following architecture:

- **TalonEmailParser**: Singleton service with thread-safe parsing
- **Background Jobs**: Asynchronous processing with SolidQueue
- **ParsedEmail Storage**: Polymorphic model with deduplication
- **Health Monitoring**: Real-time status and performance tracking
- **Queue Management**: Priority-based job processing

## Performance Tuning

### Optimal Configuration Settings

#### SolidQueue Configuration

```yaml
# config/queue.yml
production:
  dispatchers:
    - polling_interval: 1
      batch_size: 500
      concurrency_maintenance_interval: 600
  workers:
    - queues: "urgent"
      threads: 1
      processes: 2
    - queues: "parsing_priority" 
      threads: 3
      processes: 4
    - queues: "parsing"
      threads: 2
      processes: 6
    - queues: "default"
      threads: 2
      processes: 4
```

#### Application Configuration

```ruby
# config/initializers/email_parser.rb
Rails.application.configure do
  config.email_parser = ActiveSupport::OrderedOptions.new
  
  # Performance settings
  config.email_parser.max_content_size = 2.megabytes
  config.email_parser.batch_size = 15
  config.email_parser.memory_threshold = 512.megabytes
  config.email_parser.timeout = 30.seconds
  
  # Queue settings
  config.email_parser.high_priority_queue = 'parsing_priority'
  config.email_parser.standard_queue = 'parsing'
  config.email_parser.batch_queue = 'parsing_priority'
  
  # Monitoring settings
  config.email_parser.metrics_retention = 7.days
  config.email_parser.health_check_interval = 5.minutes
  config.email_parser.alert_thresholds = {
    error_rate: 0.10,           # 10% error rate
    queue_depth: 100,           # 100 pending jobs
    avg_processing_time: 1000,  # 1000ms average
    memory_usage: 1.gigabyte    # 1GB memory usage
  }
end
```

### Memory Management

#### Garbage Collection Optimization

```ruby
# config/initializers/gc_optimization.rb
if Rails.env.production?
  # Tune garbage collection for parsing workload
  GC::Profiler.enable
  
  # More frequent minor GC, less frequent major GC
  ENV['RUBY_GC_HEAP_GROWTH_FACTOR'] ||= '1.1'
  ENV['RUBY_GC_HEAP_GROWTH_MAX_SLOTS'] ||= '10000'
  ENV['RUBY_GC_HEAP_INIT_SLOTS'] ||= '40000'
  ENV['RUBY_GC_HEAP_FREE_SLOTS'] ||= '4000'
  ENV['RUBY_GC_HEAP_OLDOBJECT_LIMIT_FACTOR'] ||= '1.2'
end
```

#### Worker Memory Management

```ruby
# Enhanced job with memory monitoring
class FrontMessageParsingJob < ApplicationJob
  include MemoryManagement
  
  def perform(message_ids, batch_size: 10, **options)
    memory_checkpoint("job_start")
    
    message_ids.each_slice(batch_size).with_index do |batch, index|
      memory_checkpoint("batch_#{index}_start")
      
      process_batch(batch, options)
      
      memory_checkpoint("batch_#{index}_end")
      
      # Memory management between batches
      if should_garbage_collect?(index)
        perform_garbage_collection
        memory_checkpoint("gc_after_batch_#{index}")
      end
      
      # Brief pause to manage system load
      sleep(0.05) if index % 10 == 0
    end
    
    memory_checkpoint("job_end")
    log_memory_usage
  end
  
  private
  
  module MemoryManagement
    def memory_checkpoint(label)
      @memory_checkpoints ||= {}
      @memory_checkpoints[label] = {
        rss: current_memory_usage,
        objects: ObjectSpace.count_objects[:T_OBJECT],
        timestamp: Time.current
      }
    end
    
    def should_garbage_collect?(batch_index)
      # Force GC every 10 batches or if memory usage is high
      (batch_index + 1) % 10 == 0 || current_memory_usage > 512.megabytes
    end
    
    def perform_garbage_collection
      GC.start(full_mark: true, immediate_sweep: true)
    end
    
    def current_memory_usage
      `ps -o rss= -p #{Process.pid}`.to_i * 1024 # Convert KB to bytes
    end
  end
end
```

### Database Optimization

#### Indexing Strategy

```sql
-- Optimized indexes for email parser queries
CREATE INDEX CONCURRENTLY idx_front_messages_parsing_candidates 
ON front_messages (id, created_at) 
WHERE is_inbound = true AND is_draft = false;

CREATE INDEX CONCURRENTLY idx_parsed_emails_by_hash 
ON parsed_emails (content_hash, created_at);

CREATE INDEX CONCURRENTLY idx_parsed_emails_error_analysis 
ON parsed_emails (parsed_at, parser_version) 
WHERE parse_errors IS NOT NULL AND parse_errors != '{}';

-- Partial indexes for performance
CREATE INDEX CONCURRENTLY idx_unparsed_messages 
ON front_messages (id, created_at) 
WHERE id NOT IN (
  SELECT parseable_id FROM parsed_emails 
  WHERE parseable_type = 'FrontMessage'
);
```

#### Query Optimization

```ruby
# Optimized queries for common operations
class FrontMessage < ApplicationRecord
  # Efficient unparsed message query
  scope :needs_parsing, -> {
    where(is_inbound: true, is_draft: false)
      .where.not(id: ParsedEmail.where(parseable_type: 'FrontMessage').select(:parseable_id))
      .order(created_at: :desc)
  }
  
  # Batch processing with preloading
  scope :for_batch_parsing, ->(limit = 100) {
    needs_parsing
      .includes(:parsed_email)
      .limit(limit)
  }
  
  # Memory-efficient batch processing
  def self.process_unparsed_in_batches(batch_size: 10, max_messages: 1000)
    total_processed = 0
    
    while total_processed < max_messages
      batch = needs_parsing.limit(batch_size)
      break if batch.empty?
      
      FrontMessageParsingJob.perform_later(
        batch.pluck(:id),
        batch_size: batch_size
      )
      
      total_processed += batch.count
      sleep(0.1) # Brief pause between queue operations
    end
    
    total_processed
  end
end
```

## Monitoring and Metrics

### Key Performance Indicators

#### Primary Metrics

| Metric | Target | Warning | Critical | Description |
|--------|--------|---------|----------|-------------|
| Processing Rate | >600/hour | <400/hour | <200/hour | Emails processed per hour |
| Success Rate | >95% | <90% | <80% | Percentage of successful parses |
| Average Response Time | <100ms | >200ms | >500ms | Time per email parse |
| Queue Depth | <50 | >100 | >200 | Pending jobs in queue |
| Memory Usage | <512MB | >1GB | >2GB | Worker memory consumption |
| Error Rate | <5% | >10% | >20% | Percentage of parsing failures |

#### Secondary Metrics

- **Parser Availability**: Uptime percentage
- **Content Hash Hit Rate**: Cache effectiveness
- **Signature Detection Rate**: Feature utilization
- **Batch Processing Efficiency**: Jobs per batch vs individual
- **Database Query Performance**: Average query time

### Monitoring Implementation

#### Real-time Metrics Collection

```ruby
# app/services/email_parsing_monitor_service.rb
class EmailParsingMonitorService
  include Singleton
  
  METRICS_KEY = 'email_parser_metrics'
  RETENTION_PERIOD = 7.days
  
  def collect_metrics
    metrics = {
      timestamp: Time.current.to_i,
      parser_status: collect_parser_status,
      queue_metrics: collect_queue_metrics,
      processing_metrics: collect_processing_metrics,
      error_metrics: collect_error_metrics,
      performance_metrics: collect_performance_metrics
    }
    
    store_metrics(metrics)
    send_to_external_monitoring(metrics)
    
    metrics
  end
  
  private
  
  def collect_parser_status
    health = TalonEmailParser.instance.health_check
    {
      available: health[:status] == :available,
      talon_version: health[:talon_version],
      capabilities: health[:capabilities],
      last_check: health[:last_check]
    }
  end
  
  def collect_queue_metrics
    {
      parsing_queue_depth: SolidQueue::Job.where(queue_name: 'parsing', finished_at: nil).count,
      priority_queue_depth: SolidQueue::Job.where(queue_name: 'parsing_priority', finished_at: nil).count,
      failed_jobs_count: SolidQueue::Job.where(queue_name: ['parsing', 'parsing_priority']).where.not(failed_at: nil).count,
      active_workers: SolidQueue::Process.where(kind: 'Worker').count
    }
  end
  
  def collect_processing_metrics
    recent_window = 1.hour.ago
    
    {
      total_processed_1h: ParsedEmail.where('created_at > ?', recent_window).count,
      successful_parses_1h: ParsedEmail.successful.where('created_at > ?', recent_window).count,
      failed_parses_1h: ParsedEmail.with_errors.where('created_at > ?', recent_window).count,
      avg_processing_time_ms: calculate_avg_processing_time,
      processing_rate_per_hour: calculate_processing_rate
    }
  end
  
  def send_to_external_monitoring(metrics)
    # StatsD/DataDog integration
    if defined?(Datadog)
      Datadog::Statsd.new.batch do |s|
        s.gauge('email_parser.queue_depth', metrics[:queue_metrics][:parsing_queue_depth])
        s.gauge('email_parser.success_rate', calculate_success_rate(metrics))
        s.gauge('email_parser.processing_rate', metrics[:processing_metrics][:processing_rate_per_hour])
        s.timing('email_parser.avg_response_time', metrics[:performance_metrics][:avg_processing_time_ms])
      end
    end
  end
end
```

#### Dashboard Configuration

```ruby
# config/initializers/monitoring.rb
Rails.application.configure do
  # Grafana/Prometheus metrics endpoint
  config.middleware.use Prometheus::Middleware::Collector
  config.middleware.use Prometheus::Middleware::Exporter
  
  # Email parser specific metrics
  PARSER_METRICS = {
    processing_rate: Prometheus::Client::Gauge.new(
      :email_parser_processing_rate,
      docstring: 'Emails processed per hour'
    ),
    success_rate: Prometheus::Client::Gauge.new(
      :email_parser_success_rate,
      docstring: 'Percentage of successful parses'
    ),
    queue_depth: Prometheus::Client::Gauge.new(
      :email_parser_queue_depth,
      docstring: 'Number of pending parsing jobs'
    ),
    response_time: Prometheus::Client::Histogram.new(
      :email_parser_response_time,
      docstring: 'Email parsing response time in milliseconds',
      buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000]
    )
  }.freeze
  
  # Register metrics
  prometheus = Prometheus::Client.registry
  PARSER_METRICS.each_value { |metric| prometheus.register(metric) }
end
```

### Alerting Configuration

#### Alert Rules (Prometheus/AlertManager)

```yaml
# email_parser_alerts.yml
groups:
  - name: email_parser
    rules:
      - alert: EmailParserDown
        expr: email_parser_available == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: Email parser service is unavailable
          description: The email parser has been unavailable for more than 2 minutes
          
      - alert: EmailParserHighErrorRate
        expr: email_parser_error_rate > 0.10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High email parsing error rate
          description: Error rate is {{ $value | humanizePercentage }} over the last 5 minutes
          
      - alert: EmailParserQueueBacklog
        expr: email_parser_queue_depth > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Email parser queue backlog
          description: Queue depth is {{ $value }} jobs, indicating processing delays
          
      - alert: EmailParserSlowProcessing
        expr: email_parser_avg_response_time > 1000
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: Slow email parsing performance
          description: Average response time is {{ $value }}ms over the last 15 minutes
```

#### Notification Channels

```ruby
# app/services/alert_notification_service.rb
class AlertNotificationService
  def self.send_alert(type, severity, message, context = {})
    case severity
    when 'critical'
      send_to_pagerduty(type, message, context)
      send_to_slack('#alerts-critical', message, context)
      send_email_alert(message, context)
    when 'warning'
      send_to_slack('#alerts-warning', message, context)
      log_alert(type, message, context)
    else
      log_alert(type, message, context)
    end
  end
  
  private
  
  def self.send_to_slack(channel, message, context)
    # Slack webhook integration
    payload = {
      channel: channel,
      text: message,
      attachments: [{
        color: severity_color(context[:severity]),
        fields: context.map { |k, v| { title: k.to_s.humanize, value: v, short: true } }
      }]
    }
    
    HTTParty.post(ENV['SLACK_WEBHOOK_URL'], 
                  body: payload.to_json,
                  headers: { 'Content-Type' => 'application/json' })
  end
end
```

## Capacity Planning

### Resource Requirements

#### Baseline Requirements

| Component | CPU | Memory | Storage | Network |
|-----------|-----|--------|---------|---------|
| Parser Service | 0.5 vCPU | 512MB | - | Low |
| Background Workers | 2 vCPU | 1GB | - | Low |
| Database | 1 vCPU | 2GB | 20GB+ | Medium |
| Redis Cache | 0.5 vCPU | 256MB | 1GB | Low |

#### Scaling Formulas

```ruby
# Capacity planning calculations
class CapacityPlanningService
  # Base processing capacity per worker
  BASE_PROCESSING_RATE = 100 # emails per hour per worker thread
  
  # Memory usage per concurrent job
  MEMORY_PER_JOB = 10.megabytes
  
  def self.calculate_worker_requirements(target_volume_per_hour)
    # Account for peak load (2x average)
    peak_volume = target_volume_per_hour * 2
    
    # Required worker threads
    required_threads = (peak_volume / BASE_PROCESSING_RATE.to_f).ceil
    
    # Memory requirements
    memory_requirement = required_threads * MEMORY_PER_JOB * 1.5 # 50% buffer
    
    # Recommended worker configuration
    processes = [required_threads / 3, 1].max
    threads_per_process = (required_threads / processes.to_f).ceil
    
    {
      target_volume: target_volume_per_hour,
      peak_volume: peak_volume,
      recommended_processes: processes,
      recommended_threads: threads_per_process,
      total_threads: processes * threads_per_process,
      memory_requirement_mb: (memory_requirement / 1.megabyte).round,
      expected_capacity: processes * threads_per_process * BASE_PROCESSING_RATE
    }
  end
  
  def self.database_storage_projection(emails_per_day)
    # Average storage per parsed email
    avg_parsed_email_size = 2.kilobytes # JSON fields + text content
    avg_content_hash_size = 64.bytes    # SHA-256 hash
    
    daily_storage = emails_per_day * (avg_parsed_email_size + avg_content_hash_size)
    monthly_storage = daily_storage * 30
    yearly_storage = daily_storage * 365
    
    {
      daily_mb: (daily_storage / 1.megabyte).round(2),
      monthly_gb: (monthly_storage / 1.gigabyte).round(2),
      yearly_gb: (yearly_storage / 1.gigabyte).round(2)
    }
  end
end
```

### Auto-scaling Configuration

#### Kubernetes HPA Configuration

```yaml
# k8s/email-parser-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: email-parser-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: email-parser-workers
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Pods
    pods:
      metric:
        name: email_parser_queue_depth
      target:
        type: AverageValue
        averageValue: "20"
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### Application-level Auto-scaling

```ruby
# app/services/auto_scaling_service.rb
class AutoScalingService
  include Singleton
  
  def check_and_scale
    metrics = EmailParsingMonitorService.instance.collect_metrics
    
    # Scale up conditions
    if should_scale_up?(metrics)
      scale_up
    elsif should_scale_down?(metrics)
      scale_down
    end
  end
  
  private
  
  def should_scale_up?(metrics)
    queue_metrics = metrics[:queue_metrics]
    
    # Scale up if queue depth is high and workers are at capacity
    queue_metrics[:parsing_queue_depth] > 50 &&
    queue_metrics[:priority_queue_depth] > 20 &&
    metrics[:performance_metrics][:avg_processing_time_ms] > 200
  end
  
  def should_scale_down?(metrics)
    queue_metrics = metrics[:queue_metrics]
    
    # Scale down if queues are empty and performance is good
    queue_metrics[:parsing_queue_depth] < 10 &&
    queue_metrics[:priority_queue_depth] < 5 &&
    metrics[:performance_metrics][:avg_processing_time_ms] < 100
  end
  
  def scale_up
    Rails.logger.info "Auto-scaling: Adding workers due to high load"
    # Implementation depends on deployment platform
    # Kubernetes: increase replica count
    # Docker Swarm: scale service
    # Systemd: start additional worker processes
  end
end
```

## Maintenance Procedures

### Regular Maintenance Tasks

#### Daily Tasks

```bash
#!/bin/bash
# daily_maintenance.sh

echo "=== Daily Email Parser Maintenance - $(date) ==="

# 1. Health check
echo "Running health check..."
bundle exec rake talon:status

# 2. Check queue status
echo "Checking queue status..."
bundle exec rails runner "
  puts 'Parsing queue: ' + SolidQueue::Job.where(queue_name: 'parsing', finished_at: nil).count.to_s
  puts 'Priority queue: ' + SolidQueue::Job.where(queue_name: 'parsing_priority', finished_at: nil).count.to_s
  puts 'Failed jobs: ' + SolidQueue::Job.where.not(failed_at: nil).count.to_s
"

# 3. Performance report
echo "Generating performance report..."
bundle exec rake front_message_parsing:performance_report

# 4. Clean up old metrics
echo "Cleaning up old metrics..."
bundle exec rails runner "
  Rails.cache.delete_matched('email_parser_metrics:*')
  puts 'Metrics cache cleared'
"

echo "Daily maintenance completed at $(date)"
```

#### Weekly Tasks

```bash
#!/bin/bash
# weekly_maintenance.sh

echo "=== Weekly Email Parser Maintenance - $(date) ==="

# 1. Database maintenance
echo "Running database maintenance..."
bundle exec rails runner "
  # Clean up old parsed emails (optional - depends on retention policy)
  if ENV['EMAIL_PARSER_RETENTION_DAYS']
    retention_days = ENV['EMAIL_PARSER_RETENTION_DAYS'].to_i
    old_count = ParsedEmail.where('created_at < ?', retention_days.days.ago).count
    puts \"Found #{old_count} old parsed emails\"
    
    if old_count > 0 && ARGV.include?('--delete-old')
      ParsedEmail.where('created_at < ?', retention_days.days.ago).delete_all
      puts \"Deleted #{old_count} old parsed emails\"
    end
  end
  
  # Database vacuum and analyze
  ActiveRecord::Base.connection.execute('VACUUM ANALYZE parsed_emails;')
  puts 'Database maintenance completed'
"

# 2. Log rotation
echo "Rotating logs..."
find log/ -name "*.log" -size +100M -exec logrotate -f {} \;

# 3. Update Python dependencies
echo "Checking Python dependencies..."
pip list --outdated | grep -E "(talon|lxml|chardet)"

echo "Weekly maintenance completed at $(date)"
```

#### Monthly Tasks

```bash
#!/bin/bash
# monthly_maintenance.sh

echo "=== Monthly Email Parser Maintenance - $(date) ==="

# 1. Performance analysis
echo "Generating monthly performance analysis..."
bundle exec rails runner "
  start_date = 1.month.ago.beginning_of_month
  end_date = 1.month.ago.end_of_month
  
  total_parsed = ParsedEmail.where(created_at: start_date..end_date).count
  successful_parsed = ParsedEmail.successful.where(created_at: start_date..end_date).count
  
  puts \"Month: #{start_date.strftime('%B %Y')}\"
  puts \"Total parsed: #{total_parsed}\"
  puts \"Success rate: #{(successful_parsed.to_f / total_parsed * 100).round(2)}%\"
  
  # Error analysis
  error_counts = ParsedEmail.with_errors
                           .where(created_at: start_date..end_date)
                           .group('parse_errors')
                           .count
  
  puts \"Error patterns:\"
  error_counts.each { |error, count| puts \"  #{error}: #{count}\" }
"

# 2. Capacity planning review
echo "Reviewing capacity metrics..."
bundle exec rails runner "
  current_volume = ParsedEmail.where('created_at > ?', 30.days.ago).count
  daily_average = current_volume / 30.0
  
  puts \"Current volume: #{current_volume} emails/month\"
  puts \"Daily average: #{daily_average.round} emails/day\"
  puts \"Projected growth (assuming 10% monthly): #{(current_volume * 1.1).round} emails/month\"
"

echo "Monthly maintenance completed at $(date)"
```

### Emergency Procedures

#### Parser Service Recovery

```bash
#!/bin/bash
# emergency_parser_recovery.sh

echo "=== EMERGENCY: Email Parser Recovery Procedure ==="

# 1. Stop all processing
echo "Stopping all email parsing jobs..."
bundle exec rails runner "
  SolidQueue::Job.where(queue_name: ['parsing', 'parsing_priority'], finished_at: nil)
                 .update_all(finished_at: Time.current)
  puts 'All parsing jobs stopped'
"

# 2. Clear queues
echo "Clearing job queues..."
pkill -f solid_queue
sleep 5

# 3. Test parser availability
echo "Testing parser availability..."
PARSER_STATUS=$(bundle exec rails runner "puts TalonEmailParser.instance.available?")

if [ "$PARSER_STATUS" = "true" ]; then
    echo "✓ Parser is available"
else
    echo "✗ Parser unavailable - attempting recovery..."
    
    # Try restarting the Rails application
    sudo systemctl restart your-app-service
    sleep 30
    
    # Re-test
    PARSER_STATUS=$(bundle exec rails runner "puts TalonEmailParser.instance.available?")
    if [ "$PARSER_STATUS" = "true" ]; then
        echo "✓ Parser recovered after application restart"
    else
        echo "✗ Parser still unavailable - escalation required"
        exit 1
    fi
fi

# 4. Restart workers
echo "Restarting workers..."
bundle exec rails solid_queue:start -d

# 5. Resume processing
echo "Resuming processing with reduced batch size..."
bundle exec rake front_message_parsing:batch BATCH_SIZE=5 MAX_MESSAGES=50

echo "Emergency recovery completed at $(date)"
```

## Health Checks

### Comprehensive Health Check System

```ruby
# app/services/health_check_service.rb
class HealthCheckService
  def self.comprehensive_check
    results = {
      timestamp: Time.current,
      overall_status: 'healthy',
      checks: {}
    }
    
    # Individual health checks
    checks = [
      :parser_availability,
      :queue_health,
      :database_health,
      :performance_health,
      :memory_health
    ]
    
    checks.each do |check_name|
      begin
        check_result = send(check_name)
        results[:checks][check_name] = check_result
        
        if check_result[:status] != 'healthy'
          results[:overall_status] = check_result[:status]
        end
      rescue StandardError => e
        results[:checks][check_name] = {
          status: 'error',
          message: e.message,
          timestamp: Time.current
        }
        results[:overall_status] = 'error'
      end
    end
    
    results
  end
  
  private
  
  def self.parser_availability
    parser = TalonEmailParser.instance
    health = parser.health_check
    
    if health[:status] == :available
      {
        status: 'healthy',
        message: 'Parser available and functional',
        details: {
          talon_version: health[:talon_version],
          capabilities: health[:capabilities],
          test_passed: health[:test_passed]
        }
      }
    else
      {
        status: 'unhealthy',
        message: "Parser unavailable: #{health[:error]}",
        details: health
      }
    end
  end
  
  def self.queue_health
    parsing_depth = SolidQueue::Job.where(queue_name: 'parsing', finished_at: nil).count
    priority_depth = SolidQueue::Job.where(queue_name: 'parsing_priority', finished_at: nil).count
    failed_count = SolidQueue::Job.where(queue_name: ['parsing', 'parsing_priority']).where.not(failed_at: nil).count
    
    total_depth = parsing_depth + priority_depth
    
    status = if total_depth > 200
               'unhealthy'
             elsif total_depth > 100
               'degraded'
             else
               'healthy'
             end
    
    {
      status: status,
      message: "Queue depth: #{total_depth}, Failed: #{failed_count}",
      details: {
        parsing_queue: parsing_depth,
        priority_queue: priority_depth,
        failed_jobs: failed_count,
        active_workers: SolidQueue::Process.where(kind: 'Worker').count
      }
    }
  end
  
  def self.performance_health
    recent_window = 1.hour.ago
    recent_parses = ParsedEmail.where('created_at > ?', recent_window)
    
    return { status: 'healthy', message: 'No recent activity' } if recent_parses.empty?
    
    success_rate = recent_parses.successful.count.to_f / recent_parses.count
    avg_time = calculate_avg_processing_time
    
    status = if success_rate < 0.8 || avg_time > 1000
               'unhealthy'
             elsif success_rate < 0.9 || avg_time > 500
               'degraded'
             else
               'healthy'
             end
    
    {
      status: status,
      message: "Success rate: #{(success_rate * 100).round(1)}%, Avg time: #{avg_time}ms",
      details: {
        success_rate: success_rate,
        avg_processing_time_ms: avg_time,
        total_recent_parses: recent_parses.count
      }
    }
  end
end
```

### Health Check Endpoints

```ruby
# app/controllers/health_controller.rb
class HealthController < ApplicationController
  skip_before_action :authenticate_user!, only: [:show, :detailed]
  
  def show
    # Basic health check for load balancers
    parser_available = TalonEmailParser.instance.available?
    
    if parser_available
      render json: { status: 'healthy', timestamp: Time.current }
    else
      render json: { status: 'unhealthy', timestamp: Time.current }, status: 503
    end
  end
  
  def detailed
    # Comprehensive health check for monitoring systems
    health_data = HealthCheckService.comprehensive_check
    
    status_code = case health_data[:overall_status]
                  when 'healthy' then 200
                  when 'degraded' then 200  # Still serving traffic
                  when 'unhealthy' then 503
                  else 500
                  end
    
    render json: health_data, status: status_code
  end
end
```

## Incident Response

### Incident Classification

#### Severity Levels

| Level | Description | Response Time | Escalation |
|-------|-------------|---------------|------------|
| P1 - Critical | Parser completely down | 15 minutes | Immediate |
| P2 - High | High error rate (>20%) | 1 hour | 2 hours |
| P3 - Medium | Performance degradation | 4 hours | 8 hours |
| P4 - Low | Minor issues, monitoring alerts | 24 hours | None |

#### Response Procedures

```ruby
# app/services/incident_response_service.rb
class IncidentResponseService
  INCIDENT_TYPES = {
    parser_down: {
      severity: 'P1',
      steps: [
        'Check parser availability',
        'Restart application services',
        'Verify PyCall and Talon installation',
        'Escalate to development team'
      ]
    },
    high_error_rate: {
      severity: 'P2', 
      steps: [
        'Identify error patterns',
        'Check recent email content changes',
        'Review Talon library updates',
        'Implement temporary error filtering'
      ]
    },
    queue_backlog: {
      severity: 'P2',
      steps: [
        'Scale up workers',
        'Check database performance',
        'Review batch processing configuration',
        'Implement rate limiting if needed'
      ]
    }
  }.freeze
  
  def self.handle_incident(incident_type, context = {})
    incident_config = INCIDENT_TYPES[incident_type.to_sym]
    
    unless incident_config
      Rails.logger.error "Unknown incident type: #{incident_type}"
      return
    end
    
    Rails.logger.error "INCIDENT #{incident_config[:severity]}: #{incident_type} - #{context}"
    
    # Auto-execute immediate steps
    case incident_type.to_sym
    when :parser_down
      attempt_parser_recovery
    when :queue_backlog
      attempt_queue_recovery
    end
    
    # Send notifications
    AlertNotificationService.send_alert(
      incident_type,
      incident_config[:severity].downcase,
      "Email parser incident: #{incident_type}",
      context
    )
  end
  
  private
  
  def self.attempt_parser_recovery
    # Try restarting workers first
    system('pkill -f solid_queue && sleep 5 && bundle exec rails solid_queue:start -d')
    
    # Wait and check
    sleep(30)
    
    unless TalonEmailParser.instance.available?
      # Escalate to full application restart
      Rails.logger.error "Parser recovery failed, escalating to application restart"
    end
  end
end
```

## Scaling Guidelines

### Horizontal Scaling

#### Worker Scaling Strategy

```yaml
# docker-compose.scale.yml
version: '3.8'
services:
  email-parser-workers:
    image: your-app:latest
    command: bundle exec rails solid_queue:start
    environment:
      QUEUE_FILTER: parsing,parsing_priority
      WORKER_THREADS: 3
    deploy:
      replicas: 4
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 512M
          cpus: '0.25'
```

#### Database Scaling Considerations

```sql
-- Read replica configuration for analytics
-- Primary: Write operations (ParsedEmail inserts/updates)
-- Replica: Read operations (reporting, monitoring)

-- Connection routing in Rails
class ApplicationRecord < ActiveRecord::Base
  connects_to database: { 
    writing: :primary, 
    reading: :replica 
  }
end

class ParsedEmail < ApplicationRecord
  # Use replica for read-heavy operations
  def self.analytics_query
    connected_to(role: :reading) do
      # Complex analytical queries
    end
  end
end
```

### Vertical Scaling

#### Resource Optimization

```ruby
# config/puma.rb - Optimized for email parsing workload
workers Integer(ENV['WEB_CONCURRENCY'] || 4)
threads_count = Integer(ENV['RAILS_MAX_THREADS'] || 2)
threads threads_count, threads_count

# Reduce memory usage
preload_app!

on_worker_boot do
  # Initialize parser in each worker to avoid memory bloat
  TalonEmailParser.instance
end

# Memory management
before_fork do
  GC.start
end
```

#### Performance Tuning Parameters

```bash
# Environment variables for production scaling
export RAILS_MAX_THREADS=3                    # Balanced for email parsing
export WEB_CONCURRENCY=4                      # Based on CPU cores
export EMAIL_PARSER_BATCH_SIZE=20             # Optimize batch size
export EMAIL_PARSER_MAX_CONTENT_SIZE=2097152  # 2MB limit
export RUBY_GC_HEAP_GROWTH_FACTOR=1.1         # Conservative memory growth
```

---

*This operations guide provides comprehensive procedures for managing the email parser system in production. For detailed API documentation, see [EMAIL_PARSER_API.md](EMAIL_PARSER_API.md). For troubleshooting, refer to [EMAIL_PARSER_TROUBLESHOOTING.md](EMAIL_PARSER_TROUBLESHOOTING.md).*