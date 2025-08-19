# EP-0035: Zero.js Polymorphic Association Tracking System

**Epic ID**: EP-0035  
**Created**: 2025-01-06  
**Status**: Open  
**Priority**: High  
**Component**: Backend/Zero Schema Generation  
**Owner**: Backend Team  
**Estimated Effort**: 5-8 days  

## Overview

Implement an intelligent polymorphic association tracking system for Zero.js schema generation that automatically discovers polymorphic types from the database, persists them across database resets, and generates proper Zero.js relationships without hardcoding or ESLint errors.

### Problem Statement

Current Zero.js schema generation hardcodes polymorphic association targets (e.g., `notable` can be Job, Task, Client), which violates the introspection principle and causes several issues:
- ESLint warnings about unused parameters when types don't exist in database
- Hardcoded assumptions break when new polymorphic types are added
- Database resets lose knowledge of valid polymorphic types
- Manual maintenance required for each polymorphic association

### Solution Approach

Create a smart tracking system that:
1. Introspects database for actual polymorphic type values
2. Persists discovered types in YAML configuration
3. Automatically adds newly discovered types
4. Warns about missing types without removing them
5. Generates Zero.js relationships only for types present in the schema

## Business Value

- **Maintainability**: Eliminates manual updates when polymorphic associations change
- **Reliability**: Survives database resets and development cycles
- **Developer Experience**: No ESLint warnings, cleaner generated code
- **Flexibility**: Automatically adapts to new polymorphic types
- **Auditability**: Tracks when types were last seen in database
- **Safety**: Never loses type information, only warns about missing data

## Requirements

### Functional Requirements

1. **Automatic Discovery**
   - Query database for distinct values in polymorphic type columns
   - Detect all polymorphic associations automatically
   - Support standard Rails naming conventions (_type, _id pairs)

2. **Persistence**
   - Store discovered types in `config/zero_polymorphic_types.yml`
   - Track when each type was last seen
   - Support manual type additions and exclusions
   - Preserve types across database resets

3. **Intelligent Generation**
   - Only generate relationships for types that exist in Zero schema
   - Skip relationships for missing tables
   - Use proper parameter destructuring (only `one` or `many` as needed)

4. **Warning System**
   - Warn when previously-tracked types not found in database
   - Info message when new types discovered
   - Never automatically remove types
   - Clear reporting of polymorphic association status

### Technical Requirements

1. **Integration**
   - Seamless integration with existing Zero schema generator
   - No breaking changes to current generation process
   - Compatible with incremental generation

2. **Performance**
   - Minimal impact on generation time
   - Efficient database queries for type discovery
   - Cached results where appropriate

3. **Configuration**
   - YAML-based configuration for human readability
   - Support for manual overrides
   - Environment-specific settings if needed

## Technical Design

### Architecture

```
┌─────────────────────────────────────┐
│     Zero Schema Generator            │
│  ┌─────────────────────────────┐    │
│  │  PolymorphicTracker         │    │
│  │  - load_config()            │    │
│  │  - discover_types()         │    │
│  │  - update_tracking()        │    │
│  │  - save_config()            │    │
│  └─────────────────────────────┘    │
│           ↓                          │
│  ┌─────────────────────────────┐    │
│  │  RailsSchemaIntrospector    │    │
│  │  - extract_polymorphic()    │    │
│  │  - query_type_values()      │    │
│  └─────────────────────────────┘    │
│           ↓                          │
│  ┌─────────────────────────────┐    │
│  │  Generator                  │    │
│  │  - generate_relationships() │    │
│  │  - filter_valid_targets()   │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### YAML Configuration Structure

```yaml
# config/zero_polymorphic_types.yml
version: "1.0"
generated_at: "2025-01-06T10:00:00Z"
generator_version: "1.0.0"

