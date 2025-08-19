# Story 1.3: Generation Configuration and Validation

**Epic:** Epic-005: Zero Mutation Autogeneration  
**Epic Goal:** Foundation & Pattern Detection

## User Story
As a developer,
I want to configure and validate the generation process,
so that I can control what gets generated and catch issues before code generation begins.

## Acceptance Criteria
1. Generator creates minimal configuration file (`.generation-config.json`) for overrides and exclusions only
2. Developer can exclude specific tables from generation via `excludeTables` array
3. Developer can exclude specific auto-detected patterns per table via `excludePatterns` object
4. Developer can override default naming conventions via `customNaming` object (e.g., `softDelete` → `archive`)
5. Generator validates that target directory (`frontend/src/lib/zero/`) exists and is writable
6. Generator validates that Zero schema files exist and are compatible with detected Rails patterns
7. Generator detects existing custom mutation files to avoid conflicts during initial generation
8. Generator provides dry-run mode that shows what would be generated without creating files
9. Validation errors provide clear, actionable error messages with resolution suggestions
10. Configuration supports incremental generation (only generate for changed tables since last run)
11. Generator integrates with existing Rails command structure (`rails generate zero:mutations`)
12. **Zero configuration required by default** - all patterns are auto-introspected from schema and models

## Technical Notes
- Minimal configuration approach - only overrides and exclusions
- Zero-config by default with intelligent auto-introspection
- Integration with Rails generator infrastructure
- Dry-run mode for preview without file creation

## Definition of Done
- [ ] Minimal configuration file system implemented
- [ ] Table exclusion functionality working
- [ ] Pattern exclusion per table working
- [ ] Custom naming override system working
- [ ] Target directory validation implemented
- [ ] Zero schema compatibility validation working
- [ ] Conflict detection for existing files working
- [ ] Dry-run mode implemented
- [ ] Clear error messages with resolution suggestions
- [ ] Incremental generation support implemented
- [ ] Rails generator integration working
- [ ] Zero-config default behavior verified