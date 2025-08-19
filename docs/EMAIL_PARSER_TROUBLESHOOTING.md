# Email Parser Troubleshooting Guide

This guide provides solutions to common issues encountered with the email reply parser system. The parser uses PyCall to interface with Python's Talon library for advanced email parsing capabilities.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Installation Issues](#installation-issues)
- [PyCall Integration Problems](#pycall-integration-problems)
- [Talon Library Issues](#talon-library-issues)
- [Parsing Failures](#parsing-failures)
- [Performance Issues](#performance-issues)
- [Background Job Problems](#background-job-problems)
- [Database Issues](#database-issues)
- [Production Troubleshooting](#production-troubleshooting)
- [Monitoring and Alerting](#monitoring-and-alerting)

## Quick Diagnostics

### First Steps

When encountering email parser issues, start with these diagnostic commands:

```bash
# 1. Check parser status
bundle exec rake talon:status

# 2. Run functionality test
bundle exec rake talon:test

# 3. Check API health endpoint
curl -s localhost:3000/api/v1/health | jq '.email_parser'

# 4. View recent logs
tail -20 log/development.log | grep -i "talon\|email"
```

### System Information

Collect system information for troubleshooting:

```bash
# Ruby and gem versions
ruby --version
bundle exec ruby -v
bundle list | grep pycall

# Python and package versions  
python --version
python3 --version
pip list | grep -E "(talon|lxml|chardet)"

# Database status
bundle exec rails db:version
bundle exec rails runner "puts ParsedEmail.count"

# Queue status
bundle exec rails runner "puts SolidQueue::Job.where(queue_name: 'parsing').count"
```

### Health Check Details

```bash
# Detailed health check in Rails console
bundle exec rails console

# In console:
parser = TalonEmailParser.instance
health = parser.health_check
puts JSON.pretty_generate(health)

# Test basic functionality
test_email = "Reply content\n\nOn Mon, Dec 1 wrote:\n> Original"
result = parser.parse_email(test_email, format: 'text/plain')
puts result[:success] ? "✓ Basic parsing works" : "✗ Parsing failed: #{result[:error]}"
```

## Installation Issues

### PyCall Gem Installation

**Problem**: PyCall gem fails to install

```bash
# Error messages:
# - "cannot load such file -- pycall"
# - "Failed to build gem native extension"
# - "Python.h: No such file or directory"
```

**Solutions**:

```bash
# Install Python development headers
# Ubuntu/Debian:
sudo apt-get update
sudo apt-get install python3-dev python3-pip build-essential

# CentOS/RHEL:
sudo yum install python3-devel python3-pip gcc

# macOS:
brew install python
# Ensure Xcode command line tools are installed
xcode-select --install

# Reinstall PyCall
gem uninstall pycall
bundle install
```

**Alternative approach**:
```bash
# Set Python configuration explicitly
export PYTHON_CONFIG=$(which python3-config)
bundle install
```

### Python Dependencies

**Problem**: Talon library installation fails

```bash
# Error messages:
# - "No module named 'talon'"
# - "lxml installation failed"
# - "Microsoft Visual C++ 14.0 is required"
```

**Solutions**:

```bash
# Install system dependencies first
# Ubuntu/Debian:
sudo apt-get install libxml2-dev libxslt1-dev python3-lxml

# macOS:
brew install libxml2 libxslt
export CPPFLAGS=-I$(brew --prefix libxml2)/include/libxml2
export LDFLAGS=-L$(brew --prefix libxml2)/lib

# Windows (if applicable):
# Install Microsoft Visual C++ Build Tools

# Install Python packages
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

# Verify installation
python -c "import talon; print('Talon version:', talon.__version__)"
python -c "import talon.quotations; print('Quotations module available')"
```

### Docker Environment

**Problem**: Parser fails in Docker container

**Solutions**:

```dockerfile
# Ensure Dockerfile includes all dependencies
FROM ruby:3.2.2

# Install Python and system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    libxml2-dev \
    libxslt1-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies before Ruby gems
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Then install Ruby gems
COPY Gemfile Gemfile.lock ./
RUN bundle install
```

Test the Docker build:
```bash
docker build -t email-parser-test .
docker run --rm email-parser-test python3 -c "import talon; print('OK')"
```

## PyCall Integration Problems

### PyCall Not Loading

**Problem**: PyCall fails to initialize

```bash
# Error in logs:
# "uninitialized constant PyCall"
# "PyCall not available"
```

**Diagnosis**:
```bash
# Test PyCall in Rails console
bundle exec rails console
require 'pycall'
puts PyCall.import_module('sys').version
```

**Solutions**:

1. **Check PyCall installation**:
   ```bash
   bundle list | grep pycall
   # Should show: * pycall (1.5.x)
   
   # If missing:
   bundle add pycall
   bundle install
   ```

2. **Python path issues**:
   ```bash
   # Check Python paths
   bundle exec rails runner "puts PyCall.import_module('sys').path"
   
   # Set PYTHONPATH if needed
   export PYTHONPATH="/usr/local/lib/python3.x/site-packages:$PYTHONPATH"
   ```

3. **Restart Rails server**:
   ```bash
   # PyCall initialization happens at startup
   pkill -f "rails server"
   bundle exec rails server
   ```

### Python Version Conflicts

**Problem**: Multiple Python versions causing conflicts

**Diagnosis**:
```bash
# Check which Python PyCall is using
bundle exec rails runner "puts PyCall.import_module('sys').executable"

# Compare with system Python
which python
which python3
```

**Solutions**:

1. **Set specific Python version**:
   ```bash
   # In environment or initializer
   export PYCALL_PYTHON_BIN="/usr/bin/python3.9"
   
   # Or in config/initializers/pycall.rb:
   PyCall.init(python: '/usr/bin/python3.9')
   ```

2. **Virtual environment approach**:
   ```bash
   # Create dedicated Python environment
   python3 -m venv venv/email_parser
   source venv/email_parser/bin/activate
   pip install -r requirements.txt
   
   # Point PyCall to virtual environment
   export PYCALL_PYTHON_BIN="$(pwd)/venv/email_parser/bin/python"
   ```

## Talon Library Issues

### Talon Import Failures

**Problem**: Cannot import Talon modules

```bash
# Error messages:
# "Failed to import Talon modules"
# "No module named 'talon.quotations'"
# "No module named 'talon.signature'"
```

**Diagnosis**:
```bash
# Test direct Python import
python -c "import talon"
python -c "import talon.quotations"
python -c "import talon.signature"

# Check via PyCall
bundle exec rails runner "
  talon = PyCall.import_module('talon')
  puts talon.__version__
  puts PyCall.import_module('talon.quotations')
"
```

**Solutions**:

1. **Reinstall Talon**:
   ```bash
   pip uninstall talon
   pip install talon==1.4.4
   
   # Verify installation
   python -c "import talon; print(f'Version: {talon.__version__}')"
   ```

2. **Install specific version**:
   ```bash
   # If latest version has issues
   pip install talon==1.4.4
   
   # Update requirements.txt
   echo "talon==1.4.4" > requirements.txt
   ```

3. **Missing signature module**:
   ```bash
   # Signature extraction is optional
   # Check if basic parsing works without it
   bundle exec rails runner "
     parser = TalonEmailParser.instance
     puts parser.health_check[:capabilities]
   "
   
   # Expected: signature_extraction may be false, but basic parsing should work
   ```

### Talon Version Incompatibility

**Problem**: Newer Talon version breaks compatibility

**Solutions**:

1. **Pin to tested version**:
   ```bash
   # Update requirements.txt
   talon==1.4.4
   lxml==4.9.3
   chardet==5.2.0
   
   pip install -r requirements.txt
   ```

2. **Test compatibility**:
   ```bash
   # Test with specific version
   bundle exec rake talon:test
   
   # If issues, check Talon changelog
   pip show talon
   ```

## Parsing Failures

### Content Not Being Parsed

**Problem**: Parser returns original content unchanged

**Diagnosis**:
```bash
# Test with simple example
bundle exec rails console

test_email = <<~EMAIL
Reply content here.

On Mon, Dec 1, 2024 at 10:00 AM, Original Sender wrote:
> Original message content
EMAIL

parser = TalonEmailParser.instance
result = parser.parse_email(test_email, format: 'text/plain')
puts "Success: #{result[:success]}"
puts "Reply: '#{result[:data][:reply_text]}'" if result[:success]
```

**Common Causes and Solutions**:

1. **Content format not recognized**:
   ```ruby
   # Try different formats
   result = parser.parse_email(content, format: 'text/html')
   result = parser.parse_email(content, format: 'both')
   ```

2. **Talon not recognizing quote patterns**:
   ```ruby
   # Check what Talon sees
   talon = PyCall.import_module('talon')
   raw_result = talon.quotations.extract_from(test_email)
   puts "Raw Talon result: '#{raw_result}'"
   ```

3. **Content too short or simple**:
   ```ruby
   # Talon may not process very short emails
   # This is expected behavior - short emails often don't have quotes
   ```

### Signature Detection Issues

**Problem**: Signatures not being detected or removed

**Diagnosis**:
```bash
# Test signature detection specifically
bundle exec rails console

email_with_sig = <<~EMAIL
Thanks for your message.

Best regards,
John Smith
Senior Developer
john@company.com
(555) 123-4567
EMAIL

parser = TalonEmailParser.instance
result = parser.parse_email(email_with_sig, format: 'text/plain')
puts "Has signature: #{result[:data][:has_signature]}"
puts "Signature: '#{result[:data][:signature]}'"
puts "Clean reply: '#{result[:data][:clean_reply]}'"
```

**Solutions**:

1. **Signature module unavailable**:
   ```ruby
   # Check if signature module loaded
   health = parser.health_check
   puts health[:signature_extraction]
   
   # If false, basic parsing still works but no signature extraction
   ```

2. **Signature patterns not recognized**:
   ```ruby
   # Talon signature detection has limitations
   # Consider implementing custom signature patterns
   def custom_signature_removal(text)
     # Remove common signature patterns
     patterns = [
       /\n--\n.*/m,                    # Standard email signature
       /\nBest regards,?\n.*/mi,       # "Best regards" signatures
       /\nThanks,?\n[^\n]*\n.*/mi,     # "Thanks" signatures
       /\n\([0-9]{3}\) [0-9-]+/m       # Phone numbers
     ]
     
     patterns.each { |pattern| text = text.gsub(pattern, '') }
     text.strip
   end
   ```

### Unicode and Encoding Issues

**Problem**: Parsing fails with unicode content or encoding errors

**Diagnosis**:
```bash
# Check content encoding
bundle exec rails console

content = "Reply with émojis 🎉 and unicode"
puts content.encoding
puts content.valid_encoding?

result = parser.parse_email(content, format: 'text/plain')
puts result[:success] ? "OK" : result[:error]
```

**Solutions**:

1. **Force UTF-8 encoding**:
   ```ruby
   def safe_parse_email(content, format: 'text/plain')
     # Ensure UTF-8 encoding
     content = content.force_encoding('UTF-8') unless content.encoding == Encoding::UTF_8
     
     # Validate encoding
     unless content.valid_encoding?
       content = content.encode('UTF-8', invalid: :replace, undef: :replace)
     end
     
     parser.parse_email(content, format: format)
   end
   ```

2. **Handle encoding in models**:
   ```ruby
   class FrontMessage < ApplicationRecord
     before_save :ensure_utf8_encoding
     
     private
     
     def ensure_utf8_encoding
       self.body_plain = ensure_utf8(body_plain) if body_plain
       self.body_html = ensure_utf8(body_html) if body_html
     end
     
     def ensure_utf8(text)
       return text if text.nil? || text.encoding == Encoding::UTF_8
       text.force_encoding('UTF-8').valid_encoding? ? text : text.encode('UTF-8', invalid: :replace, undef: :replace)
     end
   end
   ```

## Performance Issues

### Slow Parsing Performance

**Problem**: Email parsing takes too long

**Diagnosis**:
```bash
# Benchmark parsing performance
bundle exec rake talon:benchmark

# Test with various content sizes
bundle exec rails console

# Time individual parsing
require 'benchmark'

small_email = "Short reply\n\nOn wrote:\n> Original"
large_email = File.read('test/fixtures/emails/large_email.txt') # If available

parser = TalonEmailParser.instance

small_time = Benchmark.measure { parser.parse_email(small_email) }
puts "Small email: #{small_time.real}s"

large_time = Benchmark.measure { parser.parse_email(large_email) }
puts "Large email: #{large_time.real}s"
```

**Solutions**:

1. **Content size limits**:
   ```ruby
   # Add content size validation
   class EmailParseJob < ApplicationJob
     MAX_CONTENT_SIZE = 1.megabyte
     
     def perform(message_id, options = {})
       message = FrontMessage.find(message_id)
       
       total_size = [message.body_plain, message.body_html].compact.sum(&:bytesize)
       if total_size > MAX_CONTENT_SIZE
         Rails.logger.warn "Skipping large email #{message_id}: #{total_size} bytes"
         return
       end
       
       # Continue with parsing...
     end
   end
   ```

2. **Timeout configuration**:
   ```ruby
   # Add timeout to parsing
   require 'timeout'
   
   def parse_with_timeout(content, format: 'text/plain', timeout: 30)
     Timeout.timeout(timeout) do
       parser.parse_email(content, format: format)
     end
   rescue Timeout::Error
     { success: false, error: "Parsing timeout after #{timeout}s" }
   end
   ```

3. **Batch processing optimization**:
   ```bash
   # Reduce batch sizes for better performance
   rake front_message_parsing:batch BATCH_SIZE=5 MAX_MESSAGES=100
   ```

### Memory Usage Issues

**Problem**: High memory usage or memory leaks

**Diagnosis**:
```bash
# Monitor memory usage
bundle exec rails console

# Check memory before and after parsing
require 'get_process_mem'

mem_before = GetProcessMem.new.mb
parser = TalonEmailParser.instance

# Parse multiple emails
100.times do |i|
  test_email = "Reply #{i}\n\nOn wrote:\n> Original #{i}"
  parser.parse_email(test_email)
end

mem_after = GetProcessMem.new.mb
puts "Memory usage: #{mem_before}MB -> #{mem_after}MB (#{mem_after - mem_before}MB increase)"
```

**Solutions**:

1. **Force garbage collection**:
   ```ruby
   class FrontMessageParsingJob < ApplicationJob
     def perform(message_ids, batch_size: 10, **options)
       message_ids.each_slice(batch_size).with_index do |batch, index|
         process_batch(batch, options)
         
         # Force GC every few batches
         if (index + 1) % 5 == 0
           GC.start
           sleep 0.1
         end
       end
     end
   end
   ```

2. **Process worker rotation**:
   ```bash
   # Configure worker rotation in production
   # config/solid_queue.yml
   production:
     workers:
       - queues: "parsing"
         threads: 2
         max_requests: 1000  # Restart worker after 1000 jobs
   ```

3. **Memory monitoring**:
   ```ruby
   # Add memory monitoring to jobs
   class EmailParseJob < ApplicationJob
     around_perform do |job, block|
       mem_before = `ps -o rss= -p #{Process.pid}`.to_i
       block.call
       mem_after = `ps -o rss= -p #{Process.pid}`.to_i
       
       if mem_after - mem_before > 50_000  # 50MB increase
         Rails.logger.warn "High memory usage in parsing: #{mem_after - mem_before}KB"
       end
     end
   end
   ```

## Background Job Problems

### Jobs Not Processing

**Problem**: Email parsing jobs are queued but not processing

**Diagnosis**:
```bash
# Check job queue status
bundle exec rails console

# Count jobs by status
puts "Pending: #{SolidQueue::Job.where(queue_name: 'parsing', finished_at: nil).count}"
puts "Failed: #{SolidQueue::Job.where(queue_name: 'parsing').where.not(failed_at: nil).count}"
puts "Completed: #{SolidQueue::Job.where(queue_name: 'parsing').where.not(finished_at: nil).count}"

# Check workers
SolidQueue::Process.all.each do |process|
  puts "Worker #{process.id}: #{process.kind} (#{process.hostname})"
end
```

**Solutions**:

1. **Start SolidQueue workers**:
   ```bash
   # Start workers manually
   bundle exec rails solid_queue:start
   
   # Check worker processes
   ps aux | grep solid_queue
   ```

2. **Check queue configuration**:
   ```ruby
   # Verify queue configuration in config/queue.yml
   development:
     workers:
       - queues: "parsing_priority,parsing,default"
         threads: 2
   ```

3. **Restart workers**:
   ```bash
   # Stop existing workers
   pkill -f solid_queue
   
   # Start fresh workers
   bundle exec rails solid_queue:start -d
   ```

### Job Failures and Retries

**Problem**: Jobs failing repeatedly

**Diagnosis**:
```bash
# Check failed jobs
bundle exec rails console

failed_jobs = SolidQueue::Job.where(queue_name: 'parsing')
                             .where.not(failed_at: nil)
                             .includes(:failed_execution)

failed_jobs.each do |job|
  puts "Job #{job.id}: #{job.failed_execution&.error}"
end
```

**Solutions**:

1. **Adjust retry configuration**:
   ```ruby
   class EmailParseJob < ApplicationJob
     # More aggressive retry for parsing errors
     retry_on TalonEmailParser::ParseError, 
              wait: :exponentially_longer, 
              attempts: 10,
              jitter: 0.15
     
     # Quick retry for temporary errors
     retry_on StandardError,
              wait: 5.seconds,
              attempts: 3
   end
   ```

2. **Manual retry of failed jobs**:
   ```bash
   # Retry failed parsing jobs
   bundle exec rails console
   
   SolidQueue::Job.where(queue_name: 'parsing')
                  .where.not(failed_at: nil)
                  .find_each(&:retry)
   ```

3. **Skip problematic messages**:
   ```ruby
   # Add job filtering for known problematic content
   class EmailParseJob < ApplicationJob
     def perform(message_id, options = {})
       message = FrontMessage.find(message_id)
       
       # Skip if content has known issues
       if skip_parsing?(message)
         Rails.logger.info "Skipping parsing for message #{message_id}: #{skip_reason(message)}"
         return
       end
       
       # Continue with parsing...
     end
     
     private
     
     def skip_parsing?(message)
       # Skip very large messages
       return true if total_content_size(message) > 2.megabytes
       
       # Skip if no meaningful content
       return true if meaningful_content(message).blank?
       
       false
     end
   end
   ```

## Database Issues

### Migration Problems

**Problem**: Email parser migrations fail

**Diagnosis**:
```bash
# Check migration status
bundle exec rails db:migrate:status | grep parsed_emails

# Check for migration errors
bundle exec rails db:migrate
```

**Solutions**:

1. **UUID extension missing**:
   ```sql
   -- Connect to database directly
   psql -d bos_development
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

2. **Re-run migrations**:
   ```bash
   # Reset and re-run specific migration
   bundle exec rails db:migrate:down VERSION=20250805173050
   bundle exec rails db:migrate:up VERSION=20250805173050
   ```

3. **Manual table creation**:
   ```sql
   -- If migration completely fails, create manually
   CREATE TABLE parsed_emails (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     parseable_type VARCHAR NOT NULL,
     parseable_id UUID NOT NULL,
     plain_message TEXT,
     plain_signature TEXT,
     html_message TEXT,
     html_signature TEXT,
     parse_options JSON,
     parse_errors JSON,
     parsed_at TIMESTAMP,
     parser_version VARCHAR,
     content_hash VARCHAR,
     created_at TIMESTAMP NOT NULL,
     updated_at TIMESTAMP NOT NULL
   );
   
   CREATE INDEX index_parsed_emails_on_parseable ON parsed_emails (parseable_type, parseable_id);
   CREATE INDEX index_parsed_emails_on_content_hash ON parsed_emails (content_hash);
   ```

### Query Performance

**Problem**: Slow queries involving parsed emails

**Diagnosis**:
```sql
-- Check query performance
EXPLAIN ANALYZE SELECT * FROM front_messages 
LEFT JOIN parsed_emails ON parsed_emails.parseable_id = front_messages.id 
WHERE parsed_emails.id IS NULL 
LIMIT 100;
```

**Solutions**:

1. **Add missing indexes**:
   ```sql
   -- Add composite indexes
   CREATE INDEX idx_parsed_emails_parseable_lookup ON parsed_emails (parseable_type, parseable_id);
   CREATE INDEX idx_front_messages_parsing_status ON front_messages (is_inbound, is_draft) WHERE is_inbound = true AND is_draft = false;
   ```

2. **Optimize queries**:
   ```ruby
   # More efficient query for unparsed messages
   unparsed_messages = FrontMessage
     .where(is_inbound: true, is_draft: false)
     .where.not(id: ParsedEmail.where(parseable_type: 'FrontMessage').select(:parseable_id))
     .limit(100)
   ```

## Production Troubleshooting

### Monitoring and Alerts

Set up comprehensive monitoring:

```bash
# Health check script for monitoring
#!/bin/bash
# health_check.sh

# Check parser availability
PARSER_STATUS=$(curl -s localhost:3000/api/v1/health | jq -r '.email_parser.available')

if [ "$PARSER_STATUS" != "true" ]; then
    echo "ALERT: Email parser unavailable"
    # Send alert to monitoring system
    curl -X POST https://your-monitoring.com/alert \
         -d "service=email_parser&status=down&message=Parser unavailable"
fi

# Check queue depth
QUEUE_DEPTH=$(bundle exec rails runner "puts SolidQueue::Job.where(queue_name: 'parsing', finished_at: nil).count")

if [ "$QUEUE_DEPTH" -gt 100 ]; then
    echo "ALERT: High queue depth: $QUEUE_DEPTH"
    # Send alert
fi

# Check error rate
ERROR_RATE=$(bundle exec rails runner "
  total = ParsedEmail.where('created_at > ?', 1.hour.ago).count
  errors = ParsedEmail.with_errors.where('created_at > ?', 1.hour.ago).count
  puts total > 0 ? (errors.to_f / total * 100).round(2) : 0
")

if (( $(echo "$ERROR_RATE > 10" | bc -l) )); then
    echo "ALERT: High error rate: $ERROR_RATE%"
fi
```

### Log Analysis

Set up log monitoring:

```bash
# Monitor parsing errors
tail -f log/production.log | grep -E "(TalonEmailParser|EmailParseJob|email.parsing)" --line-buffered

# Count error patterns
grep -E "TalonEmailParser.*error" log/production.log | \
    sed 's/.*error: //' | \
    sort | uniq -c | sort -nr

# Monitor performance
grep "EmailParseJob.*completed" log/production.log | \
    grep -o "in [0-9.]*ms" | \
    sed 's/in //' | sed 's/ms//' | \
    awk '{sum+=$1; count++} END {print "Average:", sum/count "ms"}'
```

### Performance Monitoring

```ruby
# Custom performance monitoring
class EmailParsingMonitor
  def self.collect_metrics
    stats = {
      timestamp: Time.current,
      parser_available: TalonEmailParser.instance.available?,
      queue_depth: SolidQueue::Job.where(queue_name: 'parsing', finished_at: nil).count,
      recent_parses: ParsedEmail.where('created_at > ?', 1.hour.ago).count,
      recent_errors: ParsedEmail.with_errors.where('created_at > ?', 1.hour.ago).count,
      avg_processing_time: calculate_avg_processing_time
    }
    
    # Send to monitoring service
    send_to_datadog(stats) if defined?(Datadog)
    send_to_prometheus(stats) if defined?(Prometheus)
    
    stats
  end
  
  private
  
  def self.calculate_avg_processing_time
    # Calculate from job execution times
    recent_jobs = SolidQueue::Job.where(queue_name: 'parsing')
                                 .where('finished_at > ?', 1.hour.ago)
                                 .where.not(finished_at: nil)
    
    return 0 if recent_jobs.empty?
    
    total_time = recent_jobs.sum { |job| (job.finished_at - job.created_at) * 1000 }
    (total_time / recent_jobs.count).round(2)
  end
end
```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Parser Availability**
   ```bash
   # Check every minute
   */1 * * * * curl -s localhost:3000/api/v1/health | jq -e '.email_parser.available' || alert-parser-down.sh
   ```

2. **Queue Depth**
   ```bash
   # Alert if queue backs up
   */5 * * * * [ $(rails runner "puts SolidQueue::Job.where(queue_name: 'parsing', finished_at: nil).count") -gt 50 ] && alert-queue-backlog.sh
   ```

3. **Error Rates**
   ```bash
   # Check error rate every 15 minutes
   */15 * * * * /path/to/check-error-rate.sh
   ```

4. **Processing Performance**
   ```bash
   # Monitor average processing time
   0 * * * * bundle exec rake front_message_parsing:performance_report | parse-performance-metrics.sh
   ```

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Parser Availability | N/A | Down | Restart application |
| Queue Depth | >50 | >100 | Scale workers |
| Error Rate | >5% | >15% | Investigation needed |
| Avg Processing Time | >500ms | >1000ms | Performance optimization |
| Memory Usage | >1GB | >2GB | Worker restart |

### Automated Recovery

```bash
#!/bin/bash
# automated_recovery.sh

# Check parser status
PARSER_DOWN=$(curl -s localhost:3000/api/v1/health | jq -r '.email_parser.available == false')

if [ "$PARSER_DOWN" = "true" ]; then
    echo "Parser down, attempting recovery..."
    
    # Try restarting workers first
    pkill -f solid_queue
    sleep 5
    bundle exec rails solid_queue:start -d
    
    sleep 30
    
    # Check if recovery worked
    STILL_DOWN=$(curl -s localhost:3000/api/v1/health | jq -r '.email_parser.available == false')
    
    if [ "$STILL_DOWN" = "true" ]; then
        echo "Worker restart failed, restarting application..."
        # Restart entire application (implementation depends on deployment)
        sudo systemctl restart your-app-service
    fi
fi
```

### Support Escalation

When issues persist after troubleshooting:

1. **Collect diagnostic information**:
   ```bash
   # Create support bundle
   mkdir -p support_bundle/$(date +%Y%m%d_%H%M%S)
   cd support_bundle/$(date +%Y%m%d_%H%M%S)
   
   # System information
   ruby --version > system_info.txt
   python --version >> system_info.txt
   bundle list | grep pycall >> system_info.txt
   pip list | grep -E "(talon|lxml)" >> system_info.txt
   
   # Parser status
   bundle exec rake talon:status > parser_status.txt
   
   # Recent logs
   tail -1000 ../../log/production.log | grep -E "(TalonEmailParser|EmailParseJob)" > parser_logs.txt
   
   # Database status
   bundle exec rails runner "
     puts 'Total FrontMessages: ' + FrontMessage.count.to_s
     puts 'Parsed emails: ' + ParsedEmail.count.to_s
     puts 'Recent errors: ' + ParsedEmail.with_errors.where('created_at > ?', 24.hours.ago).count.to_s
   " > database_status.txt
   ```

2. **Document the issue**:
   - Exact error messages
   - Steps to reproduce
   - System configuration
   - Recent changes
   - Impact on users

3. **Contact support channels**:
   - Internal development team
   - PyCall gem maintainers (for PyCall issues)
   - Talon library maintainers (for Talon issues)

---

*This troubleshooting guide covers the most common issues with the email parser system. For additional help, refer to the [EMAIL_PARSER_API.md](EMAIL_PARSER_API.md) for detailed API documentation and [EMAIL_PARSER_SETUP.md](EMAIL_PARSER_SETUP.md) for setup instructions.*