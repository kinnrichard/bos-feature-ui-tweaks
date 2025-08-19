# Configuration Management Guide
## BOS Application Operational Configuration

**Version:** 1.0  
**Date:** 2025-07-27  
**Scope:** Production, Staging, Development  

---

## 🎯 Overview

This guide covers configuration management for the BOS application's refactored generator system and operational environment setup.

## 🔧 Core Configuration Services

### ZeroSchemaGenerator Configuration

#### Primary Configuration File
**Location:** `config/zero_generator.yml`

```yaml
zero_generator:
  excluded_tables:
    - solid_cache_entries
    - solid_queue_jobs
    - solid_queue_*
    - solid_cable_messages
    - refresh_tokens
    - revoked_tokens
    - unique_ids
    - ar_internal_metadata
    - schema_migrations
    - versions
  
  type_overrides:
    "jobs.status": "string()"
    "tasks.position": "number()"
  
  field_mappings:
    "notes.notable":
      strategy: "union_types"
      types: ["job", "task", "client"]
  
  output:
    schema_file: "frontend/src/lib/zero/generated-schema.ts"
    types_file: "frontend/src/lib/types/generated.ts"
  
  preserve_customizations:
    - custom_mutations
    - manual_type_overrides
```

#### Mutation Configuration
**Location:** `config/zero_mutations.yml`

```yaml
mutation_config:
  exclude_patterns:
    versions: ["soft_deletion", "positioning"]
    schema_migrations: ["soft_deletion"]
  
  custom_naming:
    softDelete: "archive"
    restore: "unarchive"
  
  generation_settings:
    dry_run: false
    force_generation: false
    preserve_custom: true
```

### Environment-Specific Configuration

#### Development Environment
**File:** `config/environments/development.rb`

**Key Settings:**
- Auto-reloading enabled
- Detailed error reporting
- CORS enabled for frontend development
- Enhanced logging for debugging

#### Production Environment  
**File:** `config/environments/production.rb`

**Key Settings:**
- SSL enforcement with HSTS
- Optimized caching and performance
- Structured logging to STDOUT
- Security headers enabled

#### Test Environment
**File:** `config/environments/test.rb`

**Key Settings:**
- Database isolation per test
- Enhanced debugging capabilities
- Fast test execution optimizations

## 🚀 Deployment Configuration

### Kamal Deployment
**File:** `config/deploy.yml`

#### Production Settings
```yaml
service: bos
image: your-user/bos
servers:
  web:
    - 192.168.0.1

proxy:
  ssl: true
  host: app.example.com

env:
  secret:
    - RAILS_MASTER_KEY
  clear:
    SOLID_QUEUE_IN_PUMA: true
    # WEB_CONCURRENCY: 2
    # JOB_CONCURRENCY: 3

volumes:
  - "bos_storage:/rails/storage"

builder:
  arch: amd64
```

#### Development Settings
**File:** `config/deploy.development.yml`
```yaml
# Override specific settings for development deployment
proxy:
  ssl: false
  host: dev.app.example.com

env:
  clear:
    RAILS_LOG_LEVEL: debug
```

### Docker Configuration
**File:** `Dockerfile`

#### Production Optimization Features
- Multi-stage builds for minimal image size
- Ruby 3.4.4 with optimized base image
- Non-root user execution (UID/GID 1000)
- Bootsnap precompilation for faster boot times
- Asset precompilation without secrets

## 📊 Configuration Validation

### Automated Validation Commands

#### Schema Configuration Validation
```bash
# Validate schema generation configuration
bundle exec rails runner "puts ZeroSchemaGenerator.validate_schema.inspect"

# Expected output:
# {valid: true, errors: [], warnings: [], stats: {table_count: 14, relationship_count: 12, import_count: 5}}
```

#### Configuration File Validation
```bash
# Validate YAML configuration files
bundle exec rails runner "
  config = ZeroSchemaGenerator::Config.load_from_file
  puts 'Config loaded successfully: ' + config.excluded_tables.count.to_s + ' excluded tables'
"

# Generate sample configuration for reference
bundle exec rails runner "ZeroSchemaGenerator.create_sample_config"
```

#### Environment Configuration Check
```bash
# Verify environment-specific settings
bundle exec rails runner "
  puts 'Environment: ' + Rails.env
  puts 'Force SSL: ' + Rails.application.config.force_ssl.to_s
  puts 'Cache Store: ' + Rails.application.config.cache_store.first.to_s
"
```

### Manual Validation Checklist

#### Pre-Deployment Validation
- [ ] Schema generation runs without errors
- [ ] Configuration files are valid YAML
- [ ] Environment variables are properly set
- [ ] SSL certificates are configured (production)
- [ ] Database connection strings are correct
- [ ] Queue system is operational

