# EP-0036: Rails Generator Integration for Polymorphic Tracking System

**Epic ID**: EP-0036  
**Created**: 2025-01-06  
**Status**: Open  
**Priority**: Critical  
**Component**: Backend/Rails Generator + Frontend/TypeScript Models  
**Dependencies**: EP-0035 (Polymorphic Tracking System)  
**Owner**: Backend Team + Frontend Team  
**Estimated Effort**: 5-7 days  

## Overview

Integrate the newly implemented Zero.js Polymorphic Tracking System (EP-0035) with the Rails schema generator to automatically produce TypeScript models that utilize the dynamic polymorphic APIs, eliminating manual model updates and ensuring single-source-of-truth from the Rails database schema.

### Problem Statement

The current Rails generator (`lib/zero_schema_generator/`) produces TypeScript model files with hardcoded polymorphic relationships. After implementing EP-0035's dynamic polymorphic tracking system, we have a disconnect:

- **Frontend**: Has sophisticated polymorphic tracking with `declarePolymorphicRelationships()` API
- **Generator**: Still produces hardcoded relationships in generated models
- **Gap**: Manual intervention required to use the new system

This violates the principle of automatic code generation and creates maintenance burden.

### Solution Approach

Create a bidirectional bridge between Rails polymorphic discovery and the TypeScript polymorphic tracking system:

1. **Rails discovers** polymorphic associations from database
2. **YAML config** persists discovered types (survives DB resets)
3. **Generator produces** TypeScript models using new polymorphic APIs
4. **Frontend consumes** generated models with zero manual changes
5. **Sync maintains** consistency between Rails and TypeScript configs

## Business Value

- **Zero Manual Updates**: Models automatically use polymorphic tracking system
- **Single Source of Truth**: Rails schema drives everything
- **Maintenance Free**: New polymorphic types auto-discovered and integrated
- **Type Safety**: Generated code fully typed with proper relationships
- **Developer Experience**: No manual model editing ever required
- **Consistency**: Rails and TypeScript always in sync

## Requirements

### Functional Requirements

#### 1. Rails Polymorphic Discovery
- Detect all polymorphic associations in Rails models
- Query database for actual polymorphic type values
- Track usage statistics and last-seen timestamps
- Handle STI (Single Table Inheritance) correctly
- Support custom polymorphic patterns

#### 2. Configuration Persistence
- Store discovered types in `config/zero_polymorphic_types.yml`
- Maintain history across database resets
- Support manual additions/exclusions
- Version tracking for configuration changes
- Backup and restore capabilities

#### 3. TypeScript Model Generation
Generate models that use the new polymorphic APIs:

```typescript
// BEFORE (current generation):
export class Note extends BaseModel {
  static tableName = 'notes';
  
  // Hardcoded polymorphic relationships
  notableJob?: Job;
  notableTask?: Task;
  notableClient?: Client;
}

// AFTER (new generation):
export class Note extends BaseModel {
  static tableName = 'notes';
  
  static {
    // Dynamic polymorphic relationships
    declarePolymorphicRelationships({
      tableName: 'notes',
      belongsTo: {
        notable: {
          typeField: 'notable_type',
          idField: 'notable_id',
          allowedTypes: ['job', 'task', 'client', 'person'] // From YAML config
        }
      }
    });
  }
}
```

#### 4. Zero.js Schema Generation
Update schema generator to:
- Read from polymorphic configuration
- Generate proper Zero.js relationships
- Include only types that exist in schema
- Handle forward/reverse relationships

#### 5. Bidirectional Sync
- Rails config changes propagate to TypeScript
- TypeScript discoveries can inform Rails
- Conflict resolution strategies
- Sync status monitoring

### Technical Requirements

1. **Performance**
   - Generation time increase < 5 seconds
   - Efficient database queries for type discovery
   - Caching where appropriate

2. **Compatibility**
   - Backward compatible with existing generated code
   - Gradual migration path
   - Feature flag for rollback

3. **Validation**
   - Generated TypeScript passes all linting
   - No TypeScript compilation errors
   - All tests continue passing

## Technical Design

### Architecture

