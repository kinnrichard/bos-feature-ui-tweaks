Add more: create object with nested objects

# EP-0009: ReactiveRecord v3 Implementation Epic

## 🎯 Epic Overview

**Epic ID**: EP-0009  
**Title**: ReactiveRecord v3 Implementation - ActivityLogs, Permissions & Schema Defaults  
**Priority**: High  
**Epic Lead**: BMad Engineering Team  
**Target Milestone**: Q2 2025  
**Architecture Reference**: [tasks/architecture_reactiverecord_v3.md](../architecture_reactiverecord_v3.md)

## 📋 Executive Summary

Implement ReactiveRecord v3 with three strategic enhancements that build upon the proven unified ReactiveRecord foundation:

1. **ActivityLogs Integration**: Client-side activity log generation with server-side validation and authentication
2. **Zero.js Permissions System**: Native integration with Rails/Pundit for seamless authorization patterns  
3. **Schema Defaults Synchronization**: Client-side models automatically inherit Rails schema default values

### Success Criteria
- ✅ **Full Backward Compatibility**: 100% compatibility with existing ReactiveRecord v2 code
- ✅ **Performance**: < 10% performance impact when v3 features are enabled
- ✅ **Rails Integration**: Perfect synchronization with Rails schema, permissions, and audit trail
- ✅ **Developer Experience**: Zero learning curve with familiar Rails patterns
- ✅ **Enterprise Features**: Complete audit trail, permission-based access, data consistency

## 🚀 Implementation Phases

### Phase 1: ActivityLogs Foundation (Weeks 1-2)
**Duration**: 2 weeks  
**Priority**: High  
**Dependencies**: None

#### Deliverables
- [ ] **Client-Side Activity Log Generation System**
  - `ActivityLogTracker<T>` class for client-side log generation
  - Field change detection and tracking
  - Metadata collection (browser, timestamp, etc.)
  - Integration with existing TTL coordination

- [ ] **Server-Side Validation Coordinator**
  - `ActivityLogCoordinator` class for server validation
  - Authentication check: logs must be attributed to authenticated user
  - Batch validation for multiple logs
  - Rails controller: `Api::V1::ActivityLogsController`

- [ ] **Rails Integration**
  - Enhanced ERB templates with ActivityLog configuration
  - Rails model configuration DSL extensions
  - Database migration for ActivityLog model
  - Server-side validation endpoints

#### Tasks Breakdown
1. **Week 1**: Core ActivityLog architecture
   - Implement `ActivityLogTracker<T>` class
   - Build field change detection system
   - Create metadata collection system
   - Basic server validation coordinator

2. **Week 2**: Rails integration and validation
   - Rails controller for activity log validation
   - Enhanced Rails generator with ActivityLog templates
   - Database migrations and model setup
   - Integration testing framework

#### Acceptance Criteria
- ✅ Client generates activity logs with complete field change tracking
- ✅ Server validates all activity logs are attributed to authenticated users
- ✅ Activity logs integrate seamlessly with existing TTL coordination
- ✅ Rails generator produces ActivityLog configuration automatically
- ✅ Performance impact < 5% for activity log generation

### Phase 2: Zero.js Permissions Integration (Weeks 3-4)
**Duration**: 2 weeks  
**Priority**: High  
**Dependencies**: Phase 1 (for activity log permissions)

#### Deliverables
- [ ] **Permission-Aware Query System**
  - `PermissionAwareQuery` class for Rails/Pundit integration
  - `PermissionFilteredQuery<T>` implementation
  - Client-side filtering with server-side validation
  - `RailsPermissionAdapter` for client-side permission checks

- [ ] **Rails/Pundit Integration**
  - Server-side permission validation using existing Pundit policies
  - Client-side permission rules generated from Rails policies
  - Permission context for Zero.js queries
  - Rails controller: `Api::V1::PermissionsController`

- [ ] **Query Enhancement**
  - Permission-aware query builders
  - Automatic client-side filtering
  - Server validation coordination
  - Cache optimization for permission results

#### Tasks Breakdown
1. **Week 3**: Core permissions architecture
   - Implement `PermissionAwareQuery` class
   - Build Rails/Pundit integration layer
   - Create client-side permission filtering
   - Permission rule evaluation system

