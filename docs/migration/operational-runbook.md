# Migration System Operational Runbook

## Quick Reference

**Emergency Rollback**: `Zero::Generators::Migration.emergency_rollback!(reason: "INCIDENT_DETAILS")`  
**System Status**: `Zero::Generators::Migration.current_status`  
**Health Check**: `Zero::Generators::Migration.health_check`  

## On-Call Procedures

### 🚨 Critical Alerts

#### Circuit Breaker Open Alert

**Alert**: `migration_circuit_breaker_open`  
**Severity**: Critical  
**Response Time**: Immediate (< 5 minutes)

**Immediate Actions**:
1. Check system status: `rails runner "puts Zero::Generators::Migration.current_status"`
2. Review recent errors: `grep "MigrationAdapter\|Pipeline.*error" log/production.log | tail -20`
3. Determine if automatic fallback is working (should show traffic routed to legacy)

**Investigation**:
```bash
# Check circuit breaker details
rails runner "
  flags = Zero::Generators::Migration::MigrationFeatureFlags.instance
  puts 'Circuit Breaker State: #{flags.circuit_breaker_state}'
  puts 'Error Count: #{flags.configuration_summary[:error_count]}'
  puts 'Manual Override: #{flags.config.manual_override}'
"

# Check for new system errors
grep -A 5 -B 5 "New pipeline.*error\|Pipeline.*failed" log/production.log | tail -50
```

**Resolution Options**:

**Option A - Wait for Auto-Recovery** (if errors are transient):
- Monitor for automatic circuit breaker recovery (10 minutes default)
- Verify legacy system is handling all traffic properly
- Wait and observe if circuit closes automatically

**Option B - Manual Investigation** (if errors persist):
```bash
# Test new system manually to identify issues
rails runner "
  adapter = Zero::Generators::Migration.create_adapter({table: 'users'})
  result = adapter.force_execute_system(:new, bypass_circuit_breaker: true)
  puts result[:errors] if result[:errors].any?
"
```

**Option C - Emergency Rollback** (if legacy system also having issues):
```bash
rails runner "
  Zero::Generators::Migration.emergency_rollback!(
    reason: 'Circuit breaker open + legacy system issues - INCIDENT-#{Time.now.strftime(\"%Y%m%d%H%M\")}',
    operator: '$(whoami)'
  )
"
```

#### High Error Rate Alert

**Alert**: `migration_high_error_rate`  
**Severity**: Warning → Critical (if > 10%)  
**Response Time**: 15 minutes (Warning), 5 minutes (Critical)

**Investigation**:
```bash
# Check error distribution
rails runner "
  adapter = Zero::Generators::Migration.create_adapter({})
  stats = adapter.collect_service_statistics
  puts 'Legacy Errors: #{stats[:migration_adapter_stats][:errors_legacy_system]}'
  puts 'New System Errors: #{stats[:migration_adapter_stats][:errors_new_system]}'
  puts 'Fallbacks: #{stats[:migration_adapter_stats][:fallbacks_to_legacy]}'
"

# Check recent error patterns
grep "Generation.*failed\|Pipeline.*error" log/production.log | tail -30
```

**Response**:
- If errors are from new system: Monitor for circuit breaker trip
- If errors are from both systems: Investigate underlying causes (DB, network, etc.)
- If error rate > 15%: Consider emergency rollback

#### Rollback Event Alert

**Alert**: `migration_rollback_executed`  
**Severity**: Critical  
**Response Time**: Immediate (< 2 minutes)

**Immediate Actions**:
1. Acknowledge the rollback has occurred
2. Verify system is stable on legacy system
3. Identify rollback reason and triggering event

```bash
# Check rollback details
rails runner "
  manager = Zero::Generators::Migration::RollbackManager.new
  status = manager.current_status
  puts 'Rollback State: #{status[:state]}'
  puts 'Last Rollback: #{status[:last_rollback]}'
  puts 'Rollback Reason: #{status[:last_rollback][:reason] if status[:last_rollback]}'
"
```

**Post-Rollback Validation**:
```bash
# Validate legacy system is working
rails generate zero:active_models --table=users --dry-run

# Check system health
rails runner "puts Zero::Generators::Migration.health_check"
```

### ⚠️ Warning Alerts

#### Performance Degradation Alert

**Alert**: `migration_performance_regression`  
**Severity**: Warning  
**Response Time**: 30 minutes

