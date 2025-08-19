#!/usr/bin/env ruby
# Download all Front conversations from the past month

require 'bundler/setup'
require 'frontapp'
require 'json'
require 'time'

# Load the monkeypatch for pagination control
begin
  require_relative '../../config/initializers/frontapp_monkeypatch'
rescue LoadError
  puts "Warning: Monkeypatch not found. Using standard frontapp gem behavior."
end

AUTH_TOKEN = ENV['FRONT_API_TOKEN'] || "your_token_here"

if AUTH_TOKEN == "your_token_here"
  puts "ERROR: Please set your FRONT_API_TOKEN environment variable"
  puts "Example: FRONT_API_TOKEN=your_actual_token ruby #{__FILE__}"
  exit 1
end

puts "Front API Conversation Downloader - Past 48 Hours"
puts "=" * 60

client = Frontapp::Client.new(auth_token: AUTH_TOKEN)

# Configuration
BATCH_SIZE = 50  # Number of conversations per page
SAVE_MESSAGES = true  # Whether to fetch and save message content
MAX_MESSAGES_PER_CONVERSATION = 20  # Limit messages per conversation

# Calculate date range (past 48 hours for testing)
end_date = Time.now
start_date = end_date - (48 * 60 * 60)  # 48 hours ago

puts "Date range: #{start_date.strftime('%Y-%m-%d %H:%M')} to #{end_date.strftime('%Y-%m-%d %H:%M')}"
puts "-" * 60

def save_to_json(data, filename)
  # Using JSON.fast_generate for better performance with large datasets
  File.write(filename, JSON.pretty_generate(data))
  puts "✓ Saved to #{filename} (#{File.size(filename) / 1024}KB)"
end

def save_to_json_streaming(conversations, filename)
  # For very large datasets, stream to file to avoid memory issues
  File.open(filename, 'w') do |f|
    f.write "[\n"
    conversations.each_with_index do |conv, idx|
      f.write JSON.pretty_generate(conv)
      f.write(",\n") unless idx == conversations.length - 1
    end
    f.write "\n]"
  end
  puts "✓ Streamed to #{filename} (#{File.size(filename) / 1024}KB)"
end

def filter_by_date_range(conversations, start_date, end_date)
  conversations.select do |conv|
    # Front API uses 'created_at' field (epoch timestamp in seconds)
    timestamp = conv['created_at']
    next false unless timestamp

    # Convert timestamp to Time object
    created_at = Time.at(timestamp) rescue nil
    next false unless created_at

    created_at >= start_date && created_at <= end_date
  end
end

# Method 1: Download recent conversations with smart pagination (optimized)
def download_recent_with_pagination(client, start_date, end_date, batch_size = 50)
  puts "\nMethod 1: Downloading recent conversations (optimized pagination)..."
  puts "-" * 40

  all_conversations = []
  page_token = nil
  page_num = 0
  found_older = false
  consecutive_empty_pages = 0

  begin
    puts "Looking for conversations created after #{start_date.strftime('%Y-%m-%d %H:%M')}..."

    loop do
      page_num += 1
      print "Downloading page #{page_num}... "

      # Get a page of conversations
      if client.respond_to?(:conversations_page)
        params = { 'limit' => batch_size.to_s }
        params['page_token'] = page_token if page_token

        page_data = client.conversations_page(params)
        conversations = page_data[:results]
        has_more = page_data[:has_more]
        page_token = page_data[:next_token]
      else
        # Fallback to standard method
        params = { limit: batch_size }
        conversations = client.conversations(params)
        has_more = false
      end

      # Filter conversations by date range
      filtered = filter_by_date_range(conversations, start_date, end_date)
      all_conversations.concat(filtered)

      # Check if we've hit older conversations
      if conversations.any?
        # Get the oldest conversation in this page
        oldest_timestamp = conversations.map { |c| c['created_at'] }.compact.min
        if oldest_timestamp
          oldest_date = Time.at(oldest_timestamp)
          if oldest_date < start_date
            found_older = true
            puts "#{conversations.length} convs, #{filtered.length} in range (reached #{oldest_date.strftime('%Y-%m-%d')})"
          else
            puts "#{conversations.length} convs, #{filtered.length} in range (total: #{all_conversations.length})"
          end
        else
          puts "#{conversations.length} convs, #{filtered.length} in range (total: #{all_conversations.length})"
        end
      else
        puts "0 convs"
      end

      # Track consecutive pages with no matches
      if filtered.empty?
        consecutive_empty_pages += 1
      else
        consecutive_empty_pages = 0
      end

      # Stop conditions:
      # 1. No more pages
      # 2. Found conversations older than our range AND current page has no matches
      # 3. Too many consecutive empty pages (conversations are too old)
      break unless has_more
      break if found_older && filtered.empty?
      break if consecutive_empty_pages >= 3
    end

    puts "✓ Found #{all_conversations.length} conversations in date range"
    all_conversations
  rescue => e
    puts "✗ Error: #{e.message}"
    all_conversations
  end