2. **Week 4**: Server integration and optimization
   - Permission validation controller
   - Enhanced Rails generator with permission config
   - Client-side rule generation from Pundit policies
   - Performance optimization and caching

#### Acceptance Criteria
- ✅ Zero.js queries respect Rails/Pundit permissions seamlessly
- ✅ Client-side filtering matches server-side permission logic exactly
- ✅ Permission validation completes in < 50ms server-side
- ✅ Permission rules auto-generate from existing Pundit policies
- ✅ Cached permission results for optimal performance

### Phase 3: Schema Defaults Synchronization (Weeks 5-6)
**Duration**: 2 weeks  
**Priority**: Medium  
**Dependencies**: None (can run parallel with Phase 2)

#### Deliverables
- [ ] **Default Value System**
  - `DefaultValueProvider` class for Rails schema synchronization
  - `DefaultApplier<T>` for instance-level default application
  - Computed defaults based on other field values
  - Form population integration

- [ ] **Rails Schema Integration**
  - Enhanced Rails generator with schema default extraction
  - Database schema introspection for default values
  - Computed defaults configuration system
  - TypeScript default configuration generation

- [ ] **Client Integration**
  - Automatic form population with schema defaults
  - New record creation with default values applied
  - Conditional default application logic
  - Performance optimization for large datasets

#### Tasks Breakdown
1. **Week 5**: Schema defaults provider
   - Implement `DefaultValueProvider` class
   - Build schema default extraction from Rails
   - Create form population integration
   - Default value resolution system

2. **Week 6**: Rails generator and optimization
   - Enhanced Rails generator with schema defaults
   - Database schema introspection
   - Computed defaults configuration
   - Performance optimization for default application

#### Acceptance Criteria
- ✅ Client models match Rails schema defaults exactly
- ✅ Forms populate automatically with appropriate default values
- ✅ New records inherit all schema defaults consistently
- ✅ Computed defaults work based on other field values
- ✅ Default application completes in < 1ms per record

### Phase 4: V3 Integration & Enhancement (Weeks 7-8)
**Duration**: 2 weeks  
**Priority**: High  
**Dependencies**: Phases 1, 2, 3

#### Deliverables
- [ ] **Unified V3 Architecture**
  - `ReactiveRecordV3<T>` class extending ReactiveRecord
  - `ReactiveInstanceV3<T>` with all V3 features integrated
  - Combined V3 query builders and factory methods
  - Backward compatibility with all V2 features

- [ ] **Advanced V3 Features**
  - `ReactiveV3Builder<T>` for combined feature usage
  - Permission-aware updates with activity logging
  - Schema defaults for new record creation
  - Performance optimization for V3 feature stack

- [ ] **Enhanced Rails Generator**
  - Complete V3 ERB templates with all features
  - Feature-specific configuration blocks
  - Comprehensive TypeScript interface generation
  - V3 helper function generation

#### Tasks Breakdown
1. **Week 7**: ReactiveRecord V3 class architecture
   - Implement `ReactiveRecordV3<T>` class
   - Build `ReactiveInstanceV3<T>` with all features
   - Create unified V3 factory methods
   - Ensure full V2 backward compatibility

2. **Week 8**: Advanced features and optimization
   - Implement combined V3 query builders
   - Create permission-aware update methods
   - Build V3 performance optimization layer
   - Complete Rails generator V3 templates

#### Acceptance Criteria
- ✅ All V2 code continues to work unchanged
- ✅ V3 features integrate seamlessly without conflicts
- ✅ Combined V3 features work together optimally
- ✅ Performance impact < 15ms total overhead for all features
- ✅ Rails generator produces complete V3 configuration

### Phase 5: Testing, Documentation & Polish (Weeks 9-10)
**Duration**: 2 weeks  
**Priority**: High  
**Dependencies**: Phase 4

#### Deliverables
- [ ] **Comprehensive Testing Suite**
  - Unit tests for all V3 features
  - Integration tests for combined functionality
  - Performance benchmarks and regression tests
  - Rails integration testing framework

- [ ] **Complete Documentation**
  - V3 feature documentation with examples
  - Migration guide from V2 to V3
  - API reference for all V3 methods
  - Performance optimization guide

