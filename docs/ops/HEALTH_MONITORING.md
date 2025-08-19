# Health Monitoring & Troubleshooting Guide
## BOS Application Operational Health

**Version:** 1.0  
**Date:** 2025-07-27  
**Scope:** Production, Staging, Development Monitoring  

---

## 🎯 Health Monitoring Overview

Comprehensive health monitoring for the BOS application's refactored generator system, covering real-time health checks, performance monitoring, and operational troubleshooting.

## 🏥 Health Check Endpoints

### Primary Health Endpoint
**URL:** `/api/v1/health`  
**Method:** GET  
**Authentication:** None required  

#### Healthy Response
```json
{
  "status": "ok",
  "timestamp": "2025-07-27T10:30:00Z",
  "rails_version": "8.0.0",
  "database": "connected"
}
```

#### Health Check Validation
```bash
# Basic health check
curl -X GET https://your-domain/api/v1/health

# Expected 200 OK response with status: "ok"
# Database: "connected"
# Rails version and timestamp included
```

### Development Debug Endpoint
**URL:** `/api/v1/health/csrf_test` (Development only)  
**Purpose:** CSRF token distribution testing  

#### Usage
```bash
# Development environment only
curl -X GET http://localhost:3000/api/v1/health/csrf_test

# Returns detailed authentication state
```

## 📊 Service Architecture Health

### Core Services Monitoring

#### ZeroSchemaGenerator Service Health
```bash
# Validate generator system
bundle exec rails runner "
  result = ZeroSchemaGenerator.validate_schema
  puts 'Generator Health: ' + (result[:valid] ? 'HEALTHY' : 'UNHEALTHY')
  puts 'Table Count: ' + result[:stats][:table_count].to_s
  puts 'Relationships: ' + result[:stats][:relationship_count].to_s
"

# Expected output:
# Generator Health: HEALTHY
# Table Count: 14
# Relationships: 12
```

#### Database Health Monitoring
```bash
# Database connection verification
bundle exec rails runner "
  puts 'Database Active: ' + ActiveRecord::Base.connection.active?.to_s
  puts 'Connection Pool: ' + ActiveRecord::Base.connection_pool.stat.inspect
"

# Monitor connection pool utilization
bundle exec rails runner "
  pool = ActiveRecord::Base.connection_pool
  puts 'Pool Size: ' + pool.size.to_s + '/' + pool.spec.config[:pool].to_s
  puts 'Available: ' + pool.available.to_s
  puts 'Active: ' + (pool.size - pool.available).to_s
"
```

#### Queue System Health
```bash
# Solid Queue monitoring
bundle exec rails runner "
  puts 'Total Jobs: ' + Solid::Queue::Job.count.to_s
  puts 'Failed Jobs: ' + Solid::Queue::Job.failed.count.to_s
  puts 'Pending Jobs: ' + Solid::Queue::Job.pending.count.to_s
"

# Queue worker status
bundle exec rails runner "
  puts 'Queue Processes: ' + Solid::Queue::Process.count.to_s
"
```

### Frontend Service Health

#### Build System Validation
```bash
# Frontend build verification
cd frontend

# Type checking
npm run check
echo "TypeScript Health: $?"

# Linting validation  
npm run lint
echo "ESLint Health: $?"

# Prettier formatting check
npm run format
echo "Prettier Health: $?"
```

#### Generated Files Validation
```bash
# Verify generated schema files exist and are valid
test -f frontend/src/lib/zero/generated-schema.ts
echo "Generated Schema: $?"

test -f frontend/src/lib/types/generated.ts  
echo "Generated Types: $?"

# TypeScript compilation test
cd frontend && npx tsc --noEmit
echo "TypeScript Compilation: $?"
```

## 🚨 Alert Thresholds & Monitoring

### Critical Health Indicators

#### Database Health Thresholds
- **Connection Pool Utilization:** > 80% (Warning), > 95% (Critical)
- **Query Response Time:** > 100ms average (Warning), > 500ms (Critical)
- **Failed Connections:** > 5 per minute (Warning), > 20 per minute (Critical)