```
┌─────────────────────────────────────────┐
│         Rails Application               │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────┐     │
│  │  PolymorphicIntrospector      │     │
│  │  - scan_models()              │     │
│  │  - query_database()           │     │
│  │  - detect_associations()      │     │
│  └────────────┬──────────────────┘     │
│               │                         │
│               ▼                         │
│  ┌───────────────────────────────┐     │
│  │  config/zero_polymorphic.yml  │     │
│  │  - discovered_types           │     │
│  │  - manual_overrides          │     │
│  │  - last_seen_timestamps      │     │
│  └────────────┬──────────────────┘     │
│               │                         │
│               ▼                         │
│  ┌───────────────────────────────┐     │
│  │  TypeScriptModelGenerator     │     │
│  │  - read_config()              │     │
│  │  - generate_models()          │     │
│  │  - use_polymorphic_apis()     │     │
│  └────────────┬──────────────────┘     │
│               │                         │
└───────────────┼─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│      Generated TypeScript Models        │
│  - Uses declarePolymorphicRelationships │
│  - Integrates with PolymorphicTracker   │
│  - No manual changes required           │
└─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│    Frontend Polymorphic System (EP-0035)│
│  - PolymorphicTracker                   │
│  - PolymorphicRegistry                  │
│  - ChainableQuery                       │
└─────────────────────────────────────────┘
```

### YAML Configuration Format

```yaml
# config/zero_polymorphic_types.yml
version: "2.0"
generated_at: "2025-01-06T10:00:00Z"
generator_version: "2.0.0"
sync_with_frontend: true

polymorphic_associations:
  notes:
    type_field: notable_type
    id_field: notable_id
    discovered_types:
      Job:
        rails_model: true
        last_seen: "2025-01-06T10:00:00Z"
        count: 1523
        typescript_name: "job"
      Task:
        rails_model: true
        last_seen: "2025-01-06T10:00:00Z"
        count: 3847
        typescript_name: "task"
      Client:
        rails_model: true
        last_seen: "2025-01-06T10:00:00Z"
        count: 234
        typescript_name: "client"
      Person:
        rails_model: true
        last_seen: "2025-01-06T10:00:00Z"
        count: 89
        typescript_name: "person"
    
  activity_logs:
    type_field: loggable_type
    id_field: loggable_id
    discovered_types:
      Job:
        rails_model: true
        last_seen: "2025-01-06T10:00:00Z"
        count: 8934
        typescript_name: "job"
      # ... more types
    
generation_settings:
  use_declare_api: true
  include_reverse_relationships: true
  generate_type_guards: true
  strict_type_checking: true
```

### Generator Implementation

```ruby
# lib/zero_schema_generator/model_generator.rb
module ZeroSchemaGenerator
  class ModelGenerator
    def generate_polymorphic_relationships(model_name, associations)
      return unless associations.any?(&:polymorphic?)
      
      config = load_polymorphic_config
      
      associations.select(&:polymorphic?).map do |assoc|
        types = config.dig('polymorphic_associations', 
                          model_name.tableize, 
                          'discovered_types')
        
        generate_declare_call(assoc, types)
      end
    end
    
    private
    
    def generate_declare_call(association, types)
      <<~TYPESCRIPT
        static {
          declarePolymorphicRelationships({
            tableName: '#{association.table_name}',
            belongsTo: {
              #{association.name}: {
                typeField: '#{association.foreign_type}',
                idField: '#{association.foreign_key}',
                allowedTypes: #{types.keys.map(&:underscore).to_json}
              }
            }
          });
        }
      TYPESCRIPT
    end
  end
end
```

## Implementation Tasks

### Phase 1: Rails Introspection (2 days)

**RAIL-001: Create PolymorphicIntrospector**
- [ ] Scan all Rails models for polymorphic associations
- [ ] Detect type/id field pairs
- [ ] Query database for actual type values
- [ ] Handle STI correctly
- [ ] Generate statistics

**RAIL-002: Implement YAML Persistence**
- [ ] Create configuration structure
- [ ] Load/save with validation
- [ ] Merge with existing config
- [ ] Backup functionality
- [ ] Version tracking

### Phase 2: Generator Updates (2 days)

**GEN-001: Update Model Generator**
- [ ] Read polymorphic configuration
- [ ] Generate static initializer blocks
- [ ] Use declarePolymorphicRelationships API
- [ ] Include proper imports
- [ ] Handle edge cases

**GEN-002: Update Schema Generator**
- [ ] Read from polymorphic config
- [ ] Generate dynamic relationships
- [ ] Skip missing types
- [ ] Include metadata

### Phase 3: Integration (1 day)

**INT-001: Frontend Integration**
- [ ] Ensure generated models work with PolymorphicTracker
- [ ] Validate type safety
- [ ] Test all relationships
- [ ] Performance verification

**INT-002: Bidirectional Sync**
- [ ] Rails → TypeScript sync on generation
- [ ] TypeScript → Rails feedback mechanism
- [ ] Conflict resolution
- [ ] Monitoring