- [ ] **Developer Tools & Support**
  - Troubleshooting guide with common issues
  - Development environment setup
  - Example applications demonstrating V3 features
  - Migration assistance tooling

#### Tasks Breakdown
1. **Week 9**: Comprehensive testing
   - Unit test coverage for all V3 features
   - Integration testing framework
   - Performance benchmarking suite
   - Regression testing automation

2. **Week 10**: Documentation and polish
   - Complete V3 feature documentation
   - Migration guide and examples
   - API reference and troubleshooting guide
   - Final performance optimization

#### Acceptance Criteria
- ✅ 100% test coverage for all V3 features
- ✅ Performance benchmarks meet all targets
- ✅ Complete documentation with working examples
- ✅ Migration path tested and validated
- ✅ Developer tools support V3 development workflow

## 📊 Detailed Task Breakdown

### Phase 1 Tasks (ActivityLogs Foundation)

#### T1.1: Client-Side ActivityLog Architecture
**Estimate**: 3 days  
**Assignee**: Senior Frontend Engineer  
**Priority**: P0

**Implementation Details**:
```typescript
// Core ActivityLogTracker implementation
class ActivityLogTracker<T> {
  constructor(private config: ActivityLogConfig) {}
  
  generateLog(entity: T, changes: FieldChanges): ActivityLogEntry
  trackChanges(oldData: T, newData: T): FieldChange[]
  collectMetadata(): ActivityLogMetadata
  attachLogs(entity: T): T & { activityLogs?: ActivityLogEntry[] }
}
```

**Deliverables**:
- [ ] `ActivityLogTracker<T>` class implementation
- [ ] Field change detection system
- [ ] Metadata collection framework
- [ ] Unit tests with 100% coverage

#### T1.2: Server-Side Validation System
**Estimate**: 3 days  
**Assignee**: Senior Backend Engineer  
**Priority**: P0

**Implementation Details**:
```ruby
# Rails controller for activity log validation
class Api::V1::ActivityLogsController < Api::V1::BaseController
  def validate
    # Server validation: Must be attributed to authenticated user
    # Additional validation: User must have permission for entity
    # Create server-side ActivityLog record
  end
end
```

**Deliverables**:
- [ ] Rails ActivityLog validation controller
- [ ] Authentication and authorization checks
- [ ] Database model and migrations
- [ ] API endpoint integration tests

#### T1.3: Rails Generator Enhancement
**Estimate**: 4 days  
**Assignee**: Full-Stack Engineer  
**Priority**: P1

**Implementation Details**:
```erb
<!-- Enhanced ERB template with ActivityLog features -->
<% if activity_logs_enabled? -%>
// V3 Feature: ActivityLogs integration
activityLogConfig: {
  entityType: '<%= class_name %>',
  trackFields: <%= tracked_fields.to_json %>,
  serverValidation: true,
  clientGeneration: true
}
<% end -%>
```

**Deliverables**:
- [ ] Enhanced ERB templates with ActivityLog config
- [ ] Rails model DSL extensions for ActivityLog
- [ ] Generator configuration validation
- [ ] Template integration tests

### Phase 2 Tasks (Permissions Integration)

#### T2.1: Permission-Aware Query System
**Estimate**: 4 days  
**Assignee**: Senior Frontend Engineer  
**Priority**: P0

**Implementation Details**:
```typescript
// Core permission system implementation
class PermissionAwareQuery {
  withPermissions<T>(baseQuery: IReactiveQuery<T>, user: User, action: string): PermissionFilteredQuery<T>
  validatePermissions(query: ZeroQuery, context: UserContext): Promise<PermissionValidationResult>
  applyClientFilters<T>(data: T[], permissions: PermissionRuleSet): T[]
}
```

**Deliverables**:
- [ ] `PermissionAwareQuery` class implementation
- [ ] `PermissionFilteredQuery<T>` with reactive subscriptions
- [ ] Client-side permission filtering logic
- [ ] Permission rule evaluation engine

#### T2.2: Rails/Pundit Integration
**Estimate**: 4 days  
**Assignee**: Senior Backend Engineer  
**Priority**: P0