**Investigation**:
```bash
# Check performance metrics
rails runner "
  flags = Zero::Generators::Migration::MigrationFeatureFlags.instance
  stats = flags.performance_statistics
  puts 'Legacy Avg Time: #{stats[:avg_legacy_time]}ms'
  puts 'New Avg Time: #{stats[:avg_new_time]}ms'
  puts 'New System Success Rate: #{stats[:success_rate_new]}%'
"
```

**Actions**:
- Monitor performance trends
- Consider reducing migration percentage if degradation is significant
- Plan performance investigation during business hours

#### Canary Test Discrepancies Alert

**Alert**: `migration_canary_discrepancies`  
**Severity**: Warning  
**Response Time**: 1 hour

**Investigation**:
```bash
# Check discrepancy patterns
grep "CANARY DISCREPANCY" log/production.log | tail -10

# Review comparison results
grep "OutputComparator.*discrepanc" log/production.log | tail -20
```

**Actions**:
- Review discrepancy types (critical vs cosmetic)
- If critical discrepancies: Consider pausing migration increase
- If cosmetic discrepancies: Note for business hours review

## Business Hours Procedures

### Daily Health Check (9 AM)

```bash
# Run comprehensive health check
rails runner "
  health = Zero::Generators::Migration.health_check
  puts '=== Migration System Health ==='
  puts 'Overall Health: #{health[:overall_health]}'
  puts 'Feature Flags: #{health[:component_health][:feature_flags][:status]}'
  puts 'Rollback Manager: #{health[:component_health][:rollback_manager][:status]}'
  puts
  puts '=== Current Status ==='
  status = Zero::Generators::Migration.current_status
  puts 'Migration %: #{status[:feature_flags][:new_pipeline_percentage]}%'
  puts 'Circuit Breaker: #{status[:circuit_breaker_state]}'
  puts 'Canary Testing: #{status[:feature_flags][:canary_testing_enabled]}'
  puts 'Rollbacks Today: #{status[:rollback_status][:rollback_count_today]}'
"
```

### Weekly Migration Review (Monday 10 AM)

```bash
# Generate weekly report
rails runner "
  puts '=== Weekly Migration Report ==='
  
  # Performance metrics
  stats = Zero::Generators::Migration.statistics
  perf = stats[:performance_metrics]
  puts 'Performance Metrics:'
  puts '  Legacy Avg Time: #{perf[:avg_legacy_time]}ms'
  puts '  New Avg Time: #{perf[:avg_new_time]}ms'
  puts '  Performance Delta: #{((perf[:avg_new_time] - perf[:avg_legacy_time]) / perf[:avg_legacy_time] * 100).round(1)}%'
  
  # Error rates
  puts
  puts 'Reliability Metrics:'
  puts '  New System Success Rate: #{perf[:success_rate_new]}%'
  puts '  Legacy System Success Rate: #{perf[:success_rate_legacy]}%'
  
  # Rollback history
  manager = Zero::Generators::Migration::RollbackManager.new
  recent_rollbacks = manager.rollback_history(limit: 7)
  puts
  puts 'Recent Rollbacks: #{recent_rollbacks.length}'
  recent_rollbacks.each do |rb|
    puts '  #{rb[:timestamp].strftime(\"%Y-%m-%d %H:%M\")} - #{rb[:reason]}'
  end
"
```

### Migration Percentage Updates

Before increasing migration percentage:

1. **Verify Current Stability**:
   ```bash
   # Check last 24 hours for issues
   rails runner "
     health = Zero::Generators::Migration.health_check
     exit 1 unless health[:overall_health] == :healthy
   "
   ```

2. **Plan the Increase**:
   ```bash
   # Current percentage
   rails runner "
     status = Zero::Generators::Migration.current_status
     current_pct = status[:feature_flags][:new_pipeline_percentage]
     puts 'Current: #{current_pct}%'
     puts 'Suggested next: #{[current_pct + 5, 100].min}%'
   "
   ```

3. **Update Configuration**:
   ```bash
   # Update environment variable (example for 25%)
   export MIGRATION_NEW_PIPELINE_PCT=25
   
   # Verify update
   rails runner "
     status = Zero::Generators::Migration.current_status
     puts 'Updated to: #{status[:feature_flags][:new_pipeline_percentage]}%'
   "
   ```

4. **Monitor for 4 Hours**: Watch for alerts and performance changes

## System Maintenance

### Circuit Breaker Maintenance

#### Manual Circuit Breaker Reset

**When**: After resolving new system issues and verifying fixes

