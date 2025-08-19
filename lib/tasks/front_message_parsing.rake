# Rake tasks for batch processing email parsing with FrontMessageParsingJob
namespace :front_message_parsing do
  desc "Show status of email parsing progress and statistics"
  task status: :environment do
    puts "\n" + "="*60
    puts "FRONT MESSAGE PARSING STATUS"
    puts "="*60
    
    # Overall statistics
    total_front_messages = FrontMessage.where(is_inbound: true, is_draft: false, message_type: 'email').count
    parsed_messages = FrontMessage.joins(:parsed_email).where(is_inbound: true, is_draft: false, message_type: 'email').count
    unparsed_messages = total_front_messages - parsed_messages
    
    puts "\n📊 PARSING OVERVIEW"
    puts "-" * 30
    puts "Total Email Messages: #{total_front_messages}"
    puts "Parsed Messages: #{parsed_messages}"
    puts "Unparsed Messages: #{unparsed_messages}"
    puts "Completion Rate: #{total_front_messages > 0 ? ((parsed_messages.to_f / total_front_messages) * 100).round(1) : 0}%"
    
    # Recent parsing statistics
    recent_parsed = ParsedEmail.where(parseable_type: 'FrontMessage')
                               .where('parsed_at > ?', 24.hours.ago)
                               .count
    
    recent_errors = ParsedEmail.where(parseable_type: 'FrontMessage')
                               .where('parsed_at > ?', 24.hours.ago)
                               .where.not(parse_errors: [nil, {}, '{}', '[]'])
                               .count
    
    puts "\n📈 RECENT ACTIVITY (24h)"
    puts "-" * 30
    puts "Recently Parsed: #{recent_parsed}"
    puts "Recent Errors: #{recent_errors}"
    puts "Success Rate (24h): #{recent_parsed > 0 ? (((recent_parsed - recent_errors).to_f / recent_parsed) * 100).round(1) : 'N/A'}%"
    
    # Queue status for parsing jobs
    if defined?(SolidQueue)
      # SolidQueue jobs don't have a direct status column, check by finished_at
      pending_jobs = SolidQueue::Job.where(class_name: 'FrontMessageParsingJob', finished_at: nil).count
      completed_jobs = SolidQueue::Job.where(class_name: 'FrontMessageParsingJob').where.not(finished_at: nil).count
      
      puts "\n🔄 JOB QUEUE STATUS"
      puts "-" * 30
      puts "Pending Batch Jobs: #{pending_jobs}"
      puts "Completed Batch Jobs: #{completed_jobs}"
    end
    
    # Performance metrics from cache
    recent_metrics = Rails.cache.read_multi(*Rails.cache.instance_variable_get(:@data).keys.select { |k| k.to_s.start_with?('email_parsing_metrics:batch:') })
    
    if recent_metrics.any?
      puts "\n⚡ RECENT BATCH PERFORMANCE"
      puts "-" * 30
      
      avg_duration = recent_metrics.values.map { |m| m[:duration_seconds] }.sum / recent_metrics.length
      avg_throughput = recent_metrics.values.map { |m| m[:throughput_per_second] }.sum / recent_metrics.length
      avg_success_rate = recent_metrics.values.map { |m| m[:success_rate_percent] }.sum / recent_metrics.length
      
      puts "Average Batch Duration: #{avg_duration.round(2)}s"
      puts "Average Throughput: #{avg_throughput.round(2)} messages/sec"
      puts "Average Success Rate: #{avg_success_rate.round(1)}%"
      puts "Recent Batches: #{recent_metrics.length}"
    end
    
    # Error analysis
    error_messages = ParsedEmail.where(parseable_type: 'FrontMessage')
                                .where.not(parse_errors: [nil, {}, '{}', '[]'])
                                .where('parsed_at > ?', 7.days.ago)
                                .limit(5)
    
    if error_messages.any?
      puts "\n🚨 RECENT PARSING ERRORS"
      puts "-" * 30
      error_messages.each do |parsed_email|
        error_data = JSON.parse(parsed_email.parse_errors) rescue { error: parsed_email.parse_errors }
        error_msg = error_data.is_a?(Hash) ? error_data['error'] : error_data.to_s
        error_msg ||= 'Unknown error'
        
        puts "Message #{parsed_email.parseable_id}: #{error_msg.truncate(60)}"
      end
    end
    
    puts "\n" + "="*60
    puts "Use 'rake front_message_parsing:batch' to process unparsed messages"
    puts "Use 'rake front_message_parsing:reparse' to reprocess messages with errors"
    puts "="*60 + "\n"
  end
  
  desc "Process unparsed messages in batches"
  task batch: :environment do
    batch_size = ENV['BATCH_SIZE']&.to_i || 10
    max_messages = ENV['MAX_MESSAGES']&.to_i || 1000
    skip_parsed = ENV['SKIP_PARSED'] != 'false'
    
    puts "\n🚀 STARTING BATCH EMAIL PARSING"
    puts "-" * 40
    puts "Batch Size: #{batch_size} messages per job"
    puts "Max Messages: #{max_messages}"
    puts "Skip Parsed: #{skip_parsed}"
    
    # Find unparsed messages
    unparsed_query = FrontMessage.where(is_inbound: true, is_draft: false, message_type: 'email')
    
    if skip_parsed
      unparsed_query = unparsed_query.left_joins(:parsed_email)
                                    .where(parsed_emails: { id: nil })
    end
    
    unparsed_messages = unparsed_query.limit(max_messages).pluck(:id)
    
    if unparsed_messages.empty?
      puts "✅ No unparsed messages found."
      exit 0
    end
    
    puts "Found #{unparsed_messages.length} messages to process"
    
    # Create batch jobs
    job_batches = unparsed_messages.each_slice(batch_size * 5).to_a  # Each job processes 5 sub-batches
    puts "Creating #{job_batches.length} batch jobs..."
    
    job_batches.each_with_index do |message_batch, index|
      batch_options = {
        message_ids: message_batch,
        batch_size: batch_size,
        skip_parsed: skip_parsed,
        force_reparse: false,
        options: {}
      }
      
      FrontMessageParsingJob.perform_later(batch_options)
      puts "✅ Queued batch job #{index + 1}/#{job_batches.length} (#{message_batch.length} messages)"
    end
    
    puts "\n📊 Batch processing initiated!"
    puts "Monitor progress with: rake front_message_parsing:status"
    puts "View job queue with: rails runner 'puts SolidQueue::Job.where(class_name: \"FrontMessageParsingJob\").count'"
  end
  
  desc "Reparse messages that had parsing errors"
  task reparse: :environment do
    batch_size = ENV['BATCH_SIZE']&.to_i || 10
    max_messages = ENV['MAX_MESSAGES']&.to_i || 500
    days_back = ENV['DAYS_BACK']&.to_i || 7
    
    puts "\n🔄 REPARSING MESSAGES WITH ERRORS"
    puts "-" * 40
    puts "Batch Size: #{batch_size}"
    puts "Max Messages: #{max_messages}"
    puts "Looking back: #{days_back} days"
    
    # Find messages with parsing errors
    error_parsed_emails = ParsedEmail.where(parseable_type: 'FrontMessage')
                                     .where.not(parse_errors: [nil, {}, '{}', '[]'])
                                     .where('parsed_at > ?', days_back.days.ago)
                                     .limit(max_messages)
    
    if error_parsed_emails.empty?
      puts "✅ No messages with parsing errors found."
      exit 0
    end
    
    message_ids = error_parsed_emails.map { |pe| pe.parseable_id }
    puts "Found #{message_ids.length} messages with parsing errors to reprocess"
    
    # Show error breakdown
    error_types = {}
    error_parsed_emails.each do |pe|
      error_data = JSON.parse(pe.parse_errors) rescue { error: 'parse_error' }
      error_key = error_data.is_a?(Hash) ? error_data['error'].to_s.split(':').first : 'unknown'
      error_types[error_key] = (error_types[error_key] || 0) + 1
    end
    
    puts "\nError breakdown:"
    error_types.each { |type, count| puts "  #{type}: #{count}" }
    
    print "\nProceed with reparsing? (y/N): "
    response = STDIN.gets.chomp.downcase
    
    unless response == 'y' || response == 'yes'
      puts "Operation cancelled."
      exit 0
    end
    
    # Create reparse batch jobs
    job_batches = message_ids.each_slice(batch_size * 3).to_a  # Smaller batches for error reparsing
    puts "\nCreating #{job_batches.length} reparse batch jobs..."
    
    job_batches.each_with_index do |message_batch, index|
      batch_options = {
        message_ids: message_batch,
        batch_size: batch_size,
        skip_parsed: false,
        force_reparse: true,  # Force reparsing even if already parsed
        options: { reparse: true }
      }
      
      FrontMessageParsingJob.perform_later(batch_options)
      puts "✅ Queued reparse batch #{index + 1}/#{job_batches.length} (#{message_batch.length} messages)"
    end
    
    puts "\n📊 Reparse batch processing initiated!"
    puts "Monitor progress with: rake front_message_parsing:status"
  end
  
  desc "Process messages from a specific date range"
  task :date_range => :environment do
    start_date = ENV['START_DATE'] ? Date.parse(ENV['START_DATE']) : 30.days.ago.to_date
    end_date = ENV['END_DATE'] ? Date.parse(ENV['END_DATE']) : Date.current
    batch_size = ENV['BATCH_SIZE']&.to_i || 10
    force_reparse = ENV['FORCE_REPARSE'] == 'true'
    
    puts "\n📅 PROCESSING MESSAGES BY DATE RANGE"
    puts "-" * 40
    puts "Start Date: #{start_date}"
    puts "End Date: #{end_date}"
    puts "Batch Size: #{batch_size}"
    puts "Force Reparse: #{force_reparse}"
    
    if start_date > end_date
      puts "❌ Error: Start date must be before end date"
      exit 1
    end
    
    # Find messages in date range
    messages_query = FrontMessage.where(is_inbound: true, is_draft: false, message_type: 'email')
                                 .where(created_at: start_date.beginning_of_day..end_date.end_of_day)
    
    unless force_reparse
      messages_query = messages_query.left_joins(:parsed_email)
                                    .where(parsed_emails: { id: nil })
    end
    
    message_ids = messages_query.pluck(:id)
    
    if message_ids.empty?
      puts "✅ No messages found in the specified date range."
      exit 0
    end
    
    puts "Found #{message_ids.length} messages in date range"
    
    # Create batch jobs for date range
    job_batches = message_ids.each_slice(batch_size * 4).to_a
    puts "Creating #{job_batches.length} batch jobs for date range processing..."
    
    job_batches.each_with_index do |message_batch, index|
      batch_options = {
        message_ids: message_batch,
        batch_size: batch_size,
        skip_parsed: !force_reparse,
        force_reparse: force_reparse,
        options: { date_range: "#{start_date}_to_#{end_date}" }
      }
      
      FrontMessageParsingJob.perform_later(batch_options)
      puts "✅ Queued date range batch #{index + 1}/#{job_batches.length} (#{message_batch.length} messages)"
    end
    
    puts "\n📊 Date range batch processing initiated!"
    puts "Monitor progress with: rake front_message_parsing:status"
  end
  
  desc "Test batch parsing with a small sample"
  task test: :environment do
    sample_size = ENV['SAMPLE_SIZE']&.to_i || 5
    
    puts "\n🧪 TESTING BATCH PARSING"
    puts "-" * 30
    puts "Sample Size: #{sample_size} messages"
    
    # Get a small sample of unparsed messages
    sample_messages = FrontMessage.where(is_inbound: true, is_draft: false, message_type: 'email')
                                  .left_joins(:parsed_email)
                                  .where(parsed_emails: { id: nil })
                                  .limit(sample_size)
                                  .pluck(:id)
    
    if sample_messages.empty?
      puts "❌ No unparsed messages available for testing"
      exit 1
    end
    
    puts "Selected #{sample_messages.length} messages for test parsing"
    
    # Create a single test batch job
    batch_options = {
      message_ids: sample_messages,
      batch_size: 3,  # Small batch size for testing
      skip_parsed: true,
      force_reparse: false,
      options: { test_mode: true }
    }
    
    puts "Creating test batch job..."
    job = FrontMessageParsingJob.perform_later(batch_options)
    
    puts "✅ Test batch job queued successfully!"
    puts "Job ID: #{job.job_id}"
    puts "Monitor with: rake front_message_parsing:status"
    
    # If running in development, offer to run synchronously
    if Rails.env.development?
      print "\nRun test synchronously now? (y/N): "
      response = STDIN.gets.chomp.downcase
      
      if response == 'y' || response == 'yes'
        puts "\n🔄 Running test batch synchronously..."
        
        begin
          result = FrontMessageParsingJob.new.perform(batch_options)
          puts "\n✅ Test completed successfully!"
          puts "Result: #{result.to_json}"
        rescue => e
          puts "\n❌ Test failed: #{e.message}"
          puts "Check logs for details"
        end
      end
    end
  end
  
  desc "Clear parsing metrics cache"
  task clear_metrics_cache: :environment do
    puts "\n🧹 CLEARING PARSING METRICS CACHE"
    puts "-" * 30
    
    # Find all email parsing metric keys
    cache_keys = Rails.cache.instance_variable_get(:@data)&.keys&.select { |k| k.to_s.start_with?('email_parsing_metrics:') } || []
    
    if cache_keys.empty?
      puts "No parsing metrics found in cache."
      exit 0
    end
    
    puts "Found #{cache_keys.length} metric entries to clear"
    
    print "Proceed with clearing metrics cache? (y/N): "
    response = STDIN.gets.chomp.downcase
    
    unless response == 'y' || response == 'yes'
      puts "Operation cancelled."
      exit 0
    end
    
    cache_keys.each { |key| Rails.cache.delete(key) }
    
    puts "✅ Cleared #{cache_keys.length} metric entries from cache"
  end
  
  desc "Show detailed performance metrics"
  task performance_report: :environment do
    puts "\n📈 EMAIL PARSING PERFORMANCE REPORT"
    puts "="*50
    
    # Gather performance data from cache
    metric_keys = Rails.cache.instance_variable_get(:@data)&.keys&.select { |k| k.to_s.start_with?('email_parsing_metrics:batch:') } || []
    
    if metric_keys.empty?
      puts "No performance metrics available."
      puts "Run some batch parsing jobs first with: rake front_message_parsing:batch"
      exit 0
    end
    
    metrics = Rails.cache.read_multi(*metric_keys).values
    
    puts "\n📊 BATCH PERFORMANCE SUMMARY"
    puts "-" * 30
    puts "Total Batches: #{metrics.length}"
    puts "Date Range: #{metrics.map { |m| Time.parse(m[:timestamp]) }.minmax.map(&:strftime).join(' to ')}"
    
    # Calculate aggregated metrics
    total_processed = metrics.sum { |m| m[:processed] }
    total_successful = metrics.sum { |m| m[:successful] }
    total_failed = metrics.sum { |m| m[:failed] }
    total_duration = metrics.sum { |m| m[:duration_seconds] }
    
    puts "\n📈 AGGREGATE STATISTICS"
    puts "-" * 30
    puts "Total Messages Processed: #{total_processed}"
    puts "Total Successful: #{total_successful}"
    puts "Total Failed: #{total_failed}"
    puts "Overall Success Rate: #{total_processed > 0 ? ((total_successful.to_f / total_processed) * 100).round(2) : 0}%"
    puts "Total Processing Time: #{(total_duration / 60).round(2)} minutes"
    
    if metrics.length > 0
      avg_duration = total_duration / metrics.length
      avg_throughput = metrics.map { |m| m[:throughput_per_second] }.sum / metrics.length
      avg_batch_size = metrics.map { |m| m[:processed] }.sum / metrics.length
      
      puts "\n⚡ PERFORMANCE AVERAGES"
      puts "-" * 30
      puts "Average Batch Duration: #{avg_duration.round(2)}s"
      puts "Average Throughput: #{avg_throughput.round(2)} messages/sec"
      puts "Average Batch Size: #{avg_batch_size.round(1)} messages"
      puts "Average Parse Time: #{(metrics.map { |m| m[:avg_parse_time_seconds] }.sum / metrics.length).round(3)}s per message"
    end
    
    # Performance distribution
    durations = metrics.map { |m| m[:duration_seconds] }.sort
    throughputs = metrics.map { |m| m[:throughput_per_second] }.sort
    
    puts "\n📊 PERFORMANCE DISTRIBUTION"
    puts "-" * 30
    puts "Duration - Min: #{durations.first.round(2)}s, Max: #{durations.last.round(2)}s, Median: #{durations[durations.length/2].round(2)}s"
    puts "Throughput - Min: #{throughputs.first.round(2)}/s, Max: #{throughputs.last.round(2)}/s, Median: #{throughputs[throughputs.length/2].round(2)}/s"
    
    # Error analysis
    error_batches = metrics.select { |m| m[:error] }
    if error_batches.any?
      puts "\n🚨 ERROR ANALYSIS"
      puts "-" * 30
      puts "Batches with Errors: #{error_batches.length}/#{metrics.length}"
      
      error_types = error_batches.group_by { |m| m[:error].to_s.split(':').first }.transform_values(&:count)
      error_types.each { |type, count| puts "  #{type}: #{count}" }
    end
    
    puts "\n" + "="*50
  end