### Phase 4: Testing & Migration (2 days)

**TEST-001: Comprehensive Testing**
- [ ] Unit tests for introspector
- [ ] Integration tests for generator
- [ ] End-to-end with polymorphic system
- [ ] Performance benchmarks
- [ ] Migration tests

**MIG-001: Migration Strategy**
- [ ] Create migration plan
- [ ] Test on staging
- [ ] Gradual rollout
- [ ] Rollback procedures
- [ ] Documentation

## Testing Strategy

### Unit Tests
- Polymorphic introspection logic
- YAML configuration management
- Model generation with new APIs
- Schema generation

### Integration Tests
- Full generation pipeline
- Generated models with polymorphic tracker
- Bidirectional sync
- Database reset scenarios

### End-to-End Tests
- Complete workflow from Rails to TypeScript
- All polymorphic relationships functional
- No manual intervention required
- Performance within limits

## Migration Plan

### Phase 1: Preparation
1. Deploy EP-0035 polymorphic tracking system
2. Ensure frontend ready for generated models
3. Create initial YAML from current database

### Phase 2: Generator Update
1. Update Rails generator with feature flag
2. Test generation in development
3. Validate generated models
4. Compare with existing models

### Phase 3: Rollout
1. Enable for new models first
2. Gradually migrate existing models
3. Monitor for issues
4. Full deployment

## Success Metrics

- **Zero Manual Model Edits**: All polymorphic relationships auto-generated
- **100% Type Discovery**: All database polymorphic types captured
- **No TypeScript Errors**: Generated code passes all checks
- **< 5 Second Impact**: Generation time within limits
- **Bidirectional Sync**: Rails and TypeScript configs stay synchronized
- **Developer Satisfaction**: No manual polymorphic maintenance

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing code | High | Feature flag, gradual rollout, comprehensive testing |
| Performance degradation | Medium | Query optimization, caching, benchmarking |
| Sync conflicts | Medium | Clear precedence rules, manual override options |
| Missing types | Low | Warning system, manual addition support |

## Dependencies

- EP-0035: Polymorphic Tracking System (COMPLETED)
- Rails 7.x ActiveRecord
- Zero.js schema generation pipeline
- TypeScript 5.x

## Future Enhancements

1. **GraphQL Integration**
   - Auto-generate GraphQL schemas from polymorphic config
   - Dynamic resolver generation

2. **API Documentation**
   - Auto-generate API docs from discovered types
   - OpenAPI schema generation

3. **Database Migrations**
   - Detect schema changes in polymorphic associations
   - Generate migration suggestions

4. **Multi-Database Support**
   - Sync polymorphic types across databases
   - Environment-specific configurations

## References

- EP-0035: Zero.js Polymorphic Association Tracking System
- [Rails Polymorphic Associations Guide](https://guides.rubyonrails.org/association_basics.html#polymorphic-associations)
- [Zero.js Schema Documentation](https://zero.rocicorp.dev)
- Current generator: `lib/zero_schema_generator/`

## Appendix: Example Generated Output

### Before (Current)
```typescript
// src/lib/models/note.ts
export class Note extends BaseModel {
  static tableName = 'notes';
  
  id!: string;
  content?: string;
  notable_type?: string;
  notable_id?: string;
  
  // Hardcoded relationships
  notableJob?: Job;
  notableTask?: Task;
  notableClient?: Client;
  
  static relationships = {
    notableJob: { type: 'belongsTo', model: 'Job' },
    notableTask: { type: 'belongsTo', model: 'Task' },
    notableClient: { type: 'belongsTo', model: 'Client' }
  };
}
```

### After (With Integration)
```typescript
// src/lib/models/note.ts (GENERATED - DO NOT EDIT)
import { BaseModel } from './base/base-model';
import { declarePolymorphicRelationships } from '../zero/polymorphic';

export class Note extends BaseModel {
  static tableName = 'notes';
  
  id!: string;
  content?: string;
  notable_type?: string;
  notable_id?: string;
  
  // Dynamic polymorphic relationships
  static {
    declarePolymorphicRelationships({
      tableName: 'notes',
      belongsTo: {
        notable: {
          typeField: 'notable_type',
          idField: 'notable_id',
          allowedTypes: ['job', 'task', 'client', 'person']
          // Types from config/zero_polymorphic_types.yml
        }
      }
    });
  }
  
  // Reverse relationships automatically registered
  // No hardcoded polymorphic targets
}
```

This integration ensures that the polymorphic tracking system is fully automated, requiring zero manual intervention while maintaining type safety and single-source-of-truth from the Rails database schema.