# TalonEmailParser Service Documentation

## Overview

The `TalonEmailParser` service provides comprehensive email parsing functionality using the Talon Python library via PyCall. It implements a singleton pattern for thread-safe email parsing with support for both plain text and HTML formats.

## Features

- **Singleton Pattern**: Thread-safe singleton implementation with lazy initialization
- **Multi-Format Support**: Parse both plain text and HTML email content
- **Signature Extraction**: Extract signatures separately from email replies (when available)
- **Reply Extraction**: Remove quoted content to extract just the new reply
- **Error Handling**: Comprehensive error handling with detailed logging
- **FrontMessage Integration**: Direct integration with FrontMessage models
- **Health Monitoring**: Built-in health checks and status reporting
- **Performance Tracking**: Version tracking and capabilities reporting

## Usage

### Basic Usage

```ruby
# Get singleton instance
parser = TalonEmailParser.instance

# Check availability
if parser.available?
  # Parse plain text email
  result = parser.parse_email(email_content, format: 'text/plain')
  
  if result[:success]
    reply = result[:data][:clean_reply]
    signature = result[:data][:signature]
    has_signature = result[:data][:has_signature]
  end
end
```

### Format Options

The service supports three format options:

1. **`'text/plain'`** - Parse plain text content
2. **`'text/html'`** - Parse HTML content
3. **`'both'`** - Parse both formats (requires Hash input with `:text` and `:html` keys)

### Plain Text Parsing

```ruby
text_email = <<~EMAIL
  Thanks for your message. I'll get back to you.
  
  Best regards,
  John Smith
  john@example.com
  
  On Mon, Dec 1, 2024 at 11:55 AM, Jane Doe wrote:
  > Original message content
EMAIL

result = parser.parse_email(text_email, format: 'text/plain')
# => {
#   success: true,
#   data: {
#     format: 'text/plain',
#     original_content: "...",
#     reply_text: "Thanks for your message. I'll get back to you.",
#     clean_reply: "Thanks for your message. I'll get back to you.",
#     signature: "Best regards,\nJohn Smith\njohn@example.com",
#     has_signature: true,
#     original_length: 156,
#     reply_length: 45,
#     clean_length: 45,
#     talon_version: "1.0.0"
#   }
# }
```

### HTML Parsing

```ruby
html_email = <<~HTML
  <div>
    <p>Thanks for your message.</p>
    <div>Best regards,<br>John</div>
  </div>
  <div class="gmail_quote">
    <blockquote>Original message</blockquote>
  </div>
HTML

result = parser.parse_email(html_email, format: 'text/html')
```

### Both Formats

```ruby
# With separate content
content = {
  text: plain_text_email,
  html: html_email
}
result = parser.parse_email(content, format: 'both')

# With same content (attempts both parsers)
result = parser.parse_email(email_content, format: 'both')
```

### FrontMessage Integration

```ruby
message = FrontMessage.find(id)
result = parser.parse_front_message(message, format: 'both')

if result[:success]
  # Access message context
  message_info = result[:data][:message_context]
  
  # Access parsing results
  text_result = result[:data][:text_parsing]
  html_result = result[:data][:html_parsing]
end
```

## Result Structure

### Success Response

```ruby
{
  success: true,
  data: {
    format: 'text/plain',           # Format that was parsed
    original_content: "...",        # Original email content
    reply_text: "...",             # Extracted reply (plain text)
    reply_html: "...",             # Extracted reply (HTML, if applicable)
    clean_reply: "...",            # Reply with signature removed
    signature: "...",              # Extracted signature (if found)
    has_signature: true,           # Boolean indicating signature presence
    original_length: 1000,         # Length of original content
    reply_length: 100,             # Length of extracted reply
    clean_length: 80,              # Length of clean reply
    talon_version: "1.0.0"         # Talon library version
  },
  parsed_at: Time.current          # Timestamp of parsing
}
```

### Error Response

```ruby
{
  success: false,
  error: "Error message",
  data: nil,
  parsed_at: Time.current
}
```

## Health Monitoring

### Health Check

```ruby
health = parser.health_check
# => {
#   service: "TalonEmailParser",
#   status: :available,           # :available, :unavailable, :error
#   initialized: true,
#   talon_version: "1.0.0",
#   signature_extraction: false,   # Whether signature extraction is available
#   test_passed: true,            # Whether basic test passed
#   capabilities: {
#     plain_text: true,
#     html: true,
#     signature_extraction: false,
#     both_formats: true
#   },
#   last_check: Time.current
# }
```

### Status Check

```ruby
parser.available?        # => true/false
parser.talon_version     # => "1.0.0" or error message
```

## Integration with EmailReplyParserService

