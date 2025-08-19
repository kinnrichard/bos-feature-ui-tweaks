# Workflow Plan: Rails-to-Zero Schema Generator

<!-- WORKFLOW-PLAN-META
workflow-id: brownfield-fullstack
status: active
created: 2025-07-10T00:00:00Z
updated: 2025-07-10T00:00:00Z
version: 1.0
-->

**Created Date**: July 10, 2025
**Project**: Rails-to-Zero Schema Generator
**Type**: Brownfield Enhancement
**Status**: Active
**Estimated Planning Duration**: 4 weeks (phased implementation)

## Objective

Implement an automated system that generates Zero schema definitions from Rails database schemas, eliminating manual schema drift and reducing maintenance overhead through automated generation pipeline.

## Selected Workflow

**Workflow**: `brownfield-fullstack`
**Reason**: This is a substantial feature requiring backend Rails components, frontend TypeScript integration, CI/CD pipeline changes, and comprehensive testing across multiple layers.

## Workflow Steps

### Planning Phase

- [ ] Step 1: Architecture Review & Gap Analysis <!-- step-id: 1.1, agent: architect, task: analyze-existing-system -->
  - **Agent**: System Architect
  - **Action**: Review current Rails/Zero integration, identify schema drift patterns
  - **Output**: Gap analysis document with current state assessment
  - **User Input**: Confirm current Zero schema location and patterns

- [ ] Step 2: Technical Specification Refinement <!-- step-id: 1.2, agent: architect, task: refine-technical-spec -->
  - **Agent**: Technical Architect
  - **Action**: Refine architecture document with implementation details
  - **Output**: Detailed technical specification
  - **Decision Point**: Choose Phase 1 scope (basic vs. advanced introspection) <!-- decision-id: D1 -->

- [ ] Step 3: Story Creation & Backlog Planning <!-- step-id: 1.3, agent: po, task: create-epic-stories -->
  - **Agent**: Product Owner
  - **Action**: Break down 4-phase implementation into user stories
  - **Output**: Stories in `docs/stories/` directory
  - **User Input**: Prioritize Phase 1 features

### Development Phase (IDE)

- [ ] Document Sharding <!-- step-id: 2.1, agent: po, task: shard-doc -->
  - Prepare architecture document for story creation
  - Split into implementation-focused sections

- [ ] Phase 1: Foundation (Week 1) <!-- step-id: 2.2, phase: 1 -->
  - [ ] Create Rails Schema Introspector <!-- step-id: 2.2.1, agent: backend-dev, task: implement-introspector -->
  - [ ] Implement Basic Type Mapping <!-- step-id: 2.2.2, agent: backend-dev, task: implement-type-mapper -->
  - [ ] Create Rails Task Interface <!-- step-id: 2.2.3, agent: backend-dev, task: implement-rails-task -->
  - [ ] Basic Zero Schema Generation <!-- step-id: 2.2.4, agent: backend-dev, task: implement-basic-generation -->
  - [ ] Phase 1 Testing <!-- step-id: 2.2.5, agent: qa, task: test-phase-1 -->

- [ ] Phase 2: Relationships (Week 2) <!-- step-id: 2.3, phase: 2 -->
  - [ ] Relationship Analysis Engine <!-- step-id: 2.3.1, agent: backend-dev, task: implement-relationship-analyzer -->
  - [ ] Zero Relationship Generation <!-- step-id: 2.3.2, agent: backend-dev, task: implement-zero-relationships -->
  - [ ] Handle Complex Relationships <!-- step-id: 2.3.3, agent: backend-dev, task: handle-complex-relationships -->
  - [ ] Phase 2 Testing <!-- step-id: 2.3.4, agent: qa, task: test-phase-2 -->

- [ ] Phase 3: Production Ready (Week 3) <!-- step-id: 2.4, phase: 3 -->
  - [ ] Incremental Update Detection <!-- step-id: 2.4.1, agent: backend-dev, task: implement-change-detection -->
  - [ ] Customization Preservation <!-- step-id: 2.4.2, agent: backend-dev, task: implement-customization-system -->
  - [ ] TypeScript Interface Generation <!-- step-id: 2.4.3, agent: frontend-dev, task: implement-typescript-generation -->
  - [ ] Schema Validation System <!-- step-id: 2.4.4, agent: backend-dev, task: implement-validation -->
  - [ ] Phase 3 Testing <!-- step-id: 2.4.5, agent: qa, task: test-phase-3 -->