end

# Method 2: Download all conversations and filter by date
def download_and_filter(client, start_date, end_date, batch_size = 50)
  puts "\nMethod 2: Downloading all conversations and filtering by date..."
  puts "-" * 40

  all_conversations = []
  filtered_conversations = []
  page_token = nil
  page_num = 0
  found_older = false

  begin
    loop do
      page_num += 1
      print "Downloading page #{page_num}... "

      # Get a page of conversations
      if client.respond_to?(:conversations_page)
        page_data = client.conversations_page(limit: batch_size, page_token: page_token)
        conversations = page_data[:results]
        has_more = page_data[:has_more]
        page_token = page_data[:next_token]
      else
        # Fallback to standard method
        conversations = client.conversations(limit: batch_size)
        has_more = false
      end

      # Filter conversations by date
      page_filtered = []
      conversations.each do |conv|
        created_at = Time.parse(conv['created_at']) rescue nil
        next unless created_at

        if created_at >= start_date && created_at <= end_date
          page_filtered << conv
        elsif created_at < start_date
          found_older = true
        end
      end

      filtered_conversations.concat(page_filtered)
      all_conversations.concat(conversations)

      puts "#{conversations.length} convs, #{page_filtered.length} in range (total: #{filtered_conversations.length})"

      # Stop if we've gone past our date range (conversations are usually ordered by date)
      break if found_older && page_filtered.empty?
      break unless has_more
    end

    puts "✓ Found #{filtered_conversations.length} conversations in date range"
    puts "  (Scanned #{all_conversations.length} total conversations)"

    filtered_conversations
  rescue => e
    puts "\n✗ Error downloading conversations: #{e.message}"
    filtered_conversations
  end
end

# Method 3: Download by inbox with date filtering
def download_by_inbox(client, start_date, end_date, batch_size = 50)
  puts "\nMethod 3: Downloading conversations by inbox..."
  puts "-" * 40

  all_conversations = []
  inbox_results = {}

  begin
    # First, get all inboxes
    puts "Fetching inbox list..."
    inboxes = client.inboxes
    puts "Found #{inboxes.length} inboxes"

    # Download conversations from each inbox
    inboxes.each_with_index do |inbox, idx|
      inbox_id = inbox['id']
      inbox_name = inbox['name']

      print "#{idx + 1}/#{inboxes.length}: #{inbox_name}... "

      inbox_conversations = []
      page_token = nil

      loop do
        if client.respond_to?(:get_inbox_conversations_page)
          page_data = client.get_inbox_conversations_page(inbox_id, limit: batch_size, page_token: page_token)
          conversations = page_data[:results]
          has_more = page_data[:has_more]
          page_token = page_data[:next_token]
        else
          conversations = client.get_inbox_conversations(inbox_id, limit: batch_size)
          has_more = false
        end

        # Filter by date
        filtered = filter_by_date_range(conversations, start_date, end_date)
        inbox_conversations.concat(filtered)

        # Check if we should continue (if conversations are sorted by date)
        if conversations.any?
          oldest = Time.parse(conversations.last['created_at']) rescue Time.now
          break if oldest < start_date
        end

        break unless has_more
      end

      all_conversations.concat(inbox_conversations)
      inbox_results[inbox_name] = inbox_conversations.length
      puts "#{inbox_conversations.length} conversations"
    end

    puts "\n✓ Found #{all_conversations.length} total conversations in date range"
    puts "\nBreakdown by inbox:"
    inbox_results.sort_by { |_, count| -count }.each do |name, count|
      puts "  #{name}: #{count}" if count > 0
    end

    all_conversations
  rescue => e
    puts "\n✗ Error: #{e.message}"
    all_conversations
  end
end

# Method to enrich conversations with messages
def enrich_with_messages(client, conversations, max_messages = MAX_MESSAGES_PER_CONVERSATION)
  puts "\nEnriching conversations with message content..."
  puts "-" * 40

  enriched = []
  errors = 0

  conversations.each_with_index do |conv, idx|
    print "\rProcessing conversation #{idx + 1}/#{conversations.length} (#{errors} errors)..."

    enriched_conv = conv.dup

    # Fetch messages for this conversation
    begin
      messages = client.get_conversation_messages(conv['id'])
      # Limit number of messages to save
      enriched_conv['messages'] = messages.first(max_messages)
      enriched_conv['message_count'] = messages.length
    rescue => e
      enriched_conv['messages'] = []
      enriched_conv['message_fetch_error'] = e.message
      errors += 1
    end

    enriched << enriched_conv
  end

  puts "\n✓ Enriched #{enriched.length} conversations (#{errors} errors)"
  enriched
end

