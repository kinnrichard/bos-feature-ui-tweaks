# Email Parser API Reference

This document provides comprehensive API reference and usage examples for the email reply parser system implemented with PyCall and Talon library integration.

## Table of Contents

- [Overview](#overview)
- [TalonEmailParser Service](#talonemailparser-service)
- [ParsedEmail Model](#parsedemail-model)
- [FrontMessage Integration](#frontmessage-integration)
- [Background Jobs](#background-jobs)
- [Rake Tasks](#rake-tasks)
- [Usage Examples](#usage-examples)
- [Error Handling](#error-handling)
- [Performance Considerations](#performance-considerations)

## Overview

The email parser system consists of several key components:

- **TalonEmailParser**: Singleton service for parsing email content
- **ParsedEmail**: Model for storing parsed email components
- **EmailParseJob**: Background job for individual email processing
- **FrontMessageParsingJob**: Background job for batch processing
- **Rake Tasks**: Command-line tools for management and testing

## TalonEmailParser Service

### Class Overview

The `TalonEmailParser` is a singleton service that provides thread-safe email parsing using Python's Talon library via PyCall.

```ruby
# Get singleton instance
parser = TalonEmailParser.instance

# Check availability
parser.available? # => true/false

# Get version information
parser.talon_version # => "1.4.4"
```

### Main Methods

#### `parse_email(content, format:)`

Main parsing method that extracts clean reply content from emails.

**Parameters:**
- `content` (String|Hash): Email content to parse
- `format` (String): Format type - `'text/plain'`, `'text/html'`, or `'both'`

**Returns:** Hash with parsing results

```ruby
# Plain text parsing
result = parser.parse_email(email_content, format: 'text/plain')

# HTML parsing
result = parser.parse_email(html_content, format: 'text/html')

# Parse both formats
content = { text: plain_content, html: html_content }
result = parser.parse_email(content, format: 'both')
```

**Success Response Format:**
```ruby
{
  success: true,
  data: {
    format: 'text/plain',
    original_content: "Full email content...",
    reply_text: "Extracted reply content",
    clean_reply: "Reply without signature",
    signature: "Extracted signature",
    has_signature: true,
    original_length: 1500,
    reply_length: 200,
    clean_length: 150,
    talon_version: "1.4.4"
  },
  parsed_at: 2025-08-05 10:30:00 UTC
}
```

**Error Response Format:**
```ruby
{
  success: false,
  error: "Error message describing what went wrong",
  data: nil,
  parsed_at: 2025-08-05 10:30:00 UTC
}
```

#### `parse_plain_text(content)`

Parse plain text email content specifically.

```ruby
text_email = <<~EMAIL
  Thanks for your message. I'll get back to you soon.
  
  Best regards,
  John Smith
  john@example.com
  
  On Mon, Dec 1, 2024 at 11:55 AM, Jane Doe wrote:
  > Original message content here
  > More quoted content
EMAIL

result = parser.parse_plain_text(text_email)
puts result[:data][:clean_reply]
# => "Thanks for your message. I'll get back to you soon."

puts result[:data][:signature]
# => "Best regards,\nJohn Smith\njohn@example.com"
```

#### `parse_html(content)`

Parse HTML email content specifically.

```ruby
html_email = <<~HTML
  <div>
    <p>Thanks for your message. I'll respond shortly.</p>
    <div>
      <p>Best regards,<br>
      John Smith<br>
      <a href="mailto:john@example.com">john@example.com</a></p>
    </div>
  </div>
  <div class="gmail_quote">
    <blockquote class="gmail_quote">
      <p>Original message content...</p>
    </blockquote>
  </div>
HTML

result = parser.parse_html(html_email)
puts result[:data][:clean_reply]
# => "<p>Thanks for your message. I'll respond shortly.</p>"
```

#### `parse_both_formats(content)`

Parse both plain text and HTML formats.

```ruby
# With separate content for each format
content = {
  text: "Plain text version...",
  html: "<p>HTML version...</p>"
}
result = parser.parse_both_formats(content)

# Access results
text_result = result[:data][:text_parsing]
html_result = result[:data][:html_parsing]

# With single content (attempts both parsers)
result = parser.parse_both_formats("Email content that could be either format")
```

#### `parse_front_message(message, format:)`

Parse a FrontMessage model directly.

```ruby
message = FrontMessage.find(123)
result = parser.parse_front_message(message, format: 'both')

if result[:success]
  # Access message context
  message_info = result[:data][:message_context]
  puts message_info[:subject]
  puts message_info[:message_type]
  
  # Access parsing results
  if result[:data][:text_parsing]
    clean_text = result[:data][:text_parsing][:data][:clean_reply]
  end
end
```

#### `health_check()`

Comprehensive health check of the parsing service.

```ruby
health = parser.health_check

# Example response:
{
  service: "TalonEmailParser",
  status: :available,           # :available, :unavailable, :error
  initialized: true,
  talon_version: "1.4.4",
  signature_extraction: true,   # Whether signature extraction is available
  test_passed: true,           # Whether basic functionality test passed
  capabilities: {
    plain_text: true,
    html: true,
    signature_extraction: true,
    both_formats: true
  },
  last_check: 2025-08-05 10:30:00 UTC
}
```

### Error Classes

The service defines custom error classes for specific failure types:

```ruby
TalonEmailParser::ParseError        # Talon-specific parsing failures
TalonEmailParser::InitializationError  # PyCall or Talon setup failures
TalonEmailParser::FormatError       # Invalid format parameters
```

## ParsedEmail Model

### Model Overview

The `ParsedEmail` model stores parsed email components with polymorphic associations to support multiple message types.

```ruby
# Associations
parsed_email = ParsedEmail.find(123)
front_message = parsed_email.parseable  # Polymorphic association

# Attributes
parsed_email.plain_message     # Clean plain text reply
parsed_email.plain_signature   # Plain text signature
parsed_email.html_message      # Clean HTML reply  
parsed_email.html_signature    # HTML signature
parsed_email.parse_options     # JSON of parsing options used
parsed_email.parse_errors      # JSON of any parsing errors
parsed_email.parsed_at         # When parsing occurred
parsed_email.parser_version    # Version of Talon used
parsed_email.content_hash      # Hash for deduplication
```

### Instance Methods

#### Content Retrieval Methods

```ruby
# Get clean content (no quotes, no signature)
parsed_email.clean_content                        # Prefer plain text
parsed_email.clean_content(prefer_html: true)     # Prefer HTML

# Get content with signature (no quotes)
parsed_email.content_with_signature               # Prefer plain text
parsed_email.content_with_signature(prefer_html: true)  # Prefer HTML

# Get combined message with signature
parsed_email.plain_message_with_signature         # Plain text + signature
parsed_email.html_message_with_signature          # HTML + signature

# Get signature only
parsed_email.signature                            # Prefer plain text
parsed_email.signature(prefer_html: true)         # Prefer HTML
```

#### Status and Validation Methods

```ruby
# Check parsing status
parsed_email.parsing_successful?                  # True if no errors
parsed_email.parsing_status                       # "successful", "failed", or "unknown"
parsed_email.has_parsed_content?                  # True if any content extracted
parsed_email.has_signature?                       # True if signature found

# Get error information
parsed_email.error_messages                       # Array of error strings
parsed_email.parsing_summary                      # Hash of parsing results summary
```

### Scopes

```ruby
# Find emails with parsing errors
ParsedEmail.with_errors

# Find successfully parsed emails
ParsedEmail.successful

# Find emails parsed in the last day
ParsedEmail.where(parsed_at: 1.day.ago..Time.current)

# Find emails with signatures
ParsedEmail.where.not(plain_signature: nil)
                 .or(ParsedEmail.where.not(html_signature: nil))
```

### Usage Examples

```ruby
# Create parsed email for a FrontMessage
front_message = FrontMessage.find(123)
parser = TalonEmailParser.instance
result = parser.parse_front_message(front_message)

if result[:success]
  parsed_email = front_message.create_parsed_email!(
    plain_message: result[:data][:text_parsing][:data][:clean_reply],
    plain_signature: result[:data][:text_parsing][:data][:signature],
    html_message: result[:data][:html_parsing][:data][:clean_reply],
    html_signature: result[:data][:html_parsing][:data][:signature],
    parse_options: { format: 'both' },
    parse_errors: {},
    parsed_at: Time.current,
    parser_version: result[:data][:talon_version],
    content_hash: Digest::SHA256.hexdigest([front_message.body_plain, front_message.body_html].compact.join('|'))
  )
end

# Display parsed content
if parsed_email.parsing_successful?
  # Show clean reply without signature for thread view
  puts parsed_email.clean_content

  # Show full reply with signature for detailed view
  puts parsed_email.content_with_signature
end
```

## FrontMessage Integration

### Enhanced Methods

The `FrontMessage` model includes enhanced methods for email parsing integration.

#### `parse!(options = {})`

Parse the message content and create/update ParsedEmail record.

```ruby
message = FrontMessage.find(123)

# Parse with default options
message.parse!

# Parse with custom options
message.parse!(force_reparse: true, format: 'text/plain')

# Check result
if message.parsed_email
  puts "Parsed successfully: #{message.parsed_email.parsing_status}"
  puts "Clean content: #{message.parsed_email.clean_content}"
end
```

#### `display_content(include_signature:, prefer_html:)`

Get display-ready content with parsing applied.

```ruby
# Get clean content (default)
clean_content = message.display_content
# => Clean reply text without quotes or signature

# Get content with signature
full_content = message.display_content(include_signature: true)
# => Reply text with signature, no quotes

# Prefer HTML format
html_content = message.display_content(prefer_html: true)
# => HTML version if available, otherwise plain text

# Combined options
full_html = message.display_content(include_signature: true, prefer_html: true)
```

#### Background Processing

FrontMessage automatically queues parsing for inbound, non-draft messages:

```ruby
# Automatic parsing trigger
message = FrontMessage.create!(
  body_plain: "Email content...",
  is_inbound: true,
  is_draft: false
)
# => Automatically queues EmailParseJob for background processing

# Skip automatic parsing
message = FrontMessage.create!(
  body_plain: "Draft content...",
  is_inbound: true,
  is_draft: true  # No job queued for drafts
)
```

## Background Jobs

### EmailParseJob

Processes individual FrontMessage records.

```ruby
# Queue individual message parsing
EmailParseJob.perform_later(front_message_id)

# Queue with options
EmailParseJob.perform_later(front_message_id, force_reparse: true)

# Check job status
job = EmailParseJob.perform_later(123)
puts job.job_id
```

**Job Parameters:**
- `front_message_id` (required): ID of FrontMessage to parse
- `force_reparse` (optional): Skip existing ParsedEmail check
- `options` (optional): Additional parsing options

### FrontMessageParsingJob

Processes multiple messages in batches for better performance.

```ruby
# Queue batch processing
message_ids = [123, 124, 125, 126, 127]
FrontMessageParsingJob.perform_later(message_ids, batch_size: 10)

# Queue with options
FrontMessageParsingJob.perform_later(
  message_ids,
  batch_size: 5,
  skip_parsed: false,
  force_reparse: true,
  options: { format: 'both' }
)
```

**Job Parameters:**
- `message_ids` (required): Array of FrontMessage IDs
- `batch_size` (optional): Messages per batch (default: 10, max: 100)
- `skip_parsed` (optional): Skip messages with existing ParsedEmail (default: true)
- `force_reparse` (optional): Force reparsing existing records (default: false)
- `options` (optional): Additional parsing options

### Error Handling and Retries

Both jobs include comprehensive retry logic:

```ruby
# Custom error handling
class EmailParseJob < ApplicationJob
  # Retry configuration
  retry_on TalonEmailParser::ParseError, wait: :exponentially_longer, attempts: 5
  retry_on StandardError, wait: :exponentially_longer, attempts: 3
  
  # Permanent failures (no retry)
  discard_on ActiveRecord::RecordNotFound
  discard_on ArgumentError
end
```

## Rake Tasks

### Available Tasks

```bash
# Show service status and capabilities
rake talon:status

# Run comprehensive functionality tests
rake talon:test

# Test parsing specific message
rake talon:test_message[message_id]

# Performance benchmark
rake talon:benchmark

# Batch processing tasks
rake front_message_parsing:status           # Show parsing statistics
rake front_message_parsing:batch            # Process unparsed messages
rake front_message_parsing:reparse          # Reparse messages with errors
rake front_message_parsing:date_range       # Process date range
rake front_message_parsing:test             # Test with sample
rake front_message_parsing:performance_report  # Detailed metrics
rake front_message_parsing:clear_metrics_cache # Clear cached metrics
rake front_message_parsing:help             # Show help
```

### Task Examples

```bash
# Basic status check
rake talon:status
# Output:
# TalonEmailParser Service Status:
# ================================
# Status: available
# Available: true
# Talon Version: 1.4.4
# Capabilities:
#   Plain text: ✓
#   Html: ✓
#   Signature extraction: ✓

# Process unparsed messages
rake front_message_parsing:batch BATCH_SIZE=20 MAX_MESSAGES=500

# Reparse messages with errors from last 14 days
rake front_message_parsing:reparse DAYS_BACK=14 BATCH_SIZE=5

# Process specific date range
rake front_message_parsing:date_range START_DATE=2024-01-01 END_DATE=2024-01-31

# Performance report
rake front_message_parsing:performance_report
# Output includes:
# - Total/parsed/unparsed counts
# - Success rates and error patterns
# - Processing times and throughput
# - Queue status and recommendations
```

## Usage Examples

### Basic Email Parsing

```ruby
# Initialize parser
parser = TalonEmailParser.instance

# Sample email with quotes and signature
email_content = <<~EMAIL
  Hi Jane,
  
  Thanks for your email. I'll review the documents and get back to you by Friday.
  
  Let me know if you need anything else.
  
  Best regards,
  John Smith
  Senior Developer
  john.smith@company.com
  (555) 123-4567
  
  On Mon, Dec 1, 2024 at 2:30 PM, Jane Doe <jane@client.com> wrote:
  > Hi John,
  > 
  > I'm sending you the project documents for review. Please let me know
  > your thoughts by the end of the week.
  > 
  > Thanks,
  > Jane
EMAIL

# Parse the email
result = parser.parse_email(email_content, format: 'text/plain')

if result[:success]
  data = result[:data]
  
  puts "Original length: #{data[:original_length]} characters"
  puts "Reply length: #{data[:reply_length]} characters"
  puts "Clean length: #{data[:clean_length]} characters"
  puts
  puts "Clean reply:"
  puts data[:clean_reply]
  puts
  puts "Signature:"
  puts data[:signature]
end

# Expected output:
# Original length: 589 characters
# Reply length: 142 characters  
# Clean length: 89 characters
#
# Clean reply:
# Hi Jane,
# 
# Thanks for your email. I'll review the documents and get back to you by Friday.
# 
# Let me know if you need anything else.
#
# Signature:
# Best regards,
# John Smith
# Senior Developer
# john.smith@company.com
# (555) 123-4567
```

### HTML Email Parsing

```ruby
html_email = <<~HTML
  <div dir="ltr">
    <div>Hi Jane,</div>
    <div><br></div>
    <div>Thanks for your email. I'll review the documents and get back to you by Friday.</div>
    <div><br></div>
    <div>Let me know if you need anything else.</div>
    <div><br></div>
    <div>Best regards,<br>
    John Smith<br>
    Senior Developer<br>
    <a href="mailto:john.smith@company.com">john.smith@company.com</a><br>
    (555) 123-4567</div>
  </div>
  <div class="gmail_quote">
    <div dir="ltr" class="gmail_attr">
      On Mon, Dec 1, 2024 at 2:30 PM Jane Doe &lt;<a href="mailto:jane@client.com">jane@client.com</a>&gt; wrote:<br>
    </div>
    <blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">
      <div>Hi John,</div>
      <div><br></div>
      <div>I'm sending you the project documents for review. Please let me know your thoughts by the end of the week.</div>
      <div><br></div>
      <div>Thanks,</div>
      <div>Jane</div>
    </blockquote>
  </div>
HTML

result = parser.parse_email(html_email, format: 'text/html')

if result[:success]
  clean_html = result[:data][:clean_reply]
  puts "Clean HTML reply:"
  puts clean_html
end
```

### Batch Processing

```ruby
# Find unparsed messages
unparsed_messages = FrontMessage.joins("LEFT JOIN parsed_emails ON parsed_emails.parseable_id = front_messages.id AND parsed_emails.parseable_type = 'FrontMessage'")
                                .where(parsed_emails: { id: nil })
                                .where(is_inbound: true, is_draft: false)
                                .limit(100)

# Queue batch processing
message_ids = unparsed_messages.pluck(:id)
FrontMessage.queue_batch_parsing(message_ids, batch_size: 10)

# Monitor progress
puts "Queued #{message_ids.count} messages for parsing"

# Check results after processing
sleep 30
parsed_count = ParsedEmail.where(parseable_id: message_ids, parseable_type: 'FrontMessage').count
puts "Parsed #{parsed_count}/#{message_ids.count} messages"
```

### Custom Content Display

```ruby
class MessagesController < ApplicationController
  def show
    @message = FrontMessage.find(params[:id])
    
    # Display options based on user preference
    @display_options = {
      include_signature: params[:show_signature] == 'true',
      prefer_html: request.format.html? && params[:format] != 'text'
    }
    
    # Get display content
    @content = @message.display_content(@display_options)
    
    # Fallback to original if parsing failed
    @content ||= @display_options[:prefer_html] ? @message.body_html : @message.body_plain
  end
end
```

### Error Handling Examples

```ruby
# Handle parsing errors gracefully
def safe_parse_message(message)
  parser = TalonEmailParser.instance
  
  unless parser.available?
    Rails.logger.warn "Email parser not available, using original content"
    return message.body_plain
  end
  
  result = parser.parse_front_message(message, format: 'both')
  
  if result[:success]
    # Prefer clean content, fallback to original
    parsed_content = nil
    
    if result[:data][:text_parsing] && result[:data][:text_parsing][:success]
      parsed_content = result[:data][:text_parsing][:data][:clean_reply]
    elsif result[:data][:html_parsing] && result[:data][:html_parsing][:success]
      parsed_content = result[:data][:html_parsing][:data][:clean_reply]
    end
    
    return parsed_content.present? ? parsed_content : message.body_plain
  else
    Rails.logger.error "Failed to parse message #{message.id}: #{result[:error]}"
    return message.body_plain
  end
rescue StandardError => e
  Rails.logger.error "Unexpected error parsing message #{message.id}: #{e.message}"
  return message.body_plain
end
```

## Error Handling

### Error Types

The parser handles several types of errors:

1. **Initialization Errors**: PyCall or Talon unavailable
2. **Parsing Errors**: Talon-specific parsing failures  
3. **Format Errors**: Invalid format parameters
4. **Content Errors**: Empty or invalid email content
5. **System Errors**: Database, memory, or network issues

### Error Response Format

All parser methods return consistent error formats:

```ruby
{
  success: false,
  error: "Descriptive error message",
  data: nil,
  parsed_at: timestamp
}
```

### Graceful Degradation

The system is designed to degrade gracefully:

```ruby
# Check parser availability before use
if TalonEmailParser.instance.available?
  # Use advanced parsing
  result = parser.parse_email(content)
  display_content = result[:success] ? result[:data][:clean_reply] : original_content
else
  # Fallback to original content
  Rails.logger.warn "Email parser unavailable, using original content"
  display_content = original_content
end
```

### Error Monitoring

Monitor parsing errors in production:

```ruby
# Custom error tracking
class EmailParsingErrorTracker
  def self.track_error(message_id, error_type, error_message)
    Rails.logger.error "Email parsing error: #{error_type} for message #{message_id}: #{error_message}"
    
    # Send to external monitoring (Sentry, DataDog, etc.)
    if defined?(Sentry)
      Sentry.capture_message("Email parsing error", extra: {
        message_id: message_id,
        error_type: error_type,
        error_message: error_message
      })
    end
  end
end
```

## Performance Considerations

### Memory Management

The parser includes memory optimization features:

```ruby
# Batch processing with memory management
class FrontMessageParsingJob < ApplicationJob
  def perform(message_ids, batch_size: 10, **options)
    message_ids.each_slice(batch_size).with_index do |batch, index|
      process_batch(batch, options)
      
      # Force garbage collection every 50 processed messages
      if (index + 1) % 5 == 0
        GC.start
        sleep 0.1  # Brief pause to manage system load
      end
    end
  end
end
```

### Caching Strategy

Implement caching for frequently accessed content:

```ruby
# Cache parsed content
class ParsedEmail < ApplicationRecord
  def cached_clean_content(prefer_html: false)
    cache_key = "parsed_email:#{id}:clean_content:#{prefer_html}"
    
    Rails.cache.fetch(cache_key, expires_in: 1.hour) do
      clean_content(prefer_html: prefer_html)
    end
  end
end
```

### Database Optimization

Optimize database queries for large datasets:

```ruby
# Efficient queries for parsing status
scope :needs_parsing, -> {
  joins("LEFT JOIN parsed_emails ON parsed_emails.parseable_id = front_messages.id AND parsed_emails.parseable_type = 'FrontMessage'")
    .where(parsed_emails: { id: nil })
    .where(is_inbound: true, is_draft: false)
}

scope :parsing_failed, -> {
  joins(:parsed_email)
    .where.not(parsed_emails: { parse_errors: [nil, {}, '{}', '[]'] })
}

# Use includes to avoid N+1 queries
messages_with_parsed = FrontMessage.includes(:parsed_email)
                                  .where(id: message_ids)
```

### Performance Monitoring

Track parsing performance metrics:

```ruby
# Performance tracking
class EmailParsingMetrics
  def self.track_parsing_time(duration_ms)
    Rails.cache.increment('email_parser:total_parses', 1)
    Rails.cache.write('email_parser:last_duration', duration_ms)
    
    # Track averages
    current_avg = Rails.cache.read('email_parser:avg_duration') || duration_ms
    new_avg = (current_avg * 0.9) + (duration_ms * 0.1)  # Exponential moving average
    Rails.cache.write('email_parser:avg_duration', new_avg)
  end
  
  def self.current_stats
    {
      total_parses: Rails.cache.read('email_parser:total_parses') || 0,
      avg_duration_ms: Rails.cache.read('email_parser:avg_duration') || 0,
      last_duration_ms: Rails.cache.read('email_parser:last_duration') || 0
    }
  end
end
```

---

*This API reference provides comprehensive coverage of the email parser system. For setup instructions, see [EMAIL_PARSER_SETUP.md](EMAIL_PARSER_SETUP.md). For troubleshooting, see [EMAIL_PARSER_TROUBLESHOOTING.md](EMAIL_PARSER_TROUBLESHOOTING.md).*