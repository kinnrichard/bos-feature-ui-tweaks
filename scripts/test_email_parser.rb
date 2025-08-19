#!/usr/bin/env ruby
# Test script for PyCall and Talon email parser integration
# Run with: ruby scripts/test_email_parser.rb

# Set up Rails environment
require_relative '../config/environment'

puts "Email Parser Integration Test"
puts "=" * 40

# Test 1: Check if PyCall is available
puts "\n1. Checking PyCall availability..."
begin
  require 'pycall'
  puts "   ✓ PyCall gem loaded"
rescue LoadError => e
  puts "   ✗ PyCall gem not available: #{e.message}"
  exit 1
end

# Test 2: Check Talon parser availability
puts "\n2. Checking Talon parser..."
if TalonParserHelper.available?
  puts "   ✓ Talon parser available"
else
  puts "   ✗ Talon parser not available"
  puts "   Please ensure requirements.txt is installed: pip install -r requirements.txt"
  exit 1
end

# Test 3: Health check
puts "\n3. Running health check..."
health = EmailReplyParserService.health_check
puts "   Status: #{health[:talon_status]}"
puts "   Available: #{health[:available]}"
puts "   Message: #{health[:message]}"

unless health[:available]
  puts "   ✗ Health check failed"
  exit 1
end

# Test 4: Parse sample email
puts "\n4. Testing email parsing..."
sample_email = <<~EMAIL
  Hi there!

  Thanks for reaching out. I'll look into this issue and get back to you.

  Best regards,
  John Smith
  Software Engineer
  john@company.com

  On Tue, Jan 15, 2024 at 2:30 PM, Customer Support <support@example.com> wrote:
  > Hello John,
  >#{' '}
  > We have received a support ticket from one of our users.
  > Can you please investigate the following issue?
  >#{' '}
  > Issue: Application crashes when uploading large files
  > User: jane.doe@client.com
  >#{' '}
  > Thank you!
EMAIL

# Extract reply
result = EmailReplyParserService.extract_reply(sample_email)
if result[:success]
  puts "   ✓ Reply extraction successful"
  puts "   Reply length: #{result[:data][:reply_text].length} characters"
else
  puts "   ✗ Reply extraction failed: #{result[:error]}"
  exit 1
end

# Test 5: Clean reply parsing
puts "\n5. Testing clean reply parsing..."
clean_result = EmailReplyParserService.parse_clean_reply(sample_email)
if clean_result[:success]
  puts "   ✓ Clean reply parsing successful"
  puts "   Clean reply: '#{clean_result[:data][:clean_reply]}'"
  puts "   Original length: #{clean_result[:data][:original_length]}"
  puts "   Clean length: #{clean_result[:data][:clean_length]}"
else
  puts "   ✗ Clean reply parsing failed: #{clean_result[:error]}"
  exit 1
end

puts "\n" + "=" * 40
puts "All tests passed! ✓"
puts "Email parser integration is working correctly."
puts "=" * 40
