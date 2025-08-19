# Email Parsing Batch Processing

This document describes the enhanced email parsing system with batch processing capabilities, implemented as part of Phase 6 of the email parser integration (EP-0034).

## Overview

The batch processing system consists of:
- **FrontMessageParsingJob**: Enhanced background job for batch processing
- **Rake tasks**: Command-line tools for batch operations
- **Queue priorities**: Optimized job processing with SolidQueue
- **Performance monitoring**: Comprehensive metrics and health tracking

## Components

### 1. FrontMessageParsingJob

Enhanced background job that processes multiple messages in batches with:
- Exponential backoff retry logic
- Performance monitoring and metrics
- Memory management for large batches
- Concurrent processing limits
- Comprehensive error handling

**Queue**: `parsing_priority` (higher priority than individual parsing)

### 2. Rake Tasks

Comprehensive set of rake tasks for managing batch processing:

```bash
# Show parsing status and statistics
rake front_message_parsing:status

# Process unparsed messages in batches
rake front_message_parsing:batch

# Reparse messages that had errors
rake front_message_parsing:reparse

# Process messages from specific date range  
rake front_message_parsing:date_range START_DATE=2024-01-01 END_DATE=2024-01-31

# Test batch parsing with small sample
rake front_message_parsing:test

# Show detailed performance metrics
rake front_message_parsing:performance_report

# Clear parsing metrics cache
rake front_message_parsing:clear_metrics_cache

# Show help
rake front_message_parsing:help
```

### 3. Queue Configuration

Enhanced SolidQueue configuration with priority queues:

- **urgent** (priority 100): Critical operations
- **front_sync** (priority 90): Front API sync operations  
- **parsing_priority** (priority 80): Email parsing batch jobs
- **parsing** (priority 70): Individual email parsing
- **default** (priority 50): Standard job processing
- **low_priority** (priority 30): Background cleanup
- **maintenance** (priority 10): System maintenance

### 4. Performance Monitoring

Comprehensive monitoring with `EmailParsingMonitorService`:
- Real-time parsing statistics
- Performance metrics and trends
- Error analysis and patterns
- Queue health monitoring
- Automated recommendations

## Usage Examples

### Basic Batch Processing

```bash
# Process up to 1000 unparsed messages in batches of 10
rake front_message_parsing:batch

# Process with custom settings
rake front_message_parsing:batch BATCH_SIZE=20 MAX_MESSAGES=500
```

### Reprocessing Errors

```bash
# Reparse messages with errors from last 7 days
rake front_message_parsing:reparse

# Reparse with custom settings
rake front_message_parsing:reparse DAYS_BACK=14 BATCH_SIZE=5
```

### Date Range Processing

```bash
# Process messages from specific month
rake front_message_parsing:date_range START_DATE=2024-01-01 END_DATE=2024-01-31

# Force reparse all messages in range
rake front_message_parsing:date_range START_DATE=2024-01-01 END_DATE=2024-01-31 FORCE_REPARSE=true
```

### Programmatic Usage

```ruby
# Queue batch processing from code
message_ids = FrontMessage.where(is_inbound: true).limit(100).pluck(:id)
FrontMessage.queue_batch_parsing(message_ids, batch_size: 15)

# Queue all unparsed messages
jobs = FrontMessage.queue_all_unparsed(limit: 500, batch_size: 10)

# Monitor parsing status
monitor = EmailParsingMonitorService.instance
status = monitor.parsing_status
puts "Completion rate: #{status[:overview][:completion_percentage]}%"
```

## Configuration Options

### Batch Job Options

- **message_ids**: Array of FrontMessage IDs to process (required)
- **batch_size**: Messages processed in parallel (default: 10, max: 100)
- **skip_parsed**: Skip messages with existing ParsedEmail records (default: true)
- **force_reparse**: Force reparsing even if already parsed (default: false)
- **options**: Additional parsing options passed to TalonEmailParser

### Environment Variables

- **BATCH_SIZE**: Messages per batch (default: 10)
- **MAX_MESSAGES**: Maximum messages to process (default: 1000)
- **SKIP_PARSED**: Skip already parsed messages (default: true)
- **FORCE_REPARSE**: Force reparsing of all messages (default: false)
- **DAYS_BACK**: Days to look back for error analysis (default: 7)
- **SAMPLE_SIZE**: Number of messages for testing (default: 5)

## Performance Features

### Retry Logic
- **TalonEmailParser::ParseError**: 5 attempts with exponential backoff + jitter
- **StandardError**: 3 attempts with exponential backoff + jitter
- **Permanent failures**: ArgumentError, ActiveRecord::RecordNotFound discarded

### Memory Management
- Force garbage collection every 50 processed messages
- Brief pauses between batches to manage system load
- Connection pool optimization for high concurrency

### Performance Monitoring
- Real-time job metrics in Rails cache
- Comprehensive batch statistics
- Throughput and success rate tracking
- Slow job alerts (configurable threshold)
- Queue health monitoring

### Error Handling
- Individual message error isolation
- Comprehensive error logging with context
- Error pattern analysis and reporting  
- Failure alerting and escalation

## Monitoring and Alerts

### Health Checks
- Completion rate monitoring
- Error rate tracking
- Queue backlog alerts
- Stuck job detection
- Performance degradation warnings

### Metrics Available
- Total/parsed/unparsed message counts
- Success rates and error patterns
- Average processing times and throughput
- Queue status and job counts
- Hourly processing distribution

### Recommendations
The system automatically generates recommendations based on:
- Low completion rates (< 80%)
- High error rates (> 10%)
- Large queue backlogs (> 100 pending)
- Slow processing times (> 60s average)

## Integration Points

### External Metrics (Optional)
The system includes integration points for external monitoring:
- StatsD/DataDog metrics
- Sentry error tracking  
- Custom monitoring dashboards
- Alert thresholds and notifications

### API Integration
- TalonEmailParser service integration
- ParsedEmail model updates
- Content hash deduplication
- FrontMessage model enhancements

## Troubleshooting

### Common Issues

1. **High error rates**: Check TalonEmailParser availability and configuration
2. **Slow processing**: Reduce batch size or increase worker capacity
3. **Queue backlogs**: Scale workers or adjust queue priorities
4. **Memory issues**: Reduce batch size or increase system memory

### Diagnostics

```bash
# Check overall status
rake front_message_parsing:status

# View performance report
rake front_message_parsing:performance_report

# Test with small sample
rake front_message_parsing:test SAMPLE_SIZE=5

# Clear metrics if needed
rake front_message_parsing:clear_metrics_cache
```

### Log Analysis
- Job performance logs include duration and throughput
- Error logs include full context and stack traces
- Batch metrics are cached for dashboard integration
- Queue health is monitored continuously in production

## Best Practices

1. **Start small**: Use test task before large batch operations
2. **Monitor performance**: Check status regularly during large batches
3. **Handle errors**: Use reparse task to handle failed messages
4. **Optimize batches**: Adjust batch size based on system capacity
5. **Schedule maintenance**: Clear old metrics and logs periodically
6. **Monitor queues**: Watch for backlogs and stuck jobs
7. **Review errors**: Analyze error patterns for system improvements

## Migration from Individual Processing

The system maintains backward compatibility:
- Individual `EmailParseJob` continues to work
- New messages are still queued individually by default
- Batch processing is additive, not replacement
- Both jobs share the same parsing logic and models

To migrate to batch processing:
1. Use rake tasks for existing unparsed messages
2. Consider scheduling regular batch processing
3. Monitor performance and adjust batch sizes
4. Gradually increase batch processing usage
5. Keep individual processing for real-time needs