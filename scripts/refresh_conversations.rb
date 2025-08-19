#!/usr/bin/env ruby
# Script to refresh Front conversations and messages from the past X hours
# Usage: ruby scripts/refresh_conversations.rb [HOURS]
# Example: ruby scripts/refresh_conversations.rb 24

require_relative '../config/environment'

# Parse command line arguments
hours = (ARGV[0] || 1).to_f
since = hours.hours.ago

puts "🔄 Front Conversation Refresh Script"
puts "=" * 50
puts "Refreshing conversations with activity since: #{since}"
puts "Time range: #{since.strftime('%Y-%m-%d %H:%M:%S')} to #{Time.current.strftime('%Y-%m-%d %H:%M:%S')}"
puts "=" * 50

# Initialize services
conversation_service = FrontSync::ConversationSyncService.new
message_service = FrontSync::MessageSyncService.new

# Track overall progress
total_start = Time.current
results = {
  conversations: { created: 0, updated: 0, failed: 0 },
  messages: { created: 0, updated: 0, failed: 0 }
}

begin
  # Step 1: Use Events API to find conversations with activity
  puts "\n📡 Detecting conversations with activity..."
  event_service = FrontSync::EventSyncService.new
  event_result = event_service.incremental_sync(
    since: since,
    max_events: 2000  # Increase limit for longer time periods
  )

  conversation_ids = event_result[:conversation_ids]

  if conversation_ids.empty?
    puts "✅ No conversations with activity found in the specified time range."
    exit 0
  end

  puts "📊 Found #{conversation_ids.size} conversations with activity:"
  puts "   - Active (had messages/comments): #{event_result[:active_count]}"
  puts "   - New (created in period): #{event_result[:new_count]}"
  puts "   - Detection took: #{event_result[:duration].round(2)} seconds"

  # Step 2: Sync conversations
  puts "\n🔄 Syncing conversations..."
  conv_start = Time.current

  # Process in batches to show progress
  conversation_ids.each_slice(50).with_index do |batch_ids, index|
    print "   Batch #{index + 1}: Processing #{batch_ids.size} conversations... "

    batch_stats = conversation_service.sync_conversation_ids(batch_ids)

    results[:conversations][:created] += batch_stats[:created]
    results[:conversations][:updated] += batch_stats[:updated]
    results[:conversations][:failed] += batch_stats[:failed]

    puts "✓"
  end

  conv_duration = Time.current - conv_start
  puts "✅ Conversation sync completed in #{conv_duration.round(2)} seconds"

  # Step 3: Sync messages for these conversations
  puts "\n📨 Syncing messages..."
  msg_start = Time.current

  # Process messages in batches
  conversation_ids.each_slice(25).with_index do |batch_ids, index|
    print "   Batch #{index + 1}: Fetching messages for #{batch_ids.size} conversations... "

    msg_stats = message_service.sync_for_conversations(batch_ids)

    results[:messages][:created] += msg_stats[:created]
    results[:messages][:updated] += msg_stats[:updated]
    results[:messages][:failed] += msg_stats[:failed]

    puts "✓"
  end

  msg_duration = Time.current - msg_start
  puts "✅ Message sync completed in #{msg_duration.round(2)} seconds"

  # Summary
  total_duration = Time.current - total_start

  puts "\n" + "=" * 50
  puts "📊 REFRESH SUMMARY"
  puts "=" * 50
  puts "Total time: #{total_duration.round(2)} seconds"
  puts "\nConversations:"
  puts "  - Created: #{results[:conversations][:created]}"
  puts "  - Updated: #{results[:conversations][:updated]}"
  puts "  - Failed: #{results[:conversations][:failed]}"
  puts "\nMessages:"
  puts "  - Created: #{results[:messages][:created]}"
  puts "  - Updated: #{results[:messages][:updated]}"
  puts "  - Failed: #{results[:messages][:failed]}"

  if results[:conversations][:failed] > 0 || results[:messages][:failed] > 0
    puts "\n⚠️  Some items failed to sync. Check logs for details."
  else
    puts "\n✅ All items synced successfully!"
  end

  # Data integrity notes
  puts "\n📝 Data Integrity:"
  puts "  - ✓ No duplicates: Using upsert with front_id uniqueness"
  puts "  - ✓ Update detection: Only updates if Front data is newer"
  puts "  - ✓ Relationship integrity: Tags, inboxes, and recipients preserved"

rescue => e
  puts "\n❌ ERROR: #{e.message}"
  puts e.backtrace.first(5)
  exit 1
end
