# Story 4.1: Rails Generator Integration

**Epic:** Epic-005: Zero Mutation Autogeneration  
**Epic Goal:** Integration & Developer Experience

## User Story
As a developer,
I want to use familiar Rails generator commands to create and update Zero mutations,
so that the tool feels native to my existing Rails workflow and development habits.

## Acceptance Criteria
1. Implements `rails generate zero:mutations` command for initial generation of all table mutations
2. Implements `rails generate zero:mutations [table_name]` for generating specific table mutations
3. Generator integrates with Rails' existing generator infrastructure and follows Rails conventions
4. Commands respect Rails environment configuration and database connection settings
5. Generator output follows Rails generator formatting with clear status messages and file creation logs
6. Commands include `--dry-run` flag that shows what would be generated without creating files
7. Generator includes `--force` flag for regenerating despite detected conflicts (with clear warnings)
8. Commands integrate with Rails' existing help system (`rails generate --help`)
9. Generator respects Rails' file modification timestamps and change detection
10. Commands work consistently across different Rails versions (7.0+) and Ruby versions

## Technical Notes
- Standard Rails generator infrastructure integration
- Rails environment and database connection respect
- Rails generator formatting and conventions
- Cross-version compatibility (Rails 7.0+, Ruby 3.0+)

## Definition of Done
- [ ] `rails generate zero:mutations` command implemented
- [ ] `rails generate zero:mutations [table_name]` command implemented
- [ ] Integration with Rails generator infrastructure
- [ ] Rails environment and database connection respect
- [ ] Rails generator formatting with status messages
- [ ] --dry-run flag showing preview without file creation
- [ ] --force flag for regenerating despite conflicts
- [ ] Integration with Rails help system
- [ ] Rails file modification timestamp respect
- [ ] Cross-version compatibility verified