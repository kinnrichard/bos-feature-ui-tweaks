# Epic-004: Zero Migration

**Epic ID:** Epic-004  
**Priority:** High  
**Epic Type:** Technical Infrastructure  
**Estimated Effort:** 3-4 sprints  
**Status:** Planning  

## Executive Summary

Migrate the bŏs frontend from TanStack Query to Zero for real-time, local-first data management. This migration will eliminate complex query management patterns, enable real-time collaboration, and provide robust offline capabilities while maintaining all existing functionality.

## Strategic Rationale

### Why Zero?
- **Real-time by default**: Automatic synchronization across all connected clients
- **Local-first architecture**: Data lives locally with server sync, improving performance
- **Simplified state management**: No manual cache invalidation or optimistic updates
- **Offline resilience**: Application continues working without internet connection
- **Developer experience**: Cleaner, more maintainable codebase

### Business Value
- **Improved user experience**: Real-time updates for collaborative job management
- **Reduced technical debt**: Eliminate complex TanStack Query patterns
- **Future-ready architecture**: Foundation for advanced collaboration features
- **Development velocity**: Simpler patterns reduce development time

## Current State Analysis

### TanStack Query Usage
- **7 files** with TanStack imports
- **Complex mutation factories** with optimistic updates
- **Manual cache invalidation** patterns
- **Sophisticated persistence layer** for offline support
- **Entity-specific query hooks** for Jobs, Tasks, Users

### Pain Points
1. **Complex optimistic updates**: Manual rollback logic and error handling
2. **Cache invalidation complexity**: Manual coordination between mutations
3. **Persistence overhead**: Custom localStorage implementation
4. **Query coordination**: Complex interdependencies between entities
5. **Development overhead**: Boilerplate for each new entity type

### Technical Debt Assessment
- **High complexity** in mutation-factories.ts (235 lines)
- **Extensive cache management** in query-client.ts (228 lines)
- **Manual relationship management** in API layer
- **Custom error handling** throughout query hooks

## Target State Vision

### Zero-Powered Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Svelte UI     │    │   Zero Client   │    │  Rails + Zero   │
│                 │    │                 │    │                 │
│ - Reactive      │◄──►│ - Local Store   │◄──►│ - CVR Database  │
│ - Real-time     │    │ - Sync Engine   │    │ - CDB Database  │
│ - Offline       │    │ - Conflict Res. │    │ - JWT Auth      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Capabilities
- **Real-time updates**: Changes sync automatically across all clients
- **Optimistic UI**: Zero handles optimistic updates and conflict resolution
- **Offline-first**: Full functionality without internet connection
- **Collaborative editing**: Multiple users can edit jobs simultaneously
- **Simplified codebase**: Remove 500+ lines of query management code

## Technical Objectives

### Primary Goals
1. **Complete TanStack replacement**: Remove all @tanstack/svelte-query usage
2. **Maintain functionality**: Zero regression in existing features
3. **Enable real-time sync**: Automatic updates across connected clients
4. **Improve performance**: Leverage Zero's optimized local storage
5. **Simplify codebase**: Reduce query management complexity by 70%

### Success Metrics
- **Zero TanStack imports** remaining in codebase
- **All Playwright tests that currently pass should pass** after migration
- **Real-time sync working** for all entities
- **Offline functionality** maintained
- **Bundle size reduction** of at least 100KB

## Migration Strategy

### Phase 1: Foundation Setup (Sprint 1)
**Backend Infrastructure**
- Configure PostgreSQL for Zero (primary + CVR + CDB databases)
- Implement JWT authentication for Zero
- Set up Zero server-side configuration
- Define Zero schema for all entities

**Frontend Preparation**
- Install zero-svelte and dependencies
- Configure Zero client connection
- Disable SSR for Zero compatibility
- Set up development environment

### Phase 2: Core Entity Migration (Sprint 2)
**Users & Authentication**
- Migrate user queries to Zero
- Implement Zero-based authentication flow
- Replace user-related TanStack hooks
- Test real-time user updates

**Clients Entity**
- Migrate client queries and mutations
- Remove client-specific TanStack patterns
- Implement Zero-based client management
- Validate client relationship handling

### Phase 3: Jobs & Tasks Migration (Sprint 3)
**Jobs Entity**
- Migrate complex job queries with relationships
- Replace job mutation factories
- Implement Zero-based job management
- Test real-time job updates and collaboration

**Tasks Entity**
- Migrate hierarchical task queries
- Implement Zero-based task relationships
- Replace task reordering with Zero mutations
- Test real-time task updates

### Phase 4: Cleanup & Optimization (Sprint 4)
**Code Removal**
- Remove TanStack Query dependencies
- Delete query-client.ts and mutation-factories.ts
- Clean up old persistence layer
- Remove optimistic update patterns