```bash
# Test new system first
rails runner "
  adapter = Zero::Generators::Migration.create_adapter({table: 'test'})
  result = adapter.force_execute_system(:new, bypass_circuit_breaker: true)
  if result[:success]
    puts 'New system test: PASSED'
    flags = Zero::Generators::Migration::MigrationFeatureFlags.instance
    flags.reset_circuit_breaker!
    puts 'Circuit breaker reset: COMPLETE'
  else
    puts 'New system test: FAILED - #{result[:errors]}'
    exit 1
  end
"
```

#### Circuit Breaker Configuration Updates

```bash
# Update error threshold (example: reduce sensitivity)
rails runner "
  flags = Zero::Generators::Migration::MigrationFeatureFlags.instance
  flags.configure do |config|
    config.error_threshold = 10          # Increased from default 5
    config.error_window_seconds = 600    # Increased to 10 minutes
  end
  puts 'Circuit breaker configuration updated'
"
```

### Canary Testing Maintenance

#### Adjust Canary Sample Rate

```bash
# Reduce canary testing overhead (during high traffic)
export MIGRATION_CANARY_SAMPLE_PCT=10

# Increase for more validation (during low traffic)  
export MIGRATION_CANARY_SAMPLE_PCT=50
```

#### Review Canary Test Results

```bash
# Get detailed canary statistics
rails runner "
  flags = Zero::Generators::Migration::MigrationFeatureFlags.instance
  perf = flags.performance_statistics
  puts 'Canary Test Results:'
  puts '  Total Samples: #{perf[:total_samples]}'
  puts '  Recent Samples: #{perf[:recent_samples]}'
  puts '  Avg Canary Overhead: #{perf[:avg_canary_overhead]}ms'
"
```

### State File Maintenance

#### Backup Rollback State

```bash
# Backup current state
cp tmp/migration_rollback_state.json tmp/migration_rollback_state.backup.$(date +%Y%m%d)
```

#### Clean Old Rollback History

```bash
# Archive old rollback events (keeps last 50)
rails runner "
  manager = Zero::Generators::Migration::RollbackManager.new
  history = manager.rollback_history(limit: 1000)
  
  if history.length > 100
    puts 'Rollback history has #{history.length} entries'
    puts 'Consider archiving entries older than 30 days'
    
    old_entries = history.select { |h| h[:timestamp] < 30.days.ago }
    puts 'Found #{old_entries.length} old entries to potentially archive'
  end
"
```

## Performance Tuning

### Optimization Checklist

1. **Reduce Canary Testing Overhead**:
   - Lower `MIGRATION_CANARY_SAMPLE_PCT` during peak hours
   - Disable canary testing when migration > 90%

2. **Circuit Breaker Tuning**:
   - Adjust `error_threshold` based on normal error rates
   - Increase `error_window_seconds` for less sensitive triggering

3. **Logging Optimization**:
   - Disable `MIGRATION_DETAILED_LOGGING` in production
   - Enable only during troubleshooting

### Performance Monitoring Commands

```bash
# Check adapter execution statistics
rails runner "
  adapter = Zero::Generators::Migration.create_adapter({})
  stats = adapter.collect_service_statistics[:migration_adapter_stats]
  puts 'Total Executions: #{stats[:executions_total]}'
  puts 'Avg Legacy Time: #{stats[:avg_execution_time_legacy]}s'
  puts 'Avg New Time: #{stats[:avg_execution_time_new]}s'
  puts 'Canary Overhead: #{stats[:avg_canary_overhead]}s'
"
```

## Troubleshooting Scripts

### Diagnostic Data Collection

```bash
#!/bin/bash
# collect-migration-diagnostics.sh

echo "=== Migration System Diagnostics ==="
echo "Timestamp: $(date)"
echo

echo "=== System Status ==="
rails runner "puts Zero::Generators::Migration.current_status" 2>&1

echo
echo "=== Health Check ==="
rails runner "puts Zero::Generators::Migration.health_check" 2>&1

echo
echo "=== Recent Logs ==="
echo "Last 50 migration-related log entries:"
grep -E "Migration|Circuit|Rollback|Canary" log/production.log | tail -50

echo
echo "=== Process Information ==="
ps aux | grep rails
df -h
free -m

echo
echo "=== Network Connectivity ==="
# Add database/external service connectivity checks as needed
```

### System Recovery Script

