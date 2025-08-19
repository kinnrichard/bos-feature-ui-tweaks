---
title: "bŏs Documentation Hub"
description: "Comprehensive documentation for the bŏs client/job/task management system"
last_updated: "2025-07-17"
status: "active"
category: "hub"
tags: ["documentation", "overview", "navigation", "quick-start"]
---

# bŏs Documentation Hub

> **Comprehensive documentation for the bŏs client/job/task management system**

## 🚀 Quick Start

### For New Developers
1. **[Environment Setup](../README-ENVIRONMENT-SETUP.md)** - Get your development environment running
2. **[Architecture Overview](./architecture/index.md)** - Understand the system design
3. **[Coding Standards](./architecture/coding-standards.md)** - Follow project conventions
4. **[First Contribution Guide](./getting-started/first-contribution.md)** - Make your first change

### For API Consumers
1. **[API Overview](./api/README.md)** - Complete API documentation
2. **[Authentication Guide](./api/api-authentication.md)** - API security and auth
3. **[Endpoint Reference](./api/api-specification.md)** - All available endpoints
4. **[Integration Examples](./api/examples/)** - Code samples and patterns

### For Frontend Developers
1. **[Frontend Hub](./frontend/README.md)** - Complete frontend documentation
2. **[Frontend Architecture](./architecture/frontend-architecture.md)** - Svelte + TypeScript patterns
3. **[Debug System Guide](./frontend/epics/epic-014-debug-system-guide.md)** - Debug system implementation
4. **[Testing Guide](./testing/playwright.md)** - Frontend testing with Playwright
5. **[UI/UX Guidelines](./architecture/ui-ux-spec.md)** - Apple-like interface patterns

### For Email Parser Setup
1. **[Setup Guide](./EMAIL_PARSER_SETUP.md)** - Install PyCall and Python dependencies
2. **[API Reference](./EMAIL_PARSER_API.md)** - Service usage and examples
3. **[Troubleshooting](./EMAIL_PARSER_TROUBLESHOOTING.md)** - Fix common issues
4. **[Migration Guide](./EMAIL_PARSER_MIGRATION.md)** - Migrate existing data

---

## 📚 Documentation Structure

### 🏗️ Architecture & Design
- **[Architecture Index](./architecture/index.md)** - Technical overview
- **[Frontend Architecture](./architecture/frontend-architecture.md)** - Svelte + TypeScript
- **[Backend Architecture](./architecture/backend-architecture.md)** - Rails API patterns
- **[Database Schema](./architecture/database-schema.md)** - PostgreSQL structure
- **[Data Models](./architecture/data-models.md)** - Business entities
- **[Technical Decisions](./architecture/decisions/)** - ADRs and design choices

### 📧 Email Parser System
- **[Setup Guide](./EMAIL_PARSER_SETUP.md)** - Complete installation and configuration
- **[API Reference](./EMAIL_PARSER_API.md)** - Comprehensive API documentation and examples
- **[Troubleshooting](./EMAIL_PARSER_TROUBLESHOOTING.md)** - Common issues and solutions
- **[Operations Guide](./EMAIL_PARSER_OPERATIONS.md)** - Performance tuning and monitoring
- **[Migration Guide](./EMAIL_PARSER_MIGRATION.md)** - Migrating existing data

### 🔌 API Documentation
- **[API Overview](./api/README.md)** - Complete API documentation
- **[Authentication](./api/api-authentication.md)** - Security and auth methods
- **[Specification](./api/api-specification.md)** - Technical API spec
- **[Frontend Integration](./api/FRONTEND_INTEGRATION.md)** - Frontend API patterns
- **[V1 API](./api/v1/)** - Version 1 specific documentation
- **[Legacy API](./api/LEGACY_API_SPEC.md)** - Legacy Rails API reference

### 💻 Development Guides
- **[Coding Standards](./architecture/coding-standards.md)** - Project conventions
- **[Testing Strategy](./testing/overview.md)** - Complete testing approach
- **[Debugging Guide](./architecture/debugging-guide.md)** - Professional debugging
- **[Performance Guidelines](./architecture/performance-guidelines.md)** - Optimization
- **[Troubleshooting](./architecture/troubleshooting-guide.md)** - Common issues

### 🎨 Frontend Development
- **[Frontend Hub](./frontend/README.md)** - Complete frontend documentation
- **[Debug System Guide](./frontend/epics/epic-014-debug-system-guide.md)** - Debug system implementation
- **[Debug Best Practices](./frontend/debug/best-practices.md)** - Professional debugging patterns
- **[Debug Quick Reference](./frontend/debug/quick-reference.md)** - Quick debug namespace reference

### 🧩 UI Components & Patterns
- **[Chromeless UI Pattern](./dev/chromeless-ui-pattern.md)** - Clean, borderless input design pattern
- **[ChromelessInput Component](./dev/components-chromeless-input.md)** - Reusable chromeless input component
- **[Component Library](./dev/components/)** - All UI component documentation

### 🧪 Testing Documentation
- **[Testing Overview](./testing/overview.md)** - Testing strategy
- **[Playwright Guide](./testing/playwright.md)** - Frontend testing
- **[Test Helpers](./testing/helpers.md)** - Testing utilities
- **[Integration Tests](./testing/integration.md)** - Full system tests

### 📋 Project Management
- **[Task Management](../tasks/)** - AI TrackDown task management system
- **[Legacy Task Archive](./archive/task-management-legacy/)** - Archived epics and stories (migrated to AI TrackDown)
- **[Migration Mapping](./archive/task-management-legacy/MIGRATION-MAPPING.md)** - Map of legacy IDs to AI TrackDown IDs
- **[PRDs](./PRDs/)** - Product requirements documents

