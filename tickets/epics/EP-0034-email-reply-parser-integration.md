# EP-0034: Email Reply Parser Integration

**Epic ID**: EP-0034  
**Created**: 2025-08-05  
**Status**: Open  
**Priority**: High  
**Component**: Backend/Email Processing  

## Overview

Implement PyCall-based integration with Mailgun's Talon library to extract the most recent message from email chains in FrontMessage records. This system will parse email bodies to separate replies from quoted content, signatures, and forwarded messages, supporting various email client formats and quoting styles. A new polymorphic ParsedEmail model will store the parsed components, allowing future expansion to other message types.

## Business Value

- **Clean Email Display**: Show only the actual reply content, removing quoted text and signatures
- **Improved User Experience**: Cleaner email threads without redundant quoted content
- **Storage Efficiency**: Store parsed components separately for better data management
- **Analytics Ready**: Enable analysis of actual message content without noise
- **Multi-Client Support**: Handle emails from Gmail, Outlook, Apple Mail, and other clients
- **Future AI Integration**: Clean email data ready for AI/ML processing

## Requirements

### Core Functionality

1. **Email Parsing**
   - Extract reply text from email chains
   - Remove quoted content (various formats)
   - Extract and store signatures separately
   - Handle multiple email client formats
   - Support both plain text (`body_plain`) and HTML (`body_html`) from FrontMessage
   - Parse only inbound, non-draft messages

2. **PyCall Integration**
   - Direct Python library calls from Ruby
   - No separate microservice required
   - Efficient memory management
   - Thread-safe implementation

3. **Database Integration**
   - Parse FrontMessage records from PostgreSQL
   - Create polymorphic ParsedEmail model
   - Store plain and HTML parsed components separately
   - Background job processing via SolidQueue
   - Batch processing capabilities

4. **Performance**
   - Parse emails asynchronously
   - Cache parsed results
   - Handle high volumes efficiently
   - Monitor parsing success rates

## Talon Library Capabilities

### What Talon Can Do:
- **Quotation Removal**: Removes quoted text from replies (both plain and HTML)
- **Signature Extraction**: Extracts signatures (works best with plain text)
- **Format Support**:
  - Plain Text: Full support for quotations and signatures ✅
  - HTML: Quotation extraction via blockquote tags ✅, Limited signature extraction ⚠️

## Technical Design

### Architecture Overview

```
┌─────────────────────────┐
│   FrontMessage Create   │
│  (Webhook/Controller)   │
└───────────┬─────────────┘
            │ after_create callback
            ▼
┌─────────────────────────┐
│ FrontMessageParsingJob  │ ← Background processing
│    (SolidQueue)         │   (only for inbound, non-draft)
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  TalonEmailParser       │ ← PyCall wrapper
│  (Service Object)       │
└───────────┬─────────────┘
            │ PyCall
            ▼
┌─────────────────────────┐
│  Talon Python Library   │ ← Email parsing logic
│  - quotations.extract   │
│  - signature.extract    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  PostgreSQL Database    │ ← Polymorphic storage
│  parsed_emails table    │   belongs_to :parseable
└─────────────────────────┘
```

### Database Schema

```ruby
# Migration: create_parsed_emails
class CreateParsedEmails < ActiveRecord::Migration[7.0]
  def change
    create_table :parsed_emails, id: :uuid do |t|
      # Polymorphic association
      t.references :parseable, polymorphic: true, null: false, index: true, type: :uuid
      
      # Plain text components
      t.text :plain_message              # Reply only (no quotes, no signature)
      t.text :plain_signature            # Just the signature
      
      # HTML components
      t.text :html_message               # Reply only (no quotes, no signature)
      t.text :html_signature             # Just the signature
      
      # Metadata
      t.string :parse_options            # JSON of what was requested to parse
      t.datetime :parsed_at
      t.string :parser_version
      t.text :parse_errors               # JSON of any errors by field
      
      # Performance optimization
      t.string :content_hash             # For cache deduplication
      
      t.timestamps
    end
    
    # Indexes for performance
    add_index :parsed_emails, :content_hash
    add_index :parsed_emails, :parsed_at
  end
end
```

### Service Architecture

