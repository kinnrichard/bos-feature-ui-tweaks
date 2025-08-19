# Story 4.2: Development Workflow Integration

**Epic:** Epic-005: Zero Mutation Autogeneration  
**Epic Goal:** Integration & Developer Experience

## User Story
As a developer,
I want the mutation generator to integrate smoothly with my existing development processes,
so that I can incorporate it into my regular Rails/Zero development workflow without friction.

## Acceptance Criteria
1. Generator automatically detects schema changes during `rails db:migrate` via Rails hooks
2. Provides optional automatic regeneration trigger after successful migrations
3. Generator works with Rails' existing file watching and auto-reloading systems
4. Integration with existing Zero schema generation workflow (`rails generate zero:schema`)
5. Generated files respect existing `.gitignore` patterns and version control workflows
6. Generator provides clear output indicating which files were created, updated, or skipped
7. Integration handles Rails environments correctly (development, test, production schema differences)
8. Generator respects existing Rails asset pipeline and build processes
9. Commands work correctly within Rails console, rake tasks, and CI/CD environments
10. Generator provides hooks for custom post-generation processing (formatting, linting, testing)

## Technical Notes
- Rails migration hook integration for automatic detection
- Integration with existing Zero schema workflow
- Rails environment handling and asset pipeline respect
- CI/CD environment compatibility

## Definition of Done
- [ ] Automatic schema change detection during rails db:migrate
- [ ] Optional automatic regeneration after successful migrations
- [ ] Integration with Rails file watching and auto-reloading
- [ ] Integration with existing rails generate zero:schema workflow
- [ ] Generated files respect .gitignore patterns
- [ ] Clear output showing created/updated/skipped files
- [ ] Rails environment handling (dev/test/prod differences)
- [ ] Rails asset pipeline and build process respect
- [ ] Commands work in Rails console, rake tasks, CI/CD
- [ ] Hooks for custom post-generation processing