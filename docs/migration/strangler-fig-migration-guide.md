# Strangler Fig Migration Guide

## Overview

This guide documents the Strangler Fig migration pattern implementation for ReactiveRecord generation, allowing zero-downtime transition from the legacy `GenerationCoordinator` to the new `Pipeline` architecture.

**Document Version**: 1.0.0  
**Last Updated**: 2025-08-07  
**Migration System Version**: 1.0.0  

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Start](#quick-start)
3. [Deployment Guide](#deployment-guide)
4. [Configuration Reference](#configuration-reference)
5. [Operational Procedures](#operational-procedures)
6. [Monitoring and Observability](#monitoring-and-observability)
7. [Rollback Procedures](#rollback-procedures)
8. [Troubleshooting](#troubleshooting)
9. [Development Guidelines](#development-guidelines)

## Architecture Overview

### Strangler Fig Pattern

The Strangler Fig pattern allows gradual replacement of legacy systems by:

1. **Routing Layer**: `MigrationAdapter` routes requests between old and new systems
2. **Feature Flags**: `MigrationFeatureFlags` controls which system handles requests
3. **Canary Testing**: `OutputComparator` validates new system against legacy
4. **Circuit Breaker**: Automatic failover when new system experiences issues
5. **Rollback Management**: `RollbackManager` provides emergency rollback capabilities

### Key Components

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│  Client Request │───▶│  MigrationAdapter    │───▶│ Legacy/New System   │
└─────────────────┘    │  - Feature Flags     │    │ - GenerationCoord.  │
                       │  - Circuit Breaker   │    │ - Pipeline          │
                       │  - Canary Testing    │    └─────────────────────┘
                       └──────────────────────┘
                                 │
                       ┌──────────────────────┐
                       │  RollbackManager     │
                       │  - Emergency Rollback│
                       │  - State Persistence │
                       └──────────────────────┘
```

### Migration Phases

1. **Phase 0**: Legacy system handles 100% of traffic (current state)
2. **Phase 1**: Enable canary testing (0% traffic to new system)
3. **Phase 2**: Gradual rollout (1-10% traffic to new system)
4. **Phase 3**: Increased adoption (10-50% traffic to new system)
5. **Phase 4**: Majority adoption (50-95% traffic to new system)
6. **Phase 5**: Complete migration (100% traffic to new system)
7. **Phase 6**: Legacy system deprecation and removal

## Quick Start

### Prerequisites

- Rails application with ReactiveRecord generation
- New pipeline architecture implemented
- Environment variables configured

### Basic Setup

1. **Add migration system to your application**:

```ruby
# In your Rails generator
require 'generators/zero/active_models/migration'

# Replace direct GenerationCoordinator usage with MigrationAdapter
adapter = Zero::Generators::Migration.create_adapter(options, shell)
result = adapter.execute
```

2. **Configure environment variables**:

```bash
export MIGRATION_NEW_PIPELINE_PCT=0       # Start with legacy system
export MIGRATION_ENABLE_CANARY=false      # Disable canary testing initially
export MIGRATION_CIRCUIT_BREAKER=true     # Enable circuit breaker
export MIGRATION_DETAILED_LOGGING=false   # Enable for debugging
```

3. **Verify setup**:

```bash
# Check system health
rails runner "puts Zero::Generators::Migration.health_check"

# Check current configuration
rails runner "puts Zero::Generators::Migration.current_status"
```

## Deployment Guide

### Phase 0: Preparation and Baseline

**Objective**: Establish monitoring and prepare for migration

**Steps**:

1. **Deploy migration system with legacy routing**:
   ```bash
   export MIGRATION_NEW_PIPELINE_PCT=0
   export MIGRATION_ENABLE_CANARY=false
   export MIGRATION_CIRCUIT_BREAKER=true
   ```

2. **Verify legacy system functioning**:
   ```bash
   rails generate zero:active_models --table=users
   ```

3. **Set up monitoring dashboards**
4. **Configure alerting for circuit breaker events**

**Success Criteria**:
- Migration system deployed successfully
- Legacy system continues to work without issues
- Monitoring shows baseline metrics

### Phase 1: Canary Testing (0% Traffic Migration)

**Objective**: Enable dual execution for comparison testing

**Duration**: 1-2 weeks

**Steps**:

1. **Enable canary testing**:
   ```bash
   export MIGRATION_ENABLE_CANARY=true
   export MIGRATION_CANARY_SAMPLE_PCT=10    # Start with 10% canary sampling
   ```

2. **Monitor canary test results**:
   ```ruby
   # Check for discrepancies
   stats = Zero::Generators::Migration.statistics
   puts stats[:performance_metrics]
   
   # Review comparison reports
   Zero::Generators::Migration.health_check
   ```

3. **Address any discrepancies found**

**Success Criteria**:
- Canary tests run without errors
- No significant discrepancies between systems
- Performance comparison shows acceptable metrics

### Phase 2: Initial Rollout (1-10% Traffic)

**Objective**: Route small percentage of traffic to new system

**Duration**: 1-2 weeks

**Steps**:

1. **Gradually increase new system usage**:
   ```bash
   # Week 1: 1% traffic
   export MIGRATION_NEW_PIPELINE_PCT=1
   
   # Week 2: 5% traffic
   export MIGRATION_NEW_PIPELINE_PCT=5
   
   # End of phase: 10% traffic
   export MIGRATION_NEW_PIPELINE_PCT=10
   ```

2. **Monitor error rates and performance**
3. **Keep canary testing enabled for validation**

**Success Criteria**:
- Error rates remain within acceptable thresholds
- No circuit breaker trips
- Performance metrics stable

### Phase 3: Increased Adoption (10-50% Traffic)

**Objective**: Scale up new system usage

**Duration**: 2-3 weeks

**Steps**:

1. **Increase traffic gradually**:
   ```bash
   # Week 1: 20% traffic
   export MIGRATION_NEW_PIPELINE_PCT=20
   
   # Week 2: 35% traffic  
   export MIGRATION_NEW_PIPELINE_PCT=35
   
   # Week 3: 50% traffic
   export MIGRATION_NEW_PIPELINE_PCT=50
   ```

2. **Reduce canary testing overhead**:
   ```bash
   export MIGRATION_CANARY_SAMPLE_PCT=5     # Reduce sampling rate
   ```

**Success Criteria**:
- System handles increased load without issues
- Error rates remain low
- Performance meets SLAs

### Phase 4: Majority Adoption (50-95% Traffic)

**Objective**: Route majority of traffic to new system

**Duration**: 2-3 weeks

**Steps**:

1. **Continue gradual increase**:
   ```bash
   # Week 1: 70% traffic
   export MIGRATION_NEW_PIPELINE_PCT=70
   
   # Week 2: 85% traffic
   export MIGRATION_NEW_PIPELINE_PCT=85
   
   # Week 3: 95% traffic
   export MIGRATION_NEW_PIPELINE_PCT=95
   ```

2. **Monitor legacy system for decreased usage**

**Success Criteria**:
- New system handles majority traffic successfully
- Legacy system errors don't increase (due to reduced usage)
- Circuit breaker remains stable

### Phase 5: Complete Migration (100% Traffic)

**Objective**: Route all traffic to new system

**Duration**: 1 week

**Steps**:

1. **Complete the migration**:
   ```bash
   export MIGRATION_NEW_PIPELINE_PCT=100
   ```

2. **Monitor closely for 24-48 hours**
3. **Disable canary testing**:
   ```bash
   export MIGRATION_ENABLE_CANARY=false
   ```

**Success Criteria**:
- All traffic successfully handled by new system
- No increase in error rates
- Performance meets expectations

### Phase 6: Legacy System Deprecation

**Objective**: Remove legacy system code

**Duration**: 2-4 weeks

**Steps**:

1. **Monitor for 2 weeks with 100% new system traffic**
2. **Disable migration system**:
   ```ruby
   # Replace MigrationAdapter with direct Pipeline usage
   pipeline = Pipeline::GenerationPipeline.new(options: options)
   result = pipeline.execute
   ```

3. **Remove legacy GenerationCoordinator code**
4. **Clean up migration system components**

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MIGRATION_NEW_PIPELINE_PCT` | `0` | Percentage of requests routed to new system (0-100) |
| `MIGRATION_ENABLE_CANARY` | `false` | Enable canary testing (dual execution) |
| `MIGRATION_CANARY_SAMPLE_PCT` | `100` | Percentage of requests for canary testing |
| `MIGRATION_CIRCUIT_BREAKER` | `true` | Enable automatic circuit breaker |
| `MIGRATION_AUTO_ROLLBACK` | `false` | Enable automatic rollback on circuit breaker trip |
| `MIGRATION_DETAILED_LOGGING` | `false` | Enable detailed migration decision logging |
| `MIGRATION_NEW_PIPELINE_TABLES` | `""` | Comma-separated list of tables to force new system |
| `MIGRATION_MANUAL_OVERRIDE` | `null` | Manual override: `legacy`, `new`, or `null` |

### Programmatic Configuration

```ruby
# Configure feature flags directly
flags = Zero::Generators::Migration::MigrationFeatureFlags.instance
flags.configure do |config|
  config.new_pipeline_percentage = 25
  config.enable_canary_testing = true
  config.canary_sample_rate = 50
  config.circuit_breaker_enabled = true
  config.fallback_to_legacy_on_error = true
end

# Create adapter with custom configuration
adapter = Zero::Generators::Migration.create_adapter(
  options, 
  shell,
  migration_config: {
    new_pipeline_percentage: 25,
    enable_canary_testing: true
  }
)
```

### Circuit Breaker Configuration

```ruby
flags.configure do |config|
  config.error_threshold = 5              # Errors before circuit trips
  config.error_window_seconds = 300       # Time window for error counting
  config.circuit_recovery_timeout = 600   # Recovery timeout (10 minutes)
end
```

### Output Comparator Configuration

```ruby
comparator = Zero::Generators::Migration.create_comparator(
  performance_tolerance_ms: 100,          # Acceptable performance difference
  ignore_whitespace_differences: true,    # Normalize whitespace in comparisons
  ignore_timestamp_differences: true,     # Ignore timestamp differences
  compare_file_checksums: true,           # Enable file content comparison
  generate_diff_snippets: false           # Include diffs in reports
)
```

## Operational Procedures

### Daily Operations

1. **Check System Health**:
   ```bash
   rails runner "puts Zero::Generators::Migration.health_check"
   ```

2. **Review Migration Statistics**:
   ```bash
   rails runner "puts Zero::Generators::Migration.statistics"
   ```

3. **Monitor Error Rates**:
   ```bash
   rails runner "puts Zero::Generators::Migration.current_status"
   ```

### Weekly Operations

1. **Review Performance Metrics**:
   - Compare execution times between systems
   - Check for performance regressions
   - Review canary test discrepancies

2. **Analyze Rollback History**:
   ```ruby
   manager = Zero::Generators::Migration::RollbackManager.new
   puts manager.rollback_history(limit: 20)
   ```

3. **Update Migration Percentage** (during active migration):
   - Review current week's metrics
   - Plan next week's percentage increase
   - Update environment variables

### Emergency Procedures

#### Circuit Breaker Tripped

When the circuit breaker trips (automatic failover to legacy system):

1. **Assess the situation**:
   ```bash
   rails runner "puts Zero::Generators::Migration.current_status"
   ```

2. **Check recent errors**:
   ```bash
   # Review application logs for new pipeline errors
   tail -f log/production.log | grep "MigrationAdapter"
   ```

3. **Decide on action**:
   - If errors are transient: Wait for automatic recovery
   - If errors are systemic: Execute manual rollback

4. **Manual rollback if needed**:
   ```bash
   rails runner "Zero::Generators::Migration.emergency_rollback!(reason: 'Circuit breaker investigation')"
   ```

#### Performance Degradation

When canary tests show performance issues:

1. **Review performance metrics**:
   ```ruby
   stats = Zero::Generators::Migration.statistics
   puts stats[:performance_metrics]
   ```

2. **Check for resource constraints**
3. **Consider reducing migration percentage temporarily**
4. **Investigate new system performance bottlenecks**

#### System Discrepancies

When canary tests show output differences:

1. **Generate detailed comparison report**:
   ```ruby
   # This would be logged automatically, but can be generated manually
   comparator = Zero::Generators::Migration.create_comparator
   # ... comparison logic
   ```

2. **Analyze differences**:
   - Are differences semantic or cosmetic?
   - Do differences affect functionality?
   - Are differences acceptable?

3. **Take action**:
   - Fix new system if differences are problematic
   - Adjust comparison tolerances if differences are acceptable
   - Rollback if differences are critical

## Monitoring and Observability

### Key Metrics to Monitor

1. **Traffic Distribution**:
   - Percentage of requests to new vs legacy system
   - Request volume trends

2. **Error Rates**:
   - New system error rate
   - Legacy system error rate
   - Circuit breaker trip frequency

3. **Performance Metrics**:
   - Execution time comparison (legacy vs new)
   - Canary test overhead
   - System resource utilization

4. **Migration Health**:
   - Circuit breaker state
   - Rollback frequency
   - Canary test discrepancy rate

### Alerting Configuration

Set up alerts for:

```yaml
# Circuit Breaker Alerts
circuit_breaker_open:
  condition: circuit_breaker_state == 'open'
  severity: critical
  notification: immediate

# Error Rate Alerts  
high_error_rate:
  condition: error_rate > 5%
  severity: warning
  notification: 15_minutes

# Performance Degradation
performance_regression:
  condition: new_system_time > legacy_system_time * 1.5
  severity: warning
  notification: 30_minutes

# Rollback Alerts
rollback_executed:
  condition: rollback_event_occurred
  severity: critical
  notification: immediate
```

### Logging

Enable detailed logging for troubleshooting:

```bash
export MIGRATION_DETAILED_LOGGING=true
```

Log messages include:
- Routing decisions for each request
- Canary test results and discrepancies
- Circuit breaker state changes
- Rollback events and reasons

### Dashboard Metrics

Create dashboards to track:

1. **Migration Progress**:
   - Current migration percentage
   - Traffic distribution over time
   - Migration phase timeline

2. **System Health**:
   - Error rates (legacy vs new)
   - Circuit breaker state
   - Rollback events

3. **Performance Comparison**:
   - Execution time percentiles
   - Resource utilization
   - Throughput comparison

## Rollback Procedures

### Automatic Rollback

The system provides automatic rollback in these scenarios:

1. **Circuit Breaker Trip**: When error threshold is exceeded
2. **Configurable Auto-Rollback**: When `MIGRATION_AUTO_ROLLBACK=true`

### Manual Rollback Procedures

#### Emergency Rollback

For immediate rollback in critical situations:

```bash
# Emergency rollback
rails runner "
  Zero::Generators::Migration.emergency_rollback!(
    reason: 'Critical production issue - [INCIDENT_ID]',
    operator: '$(whoami)'
  )
"
```

#### Planned Rollback

For scheduled maintenance or known issues:

```bash
# Planned rollback
rails runner "
  manager = Zero::Generators::Migration::RollbackManager.new
  manager.execute_planned_rollback(
    reason: 'Planned maintenance - addressing performance issue',
    operator: '$(whoami)'
  )
"
```

#### Rollback Validation

After any rollback, validate the system:

```bash
# Check rollback status
rails runner "
  manager = Zero::Generators::Migration::RollbackManager.new
  puts manager.validate_rollback_success
"

# Test legacy system functionality
rails generate zero:active_models --table=users --dry-run
```

#### Recovery from Failed Rollback

If rollback fails:

```bash
# Attempt recovery
rails runner "
  manager = Zero::Generators::Migration::RollbackManager.new
  recovery_result = manager.attempt_rollback_recovery
  puts recovery_result
"
```

#### Clear Rollback State

To return to normal operation after resolving issues:

```bash
# Clear rollback and return to normal operation
rails runner "
  manager = Zero::Generators::Migration::RollbackManager.new
  result = manager.clear_rollback_state(operator: '$(whoami)')
  puts result
"
```

### Post-Rollback Actions

After any rollback:

1. **Investigate Root Cause**:
   - Review logs and error messages
   - Analyze performance metrics
   - Identify system issues

2. **Fix Underlying Issues**:
   - Address new system problems
   - Update configuration if needed
   - Test fixes in development/staging

3. **Plan Re-migration**:
   - Determine when to resume migration
   - Adjust migration strategy if needed
   - Communicate timeline to stakeholders

## Troubleshooting

### Common Issues

#### High Error Rates

**Symptoms**: Circuit breaker trips frequently, high error rates in new system

**Investigation**:
```bash
# Check recent errors
rails runner "
  stats = Zero::Generators::Migration.statistics
  puts stats[:circuit_breaker_metrics]
"

# Review error logs
grep 'Pipeline\|MigrationAdapter' log/production.log | tail -100
```

**Solutions**:
- Check new system dependencies (database, external APIs)
- Verify new system configuration
- Review recent code changes
- Consider temporary rollback while investigating

#### Performance Issues

**Symptoms**: New system significantly slower than legacy system

**Investigation**:
```bash
# Check performance metrics
rails runner "
  flags = Zero::Generators::Migration::MigrationFeatureFlags.instance
  puts flags.performance_statistics
"
```

**Solutions**:
- Profile new system for bottlenecks
- Check database query performance
- Review resource allocation
- Optimize critical code paths

#### Canary Test Discrepancies

**Symptoms**: Canary tests show differences between systems

**Investigation**:
```bash
# Generate detailed comparison report
# Review logs for OutputComparator messages
grep 'OutputComparator\|CANARY DISCREPANCY' log/production.log
```

**Solutions**:
- Analyze specific discrepancies (content vs metadata)
- Determine if differences are acceptable
- Fix new system if differences are problematic
- Adjust comparison tolerances if appropriate

#### Circuit Breaker Stuck Open

**Symptoms**: Circuit breaker won't close automatically after recovery timeout

**Investigation**:
```bash
# Check circuit breaker state
rails runner "
  flags = Zero::Generators::Migration::MigrationFeatureFlags.instance
  puts flags.circuit_breaker_state
  puts flags.configuration_summary
"
```

**Solutions**:
```bash
# Manual circuit breaker reset (if safe)
rails runner "
  flags = Zero::Generators::Migration::MigrationFeatureFlags.instance
  flags.reset_circuit_breaker!
"

# Or force legacy mode temporarily
export MIGRATION_MANUAL_OVERRIDE=legacy
```

### Debugging Commands

```bash
# System status overview
rails runner "puts Zero::Generators::Migration.current_status"

# Detailed health check
rails runner "puts Zero::Generators::Migration.health_check"

# Performance statistics
rails runner "puts Zero::Generators::Migration.statistics"

# Rollback status
rails runner "
  manager = Zero::Generators::Migration::RollbackManager.new
  puts manager.current_status
"

# Test specific table generation
rails runner "
  adapter = Zero::Generators::Migration.create_adapter({table: 'users'})
  result = adapter.force_execute_system(:new)  # Test new system
  puts result
"
```

### Log Analysis

Look for these log patterns:

```bash
# Migration routing decisions
grep "MigrationFlags.*Routing decision" log/production.log

# Canary test results  
grep "MigrationAdapter.*canary test" log/production.log

# Circuit breaker events
grep "Circuit breaker.*TRIPPED\|Circuit breaker.*closed" log/production.log

# Rollback events
grep "RollbackManager.*rollback" log/production.log
```

## Development Guidelines

### Testing the Migration System

1. **Unit Tests**: Test individual components
   ```bash
   rails test test/lib/generators/zero/active_models/migration/
   ```

2. **Integration Tests**: Test end-to-end scenarios
   ```bash
   rails test test/lib/generators/zero/active_models/migration_integration_test.rb
   ```

3. **Manual Testing**: Test with different configurations
   ```bash
   # Test legacy routing
   MIGRATION_NEW_PIPELINE_PCT=0 rails generate zero:active_models
   
   # Test new system routing  
   MIGRATION_NEW_PIPELINE_PCT=100 rails generate zero:active_models
   
   # Test canary mode
   MIGRATION_ENABLE_CANARY=true rails generate zero:active_models
   ```

### Development Environment Setup

```bash
# Enable detailed logging
export MIGRATION_DETAILED_LOGGING=true

# Start with canary testing for validation
export MIGRATION_ENABLE_CANARY=true
export MIGRATION_CANARY_SAMPLE_PCT=100

# Use small migration percentage
export MIGRATION_NEW_PIPELINE_PCT=10
```

### Code Review Checklist

- [ ] Migration adapter usage is correct
- [ ] Error handling includes migration context
- [ ] Performance impact is considered
- [ ] Tests cover migration scenarios
- [ ] Configuration is externalized
- [ ] Logging provides adequate debugging info

### Best Practices

1. **Always Use Migration Adapter**: Don't bypass the migration system
2. **Monitor Actively**: Keep detailed logging enabled during development
3. **Test Both Systems**: Verify changes work with both legacy and new systems  
4. **Handle Errors Gracefully**: Ensure fallback behavior is appropriate
5. **Document Configuration Changes**: Update this guide when adding new features

---

## Appendix

### Migration System API Reference

See source code documentation in:
- `lib/generators/zero/active_models/migration/feature_flags.rb`
- `lib/generators/zero/active_models/migration/adapter.rb`
- `lib/generators/zero/active_models/migration/rollback_manager.rb`
- `lib/generators/zero/active_models/migration/output_comparator.rb`

### Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-08-07 | Initial migration system documentation |

### Support and Contact

For issues with the migration system:
1. Check this documentation
2. Review system logs and metrics
3. Use debugging commands provided
4. Execute rollback procedures if needed
5. Contact the development team with specific error details

---

*This document is part of the ReactiveRecord Generation Refactoring (EP-0037) project.*