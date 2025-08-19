---
epic_id: EP-0004
title: Zero.js Client with Rails Backend Integration for Optimistic Updates
description: Transform the existing Rails application into a modern, real-time collaborative platform by integrating Zero.js client with optimistic updates while preserving all existing Rails business logic, validations, and complex domain patterns
status: completed
priority: high
assignee: unassigned
created_date: 2025-07-19T14:25:00.000Z
updated_date: 2025-07-21T18:47:00.000Z
estimated_tokens: 4000
actual_tokens: 3800
estimated_hours: 16-20
ai_context:
  - zero-js
  - optimistic-updates
  - real-time
  - collaboration
  - rails-integration
related_issues: []
sync_status: local
tags:
  - infrastructure
  - real-time
  - collaboration
  - user-experience
milestone: zero-integration
epic_type: technical-infrastructure
---

# Epic: Zero.js Client with Rails Backend Integration for Optimistic Updates

## Overview
Transform the existing Rails application into a modern, real-time collaborative platform by integrating Zero.js client with optimistic updates while preserving all existing Rails business logic, validations, and complex domain patterns. This brownfield integration approach maintains system stability while delivering cutting-edge user experience.

## Business Value

**Key Benefits:**
- **Instant UI responsiveness** - Zero latency for user interactions through optimistic updates
- **Real-time collaboration** - Multiple users can work on jobs/tasks simultaneously
- **Preserved business logic** - Keep Rails callbacks, validations, positioning logic intact
- **Contract safety** - Frontend/backend mutation alignment through automated testing
- **Progressive enhancement** - Gradual migration from existing UI to Zero-powered components
- **Developer productivity** - Type-safe client generated from Rails schema

## Current State Analysis

### Existing Rails Architecture Strengths
- **Rich business logic**: Complex task positioning, counter caches, job workflows
- **Robust validations**: Server-side validation with comprehensive error handling
- **Established patterns**: ActiveRecord callbacks, service objects, serializers
- **Complex relationships**: Jobs → Tasks (positioning), Users ↔ Jobs (assignments), Clients ↔ Jobs
- **Audit trails**: Activity logging with comprehensive metadata tracking
- **Authentication/Authorization**: JWT-based auth with user role management

### Pain Points Requiring Zero.js
1. **Manual optimistic updates** - Complex rollback logic and race conditions
2. **Limited real-time sync** - ActionCable overhead for frequent updates
3. **State management complexity** - Manual coordination between UI components
4. **Network dependency** - Poor offline/poor network experience
5. **Collaboration limitations** - Conflicts when multiple users edit same entities
6. **Development overhead** - Repetitive AJAX patterns for each entity type

### Field Permission Analysis
Based on system analysis, complex server-calculated fields include:
- **Server-only fields**: `activity_logs.*`, `updated_at`, `name_normalized`, `formatted_value`
- **Sequence fields**: `instance_number` (auto-incremented)
- **Derived fields**: Positioning logic, counter caches, relationship validations
- **Client-writable fields**: Entity names, descriptions, relationships, status enums

## Objectives

### Primary Goals
1. [ ] **Zero.js Client Integration**: Set up Zero client with Rails backend synchronization
2. [ ] **Rails API Optimization**: Create Zero-optimized endpoints while preserving business logic
3. [ ] **Type Generation Pipeline**: Automated TypeScript generation from Rails schema
4. [ ] **Contract Testing Infrastructure**: Ensure frontend/backend mutation alignment
5. [ ] **Progressive Migration Strategy**: Incremental adoption without breaking existing functionality

### Implementation Phases
- [ ] Phase 1: Foundation Infrastructure - Zero.js backend config and client setup
- [ ] Phase 2: Type Generation Pipeline - Rails schema to TypeScript types
- [ ] Phase 3: API Enhancement - Zero-optimized endpoints preserving business logic
- [ ] Phase 4: Progressive Migration - Component-by-component migration strategy
- [ ] Phase 5: Contract Testing - Automated tests for mutation alignment
- [ ] Phase 6: Real-time Features - Collaboration and conflict resolution
- [ ] Phase 7: Production Deployment - Monitoring and rollout strategy

## Success Criteria

### Technical Metrics
- **<100ms perceived response time** for all CRUD operations
- **100% business logic preservation** - All Rails validations, callbacks, positioning logic maintained
- **Zero data loss** during optimistic updates and conflict resolution
- **Contract compliance** - 100% passing contract tests between frontend mutations and Rails API
- **Type safety** - Zero TypeScript errors in generated client code
- **Progressive migration** - Ability to migrate individual UI components incrementally

### User Experience Metrics
- **Zero regression** in existing Rails functionality
- **All Playwright tests** continue passing throughout migration
- **Real-time sync** working for all major entities (Jobs, Tasks, Clients, Users)
- **Optimistic updates** with proper conflict resolution
- **Improved collaboration** - Multiple users can work simultaneously without conflicts

## Technical Architecture

### Zero-Rails Hybrid Architecture
- Browser Client: Svelte UI + Zero Client + Generated Types
- Rails Backend: Zero API + Rails Models + Business Logic
- Data Layer: PostgreSQL Primary DB + Zero CVR + Zero CDB

### Key Capabilities Post-Integration
- **Instant UI updates** with automatic rollback on server rejection
- **Real-time collaboration** with conflict-free merged resolution (CRDT)
- **Offline-first operation** with automatic sync when connection restored
- **Type-safe mutations** generated from Rails schema with validation rules
- **Progressive enhancement** - migrate individual components without breaking existing functionality
- **Contract testing** ensuring frontend mutations match Rails API expectations

## Related Issues
(To be created for each implementation phase)

## Notes
- This is a brownfield integration preserving all existing Rails functionality
- Progressive migration allows gradual adoption without big-bang rewrites
- Contract testing ensures frontend/backend alignment throughout migration
- Type generation provides compile-time safety for all mutations