- [ ] Phase 4: Integration (Week 4) <!-- step-id: 2.5, phase: 4 -->
  - [ ] CI/CD Pipeline Integration <!-- step-id: 2.5.1, agent: devops, task: implement-ci-cd -->
  - [ ] Migration from Current Schema <!-- step-id: 2.5.2, agent: backend-dev, task: implement-migration-path -->
  - [ ] Performance Optimization <!-- step-id: 2.5.3, agent: backend-dev, task: implement-performance-optimizations -->
  - [ ] Documentation & Training <!-- step-id: 2.5.4, agent: tech-writer, task: create-documentation -->
  - [ ] End-to-End Testing <!-- step-id: 2.5.5, agent: qa, task: e2e-testing -->

- [ ] Final Integration Review <!-- step-id: 2.6, agent: architect, task: final-review -->

## Key Decision Points

1. **Phase 1 Scope Definition** (Step 1.2): <!-- decision-id: D1, status: pending -->
   - Trigger: Architecture review completion
   - Options: Basic introspection vs. Advanced with caching
   - Impact: Determines Phase 1 timeline and complexity
   - Decision Made: _Pending_

2. **Type Mapping Strategy** (Step 2.2.2): <!-- decision-id: D2, status: pending -->
   - Trigger: During type mapper implementation
   - Options: Conservative mapping vs. Aggressive with fallbacks
   - Impact: Affects schema generation accuracy
   - Decision Made: _Pending_

3. **Relationship Handling Approach** (Step 2.3.1): <!-- decision-id: D3, status: pending -->
   - Trigger: Complex relationship discovery
   - Options: Full Rails introspection vs. Simplified mapping
   - Impact: Determines relationship generation completeness
   - Decision Made: _Pending_

4. **Customization Preservation Method** (Step 2.4.2): <!-- decision-id: D4, status: pending -->
   - Trigger: During customization system design
   - Options: File-based vs. Database-based preservation
   - Impact: Affects user experience and maintainability
   - Decision Made: _Pending_

## Expected Outputs

### Planning Documents
- [ ] Gap Analysis Report - Current state vs. target architecture
- [ ] Refined Technical Specification - Implementation-ready architecture
- [ ] Phase 1-4 User Stories - Detailed implementation stories
- [ ] Risk Assessment - Identified risks and mitigation strategies

### Development Artifacts
- [ ] Stories in `docs/stories/` - Individual implementation stories
- [ ] Rails Generator Code - `lib/zero_schema_generator/` components
- [ ] Rails Tasks - `lib/tasks/zero.rake` 
- [ ] TypeScript Schema Output - Generated Zero schema files
- [ ] CI/CD Integration - GitHub Actions workflow
- [ ] Test Suite - RSpec tests for all components
- [ ] Documentation - Setup and usage guides

## Prerequisites Checklist

Before starting this workflow, ensure you have:

- [ ] Access to Rails application with existing Zero integration
- [ ] Understanding of current Zero schema structure
- [ ] Database access for schema introspection
- [ ] TypeScript/Node.js environment for frontend integration
- [ ] CI/CD pipeline access (GitHub Actions)
- [ ] Test database for development
- [ ] Team alignment on 4-week implementation timeline

## Customization Options

Based on your project needs, you may:
- Skip CI/CD integration if deploying manually
- Add monitoring/observability if production-critical
- Choose simplified relationship mapping if complex associations aren't needed
- Implement only specific phases if timeline is constrained

## Risk Considerations

- **Integration complexity**: Existing Zero schema may have manual customizations
- **Rollback strategy**: Maintain current schema generation process during development
- **Testing requirements**: Need comprehensive test coverage for database introspection
- **Performance impact**: Schema generation should not affect application performance
- **Type safety**: Generated TypeScript must maintain existing type contracts

## Next Steps

1. Review this plan and confirm it matches your expectations
2. Gather any missing prerequisites (database access, Zero schema review)
3. Start workflow with Phase 1 foundation work
4. Begin with: `*task brownfield-create-story` for Phase 1 stories

## Notes

- Each phase has clear deliverables and success criteria
- Testing should be integrated into each phase, not deferred
- Consider running Phase 1 in parallel with planning for Phase 2
- Document all design decisions for future reference
- Maintain backward compatibility throughout implementation

---
*This plan can be updated as you progress through the workflow. Check off completed items to track progress.*