```bash
#!/bin/bash
# recover-migration-system.sh

echo "=== Migration System Recovery ==="

# Check if system needs recovery
HEALTH_STATUS=$(rails runner "puts Zero::Generators::Migration.health_check[:overall_health]" 2>/dev/null)

if [ "$HEALTH_STATUS" = "healthy" ]; then
    echo "System is healthy, no recovery needed"
    exit 0
fi

echo "System health: $HEALTH_STATUS"
echo "Attempting recovery..."

# Step 1: Reset circuit breaker if stuck
echo "1. Checking circuit breaker..."
CB_STATE=$(rails runner "puts Zero::Generators::Migration::MigrationFeatureFlags.instance.circuit_breaker_state" 2>/dev/null)

if [ "$CB_STATE" = "open" ]; then
    echo "   Circuit breaker is open, testing system..."
    TEST_RESULT=$(rails runner "
      adapter = Zero::Generators::Migration.create_adapter({table: 'users'})
      result = adapter.force_execute_system(:new, bypass_circuit_breaker: true)
      puts result[:success]
    " 2>/dev/null)
    
    if [ "$TEST_RESULT" = "true" ]; then
        echo "   New system test passed, resetting circuit breaker..."
        rails runner "Zero::Generators::Migration::MigrationFeatureFlags.instance.reset_circuit_breaker!"
    else
        echo "   New system test failed, maintaining circuit breaker open"
    fi
fi

# Step 2: Check rollback state
echo "2. Checking rollback state..."
ROLLBACK_STATE=$(rails runner "
  manager = Zero::Generators::Migration::RollbackManager.new
  puts manager.current_state
" 2>/dev/null)

if [ "$ROLLBACK_STATE" = "rollback_failed" ]; then
    echo "   Rollback failed, attempting recovery..."
    rails runner "
      manager = Zero::Generators::Migration::RollbackManager.new
      result = manager.attempt_rollback_recovery
      puts result[:success] ? 'Recovery successful' : 'Recovery failed'
    "
fi

echo "3. Final health check..."
rails runner "puts Zero::Generators::Migration.health_check"

echo "Recovery script complete"
```

## Reference Commands

### Quick Status Commands

```bash
# One-liner health check
rails runner "h=Zero::Generators::Migration.health_check; puts \"Health: #{h[:overall_health]}, CB: #{h[:component_health][:feature_flags][:status]}\""

# Current migration percentage
rails runner "puts \"Migration: #{Zero::Generators::Migration.current_status[:feature_flags][:new_pipeline_percentage]}%\""

# Recent rollbacks count
rails runner "puts \"Rollbacks today: #{Zero::Generators::Migration.current_status[:rollback_status][:rollback_count_today]}\""
```

### Emergency Commands

```bash
# Immediate emergency rollback
rails runner "Zero::Generators::Migration.emergency_rollback!(reason: 'EMERGENCY - $(date)', operator: '$(whoami)')"

# Force legacy system (bypass all routing)
export MIGRATION_MANUAL_OVERRIDE=legacy

# Force new system (bypass percentage routing, but respect circuit breaker)
export MIGRATION_MANUAL_OVERRIDE=new

# Disable migration system temporarily
export MIGRATION_NEW_PIPELINE_PCT=0
export MIGRATION_ENABLE_CANARY=false
```

### Test Commands

```bash
# Test legacy system
rails runner "adapter = Zero::Generators::Migration.create_adapter({table: 'users'}); puts adapter.force_execute_system(:legacy)[:success]"

# Test new system
rails runner "adapter = Zero::Generators::Migration.create_adapter({table: 'users'}); puts adapter.force_execute_system(:new)[:success]"

# Test with dry run
rails generate zero:active_models --table=users --dry-run
```

---

## Escalation Procedures

### Level 1 - On-Call Engineer
- Circuit breaker events
- High error rates (< 15%)
- Performance degradation alerts
- **Tools**: This runbook, basic Rails console commands

### Level 2 - Senior On-Call / Team Lead  
- Persistent system issues after Level 1 actions
- Error rates > 15%
- Multiple rollback events
- **Tools**: Advanced diagnostics, system recovery scripts

### Level 3 - Development Team / Architecture Review
- Systematic issues with new pipeline
- Performance regressions requiring code changes
- Migration strategy adjustments
- **Tools**: Full codebase access, deployment capabilities

### Emergency Contacts
- **Slack**: `#alerts-migration` (immediate)
- **PagerDuty**: Migration System incidents
- **Escalation**: Development team lead for architectural decisions

---

*This runbook should be kept updated as the migration system evolves. Last updated: 2025-08-07*