#### Post-Deployment Validation  
- [ ] Health endpoint returns 200 OK
- [ ] Database connectivity verified
- [ ] Schema generation works in target environment
- [ ] Frontend builds successfully
- [ ] API endpoints respond correctly

## 🛡️ Security Configuration

### Environment Variables Management

#### Required Secrets
```bash
# Production secrets (via Kamal secrets)
RAILS_MASTER_KEY=<32-character-hex-key>
KAMAL_REGISTRY_PASSWORD=<registry-access-token>

# Optional performance tuning
WEB_CONCURRENCY=2
JOB_CONCURRENCY=3
DB_HOST=192.168.0.2
```

#### Security Headers Configuration
```ruby
# config/application.rb additions for security
config.force_ssl = true                    # HTTPS enforcement
config.assume_ssl = true                   # Proxy SSL termination
config.session_store :cookie_store         # Secure session management
```

### Database Security
```yaml
# config/database.yml production settings
production:
  adapter: postgresql
  encoding: unicode
  pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
  url: <%= ENV['DATABASE_URL'] %>
  
  # Security settings
  sslmode: require
  connect_timeout: 5
  checkout_timeout: 5
```

## 📈 Performance Configuration

### Caching Configuration
```ruby
# Production caching setup
config.cache_store = :solid_cache_store

# Development caching (disabled by default)
config.cache_store = :null_store
```

### Queue Configuration
```ruby
# Solid Queue configuration
config.active_job.queue_adapter = :solid_queue
config.solid_queue.connects_to = { database: { writing: :queue } }

# Performance tuning
ENV['JOB_CONCURRENCY'] = '3'      # Concurrent job processing
ENV['WEB_CONCURRENCY'] = '2'      # Puma worker processes
```

### Frontend Configuration

#### Build Configuration
**File:** `frontend/package.json`
```json
{
  "scripts": {
    "build": "vite build",
    "dev": "vite dev",
    "format": "prettier --check .",
    "lint": "eslint ."
  }
}
```

#### Prettier Integration
**File:** `frontend/.prettierrc`
```json
{
  "useTabs": true,
  "singleQuote": false,
  "trailingComma": "none",
  "printWidth": 100,
  "plugins": ["prettier-plugin-svelte"],
  "overrides": [{ "files": "*.svelte", "options": { "parser": "svelte" } }]
}
```

## 🔧 Configuration Troubleshooting

### Common Configuration Issues

#### Schema Generation Failures
**Problem:** `ZeroSchemaGenerator.generate_schema` fails
**Diagnosis:**
```bash
# Check configuration validity
bundle exec rails runner "puts ZeroSchemaGenerator::Config.load_from_file.to_hash.inspect"

# Verify database connectivity
bundle exec rails runner "puts ActiveRecord::Base.connection.active?"
```
**Solution:** Verify database connection and configuration file syntax

#### Frontend Build Failures
**Problem:** TypeScript compilation errors in generated files
**Diagnosis:**
```bash
cd frontend && npm run check
```
**Solution:** Regenerate types and check for schema changes

#### Deployment Configuration Issues
**Problem:** Kamal deployment fails
**Diagnosis:**
```bash
kamal config
```
**Solution:** Verify environment variables and server access

### Performance Tuning

#### Database Performance
```bash
# Monitor database connections
bundle exec rails runner "puts ActiveRecord::Base.connection_pool.stat.inspect"
```

#### Queue Performance
```bash
# Monitor job queue status
bundle exec rails runner "puts Solid::Queue::Job.count"
```

## 📋 Configuration Maintenance

### Regular Maintenance Tasks

#### Weekly Tasks
- [ ] Verify configuration backups
- [ ] Check for unused environment variables
- [ ] Review log levels and disk usage

#### Monthly Tasks  
- [ ] Update dependency versions
- [ ] Review security configurations
- [ ] Audit configuration changes

#### Quarterly Tasks
- [ ] Performance configuration review
- [ ] Security configuration audit
- [ ] Disaster recovery configuration test

### Configuration Change Management

#### Change Process
1. **Development**: Test configuration changes locally
2. **Staging**: Deploy to staging environment for validation
3. **Production**: Deploy with rollback plan
4. **Monitoring**: Monitor application health post-deployment

#### Rollback Procedures
```bash
# Kamal rollback to previous version
kamal rollback

# Manual configuration rollback
git checkout HEAD~1 config/
kamal deploy
```

---

## 📞 Support & Contact

**Ops Team:** ops@company.com  
**Emergency:** Use incident management system  
**Documentation:** Update this guide with any configuration changes  

**Last Updated:** 2025-07-27  
**Next Review:** 2025-08-27