polymorphic_associations:
  notable:
    discovered_types:
      Job:
        first_seen: "2024-12-01T10:00:00Z"
        last_seen: "2025-01-06T10:00:00Z"
        occurrence_count: 1523
      Task:
        first_seen: "2024-12-01T10:00:00Z"
        last_seen: "2025-01-06T10:00:00Z"
        occurrence_count: 3847
      Client:
        first_seen: "2024-12-15T10:00:00Z"
        last_seen: "2025-01-05T10:00:00Z"
        occurrence_count: 234
      Person:
        first_seen: "2025-01-02T10:00:00Z"
        last_seen: "2025-01-06T10:00:00Z"
        occurrence_count: 89
    
    manual_types:
      Device:
        added_by: "developer"
        added_at: "2025-01-03T10:00:00Z"
        reason: "Future polymorphic support"
    
    excluded_types:
      - OldModel  # Deprecated, ignore if found
    
    settings:
      auto_discover: true
      warn_missing_after_days: 7
      
  loggable:
    discovered_types:
      Job:
        first_seen: "2024-12-01T10:00:00Z"
        last_seen: "2025-01-06T10:00:00Z"
        occurrence_count: 8934
      Task:
        first_seen: "2024-12-01T10:00:00Z"
        last_seen: "2025-01-06T10:00:00Z"
        occurrence_count: 12456
      Client:
        first_seen: "2024-12-01T10:00:00Z"
        last_seen: "2025-01-06T10:00:00Z"
        occurrence_count: 3421
      User:
        first_seen: "2024-12-01T10:00:00Z"
        last_seen: "2025-01-06T10:00:00Z"
        occurrence_count: 567
      Person:
        first_seen: "2024-12-20T10:00:00Z"
        last_seen: "2025-01-06T10:00:00Z"
        occurrence_count: 234
      Device:
        first_seen: "2025-01-01T10:00:00Z"
        last_seen: "2025-01-06T10:00:00Z"
        occurrence_count: 45
    
    manual_types: {}
    excluded_types: []
    settings:
      auto_discover: true
      warn_missing_after_days: 14

  schedulable:
    discovered_types:
      Job:
        first_seen: "2024-12-15T10:00:00Z"
        last_seen: "2025-01-06T10:00:00Z"
        occurrence_count: 234
      Task:
        first_seen: "2025-01-02T10:00:00Z"
        last_seen: "2025-01-06T10:00:00Z"
        occurrence_count: 89
    
    manual_types: {}
    excluded_types: []
    settings:
      auto_discover: true
      warn_missing_after_days: 30

settings:
  global:
    enable_tracking: true
    auto_save: true
    backup_on_update: true
    max_backup_files: 5
```

### Module Implementation

```ruby
# lib/zero_schema_generator/polymorphic_tracker.rb
module ZeroSchemaGenerator
  class PolymorphicTracker
    attr_reader :associations, :warnings, :info_messages
    
    def initialize(config_path = nil)
      @config_path = config_path || default_config_path
      @associations = {}
      @warnings = []
      @info_messages = []
      load_config
    end
    
    def track_discovered_types(association_name, discovered_types)
      # Add new types, update last_seen for existing
      # Generate warnings for missing types
    end
    
    def get_valid_types(association_name, available_tables)
      # Return types that exist in available_tables
      # Include manual types if tables exist
    end
    
    def save_config
      # Save updated configuration with backup
    end
    
    private
    
    def load_config
      # Load YAML config or create default
    end
    
    def warn_missing_types(association_name, missing_types)
      # Add warnings for types not seen recently
    end
    
    def info_new_types(association_name, new_types)
      # Add info messages for newly discovered types
    end
  end
