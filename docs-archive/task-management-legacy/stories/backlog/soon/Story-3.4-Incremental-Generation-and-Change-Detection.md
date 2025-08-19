# Story 3.4: Incremental Generation and Change Detection

**Epic:** Epic-005: Zero Mutation Autogeneration  
**Epic Goal:** Hybrid File Management & Conflict Detection

## User Story
As a developer,
I want the generator to only regenerate changed tables and functions,
so that regeneration is fast and doesn't disrupt my workflow with unnecessary file changes.

## Acceptance Criteria
1. Generator tracks Rails migration timestamps and model file modification times
2. Only regenerates files for tables that have changed since last generation
3. Schema change detection includes new columns, dropped columns, type changes, and constraint modifications
4. Model change detection includes new enums, validation changes, and pattern additions
5. Incremental generation preserves existing custom files and only updates relevant generated files
6. Generator provides `--full` flag to force complete regeneration of all files
7. Change detection works reliably across Rails schema versions and Zero schema updates
8. Incremental generation updates manifest file with only changed entries
9. Generator outputs clear summary of what was regenerated and what was skipped
10. Change detection handles edge cases like table renames, model moves, and namespace changes

## Technical Notes
- Rails migration timestamp and model file modification tracking
- Schema and model change detection for targeted regeneration
- --full flag for complete regeneration when needed
- Edge case handling for table renames and moves

## Definition of Done
- [ ] Rails migration timestamp tracking implemented
- [ ] Model file modification time tracking implemented
- [ ] Only changed tables regenerated
- [ ] Schema change detection (columns, types, constraints)
- [ ] Model change detection (enums, validations, patterns)
- [ ] Existing custom files preserved during incremental generation
- [ ] --full flag for complete regeneration
- [ ] Reliable change detection across Rails/Zero versions
- [ ] Manifest file updated with only changed entries
- [ ] Clear summary output of regenerated vs skipped
- [ ] Edge case handling (renames, moves, namespaces)