**Implementation Details**:
```ruby
# Permission validation using existing Pundit policies
class Api::V1::PermissionsController < Api::V1::BaseController
  def validate
    # Extract entity information from Zero.js query
    # Check permissions using existing Pundit policies
    # Return permission context for client-side filtering
  end
end
```

**Deliverables**:
- [ ] Permission validation controller
- [ ] Pundit policy integration
- [ ] Client-side rule generation from policies
- [ ] Permission caching optimization

#### T2.3: Query Builder Enhancement
**Estimate**: 2 days  
**Assignee**: Frontend Engineer  
**Priority**: P1

**Deliverables**:
- [ ] Permission-aware query builders
- [ ] Automatic client-side filtering
- [ ] Permission context integration
- [ ] Performance optimization for permission checks

### Phase 3 Tasks (Schema Defaults)

#### T3.1: Default Value Provider System
**Estimate**: 3 days  
**Assignee**: Frontend Engineer  
**Priority**: P1

**Implementation Details**:
```typescript
// Schema defaults synchronization
class DefaultValueProvider {
  getDefaults(modelName: string): Record<string, any>
  applyDefaults<T>(data: Partial<T>, modelName?: string): T
  populateForm(formData: FormData, modelName: string): FormData
}
```

**Deliverables**:
- [ ] `DefaultValueProvider` class implementation
- [ ] Schema default value extraction
- [ ] Form population integration
- [ ] Computed defaults support

#### T3.2: Rails Schema Integration
**Estimate**: 4 days  
**Assignee**: Full-Stack Engineer  
**Priority**: P1

**Implementation Details**:
```ruby
# Rails schema introspection for defaults
class ZeroSchemaGenerator::DefaultsExtractor
  def extract_defaults(model_class)
    # Extract from database schema
    # Parse default value expressions
    # Generate TypeScript default configuration
  end
end
```

**Deliverables**:
- [ ] Schema introspection system
- [ ] Default value extraction from Rails
- [ ] TypeScript configuration generation
- [ ] Computed defaults configuration

#### T3.3: Client Integration Optimization
**Estimate**: 3 days  
**Assignee**: Frontend Engineer  
**Priority**: P2

**Deliverables**:
- [ ] Optimized default application for large datasets
- [ ] Lazy computation for computed defaults
- [ ] Memoization for performance
- [ ] Batch application for collections

### Phase 4 Tasks (V3 Integration)

#### T4.1: ReactiveRecord V3 Architecture
**Estimate**: 5 days  
**Assignee**: Senior Frontend Engineer  
**Priority**: P0

**Implementation Details**:
```typescript
// Unified V3 architecture
class ReactiveRecordV3<T> extends ReactiveRecord<T> {
  static createModel<T>(config: ModelConfigV3): UnifiedReactiveModelV3<T>
  // Integrate all V3 features while maintaining V2 compatibility
}
```

**Deliverables**:
- [ ] `ReactiveRecordV3<T>` class implementation
- [ ] `ReactiveInstanceV3<T>` with all features
- [ ] V2 backward compatibility validation
- [ ] V3 factory method integration

#### T4.2: Combined Feature Integration
**Estimate**: 4 days  
**Assignee**: Senior Frontend Engineer  
**Priority**: P0

**Implementation Details**:
```typescript
// Combined V3 features working together
class ReactiveV3Builder<T> {
  withV3Features(user: User, options: V3Options): ReactiveInstanceV3<T>
  // Activity logs + Permissions + Defaults in unified interface
}
```

**Deliverables**:
- [ ] Combined V3 query builders
- [ ] Permission-aware updates with activity logging
- [ ] V3 performance optimization layer
- [ ] Feature interaction testing

#### T4.3: Rails Generator V3 Templates
**Estimate**: 3 days  
**Assignee**: Full-Stack Engineer  
**Priority**: P1

**Deliverables**:
- [ ] Complete V3 ERB templates
- [ ] Feature-specific configuration blocks
- [ ] TypeScript interface generation for V3
- [ ] V3 helper function generation

### Phase 5 Tasks (Testing & Documentation)

#### T5.1: Comprehensive Testing Suite
**Estimate**: 5 days  
**Assignee**: QA Engineer + Frontend Engineer  
**Priority**: P0