end
```

## Implementation Tasks

### Phase 1: Core Infrastructure (2 days)

**ZERO-001: Create PolymorphicTracker Module**
- [ ] Create `lib/zero_schema_generator/polymorphic_tracker.rb`
- [ ] Implement YAML loading/saving with backup
- [ ] Add configuration validation
- [ ] Create default configuration structure
- [ ] Add unit tests

**ZERO-002: Extend RailsSchemaIntrospector**
- [ ] Add `discover_polymorphic_types` method
- [ ] Query distinct type values for each association
- [ ] Handle empty databases gracefully
- [ ] Return type counts for tracking
- [ ] Add integration tests

### Phase 2: Generator Integration (2 days)

**ZERO-003: Update Generator for Tracking**
- [ ] Initialize PolymorphicTracker at start
- [ ] Call discovery before relationship generation
- [ ] Filter relationships by valid types
- [ ] Update tracker with results
- [ ] Save configuration after generation

**ZERO-004: Fix Parameter Destructuring**
- [ ] Track which parameters actually used (one/many)
- [ ] Only destructure parameters that are needed
- [ ] Update relationship generation templates
- [ ] Verify ESLint warnings resolved

### Phase 3: Warning System (1 day)

**ZERO-005: Implement Warning and Info Messages**
- [ ] Add warning for types missing > N days
- [ ] Add info for newly discovered types
- [ ] Format messages for console output
- [ ] Add summary report after generation
- [ ] Optional Slack/email notifications

**ZERO-006: Add Manual Override Support**
- [ ] CLI commands to add/remove manual types
- [ ] Support for excluded types list
- [ ] Per-association settings
- [ ] Documentation for manual configuration

### Phase 4: Testing & Documentation (2 days)

**ZERO-007: Comprehensive Testing**
- [ ] Unit tests for PolymorphicTracker
- [ ] Integration tests with real database
- [ ] Tests for empty database scenario
- [ ] Tests for missing types warnings
- [ ] Performance benchmarks

**ZERO-008: Documentation**
- [ ] Update README with polymorphic tracking
- [ ] Document YAML configuration format
- [ ] Add troubleshooting guide
- [ ] Create migration guide from hardcoded version
- [ ] Add examples for common scenarios

### Phase 5: Rollout (1 day)

**ZERO-009: Initial Deployment**
- [ ] Generate initial YAML from current database
- [ ] Run full generation to verify no regressions
- [ ] Verify ESLint passes with no warnings
- [ ] Check all polymorphic relationships work
- [ ] Add to CI/CD pipeline

**ZERO-010: Monitoring & Optimization**
- [ ] Add generation metrics
- [ ] Monitor warning frequency
- [ ] Optimize database queries if needed
- [ ] Gather team feedback
- [ ] Plan future enhancements

## Testing Strategy

### Unit Tests
- PolymorphicTracker YAML operations
- Type discovery logic
- Warning generation logic
- Configuration validation

### Integration Tests
- Full generation with polymorphic types
- Database reset scenario
- New type discovery
- Missing type warnings
- Manual override functionality

### End-to-End Tests
- Generate schema from scratch
- Verify Zero.js client works
- Ensure no ESLint warnings
- Test with empty database
- Test with full production data

## Migration Plan

1. **Preparation**
   - Back up current generated schemas
   - Document current polymorphic assumptions
   - Identify all polymorphic associations

2. **Initial Generation**
   - Run discovery on production database copy
   - Generate initial YAML configuration
   - Review discovered vs. expected types

3. **Validation**
   - Generate new schema with tracking
   - Compare with current schema
   - Verify no missing relationships
   - Test in development environment

4. **Rollout**
   - Deploy to staging
   - Monitor for warnings
   - Deploy to production
   - Monitor for new type discoveries

## Rollback Plan

If issues arise:
1. Revert to previous generator version
2. Use backed-up schemas
3. Temporarily hardcode critical types
4. Fix issues and redeploy

## Success Metrics

- **Zero ESLint warnings** in generated schema
- **100% polymorphic types tracked** vs. database
- **No hardcoded type lists** in generator
- **< 5 second impact** on generation time
- **Zero production issues** after deployment
- **Automatic discovery** of new polymorphic types

## Dependencies

- Rails 7.x with ActiveRecord
- Zero.js schema generation pipeline
- PostgreSQL database
- YAML for configuration storage

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Database query performance | High | Add indexes on type columns, cache results |
| YAML corruption | Medium | Automatic backups, validation on load |
| Missing critical types | High | Manual override support, warnings don't block |
| Breaking existing schemas | High | Comprehensive testing, gradual rollout |

## Future Enhancements

1. **Web UI for Configuration**
   - Visual YAML editor
   - Type discovery dashboard
   - Warning history graphs

2. **Advanced Analytics**
   - Type usage trends
   - Polymorphic association patterns
   - Performance metrics

3. **Smart Suggestions**
   - Recommend type additions based on models
   - Suggest deprecated type cleanup
   - Optimization recommendations

4. **Multi-Database Support**
   - Track types across environments
   - Sync configurations between databases
   - Environment-specific overrides

## References

- [Zero.js Documentation](https://zero.rocicorp.dev)
- [Rails Polymorphic Associations](https://guides.rubyonrails.org/association_basics.html#polymorphic-associations)
- Current hardcoded implementation: `lib/zero_schema_generator/generator.rb:331-340`

## Appendix: Current Hardcoded Types

For reference, these are the currently hardcoded polymorphic associations that will be replaced:

```ruby
# generator.rb (to be replaced)
polymorphic_targets = case rel[:name].to_s
when "notable"
  %w[jobs tasks clients]  # Hardcoded!
when "loggable"  
  %w[jobs tasks clients users people]  # Hardcoded!
when "schedulable"
  %w[jobs tasks]  # Hardcoded!
else
  []
end
```

This epic will eliminate all such hardcoding and replace it with intelligent, data-driven discovery.