```ruby
# app/services/talon_email_parser.rb
class TalonEmailParser
  class << self
    def instance
      @instance ||= new
    end
    
    delegate :parse_email, to: :instance
  end
  
  def initialize
    @talon = PyCall.import_module('talon')
    @talon.init()
    @quotations = PyCall.import_module('talon.quotations')
    @signature = PyCall.import_module('talon.signature.bruteforce')
  rescue PyCall::PyError => e
    Rails.logger.error "Failed to initialize Talon: #{e.message}"
    raise
  end
  
  def parse_email(content, format: 'text/plain')
    results = {}
    errors = {}
    
    case format
    when 'text/plain'
      parse_plain_text(content[:plain] || content, results, errors)
    when 'text/html'
      parse_html(content[:html] || content, results, errors)
    when 'both'
      # Parse both plain and HTML when available
      parse_plain_text(content[:plain], results, errors) if content[:plain]
      parse_html(content[:html], results, errors) if content[:html]
    end
    
    {
      results: results,
      errors: errors,
      parser_version: talon_version
    }
  end
  
  private
  
  def parse_plain_text(content, results, errors)
    return if content.blank?
    
    # Remove quotes to get reply
    reply = @quotations.extract_from(content, 'text/plain')
    
    # Extract signature from the reply (not from original)
    sig_data = @signature.extract_signature(reply)
    
    if sig_data && sig_data.length == 2
      results[:plain_message] = sig_data[0]    # Reply without signature
      results[:plain_signature] = sig_data[1]   # Just the signature
    else
      results[:plain_message] = reply
      results[:plain_signature] = nil
    end
  rescue => e
    errors[:plain] = e.message
    Rails.logger.error "Failed to parse plain text: #{e.message}"
  end
  
  def parse_html(content, results, errors)
    return if content.blank?
    
    # Remove quotes to get reply
    reply = @quotations.extract_from(content, 'text/html')
    
    # HTML signature extraction is limited, but we'll try
    # Convert to plain text for signature detection
    plain_from_html = ActionView::Base.full_sanitizer.sanitize(reply)
    sig_data = @signature.extract_signature(plain_from_html)
    
    if sig_data && sig_data.length == 2
      # We have the signature position in plain text
      # Try to find and remove it from HTML (basic approach)
      results[:html_message] = remove_signature_from_html(reply, sig_data[1])
      results[:html_signature] = extract_html_signature(reply, sig_data[1])
    else
      results[:html_message] = reply
      results[:html_signature] = nil
    end
  rescue => e
    errors[:html] = e.message
    Rails.logger.error "Failed to parse HTML: #{e.message}"
  end
  
  def remove_signature_from_html(html, plain_signature)
    # Basic approach: find signature text in HTML and remove it
    # This is simplified - production might need more sophisticated approach
    html
  end
  
  def extract_html_signature(html, plain_signature)
    # Extract the HTML version of the signature
    # This is simplified - production might need more sophisticated approach
    nil
  end
  
  def talon_version
    @talon_version ||= @talon.__version__ rescue 'unknown'
  end
end
```

### Model Architecture

