#!/usr/bin/env ruby
# Test script for frontapp monkeypatch

require 'bundler/setup'
require 'frontapp'
require_relative '../../config/initializers/frontapp_monkeypatch'

AUTH_TOKEN = ENV['FRONT_API_TOKEN'] || "your_token_here"

puts "Testing frontapp gem with monkeypatch..."
puts "=" * 50

client = Frontapp::Client.new(auth_token: AUTH_TOKEN)
inbox_id = "inb_fkroe"

# Test 1: Get just 1 conversation (should be fast!)
puts "\nTest 1: Getting 1 conversation with max_results..."
start_time = Time.now
begin
  conversations = client.get_inbox_conversations(inbox_id, max_results: 1)
  elapsed = Time.now - start_time
  puts "✓ Got #{conversations.length} conversation(s) in #{elapsed.round(2)} seconds"

  if conversations.any?
    conv = conversations.first
    puts "  - ID: #{conv['id']}"
    puts "  - Subject: #{conv['subject']}"
  end
rescue => e
  puts "✗ Error: #{e.message}"
  puts e.backtrace.first(3).join("\n")
end

# Test 2: Get 5 conversations
puts "\nTest 2: Getting 5 conversations with max_results..."
start_time = Time.now
begin
  conversations = client.get_inbox_conversations(inbox_id, max_results: 5)
  elapsed = Time.now - start_time
  puts "✓ Got #{conversations.length} conversation(s) in #{elapsed.round(2)} seconds"
rescue => e
  puts "✗ Error: #{e.message}"
end

# Test 3: Using limit as max_results (compatibility)
puts "\nTest 3: Using limit parameter (should act as max_results)..."
start_time = Time.now
begin
  conversations = client.get_inbox_conversations(inbox_id, limit: 3)
  elapsed = Time.now - start_time
  puts "✓ Got #{conversations.length} conversation(s) in #{elapsed.round(2)} seconds"
rescue => e
  puts "✗ Error: #{e.message}"
end

# Test 4: Test the general conversations method
puts "\nTest 4: Testing general conversations method..."
start_time = Time.now
begin
  conversations = client.conversations(max_results: 2)
  elapsed = Time.now - start_time
  puts "✓ Got #{conversations.length} conversation(s) in #{elapsed.round(2)} seconds"
rescue => e
  puts "✗ Error: #{e.message}"
end

puts "\n" + "=" * 50
puts "Monkeypatch test complete!"
puts "\nNote: If these complete quickly (< 2 seconds each), the patch is working."
puts "Without the patch, even limit: 1 would hang while fetching all pages."
