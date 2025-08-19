---
title: "Epic Management System"
description: "Comprehensive epic management and tracking system for feature development"
last_updated: "2025-07-17"
status: "active"
category: "project-management"
tags: ["epics", "project-management", "development", "workflow"]
---

# Epic Management System

This directory contains all epics organized by their current status. Epics are large features or initiatives that span multiple user stories and require coordinated development effort.

## Directory Structure

```
epics/
├── README.md           # This file
├── active/             # Currently in progress
│   ├── README.md
│   └── epic-*.md
├── completed/          # Successfully delivered
│   ├── README.md
│   └── epic-*.md
└── backlog/            # Planned for future
    ├── README.md
    └── epic-*.md
```

## Epic Lifecycle

### 1. Backlog → Active
- Epic is prioritized and assigned to development team
- All dependencies are satisfied
- Epic is ready for implementation
- File moved from `backlog/` to `active/`

### 2. Active → Completed
- Epic is fully implemented and tested
- All acceptance criteria are met
- Epic is deployed to production
- File moved from `active/` to `completed/`

## Epic Status Summary

### 🔄 Active (1)
- [Epic-012: Secure Debug Architecture](./active/epic-012-secure-debug-architecture.md)

### ✅ Completed (13)
- **Zero.js Migration & Enhancement** (9 epics)
  - Epic-004 through Epic-011 (Zero.js system development)
- **Debug System & Architecture** (4 epics)
  - Epic-012 through Epic-015 (Debug system standardization)

### 📋 Backlog (1)
- [Epic-016: Axios Interceptors](./backlog/Epic-016-Axios-Interceptors.md)

## Quick Navigation

- [Active Epics](./active/README.md) - Currently in progress
- [Completed Epics](./completed/README.md) - Successfully delivered
- [Backlog Epics](./backlog/README.md) - Planned for future development
- [Stories](../stories/README.md) - User stories and smaller features

## Epic Management Guidelines

### Creating New Epics

1. **Epic Template**: Use the standard epic template
2. **Clear Objectives**: Define clear, measurable objectives
3. **Acceptance Criteria**: Specify detailed acceptance criteria
4. **Dependencies**: Identify and document dependencies
5. **Estimation**: Provide effort estimates
6. **Business Value**: Articulate clear business value

### Epic Workflow

1. **Creation**: Create epic in `backlog/` directory
2. **Prioritization**: Review and prioritize in backlog
3. **Development**: Move to `active/` when starting work
4. **Completion**: Move to `completed/` when delivered
5. **Documentation**: Update README files during transitions

### Epic Documentation Standards

- **Consistent Naming**: Use `epic-###-descriptive-name.md` format
- **Status Updates**: Keep epic status current
- **Progress Tracking**: Use todo lists for task management
- **Cross-References**: Link to related epics and stories
- **Business Context**: Maintain business justification

## Related Documentation

### Story & Feature Development
- **[Stories](../stories/README.md)** - User stories and smaller features
- **[Story Development Process](../stories/in-progress/README.md)** - Active story development
- **[Completed Stories](../stories/completed/README.md)** - Implemented features

### Architecture & Implementation
- **[Technical Decisions](../standards/technical-decisions.md)** - Architecture decision records
- **[Style Guide](../standards/style-guide.md)** - Code style and conventions
- **[Frontend Architecture](../architecture/frontend-architecture.md)** - Svelte + TypeScript patterns

### Development Workflow
- **[Workflow Plan](../../workflow-plan.md)** - Project execution workflow
- **[Feature Request Workflow](../workflows/feature-request-workflow.md)** - Feature development process
- **[Claude Automation](../guides/claude-automation-setup.md)** - Automated development setup

### Testing & Quality
- **[Testing Strategy](../tests/readme-tests.md)** - Testing approach and patterns
- **[Test Plan Critical Areas](../guides/test-plan-critical-areas.md)** - Testing focus areas
- **[Performance Guidelines](../architecture/performance-guidelines.md)** - Performance optimization

### See Also
- **[API Documentation](../api/README.md)** - API development related to epics
- **[Frontend Integration](../api/frontend-integration.md)** - Frontend implementation patterns
- **[Zero.js Integration](../../frontend/src/lib/zero/README.md)** - Zero.js reactive system

## Migration Notes

This organized structure was created by consolidating epics from:
- `dev-docs/3. Development/1. Epics/` (legacy location)
- Various scattered epic files throughout the repository

All epics have been categorized by their actual completion status and moved to the appropriate directories.