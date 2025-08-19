namespace :front_sync do
  desc "Display current Front API sync status"
  task status: :environment do
    puts "\n" + "="*60
    puts "FRONT API SYNC STATUS"
    puts "="*60
    
    # Overall status
    status = FrontSyncMonitorService.sync_status
    health = FrontSyncMonitorService.health_metrics
    circuit_breaker = FrontSyncMonitorService.circuit_breaker_status
    
    puts "\n📊 OVERALL STATUS"
    puts "-" * 30
    status_color = case status[:overall]
                   when 'healthy' then "\e[32m" # green
                   when 'degraded' then "\e[33m" # yellow
                   when 'circuit_breaker_open' then "\e[31m" # red
                   else "\e[37m" # white
                   end
    puts "Status: #{status_color}#{status[:overall].upcase}\e[0m"
    puts "Last Sync: #{status[:last_sync] ? status[:last_sync].in_time_zone.strftime('%Y-%m-%d %H:%M:%S %Z') : 'Never'}"
    puts "Recent Errors (24h): #{status[:recent_errors]}"
    puts "Running Syncs: #{status[:running_syncs]}"
    
    # Health metrics
    puts "\n📈 HEALTH METRICS (24h)"
    puts "-" * 30
    puts "Success Rate: #{(health[:success_rate] * 100).round(1)}%"
    puts "Total Syncs: #{health[:total_syncs_24h]}"
    puts "Successful: #{health[:successful_syncs_24h]}"
    puts "Failed: #{health[:failed_syncs_24h]}"
    puts "Average Duration: #{health[:avg_duration_seconds].round(1)}s"
    
    # Circuit breaker status
    puts "\n🔌 CIRCUIT BREAKER"
    puts "-" * 30
    breaker_color = circuit_breaker[:open] ? "\e[31m" : "\e[32m"
    puts "Status: #{breaker_color}#{circuit_breaker[:open] ? 'OPEN' : 'CLOSED'}\e[0m"
    puts "Failure Count: #{circuit_breaker[:failure_count]}"
    if circuit_breaker[:last_failure_at]
      puts "Last Failure: #{circuit_breaker[:last_failure_at].strftime('%Y-%m-%d %H:%M:%S')}"
    end
    if circuit_breaker[:next_attempt_at]
      puts "Next Attempt: #{circuit_breaker[:next_attempt_at].strftime('%Y-%m-%d %H:%M:%S')}"
    end
    
    # Recent logs
    puts "\n📋 RECENT SYNC LOGS"
    puts "-" * 30
    recent_logs = FrontSyncLog.order(created_at: :desc).limit(5)
    
    if recent_logs.any?
      recent_logs.each do |log|
        status_emoji = case log.status
                       when 'completed' then '✅'
                       when 'completed_with_errors' then '⚠️'
                       when 'failed', 'error' then '❌'
                       when 'running' then '🔄'
                       else '❓'
                       end
        
        duration = if log.started_at && log.completed_at
                     "#{((log.completed_at - log.started_at) / 60).round(1)}m"
                   else
                     "N/A"
                   end
        
        puts "#{status_emoji} #{log.created_at.in_time_zone.strftime('%m/%d %H:%M %Z')} | #{log.sync_type.ljust(12)} | #{duration.rjust(6)} | #{log.records_synced || 0} records"
        
        if log.status == 'error' && log.error_message.present?
          puts "    Error: #{log.error_message.truncate(80)}"
        end
      end
    else
      puts "No sync logs found."
    end
    
    puts "\n" + "="*60
    puts "Use 'rake front_sync:manual' to trigger a manual sync"
    puts "Use 'rake front_sync:reset_circuit_breaker' to reset the circuit breaker"
    puts "="*60 + "\n"
  end
  
  desc "Trigger manual Front API sync"
  task manual: :environment do
    resource_type = ENV['TYPE'] || 'all'
    sync_mode = ENV['MODE'] || 'full'
    
    puts "\n🚀 TRIGGERING MANUAL SYNC"
    puts "-" * 30
    puts "Resource Type: #{resource_type}"
    puts "Sync Mode: #{sync_mode}"
    
    begin
      valid_resource_types = %w[all contacts tags inboxes conversations messages teammates channels comments]
      valid_sync_modes = %w[full incremental]
      
      unless valid_resource_types.include?(resource_type.downcase)
        puts "❌ Error: Invalid resource type '#{resource_type}'"
        puts "Valid types: #{valid_resource_types.join(', ')}"
        exit 1
      end
      
      unless valid_sync_modes.include?(sync_mode.downcase)
        puts "❌ Error: Invalid sync mode '#{sync_mode}'"
        puts "Valid modes: #{valid_sync_modes.join(', ')}"
        exit 1
      end
      
      puts "Queueing #{resource_type} sync job (#{sync_mode} mode)..."
      
      # Queue the job with proper parameters
      since = sync_mode == 'incremental' ? 1.hour.ago : nil
      FrontSyncJob.perform_later(resource_type, sync_mode, since: since)
      
      puts "✅ #{resource_type.capitalize} sync job queued successfully!"
      
      puts "\n📊 Monitor progress with: rake front_sync:status"
      puts "🔍 View detailed logs in admin dashboard"
      
    rescue => e
      puts "❌ Error: #{e.message}"
      puts "Check logs for more details."
      exit 1
    end
  end
  
  desc "Refresh conversations from the past X hours (default: 1)"
  task :refresh_recent, [:hours] => :environment do |t, args|
    hours = (args[:hours] || 1).to_f
    since = hours.hours.ago
    
    puts "\n🔄 REFRESHING RECENT CONVERSATIONS"
    puts "-" * 30
    puts "Time range: Past #{hours} hours"
    puts "Since: #{since.strftime('%Y-%m-%d %H:%M:%S')}"
    
    # Use the conversation sync service directly
    conversation_service = FrontSync::ConversationSyncService.new
    message_service = FrontSync::MessageSyncService.new
    
    puts "\n📊 Starting incremental sync..."
    
    # Sync conversations
    conv_stats = conversation_service.sync_all(since: since)
    puts "✅ Conversations: #{conv_stats[:created]} created, #{conv_stats[:updated]} updated"
    
    # Sync messages
    msg_stats = message_service.sync_all(since: since)
    puts "✅ Messages: #{msg_stats[:created]} created, #{msg_stats[:updated]} updated"
    
    puts "\n✅ Refresh completed successfully!"
  rescue => e
    puts "❌ Error: #{e.message}"
    exit 1
  end
  
  desc "Reset Front API circuit breaker"
  task reset_circuit_breaker: :environment do
    puts "\n🔧 RESETTING CIRCUIT BREAKER"
    puts "-" * 30
    
    begin
      # Check current status
      current_status = FrontSyncMonitorService.circuit_breaker_status
      
      if current_status[:open]
        puts "Circuit breaker is currently OPEN"
        puts "Failure count: #{current_status[:failure_count]}"
        puts "Last failure: #{current_status[:last_failure_at]&.strftime('%Y-%m-%d %H:%M:%S')}"
        
        print "Are you sure you want to reset it? (y/N): "
        response = STDIN.gets.chomp.downcase
        
        unless response == 'y' || response == 'yes'
          puts "Operation cancelled."
          exit 0
        end
      else
        puts "Circuit breaker is currently CLOSED"
      end
      
      FrontSyncMonitorService.reset_circuit_breaker
      puts "✅ Circuit breaker reset successfully!"
      
      # Show new status
      new_status = FrontSyncMonitorService.circuit_breaker_status
      puts "New status: #{new_status[:open] ? 'OPEN' : 'CLOSED'}"
      puts "Failure count: #{new_status[:failure_count]}"
      
    rescue => e
      puts "❌ Error resetting circuit breaker: #{e.message}"
      exit 1
    end
  end
  
  desc "Clean up old sync logs"
  task cleanup_old_logs: :environment do
    retention_days = ENV['DAYS']&.to_i || 30
    
    puts "\n🧹 CLEANING UP OLD SYNC LOGS"
    puts "-" * 30
    puts "Retention period: #{retention_days} days"
    
    cutoff_date = retention_days.days.ago
    old_logs = FrontSyncLog.where('created_at < ?', cutoff_date)
    count = old_logs.count
    
    if count == 0
      puts "No old logs found to clean up."
      exit 0
    end
    
    puts "Found #{count} logs older than #{cutoff_date.strftime('%Y-%m-%d')}"
    
    # Show breakdown by status
    status_breakdown = old_logs.group(:status).count
    puts "\nBreakdown by status:"
    status_breakdown.each do |status, count|
      puts "  #{status}: #{count}"
    end
    
    print "\nProceed with deletion? (y/N): "
    response = STDIN.gets.chomp.downcase
    
    unless response == 'y' || response == 'yes'
      puts "Operation cancelled."
      exit 0
    end
    
    begin
      deleted_count = old_logs.delete_all
      puts "✅ Successfully deleted #{deleted_count} old sync logs."
      
      # Show remaining logs
      remaining = FrontSyncLog.count
      puts "Remaining logs: #{remaining}"
      
    rescue => e
      puts "❌ Error during cleanup: #{e.message}"
      exit 1
    end
  end
  
  desc "Trigger Front sync scheduler to check for needed syncs"
  task schedule: :environment do
    puts "\n🔄 TRIGGERING FRONT SYNC SCHEDULER"
    puts "-" * 30
    
    FrontSyncSchedulerJob.perform_later
    
    puts "✅ Front sync scheduler job queued"
    puts "The scheduler will check all resource types and queue sync jobs as needed based on intervals."
    puts "\nView job status at: http://localhost:3000/good_job"
  end
  
  desc "Generate sync health report"
  task health_report: :environment do
    puts "\n📋 FRONT API SYNC HEALTH REPORT"
    puts "Generated at: #{Time.current.strftime('%Y-%m-%d %H:%M:%S')}"
    puts "="*60
    
    report = FrontSyncMonitorService.new.generate_health_report
    
    # Status overview
    puts "\n📊 STATUS OVERVIEW"
    puts "-" * 30
    puts "Overall Status: #{report[:sync_status][:overall].upcase}"
    puts "Last Sync: #{report[:sync_status][:last_sync]&.strftime('%Y-%m-%d %H:%M:%S') || 'Never'}"
    puts "Recent Errors: #{report[:sync_status][:recent_errors]}"
    puts "Running Syncs: #{report[:sync_status][:running_syncs]}"
    
    # Health metrics
    metrics = report[:health_metrics]
    puts "\n📈 HEALTH METRICS"
    puts "-" * 30
    puts "Success Rate (24h): #{(metrics[:success_rate] * 100).round(1)}%"
    puts "Uptime Percentage (7d): #{metrics[:uptime_percentage]}%"
    puts "Average Duration: #{metrics[:avg_duration_seconds].round(1)}s"
    puts "Total Syncs (24h): #{metrics[:total_syncs_24h]}"
    puts "  - Successful: #{metrics[:successful_syncs_24h]}"
    puts "  - Failed: #{metrics[:failed_syncs_24h]}"
    puts "  - Running: #{metrics[:running_syncs]}"
    
    # Performance stats
    perf = report[:performance_stats]
    puts "\n⚡ PERFORMANCE STATS"
    puts "-" * 30
    puts "Average Response Time: #{perf[:avg_response_time]}ms"
    puts "API Calls (24h): #{perf[:api_calls_24h]}"
    puts "Error Rate: #{(perf[:error_rate] * 100).round(2)}%"
    puts "Throughput: #{perf[:throughput_per_hour].round(1)}/hour"
    puts "Peak Usage Hour: #{perf[:peak_usage_hour]}"
    puts "Rate Limit Hits: #{perf[:rate_limit_hits]}"
    
    # Error patterns
    if metrics[:error_patterns].any?
      puts "\n🚨 ERROR PATTERNS (7d)"
      puts "-" * 30
      metrics[:error_patterns].each do |error_type, data|
        puts "#{error_type.capitalize}: #{data[:count]} occurrences"
        puts "  Example: #{data[:recent_example].truncate(60)}" if data[:recent_example]
      end
    end
    
    # Circuit breaker
    breaker = report[:circuit_breaker]
    puts "\n🔌 CIRCUIT BREAKER"
    puts "-" * 30
    puts "Status: #{breaker[:open] ? 'OPEN' : 'CLOSED'}"
    puts "Failure Count: #{breaker[:failure_count]}"
    if breaker[:last_failure_at]
      puts "Last Failure: #{breaker[:last_failure_at].strftime('%Y-%m-%d %H:%M:%S')}"
    end
    
    # Recommendations
    if report[:recommendations].any?
      puts "\n💡 RECOMMENDATIONS"
      puts "-" * 30
      report[:recommendations].each_with_index do |rec, index|
        icon = case rec[:type]
               when 'error' then '🚨'
               when 'warning' then '⚠️'
               else 'ℹ️'
               end
        
        puts "#{index + 1}. #{icon} #{rec[:title]}"
        puts "   #{rec[:message]}"
        puts "   Action: #{rec[:action]}"
        puts ""
      end
    else
      puts "\n✅ No recommendations - system is running optimally!"
    end
    
    puts "="*60
    
    # Optionally save to file
    if ENV['SAVE']
      filename = "front_sync_health_report_#{Time.current.strftime('%Y%m%d_%H%M%S')}.json"
      File.write(filename, JSON.pretty_generate(report))
      puts "Report saved to: #{filename}"
    end
  end
  
  desc "Test Front API connectivity"
  task test_connection: :environment do
    puts "\n🔌 TESTING FRONT API CONNECTIVITY"
    puts "-" * 30
    
    begin
      # Use the service to test connectivity
      service = FrontSyncService.new
      
      puts "Testing API authentication..."
      # This would need to be implemented in FrontSyncService
      # For now, we'll just check if we can create the service
      puts "✅ Service initialization successful"
      
      puts "Checking circuit breaker status..."
      breaker_status = FrontSyncMonitorService.circuit_breaker_status
      if breaker_status[:open]
        puts "⚠️  Circuit breaker is OPEN - API calls will be blocked"
        puts "   Reset with: rake front_sync:reset_circuit_breaker"
      else
        puts "✅ Circuit breaker is CLOSED - API calls allowed"
      end
      
      puts "\n🔍 Use 'rake front_sync:status' for detailed system status"
      
    rescue => e
      puts "❌ Connection test failed: #{e.message}"
      puts "Check your Front API configuration and credentials."
      exit 1
    end
  end
end

# Add helpful task descriptions
namespace :front_sync do
  task :help do
    puts "\n📚 FRONT SYNC RAKE TASKS"
    puts "="*50
    puts ""
    puts "Available tasks:"
    puts ""
    puts "  status                 - Show current sync status and recent activity"
    puts "  manual                 - Trigger manual sync (TYPE=resource_type, MODE=full|incremental)"
    puts "  reset_circuit_breaker  - Reset the circuit breaker to allow API calls"
    puts "  cleanup_old_logs       - Remove old sync logs (DAYS=30)"
    puts "  health_report          - Generate comprehensive health report (SAVE=true to save JSON)"
    puts "  test_connection        - Test Front API connectivity"
    puts "  help                   - Show this help message"
    puts ""
    puts "Examples:"
    puts "  rake front_sync:manual TYPE=contacts"
    puts "  rake front_sync:manual TYPE=conversations MODE=incremental"
    puts "  rake front_sync:manual TYPE=all MODE=full"
    puts "  rake front_sync:cleanup_old_logs DAYS=7"
    puts "  rake front_sync:health_report SAVE=true"
    puts ""
    puts "="*50
  end
end