# Email Parser Setup Guide

This guide provides detailed instructions for setting up the email reply parser integration in the bŏs application. The parser uses PyCall to interface with Python's Talon library for advanced email parsing capabilities.

## Overview

The email parser system extracts clean reply content from email chains, removing quoted text and signatures. It supports:

- **Plain text and HTML parsing**
- **Signature detection and extraction**
- **Multiple email client formats** (Gmail, Outlook, Apple Mail, Thunderbird)
- **Background processing** with SolidQueue
- **Polymorphic storage** with ParsedEmail model
- **Comprehensive monitoring** and health checks

## System Requirements

### Required Components

| Component | Version | Purpose |
|-----------|---------|---------|
| Ruby | 3.2.2+ | Rails application runtime |
| Python | 3.8+ | Talon library execution |
| PostgreSQL | 13+ | Primary database with UUID support |
| Redis | 6.0+ | Caching (optional but recommended) |
| PyCall gem | ~1.5 | Ruby-Python integration |
| Talon library | 1.4.4+ | Email parsing engine |

### Development Environment

```bash
# Check Ruby version
ruby --version
# Should show: ruby 3.2.2 or higher

# Check Python version
python --version
# Should show: Python 3.8.0 or higher

# Check PostgreSQL
psql --version
# Should show: psql (PostgreSQL) 13.0 or higher
```

## Installation Steps

### 1. Install Python Dependencies

#### Option A: Using pip (Recommended)
```bash
# Install from requirements.txt
pip install -r requirements.txt

# Verify installation
python -c "import talon; print(f'Talon version: {talon.__version__}')"
```

#### Option B: Manual Installation
```bash
# Install Talon and dependencies
pip install talon==1.4.4
pip install lxml chardet cchardet
pip install scikit-learn scipy  # Optional ML dependencies

# Verify installation
python -c "import talon.quotations; print('Talon quotations available')"
python -c "import talon.signature; print('Talon signature available')"
```

### 2. Configure PyCall Integration

The PyCall configuration is already set up in `config/initializers/pycall.rb`. Verify it works:

```bash
# Test PyCall integration
bundle exec rails console

# In Rails console:
require 'pycall'
talon = PyCall.import_module('talon')
puts talon.__version__
```

### 3. Database Configuration

#### Run Migrations
```bash
# Apply email parser migrations
rails db:migrate

# Verify parsed_emails table exists
rails db:schema:dump | grep parsed_emails
```

#### Verify Database Schema
The `parsed_emails` table should have these columns:
- `id` (uuid, primary key)
- `parseable_type` (string, polymorphic)
- `parseable_id` (uuid, polymorphic)
- `plain_message` (text)
- `plain_signature` (text)
- `html_message` (text)
- `html_signature` (text)
- `parse_options` (json)
- `parse_errors` (json)
- `parsed_at` (timestamp)
- `parser_version` (string)
- `content_hash` (string)

### 4. Environment Variables

Create or update your `.env` file:

```bash
# Email Parser Configuration (optional)
EMAIL_PARSER_ENABLED=true
EMAIL_PARSER_BATCH_SIZE=10
EMAIL_PARSER_MAX_CONTENT_SIZE=1048576  # 1MB limit
EMAIL_PARSER_QUEUE_PRIORITY=70

# Redis Configuration (for caching)
REDIS_URL=redis://localhost:6379/0
```

### 5. Queue Configuration

Ensure SolidQueue is configured with email parsing queues in `config/queue.yml`:

```yaml
production:
  dispatchers:
    - polling_interval: 1
      batch_size: 500
  workers:
    - queues: "*"
      threads: 3
      processes: 5
  
development:
  dispatchers:
    - polling_interval: 1
  workers:
    - queues: "parsing_priority,parsing,default"
      threads: 2
      processes: 2
```

## Docker Setup

### Dockerfile Configuration

The Dockerfile includes Python support:

```dockerfile
# Python installation and dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    libxml2-dev \
    libxslt1-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt /app/
RUN pip3 install -r requirements.txt
```

### Docker Compose Setup

```yaml
version: '3.8'
services:
  app:
    build: .
    environment:
      - RAILS_ENV=development
      - EMAIL_PARSER_ENABLED=true
    depends_on:
      - db
      - redis
    
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: bos_development
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### Building and Running

```bash
# Build Docker image
docker-compose build

# Run with email parser enabled
docker-compose up -d

# Check parser status
docker-compose exec app bundle exec rake talon:status
```

## Verification and Testing

### 1. Health Check

```bash
# Via rake task
bundle exec rake talon:status