end

# Add help task
namespace :front_message_parsing do
  task :help do
    puts "\n📚 FRONT MESSAGE PARSING RAKE TASKS"
    puts "="*50
    puts ""
    puts "Available tasks:"
    puts ""
    puts "  status                 - Show parsing progress and statistics"
    puts "  batch                  - Process unparsed messages in batches"
    puts "  reparse                - Reprocess messages that had parsing errors"
    puts "  date_range             - Process messages from specific date range"
    puts "  test                   - Test batch parsing with small sample"
    puts "  performance_report     - Show detailed performance metrics"
    puts "  clear_metrics_cache    - Clear parsing metrics from cache"
    puts "  help                   - Show this help message"
    puts ""
    puts "Environment variables:"
    puts ""
    puts "  BATCH_SIZE=N           - Messages per batch (default: 10)"
    puts "  MAX_MESSAGES=N         - Maximum messages to process (default: 1000)"
    puts "  SKIP_PARSED=false      - Process already parsed messages"
    puts "  FORCE_REPARSE=true     - Force reparsing of all messages"
    puts "  DAYS_BACK=N            - Days to look back for errors (default: 7)"
    puts "  START_DATE=YYYY-MM-DD  - Start date for date range processing"
    puts "  END_DATE=YYYY-MM-DD    - End date for date range processing"
    puts "  SAMPLE_SIZE=N          - Number of messages for testing (default: 5)"
    puts ""
    puts "Examples:"
    puts "  rake front_message_parsing:batch BATCH_SIZE=20 MAX_MESSAGES=500"
    puts "  rake front_message_parsing:reparse DAYS_BACK=14"
    puts "  rake front_message_parsing:date_range START_DATE=2024-01-01 END_DATE=2024-01-31"
    puts "  rake front_message_parsing:test SAMPLE_SIZE=10"
    puts ""
    puts "="*50
  end
end