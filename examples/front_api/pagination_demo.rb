#!/usr/bin/env ruby
# Test script showing all pagination options with the monkeypatch

require 'bundler/setup'
require 'frontapp'
require_relative '../../config/initializers/frontapp_monkeypatch'

AUTH_TOKEN = ENV['FRONT_API_TOKEN'] || "your_token_here"

puts "Testing pagination options with frontapp monkeypatch"
puts "=" * 60

client = Frontapp::Client.new(auth_token: AUTH_TOKEN)
inbox_id = "inb_fkroe"

# Option 1: Quick limited fetch (DEFAULT BEHAVIOR NOW)
puts "\n1. QUICK LIMITED FETCH (max_results)"
puts "-" * 40
start_time = Time.now
conversations = client.get_inbox_conversations(inbox_id, max_results: 5)
elapsed = Time.now - start_time
puts "✓ Got #{conversations.length} conversations in #{elapsed.round(2)} seconds"
conversations.each_with_index do |conv, i|
  puts "  #{i+1}. #{conv['subject'] || '(no subject)'}"
end

# Option 2: Manual pagination - page by page
puts "\n2. MANUAL PAGINATION (page by page)"
puts "-" * 40
puts "Getting first page..."
page1 = client.get_inbox_conversations_page(inbox_id, limit: 3)
puts "✓ Page 1: Got #{page1[:results].length} conversations"
page1[:results].each_with_index do |conv, i|
  puts "  #{i+1}. #{conv['subject'] || '(no subject)'}"
end
puts "  Has more pages: #{page1[:has_more]}"

if page1[:has_more]
  puts "\nGetting second page..."
  page2 = client.get_inbox_conversations_page(inbox_id, limit: 3, page_token: page1[:next_token])
  puts "✓ Page 2: Got #{page2[:results].length} conversations"
  page2[:results].each_with_index do |conv, i|
    puts "  #{i+1}. #{conv['subject'] || '(no subject)'}"
  end
  puts "  Has more pages: #{page2[:has_more]}"
end

# Option 3: Iterate through pages with a block
puts "\n3. ITERATE THROUGH PAGES WITH BLOCK"
puts "-" * 40
page_num = 0
total_count = 0
client.each_conversation_page(inbox_id, limit: 4) do |conversations|
  page_num += 1
  total_count += conversations.length
  puts "Page #{page_num}: #{conversations.length} conversations"

  # Stop after 3 pages for demo
  break if page_num >= 3
end
puts "✓ Processed #{page_num} pages, #{total_count} total conversations"

# Option 4: Get ALL conversations (original behavior - BE CAREFUL!)
puts "\n4. FETCH ALL (original behavior - use with caution!)"
puts "-" * 40
puts "This would fetch ALL conversations across ALL pages."
puts "Example: client.get_inbox_conversations(inbox_id, fetch_all: true)"
puts "⚠️  Not running this in demo to avoid long wait times"

# Option 5: Using limit as max_results (compatibility mode)
puts "\n5. COMPATIBILITY MODE (limit acts as max_results)"
puts "-" * 40
conversations = client.get_inbox_conversations(inbox_id, limit: 2)
puts "✓ Using limit: 2 returns #{conversations.length} conversations"

puts "\n" + "=" * 60
puts "SUMMARY OF PAGINATION OPTIONS:"
puts "=" * 60
puts <<-SUMMARY

1. QUICK LIMITED FETCH (Recommended for most cases):
   client.get_inbox_conversations(inbox_id, max_results: 10)
#{'   '}
2. MANUAL PAGINATION (For custom UI with pagination):
   page = client.get_inbox_conversations_page(inbox_id, limit: 25)
   next_page = client.get_inbox_conversations_page(inbox_id,#{' '}
                 limit: 25, page_token: page[:next_token])
#{'   '}
3. ITERATE WITH BLOCK (For processing in batches):
   client.each_conversation_page(inbox_id, limit: 50) do |convs|
     # Process batch
     break if some_condition
   end
#{'   '}
4. FETCH ALL (Use carefully with large datasets):
   client.get_inbox_conversations(inbox_id, fetch_all: true)
#{'   '}
5. COMPATIBILITY (limit acts as max_results):
   client.get_inbox_conversations(inbox_id, limit: 5)

SUMMARY