```ruby
# app/models/parsed_email.rb
class ParsedEmail < ApplicationRecord
  belongs_to :parseable, polymorphic: true
  
  # Serialized fields
  serialize :parse_options, JSON
  serialize :parse_errors, JSON
  
  # Validations
  validates :parseable_type, :parseable_id, presence: true
  
  # Scopes
  scope :with_errors, -> { where.not(parse_errors: [nil, '{}']) }
  scope :successful, -> { where(parse_errors: [nil, '{}']) }
  
  # Computed properties
  def plain_message_with_signature
    return nil unless plain_message
    [plain_message, plain_signature].compact.join("\n\n")
  end
  
  def html_message_with_signature
    return nil unless html_message
    [html_message, html_signature].compact.join("\n")
  end
  
  # Get the cleanest content (no quotes, no signature)
  def clean_content(prefer_html: false)
    prefer_html ? (html_message || plain_message) : (plain_message || html_message)
  end
  
  # Get content with signature (no quotes)
  def content_with_signature(prefer_html: false)
    if prefer_html
      html_message_with_signature || plain_message_with_signature
    else
      plain_message_with_signature || html_message_with_signature
    end
  end
  
  def has_signature?
    plain_signature.present? || html_signature.present?
  end
  
  def signature(prefer_html: false)
    prefer_html ? (html_signature || plain_signature) : (plain_signature || html_signature)
  end
end

# app/models/front_message.rb
class FrontMessage < ApplicationRecord
  has_one :parsed_email, as: :parseable, dependent: :destroy
  
  # Existing associations and fields...
  
  after_create :queue_parsing
  
  def parse!(options = {})
    # Determine what content we have
    content_to_parse = {}
    
    if body_plain.present?
      content_to_parse[:plain] = body_plain
    end
    
    if body_html.present?
      content_to_parse[:html] = body_html
    end
    
    return if content_to_parse.empty?
    
    # Use service to parse
    parser = TalonEmailParser.instance
    result = parser.parse_email(
      content_to_parse,
      format: content_to_parse.keys.include?(:html) && content_to_parse.keys.include?(:plain) ? 'both' : 
              content_to_parse.keys.include?(:html) ? 'text/html' : 'text/plain'
    )
    
    # Create or update parsed email
    parsed = parsed_email || build_parsed_email
    parsed.update!(
      plain_message: result[:results][:plain_message],
      plain_signature: result[:results][:plain_signature],
      html_message: result[:results][:html_message],
      html_signature: result[:results][:html_signature],
      parse_options: options,
      parse_errors: result[:errors],
      parser_version: result[:parser_version],
      parsed_at: Time.current,
      content_hash: generate_content_hash
    )
  end
  
  def display_content(include_signature: false, prefer_html: false)
    return body_plain unless parsed_email
    
    if include_signature
      parsed_email.content_with_signature(prefer_html: prefer_html)
    else
      parsed_email.clean_content(prefer_html: prefer_html)
    end
  end
  
  private
  
  def queue_parsing
    # Only parse inbound messages (not drafts or outbound)
    return unless is_inbound && !is_draft
    
    FrontMessageParsingJob.perform_later(id)
  end
  
  def generate_content_hash
    content = [body_plain, body_html].compact.join('|')
    Digest::SHA256.hexdigest(content)
  end
end
```

## Implementation Phases

### Phase 1: PyCall Setup & Infrastructure (2 days)

**Tickets:**
- [ ] Add PyCall gem and configure Python environment
- [ ] Create Dockerfile with Python dependencies
- [ ] Set up PyCall initializer and health checks
- [ ] Document local development setup

**Acceptance Criteria:**
- PyCall successfully imports Talon library
- Health check endpoint verifies Python integration
- Docker build includes all Python dependencies
- Development setup documented in README

### Phase 2: Email Parser Service (3 days)

**Tickets:**
- [ ] Create TalonEmailParser service class
- [ ] Implement parse_plain_text and parse_html methods
- [ ] Add caching layer for parsed results
- [ ] Create thread-safe connection pool

**Acceptance Criteria:**
- Service correctly extracts replies from test emails
- Signatures detected and extracted separately
- Handles both body_plain and body_html from FrontMessage
- Thread safety verified with concurrent tests

### Phase 3: Database Integration (2 days)

**Tickets:**
- [ ] Create migration for parsed_emails table with polymorphic association
- [ ] Create ParsedEmail model with computed properties
- [ ] Update FrontMessage model with parsing methods
- [ ] Implement content_hash for deduplication

**Acceptance Criteria:**
- Migration creates UUID-based polymorphic table
- ParsedEmail model properly associates with FrontMessage
- Only inbound, non-draft messages trigger parsing
- Duplicate emails share cached results

### Phase 4: Background Processing (2 days)

**Tickets:**
- [ ] Create FrontMessageParsingJob for async processing
- [ ] Implement retry logic for failures with SolidQueue
- [ ] Add batch processing rake task
- [ ] Configure job queue priorities

**Acceptance Criteria:**
- Jobs process within 5 seconds of FrontMessage creation
- Failed jobs retry with exponential backoff
- Batch task processes 1000+ emails/minute
- Only inbound, non-draft messages are queued

### Phase 5: Monitoring & Optimization (2 days)

**Tickets:**
- [ ] Add parsing metrics and success rates
- [ ] Create admin dashboard for parsing stats
- [ ] Implement performance monitoring
- [ ] Add alerting for parsing failures