# Expected output:
# TalonEmailParser Service Status:
# ================================
# Status: available
# Available: true
# Talon Version: 1.4.4
# Initialized: true
# 
# Capabilities:
#   Plain text: ✓
#   Html: ✓
#   Signature extraction: ✓
#   Both formats: ✓
```

### 2. Functionality Test

```bash
# Run comprehensive tests
bundle exec rake talon:test

# Test with specific message
bundle exec rake talon:test_message[message_id]

# Performance benchmark
bundle exec rake talon:benchmark
```

### 3. API Health Check

```bash
# Check via HTTP endpoint
curl -s localhost:3000/api/v1/health | jq '.email_parser'

# Expected response:
# {
#   "service": "EmailReplyParserService",
#   "available": true,
#   "talon_status": "available",
#   "advanced_parser": {
#     "status": "available",
#     "capabilities": {
#       "plain_text": true,
#       "html": true,
#       "signature_extraction": true
#     }
#   }
# }
```

### 4. Integration Test

```bash
# Test email parsing in Rails console
bundle exec rails console

# In console:
parser = TalonEmailParser.instance
test_email = "Thanks for your help!\n\nBest regards,\nJohn\n\nOn Mon, Dec 1 at 10:00 AM, Jane wrote:\n> Original message"
result = parser.parse_email(test_email, format: 'text/plain')
puts result[:data][:clean_reply]  # Should show: "Thanks for your help!"
```

## Configuration Options

### Parser Settings

Configure parser behavior in `config/initializers/pycall.rb`:

```ruby
# Email parser configuration
Rails.application.configure do
  config.email_parser = ActiveSupport::OrderedOptions.new
  config.email_parser.enabled = ENV.fetch('EMAIL_PARSER_ENABLED', 'true') == 'true'
  config.email_parser.batch_size = ENV.fetch('EMAIL_PARSER_BATCH_SIZE', '10').to_i
  config.email_parser.max_content_size = ENV.fetch('EMAIL_PARSER_MAX_CONTENT_SIZE', '1048576').to_i
  config.email_parser.queue_priority = ENV.fetch('EMAIL_PARSER_QUEUE_PRIORITY', '70').to_i
end
```

### Background Job Configuration

Configure job processing in your initializers:

```ruby
# config/initializers/solid_queue.rb
Rails.application.configure do
  config.solid_queue.connects_to = {
    database: { writing: :primary, reading: :primary }
  }
  
  # Email parsing job configuration
  config.solid_queue.recurring_schedule = {
    "email_parser_health_check" => {
      "every" => "5 minutes",
      "job" => "EmailParsingHealthCheckJob"
    }
  }
end
```

## Monitoring and Maintenance

### Health Monitoring

Set up regular health checks:

```bash
# Add to cron for production monitoring
# Check every 5 minutes
*/5 * * * * /path/to/app/bin/bundle exec rake talon:status >> /var/log/email_parser_health.log 2>&1
```

### Log Analysis

Monitor parser activity:

```bash
# View parsing logs
tail -f log/development.log | grep "TalonEmailParser"

# Check error patterns
grep -i "email.parsing.error" log/production.log | tail -20
```

### Performance Monitoring

Track parsing performance:

```bash
# View processing statistics
bundle exec rake front_message_parsing:performance_report

# Monitor queue depth
bundle exec rails console
SolidQueue::Job.where(queue_name: 'parsing').count
```

## Troubleshooting

### Common Issues

#### 1. PyCall Import Errors
```bash
# Error: cannot load such file -- pycall
gem install pycall
bundle install

# Error: Python module not found
pip install talon
python -c "import talon"
```

#### 2. Talon Installation Issues
```bash
# Install required system packages
# Ubuntu/Debian:
sudo apt-get install python3-dev libxml2-dev libxslt1-dev

# macOS:
brew install libxml2 libxslt
export CPPFLAGS=-I/usr/local/opt/libxml2/include/libxml2
pip install lxml
```

#### 3. Database Connection Issues
```bash
# Check database configuration
rails db:version

# Run pending migrations
rails db:migrate

# Verify parsed_emails table
rails db:schema:dump | grep parsed_emails
```

#### 4. Queue Processing Issues
```bash
# Check SolidQueue status
bundle exec rails solid_queue:start

# Monitor job processing
bundle exec rails console
SolidQueue::Job.where(queue_name: 'parsing', finished_at: nil).count
```

### Debug Information

#### Collect System Information
```bash
# System versions
ruby --version
python --version
bundle exec rails --version

# Gem versions
bundle list | grep pycall

# Python packages
pip list | grep -E "(talon|lxml|chardet)"

# Database status
rails db:version
psql -d bos_development -c "SELECT COUNT(*) FROM parsed_emails;"
```

#### Test Parser Components
```bash
# Test PyCall
bundle exec rails runner "puts PyCall.import_module('sys').version"

