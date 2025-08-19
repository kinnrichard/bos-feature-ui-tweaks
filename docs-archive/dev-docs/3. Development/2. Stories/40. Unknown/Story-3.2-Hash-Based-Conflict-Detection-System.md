# Story 3.2: Hash-Based Conflict Detection System

**Epic:** Epic-005: Zero Mutation Autogeneration  
**Epic Goal:** Hybrid File Management & Conflict Detection

## User Story
As a developer,
I want the generator to detect when I've accidentally modified generated files,
so that I'm protected from losing work and guided toward proper custom implementation patterns.

## Acceptance Criteria
1. Generator creates `.generation-manifest.json` tracking SHA256 hashes of all generated function signatures
2. **Modified generated files cause immediate error** - checksum failures indicate accidental editing of auto-generated code
3. Hash comparison detects any changes in generated file contents
4. **Error messages for modified generated files** include clear instructions to move changes to custom files
5. Generator refuses to proceed if generated files have been manually modified until resolved
6. **Custom functions overriding generated functions are logged as info** - this is intended behavior, not a conflict
7. Manifest file tracks generation timestamp, Zero schema version, and Rails model changes
8. Generator provides recovery suggestions when generated files are accidentally modified
9. Hash-based detection is bulletproof against whitespace, comments, and formatting changes
10. **No warnings for intentional function overrides** - custom files are meant to override generated functions

## Technical Notes
- SHA256 hashing for bulletproof change detection
- Immediate errors for modified generated files (not warnings)
- Custom function overrides are intended behavior (info logs only)
- Bulletproof against formatting/whitespace changes

## Definition of Done
- [ ] .generation-manifest.json created with SHA256 hashes
- [ ] Modified generated files cause immediate errors
- [ ] Hash comparison detects any content changes
- [ ] Clear error messages with custom file migration instructions
- [ ] Generator refuses to proceed until conflicts resolved
- [ ] Custom function overrides logged as info (not errors)
- [ ] Manifest tracks generation timestamp and schema versions
- [ ] Recovery suggestions provided for modified generated files
- [ ] Hash detection ignores whitespace/formatting changes
- [ ] No warnings for intentional function overrides