**Acceptance Criteria:**
- Dashboard shows real-time parsing metrics
- Success rate maintained above 95%
- P95 parsing time < 100ms
- Alerts trigger for failure spikes

### Phase 6: Testing & Documentation (1 day)

**Tickets:**
- [ ] Create comprehensive test suite
- [ ] Add example emails from various clients
- [ ] Document parsing limitations
- [ ] Create troubleshooting guide

**Acceptance Criteria:**
- Test coverage > 90%
- Examples cover all major email clients
- Documentation includes edge cases
- Troubleshooting covers common issues

## Success Metrics

1. **Parsing Accuracy**
   - 95%+ success rate for reply extraction
   - 90%+ success rate for signature detection
   - Support for 10+ email client formats

2. **Performance**
   - P50 parsing time < 50ms
   - P95 parsing time < 100ms
   - Cache hit ratio > 80%
   - Process 10,000 emails/hour

3. **Reliability**
   - Zero data loss from parsing failures
   - 99.9% uptime for parsing service
   - Graceful degradation on errors

4. **User Impact**
   - 50% reduction in email display size
   - Improved email thread readability
   - Faster email search performance

## Testing Strategy

### Unit Tests
```ruby
# spec/services/talon_email_parser_spec.rb
RSpec.describe TalonEmailParser do
  describe '#parse_email' do
    let(:parser) { described_class.instance }
    
    context 'with plain text' do
      it 'extracts reply from Gmail format' do
        content = File.read('spec/fixtures/emails/gmail_reply.txt')
        result = parser.parse_email({ plain: content }, format: 'text/plain')
        
        expect(result[:results][:plain_message]).to eq("Thanks for your help!")
        expect(result[:results][:plain_message]).not_to include("On Mon, Oct 1")
      end
      
      it 'extracts signature' do
        content = "Thanks!\n\n--\nJohn Doe\nCEO"
        result = parser.parse_email({ plain: content }, format: 'text/plain')
        
        expect(result[:results][:plain_message]).to eq("Thanks!")
        expect(result[:results][:plain_signature]).to include("John Doe")
      end
    end
    
    context 'with HTML' do
      it 'removes blockquotes' do
        html = "<p>Reply</p><blockquote>Original message</blockquote>"
        result = parser.parse_email({ html: html }, format: 'text/html')
        
        expect(result[:results][:html_message]).to eq("<p>Reply</p>")
      end
    end
  end
end

# spec/models/parsed_email_spec.rb
RSpec.describe ParsedEmail do
  describe 'computed properties' do
    let(:parsed_email) do
      build(:parsed_email,
        plain_message: "Thanks for your help",
        plain_signature: "Best,\nJohn"
      )
    end
    
    it 'combines message with signature' do
      expect(parsed_email.plain_message_with_signature)
        .to eq("Thanks for your help\n\nBest,\nJohn")
    end
    
    it 'returns clean content' do
      expect(parsed_email.clean_content).to eq("Thanks for your help")
    end
  end
end
```

### Integration Tests
```ruby
# spec/models/front_message_spec.rb
RSpec.describe FrontMessage do
  describe 'email parsing' do
    let(:front_message) do
      create(:front_message,
        body_plain: "Thanks!\n\nOn Mon, Oct 1, 2024 at 10:00 AM John wrote:\n> Original message",
        body_html: "<p>Thanks!</p><blockquote>Original message</blockquote>",
        is_inbound: true,
        is_draft: false
      )
    end
    
    it 'queues parsing job after creation' do
      expect {
        front_message
      }.to have_enqueued_job(FrontMessageParsingJob)
    end
    
    it 'does not queue for drafts' do
      expect {
        create(:front_message, is_draft: true)
      }.not_to have_enqueued_job(FrontMessageParsingJob)
    end
    
    it 'parses both plain and HTML content' do
      front_message.parse!
      parsed = front_message.parsed_email
      
      expect(parsed.plain_message).to eq("Thanks!")
      expect(parsed.html_message).to eq("<p>Thanks!</p>")
    end
  end
end
```

### Performance Tests
- Benchmark parsing speed
- Memory usage profiling
- Concurrent request handling
- Large email processing