### 🔄 Migration & Legacy
- **[Svelte Migration](./PRDs/svelte-migration.md)** - Frontend migration plan
- **[Legacy Documentation](./legacy/)** - Historical documentation
- **[Migration Guides](./legacy/migration-guides/)** - Migration instructions

---

## 🛠️ Development Workflow

### Environment Setup
```bash
# Initial setup
git clone <repository>
cd bos
bundle install
cd frontend && npm install

# Start development servers
rails server -b 0.0.0.0 > /dev/null 2>&1 &
cd frontend && npm run dev
```

### Testing Workflow
```bash
# Run all checks
npm run check && npm run lint    # Frontend
rubocop -A                       # Backend
npm run test                     # Run tests
```

### Git Workflow
```bash
# After completing work
git add .
git commit -m "feat: description —CC"
git push
```

---

## 🔍 Finding Information

### By User Type
- **New Developer** → [Getting Started](./getting-started/)
- **API Consumer** → [API Documentation](./api/)
- **Frontend Developer** → [Frontend Architecture](./architecture/frontend-architecture.md)
- **Backend Developer** → [Backend Architecture](./architecture/backend-architecture.md)
- **DevOps Engineer** → [Deployment Guide](./architecture/deployment-guide.md)
- **QA Engineer** → [Testing Documentation](./testing/)

### By Task Type
- **Adding Features** → [Development Guides](./development/) + [Testing](./testing/)
- **Fixing Bugs** → [Debugging Guide](./architecture/debugging-guide.md) + [Troubleshooting](./architecture/troubleshooting-guide.md)
- **API Integration** → [API Documentation](./api/) + [Examples](./api/examples/)
- **UI Changes** → [Frontend Architecture](./architecture/frontend-architecture.md) + [UI/UX Guidelines](./architecture/ui-ux-spec.md)
- **Performance Issues** → [Performance Guidelines](./architecture/performance-guidelines.md)
- **Email Parser Issues** → [Email Parser Troubleshooting](./EMAIL_PARSER_TROUBLESHOOTING.md) + [Operations Guide](./EMAIL_PARSER_OPERATIONS.md)
- **Email Parser Setup** → [Setup Guide](./EMAIL_PARSER_SETUP.md) + [Migration Guide](./EMAIL_PARSER_MIGRATION.md)
- **Deployment** → [Deployment Guide](./architecture/deployment-guide.md)

---

## 🏷️ Key Technologies

- **Backend**: Rails 8.0.2, Ruby 3.4.4, PostgreSQL (JSON API)
- **Frontend**: SvelteKit, Svelte 4, TypeScript, Tailwind CSS
- **Email Processing**: PyCall + Python Talon library for email parsing
- **Background Jobs**: SolidQueue for asynchronous processing
- **Testing**: Playwright (primary), Rails Minitest
- **Deployment**: Kamal, Docker
- **Development**: Claude-Flow orchestration system

---

## 📝 Documentation Standards

### For Contributors
- Use consistent markdown formatting
- Add frontmatter metadata to all documents
- Include cross-references to related documents
- Update this index when adding new documentation
- Follow the established directory structure

### For Maintainers
- Review documentation freshness monthly
- Update architecture decisions when patterns change
- Consolidate duplicate information
- Archive outdated documentation to `./legacy/`

---

## 🔗 Related Documentation

### Architecture & Implementation
- **[Frontend Debug System](./frontend/epics/epic-014-debug-system-guide.md)** - Comprehensive debug system documentation
- **[Frontend Migration Guide](../frontend/epic-008-migration-guide.md)** - Svelte 5 migration patterns
- **[Zero.js Integration](../frontend/src/lib/zero/README.md)** - Zero.js reactive system documentation
- **[ReactiveRecord Usage](../dev-docs/using-reactive-record.md)** - ActiveRecord-style reactive patterns

### Project Planning & Management
- **[Workflow Plan](../workflow-plan.md)** - Project execution workflow
- **[BMAD Context](../dev-docs/bmad-context/prd.md)** - Business context and requirements
- **[AI TrackDown](../tasks/)** - Current task management system (epics, issues, tasks)
- **[Legacy Task Archive](./archive/task-management-legacy/)** - Historical epics and stories

### Development & Automation
- **[Claude Automation](./guides/claude-automation-setup.md)** - Automated bug fixing setup
- **[Feature Request Workflow](./workflows/feature-request-workflow.md)** - Feature development process
- **[Testing Critical Areas](./guides/test-plan-critical-areas.md)** - Testing focus areas

### See Also
- **[API Frontend Integration](./api/frontend-integration.md)** - API consumption patterns
- **[Technical Decisions](./standards/technical-decisions.md)** - Architecture decision records
- **[Style Guide](./standards/style-guide.md)** - Code style and conventions

---

## 🆘 Getting Help

### Internal Resources
- **[Troubleshooting Guide](./architecture/troubleshooting-guide.md)** - Common issues and solutions
- **[Team Communication](./team/)** - Communication channels
- **[Contributing Guidelines](./contributing.md)** - How to contribute to the project

### External Resources
- **[SvelteKit Documentation](https://kit.svelte.dev/docs)** - Official SvelteKit docs
- **[Rails API Documentation](https://guides.rubyonrails.org/api_app.html)** - Rails API patterns
- **[Playwright Documentation](https://playwright.dev/)** - Testing framework docs

---

**Last Updated**: August 5, 2025  
**Maintained By**: Development Team  
**Documentation Version**: 2.2  

*This documentation hub provides comprehensive navigation for the bŏs system. Choose your path above based on your role and current needs.*