#### Queue Health Thresholds
- **Failed Jobs:** > 10 (Warning), > 50 (Critical)
- **Queue Lag:** > 60 seconds (Warning), > 300 seconds (Critical)
- **Dead Jobs:** > 5 (Warning), > 20 (Critical)

#### Application Health Thresholds
- **Response Time:** > 200ms (Warning), > 1000ms (Critical)
- **Error Rate:** > 1% (Warning), > 5% (Critical)
- **Memory Usage:** > 80% (Warning), > 95% (Critical)

### Monitoring Commands

#### Comprehensive Health Check Script
```bash
#!/bin/bash
# health_check.sh - Comprehensive application health monitoring

echo "=== BOS Application Health Check ==="
echo "Timestamp: $(date -Iseconds)"
echo

# Health endpoint check
echo "--- API Health Endpoint ---"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\nResponse Time: %{time_total}s\n" \
  https://your-domain/api/v1/health

# Database health
echo "--- Database Health ---"
bundle exec rails runner "
  puts 'Database Connection: ' + (ActiveRecord::Base.connection.active? ? 'OK' : 'FAILED')
  pool = ActiveRecord::Base.connection_pool
  puts 'Pool Utilization: ' + ((pool.size - pool.available) * 100 / pool.size).to_s + '%'
"

# Queue health
echo "--- Queue System Health ---"
bundle exec rails runner "
  total = Solid::Queue::Job.count
  failed = Solid::Queue::Job.failed.count
  puts 'Total Jobs: ' + total.to_s
  puts 'Failed Jobs: ' + failed.to_s
  puts 'Failure Rate: ' + (total > 0 ? (failed * 100 / total).to_s : '0') + '%'
"

# Generator health
echo "--- Generator System Health ---"
bundle exec rails runner "
  result = ZeroSchemaGenerator.validate_schema
  puts 'Generator Status: ' + (result[:valid] ? 'HEALTHY' : 'UNHEALTHY')
  puts 'Schema Tables: ' + result[:stats][:table_count].to_s
"

echo "=== Health Check Complete ==="
```

#### Performance Monitoring Script
```bash
#!/bin/bash
# performance_monitor.sh - Performance metrics collection

echo "=== BOS Performance Metrics ==="

# Memory usage
echo "--- Memory Usage ---"
free -h

# Disk usage  
echo "--- Disk Usage ---"
df -h

# Process monitoring
echo "--- Rails Processes ---"
ps aux | grep rails | grep -v grep

# Container stats (if using Docker)
echo "--- Container Resources ---"
docker stats --no-stream bos 2>/dev/null || echo "Not running in container"

echo "=== Performance Monitoring Complete ==="
```

## 🔧 Troubleshooting Procedures

### Common Issues & Solutions

#### Generator System Issues

**Issue:** Schema generation fails
```bash
# Diagnosis
bundle exec rails runner "puts ZeroSchemaGenerator.validate_schema.inspect"

# Solution steps
1. Check database connectivity
2. Verify configuration file syntax
3. Ensure output directories exist
4. Check file permissions
```

**Issue:** Generated files have TypeScript errors
```bash
# Diagnosis
cd frontend && npm run check

# Solution steps  
1. Regenerate schema files
2. Check for database schema changes
3. Verify type mappings in configuration
4. Update custom type definitions
```

#### Database Connectivity Issues

**Issue:** Database connection failures
```bash
# Diagnosis
bundle exec rails runner "puts ActiveRecord::Base.connection.active?"

# Solution steps
1. Check database server status
2. Verify connection string
3. Check network connectivity
4. Review connection pool settings
```

**Issue:** Connection pool exhaustion
```bash
# Diagnosis
bundle exec rails runner "puts ActiveRecord::Base.connection_pool.stat"

# Solution steps
1. Increase pool size in database.yml
2. Check for connection leaks
3. Monitor long-running queries
4. Consider connection pooling optimization
```