## Security Considerations

1. **Input Validation**
   - Sanitize email content before parsing
   - Limit maximum email size (1MB)
   - Validate UTF-8 encoding
   - Handle malformed emails gracefully

2. **Python Security**
   - Use specific Talon version
   - Audit Python dependencies
   - Isolate Python environment
   - Monitor for vulnerabilities

3. **Data Protection**
   - Don't log email content
   - Encrypt cached data
   - Implement retention policies
   - Handle PII appropriately

## Monitoring & Alerting

### Key Metrics
```ruby
# Track parsing performance
Metrics.increment('email_parser.parse_attempt')
Metrics.timing('email_parser.parse_time', duration)
Metrics.increment('email_parser.cache_hit') if cached

# Monitor failures
Metrics.increment('email_parser.parse_error', tags: ["error:#{error_type}"])
```

### Alerts
- Parsing success rate < 90%
- PyCall initialization failures
- Memory usage > threshold
- Queue depth > 1000 emails

### Dashboards
- Real-time parsing metrics
- Email client distribution
- Error analysis
- Performance trends

## Rollback Strategy

1. **Feature Flag Control**
   ```ruby
   if Feature.enabled?(:email_parsing)
     email.parse!
   end
   ```

2. **Gradual Rollout**
   - Start with 10% of emails
   - Monitor metrics
   - Increase gradually
   - Full rollout at 100%

3. **Emergency Disable**
   - Feature flag instant disable
   - Skip parsing in callbacks
   - Continue email creation
   - Fix issues offline

## Dependencies

- PyCall gem (~> 1.5)
- Python 3.8+
- Talon library (1.6.0)
- Redis for caching
- Sidekiq for job processing

## Risks & Mitigations

1. **Risk**: PyCall compatibility issues
   - **Mitigation**: Thorough testing, fallback to microservice if needed

2. **Risk**: Memory leaks from Python
   - **Mitigation**: Periodic worker restarts, memory monitoring

3. **Risk**: Parsing accuracy for new formats
   - **Mitigation**: Continuous testing, regular Talon updates

4. **Risk**: Performance degradation
   - **Mitigation**: Caching, async processing, horizontal scaling

## Usage Examples

```ruby
# Access individual components
message = FrontMessage.find(id)
message.parsed_email.plain_message      # Clean reply, no quotes or signature
message.parsed_email.plain_signature    # Just the signature
message.parsed_email.html_message       # Clean HTML reply
message.parsed_email.html_signature     # HTML signature (if detected)

# Get combined content when needed
message.parsed_email.plain_message_with_signature  # Concatenated
message.parsed_email.html_message_with_signature   # Concatenated

# Flexible display
message.display_content                             # Clean content (default)
message.display_content(include_signature: true)    # With signature
message.display_content(prefer_html: true)          # Prefer HTML version

# Batch processing
FrontMessage.joins("LEFT JOIN parsed_emails ON parsed_emails.parseable_id = front_messages.id")
            .where(parsed_emails: { id: nil })
            .where(is_inbound: true, is_draft: false)
            .find_each { |msg| FrontMessageParsingJob.perform_later(msg.id) }
```

## Future Enhancements

1. **Improved HTML Support**
   - Better HTML signature extraction
   - Preserve formatting in parsed content
   - Handle complex HTML structures

2. **Machine Learning**
   - Train custom models on your email data
   - Improve accuracy for edge cases
   - Learn from manual corrections

3. **Advanced Features**
   - Thread reconstruction
   - Sentiment analysis
   - Auto-categorization
   - Language detection

4. **Integration Extensions**
   - Real-time parsing via webhooks
   - API endpoint for external access
   - Bulk import/export tools
   - Other message types (SMS, chat, etc.)

## Implementation Checklist

- [ ] PyCall environment setup complete
- [ ] Talon library integrated successfully
- [ ] Database migrations applied
- [ ] Service classes implemented
- [ ] Background jobs configured
- [ ] Caching layer operational
- [ ] Test suite comprehensive
- [ ] Monitoring dashboards live
- [ ] Documentation complete
- [ ] Team training conducted
- [ ] Gradual rollout started
- [ ] Success metrics achieved