# Main execution
puts "\nChoose download method:"
puts "1. Smart pagination (stops when reaching old conversations)"
puts "2. Download all and filter (processes everything)"
puts "3. Download by inbox (organized by inbox)"
print "Enter choice (1-3): "

choice = gets&.chomp || "1"

conversations = case choice
when "1"
  download_recent_with_pagination(client, start_date, end_date, BATCH_SIZE)
when "2"
  download_and_filter(client, start_date, end_date, BATCH_SIZE)
when "3"
  download_by_inbox(client, start_date, end_date, BATCH_SIZE)
else
  puts "Invalid choice, using method 1"
  download_recent_with_pagination(client, start_date, end_date, BATCH_SIZE)
end

# Optionally enrich with message content
if SAVE_MESSAGES && conversations && !conversations.empty?
  print "\nFetch full message content for each conversation? (y/n): "
  if (gets&.chomp || "n").downcase == "y"
    conversations = enrich_with_messages(client, conversations)
  end
end

# Save the results
if conversations && !conversations.empty?
  puts "\nSaving conversations..."
  puts "-" * 40

  timestamp = Time.now.strftime("%Y%m%d_%H%M%S")
  date_range = "#{start_date.strftime('%Y%m%d')}-#{end_date.strftime('%Y%m%d')}"
  filename = "front_conversations_#{date_range}_#{timestamp}.json"

  # Prepare final data structure with metadata
  output_data = {
    'metadata' => {
      'export_date' => Time.now.iso8601,
      'date_range' => {
        'start' => start_date.iso8601,
        'end' => end_date.iso8601
      },
      'total_conversations' => conversations.length,
      'includes_messages' => SAVE_MESSAGES
    },
    'conversations' => conversations
  }

  # Save based on size
  if conversations.length > 1000
    puts "Large dataset detected, using streaming save..."
    save_to_json_streaming(conversations, filename)
  else
    save_to_json(output_data, filename)
  end

  # Print summary statistics
  puts "\nSummary Statistics:"
  puts "-" * 40

  # Group by status
  by_status = conversations.group_by { |c| c['status'] }
  puts "\nBy Status:"
  by_status.each do |status, convs|
    puts "  #{status}: #{convs.length}"
  end

  # Group by assignee
  by_assignee = conversations.group_by { |c| c['assignee'] ? c['assignee']['name'] : 'Unassigned' }
  puts "\nTop 5 Assignees:"
  by_assignee.sort_by { |_, convs| -convs.length }.first(5).each do |assignee, convs|
    puts "  #{assignee}: #{convs.length}"
  end

  # Group by date
  by_date = conversations.group_by { |c| Time.parse(c['created_at']).strftime('%Y-%m-%d') rescue 'Unknown' }
  puts "\nTop 5 Days by Volume:"
  by_date.sort_by { |_, convs| -convs.length }.first(5).each do |date, convs|
    puts "  #{date}: #{convs.length}"
  end

  # Calculate response times if messages are included
  if SAVE_MESSAGES && conversations.any? { |c| c['messages'] && c['messages'].length > 1 }
    response_times = []
    conversations.each do |conv|
      next unless conv['messages'] && conv['messages'].length > 1

      first_msg = conv['messages'].last  # Messages are usually in reverse chronological order
      second_msg = conv['messages'][-2]

      if first_msg && second_msg
        time1 = Time.parse(first_msg['created_at']) rescue nil
        time2 = Time.parse(second_msg['created_at']) rescue nil

        if time1 && time2
          response_time = (time2 - time1).abs
          response_times << response_time if response_time < 86400 * 7  # Exclude outliers > 7 days
        end
      end
    end

    if response_times.any?
      avg_response = response_times.sum / response_times.length / 3600.0
      puts "\nResponse Time Analysis:"
      puts "  Average: #{avg_response.round(2)} hours"
      puts "  Median: #{response_times.sort[response_times.length / 2] / 3600.0} hours"
    end
  end

  # Sample conversations
  puts "\nSample conversations:"
  puts "-" * 40
  conversations.first(3).each_with_index do |conv, i|
    puts "\n#{i + 1}. #{conv['subject'] || '(no subject)'}"
    puts "   ID: #{conv['id']}"
    puts "   Status: #{conv['status']}"
    puts "   Created: #{conv['created_at']}"
    if conv['assignee']
      puts "   Assignee: #{conv['assignee']['name']}"
    end
    if conv['messages'] && conv['messages'].any?
      puts "   Messages: #{conv['messages'].length} fetched"
      puts "   First message: #{conv['messages'].last['body']&.slice(0, 100)}..."
    end
  end
else
  puts "\nNo conversations found in the specified date range."
end

puts "\n" + "=" * 60
puts "Download complete!"
puts "Date range: #{start_date.strftime('%Y-%m-%d')} to #{end_date.strftime('%Y-%m-%d')}"
puts "Total conversations: #{conversations&.length || 0}"