#### Queue System Issues

**Issue:** Jobs backing up in queue
```bash
# Diagnosis
bundle exec rails runner "puts Solid::Queue::Job.pending.count"

# Solution steps
1. Check worker processes
2. Increase job concurrency
3. Identify slow jobs
4. Scale worker capacity
```

**Issue:** High job failure rate
```bash
# Diagnosis
bundle exec rails runner "puts Solid::Queue::Job.failed.pluck(:error_message).uniq"

# Solution steps
1. Review error messages
2. Check external service dependencies  
3. Verify job parameters
4. Implement error handling improvements
```

#### Frontend Build Issues

**Issue:** Build process fails
```bash
# Diagnosis
cd frontend && npm run build

# Solution steps
1. Clear node_modules and reinstall
2. Check for TypeScript errors
3. Verify generated file integrity
4. Update dependencies if needed
```

**Issue:** Prettier formatting conflicts
```bash
# Diagnosis
cd frontend && npm run format

# Solution steps
1. Run format fix: npm run format --fix
2. Check .prettierrc configuration
3. Verify plugin compatibility
4. Update formatting rules if needed
```

### Emergency Procedures

#### Service Recovery Checklist

**Database Recovery:**
1. Verify database server status
2. Check connection credentials
3. Restart application if needed
4. Monitor connection pool recovery

**Queue Recovery:**  
1. Check queue worker processes
2. Restart job processing if needed
3. Clear failed jobs if appropriate
4. Monitor queue processing resumption

**Application Recovery:**
1. Check application logs for errors
2. Verify environment variables
3. Restart application services
4. Validate health endpoints

#### Rollback Procedures

**Configuration Rollback:**
```bash
# Rollback configuration changes
git checkout HEAD~1 config/
kamal deploy

# Verify rollback success
curl -X GET https://your-domain/api/v1/health
```

**Schema Rollback:**
```bash
# Rollback to previous schema version
bundle exec rails db:rollback

# Regenerate schema files
bundle exec rails runner "ZeroSchemaGenerator.generate_schema"
```

## 📈 Performance Optimization

### Database Performance

#### Query Optimization
```bash
# Monitor slow queries
bundle exec rails runner "
  ActiveRecord::Base.logger = Logger.new(STDOUT)
  ActiveRecord::Base.logger.level = Logger::DEBUG
"

# Index optimization
bundle exec rails runner "
  puts 'Missing indexes:'
  # Add custom index analysis
"
```

#### Connection Pool Tuning
```ruby
# config/database.yml optimization
production:
  pool: <%= ENV.fetch("DB_POOL_SIZE") { 10 } %>
  checkout_timeout: 5
  reaping_frequency: 10
  dead_connection_timeout: 5
```

### Queue Performance

#### Job Processing Optimization
```bash
# Optimal concurrency settings
export JOB_CONCURRENCY=3
export WEB_CONCURRENCY=2

# Monitor job processing rates
bundle exec rails runner "
  puts 'Job processing rate: ' + Solid::Queue::Job.where('created_at > ?', 1.hour.ago).count.to_s + ' jobs/hour'
"
```

### Frontend Performance

#### Build Optimization
```bash
# Production build analysis
cd frontend
npm run build -- --analyze

# Bundle size monitoring
npm run build && ls -lh dist/
```

## 📞 Escalation & Support

### Support Contacts
- **Level 1 Support:** ops-l1@company.com
- **Level 2 Support:** ops-l2@company.com  
- **Emergency Escalation:** +1-XXX-XXX-XXXX
- **Database Team:** dba@company.com

### Escalation Triggers
- Health check failures > 5 minutes
- Database connection pool > 95% utilization
- Queue lag > 10 minutes
- Error rate > 10%

### Documentation Updates
- Update this guide with new issues and solutions
- Document configuration changes
- Share troubleshooting experiences with team

---

**Last Updated:** 2025-07-27  
**Next Review:** 2025-08-27  
**Maintained By:** Ops Team