# Test Talon
bundle exec rails runner "puts PyCall.import_module('talon').__version__"

# Test parser service
bundle exec rails runner "puts TalonEmailParser.instance.health_check"
```

## Performance Optimization

### Batch Processing

Optimize for large email volumes:

```bash
# Process in batches
bundle exec rake front_message_parsing:batch BATCH_SIZE=20 MAX_MESSAGES=1000

# Monitor performance
bundle exec rake front_message_parsing:performance_report
```

### Memory Management

Configure for optimal memory usage:

```ruby
# config/initializers/email_parser.rb
Rails.application.configure do
  config.email_parser.memory_management = {
    gc_frequency: 50,      # Force GC every 50 processed emails
    max_batch_size: 100,   # Maximum emails per batch
    pause_between_batches: 0.1  # Seconds to pause between batches
  }
end
```

### Caching Configuration

Enable result caching:

```ruby
# config/initializers/cache_store.rb
Rails.application.configure do
  config.cache_store = :redis_cache_store, {
    url: ENV['REDIS_URL'],
    namespace: 'email_parser',
    expires_in: 1.hour
  }
end
```

## Security Considerations

### Input Validation

The parser includes security measures:

- **Content size limits**: Maximum 1MB per email
- **Character encoding validation**: UTF-8 enforcement
- **Malicious content filtering**: Basic sanitization
- **Error isolation**: Prevents parsing failures from affecting other emails

### Data Protection

- **No content logging**: Email content is never logged
- **Encrypted storage**: Consider database encryption for sensitive emails
- **Access controls**: Limit parser access to authorized processes only

## Migration from Other Parsers

### From email_reply_trimmer

If migrating from `email_reply_trimmer`:

```ruby
# Old code:
EmailReplyTrimmer.trim(email_body)

# New code:
parser = TalonEmailParser.instance
result = parser.parse_email(email_body, format: 'text/plain')
result[:data][:clean_reply] if result[:success]
```

### From mail gem

If using the `mail` gem parser:

```ruby
# Old code:
mail = Mail.new(email_content)
mail.body.decoded

# New code:
message = FrontMessage.find(id)
parsed = message.parsed_email
parsed.clean_content if parsed
```

## Production Deployment

### Pre-deployment Checklist

- [ ] Python dependencies installed
- [ ] PyCall integration tested
- [ ] Database migrations applied
- [ ] Queue configuration updated
- [ ] Health checks passing
- [ ] Performance benchmarks acceptable
- [ ] Monitoring configured
- [ ] Backup procedures updated

### Deployment Commands

```bash
# Production deployment
bundle install --deployment --without development test
pip install -r requirements.txt --upgrade
rails db:migrate
rails assets:precompile

# Start background workers
bundle exec rails solid_queue:start -d

# Verify deployment
bundle exec rake talon:status
curl -s https://yourapp.com/api/v1/health | jq '.email_parser'
```

### Monitoring Setup

Configure production monitoring:

```bash
# Add to your monitoring stack
# Check parser health every minute
* * * * * curl -s https://yourapp.com/api/v1/health | jq -e '.email_parser.available' > /dev/null || alert-script.sh

# Monitor queue depth
* * * * * rails runner "puts SolidQueue::Job.where(queue_name: 'parsing').count" | check-queue-depth.sh

# Track parsing success rate
0 * * * * bundle exec rake front_message_parsing:performance_report | parse-metrics.sh
```

## Support and Maintenance

### Regular Maintenance Tasks

```bash
# Weekly maintenance
bundle exec rake front_message_parsing:clear_metrics_cache
bundle exec rake front_message_parsing:performance_report

# Monthly tasks
# Review and clean old parsed emails
rails runner "ParsedEmail.where('created_at < ?', 6.months.ago).find_in_batches(&:destroy_all)"

# Update Python dependencies
pip install --upgrade talon lxml chardet
```

### Getting Help

For issues and support:

1. **Check the logs**: `tail -f log/production.log | grep -i email`
2. **Run diagnostics**: `bundle exec rake talon:status`
3. **Review documentation**: See [EMAIL_PARSER_API.md](EMAIL_PARSER_API.md)
4. **Test with samples**: `bundle exec rake talon:test`

### Performance Tuning

Monitor and optimize performance:

- **Parser response time**: Should be < 100ms per email
- **Queue processing rate**: Target 600+ emails/hour
- **Memory usage**: Monitor for memory leaks
- **Error rates**: Keep below 5%

---

*This setup guide covers the complete installation and configuration of the email parser system. For API reference and usage examples, see [EMAIL_PARSER_API.md](EMAIL_PARSER_API.md).*