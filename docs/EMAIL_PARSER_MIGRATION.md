# Email Parser Migration Guide

This guide provides step-by-step instructions for migrating existing FrontMessage data to use the new email reply parser system. It covers data migration strategies, performance considerations, and rollback procedures.

## Table of Contents

- [Overview](#overview)
- [Pre-Migration Assessment](#pre-migration-assessment)
- [Migration Strategies](#migration-strategies)
- [Step-by-Step Migration](#step-by-step-migration)
- [Data Validation](#data-validation)
- [Performance Optimization](#performance-optimization)
- [Rollback Procedures](#rollback-procedures)
- [Post-Migration Cleanup](#post-migration-cleanup)

## Overview

The email parser migration involves:

1. **Analyzing existing FrontMessage data** to determine parsing requirements
2. **Implementing incremental migration** to avoid system disruption
3. **Validating parsed results** against original content
4. **Monitoring performance** during the migration process
5. **Providing rollback capabilities** for data safety

### Migration Scope

- **FrontMessage records**: Process existing inbound, non-draft messages
- **Content types**: Both `body_plain` and `body_html` fields
- **ParsedEmail creation**: Generate parsed email records with clean content
- **Content deduplication**: Use content hashing to avoid duplicate processing
- **Error handling**: Track and manage parsing failures

## Pre-Migration Assessment

### Data Volume Analysis

Run this assessment to understand your migration scope:

```bash
# Generate migration assessment report
bundle exec rails runner "
  puts '=== Email Parser Migration Assessment ==='
  puts
  
  # Total FrontMessage count
  total_messages = FrontMessage.count
  puts \"Total FrontMessage records: #{total_messages.to_s.reverse.gsub(/...(?=.)/, '\&,').reverse}\"
  
  # Migration candidates (inbound, non-draft)
  candidates = FrontMessage.where(is_inbound: true, is_draft: false)
  candidate_count = candidates.count
  puts \"Migration candidates: #{candidate_count.to_s.reverse.gsub(/...(?=.)/, '\&,').reverse}\"
  
  # Content analysis
  with_plain = candidates.where.not(body_plain: [nil, '']).count
  with_html = candidates.where.not(body_html: [nil, '']).count
  with_both = candidates.where.not(body_plain: [nil, '']).where.not(body_html: [nil, '']).count
  
  puts \"Messages with plain text: #{with_plain.to_s.reverse.gsub(/...(?=.)/, '\&,').reverse}\"
  puts \"Messages with HTML: #{with_html.to_s.reverse.gsub(/...(?=.)/, '\&,').reverse}\"
  puts \"Messages with both formats: #{with_both.to_s.reverse.gsub(/...(?=.)/, '\&,').reverse}\"
  
  # Size analysis
  avg_plain_size = candidates.where.not(body_plain: [nil, '']).average('LENGTH(body_plain)')
  avg_html_size = candidates.where.not(body_html: [nil, '']).average('LENGTH(body_html)')
  
  puts \"Average plain text size: #{avg_plain_size&.round || 0} characters\"
  puts \"Average HTML size: #{avg_html_size&.round || 0} characters\"
  
  # Date range analysis
  oldest = candidates.minimum(:created_at)
  newest = candidates.maximum(:created_at)
  
  puts \"Date range: #{oldest&.strftime('%Y-%m-%d')} to #{newest&.strftime('%Y-%m-%d')}\"
  
  # Estimate processing time
  estimated_hours = (candidate_count / 600.0).round(1) # Assuming 600 emails/hour
  puts \"Estimated processing time: #{estimated_hours} hours\"
  
  puts
  puts '=== Recommendations ==='
  
  if candidate_count > 100_000
    puts '• Use incremental migration with small batch sizes'
    puts '• Consider running during off-peak hours'
    puts '• Enable comprehensive monitoring'
  elsif candidate_count > 10_000
    puts '• Use medium batch sizes (50-100 per batch)'
    puts '• Monitor memory usage during processing'
  else
    puts '• Can use standard batch sizes (100+ per batch)'
    puts '• Migration should complete quickly'
  end
  
  if avg_plain_size && avg_plain_size > 10_000
    puts '• Large message content detected - reduce batch sizes'
    puts '• Implement content size limits'
  end
"
```

### System Resources Check

```bash
# Check system capacity before migration
echo "=== System Resources Check ==="

# Available memory
free -h

# Database connections
bundle exec rails runner "
  puts \"Active DB connections: #{ActiveRecord::Base.connection_pool.stat}\"
"

# Current queue depth
bundle exec rails runner "
  parsing_jobs = SolidQueue::Job.where(queue_name: ['parsing', 'parsing_priority'], finished_at: nil).count
  puts \"Current parsing queue depth: #{parsing_jobs}\"
"

# Parser availability
bundle exec rake talon:status
```

## Migration Strategies

### Strategy 1: Incremental Date-Based Migration

**Best for**: Large datasets (>100K messages)  
**Approach**: Process messages in date ranges, oldest first

```ruby
# config/initializers/email_parser_migration.rb
class EmailParserMigration
  BATCH_SIZE = 50
  DATE_CHUNK_SIZE = 7.days
  
  def self.incremental_migration(start_date = nil, end_date = nil)
    start_date ||= FrontMessage.where(is_inbound: true, is_draft: false).minimum(:created_at)
    end_date ||= Date.current
    
    current_date = start_date
    total_processed = 0
    
    while current_date < end_date
      chunk_end = [current_date + DATE_CHUNK_SIZE, end_date].min
      
      puts "Processing messages from #{current_date.strftime('%Y-%m-%d')} to #{chunk_end.strftime('%Y-%m-%d')}"
      
      chunk_processed = process_date_range(current_date, chunk_end)
      total_processed += chunk_processed
      
      puts "Processed #{chunk_processed} messages in this chunk (#{total_processed} total)"
      
      # Brief pause between chunks
      sleep(5)
      
      current_date = chunk_end
    end
    
    puts "Migration completed: #{total_processed} messages processed"
  end
  
  private
  
  def self.process_date_range(start_date, end_date)
    candidates = FrontMessage.where(is_inbound: true, is_draft: false)
                             .where(created_at: start_date..end_date)
                             .where.not(id: ParsedEmail.where(parseable_type: 'FrontMessage')
                                                       .select(:parseable_id))
    
    total_in_range = candidates.count
    processed = 0
    
    candidates.find_in_batches(batch_size: BATCH_SIZE) do |batch|
      FrontMessageParsingJob.perform_later(
        batch.map(&:id),
        batch_size: BATCH_SIZE,
        skip_parsed: true
      )
      
      processed += batch.size
      
      # Progress reporting
      progress = (processed.to_f / total_in_range * 100).round(1)
      puts "  Progress: #{processed}/#{total_in_range} (#{progress}%)"
      
      # Brief pause between batches
      sleep(1)
    end
    
    processed
  end
end
```

### Strategy 2: Priority-Based Migration

**Best for**: Mixed datasets where recent messages are more important

```ruby
class PriorityBasedMigration
  def self.migrate_by_priority
    # Priority 1: Recent messages (last 30 days)
    migrate_recent_messages
    
    # Priority 2: High-volume conversations
    migrate_high_volume_conversations
    
    # Priority 3: Remaining messages
    migrate_remaining_messages
  end
  
  private
  
  def self.migrate_recent_messages
    puts "Migrating recent messages (last 30 days)..."
    
    recent_messages = FrontMessage.where(is_inbound: true, is_draft: false)
                                  .where('created_at > ?', 30.days.ago)
                                  .where.not(id: ParsedEmail.where(parseable_type: 'FrontMessage')
                                                            .select(:parseable_id))
    
    process_messages_in_batches(recent_messages, priority: 'high')
  end
  
  def self.migrate_high_volume_conversations
    puts "Migrating high-volume conversations..."
    
    # Find conversations with many messages
    high_volume_conversation_ids = FrontMessage.group(:front_conversation_id)
                                              .having('COUNT(*) > ?', 10)
                                              .pluck(:front_conversation_id)
    
    high_volume_messages = FrontMessage.where(is_inbound: true, is_draft: false)
                                       .where(front_conversation_id: high_volume_conversation_ids)
                                       .where.not(id: ParsedEmail.where(parseable_type: 'FrontMessage')
                                                                 .select(:parseable_id))
    
    process_messages_in_batches(high_volume_messages, priority: 'medium')
  end
  
  def self.migrate_remaining_messages
    puts "Migrating remaining messages..."
    
    remaining_messages = FrontMessage.where(is_inbound: true, is_draft: false)
                                     .where.not(id: ParsedEmail.where(parseable_type: 'FrontMessage')
                                                               .select(:parseable_id))
    
    process_messages_in_batches(remaining_messages, priority: 'low')
  end
end
```

### Strategy 3: Size-Based Migration

**Best for**: Datasets with varying message sizes

```ruby
class SizeBasedMigration
  def self.migrate_by_size
    # Small messages first (easier to process, faster feedback)
    migrate_small_messages
    
    # Medium messages
    migrate_medium_messages
    
    # Large messages (with reduced batch sizes)
    migrate_large_messages
  end
  
  private
  
  def self.migrate_small_messages
    puts "Migrating small messages (<5KB)..."
    
    small_messages = FrontMessage.where(is_inbound: true, is_draft: false)
                                 .where('LENGTH(COALESCE(body_plain, \'\')) + LENGTH(COALESCE(body_html, \'\')) < ?', 5000)
                                 .where.not(id: ParsedEmail.where(parseable_type: 'FrontMessage')
                                                           .select(:parseable_id))
    
    process_messages_in_batches(small_messages, batch_size: 100)
  end
  
  def self.migrate_medium_messages
    puts "Migrating medium messages (5KB-50KB)..."
    
    medium_messages = FrontMessage.where(is_inbound: true, is_draft: false)
                                  .where('LENGTH(COALESCE(body_plain, \'\')) + LENGTH(COALESCE(body_html, \'\')) BETWEEN ? AND ?', 5000, 50000)
                                  .where.not(id: ParsedEmail.where(parseable_type: 'FrontMessage')
                                                            .select(:parseable_id))
    
    process_messages_in_batches(medium_messages, batch_size: 50)
  end
  
  def self.migrate_large_messages
    puts "Migrating large messages (>50KB)..."
    
    large_messages = FrontMessage.where(is_inbound: true, is_draft: false)
                                 .where('LENGTH(COALESCE(body_plain, \'\')) + LENGTH(COALESCE(body_html, \'\')) > ?', 50000)
                                 .where.not(id: ParsedEmail.where(parseable_type: 'FrontMessage')
                                                           .select(:parseable_id))
    
    process_messages_in_batches(large_messages, batch_size: 10)
  end
end
```

## Step-by-Step Migration

### Phase 1: Preparation

```bash
# 1. Verify system readiness
echo "=== Phase 1: Migration Preparation ==="

# Check parser availability
bundle exec rake talon:status

# Verify database connectivity and space
bundle exec rails runner "
  puts 'Database connection: OK'
  puts 'ParsedEmail table exists: ' + ParsedEmail.table_exists?.to_s
"

# Check available disk space
df -h

# 2. Create migration tracking table (optional)
bundle exec rails runner "
  unless ActiveRecord::Base.connection.table_exists?('email_parser_migration_log')
    ActiveRecord::Base.connection.create_table :email_parser_migration_log do |t|
      t.string :batch_id, null: false
      t.integer :message_count
      t.integer :success_count
      t.integer :error_count
      t.datetime :started_at
      t.datetime :completed_at
      t.text :error_summary
      t.timestamps
    end
    
    puts 'Migration tracking table created'
  end
"

# 3. Set migration configuration
export EMAIL_PARSER_MIGRATION_BATCH_SIZE=50
export EMAIL_PARSER_MIGRATION_MAX_WORKERS=4
export EMAIL_PARSER_MIGRATION_PAUSE_SECONDS=2
```

### Phase 2: Test Migration

```bash
# Run a small test migration first
echo "=== Phase 2: Test Migration ==="

bundle exec rails runner "
  # Select a small sample for testing
  test_messages = FrontMessage.where(is_inbound: true, is_draft: false)
                              .where('created_at > ?', 7.days.ago)
                              .limit(10)
  
  puts \"Testing with #{test_messages.count} messages\"
  
  test_messages.each do |message|
    puts \"Processing message #{message.id}...\"
    
    begin
      message.parse!
      
      if message.parsed_email
        puts \"  ✓ Success: #{message.parsed_email.parsing_status}\"
        if message.parsed_email.clean_content
          puts \"  Clean content length: #{message.parsed_email.clean_content.length} chars\"
        end
      else
        puts \"  ✗ No parsed email created\"
      end
    rescue => e
      puts \"  ✗ Error: #{e.message}\"
    end
  end
  
  puts \"Test migration completed\"
"
```

### Phase 3: Full Migration Execution

```bash
# Execute the full migration
echo "=== Phase 3: Full Migration Execution ==="

# Choose migration strategy based on assessment
bundle exec rails runner "
  # Get total count for progress tracking
  total_candidates = FrontMessage.where(is_inbound: true, is_draft: false)
                                 .where.not(id: ParsedEmail.where(parseable_type: 'FrontMessage')
                                                           .select(:parseable_id))
                                 .count
  
  puts \"Starting migration of #{total_candidates} messages\"
  puts \"Strategy: Incremental date-based migration\"
  puts \"Batch size: #{ENV['EMAIL_PARSER_MIGRATION_BATCH_SIZE'] || 50}\"
  puts \"Start time: #{Time.current}\"
  
  # Execute migration
  EmailParserMigration.incremental_migration
"
```

### Phase 4: Progress Monitoring

```bash
# Monitor migration progress (run in separate terminal)
echo "=== Phase 4: Migration Monitoring ==="

# Create monitoring script
cat > monitor_migration.sh << 'EOF'
#!/bin/bash

while true; do
    echo "=== Migration Status - $(date) ==="
    
    # Progress statistics
    bundle exec rails runner "
      total_messages = FrontMessage.where(is_inbound: true, is_draft: false).count
      parsed_messages = ParsedEmail.where(parseable_type: 'FrontMessage').count
      pending_jobs = SolidQueue::Job.where(queue_name: ['parsing', 'parsing_priority'], finished_at: nil).count
      
      completion_rate = (parsed_messages.to_f / total_messages * 100).round(2)
      
      puts \"Total messages: #{total_messages}\"
      puts \"Parsed messages: #{parsed_messages}\"
      puts \"Completion rate: #{completion_rate}%\"
      puts \"Pending jobs: #{pending_jobs}\"
      
      # Recent activity
      recent_parsed = ParsedEmail.where('created_at > ?', 5.minutes.ago).count
      puts \"Parsed in last 5 minutes: #{recent_parsed}\"
      
      # Error rate
      recent_errors = ParsedEmail.with_errors.where('created_at > ?', 1.hour.ago).count
      recent_total = ParsedEmail.where('created_at > ?', 1.hour.ago).count
      error_rate = recent_total > 0 ? (recent_errors.to_f / recent_total * 100).round(2) : 0
      puts \"Recent error rate: #{error_rate}%\"
    "
    
    echo
    sleep 60
done
EOF

chmod +x monitor_migration.sh
./monitor_migration.sh
```

## Data Validation

### Content Accuracy Validation

```ruby
# app/services/migration_validation_service.rb
class MigrationValidationService
  def self.validate_parsed_content(sample_size: 100)
    puts "=== Content Accuracy Validation ==="
    
    # Select random sample of parsed emails
    sample = ParsedEmail.joins(:parseable)
                       .where(parseable_type: 'FrontMessage')
                       .order('RANDOM()')
                       .limit(sample_size)
                       .includes(:parseable)
    
    validation_results = {
      total_checked: 0,
      content_preserved: 0,
      signature_detected: 0,
      quotes_removed: 0,
      encoding_issues: 0,
      content_length_reduction: []
    }
    
    sample.each do |parsed_email|
      front_message = parsed_email.parseable
      
      validation_results[:total_checked] += 1
      
      # Check content preservation
      original_length = [front_message.body_plain, front_message.body_html].compact.sum(&:length)
      parsed_length = [parsed_email.plain_message, parsed_email.html_message].compact.sum(&:length)
      
      if parsed_length > 0
        validation_results[:content_preserved] += 1
        
        # Calculate length reduction (indicates quote removal)
        reduction_ratio = 1.0 - (parsed_length.to_f / original_length)
        validation_results[:content_length_reduction] << reduction_ratio
        
        if reduction_ratio > 0.1  # >10% reduction suggests quotes were removed
          validation_results[:quotes_removed] += 1
        end
      end
      
      # Check signature detection
      if parsed_email.has_signature?
        validation_results[:signature_detected] += 1
      end
      
      # Check for encoding issues
      if parsed_email.clean_content&.include?('�') || parsed_email.signature&.include?('�')
        validation_results[:encoding_issues] += 1
      end
    end
    
    # Calculate statistics
    avg_reduction = validation_results[:content_length_reduction].empty? ? 0 : 
                   (validation_results[:content_length_reduction].sum / validation_results[:content_length_reduction].size * 100).round(1)
    
    puts "Results:"
    puts "  Total validated: #{validation_results[:total_checked]}"
    puts "  Content preserved: #{validation_results[:content_preserved]} (#{(validation_results[:content_preserved].to_f / validation_results[:total_checked] * 100).round(1)}%)"
    puts "  Signatures detected: #{validation_results[:signature_detected]} (#{(validation_results[:signature_detected].to_f / validation_results[:total_checked] * 100).round(1)}%)"
    puts "  Quotes removed: #{validation_results[:quotes_removed]} (#{(validation_results[:quotes_removed].to_f / validation_results[:total_checked] * 100).round(1)}%)"
    puts "  Average content reduction: #{avg_reduction}%"
    puts "  Encoding issues: #{validation_results[:encoding_issues]}"
    
    validation_results
  end
  
  def self.validate_database_consistency
    puts "=== Database Consistency Validation ==="
    
    # Check for orphaned parsed emails
    orphaned = ParsedEmail.where(parseable_type: 'FrontMessage')
                         .where.not(parseable_id: FrontMessage.select(:id))
                         .count
    
    puts "Orphaned ParsedEmail records: #{orphaned}"
    
    # Check for duplicate content hashes
    duplicates = ParsedEmail.group(:content_hash)
                           .having('COUNT(*) > 1')
                           .count
                           .count
    
    puts "Duplicate content hashes: #{duplicates}"
    
    # Check parsing success rate
    total_parsed = ParsedEmail.count
    successful_parsed = ParsedEmail.successful.count
    success_rate = total_parsed > 0 ? (successful_parsed.to_f / total_parsed * 100).round(2) : 0
    
    puts "Overall parsing success rate: #{success_rate}% (#{successful_parsed}/#{total_parsed})"
    
    # Check for messages that should be parsed but aren't
    should_be_parsed = FrontMessage.where(is_inbound: true, is_draft: false).count
    actually_parsed = ParsedEmail.where(parseable_type: 'FrontMessage').count
    coverage = should_be_parsed > 0 ? (actually_parsed.to_f / should_be_parsed * 100).round(2) : 0
    
    puts "Migration coverage: #{coverage}% (#{actually_parsed}/#{should_be_parsed})"
    
    {
      orphaned_records: orphaned,
      duplicate_hashes: duplicates,
      success_rate: success_rate,
      coverage: coverage
    }
  end
end
```

### Performance Impact Validation

```bash
# Check performance impact of migration
echo "=== Performance Impact Validation ==="

# Database size increase
bundle exec rails runner "
  front_messages_size = ActiveRecord::Base.connection.execute(
    \"SELECT pg_size_pretty(pg_total_relation_size('front_messages'))\"
  ).first['pg_size_pretty']
  
  parsed_emails_size = ActiveRecord::Base.connection.execute(
    \"SELECT pg_size_pretty(pg_total_relation_size('parsed_emails'))\"
  ).first['pg_size_pretty']
  
  puts \"FrontMessages table size: #{front_messages_size}\"
  puts \"ParsedEmails table size: #{parsed_emails_size}\"
"

# Query performance comparison
bundle exec rails runner "
  require 'benchmark'
  
  # Test query performance
  message_id = FrontMessage.where(is_inbound: true).first&.id
  
  if message_id
    # Original content access
    original_time = Benchmark.measure do
      1000.times { FrontMessage.find(message_id).body_plain }
    end
    
    # Parsed content access
    parsed_time = Benchmark.measure do
      1000.times { 
        parsed = ParsedEmail.find_by(parseable_id: message_id, parseable_type: 'FrontMessage')
        parsed&.clean_content
      }
    end
    
    puts \"Original content access (1000x): #{original_time.real.round(3)}s\"
    puts \"Parsed content access (1000x): #{parsed_time.real.round(3)}s\"
  end
"
```

## Performance Optimization

### Migration-Specific Optimizations

```ruby
# Temporary optimizations during migration
class MigrationOptimizations
  def self.apply_migration_settings
    # Temporarily disable some callbacks to speed up processing
    ParsedEmail.skip_callback(:create, :after, :update_search_index) if ParsedEmail.respond_to?(:skip_callback)
    
    # Increase batch sizes for bulk operations
    ActiveRecord::Base.connection.execute("SET work_mem = '256MB'")
    ActiveRecord::Base.connection.execute("SET maintenance_work_mem = '1GB'")
    
    # Disable auto-vacuum during migration
    ActiveRecord::Base.connection.execute("ALTER TABLE parsed_emails SET (autovacuum_enabled = false)")
    
    puts "Migration optimizations applied"
  end
  
  def self.restore_normal_settings
    # Re-enable callbacks
    ParsedEmail.set_callback(:create, :after, :update_search_index) if ParsedEmail.respond_to?(:set_callback)
    
    # Reset database settings
    ActiveRecord::Base.connection.execute("RESET work_mem")
    ActiveRecord::Base.connection.execute("RESET maintenance_work_mem")
    
    # Re-enable auto-vacuum
    ActiveRecord::Base.connection.execute("ALTER TABLE parsed_emails RESET (autovacuum_enabled)")
    
    # Run vacuum and analyze
    ActiveRecord::Base.connection.execute("VACUUM ANALYZE parsed_emails")
    
    puts "Normal settings restored"
  end
end

# Apply optimizations before migration
MigrationOptimizations.apply_migration_settings

# ... run migration ...

# Restore settings after migration
MigrationOptimizations.restore_normal_settings
```

### Index Creation Strategy

```sql
-- Create indexes AFTER migration for better performance
-- Run this after migration is complete

-- Primary lookup indexes
CREATE INDEX CONCURRENTLY idx_parsed_emails_lookup 
ON parsed_emails (parseable_type, parseable_id);

-- Content search indexes (if needed)
CREATE INDEX CONCURRENTLY idx_parsed_emails_plain_content 
ON parsed_emails USING gin(to_tsvector('english', plain_message))
WHERE plain_message IS NOT NULL;

-- Performance monitoring indexes
CREATE INDEX CONCURRENTLY idx_parsed_emails_parsing_metrics 
ON parsed_emails (parsed_at, parser_version, parsing_successful)
WHERE parsed_at IS NOT NULL;

-- Analytics indexes
CREATE INDEX CONCURRENTLY idx_parsed_emails_analytics 
ON parsed_emails (created_at, has_signature, content_hash)
WHERE created_at > '2024-01-01';
```

## Rollback Procedures

### Emergency Rollback

```bash
#!/bin/bash
# emergency_rollback.sh

echo "=== EMERGENCY ROLLBACK PROCEDURE ==="
echo "This will stop migration and optionally remove parsed data"
echo

read -p "Are you sure you want to proceed? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Rollback cancelled"
    exit 1
fi

# 1. Stop all parsing jobs
echo "Stopping all parsing jobs..."
bundle exec rails runner "
  SolidQueue::Job.where(queue_name: ['parsing', 'parsing_priority'], finished_at: nil)
                 .update_all(finished_at: Time.current)
  puts 'All parsing jobs stopped'
"

# 2. Stop workers
echo "Stopping workers..."
pkill -f solid_queue

# 3. Optional: Remove all parsed data
read -p "Remove all ParsedEmail data? (yes/no): " remove_data
if [ "$remove_data" = "yes" ]; then
    echo "Removing parsed email data..."
    bundle exec rails runner "
      deleted_count = ParsedEmail.delete_all
      puts \"Deleted #{deleted_count} ParsedEmail records\"
    "
fi

# 4. Disable future parsing
echo "Disabling automatic parsing..."
bundle exec rails runner "
  # You might want to add a feature flag or configuration to disable parsing
  puts 'Automatic parsing disabled (implement based on your configuration system)'
"

echo "Rollback completed at $(date)"
```

### Selective Rollback

```ruby
# Rollback specific date ranges or problematic batches
class SelectiveRollback
  def self.rollback_date_range(start_date, end_date)
    puts "Rolling back parsed emails from #{start_date} to #{end_date}"
    
    # Find FrontMessages in date range
    message_ids = FrontMessage.where(created_at: start_date..end_date).pluck(:id)
    
    # Remove corresponding ParsedEmails
    deleted_count = ParsedEmail.where(parseable_type: 'FrontMessage', 
                                     parseable_id: message_ids).delete_all
    
    puts "Removed #{deleted_count} ParsedEmail records"
    
    deleted_count
  end
  
  def self.rollback_errors_only
    puts "Rolling back only failed parsing attempts"
    
    deleted_count = ParsedEmail.with_errors.delete_all
    
    puts "Removed #{deleted_count} failed ParsedEmail records"
    
    deleted_count
  end
  
  def self.rollback_large_messages
    puts "Rolling back parsed emails for large messages (>100KB)"
    
    large_message_ids = FrontMessage.where(
      'LENGTH(COALESCE(body_plain, \'\')) + LENGTH(COALESCE(body_html, \'\')) > ?', 
      100_000
    ).pluck(:id)
    
    deleted_count = ParsedEmail.where(parseable_type: 'FrontMessage',
                                     parseable_id: large_message_ids).delete_all
    
    puts "Removed #{deleted_count} ParsedEmail records for large messages"
    
    deleted_count
  end
end
```

## Post-Migration Cleanup

### Database Maintenance

```bash
# Post-migration database maintenance
echo "=== Post-Migration Database Cleanup ==="

# 1. Update table statistics
bundle exec rails runner "
  ActiveRecord::Base.connection.execute('ANALYZE front_messages')
  ActiveRecord::Base.connection.execute('ANALYZE parsed_emails')
  puts 'Table statistics updated'
"

# 2. Vacuum tables to reclaim space
bundle exec rails runner "
  ActiveRecord::Base.connection.execute('VACUUM ANALYZE front_messages')
  ActiveRecord::Base.connection.execute('VACUUM ANALYZE parsed_emails')
  puts 'Tables vacuumed and analyzed'
"

# 3. Check for unused indexes
bundle exec rails runner "
  unused_indexes = ActiveRecord::Base.connection.execute(\"
    SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
    FROM pg_stat_user_indexes 
    WHERE idx_tup_read = 0 AND idx_tup_fetch = 0
    AND tablename IN ('front_messages', 'parsed_emails')
  \")
  
  if unused_indexes.any?
    puts 'Unused indexes found:'
    unused_indexes.each { |idx| puts \"  #{idx['tablename']}.#{idx['indexname']}\" }
  else
    puts 'No unused indexes found'
  end
"
```

### Application Code Updates

```ruby
# Update application code to use parsed content
class FrontMessage < ApplicationRecord
  has_one :parsed_email, as: :parseable, dependent: :destroy
  
  # Migration-safe display method
  def display_content_safe(include_signature: false, prefer_html: false)
    # Use parsed content if available, fallback to original
    if parsed_email&.parsing_successful?
      if include_signature
        parsed_email.content_with_signature(prefer_html: prefer_html)
      else
        parsed_email.clean_content(prefer_html: prefer_html)
      end
    else
      # Fallback to original content
      prefer_html && body_html.present? ? body_html : body_plain
    end
  end
  
  # Check if message has been successfully parsed
  def parsed?
    parsed_email&.parsing_successful? || false
  end
  
  # Get parsing status for debugging
  def parsing_status
    return 'not_parsed' unless parsed_email
    parsed_email.parsing_status
  end
end
```

### Monitoring Setup

```ruby
# Set up post-migration monitoring
class PostMigrationMonitoring
  def self.setup_monitoring
    # Monitor parsing coverage
    Rails.application.config.after_initialize do
      # Daily coverage report
      Sidekiq::Cron::Job.create(
        name: 'Email Parser Coverage Report',
        cron: '0 9 * * *',  # 9 AM daily
        class: 'EmailParserCoverageReportJob'
      )
      
      # Weekly performance analysis
      Sidekiq::Cron::Job.create(
        name: 'Email Parser Performance Analysis',
        cron: '0 10 * * 1',  # 10 AM Monday
        class: 'EmailParserPerformanceAnalysisJob'
      )
    end
  end
end

# Jobs for ongoing monitoring
class EmailParserCoverageReportJob < ApplicationJob
  def perform
    total_messages = FrontMessage.where(is_inbound: true, is_draft: false).count
    parsed_messages = ParsedEmail.where(parseable_type: 'FrontMessage').count
    coverage = (parsed_messages.to_f / total_messages * 100).round(2)
    
    # Send report to monitoring system
    Rails.logger.info "Email Parser Coverage: #{coverage}% (#{parsed_messages}/#{total_messages})"
    
    # Alert if coverage drops below threshold
    if coverage < 95.0
      AlertNotificationService.send_alert(
        'low_coverage',
        'warning',
        "Email parser coverage is #{coverage}%",
        { expected: '95%', actual: "#{coverage}%" }
      )
    end
  end
end
```

### Final Validation and Sign-off

```bash
# Final migration validation checklist
echo "=== Final Migration Validation ==="

echo "1. Data Integrity Check"
bundle exec rails runner "
  total_candidates = FrontMessage.where(is_inbound: true, is_draft: false).count
  total_parsed = ParsedEmail.where(parseable_type: 'FrontMessage').count
  success_rate = (ParsedEmail.successful.count.to_f / total_parsed * 100).round(2)
  
  puts \"Migration coverage: #{(total_parsed.to_f / total_candidates * 100).round(2)}%\"
  puts \"Parsing success rate: #{success_rate}%\"
  
  # Check for critical errors
  critical_errors = ParsedEmail.where(\"parse_errors ? 'critical'\").count
  puts \"Critical errors: #{critical_errors}\"
"

echo "2. Performance Validation"
bundle exec rake front_message_parsing:performance_report

echo "3. Application Integration Test"
bundle exec rails runner "
  # Test application integration
  sample_message = FrontMessage.joins(:parsed_email).first
  
  if sample_message
    puts \"Testing display methods...\"
    puts \"Clean content: #{sample_message.display_content_safe.present? ? 'OK' : 'FAIL'}\"
    puts \"With signature: #{sample_message.display_content_safe(include_signature: true).present? ? 'OK' : 'FAIL'}\"
    puts \"Parsing status: #{sample_message.parsing_status}\"
  else
    puts \"No parsed messages found for testing\"
  end
"

echo "4. System Health Check"
bundle exec rake talon:status

echo
echo "Migration validation completed at $(date)"
echo "Review the results above and confirm all checks pass before considering migration complete."
```

---

*This migration guide provides comprehensive procedures for migrating existing FrontMessage data to use the email parser system. For ongoing operations, refer to [EMAIL_PARSER_OPERATIONS.md](EMAIL_PARSER_OPERATIONS.md). For troubleshooting migration issues, see [EMAIL_PARSER_TROUBLESHOOTING.md](EMAIL_PARSER_TROUBLESHOOTING.md).*