**Zero Optimization**
- Implement Zero-specific optimizations
- Add conflict resolution strategies
- Fine-tune sync performance
- Add Zero-specific error handling

## Story Breakdown

### Epic-004-Story-001: Zero Backend Setup
**Acceptance Criteria:**
- [ ] Three PostgreSQL databases configured (primary, CVR, CDB)
- [ ] JWT authentication working with Zero
- [ ] Zero schema defined for all entities
- [ ] Backend serving Zero sync endpoints

**Estimated Effort:** 5 story points

### Epic-004-Story-002: Zero Frontend Foundation
**Acceptance Criteria:**
- [ ] zero-svelte installed and configured
- [ ] Zero client connecting to backend
- [ ] SSR disabled appropriately
- [ ] Development environment working

**Estimated Effort:** 3 story points

### Epic-004-Story-003: Users & Auth Migration
**Acceptance Criteria:**
- [ ] All user queries using Zero
- [ ] Authentication flow Zero-based
- [ ] Real-time user updates working
- [ ] No TanStack imports in user code

**Estimated Effort:** 5 story points

### Epic-004-Story-004: Clients Migration
**Acceptance Criteria:**
- [ ] Client queries and mutations using Zero
- [ ] Client relationships working
- [ ] Real-time client updates
- [ ] Client tests passing

**Estimated Effort:** 3 story points

### Epic-004-Story-005: Jobs Migration
**Acceptance Criteria:**
- [ ] Job queries with relationships using Zero
- [ ] Job mutations simplified with Zero
- [ ] Real-time job collaboration working
- [ ] Job workflow tests passing

**Estimated Effort:** 8 story points

### Epic-004-Story-006: Tasks Migration
**Acceptance Criteria:**
- [ ] Task hierarchies working with Zero
- [ ] Task reordering using Zero
- [ ] Real-time task updates
- [ ] Task tests passing

**Estimated Effort:** 8 story points

### Epic-004-Story-007: TanStack Cleanup
**Acceptance Criteria:**
- [ ] @tanstack/svelte-query uninstalled
- [ ] All TanStack code removed
- [ ] Bundle size reduced
- [ ] All tests still passing

**Estimated Effort:** 2 story points

### Epic-004-Story-008: Zero Optimization
**Acceptance Criteria:**
- [ ] Conflict resolution implemented
- [ ] Performance optimized
- [ ] Error handling improved
- [ ] Documentation updated

**Estimated Effort:** 5 story points

## Risk Assessment & Mitigation

### High Risks
1. **Data sync complexity**: Zero's learning curve for complex relationships
   - *Mitigation*: Start with simple entities, thorough testing
2. **Performance impact**: Unknown performance characteristics
   - *Mitigation*: Benchmark before/after, optimize incrementally
3. **Breaking changes**: Potential functionality loss during migration
   - *Mitigation*: Comprehensive test coverage, story-by-story validation

### Medium Risks
1. **Team learning curve**: Zero is new technology
   - *Mitigation*: Documentation, pair programming, gradual introduction
2. **Backend complexity**: Multiple database setup
   - *Mitigation*: Follow Zero documentation precisely, staging environment testing

### Low Risks
1. **Third-party dependencies**: Zero's stability
   - *Mitigation*: Zero is production-ready, active community support

## Dependencies

### External Dependencies
- PostgreSQL 15.0+ with logical replication
- Zero server infrastructure
- JWT authentication system

### Internal Dependencies
- Existing Playwright test suite
- Current API authentication
- Database migration capabilities

## Success Criteria

### Technical Success
- [ ] Zero TanStack Query imports in codebase
- [ ] All existing functionality preserved
- [ ] Real-time sync working for all entities
- [ ] Offline functionality maintained
- [ ] All Playwright tests passing

### Performance Success
- [ ] Bundle size reduced by 100KB+
- [ ] Initial load time improved
- [ ] Real-time updates < 100ms latency
- [ ] Offline/online sync < 1s

### Developer Experience Success
- [ ] 70% reduction in query management code
- [ ] Simplified mutation patterns
- [ ] Improved development velocity
- [ ] Cleaner, more maintainable codebase

## Acceptance Criteria

### Epic Complete When:
1. **Zero TanStack Query** usage in the codebase
2. **All entities** (Jobs, Tasks, Users, Clients) using Zero
3. **Real-time collaboration** working across all features
4. **Offline functionality** preserved and improved
5. **Performance targets** met or exceeded
6. **All tests passing** with no regressions
7. **Documentation updated** for new Zero patterns
8. **Team trained** on Zero development patterns

## Notes

- This epic represents a significant architectural change
- Requires careful coordination between frontend and backend work
- Success depends on maintaining existing functionality while adding new capabilities
- Real-time features will unlock future collaboration epics
- Foundation for offline-first mobile applications