The existing `EmailReplyParserService` has been enhanced with an `advanced_parse` method that uses `TalonEmailParser`:

```ruby
# Enhanced parsing with signature extraction
result = EmailReplyParserService.advanced_parse(email_content, format: 'text/plain')

# Health check includes both services
health = EmailReplyParserService.health_check
# => {
#   service: "EmailReplyParserService",
#   talon_status: :available,
#   available: true,
#   message: "...",
#   advanced_parser: {
#     status: :available,
#     available: true,
#     capabilities: { ... }
#   },
#   last_check: Time.current
# }
```

## Rake Tasks

### Available Tasks

```bash
# Show service status and capabilities
rake talon:status

# Run comprehensive functionality tests
rake talon:test

# Test with specific FrontMessage
rake talon:test_message[message_id]

# Performance benchmark
rake talon:benchmark
```

### Example Output

```bash
$ rake talon:status
TalonEmailParser Service Status:
================================
Status: available
Available: true
Talon Version: 1.0.0
Initialized: true

Capabilities:
  Plain text: ✓
  Html: ✓
  Signature extraction: ✗
  Both formats: ✓

Last Check: 2025-08-05 13:39:58 -0400
```

## Error Handling

The service includes comprehensive error handling:

### Initialization Errors
- PyCall not available
- Talon module import failures
- Signature utilities unavailable (non-fatal)

### Runtime Errors
- Empty or blank content
- Invalid format parameters
- Python parsing errors
- Network/connectivity issues

### Error Logging

All errors are logged with appropriate levels:
- **INFO**: Initialization success, signature utilities unavailable
- **ERROR**: Parsing failures, initialization errors

## Performance Considerations

### Singleton Benefits
- **Memory Efficiency**: Single instance across application
- **Initialization Cost**: One-time Python module loading
- **Thread Safety**: Safe concurrent access

### Lazy Loading
- Talon modules loaded only when first accessed
- Graceful degradation if modules unavailable
- Minimal impact when not used

### Caching
- Singleton instance cached for application lifetime
- Python modules cached by PyCall
- No per-request initialization overhead

## Thread Safety

The service is fully thread-safe:
- Singleton pattern ensures single instance
- PyCall operations are thread-safe
- No shared mutable state between requests
- Concurrent parsing operations supported

## Dependencies

### Required
- `pycall` gem
- `talon` Python library
- Python 3.x environment

### Optional
- `talon.signature` module (for enhanced signature extraction)

## Troubleshooting

### Common Issues

1. **Parser Not Available**
   ```ruby
   # Check initialization
   parser = TalonEmailParser.instance
   health = parser.health_check
   puts health[:error] if health[:status] != :available
   ```

2. **Version Error**
   - Talon library accessible but version detection fails
   - Usually non-fatal, parsing still works

3. **Signature Extraction Not Working**
   - `talon.signature` module not available
   - Feature gracefully disabled, basic parsing continues

### Debug Information

```ruby
# Get detailed status
health = parser.health_check
puts health.to_json

# Test basic functionality
result = parser.parse_email("Test email", format: 'text/plain')
puts result[:error] unless result[:success]
```

## Configuration

### PyCall Configuration
Configuration handled in `config/initializers/pycall.rb`:

```ruby
# Global Talon instance available via
Rails.application.config.talon_parser

# Helper methods
TalonParserHelper.available?
TalonParserHelper.parser
TalonParserHelper.health_check
```

### Environment Variables
No specific environment variables required. Uses standard PyCall configuration.

## API Reference

### Class Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `instance` | Get singleton instance | None | `TalonEmailParser` |

### Instance Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `parse_email` | Main parsing method | `content`, `format:` | `Hash` |
| `parse_plain_text` | Parse plain text | `content` | `Hash` |
| `parse_html` | Parse HTML | `content` | `Hash` |
| `parse_both_formats` | Parse both formats | `content` | `Hash` |
| `parse_front_message` | Parse FrontMessage | `message`, `format:` | `Hash` |
| `available?` | Check availability | None | `Boolean` |
| `talon_version` | Get version | None | `String` |
| `health_check` | Full health check | None | `Hash` |

## Version History

- **v1.0**: Initial implementation with basic parsing
- **v1.1**: Added HTML support and signature extraction
- **v1.2**: Added FrontMessage integration and enhanced error handling
- **v1.3**: Added rake tasks and performance monitoring

## Future Enhancements

1. **Enhanced Signature Detection**: Improve signature extraction patterns
2. **Batch Processing**: Support for bulk email parsing
3. **Caching**: Result caching for frequently parsed emails
4. **Metrics**: Performance and usage metrics collection
5. **Configuration**: Runtime configuration options