**Test Coverage Requirements**:
```typescript
describe('ReactiveRecord V3 Features', () => {
  describe('ActivityLogs', () => {
    test('client generation with server validation')
    test('permission-based activity log access') 
    test('integration with TTL coordination')
  });
  
  describe('Permissions', () => {
    test('Rails/Pundit integration')
    test('client-side permission filtering')
    test('server-side validation')
  });
  
  describe('Schema Defaults', () => {
    test('default value application')
    test('computed defaults')
    test('form population')
  });
});
```

**Deliverables**:
- [ ] 100% unit test coverage for all V3 features
- [ ] Integration test suite for combined functionality
- [ ] Performance benchmark suite
- [ ] Regression testing framework

#### T5.2: Complete Documentation
**Estimate**: 4 days  
**Assignee**: Technical Writer + Engineering Team  
**Priority**: P0

**Documentation Structure**:
```markdown
# ReactiveRecord V3 Documentation
├── Migration Guide (V2 → V3)
├── Feature Documentation
│   ├── ActivityLogs Usage
│   ├── Permissions Integration  
│   └── Schema Defaults
├── API Reference
├── Performance Guide
└── Troubleshooting
```

**Deliverables**:
- [ ] Complete V3 feature documentation with examples
- [ ] Step-by-step migration guide from V2 to V3
- [ ] Comprehensive API reference
- [ ] Performance optimization guide

#### T5.3: Developer Tools & Support
**Estimate**: 3 days  
**Assignee**: DevOps Engineer + Frontend Engineer  
**Priority**: P1

**Deliverables**:
- [ ] Troubleshooting guide with common issues and solutions
- [ ] Example applications demonstrating V3 features
- [ ] Development environment setup documentation
- [ ] Migration assistance tooling

## 🎯 Success Metrics & KPIs

### Technical Performance Metrics
- **Backward Compatibility**: 100% V2 code compatibility maintained
- **Performance Impact**: < 10% overhead when V3 features enabled
- **Memory Efficiency**: < 100KB additional memory per 1000 V3-enhanced records
- **Query Performance**: All V3 features combined < 15ms total overhead
- **Server Response**: Activity log validation < 100ms, permission validation < 50ms

### Feature-Specific Metrics
- **ActivityLogs**: Client generation < 5ms, field change detection < 2ms
- **Permissions**: Client filtering < 2ms per record, server validation < 50ms  
- **Schema Defaults**: Form population < 1ms, default application < 0.5ms
- **Combined Features**: All V3 features together < 15ms total overhead

### Developer Experience Metrics
- **Learning Curve**: Zero additional learning for Rails developers
- **Type Safety**: 100% TypeScript support for all V3 features
- **Documentation Coverage**: Complete examples for all V3 use cases
- **Migration Success**: 100% successful V2 to V3 migrations in testing

### Business Value Metrics
- **Compliance**: Complete audit trail for regulatory requirements
- **Security**: Permission-based data access with Rails/Pundit integration
- **Data Quality**: Consistent defaults across client and server
- **Developer Velocity**: Reduced boilerplate for common patterns

## 🔧 Technical Dependencies

### External Dependencies
- **Rails 7.0+**: Required for enhanced generator features
- **Zero.js**: Core reactive query system (existing)
- **Pundit**: Rails authorization library (existing)
- **TypeScript 5.0+**: Required for V3 type definitions

### Internal Dependencies
- **ReactiveRecord V2**: Base architecture (existing)
- **TTL Coordination**: Existing coordination system
- **Rails Generator**: Existing Zero.js Rails generator
- **Computed Properties**: Existing computed properties system

### Infrastructure Dependencies
- **Database**: PostgreSQL/MySQL for ActivityLog storage
- **Redis**: Permission caching (optional but recommended)
- **API Endpoints**: New V3 validation endpoints
- **Build System**: Enhanced TypeScript compilation

## 🚨 Risks & Mitigation

### High-Risk Items
1. **Performance Impact**: V3 features could slow down queries
   - **Mitigation**: Extensive performance testing, feature toggles, caching optimization
   
2. **Backward Compatibility**: Breaking existing V2 code
   - **Mitigation**: Comprehensive compatibility testing, gradual migration path
   
3. **Complex Feature Interactions**: ActivityLogs + Permissions + Defaults
   - **Mitigation**: Isolated feature testing, integration test suite

### Medium-Risk Items
1. **Rails Integration Complexity**: Generator and template complexity
   - **Mitigation**: Incremental development, comprehensive testing
   
2. **Permission Rule Synchronization**: Client/server rule mismatch
   - **Mitigation**: Automated rule generation, validation testing

3. **Schema Default Extraction**: Complex default value parsing
   - **Mitigation**: Robust parsing logic, fallback mechanisms

### Low-Risk Items
1. **Documentation Completeness**: Missing edge cases
   - **Mitigation**: Community feedback, iterative documentation
   
2. **Developer Adoption**: Learning curve for new features
   - **Mitigation**: Clear examples, gradual feature introduction

## 🗓️ Timeline & Milestones

### Major Milestones
- **Week 2**: ✅ ActivityLogs Foundation Complete
- **Week 4**: ✅ Permissions Integration Complete  
- **Week 6**: ✅ Schema Defaults Complete
- **Week 8**: ✅ V3 Integration Complete
- **Week 10**: ✅ Testing & Documentation Complete

### Sprint Planning
- **Sprint 1 (Weeks 1-2)**: ActivityLogs Foundation
- **Sprint 2 (Weeks 3-4)**: Permissions Integration
- **Sprint 3 (Weeks 5-6)**: Schema Defaults + V3 Integration Start
- **Sprint 4 (Weeks 7-8)**: V3 Integration Complete
- **Sprint 5 (Weeks 9-10)**: Testing, Documentation & Polish

### Key Deliverable Dates
- **Week 2**: ActivityLog client generation and server validation working
- **Week 4**: Permission-aware queries with Rails/Pundit integration
- **Week 6**: Schema defaults synchronized and form population working
- **Week 8**: Complete V3 architecture with all features integrated
- **Week 10**: Production-ready V3 with full documentation

## 🔄 Migration Strategy

### V2 to V3 Migration Path
1. **Phase 1**: Enable V3 features gradually (defaults first, then permissions, finally activity logs)
2. **Phase 2**: Test V3 features in isolation before combining
3. **Phase 3**: Migrate to combined V3 features
4. **Phase 4**: Optimize and fine-tune V3 implementation

### Migration Support
- **Compatibility Testing**: Automated testing for V2 code on V3 system
- **Feature Toggles**: Ability to enable/disable V3 features independently  
- **Migration Tools**: Automated assistance for V2 to V3 configuration migration
- **Documentation**: Step-by-step migration guide with examples

## 📋 Definition of Done

### Epic Complete Criteria
- [ ] All V3 features implemented and integrated
- [ ] 100% backward compatibility with V2 maintained
- [ ] All performance targets met
- [ ] Comprehensive test coverage (>95%)
- [ ] Complete documentation with examples
- [ ] Migration path tested and validated
- [ ] Production deployment successful
- [ ] Developer feedback incorporated

### Quality Gates
- [ ] **Code Review**: All code reviewed by senior engineers
- [ ] **Performance Testing**: All performance benchmarks passed
- [ ] **Security Review**: Permission system security validated
- [ ] **Documentation Review**: All documentation reviewed and approved
- [ ] **Migration Testing**: V2 to V3 migration tested successfully

---

## 📞 Epic Coordination

**Epic Owner**: BMad Engineering Team  
**Architecture Lead**: Senior Full-Stack Engineer  
**Frontend Lead**: Senior Frontend Engineer  
**Backend Lead**: Senior Backend Engineer  
**QA Lead**: Senior QA Engineer  
**Documentation Lead**: Technical Writer

**Slack Channel**: #reactiverecord-v3  
**Meeting Schedule**: Weekly V3 sync (Wednesdays 2PM)  
**Status Updates**: Bi-weekly to engineering leadership  

**Architecture Reference**: This epic implements the comprehensive plan detailed in [tasks/architecture_reactiverecord_v3.md](../architecture_reactiverecord_v3.md)

---

*This epic represents a major advancement in our reactive data layer, providing enterprise-grade features while maintaining the developer experience and performance characteristics that make ReactiveRecord powerful. The phased approach ensures a smooth migration path and minimizes risk while delivering significant business value through improved audit trails, security, and data consistency.*